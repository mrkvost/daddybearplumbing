import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { BUSINESS } from '../../globals';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './terms.component.html',
})
export class TermsComponent {
  email = BUSINESS.email;
}
