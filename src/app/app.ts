import { Component, inject, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { NavbarComponent } from './components/navbar/navbar.component';
import { FooterComponent } from './components/footer/footer.component';
import { CanonicalService } from './services/canonical.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, FooterComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private canonical = inject(CanonicalService);
  private router = inject(Router);

  isAdminRoute = false;

  ngOnInit(): void {
    this.canonical.init();
    this.isAdminRoute = this.router.url.startsWith('/admin');
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.isAdminRoute = e.urlAfterRedirects.startsWith('/admin');
      });
  }
}
