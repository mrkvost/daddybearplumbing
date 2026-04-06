import { Component } from '@angular/core';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-commercial',
  standalone: true,
  templateUrl: './commercial.component.html',
})
export class CommercialComponent {
  phone = environment.phone;
  phoneDisplay = environment.phoneDisplay;
}
