import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './terms.component.html',
})
export class TermsComponent {
  email = environment.email;
}
