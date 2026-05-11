import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './privacy.component.html',
})
export class PrivacyComponent {
  email = environment.email;
}
