import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';

@Component({
  selector: 'app-cookies',
  standalone: true,
  imports: [RouterModule, PageHeaderComponent],
  templateUrl: './cookies.component.html',
})
export class CookiesComponent {}
