/*
 * HomeComponent — the "/" route
 *
 * Composes reusable section components plus an inline "Need Plumbing Help?"
 * call banner at the bottom (small enough that a dedicated component would be
 * overhead — the rest of the page lives in section components).
 */
import { Component } from '@angular/core';
import { HeroComponent } from '../../components/hero/hero.component';
import { TrustStatsComponent } from '../../components/trust-stats/trust-stats.component';
import { ServicesGridComponent } from '../../components/services-grid/services-grid.component';
import { ServiceAreaComponent } from '../../components/service-area/service-area.component';
import { CallBannerComponent } from '../../components/call-banner/call-banner.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [HeroComponent, TrustStatsComponent, ServicesGridComponent, ServiceAreaComponent, CallBannerComponent],
  templateUrl: './home.component.html',
})
export class HomeComponent {}
