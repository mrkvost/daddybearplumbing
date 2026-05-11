import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SITE_DATA } from '../../../environments/site-data';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './page-header.component.html',
})
export class PageHeaderComponent implements OnInit {
  @Input() eyebrow = '';
  @Input() title = '';
  /** `true` (default) → h-[300px] internal-page banner; `false` → h-[600px] home-style hero. */
  @Input() compact = true;
  /** Which build-time image to use as background. Most pages use `hero`; About uses `about`. */
  @Input() imageKey: 'hero' | 'about' = 'hero';

  imageUrl: string | null = null;

  ngOnInit(): void {
    const url = this.imageKey === 'about' ? SITE_DATA.aboutImage : SITE_DATA.heroImage;
    this.imageUrl = url || null;
  }
}
