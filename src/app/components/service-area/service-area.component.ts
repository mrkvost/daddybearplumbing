import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';

const DEFAULT_LOCATIONS = [
  'Brookfield, IL',
  'La Grange, IL',
  'Villa Park, IL',
  'Western Springs',
  'Elmhurst, IL',
  'Countryside',
  'Oak Brook',
];

@Component({
  selector: 'app-service-area',
  standalone: true,
  imports: [],
  templateUrl: './service-area.component.html',
})
export class ServiceAreaComponent implements OnInit {
  private sanitizer = inject(DomSanitizer);
  private cdr = inject(ChangeDetectorRef);

  address = environment.address;

  safeEmbedUrl: SafeResourceUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
    'https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=9100+Plainfield+Rd,+Brookfield,+IL+60513&zoom=14'
  );

  locations = DEFAULT_LOCATIONS;

  async ngOnInit(): Promise<void> {
    try {
      const res = await fetch(`/gallery-images/locations.json?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          this.locations = data;
          this.cdr.detectChanges();
        }
      }
    } catch { /* use defaults */ }
  }
}
