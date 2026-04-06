import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { environment } from '../../../environments/environment';

export interface ServiceCard {
  icon: string;
  title: string;
  description: string;
}

const DEFAULT_CARDS: ServiceCard[] = [
  { icon: 'water_drop', title: 'Drain Cleaning', description: 'Slow or clogged drains are one of the most common plumbing issues. We use professional-grade equipment to clear blockages and restore proper flow.' },
  { icon: 'plumbing', title: 'Leak Detection & Repair', description: 'Water leaks can cause significant damage if left unaddressed. Our team locates and repairs leaks quickly — in walls, floors, or underground lines.' },
  { icon: 'water_heater', title: 'Water Heater Service', description: 'Traditional tank or modern tankless — we handle installation, repair, and replacement. We\'ll help you choose the right system for your home and budget.' },
  { icon: 'bathroom', title: 'Toilet & Faucet Repair', description: 'Running toilets and dripping faucets waste water and money. We repair and replace all types of fixtures quickly and efficiently.' },
  { icon: 'ac_unit', title: 'Frozen Pipes', description: 'Illinois winters can freeze your pipes. We provide emergency thawing services and can insulate vulnerable pipes to prevent future freeze damage.' },
  { icon: 'valve', title: 'Sump & Ejector Pumps', description: 'Protect your basement from flooding with properly maintained sump and ejector pumps. We install, repair, and service all pump types.' },
  { icon: 'gas_meter', title: 'Gas Line Service', description: 'Gas line repair, installation, and leak detection. Safety is our top priority when working with gas systems in your home.' },
  { icon: 'foundation', title: 'Sewer Repair', description: 'Sewer line repair and replacement, root removal, hydro jetting, and backflow prevention to keep your system running clean.' },
  { icon: 'delete_sweep', title: 'Garbage Disposals', description: 'Replacement and installation of kitchen garbage disposal units — all major brands.' },
  { icon: 'speed', title: 'Water Pressure', description: 'Diagnosis and repair of low or high water pressure issues throughout your home.' },
  { icon: 'flood', title: 'Flood Control', description: 'French drain systems and flood control installations to keep your home dry year-round.' },
  { icon: 'swap_vert', title: 'Lead Pipe Replacement', description: 'Safe removal and replacement of outdated lead pipes to protect your family\'s health and meet current building codes.' },
];

@Component({
  selector: 'app-residential',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './residential.component.html',
})
export class ResidentialComponent implements OnInit {
  private cdr = inject(ChangeDetectorRef);

  phone = environment.phone;
  phoneDisplay = environment.phoneDisplay;
  cards: ServiceCard[] = DEFAULT_CARDS;

  async ngOnInit(): Promise<void> {
    try {
      const res = await fetch(`/gallery-images/services-residential.json?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          this.cards = data;
          this.cdr.detectChanges();
        }
      }
    } catch { /* use defaults */ }
  }
}
