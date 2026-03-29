import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { AuthService } from '../../services/auth.service';
import { UploadService } from '../../services/upload.service';
import { GalleryService, GalleryImage } from '../../services/gallery.service';
import { environment } from '../../../environments/environment';

interface AdminGalleryImage extends GalleryImage {
  deleting?: boolean;
  moving?: boolean;
}

interface UploadItem {
  file: File;
  filename: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

const GALLERY_BUCKET = environment.aws.galleryBucket;
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

  images: AdminGalleryImage[] = [];
  uploads: UploadItem[] = [];
  tag = '';
  loadingImages = true;
  uploading = false;

  ngOnInit(): void {
    this.meta.addTag({ name: 'robots', content: 'noindex, nofollow' });
    this.loadImages();
  }

  ngOnDestroy(): void {
    this.meta.removeTag('name="robots"');
  }

  /* ---------- List images from S3 directly ---------- */

  async loadImages(): Promise<void> {
    this.loadingImages = true;
    this.cdr.detectChanges();
    try {
      const filenames = await this.listS3();
      this.images = filenames.map(f => this.galleryService.parseFilename(f) as AdminGalleryImage)
        .sort((a, b) => a.sortNumber - b.sortNumber);
    } catch {
      this.images = [];
    }
    this.loadingImages = false;
    this.cdr.detectChanges();
  }

  /** List image files in the gallery bucket using Cognito credentials */
  private async listS3(): Promise<string[]> {
    const credentials = await this.auth.getCredentials();
    const host = `${GALLERY_BUCKET}.s3.${REGION}.amazonaws.com`;
    const filenames: string[] = [];
    let continuationToken: string | null = null;

    do {
      const params = new URLSearchParams({ 'list-type': '2', 'prefix': 'gallery-images/' });
      if (continuationToken) params.set('continuation-token', continuationToken);

      const dateStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const shortDate = dateStamp.substring(0, 8);
      const bodyHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'; // empty body

      const headers: Record<string, string> = {
        'host': host,
        'x-amz-content-sha256': bodyHash,
        'x-amz-date': dateStamp,
        'x-amz-security-token': credentials.sessionToken,
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

      const authorization = `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${sig}`;

      const response = await fetch(`https://${host}/?${params}`, {
        headers: { ...headers, 'Authorization': authorization },
      });

      const xml = await response.text();
      const doc = new DOMParser().parseFromString(xml, 'application/xml');

      for (const item of doc.querySelectorAll('Contents')) {
        const key = item.querySelector('Key')?.textContent || '';
        const name = key.replace(/^gallery-images\//, '');
        if (name && /\.(jpg|jpeg|png|webp)$/i.test(name)) {
          filenames.push(name);
        }
      }

      const isTruncated = doc.querySelector('IsTruncated')?.textContent === 'true';
      continuationToken = isTruncated
        ? doc.querySelector('NextContinuationToken')?.textContent || null
        : null;
    } while (continuationToken);

    return filenames.sort();
  }

  /* ---------- Write gallery.json manifest ---------- */

  private async saveManifest(): Promise<void> {
    const filenames = this.images.map(img => img.filename).sort((a, b) => {
      const numA = parseInt(a, 10) || 0;
      const numB = parseInt(b, 10) || 0;
      return numA - numB;
    });
    await this.uploadService.putJson('gallery-images/gallery.json', filenames, GALLERY_BUCKET);
  }

  /* ---------- Reorder ---------- */

  async moveImage(index: number, direction: -1 | 1): Promise<void> {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= this.images.length) return;

    const a = this.images[index];
    const b = this.images[targetIndex];
    a.moving = true;
    b.moving = true;
    this.cdr.detectChanges();

    try {
      const newFilenameA = this.replaceNumber(a.filename, b.sortNumber);
      const newFilenameB = this.replaceNumber(b.filename, a.sortNumber);

      await this.uploadService.copy(`gallery-images/${a.filename}`, `gallery-images/${newFilenameA}`, GALLERY_BUCKET);
      await this.uploadService.copy(`gallery-images/${b.filename}`, `gallery-images/${newFilenameB}`, GALLERY_BUCKET);
      await this.uploadService.delete(`gallery-images/${a.filename}`, GALLERY_BUCKET);
      await this.uploadService.delete(`gallery-images/${b.filename}`, GALLERY_BUCKET);

      a.filename = newFilenameA;
      a.url = `/gallery-images/${newFilenameA}`;
      const oldSortA = a.sortNumber;
      a.sortNumber = b.sortNumber;

      b.filename = newFilenameB;
      b.url = `/gallery-images/${newFilenameB}`;
      b.sortNumber = oldSortA;

      this.images.sort((x, y) => x.sortNumber - y.sortNumber);
      await this.saveManifest();
    } catch (e: any) {
      alert(`Move failed: ${e.message}`);
    }

    a.moving = false;
    b.moving = false;
    this.cdr.detectChanges();
  }

  private replaceNumber(filename: string, newNumber: number): string {
    return filename.replace(/^\d+/, String(newNumber).padStart(4, '0'));
  }

  /* ---------- Delete ---------- */

  async deleteImage(image: AdminGalleryImage): Promise<void> {
    image.deleting = true;
    this.cdr.detectChanges();
    try {
      await this.uploadService.delete(`gallery-images/${image.filename}`, GALLERY_BUCKET);
      this.images = this.images.filter(i => i !== image);
      await this.saveManifest();
    } catch (e: any) {
      image.deleting = false;
      alert(`Delete failed: ${e.message}`);
    }
    this.cdr.detectChanges();
  }

  /* ---------- Upload ---------- */

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;

    const now = new Date();
    const dateStr = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
    ].join('-');

    const maxSort = this.images.reduce((max, img) => Math.max(max, img.sortNumber), 0);
    let nextNum = maxSort + 1;

    for (const file of Array.from(input.files)) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const num = String(nextNum++).padStart(4, '0');
      const slug = this.tag || 'uncategorized';
      const filename = `${num}_${dateStr}_${slug}.${ext}`;
      this.uploads.push({ file, filename, status: 'pending' });
    }

    input.value = '';
  }

  removeUpload(index: number): void {
    this.uploads.splice(index, 1);
  }

  async uploadAll(): Promise<void> {
    this.uploading = true;
    const pending = this.uploads.filter(u => u.status === 'pending');

    for (const item of pending) {
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
    this.uploads = this.uploads.filter(u => u.status !== 'done');
    await this.loadImages();
    await this.saveManifest();
    this.cdr.detectChanges();
  }

  signOut(): void {
    this.auth.signOut();
    this.router.navigate(['/admin/login']);
  }
}
