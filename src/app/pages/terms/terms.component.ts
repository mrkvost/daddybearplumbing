import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { environment } from '../../../environments/environment';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [RouterModule, PageHeaderComponent],
  templateUrl: './terms.component.html',
})
export class TermsComponent {
  email = environment.email;
}
