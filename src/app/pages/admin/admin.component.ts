import { Component, HostListener, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { AuthService } from '../../services/auth.service';
import { UploadService } from '../../services/upload.service';
import { GalleryService, GalleryImage, GalleryEntry } from '../../services/gallery.service';
import { Review } from '../../services/reviews.service';
import { environment } from '../../../environments/environment';
import { HeroComponent } from '../../components/hero/hero.component';
import { DEFAULT_LOCATIONS } from '../../defaults/locations';

interface AdminGalleryImage extends GalleryImage {
  deleting?: boolean;
  customTag?: string; // tag set by admin (stored in gallery.json)
}

interface AdminReview extends Review {
  deleting?: boolean;
  editing?: boolean;
}

interface UploadItem {
  file: File;
  filename: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

const GALLERY_BUCKET = environment.aws.galleryBucket;
const REVIEWS_BUCKET = environment.aws.reviewsBucket;
const REGION = environment.aws.region;

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, HeroComponent, RouterLink],
  templateUrl: './admin.component.html',
})
export class AdminComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private uploadService = inject(UploadService);
  private galleryService = inject(GalleryService);
  private router = inject(Router);
  private meta = inject(Meta);
  private cdr = inject(ChangeDetectorRef);

  activeTab: 'dashboard' | 'hero' | 'og' | 'about' | 'residential' | 'commercial' | 'gallery' | 'reviews' | 'locations' | 'faq' | 'settings' = 'dashboard';

  /* Pagination */
  pageSize = 10;
  pages: Record<string, number> = {};

  getPage(list: string): number {
    return this.pages[list] || 1;
  }

  setPage(list: string, page: number): void {
    this.pages[list] = page;
    this.cdr.detectChanges();
  }

  pageStart(list: string): number {
    return (this.getPage(list) - 1) * this.pageSize;
  }

  pageItems(arr: any[], list: string): any[] {
    const start = this.pageStart(list);
    return arr.slice(start, start + this.pageSize);
  }

  totalPages(arr: any[]): number {
    return Math.ceil(arr.length / this.pageSize);
  }

  pageRange(arr: any[]): number[] {
    const total = this.totalPages(arr);
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  /** Returns actual array indices for the current page */
  pageIndices(arr: any[], list: string): number[] {
    const start = this.pageStart(list);
    const end = Math.min(start + this.pageSize, arr.length);
    return Array.from({ length: end - start }, (_, i) => start + i);
  }

  /** Dispatch refresh action by list name */
  refreshList(list: string): void {
    switch (list) {
      case 'gallery': this.loadImages(); break;
      case 'reviews': this.loadReviews(); break;
      case 'locations': this.loadLocations(); break;
      case 'faq': this.loadFaq(); break;
      case 'residential':
      case 'commercialIndustries':
      case 'commercialServices':
        this.loadServiceCards(); break;
    }
  }

  /* Gallery state */
  images: AdminGalleryImage[] = [];
  uploads: UploadItem[] = [];
  tag = '';
  loadingImages = true;
  uploading = false;

  /* Reviews state */
  reviews: AdminReview[] = [];
  loadingReviews = true;
  showReviewForm = false;
  showUploadForm = false;
  editingReview: AdminReview | null = null;
  reviewForm = { name: '', rating: 5, text: '', location: '', date: '' };

  ngOnInit(): void {
    this.meta.addTag({ name: 'robots', content: 'noindex, nofollow' });
    this.loadImages();
    this.loadReviews();
    this.loadSiteImages();
    this.loadLocations();
    this.loadServiceCards();
    this.loadFaq();
  }

  ngOnDestroy(): void {
    this.meta.removeTag('name="robots"');
  }

  /* ================================================================
   * GALLERY
   * ================================================================ */

  async loadImages(): Promise<void> {
    this.loadingImages = true;
    this.cdr.detectChanges();
    try {
      // Try loading from manifest first (preserves order + custom tags)
      // Fall back to S3 listing if manifest doesn't exist yet
      try {
        const response = await fetch(`/gallery-images/gallery.json?t=${Date.now()}`);
        if (response.ok) {
          const entries: GalleryEntry[] = await response.json();
          this.images = entries
            .map(e => {
              const img = this.galleryService.parseEntry(e) as AdminGalleryImage;
              // Preserve custom tag info for saving back
              if (typeof e !== 'string' && e.tag) {
                img.customTag = e.tag;
              }
              return img;
            })
            .filter(img => /\.(jpg|jpeg|png|webp)$/i.test(img.filename));
        } else {
          throw new Error('no manifest');
        }
      } catch {
        const filenames = await this.listS3(GALLERY_BUCKET, 'gallery-images/');
        this.images = filenames.map(f => this.galleryService.parseFilename(f) as AdminGalleryImage);
      }
    } catch {
      this.images = [];
    }
    this.loadingImages = false;
    this.cdr.detectChanges();
  }

  private async saveGalleryManifest(): Promise<void> {
    const entries: GalleryEntry[] = this.images.map(img => {
      const adminImg = img as AdminGalleryImage;
      if (adminImg.customTag) {
        return { file: img.filename, tag: adminImg.customTag };
      }
      return img.filename;
    });
    await this.uploadService.putJson('gallery-images/gallery.json', entries, GALLERY_BUCKET);
  }

  /* Position editing state */
  editingPositionList: string | null = null;
  editingPositionIndex = -1;

  startEditPosition(list: string, index: number): void {
    this.editingPositionList = list;
    this.editingPositionIndex = index;
  }

  cancelEditPosition(): void {
    this.editingPositionList = null;
    this.editingPositionIndex = -1;
  }

  async applyPosition(list: string, fromIndex: number, newPos: number): Promise<void> {
    if (this.editingPositionList !== list || this.editingPositionIndex !== fromIndex) return;
    this.cancelEditPosition();
    const arr = this.getListArray(list);
    if (!arr || arr.length === 0) return;

    // Clamp to valid range (1-based input)
    let toIndex = Math.max(0, Math.min(newPos - 1, arr.length - 1));
    if (toIndex === fromIndex) return;

    const [item] = arr.splice(fromIndex, 1);
    arr.splice(toIndex, 0, item);
    this.cdr.detectChanges();

    await this.saveListArray(list);
  }

  private getListArray(list: string): any[] | null {
    switch (list) {
      case 'gallery': return this.images;
      case 'reviews': return this.reviews;
      case 'locations': return this.locations;
      case 'faq': return this.faqItems;
      case 'residential': return this.residentialCards;
      case 'commercialIndustries': return this.commercialIndustries;
      case 'commercialServices': return this.commercialServices;
      default: return null;
    }
  }

  private async saveListArray(list: string): Promise<void> {
    switch (list) {
      case 'gallery': await this.saveGalleryManifest(); break;
      case 'reviews': await this.saveReviews(); break;
      case 'locations': await this.saveLocations(); break;
      case 'faq': await this.saveFaq(); break;
      case 'residential':
      case 'commercialIndustries':
      case 'commercialServices': await this.saveServiceCards(); break;
    }
  }

  /* Drag and drop state */
  dragIndex = -1;
  dragOverIndex = -1;
  dropTargetIndex = -1;
  dragging = false;

  onDragStart(index: number): void {
    this.dragIndex = index;
    this.dragging = true;
    this.cdr.detectChanges();
  }

  /** Determines drop position based on cursor being in top or bottom half of row */
  onRowDragOver(event: DragEvent, rowIndex: number): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const insertAt = event.clientY < midY ? rowIndex : rowIndex + 1;
    if (insertAt !== this.dragOverIndex) {
      this.dragOverIndex = insertAt;
      this.dropTargetIndex = insertAt;
      this.cdr.detectChanges();
    }
  }

  onDragEnd(): void {
    this.dragIndex = -1;
    this.dragOverIndex = -1;
    this.dropTargetIndex = -1;
    this.dragging = false;
    this.cdr.detectChanges();
  }

  async onDrop(event: DragEvent, targetIndex: number): Promise<void> {
    event.preventDefault();
    const fromIndex = this.dragIndex;
    this.dragIndex = -1;
    this.dragOverIndex = -1;
    this.dropTargetIndex = -1;
    this.dragging = false;
    this.cdr.detectChanges();

    if (fromIndex < 0 || fromIndex === targetIndex || fromIndex === targetIndex - 1) return;

    // Remove from old position, insert at new position
    const [item] = this.images.splice(fromIndex, 1);
    const insertAt = targetIndex > fromIndex ? targetIndex - 1 : targetIndex;
    this.images.splice(insertAt, 0, item);
    this.cdr.detectChanges();

    try {
      await this.saveGalleryManifest();
    } catch (e: any) {
      alert(`Reorder failed: ${e.message}`);
      await this.loadImages();
    }
  }

  /* ---------- Tag editing ---------- */

  editingTagImage: AdminGalleryImage | null = null;
  editingTagValue = '';

  startEditTag(image: AdminGalleryImage): void {
    this.editingTagImage = image;
    this.editingTagValue = image.tagLabel === 'Uncategorized' ? '' : image.tagLabel;
    this.cdr.detectChanges();
  }

  async saveTag(): Promise<void> {
    const image = this.editingTagImage;
    if (!image) return;
    const trimmed = this.editingTagValue.trim();
    if (trimmed) {
      image.customTag = trimmed;
      image.tagLabel = trimmed;
      image.tag = trimmed.toLowerCase().replace(/\s+/g, '-');
    } else {
      // Clear custom tag — revert to filename-inferred
      image.customTag = undefined;
      const parsed = this.galleryService.parseFilename(image.filename);
      image.tag = parsed.tag;
      image.tagLabel = parsed.tagLabel;
    }
    this.editingTagImage = null;
    this.editingTagValue = '';
    await this.saveGalleryManifest();
    this.cdr.detectChanges();
  }

  cancelEditTag(): void {
    this.editingTagImage = null;
    this.editingTagValue = '';
    this.cdr.detectChanges();
  }

  async deleteImage(image: AdminGalleryImage): Promise<void> {
    image.deleting = true;
    this.cdr.detectChanges();
    try {
      await this.uploadService.delete(`gallery-images/${image.filename}`, GALLERY_BUCKET);
      this.images = this.images.filter(i => i !== image);
      await this.saveGalleryManifest();
    } catch (e: any) {
      image.deleting = false;
      alert(`Delete failed: ${e.message}`);
    }
    this.cdr.detectChanges();
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;

    const now = new Date();
    const dateStr = [
      now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'), String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'), String(now.getSeconds()).padStart(2, '0'),
    ].join('-');

    const maxSort = this.images.reduce((max, img) => Math.max(max, img.sortNumber), 0);
    let nextNum = maxSort + 1;

    for (const file of Array.from(input.files)) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const num = String(nextNum++).padStart(4, '0');
      const slug = this.tag || 'uncategorized';
      this.uploads.push({ file, filename: `${num}_${dateStr}_${slug}.${ext}`, status: 'pending' });
    }
    input.value = '';
  }

  removeUpload(index: number): void {
    this.uploads.splice(index, 1);
  }

  async uploadAll(): Promise<void> {
    this.uploading = true;
    for (const item of this.uploads.filter(u => u.status === 'pending')) {
      item.status = 'uploading';
      this.cdr.detectChanges();
      try {
        await this.uploadService.upload(item.file, `gallery-images/${item.filename}`, GALLERY_BUCKET);
        item.status = 'done';
      } catch (e: any) {
        item.status = 'error';
        item.error = e.message;
      }
      this.cdr.detectChanges();
    }
    this.uploading = false;
    const done = this.uploads.filter(u => u.status === 'done');
    const newFilenames = done.map(u => u.filename);
    this.uploads = this.uploads.filter(u => u.status !== 'done');

    // Append new uploads to existing order and save manifest
    for (const fn of newFilenames) {
      this.images.push(this.galleryService.parseFilename(fn) as AdminGalleryImage);
    }
    await this.saveGalleryManifest();
    // Close the upload form if everything uploaded successfully
    if (this.uploads.length === 0) {
      this.showUploadForm = false;
    }
    this.cdr.detectChanges();
  }

  /* ================================================================
   * REVIEWS
   * ================================================================ */

  async loadReviews(): Promise<void> {
    this.loadingReviews = true;
    this.cdr.detectChanges();
    try {
      const response = await fetch(`/reviews-data/reviews.json?t=${Date.now()}`);
      this.reviews = response.ok ? await response.json() : [];
    } catch {
      this.reviews = [];
    }
    this.loadingReviews = false;
    this.cdr.detectChanges();
  }

  private async saveReviews(): Promise<void> {
    await this.uploadService.putJson('reviews-data/reviews.json', this.reviews, REVIEWS_BUCKET);
  }

  openNewReview(): void {
    this.editingReview = null;
    const today = new Date().toISOString().split('T')[0];
    this.reviewForm = { name: '', rating: 5, text: '', location: '', date: today };
    this.showReviewForm = true;
  }

  openEditReview(review: AdminReview): void {
    this.editingReview = review;
    this.reviewForm = {
      name: review.name,
      rating: review.rating,
      text: review.text,
      location: review.location,
      date: review.date,
    };
    this.showReviewForm = true;
  }

  cancelReviewForm(): void {
    this.showReviewForm = false;
    this.editingReview = null;
  }

  async saveReview(): Promise<void> {
    if (this.editingReview) {
      // Update existing
      Object.assign(this.editingReview, this.reviewForm);
    } else {
      // Add new
      const id = 'r' + Date.now();
      this.reviews.unshift({ id, ...this.reviewForm });
    }
    this.showReviewForm = false;
    this.editingReview = null;
    await this.saveReviews();
    this.cdr.detectChanges();
  }

  async deleteReview(review: AdminReview): Promise<void> {
    review.deleting = true;
    this.cdr.detectChanges();
    this.reviews = this.reviews.filter(r => r !== review);
    await this.saveReviews();
    this.cdr.detectChanges();
  }

  /* Review drag and drop */
  reviewDragIndex = -1;
  reviewDragOverIndex = -1;

  onReviewDragStart(index: number): void {
    this.reviewDragIndex = index;
    this.cdr.detectChanges();
  }

  onReviewRowDragOver(event: DragEvent, rowIndex: number): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const insertAt = event.clientY < midY ? rowIndex : rowIndex + 1;
    if (insertAt !== this.reviewDragOverIndex) {
      this.reviewDragOverIndex = insertAt;
      this.cdr.detectChanges();
    }
  }

  onReviewDragEnd(): void {
    this.reviewDragIndex = -1;
    this.reviewDragOverIndex = -1;
    this.cdr.detectChanges();
  }

  async onReviewDrop(event: DragEvent, targetIndex: number): Promise<void> {
    event.preventDefault();
    const fromIndex = this.reviewDragIndex;
    this.reviewDragIndex = -1;
    this.reviewDragOverIndex = -1;
    this.cdr.detectChanges();

    if (fromIndex < 0 || fromIndex === targetIndex || fromIndex === targetIndex - 1) return;

    const [item] = this.reviews.splice(fromIndex, 1);
    const insertAt = targetIndex > fromIndex ? targetIndex - 1 : targetIndex;
    this.reviews.splice(insertAt, 0, item);
    this.cdr.detectChanges();

    await this.saveReviews();
  }

  /* ================================================================
   * S3 LIST (shared)
   * ================================================================ */

  private async listS3(bucket: string, prefix: string): Promise<string[]> {
    const credentials = await this.auth.getCredentials();
    const host = `${bucket}.s3.${REGION}.amazonaws.com`;
    const filenames: string[] = [];
    let continuationToken: string | null = null;

    do {
      const params = new URLSearchParams({ 'list-type': '2', 'prefix': prefix });
      if (continuationToken) params.set('continuation-token', continuationToken);

      const dateStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const shortDate = dateStamp.substring(0, 8);
      const bodyHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

      const headers: Record<string, string> = {
        'host': host, 'x-amz-content-sha256': bodyHash,
        'x-amz-date': dateStamp, 'x-amz-security-token': credentials.sessionToken,
      };

      const signedHeaderKeys = Object.keys(headers).sort();
      const signedHeaders = signedHeaderKeys.join(';');
      const canonicalHeaders = signedHeaderKeys.map(k => `${k}:${headers[k]}\n`).join('');
      const canonicalRequest = ['GET', '/', params.toString(), canonicalHeaders, signedHeaders, bodyHash].join('\n');

      const scope = `${shortDate}/${REGION}/s3/aws4_request`;
      const encoder = new TextEncoder();
      const crHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(canonicalRequest)))).map(b => b.toString(16).padStart(2, '0')).join('');
      const stringToSign = ['AWS4-HMAC-SHA256', dateStamp, scope, crHash].join('\n');

      const sign = async (key: ArrayBuffer | string, data: string) => {
        const k = typeof key === 'string' ? encoder.encode(key) : key;
        const ck = await crypto.subtle.importKey('raw', k, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        return crypto.subtle.sign('HMAC', ck, encoder.encode(data));
      };

      const kDate = await sign(`AWS4${credentials.secretAccessKey}`, shortDate);
      const kRegion = await sign(kDate, REGION);
      const kService = await sign(kRegion, 's3');
      const kSigning = await sign(kService, 'aws4_request');
      const sig = Array.from(new Uint8Array(await sign(kSigning, stringToSign))).map(b => b.toString(16).padStart(2, '0')).join('');

      const response = await fetch(`https://${host}/?${params}`, {
        headers: { ...headers, 'Authorization': `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${sig}` },
      });

      const doc = new DOMParser().parseFromString(await response.text(), 'application/xml');
      for (const item of doc.querySelectorAll('Contents')) {
        const key = item.querySelector('Key')?.textContent || '';
        const name = key.slice(prefix.length);
        if (name && !/\.json$/i.test(name)) filenames.push(name);
      }

      const isTruncated = doc.querySelector('IsTruncated')?.textContent === 'true';
      continuationToken = isTruncated ? doc.querySelector('NextContinuationToken')?.textContent || null : null;
    } while (continuationToken);

    return filenames.sort();
  }

  /* ================================================================
   * SETTINGS
   * ================================================================ */

  passwordForm = { current: '', newPassword: '', confirm: '' };
  passwordChanging = false;
  passwordSuccess = false;
  passwordError = '';

  async changePassword(): Promise<void> {
    this.passwordError = '';
    this.passwordSuccess = false;

    if (this.passwordForm.newPassword !== this.passwordForm.confirm) {
      this.passwordError = 'Passwords do not match';
      return;
    }

    this.passwordChanging = true;
    this.cdr.detectChanges();

    try {
      await this.auth.changePassword(this.passwordForm.current, this.passwordForm.newPassword);
      this.passwordSuccess = true;
      this.passwordForm = { current: '', newPassword: '', confirm: '' };
    } catch (e: any) {
      this.passwordError = e.message || 'Password change failed';
    }

    this.passwordChanging = false;
    this.cdr.detectChanges();
  }

  /* ================================================================
   * SITE (Hero Image + OG Image)
   * Hash-based cache busting: files stored as hero-<hash>.jpg,
   * og-<hash>.jpg. meta.json tracks current filenames.
   * ================================================================ */

  heroImageUrl: string | null = null;
  heroUploading = false;
  heroSuccess = false;
  heroError = '';
  heroStagedFile: File | null = null;
  heroStagedPreview: string | null = null;

  ogImageUrl: string | null = null;
  ogUploading = false;
  ogSuccess = false;
  ogError = '';

  private siteMeta: { hero?: string; og?: string } = {};
  private readonly META_JSON_KEY = 'gallery-images/meta.json';
  private readonly META_PREFIX = '/gallery-images/meta/';

  private randomHash(): string {
    return Array.from(crypto.getRandomValues(new Uint8Array(3)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async loadMeta(): Promise<void> {
    try {
      const res = await fetch(`/gallery-images/meta.json?t=${Date.now()}`);
      if (res.ok) this.siteMeta = await res.json();
    } catch { /* empty meta */ }
  }

  private async saveMeta(): Promise<void> {
    await this.uploadService.putJson(this.META_JSON_KEY, this.siteMeta, GALLERY_BUCKET);
  }

  async loadSiteImages(): Promise<void> {
    await this.loadMeta();
    this.heroImageUrl = this.siteMeta.hero ? `${this.META_PREFIX}${this.siteMeta.hero}` : null;
    this.ogImageUrl = this.siteMeta.og ? `${this.META_PREFIX}${this.siteMeta.og}` : null;
    this.cdr.detectChanges();
  }

  onHeroFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    this.heroError = '';
    this.heroSuccess = false;

    // Revoke previous staged preview
    if (this.heroStagedPreview) URL.revokeObjectURL(this.heroStagedPreview);

    this.heroStagedFile = input.files[0];
    this.heroStagedPreview = URL.createObjectURL(this.heroStagedFile);
    input.value = '';
    this.cdr.detectChanges();
  }

  cancelHeroStaged(): void {
    if (this.heroStagedPreview) URL.revokeObjectURL(this.heroStagedPreview);
    this.heroStagedFile = null;
    this.heroStagedPreview = null;
    this.cdr.detectChanges();
  }

  async confirmHeroUpload(): Promise<void> {
    if (!this.heroStagedFile) return;

    this.heroUploading = true;
    this.heroError = '';
    this.heroSuccess = false;
    this.cdr.detectChanges();

    try {
      const ext = this.heroStagedFile.name.split('.').pop()?.toLowerCase() || 'jpg';
      const newName = `hero-${this.randomHash()}.${ext}`;
      await this.uploadService.upload(this.heroStagedFile, `gallery-images/meta/${newName}`, GALLERY_BUCKET);
      // Delete old file
      if (this.siteMeta.hero) {
        await this.uploadService.delete(`gallery-images/meta/${this.siteMeta.hero}`, GALLERY_BUCKET).catch(() => {});
      }
      this.siteMeta.hero = newName;
      await this.saveMeta();
      this.heroImageUrl = `${this.META_PREFIX}${newName}`;
      this.heroSuccess = true;
    } catch (e: any) {
      this.heroError = e.message || 'Upload failed';
    }

    if (this.heroStagedPreview) URL.revokeObjectURL(this.heroStagedPreview);
    this.heroStagedFile = null;
    this.heroStagedPreview = null;
    this.heroUploading = false;
    this.cdr.detectChanges();
  }

  async deleteHeroImage(): Promise<void> {
    this.heroError = '';
    this.heroSuccess = false;
    try {
      if (this.siteMeta.hero) {
        await this.uploadService.delete(`gallery-images/meta/${this.siteMeta.hero}`, GALLERY_BUCKET);
      }
      delete this.siteMeta.hero;
      await this.saveMeta();
      // Re-fetch from server to confirm deletion persisted
      await this.loadSiteImages();
    } catch (e: any) {
      this.heroError = e.message || 'Delete failed';
    }
    this.cdr.detectChanges();
  }

  async onOgFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    input.value = '';

    this.ogUploading = true;
    this.ogError = '';
    this.ogSuccess = false;
    this.cdr.detectChanges();

    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const newName = `og-${this.randomHash()}.${ext}`;
      await this.uploadService.upload(file, `gallery-images/meta/${newName}`, GALLERY_BUCKET);
      if (this.siteMeta.og) {
        await this.uploadService.delete(`gallery-images/meta/${this.siteMeta.og}`, GALLERY_BUCKET).catch(() => {});
      }
      this.siteMeta.og = newName;
      await this.saveMeta();
      this.ogImageUrl = `${this.META_PREFIX}${newName}`;
      this.ogSuccess = true;
    } catch (e: any) {
      this.ogError = e.message || 'Upload failed';
    }

    this.ogUploading = false;
    this.cdr.detectChanges();
  }

  async deleteOgImage(): Promise<void> {
    this.ogError = '';
    this.ogSuccess = false;
    try {
      if (this.siteMeta.og) {
        await this.uploadService.delete(`gallery-images/meta/${this.siteMeta.og}`, GALLERY_BUCKET);
      }
      delete this.siteMeta.og;
      await this.saveMeta();
      this.ogImageUrl = null;
    } catch (e: any) {
      this.ogError = e.message || 'Delete failed';
    }
    this.cdr.detectChanges();
  }

  /* ================================================================
   * LOCATIONS
   * ================================================================ */

  locations: string[] = [];
  loadingLocations = true;
  newLocation = '';
  showLocationForm = false;
  editingLocationIndex = -1;
  editingLocationValue = '';

  locationDragIndex = -1;
  locationDragOverIndex = -1;

  private readonly LOC_KEY = 'gallery-images/locations.json';

  async loadLocations(): Promise<void> {
    this.loadingLocations = true;
    this.cdr.detectChanges();
    try {
      const res = await fetch(`/gallery-images/locations.json?t=${Date.now()}`);
      if (res.ok) this.locations = await res.json();
    } catch { /* empty */ }
    this.loadingLocations = false;
    this.cdr.detectChanges();
  }

  async initLocationDefaults(): Promise<void> {
    this.locations = [...DEFAULT_LOCATIONS];
    await this.saveLocations();
    this.cdr.detectChanges();
  }

  async addLocation(): Promise<void> {
    const loc = this.newLocation.trim();
    if (!loc) return;
    this.locations.push(loc);
    this.newLocation = '';
    await this.saveLocations();
    this.cdr.detectChanges();
  }

  startEditLocation(index: number): void {
    this.editingLocationIndex = index;
    this.editingLocationValue = this.locations[index];
    this.cdr.detectChanges();
  }

  async saveEditLocation(): Promise<void> {
    if (this.editingLocationIndex < 0) return;
    const index = this.editingLocationIndex;
    const trimmed = this.editingLocationValue.trim();
    this.editingLocationIndex = -1;
    if (trimmed && trimmed !== this.locations[index]) {
      this.locations[index] = trimmed;
      await this.saveLocations();
    }
    this.cdr.detectChanges();
  }

  cancelEditLocation(): void {
    this.editingLocationIndex = -1;
    this.cdr.detectChanges();
  }

  async deleteLocation(index: number): Promise<void> {
    this.locations.splice(index, 1);
    await this.saveLocations();
    this.cdr.detectChanges();
  }

  onLocationDragStart(index: number): void {
    this.locationDragIndex = index;
    this.cdr.detectChanges();
  }

  onLocationRowDragOver(event: DragEvent, rowIndex: number): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const insertAt = event.clientY < midY ? rowIndex : rowIndex + 1;
    if (insertAt !== this.locationDragOverIndex) {
      this.locationDragOverIndex = insertAt;
      this.cdr.detectChanges();
    }
  }

  onLocationDragEnd(): void {
    this.locationDragIndex = -1;
    this.locationDragOverIndex = -1;
    this.cdr.detectChanges();
  }

  async onLocationDrop(event: DragEvent, targetIndex: number): Promise<void> {
    event.preventDefault();
    const fromIndex = this.locationDragIndex;
    this.locationDragIndex = -1;
    this.locationDragOverIndex = -1;
    this.cdr.detectChanges();

    if (fromIndex < 0 || fromIndex === targetIndex || fromIndex === targetIndex - 1) return;

    const [item] = this.locations.splice(fromIndex, 1);
    const insertAt = targetIndex > fromIndex ? targetIndex - 1 : targetIndex;
    this.locations.splice(insertAt, 0, item);
    this.cdr.detectChanges();

    await this.saveLocations();
  }

  private async saveLocations(): Promise<void> {
    await this.uploadService.putJson(this.LOC_KEY, this.locations, GALLERY_BUCKET);
  }

  /* ================================================================
   * SERVICE CARDS (Residential + Commercial)
   * ================================================================ */

  residentialCards: { icon: string; title: string; description: string; image?: string }[] = [];
  commercialIndustries: { icon: string; title: string; description: string; image?: string }[] = [];
  commercialServices: { icon: string; title: string; description: string; image?: string }[] = [];
  loadingServices = true;

  // Editing state
  editingList: 'residential' | 'commercial-industries' | 'commercial-services' | null = null;
  editingIndex = -1; // -1 = adding new
  cardForm: { icon: string; title: string; description: string; image: string } = { icon: '', title: '', description: '', image: '' };

  // Card image upload state
  cardImageStagedFile: File | null = null;
  cardImageStagedPreview: string | null = null;
  cardImageUploading = false;
  cardImageError = '';
  private cardImageOriginal: string | null = null;

  private readonly RES_KEY = 'gallery-images/services-residential.json';
  private readonly COM_KEY = 'gallery-images/services-commercial.json';
  private readonly CARD_IMG_PREFIX = 'gallery-images/cards/';

  private resLoaded = false;
  private comLoaded = false;

  async loadServiceCards(): Promise<void> {
    this.loadingServices = true;
    this.cdr.detectChanges();
    try {
      const resRes = await fetch(`/gallery-images/services-residential.json?t=${Date.now()}`);
      if (resRes.ok) {
        this.residentialCards = await resRes.json();
        this.resLoaded = true;
      }
    } catch { /* empty */ }
    try {
      const comRes = await fetch(`/gallery-images/services-commercial.json?t=${Date.now()}`);
      if (comRes.ok) {
        const data = await comRes.json();
        this.commercialIndustries = data.industries || [];
        this.commercialServices = data.services || [];
        this.comLoaded = true;
      }
    } catch { /* empty */ }
    this.loadingServices = false;
    this.cdr.detectChanges();
  }

  async initResidentialDefaults(): Promise<void> {
    this.residentialCards = [
      { icon: 'water_drop', title: 'Drain Cleaning', description: 'Slow or clogged drains are one of the most common plumbing issues. We use professional-grade equipment to clear blockages and restore proper flow.' },
      { icon: 'plumbing', title: 'Leak Detection & Repair', description: 'Water leaks can cause significant damage if left unaddressed. Our team locates and repairs leaks quickly — in walls, floors, or underground lines.' },
      { icon: 'water_heater', title: 'Water Heater Service', description: 'Traditional tank or modern tankless — we handle installation, repair, and replacement. We\'ll help you choose the right system for your home and budget.' },
      { icon: 'bathroom', title: 'Toilet & Faucet Repair', description: 'Running toilets and dripping faucets waste water and money. We repair and replace all types of fixtures quickly and efficiently.' },
      { icon: 'ac_unit', title: 'Frozen Pipes', description: 'Illinois winters can freeze your pipes. We provide emergency thawing services and can insulate vulnerable pipes to prevent future freeze damage.' },
      { icon: 'valve', title: 'Sump & Ejector Pumps', description: 'Protect your basement from flooding with properly maintained sump and ejector pumps. We install, repair, and service all pump types.' },
      { icon: 'gas_meter', title: 'Gas Line Service', description: 'Gas line repair, installation, and leak detection. Safety is our top priority when working with gas systems in your home.' },
      { icon: 'foundation', title: 'Sewer Repair', description: 'Sewer line repair and replacement, root removal, hydro jetting, and backflow prevention to keep your system running clean.' },
      { icon: 'delete_sweep', title: 'Garbage Disposals', description: 'Replacement and installation of kitchen garbage disposal units — all major brands.' },
      { icon: 'speed', title: 'Water Pressure', description: 'Diagnosis and repair of low or high water pressure issues throughout your home.' },
      { icon: 'flood', title: 'Flood Control', description: 'French drain systems and flood control installations to keep your home dry year-round.' },
      { icon: 'swap_vert', title: 'Lead Pipe Replacement', description: 'Safe removal and replacement of outdated lead pipes to protect your family\'s health and meet current building codes.' },
    ];
    this.resLoaded = true;
    await this.saveServiceCards();
    this.cdr.detectChanges();
  }

  async initCommercialDefaults(): Promise<void> {
    this.commercialIndustries = [
      { icon: 'restaurant', title: 'Restaurants', description: 'We know restaurants like the back of our hand. When it comes to plumbing needs, we understand that time is money and a malfunctioning kitchen sink can derail the whole operation.' },
      { icon: 'local_hospital', title: 'Healthcare Facilities', description: 'We understand the importance of keeping healthcare facilities up and running. Our team ensures your facility meets all code requirements and stays fully operational.' },
      { icon: 'business', title: 'Office Buildings', description: 'A single leaky faucet can disrupt your entire workday. We provide comprehensive office building plumbing services — from routine maintenance to emergency repairs.' },
      { icon: 'apartment', title: 'Apartments & Multi-Unit', description: 'We work with landlords and property managers to provide reliable, efficient plumbing services for multi-unit buildings — from individual unit repairs to building-wide maintenance.' },
      { icon: 'hotel', title: 'Hotels & Motels', description: 'From fixing leaky faucets to upgrading showerheads, we make sure your guests have a comfortable stay with reliable plumbing throughout.' },
      { icon: 'sports_soccer', title: 'Sports Facilities', description: 'Expert plumbing for sports facilities — repairing showers, keeping restrooms operational, so you can focus on the game, not the plumbing.' },
    ];
    this.commercialServices = [
      { icon: 'build', title: 'Repairs & Maintenance', description: '' },
      { icon: 'water_drop', title: 'Drain Cleaning', description: '' },
      { icon: 'water_heater', title: 'Water Heaters', description: '' },
      { icon: 'bathroom', title: 'Fixture Repair', description: '' },
      { icon: 'emergency', title: 'Emergency Service', description: '' },
      { icon: 'waves', title: 'Hydro Jetting', description: '' },
      { icon: 'foundation', title: 'Sewer Lines', description: '' },
      { icon: 'shield', title: 'Backflow Prevention', description: '' },
      { icon: 'gas_meter', title: 'Gas Leaks & Detection', description: '' },
      { icon: 'construction', title: 'Site Digs & Excavation', description: '' },
    ];
    this.comLoaded = true;
    await this.saveServiceCards();
    this.cdr.detectChanges();
  }

  private getList(key: string): { icon: string; title: string; description: string; image?: string }[] {
    if (key === 'residential') return this.residentialCards;
    if (key === 'commercial-industries') return this.commercialIndustries;
    return this.commercialServices;
  }

  openAddCard(list: 'residential' | 'commercial-industries' | 'commercial-services'): void {
    this.editingList = list;
    this.editingIndex = -1;
    this.cardForm = { icon: '', title: '', description: '', image: '' };
    this.cardImageOriginal = null;
    this.clearCardImageStaging();
    this.cardImageError = '';
    this.cdr.detectChanges();
  }

  openEditCard(list: 'residential' | 'commercial-industries' | 'commercial-services', index: number): void {
    this.editingList = list;
    this.editingIndex = index;
    const card = this.getList(list)[index];
    this.cardForm = {
      icon: card.icon,
      title: card.title,
      description: card.description,
      image: card.image || '',
    };
    this.cardImageOriginal = card.image || null;
    this.clearCardImageStaging();
    this.cardImageError = '';
    this.cdr.detectChanges();
  }

  cancelCardForm(): void {
    this.editingList = null;
    this.editingIndex = -1;
    this.cardImageOriginal = null;
    this.clearCardImageStaging();
    this.cardImageError = '';
    this.cdr.detectChanges();
  }

  onCardImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    this.cardImageError = '';
    if (this.cardImageStagedPreview) URL.revokeObjectURL(this.cardImageStagedPreview);
    this.cardImageStagedFile = input.files[0];
    this.cardImageStagedPreview = URL.createObjectURL(this.cardImageStagedFile);
    input.value = '';
    this.cdr.detectChanges();
  }

  cancelCardImageStaged(): void {
    this.clearCardImageStaging();
    this.cdr.detectChanges();
  }

  removeCardImage(): void {
    this.cardForm.image = '';
    this.clearCardImageStaging();
    this.cdr.detectChanges();
  }

  private clearCardImageStaging(): void {
    if (this.cardImageStagedPreview) URL.revokeObjectURL(this.cardImageStagedPreview);
    this.cardImageStagedFile = null;
    this.cardImageStagedPreview = null;
  }

  private isManagedCardImage(url: string | null | undefined): boolean {
    return !!url && url.startsWith(`/${this.CARD_IMG_PREFIX}`);
  }

  async saveCard(): Promise<void> {
    if (!this.editingList || !this.cardForm.title.trim()) return;

    let imageUrl = this.cardForm.image;

    // Upload staged image if present
    if (this.cardImageStagedFile) {
      this.cardImageUploading = true;
      this.cardImageError = '';
      this.cdr.detectChanges();
      try {
        const ext = this.cardImageStagedFile.name.split('.').pop()?.toLowerCase() || 'jpg';
        const filename = `card-${this.randomHash()}-${Date.now().toString(36)}.${ext}`;
        const s3key = `${this.CARD_IMG_PREFIX}${filename}`;
        await this.uploadService.upload(this.cardImageStagedFile, s3key, GALLERY_BUCKET);
        imageUrl = `/${s3key}`;
      } catch (e: any) {
        this.cardImageError = e.message || 'Image upload failed';
        this.cardImageUploading = false;
        this.cdr.detectChanges();
        return;
      }
      this.cardImageUploading = false;
    }

    // Cleanup the original image when it has been replaced or removed
    if (this.cardImageOriginal && this.cardImageOriginal !== imageUrl && this.isManagedCardImage(this.cardImageOriginal)) {
      const key = this.cardImageOriginal.replace(/^\//, '');
      await this.uploadService.delete(key, GALLERY_BUCKET).catch(() => {});
    }

    const list = this.getList(this.editingList);
    const card: { icon: string; title: string; description: string; image?: string } = {
      icon: this.cardForm.icon.trim(),
      title: this.cardForm.title.trim(),
      description: this.cardForm.description.trim(),
    };
    if (imageUrl) card.image = imageUrl;

    if (this.editingIndex >= 0) {
      list[this.editingIndex] = card;
    } else {
      list.push(card);
    }

    this.editingList = null;
    this.editingIndex = -1;
    this.cardImageOriginal = null;
    this.clearCardImageStaging();
    await this.saveServiceCards();
    this.cdr.detectChanges();
  }

  async deleteCard(list: 'residential' | 'commercial-industries' | 'commercial-services', index: number): Promise<void> {
    const card = this.getList(list)[index];
    if (this.isManagedCardImage(card.image)) {
      const key = card.image!.replace(/^\//, '');
      await this.uploadService.delete(key, GALLERY_BUCKET).catch(() => {});
    }
    this.getList(list).splice(index, 1);
    await this.saveServiceCards();
    this.cdr.detectChanges();
  }

  /* Drag and drop for service cards */
  cardDragIndex = -1;
  cardDragOverIndex = -1;
  cardDragList: 'residential' | 'commercial-industries' | 'commercial-services' | null = null;

  onCardDragStart(list: 'residential' | 'commercial-industries' | 'commercial-services', index: number): void {
    this.cardDragList = list;
    this.cardDragIndex = index;
    this.cdr.detectChanges();
  }

  onCardRowDragOver(event: DragEvent, rowIndex: number): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const insertAt = event.clientY < midY ? rowIndex : rowIndex + 1;
    if (insertAt !== this.cardDragOverIndex) {
      this.cardDragOverIndex = insertAt;
      this.cdr.detectChanges();
    }
  }

  onCardDragEnd(): void {
    this.cardDragIndex = -1;
    this.cardDragOverIndex = -1;
    this.cardDragList = null;
    this.cdr.detectChanges();
  }

  async onCardDrop(event: DragEvent, list: 'residential' | 'commercial-industries' | 'commercial-services', targetIndex: number): Promise<void> {
    event.preventDefault();
    const fromIndex = this.cardDragIndex;
    const fromList = this.cardDragList;
    this.cardDragIndex = -1;
    this.cardDragOverIndex = -1;
    this.cardDragList = null;
    this.cdr.detectChanges();

    if (fromList !== list || fromIndex < 0 || fromIndex === targetIndex || fromIndex === targetIndex - 1) return;

    const arr = this.getList(list);
    const [item] = arr.splice(fromIndex, 1);
    const insertAt = targetIndex > fromIndex ? targetIndex - 1 : targetIndex;
    arr.splice(insertAt, 0, item);
    this.cdr.detectChanges();

    await this.saveServiceCards();
  }

  private async saveServiceCards(): Promise<void> {
    await this.uploadService.putJson(this.RES_KEY, this.residentialCards, GALLERY_BUCKET);
    await this.uploadService.putJson(this.COM_KEY, { industries: this.commercialIndustries, services: this.commercialServices }, GALLERY_BUCKET);
  }

  /* ================================================================
   * FAQ
   * ================================================================ */

  faqItems: { question: string; answer: string; bullets?: string[] }[] = [];
  loadingFaq = true;
  editingFaqIndex = -1; // -1 when closed, -2 when adding, >=0 when editing existing
  faqForm = { question: '', answer: '', bulletsText: '' };

  faqDragIndex = -1;
  faqDragOverIndex = -1;

  private readonly FAQ_KEY = 'gallery-images/faq.json';

  async loadFaq(): Promise<void> {
    this.loadingFaq = true;
    this.cdr.detectChanges();
    try {
      const res = await fetch(`/gallery-images/faq.json?t=${Date.now()}`);
      if (res.ok) this.faqItems = await res.json();
    } catch { /* empty */ }
    this.loadingFaq = false;
    this.cdr.detectChanges();
  }

  async initFaqDefaults(): Promise<void> {
    this.faqItems = [
      { question: 'What are your operating hours?', answer: 'We are available Monday through Friday, 8 AM to 8 PM' },
      { question: 'Do you offer emergency plumbing services?', answer: 'Yes, we offer emergency plumbing services. Our typical response time is within 1 hour, though this may vary depending on the situation and current demand. Call us immediately if you have a plumbing emergency.' },
      { question: 'What areas do you serve?', answer: "We serve Chicago's Western Suburbs including La Grange, Villa Park, Brookfield, Westchester, Riverside, Berwyn, Cicero, Lyons, North Riverside, and surrounding communities. Contact us to confirm service availability for your specific location." },
      { question: 'How do I schedule an appointment?', answer: `You can schedule an appointment by calling us at ${environment.phoneDisplay}, emailing us at ${environment.email}, or using our online contact form.` },
      { question: 'What is your cancellation policy?', answer: "We require 48 hours' notice for cancellations. For Monday appointments, please cancel by Friday at 9 AM. Late cancellations may be subject to a cancellation fee." },
      { question: 'Are your plumbers licensed?', answer: 'Yes, all of our plumbers are fully licensed, insured, and experienced professionals.' },
      {
        question: 'What services do you offer?',
        answer: 'We offer a wide range of plumbing services including:',
        bullets: [
          'Fixture installation & repair',
          'Leak detection & repair',
          'Drain cleaning',
          'Water heater installation & repair',
          'Remodeling & new construction plumbing',
          'Gas line work',
          'Sewer repair & replacement',
        ],
      },
      { question: 'How does pricing work?', answer: 'We offer free estimates, on-site assessments, and flat-fee quotes so you know exactly what to expect before any work begins. No hidden fees or surprises.' },
      { question: 'What payment methods do you accept?', answer: 'We accept cash, check, Zelle, and all major credit cards. Please note that credit card payments are subject to a 3.5% processing fee.' },
      { question: 'Do you offer warranties?', answer: "Yes, we offer a 3-year labor warranty on most services and a 30-day warranty on drain cleaning. Material and parts are covered under the manufacturer's warranty." },
      { question: 'Can I see references or reviews?', answer: "Absolutely. You can find our reviews on Google, Yelp, and Angie's List, or check out our reviews page." },
    ];
    await this.saveFaq();
    this.cdr.detectChanges();
  }

  openAddFaq(): void {
    this.editingFaqIndex = -2;
    this.faqForm = { question: '', answer: '', bulletsText: '' };
    this.cdr.detectChanges();
  }

  openEditFaq(index: number): void {
    const item = this.faqItems[index];
    this.editingFaqIndex = index;
    this.faqForm = {
      question: item.question,
      answer: item.answer,
      bulletsText: (item.bullets || []).join('\n'),
    };
    this.cdr.detectChanges();
  }

  cancelFaqForm(): void {
    this.editingFaqIndex = -1;
    this.cdr.detectChanges();
  }

  async saveFaqItem(): Promise<void> {
    const q = this.faqForm.question.trim();
    const a = this.faqForm.answer.trim();
    if (!q || !a) return;

    const bullets = this.faqForm.bulletsText
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const item: { question: string; answer: string; bullets?: string[] } = { question: q, answer: a };
    if (bullets.length > 0) item.bullets = bullets;

    if (this.editingFaqIndex >= 0) {
      this.faqItems[this.editingFaqIndex] = item;
    } else {
      this.faqItems.push(item);
    }
    this.editingFaqIndex = -1;
    await this.saveFaq();
    this.cdr.detectChanges();
  }

  async deleteFaqItem(index: number): Promise<void> {
    this.faqItems.splice(index, 1);
    await this.saveFaq();
    this.cdr.detectChanges();
  }

  onFaqDragStart(index: number): void {
    this.faqDragIndex = index;
    this.cdr.detectChanges();
  }

  onFaqRowDragOver(event: DragEvent, rowIndex: number): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const insertAt = event.clientY < midY ? rowIndex : rowIndex + 1;
    if (insertAt !== this.faqDragOverIndex) {
      this.faqDragOverIndex = insertAt;
      this.cdr.detectChanges();
    }
  }

  onFaqDragEnd(): void {
    this.faqDragIndex = -1;
    this.faqDragOverIndex = -1;
    this.cdr.detectChanges();
  }

  async onFaqDrop(event: DragEvent, targetIndex: number): Promise<void> {
    event.preventDefault();
    const fromIndex = this.faqDragIndex;
    this.faqDragIndex = -1;
    this.faqDragOverIndex = -1;
    this.cdr.detectChanges();

    if (fromIndex < 0 || fromIndex === targetIndex || fromIndex === targetIndex - 1) return;

    const [item] = this.faqItems.splice(fromIndex, 1);
    const insertAt = targetIndex > fromIndex ? targetIndex - 1 : targetIndex;
    this.faqItems.splice(insertAt, 0, item);
    this.cdr.detectChanges();

    await this.saveFaq();
  }

  private async saveFaq(): Promise<void> {
    await this.uploadService.putJson(this.FAQ_KEY, this.faqItems, GALLERY_BUCKET);
  }

  signOut(): void {
    this.auth.signOut();
    this.router.navigate(['/admin/login']);
  }

  /* ================================================================
   * GLOBAL MODAL CLOSE
   * ================================================================ */

  @HostListener('document:keydown.escape')
  onAdminEscape(): void {
    // Don't close anything while a card image is uploading
    if (this.cardImageUploading) return;

    if (this.editingList) {
      this.cancelCardForm();
    } else if (this.showReviewForm) {
      this.cancelReviewForm();
    } else if (this.editingFaqIndex !== -1) {
      this.cancelFaqForm();
    } else if (this.editingTagImage) {
      this.cancelEditTag();
    } else if (this.editingLocationIndex !== -1) {
      this.cancelEditLocation();
    } else if (this.showLocationForm) {
      this.showLocationForm = false;
      this.cdr.detectChanges();
    } else if (this.showUploadForm) {
      this.showUploadForm = false;
      this.cdr.detectChanges();
    } else if (this.editingPositionList !== null) {
      this.cancelEditPosition();
    }
  }
}
