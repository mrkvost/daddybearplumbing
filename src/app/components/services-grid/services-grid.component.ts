import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-services-grid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './services-grid.component.html',
})
export class ServicesGridComponent {
  services = [
    {
      icon: 'emergency_home',
      title: 'Emergency Repairs',
      subtitle: 'Rapid response for structural leaks and mechanical failures. Available for critical interventions.',
    },
    {
      icon: 'hot_tub',
      title: 'Water Heaters',
      subtitle: 'High-efficiency boiler installation and maintenance. Precision calibration for optimal thermal output.',
    },
    {
      icon: 'water_damage',
      title: 'Drain Cleaning',
      subtitle: 'Hydro-jetting and mechanical clearance of obstruction points within residential mainlines.',
    },
    {
      icon: 'videocam',
      title: 'Pipe Inspection',
      subtitle: 'Non-invasive diagnostic imaging using high-resolution specialized fiber optic camera systems.',
    },
  ];
}
