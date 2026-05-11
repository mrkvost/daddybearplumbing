import { Component, OnInit, HostListener, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { environment } from '../../../environments/environment';

export interface ServiceCard {
  icon: string;
  title: string;
  description: string;
  image?: string;
}

export interface CommercialData {
  industries: ServiceCard[];
  services: ServiceCard[];
}

const DEFAULT_INDUSTRIES: ServiceCard[] = [
  { icon: 'restaurant', title: 'Restaurants', description: 'We know restaurants like the back of our hand. When it comes to plumbing needs, we understand that time is money and a malfunctioning kitchen sink can derail the whole operation.' },
  { icon: 'local_hospital', title: 'Healthcare Facilities', description: 'We understand the importance of keeping healthcare facilities up and running. Our team ensures your facility meets all code requirements and stays fully operational.' },
  { icon: 'business', title: 'Office Buildings', description: 'A single leaky faucet can disrupt your entire workday. We provide comprehensive office building plumbing services — from routine maintenance to emergency repairs.' },
  { icon: 'apartment', title: 'Apartments & Multi-Unit', description: 'We work with landlords and property managers to provide reliable, efficient plumbing services for multi-unit buildings — from individual unit repairs to building-wide maintenance.' },
  { icon: 'hotel', title: 'Hotels & Motels', description: 'From fixing leaky faucets to upgrading showerheads, we make sure your guests have a comfortable stay with reliable plumbing throughout.' },
  { icon: 'sports_soccer', title: 'Sports Facilities', description: 'Expert plumbing for sports facilities — repairing showers, keeping restrooms operational, so you can focus on the game, not the plumbing.' },
];

const DEFAULT_SERVICES: ServiceCard[] = [
  { icon: 'build', title: 'Repairs & Maintenance', description: '' },
  { icon: 'water_drop', title: 'Drain Cleaning', description: '' },
  { icon: 'water_heater', title: 'Water Heaters', description: '' },
  { icon: 'bathroom', title: 'Fixture Repair', description: '' },
  { icon: 'emergency', title: 'Emergency Service', description: '' },
  { icon: 'waves', title: 'Hydro Jetting', description: '' },
  { icon: 'foundation', title: 'Sewer Lines', description: '' },
  { icon: 'shield', title: 'Backflow Prevention', description: '' },
  { icon: 'gas_meter', title: 'Gas Leaks & Detection', description: '' },
  { icon: 'construction', title: 'Site Digs & Excavation', description: '' },
];

@Component({
  selector: 'app-commercial',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './commercial.component.html',
})
export class CommercialComponent implements OnInit {
  private cdr = inject(ChangeDetectorRef);

  phone = environment.phone;
  phoneDisplay = environment.phoneDisplay;
  industries: ServiceCard[] = DEFAULT_INDUSTRIES;
  services: ServiceCard[] = DEFAULT_SERVICES;
  selectedCard: ServiceCard | null = null;

  async ngOnInit(): Promise<void> {
    try {
      const res = await fetch(`/gallery-images/services-commercial.json?t=${Date.now()}`);
      if (res.ok) {
        const data: CommercialData = await res.json();
        if (data.industries?.length) this.industries = data.industries;
        if (data.services?.length) this.services = data.services;
        this.cdr.detectChanges();
      }
    } catch { /* use defaults */ }
  }

  openCard(card: ServiceCard): void {
    this.selectedCard = card;
  }

  closeCard(): void {
    this.selectedCard = null;
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.selectedCard) this.closeCard();
  }
}
