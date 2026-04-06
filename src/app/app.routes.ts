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
    path: 'about',
    loadComponent: () =>
      import('./pages/about/about.component').then((m) => m.AboutComponent),
    data: {
      title: 'About Us',
      description: 'Learn about Daddy Bear Plumbing — a family-owned plumbing company serving Chicago\'s Western Suburbs. Licensed, insured, and all work guaranteed.',
    },
  },
  {
    path: 'residential',
    loadComponent: () =>
      import('./pages/residential/residential.component').then((m) => m.ResidentialComponent),
    data: {
      title: 'Residential Services',
      description: 'Residential plumbing services in Chicago\'s Western Suburbs. Drain cleaning, water heaters, leak repair, sewer service, and more. Free estimates.',
    },
  },
  {
    path: 'commercial',
    loadComponent: () =>
      import('./pages/commercial/commercial.component').then((m) => m.CommercialComponent),
    data: {
      title: 'Commercial Services',
      description: 'Commercial plumbing services for restaurants, offices, apartments, hotels, and healthcare facilities across Chicago\'s Western Suburbs.',
    },
  },
  {
    path: 'faq',
    loadComponent: () =>
      import('./pages/faq/faq.component').then((m) => m.FaqComponent),
    data: {
      title: 'FAQ',
      description: 'Frequently asked questions about Daddy Bear Plumbing — hours, service areas, pricing, warranties, and more.',
    },
  },
  {
    path: 'terms',
    loadComponent: () =>
      import('./pages/terms/terms.component').then((m) => m.TermsComponent),
    data: {
      title: 'Terms & Conditions',
      description: 'Terms and conditions for plumbing services provided by Daddy Bear Plumbing.',
    },
  },
  {
    path: 'privacy',
    loadComponent: () =>
      import('./pages/privacy/privacy.component').then((m) => m.PrivacyComponent),
    data: {
      title: 'Privacy Policy',
      description: 'Privacy policy for Daddy Bear Plumbing — how we collect, use, and protect your personal information.',
    },
  },
  {
    path: 'cookies',
    loadComponent: () =>
      import('./pages/cookies/cookies.component').then((m) => m.CookiesComponent),
    data: {
      title: 'Cookies',
      description: 'Cookie policy for the Daddy Bear Plumbing website — what cookies we use and why.',
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
