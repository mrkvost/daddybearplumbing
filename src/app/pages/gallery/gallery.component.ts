import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GalleryService, GalleryImage } from '../../services/gallery.service';
import { environment } from '../../../environments/environment';

const BATCH_SIZE = 18;
const FILTERS = ['All', 'Commercial', 'Residential', 'Kitchen', 'Bathroom', 'Heaters'];

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gallery.component.html',
})
export class GalleryComponent implements OnInit {
  private cdr = inject(ChangeDetectorRef);
  private galleryService = inject(GalleryService);

  phone = environment.phone;
  phoneDisplay = environment.phoneDisplay;
  allImages: GalleryImage[] = [];
  tags: string[] = FILTERS;
  activeTag = 'All';
  visibleCount = BATCH_SIZE;
  loading = true;
  error = false;

  async ngOnInit(): Promise<void> {
    try {
      this.allImages = await this.galleryService.listImages();
      this.loading = false;
    } catch {
      this.loading = false;
      this.error = true;
    }
    this.cdr.detectChanges();
  }

  get filteredImages(): GalleryImage[] {
    if (this.activeTag === 'All') return this.allImages;
    const needle = this.activeTag.toLowerCase();
    return this.allImages.filter(img => img.tagLabel.toLowerCase().includes(needle));
  }

  get visibleImages(): GalleryImage[] {
    return this.filteredImages.slice(0, this.visibleCount);
  }

  get hasMore(): boolean {
    return this.visibleCount < this.filteredImages.length;
  }

  setTag(tag: string): void {
    this.activeTag = tag;
    this.visibleCount = BATCH_SIZE;
  }

  loadMore(): void {
    this.visibleCount += BATCH_SIZE;
  }

  selectedImage: GalleryImage | null = null;

  openLightbox(image: GalleryImage): void {
    this.selectedImage = image;
  }

  closeLightbox(): void {
    this.selectedImage = null;
  }

  prevImage(): void {
    if (!this.selectedImage) return;
    const list = this.filteredImages;
    const idx = list.indexOf(this.selectedImage);
    this.selectedImage = list[(idx - 1 + list.length) % list.length];
  }

  nextImage(): void {
    if (!this.selectedImage) return;
    const list = this.filteredImages;
    const idx = list.indexOf(this.selectedImage);
    this.selectedImage = list[(idx + 1) % list.length];
  }
}
