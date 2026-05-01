import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { GalleryService, GalleryImage, Album } from '../../services/gallery.service';
import { environment } from '../../../environments/environment';

const BATCH_SIZE = 18;
const FILTERS = ['All', 'Commercial', 'Residential', 'Kitchen', 'Bathroom', 'Heaters'];

interface AlbumCard extends Album {
  photoCount: number;
  coverUrl: string | null;
}

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './gallery.component.html',
})
export class GalleryComponent implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);
  private galleryService = inject(GalleryService);
  private route = inject(ActivatedRoute);
  private routeSub?: Subscription;

  phone = environment.phone;
  phoneDisplay = environment.phoneDisplay;
  allImages: GalleryImage[] = [];
  albums: Album[] = [];
  tags: string[] = FILTERS;
  activeTag = 'All';
  visibleCount = BATCH_SIZE;
  loading = true;
  error = false;

  /** When set, we're viewing a single album. Null = landing mode. */
  currentAlbum: Album | null = null;
  albumNotFound = false;

  async ngOnInit(): Promise<void> {
    try {
      const [images, albums] = await Promise.all([
        this.galleryService.listImages(),
        this.galleryService.listAlbums(),
      ]);
      this.allImages = images;
      this.albums = albums;
      this.loading = false;
    } catch {
      this.loading = false;
      this.error = true;
    }

    this.routeSub = this.route.params.subscribe(params => {
      const slug = params['slug'];
      if (slug) {
        this.currentAlbum = this.albums.find(a => a.slug === slug) || null;
        this.albumNotFound = !this.currentAlbum;
      } else {
        this.currentAlbum = null;
        this.albumNotFound = false;
      }
      this.activeTag = 'All';
      this.visibleCount = BATCH_SIZE;
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  /** Albums with photo counts and resolved cover URLs — empty albums are hidden from the public grid */
  get albumCards(): AlbumCard[] {
    return this.albums
      .map(a => {
        const photos = this.allImages.filter(img => img.albumId === a.id);
        const coverFilename = a.coverFilename || photos[0]?.filename;
        return {
          ...a,
          photoCount: photos.length,
          coverUrl: coverFilename ? `/gallery-images/${coverFilename}` : null,
        };
      })
      .filter(a => a.photoCount > 0);
  }

  get filteredImages(): GalleryImage[] {
    if (this.currentAlbum) {
      return this.allImages.filter(img => img.albumId === this.currentAlbum!.id);
    }
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
