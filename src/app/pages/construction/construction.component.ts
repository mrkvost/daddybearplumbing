import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { BUSINESS } from '../../globals';
import { CallBannerComponent } from '../../components/call-banner/call-banner.component';

export interface ConstructionCard {
  icon: string;
  title: string;
  description: string;
  image?: string;
}

export type ConstructionMode = 'interior' | 'exterior';

export interface ConstructionData {
  interior: ConstructionCard[];
  exterior: ConstructionCard[];
}

const DEFAULT_INTERIOR_CARDS: ConstructionCard[] = [
  {
    icon: 'plumbing',
    title: 'Water, Drains & Vents',
    description: 'We install complete water supply, drain, and vent systems from the ground up, following approved plans and full Illinois plumbing code. This includes precise routing, proper pipe sizing, and correct pitch on drainage lines to ensure smooth flow and prevent future issues. Venting is carefully designed to maintain system balance and eliminate odors. All systems are pressure-tested and inspected to ensure safe, reliable, and long-lasting performance.',
  },
  {
    icon: 'gas_meter',
    title: 'Gas Piping',
    description: 'Our team performs safe and code-compliant gas line installations for all required appliances and systems. We carefully plan pipe routing, ensure proper sizing based on demand, and use approved materials and connection methods. Every gas system is thoroughly pressure-tested and checked for leaks to guarantee safety. We prioritize precision and strict safety standards at every step of the installation.',
  },
  {
    icon: 'bathtub',
    title: 'Final Plumbing Installation',
    description: 'During the final phase, we install and connect all fixtures and equipment, including toilets, sinks, showers, bathtubs, and appliances. Each component is securely mounted, properly sealed, and aligned for both performance and appearance. We complete full system testing to confirm proper operation, water flow, drainage, and overall functionality. The result is a clean, finished system that is fully operational, efficient, and ready for everyday use.',
  },
];

const DEFAULT_EXTERIOR_CARDS: ConstructionCard[] = [
  {
    icon: 'water_drop',
    title: 'Main Water Line',
    description: 'We install and connect the main water service line from the municipal supply to the property, ensuring proper sizing, pressure, and long-term reliability. Our work includes trenching, pipe installation (copper, HDPE, or approved materials), shut-off valves, and secure tie-ins to the main. We also handle upgrades and replacements of existing water services to improve flow and meet current code requirements.',
  },
  {
    icon: 'foundation',
    title: 'Sewer Line',
    description: 'We provide full installation and repair of sewer lines, connecting the building to the municipal sewer system. This includes proper grading for flow, installation of cleanouts, and ensuring all piping meets code standards. For both residential and commercial properties, we address new installations, replacements, and repairs, delivering systems designed for durability and efficient waste removal.',
  },
  {
    icon: 'flood',
    title: 'Storm Drainage Line',
    description: 'We install stormwater drainage systems to safely direct rainwater away from the property and prevent flooding or water damage. This includes yard drains, downspout connections, catch basins, and underground piping systems. Proper layout and grading are key to ensuring effective water management and long-term protection of the structure.',
  },
];

const INTERIOR_INTRO: string[] = [
  'On the interior, we provide complete plumbing systems from the ground up for both residential and commercial properties. Our work begins with rough-in installation of water lines, drain and vent piping, and gas piping, all carefully planned, properly sized, and installed in full compliance with code.',
  'We handle full plumbing build-outs for a wide range of facilities, including homes, office buildings, restaurants, healthcare facilities, hotels, and multi-unit properties. This includes installation of water supply systems, drainage and venting, gas lines, restrooms, commercial kitchens, utility areas, and mechanical systems such as water heaters and specialized equipment.',
  'The process is completed with precise final fixture installation, including toilets, vanities, bathtubs, showers, sinks, and appliances. Every detail is executed with a focus on performance, durability, and long-term reliability, ensuring the system is ready to meet the demands of daily use.',
];

const EXTERIOR_INTRO: string[] = [
  'All exterior plumbing work is performed with a focus on safety, durability, and full compliance with Illinois plumbing code, ensuring dependable performance for years to come.',
  'On the exterior, we construct and connect complete underground infrastructure, including water service lines, sewer systems, and storm drainage. Our scope also includes excavation, trenching, tie-ins to municipal systems, grease trap connections (for restaurants), backflow prevention systems, and other code-required installations.',
  'We maintain a clean, organized, and controlled job site — ensuring proper drainage, safe conditions, and uninterrupted access so everything continues to function smoothly, including vehicle traffic. We ensure all exterior systems are built for long-term performance, safety, and reliability.',
];

@Component({
  selector: 'app-construction',
  standalone: true,
  imports: [CommonModule, CallBannerComponent],
  templateUrl: './construction.component.html',
})
export class ConstructionComponent implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);
  private routeSub?: Subscription;

  phone = BUSINESS.phone;
  phoneDisplay = BUSINESS.phoneDisplay;
  mode: ConstructionMode = 'interior';
  cards: ConstructionCard[] = DEFAULT_INTERIOR_CARDS;
  selectedCard: ConstructionCard | null = null;

  get heading(): string {
    return this.mode === 'exterior' ? 'Exterior Construction' : 'Interior Construction';
  }

  get eyebrow(): string {
    return 'New Construction';
  }

  get introParagraphs(): string[] {
    return this.mode === 'exterior' ? EXTERIOR_INTRO : INTERIOR_INTRO;
  }

  openCard(card: ConstructionCard): void {
    this.selectedCard = card;
  }

  closeCard(): void {
    this.selectedCard = null;
  }

  async ngOnInit(): Promise<void> {
    this.routeSub = this.route.data.subscribe(async data => {
      this.mode = (data['mode'] as ConstructionMode) || 'interior';
      this.cards = this.mode === 'exterior' ? DEFAULT_EXTERIOR_CARDS : DEFAULT_INTERIOR_CARDS;
      this.selectedCard = null;

      try {
        const res = await fetch(`/gallery-images/construction.json?t=${Date.now()}`);
        if (res.ok) {
          const json: Partial<ConstructionData> = await res.json();
          const list = this.mode === 'exterior' ? json.exterior : json.interior;
          if (list?.length) this.cards = list;
        }
      } catch { /* keep defaults */ }
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }
}
