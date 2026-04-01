import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { AuthService } from '../../services/auth.service';
import { UploadService } from '../../services/upload.service';
import { GalleryService, GalleryImage, GalleryEntry } from '../../services/gallery.service';
import { Review } from '../../services/reviews.service';
import { environment } from '../../../environments/environment';

interface AdminGalleryImage extends GalleryImage {
  deleting?: boolean;
  editingTag?: boolean;
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
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
})
export class AdminComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private uploadService = inject(UploadService);
  private galleryService = inject(GalleryService);
  private router = inject(Router);
  private meta = inject(Meta);
  private cdr = inject(ChangeDetectorRef);

  activeTab: 'gallery' | 'reviews' | 'settings' = 'gallery';

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
  editingReview: AdminReview | null = null;
  reviewForm = { name: '', rating: 5, text: '', location: '', date: '' };

  ngOnInit(): void {
    this.meta.addTag({ name: 'robots', content: 'noindex, nofollow' });
    this.loadImages();
    this.loadReviews();
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

  startEditTag(image: AdminGalleryImage): void {
    image.editingTag = true;
    this.cdr.detectChanges();
  }

  async saveTag(image: AdminGalleryImage, newTag: string): Promise<void> {
    image.editingTag = false;
    const trimmed = newTag.trim();
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
    await this.saveGalleryManifest();
    this.cdr.detectChanges();
  }

  cancelEditTag(image: AdminGalleryImage): void {
    image.editingTag = false;
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

  signOut(): void {
    this.auth.signOut();
    this.router.navigate(['/admin/login']);
  }
}
