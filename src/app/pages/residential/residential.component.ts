import { Component } from '@angular/core';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-residential',
  standalone: true,
  templateUrl: './residential.component.html',
})
export class ResidentialComponent {
  phone = environment.phone;
  phoneDisplay = environment.phoneDisplay;
}
