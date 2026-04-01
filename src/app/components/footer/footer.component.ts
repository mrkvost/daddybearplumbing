import { Component } from '@angular/core';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [],
  templateUrl: './footer.component.html',
})
export class FooterComponent {
  currentYear = new Date().getFullYear();
  phone = environment.phone;
  phoneDisplay = environment.phoneDisplay;
  email = environment.email;
  address = environment.address;
}
