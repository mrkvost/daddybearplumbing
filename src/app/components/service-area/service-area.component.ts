import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { DEFAULT_LOCATIONS } from '../../defaults/locations';

@Component({
  selector: 'app-service-area',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './service-area.component.html',
})
export class ServiceAreaComponent implements OnInit {
  private cdr = inject(ChangeDetectorRef);

  address = environment.address;
  mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${environment.address.line1}, ${environment.address.city}, ${environment.address.state} ${environment.address.zip}`
  )}`;
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
