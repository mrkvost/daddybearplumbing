/*
 * FooterComponent
 *
 * Site-wide footer. Rendered in AppComponent so it appears on every page
 * without needing to be included in each page component individually.
 */
import { Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [],
  templateUrl: './footer.component.html',
})
export class FooterComponent {
  /*
   * currentYear is computed once when the component is created.
   * Using it in the template keeps the copyright year always up to date.
   */
  currentYear = new Date().getFullYear();
}
