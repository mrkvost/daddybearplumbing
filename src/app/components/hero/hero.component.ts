import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';

const FALLBACK_URL = '/gallery-images/meta/hero.jpg';

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [],
  templateUrl: './hero.component.html',
})
export class HeroComponent implements OnInit {
  private cdr = inject(ChangeDetectorRef);
  heroImage: string | null = null;

  async ngOnInit(): Promise<void> {
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
