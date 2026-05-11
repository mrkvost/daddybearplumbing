import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { environment } from '../../../environments/environment';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [RouterModule, PageHeaderComponent],
  templateUrl: './privacy.component.html',
})
export class PrivacyComponent {
  email = environment.email;
}
