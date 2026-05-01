import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ConstructionCard {
  icon: string;
  title: string;
  description?: string;
  image?: string;
  /** Required — every card belongs to either the exterior or interior section. */
  section: 'exterior' | 'interior';
}

export type ConstructionMode = 'residential' | 'commercial';

export interface ConstructionData {
  residential: ConstructionCard[];
  commercial: ConstructionCard[];
}

const DEFAULT_CARDS: ConstructionCard[] = [
  { icon: 'water_drop', title: 'Main water line', section: 'exterior' },
  { icon: 'foundation', title: 'Sewer line', section: 'exterior' },
  { icon: 'flood', title: 'Storm drainage line', section: 'exterior' },
  { icon: 'plumbing', title: 'Water, Drains and Vents', section: 'interior' },
  { icon: 'gas_meter', title: 'Gas piping', section: 'interior' },
  { icon: 'bathtub', title: 'Final plumbing installation', section: 'interior' },
];

const RESIDENTIAL_INTRO: string[] = [
  'We provide complete new construction plumbing services for both interior and exterior systems, delivering honest, high-quality work from start to finish and in full compliance with Illinois plumbing code.',
  'We connect the exterior of the property to the main systems, including water service lines, sewer lines, stormwater drainage lines, and underground piping. Our work also includes excavation, trenching, and installation of gas lines, all done safely and according to code. From tying into the main water supply to completing the full drainage and gas systems, we build plumbing infrastructure that is solid, efficient, and built to last.',
  'In the interior of the house, we install the entire plumbing system from the ground up—starting with rough-in water lines, drain, vent piping, and gas piping and continuing through to final installation of fixtures such as toilets, vanities, bathtubs, showers, kitchen sinks, and appliances. Every detail is completed with precision to ensure long-term performance and reliability.',
];

const COMMERCIAL_INTRO: string[] = [
  'On the interior, we handle full plumbing build-outs for a wide range of facilities, including office buildings, restaurants, healthcare facilities, hotels, and multi-unit properties. Our work includes installation of water supply lines, drain and vent systems, gas piping, restrooms, commercial kitchens, utility rooms, and mechanical systems such as water heaters and specialized equipment. We focus on proper system design, sizing, and durability to meet the high demands of commercial use.',
  'On the exterior, we construct and connect complete underground infrastructure, including water service lines, sewer systems, storm drainage, and gas lines. Our scope also includes excavation, trenching, tie-ins to municipal systems, grease trap connections (for restaurants), backflow prevention systems, and other code-required installations. We ensure all exterior systems are built for long-term performance, safety, and reliability.',
  'From underground work to final interior installation, our goal is to deliver efficient, code-compliant plumbing systems that support daily operations and stand the test of time.',
];

@Component({
  selector: 'app-construction',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './construction.component.html',
})
export class ConstructionComponent implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);
  private routeSub?: Subscription;

  phone = environment.phone;
  phoneDisplay = environment.phoneDisplay;
  mode: ConstructionMode = 'residential';
  cards: ConstructionCard[] = DEFAULT_CARDS;

  get heading(): string {
    return this.mode === 'commercial' ? 'Commercial Construction' : 'Residential Construction';
  }

  get eyebrow(): string {
    return 'New Construction';
  }

  get introParagraphs(): string[] {
    return this.mode === 'commercial' ? COMMERCIAL_INTRO : RESIDENTIAL_INTRO;
  }

  get exteriorCards(): ConstructionCard[] {
    return this.cards.filter(c => c.section === 'exterior');
  }

  get interiorCards(): ConstructionCard[] {
    return this.cards.filter(c => c.section === 'interior');
  }

  async ngOnInit(): Promise<void> {
    this.routeSub = this.route.data.subscribe(async data => {
      this.mode = (data['mode'] as ConstructionMode) || 'residential';
      this.cards = DEFAULT_CARDS;

      try {
        const res = await fetch(`/gallery-images/construction.json?t=${Date.now()}`);
        if (res.ok) {
          const json: ConstructionData = await res.json();
          const list = this.mode === 'commercial' ? json.commercial : json.residential;
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
