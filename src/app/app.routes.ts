import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/home/home.component').then((m) => m.HomeComponent),
    data: {
      title: 'Home',
      description: 'Professional plumbing services for Chicago\'s Western Suburbs. Licensed, insured, and locally owned. Emergency support available during working hours.',
    },
  },
  {
    path: 'gallery',
    loadComponent: () =>
      import('./pages/gallery/gallery.component').then((m) => m.GalleryComponent),
    data: {
      title: 'Gallery',
      description: 'Browse photos from our recent plumbing projects across the Western Suburbs. Emergency repairs, water heaters, drain cleaning, and more.',
    },
  },
  {
    path: 'reviews',
    loadComponent: () =>
      import('./pages/reviews/reviews.component').then((m) => m.ReviewsComponent),
    data: {
      title: 'Reviews',
      description: 'Read what our customers say about Daddy Bear Plumbing. Honest reviews from homeowners across La Grange, Villa Park, and the Western Suburbs.',
    },
  },
  {
    path: 'contact',
    loadComponent: () =>
      import('./pages/contact/contact.component').then((m) => m.ContactComponent),
    data: {
      title: 'Contact',
      description: 'Get in touch with Daddy Bear Plumbing. Call us or send a message for a free estimate. Serving Brookfield, La Grange, Villa Park, and the Western Suburbs.',
    },
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
