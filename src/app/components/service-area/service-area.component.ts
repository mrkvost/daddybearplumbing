import { Component, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-service-area',
  standalone: true,
  imports: [],
  templateUrl: './service-area.component.html',
})
export class ServiceAreaComponent {
  private sanitizer = inject(DomSanitizer);

  address = environment.address;

  safeEmbedUrl: SafeResourceUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
    'https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=9100+Plainfield+Rd,+Brookfield,+IL+60513&zoom=14'
  );

  locations = [
    'Brookfield, IL',
    'La Grange, IL',
    'Villa Park, IL',
    'Western Springs',
    'Elmhurst, IL',
    'Countryside',
    'Oak Brook',
  ];
}
