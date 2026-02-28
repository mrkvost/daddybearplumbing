/*
 * ServiceAreaComponent
 *
 * Shows an embedded Google Map alongside a list of service area locations.
 *
 * IMPORTANT — Google Maps embed URL:
 *   The placeholder URL below points to La Grange, IL for development.
 *   To use your real business location:
 *     1. Go to https://maps.google.com and find your business address.
 *     2. Click Share → Embed a map → Copy HTML.
 *     3. Extract the src="..." URL from the <iframe> tag.
 *     4. Replace the embedUrl string below with that URL.
 *
 * WHY DomSanitizer?
 *   Angular blocks dynamic URLs in <iframe [src]> by default as a security
 *   measure against XSS attacks. DomSanitizer.bypassSecurityTrustResourceUrl()
 *   explicitly marks a URL as safe after you have verified it yourself.
 *   Only use this with URLs you control or trust (like Google Maps).
 */
import { Component, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-service-area',
  standalone: true,
  imports: [],
  templateUrl: './service-area.component.html',
})
export class ServiceAreaComponent {
  /*
   * inject() is Angular's modern way to get services inside a class.
   * DomSanitizer is a built-in Angular service for handling security-sensitive
   * values like URLs and HTML strings.
   */
  private sanitizer = inject(DomSanitizer);

  /*
   * safeEmbedUrl is the sanitized version of the Google Maps URL.
   * SafeResourceUrl is a TypeScript type that signals "this URL has been
   * reviewed and is safe to use in a resource context (e.g. iframe src)."
   *
   * Replace the URL string below with your actual Google Maps embed URL.
   */
  safeEmbedUrl: SafeResourceUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
    'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d23819.37!2d-87.8698!3d41.8081!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x880e4e4a2a2a2a2b%3A0x0!2sLa+Grange%2C+IL!5e0!3m2!1sen!2sus!4v1700000000000!5m2!1sen!2sus'
  );

  /* Service area towns displayed in the location list */
  locations = [
    'La Grange, IL',
    'Villa Park, IL',
    'Western Springs',
    'Elmhurst, IL',
    'Countryside',
    'Oak Brook',
  ];
}
