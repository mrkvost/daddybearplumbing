import { Injectable, inject } from '@angular/core';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';
import { filter, map, mergeMap } from 'rxjs';
import { environment } from '../../environments/environment';

const BRAND = 'Daddy Bear Plumbing';

@Injectable({ providedIn: 'root' })
export class CanonicalService {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private titleService = inject(Title);
  private meta = inject(Meta);
  private doc = inject(DOCUMENT);

  init(): void {
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(() => {
        let r = this.route;
        while (r.firstChild) r = r.firstChild;
        return r;
      }),
      mergeMap(r => r.data),
    ).subscribe(data => {
      const url = this.router.url;

      // Title
      const pageTitle = data['title'];
      this.titleService.setTitle(pageTitle ? `${BRAND} | ${pageTitle}` : BRAND);

      // Meta description
      const description = data['description'];
      if (description) {
        this.meta.updateTag({ name: 'description', content: description });
      } else {
        this.meta.removeTag('name="description"');
      }

      // Canonical + Open Graph
      if (url.startsWith('/admin')) {
        this.removeCanonical();
      } else {
        const cleanPath = url.split('?')[0].replace(/\/+$/, '');
        const fullUrl = `https://${environment.domain}${cleanPath}`;
        this.setCanonical(fullUrl);

        // Open Graph tags
        const ogTitle = pageTitle ? `${BRAND} | ${pageTitle}` : BRAND;
        this.meta.updateTag({ property: 'og:title', content: ogTitle });
        this.meta.updateTag({ property: 'og:description', content: description || '' });
        this.meta.updateTag({ property: 'og:url', content: fullUrl });
        this.meta.updateTag({ property: 'og:image', content: `https://${environment.domain}/gallery-images/meta/og-image.jpg` });
      }
    });
  }

  private setCanonical(href: string): void {
    let link = this.doc.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', href);
  }

  private removeCanonical(): void {
    const link = this.doc.querySelector('link[rel="canonical"]');
    if (link) link.remove();
  }
}
