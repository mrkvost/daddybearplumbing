import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './footer.component.html',
})
export class FooterComponent {
  currentYear = new Date().getFullYear();
  phone = environment.phone;
  phoneDisplay = environment.phoneDisplay;
  email = environment.email;
  address = environment.address;
  mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${environment.address.line1}, ${environment.address.city}, ${environment.address.state} ${environment.address.zip}`
  )}`;
}
