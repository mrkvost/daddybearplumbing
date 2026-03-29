import { Injectable } from '@angular/core';

export interface GalleryImage {
  filename: string;
  url: string;
  sortNumber: number;
  date: Date;
  tag: string;
  tagLabel: string;
}

/** Entry in gallery.json — either a string (legacy) or an object with optional tag */
export type GalleryEntry = string | { file: string; tag?: string };

const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|webp)$/i;

@Injectable({ providedIn: 'root' })
export class GalleryService {

  async listImages(): Promise<GalleryImage[]> {
    const response = await fetch(`/gallery-images/gallery.json?t=${Date.now()}`);
    if (!response.ok) throw new Error(`Failed to load gallery: ${response.status}`);
    const entries: GalleryEntry[] = await response.json();

    return entries
      .map(e => this.parseEntry(e))
      .filter(img => IMAGE_EXTENSIONS.test(img.filename));
  }

  /** Parse a gallery.json entry — supports both string and object formats */
  parseEntry(entry: GalleryEntry): GalleryImage {
    const filename = typeof entry === 'string' ? entry : entry.file;
    const customTag = typeof entry === 'string' ? undefined : entry.tag;
    return this.parseFilename(filename, customTag);
  }

  parseFilename(filename: string, customTag?: string): GalleryImage {
    const parts = filename.replace(/\.[^.]+$/, '').split('_');
    const sortNumber = parseInt(parts[0], 10) || 0;

    let date = new Date();
    if (parts[1]) {
      const [y, mo, d, h, mi, s] = parts[1].split('-').map(Number);
      date = new Date(y, (mo || 1) - 1, d || 1, h || 0, mi || 0, s || 0);
    }

    let tagLabel: string;
    let tag: string;

    if (customTag) {
      tagLabel = customTag;
      tag = customTag.toLowerCase().replace(/\s+/g, '-');
    } else {
      const tagSlug = parts.slice(2).join('_') || 'uncategorized';
      tag = tagSlug;
      tagLabel = tagSlug
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }

    return { filename, url: `/gallery-images/${filename}`, sortNumber, date, tag, tagLabel };
  }
}
