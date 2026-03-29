import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'gallery',
    loadComponent: () =>
      import('./pages/gallery/gallery.component').then((m) => m.GalleryComponent),
  },
  {
    path: 'reviews',
    loadComponent: () =>
      import('./pages/reviews/reviews.component').then((m) => m.ReviewsComponent),
  },
  {
    path: 'admin',
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./pages/login/login.component').then((m) => m.LoginComponent),
      },
      {
        path: '',
        loadComponent: () =>
          import('./pages/admin/admin.component').then((m) => m.AdminComponent),
        canActivate: [authGuard],
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
