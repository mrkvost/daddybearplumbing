import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BUSINESS } from '../../globals';
import { SITE_DATA } from '../../../environments/site-data';

@Component({
  selector: 'app-service-area',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './service-area.component.html',
})
export class ServiceAreaComponent {
  address = BUSINESS.address;
  mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${BUSINESS.address.line1}, ${BUSINESS.address.city}, ${BUSINESS.address.state} ${BUSINESS.address.zip}`
  )}`;
  locations = SITE_DATA.locations;
}
