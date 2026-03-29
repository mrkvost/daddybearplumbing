/**
 * GalleryService — serves gallery images via CloudFront.
 *
 * Public gallery: fetches /gallery-images/gallery.json (written by admin after changes)
 * Admin: lists S3 directly using Cognito credentials via UploadService
 *
 * Image URLs are served via CloudFront at /gallery-images/<filename>.
 */
import { Injectable } from '@angular/core';

export interface GalleryImage {
  filename: string;
  url: string;
  sortNumber: number;
  date: Date;
  tag: string;
  tagLabel: string;
}

const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|webp)$/i;

@Injectable({ providedIn: 'root' })
export class GalleryService {

  /**
   * Load images from the gallery.json manifest (for public gallery page).
   */
  async listImages(): Promise<GalleryImage[]> {
    const response = await fetch(`/gallery-images/gallery.json?t=${Date.now()}`);
    if (!response.ok) throw new Error(`Failed to load gallery: ${response.status}`);
    const filenames: string[] = await response.json();

    return filenames
      .filter(f => IMAGE_EXTENSIONS.test(f))
      .map(f => this.parseFilename(f))
      .sort((a, b) => a.sortNumber - b.sortNumber);
  }

  parseFilename(filename: string): GalleryImage {
    const parts = filename.replace(/\.[^.]+$/, '').split('_');
    const sortNumber = parseInt(parts[0], 10) || 0;

    let date = new Date();
    if (parts[1]) {
      const [y, mo, d, h, mi, s] = parts[1].split('-').map(Number);
      date = new Date(y, (mo || 1) - 1, d || 1, h || 0, mi || 0, s || 0);
    }

    const tagSlug = parts.slice(2).join('_') || 'uncategorized';
    const tagLabel = tagSlug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    return {
      filename,
      url: `/gallery-images/${filename}`,
      sortNumber,
      date,
      tag: tagSlug,
      tagLabel,
    };
  }
}
