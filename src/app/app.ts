import { Component, inject, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet, ActivatedRoute } from '@angular/router';
import { filter, map, mergeMap } from 'rxjs/operators';
import { NavbarComponent } from './components/navbar/navbar.component';
import { FooterComponent } from './components/footer/footer.component';
import { PageHeaderComponent } from './components/page-header/page-header.component';
import { CanonicalService } from './services/canonical.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, FooterComponent, PageHeaderComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private canonical = inject(CanonicalService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  isAdminRoute = false;

  /** Page-header inputs read from the currently-active route's `data`. */
  headerEyebrow: string | null = null;
  headerTitle = '';
  headerImageKey: 'hero' | 'about' = 'hero';

  ngOnInit(): void {
    this.canonical.init();
    this.isAdminRoute = this.router.url.startsWith('/admin');

    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => {
        let r = this.route;
        while (r.firstChild) r = r.firstChild;
        return r;
      }),
      mergeMap(r => r.data),
    ).subscribe(data => {
      this.isAdminRoute = this.router.url.startsWith('/admin');
      const eyebrow = data['eyebrow'] as string | undefined;
      if (eyebrow) {
        this.headerEyebrow = eyebrow;
        this.headerTitle = (data['pageHeaderTitle'] as string) || (data['title'] as string) || '';
        this.headerImageKey = (data['imageKey'] as 'hero' | 'about') || 'hero';
      } else {
        this.headerEyebrow = null;
      }
    });
  }
}
