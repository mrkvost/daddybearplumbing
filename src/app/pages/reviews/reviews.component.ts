import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReviewsService, Review } from '../../services/reviews.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-reviews',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reviews.component.html',
})
export class ReviewsComponent implements OnInit {
  private cdr = inject(ChangeDetectorRef);
  private reviewsService = inject(ReviewsService);

  phone = environment.phone;
  phoneDisplay = environment.phoneDisplay;
  reviews: Review[] = [];
  loading = true;

  async ngOnInit(): Promise<void> {
    this.reviews = await this.reviewsService.loadReviews();
    this.loading = false;
    this.cdr.detectChanges();
  }

  stars(rating: number): number[] {
    return Array(5).fill(0).map((_, i) => i < rating ? 1 : 0);
  }

  get averageRating(): number {
    if (this.reviews.length === 0) return 0;
    return this.reviews.reduce((sum, r) => sum + r.rating, 0) / this.reviews.length;
  }

  get averageRatingDisplay(): string {
    return this.averageRating.toFixed(1);
  }

  get averageStars(): number[] {
    return this.stars(Math.round(this.averageRating));
  }
}
