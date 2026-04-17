import { Component, OnInit, ChangeDetectorRef, inject, Input } from '@angular/core';

const FALLBACK_URL = '/gallery-images/meta/hero.jpg';

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [],
  templateUrl: './hero.component.html',
})
export class HeroComponent implements OnInit {
  private cdr = inject(ChangeDetectorRef);

  /** When set, uses this URL directly instead of fetching meta.json */
  @Input() imageUrl: string | null = null;

  /** Compact mode for admin preview (shorter height, smaller text) */
  @Input() compact = false;

  heroImage: string | null = null;

  async ngOnInit(): Promise<void> {
    if (this.imageUrl !== null) {
      this.heroImage = this.imageUrl;
      return;
    }
    try {
      const res = await fetch(`/gallery-images/meta.json?t=${Date.now()}`);
      if (res.ok) {
        const meta = await res.json();
        if (meta.hero) {
          this.heroImage = `/gallery-images/meta/${meta.hero}`;
          this.cdr.detectChanges();
          return;
        }
      }
    } catch { /* use fallback */ }
    this.heroImage = FALLBACK_URL;
    this.cdr.detectChanges();
  }
}
