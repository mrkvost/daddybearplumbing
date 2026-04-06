import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-faq',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './faq.component.html',
})
export class FaqComponent {
  phone = environment.phone;
  phoneDisplay = environment.phoneDisplay;
  email = environment.email;
}
