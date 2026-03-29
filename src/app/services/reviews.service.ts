import { Injectable } from '@angular/core';

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

  async loadReviews(): Promise<Review[]> {
    const response = await fetch(`/reviews-data/reviews.json?t=${Date.now()}`);
    if (!response.ok) return [];
    return response.json();
  }
}
