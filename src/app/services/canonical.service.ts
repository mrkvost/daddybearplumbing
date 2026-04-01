import { Injectable, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { filter } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CanonicalService {
  private router = inject(Router);
  private doc = inject(DOCUMENT);

  init(): void {
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e) => {
      const event = e as NavigationEnd;
      this.setCanonical(event.urlAfterRedirects);
    });
  }

  private setCanonical(path: string): void {
    if (path.startsWith('/admin')) {
      this.removeCanonical();
      return;
    }

    const cleanPath = path.split('?')[0].replace(/\/+$/, '');
    const canonical = `https://${environment.domain}${cleanPath}`;

    let link = this.doc.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', canonical);
  }

  private removeCanonical(): void {
    const link = this.doc.querySelector('link[rel="canonical"]');
    if (link) link.remove();
  }
}
