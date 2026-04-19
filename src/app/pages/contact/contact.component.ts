import { Component, inject, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';
import { DEFAULT_LOCATIONS } from '../../defaults/locations';

declare global {
  interface Window {
    turnstile: {
      render: (element: string | HTMLElement, options: {
        sitekey: string;
        callback: (token: string) => void;
        'error-callback'?: () => void;
        'expired-callback'?: () => void;
        theme?: string;
      }) => string;
      reset: (widgetId: string) => void;
    };
  }
}

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contact.component.html',
})
export class ContactComponent implements AfterViewInit {
  private cdr = inject(ChangeDetectorRef);
  private sanitizer = inject(DomSanitizer);

  phone = environment.phone;
  phoneDisplay = environment.phoneDisplay;
  email = environment.email;
  address = environment.address;
  mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${environment.address.line1}, ${environment.address.city}, ${environment.address.state} ${environment.address.zip}`
  )}`;
  safeEmbedUrl: SafeResourceUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
    `https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${encodeURIComponent(
      `${environment.address.line1}, ${environment.address.city}, ${environment.address.state} ${environment.address.zip}`
    )}&zoom=14`
  );

  locations = DEFAULT_LOCATIONS;

  form = { name: '', email: '', phone: '', message: '', website: '' };
  turnstileToken = '';
  sending = false;
  sent = false;
  error = '';
  private widgetId = '';

  ngAfterViewInit(): void {
    this.loadTurnstile();
    this.loadLocations();
  }

  private async loadLocations(): Promise<void> {
    try {
      const res = await fetch(`/gallery-images/locations.json?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          this.locations = data;
          this.cdr.detectChanges();
        }
      }
    } catch { /* use defaults */ }
  }

  private loadTurnstile(): void {
    if (!environment.turnstileSiteKey) return;

    // Load Turnstile script if not already loaded
    if (!document.querySelector('script[src*="turnstile"]')) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit';
      script.async = true;
      document.head.appendChild(script);
    }

    const renderWidget = () => {
      const container = document.getElementById('turnstile-container');
      if (!container || !window.turnstile) return;
      this.widgetId = window.turnstile.render(container, {
        sitekey: environment.turnstileSiteKey,
        callback: (token: string) => {
          this.turnstileToken = token;
          this.cdr.detectChanges();
        },
        'expired-callback': () => {
          this.turnstileToken = '';
          this.cdr.detectChanges();
        },
        theme: 'light',
      });
    };

    // Try rendering immediately or wait for script load
    if (window.turnstile) {
      setTimeout(renderWidget, 0);
    } else {
      (window as any).onTurnstileLoad = renderWidget;
    }
  }

  async onSubmit(): Promise<void> {
    this.error = '';

    if (!this.form.name || !this.form.email || !this.form.message) {
      this.error = 'Please fill in all required fields.';
      return;
    }

    if (!this.turnstileToken && environment.turnstileSiteKey) {
      this.error = 'Please complete the verification.';
      return;
    }

    this.sending = true;
    this.cdr.detectChanges();

    const payload = JSON.stringify({
      name: this.form.name,
      email: this.form.email,
      phone: this.form.phone,
      message: this.form.message,
      website: this.form.website, // honeypot
      turnstile_token: this.turnstileToken,
    });

    try {
      const response = await this.fetchWithRetry(environment.contactFormUrl, payload, 2);

      if (response.status === 429) {
        this.error = 'Too many requests. Please try again in a minute.';
      } else {
        const data = await response.json();
        if (data.ok) {
          this.sent = true;
        } else {
          this.error = data.error || 'Failed to send message. Please try again.';
        }
      }
    } catch {
      this.error = 'Failed to send message. Please try again.';
    }

    this.sending = false;
    this.cdr.detectChanges();
  }

  private async fetchWithRetry(url: string, body: string, retries: number): Promise<Response> {
    const options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body };
    let response = await fetch(url, options);

    for (let i = 0; i < retries && response.status === 429; i++) {
      await new Promise(r => setTimeout(r, 1000));
      response = await fetch(url, options);
    }

    return response;
  }
}
