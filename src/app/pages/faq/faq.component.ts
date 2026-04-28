import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { environment } from '../../../environments/environment';

export interface FaqItem {
  question: string;
  answer: string;
  bullets?: string[];
}

const DEFAULT_FAQ: FaqItem[] = [
  { question: 'What are your operating hours?', answer: 'We are available Monday through Friday, 8 AM to 8 PM' },
  { question: 'Do you offer emergency plumbing services?', answer: 'Yes, we offer emergency plumbing services. Our typical response time is within 1 hour, though this may vary depending on the situation and current demand. Call us immediately if you have a plumbing emergency.' },
  { question: 'What areas do you serve?', answer: "We serve Chicago's Western Suburbs including La Grange, Villa Park, Brookfield, Westchester, Riverside, Berwyn, Cicero, Lyons, North Riverside, and surrounding communities. Contact us to confirm service availability for your specific location." },
  { question: 'How do I schedule an appointment?', answer: `You can schedule an appointment by calling us at ${environment.phoneDisplay}, emailing us at ${environment.email}, or using our online contact form.` },
  { question: 'What is your cancellation policy?', answer: "We require 48 hours' notice for cancellations. For Monday appointments, please cancel by Friday at 9 AM. Late cancellations may be subject to a cancellation fee." },
  { question: 'Are your plumbers licensed?', answer: 'Yes, all of our plumbers are fully licensed, insured, and experienced professionals.' },
  {
    question: 'What services do you offer?',
    answer: 'We offer a wide range of plumbing services including:',
    bullets: [
      'Fixture installation & repair',
      'Leak detection & repair',
      'Drain cleaning',
      'Water heater installation & repair',
      'Remodeling & new construction plumbing',
      'Gas line work',
      'Sewer repair & replacement',
    ],
  },
  { question: 'How does pricing work?', answer: 'We offer free estimates, on-site assessments, and flat-fee quotes so you know exactly what to expect before any work begins. No hidden fees or surprises.' },
  { question: 'What payment methods do you accept?', answer: 'We accept cash, check, Zelle, and all major credit cards. Please note that credit card payments are subject to a 3.5% processing fee.' },
  { question: 'Do you offer warranties?', answer: "Yes, we offer a 3-year labor warranty on most services and a 30-day warranty on drain cleaning. Material and parts are covered under the manufacturer's warranty." },
  { question: 'Can I see references or reviews?', answer: "Absolutely. You can find our reviews on Google, Yelp, and Angie's List, or check out our reviews page." },
];

@Component({
  selector: 'app-faq',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './faq.component.html',
})
export class FaqComponent implements OnInit {
  private cdr = inject(ChangeDetectorRef);

  phone = environment.phone;
  phoneDisplay = environment.phoneDisplay;
  email = environment.email;
  items: FaqItem[] = DEFAULT_FAQ;

  async ngOnInit(): Promise<void> {
    try {
      const res = await fetch(`/gallery-images/faq.json?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          this.items = data;
          this.cdr.detectChanges();
        }
      }
    } catch { /* use defaults */ }
  }
}
