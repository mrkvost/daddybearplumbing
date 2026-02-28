/*
 * app.routes.ts — URL routing configuration
 *
 * Angular's router matches the current browser URL to a route and renders
 * the corresponding component inside the <router-outlet> in AppComponent.
 *
 * loadComponent() uses lazy loading: the component's JavaScript is only
 * downloaded when the user first navigates to that route, keeping the
 * initial page load small.
 */
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',                   // Matches the root URL "/"
    loadComponent: () =>
      import('./pages/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'gallery',            // Matches "/gallery"
    loadComponent: () =>
      import('./pages/gallery/gallery.component').then((m) => m.GalleryComponent),
  },
  {
    path: 'reviews',            // Matches "/reviews"
    loadComponent: () =>
      import('./pages/reviews/reviews.component').then((m) => m.ReviewsComponent),
  },
  {
    path: '**',                 // Catch-all: any unknown URL redirects to home
    redirectTo: '',
  },
];
