import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { AuthService } from '../../services/auth.service';
import { UploadService } from '../../services/upload.service';

interface GalleryImage {
  filename: string;
  url: string;
  sortNumber: number;
  category: string;
  date: Date;
  deleting?: boolean;
  moving?: boolean;
}

interface UploadItem {
  file: File;
  filename: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
})
export class AdminComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private uploadService = inject(UploadService);
  private router = inject(Router);
  private meta = inject(Meta);
  private cdr = inject(ChangeDetectorRef);

  images: GalleryImage[] = [];
  uploads: UploadItem[] = [];
  category = '';
  loadingImages = true;
  uploading = false;

  ngOnInit(): void {
    this.meta.addTag({ name: 'robots', content: 'noindex, nofollow' });
    this.loadImages();
  }

  ngOnDestroy(): void {
    this.meta.removeTag('name="robots"');
  }

  /* ---------- Load existing images ---------- */

  async loadImages(): Promise<void> {
    this.loadingImages = true;
    this.cdr.detectChanges();
    try {
      const response = await fetch('/gallery-photos/gallery.json');
      if (!response.ok) throw new Error('Failed to load');
      const filenames: string[] = await response.json();

      this.images = filenames
        .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
        .map(f => this.parseFilename(f))
        .sort((a, b) => a.sortNumber - b.sortNumber);
    } catch {
      this.images = [];
    }
    this.loadingImages = false;
    this.cdr.detectChanges();
  }

  private parseFilename(filename: string): GalleryImage {
    const parts = filename.replace(/\.[^.]+$/, '').split('_');
    const sortNumber = parseInt(parts[0], 10) || 0;
    let date = new Date();
    if (parts[1]) {
      const [y, mo, d, h, mi, s] = parts[1].split('-').map(Number);
      date = new Date(y, (mo || 1) - 1, d || 1, h || 0, mi || 0, s || 0);
    }
    const slug = parts.slice(2).join('_') || 'uncategorized';
    const category = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return { filename, url: `/gallery-photos/${filename}`, sortNumber, category, date };
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
      // Build new filenames by swapping sort numbers
      const newFilenameA = this.replaceNumber(a.filename, b.sortNumber);
      const newFilenameB = this.replaceNumber(b.filename, a.sortNumber);

      // Copy both to new names, then delete originals
      await this.uploadService.copy(a.filename, newFilenameA);
      await this.uploadService.copy(b.filename, newFilenameB);
      await this.uploadService.delete(a.filename);
      await this.uploadService.delete(b.filename);

      // Update local state
      a.filename = newFilenameA;
      a.url = `/gallery-photos/${newFilenameA}`;
      const oldSortA = a.sortNumber;
      a.sortNumber = b.sortNumber;

      b.filename = newFilenameB;
      b.url = `/gallery-photos/${newFilenameB}`;
      b.sortNumber = oldSortA;

      // Re-sort
      this.images.sort((x, y) => x.sortNumber - y.sortNumber);
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

  async deleteImage(image: GalleryImage): Promise<void> {
    image.deleting = true;
    this.cdr.detectChanges();
    try {
      await this.uploadService.delete(image.filename);
      this.images = this.images.filter(i => i !== image);
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

    // Next sort number = max existing + 1
    const maxSort = this.images.reduce((max, img) => Math.max(max, img.sortNumber), 0);
    let nextNum = maxSort + 1;

    for (const file of Array.from(input.files)) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const num = String(nextNum++).padStart(4, '0');
      const slug = this.category || 'uncategorized';
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
        await this.uploadService.upload(item.file, item.filename);
        item.status = 'done';
      } catch (e: any) {
        item.status = 'error';
        item.error = e.message;
      }
      this.cdr.detectChanges();
    }

    this.uploading = false;
    this.uploads = this.uploads.filter(u => u.status !== 'done');
    // Wait a moment for Lambda to regenerate manifest, then refresh
    setTimeout(() => this.loadImages(), 2000);
  }

  signOut(): void {
    this.auth.signOut();
    this.router.navigate(['/admin/login']);
  }
}
