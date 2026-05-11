import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { environment } from '../../../environments/environment';

export interface AboutCard {
  icon: string;
  title: string;
  description: string;
}

export interface AboutData {
  history: string[];
  whyChooseUs: AboutCard[];
  promise: string[];
}

const DEFAULT_HISTORY: string[] = [
  'Daddy Bear Plumbing has established itself as one of the most dependable plumbing service providers in Chicago and Suburbs, earning a reputation for delivering high-quality plumbing services to the local community. As a family-owned and operated business, we take great pride in providing prompt and reliable service to our customers.',
  'Founded on the belief that honest work speaks for itself, our company was built by hands that understand the trade inside and out. That passion for the plumbing industry drives everything we do — from the smallest faucet repair to a full re-pipe. We are dedicated to providing the same high level of quality work and exceptional customer service that has made Daddy Bear Plumbing a trusted name in the community.',
];

const DEFAULT_WHY_CHOOSE_US: AboutCard[] = [
  {
    icon: 'request_quote',
    title: 'We Respect Your Time',
    description: 'We offer free estimates as part of our service. To schedule an appointment, we require a $150 deposit, which is fully applied toward the final cost of the work performed. This deposit helps us ensure commitment on both sides, reduce last-minute cancellations, and provide reliable, timely service to all our customers.',
  },
  {
    icon: 'verified_user',
    title: 'Licensed, Insured, Bonded',
    description: 'Our company is fully licensed and insured to provide top-notch plumbing services. You can trust our team to complete every job to the highest standards of quality, and in the unlikely event of an accident or damage, our insurance covers any costs.',
  },
  {
    icon: 'workspace_premium',
    title: 'All Work Guaranteed',
    description: 'Choosing Daddy Bear Plumbing means peace of mind knowing that all work we perform is guaranteed. We stand by our work and take pride in providing high-quality services. With us, you can be confident that the job will be done right the first time.',
  },
];

const DEFAULT_PROMISE: string[] = [
  "Our team understands the importance of transparency and honesty when it comes to plumbing services. That's why we always provide our customers with transparent pricing with no hidden fees. We take pride in delivering efficient and customized plumbing solutions to meet our clients' specific needs.",
  'When you need a reliable plumber, look no further than Daddy Bear Plumbing. We strive to provide our customers with the highest quality service, and our team is always ready to take on any plumbing issue. Our service areas include La Grange, Villa Park, Brookfield, Westchester, Riverside, Berwyn, Cicero, Lyons, North Riverside, and more communities across Chicago and Suburbs.',
];

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './about.component.html',
})
export class AboutComponent implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);

  phone = environment.phone;
  phoneDisplay = environment.phoneDisplay;

  history: string[] = DEFAULT_HISTORY;
  whyChooseUs: AboutCard[] = DEFAULT_WHY_CHOOSE_US;
  promise: string[] = DEFAULT_PROMISE;

  async ngOnInit(): Promise<void> {
    try {
      const res = await fetch(`/gallery-images/about.json?t=${Date.now()}`);
      if (res.ok) {
        const json: Partial<AboutData> = await res.json();
        if (json.history?.length) this.history = json.history;
        if (json.whyChooseUs?.length) this.whyChooseUs = json.whyChooseUs;
        if (json.promise?.length) this.promise = json.promise;
        this.cdr.detectChanges();
      }
    } catch { /* keep defaults */ }
  }

  ngOnDestroy(): void {}
}
