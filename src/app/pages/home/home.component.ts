/*
 * HomeComponent — the "/" route
 *
 * This is a "page" component. It does not contain UI of its own;
 * it composes the reusable section components into the home page layout.
 * AppComponent renders this inside <router-outlet> when the URL is "/".
 */
import { Component } from '@angular/core';
import { HeroComponent } from '../../components/hero/hero.component';
import { TrustStatsComponent } from '../../components/trust-stats/trust-stats.component';
import { ServicesGridComponent } from '../../components/services-grid/services-grid.component';
import { ServiceAreaComponent } from '../../components/service-area/service-area.component';

@Component({
  selector: 'app-home',
  standalone: true,
  // Each component used in the template must be listed here.
  imports: [HeroComponent, TrustStatsComponent, ServicesGridComponent, ServiceAreaComponent],
  templateUrl: './home.component.html',
})
export class HomeComponent {}
