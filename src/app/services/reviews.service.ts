import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface Review {
  id: string;
  name: string;
  rating: number;
  text: string;
  location: string;
  date: string;
}

@Injectable({ providedIn: 'root' })
export class ReviewsService {
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  async loadReviews(): Promise<Review[]> {
    if (!this.isBrowser) return [];
    const response = await fetch(`/reviews-data/reviews.json?t=${Date.now()}`);
    if (!response.ok) return [];
    return response.json();
  }
}
