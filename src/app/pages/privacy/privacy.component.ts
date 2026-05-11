import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { BUSINESS } from '../../globals';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './privacy.component.html',
})
export class PrivacyComponent {
  email = BUSINESS.email;
}
