import { Component } from '@angular/core';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-about',
  standalone: true,
  templateUrl: './about.component.html',
})
export class AboutComponent {
  phone = environment.phone;
  phoneDisplay = environment.phoneDisplay;
}
