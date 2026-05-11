import { Component, OnInit, Input } from '@angular/core';
import { SITE_DATA } from '../../../environments/site-data';

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [],
  templateUrl: './hero.component.html',
})
export class HeroComponent implements OnInit {
  /** When set, uses this URL directly. Admin previews staged uploads via this. */
  @Input() imageUrl: string | null = null;

  /** Compact mode for admin preview (shorter height, smaller text) */
  @Input() compact = false;

  heroImage: string = SITE_DATA.heroImage;

  ngOnInit(): void {
    if (this.imageUrl !== null) {
      this.heroImage = this.imageUrl;
    }
  }
}
