import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { SITE_DATA } from '../../../environments/site-data';

@Component({
  selector: 'app-service-area',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './service-area.component.html',
})
export class ServiceAreaComponent {
  address = environment.address;
  mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${environment.address.line1}, ${environment.address.city}, ${environment.address.state} ${environment.address.zip}`
  )}`;
  locations = SITE_DATA.locations;
}
