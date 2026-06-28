import { Component, OnInit, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SITE_DATA } from '../../../environments/site-data';
import { BUSINESS } from '../../globals';

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './hero.component.html',
})
export class HeroComponent implements OnInit {
  /** When set, uses this URL directly. Admin previews staged uploads via this. */
  @Input() imageUrl: string | null = null;

  /** Compact mode for admin preview (shorter height, smaller text) */
  @Input() compact = false;

  heroImage: string = SITE_DATA.heroImage;
  phone = BUSINESS.phone;
  phoneDisplay = BUSINESS.phoneDisplay;

  ngOnInit(): void {
    if (this.imageUrl !== null) {
      this.heroImage = this.imageUrl;
    }
  }
}
