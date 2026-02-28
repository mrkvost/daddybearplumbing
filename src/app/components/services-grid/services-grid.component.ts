/*
 * ServicesGridComponent
 *
 * A 2×2 (mobile) / 4-column (desktop) grid of service cards.
 *
 * The services array is defined as component data here and iterated
 * in the template with @for — Angular's built-in looping syntax.
 * Keeping the data in the TypeScript class makes it easy to add,
 * remove, or reorder cards without touching HTML structure.
 */
import { Component } from '@angular/core';

// NgFor equivalent in modern Angular — imported so the template can use @for
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-services-grid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './services-grid.component.html',
})
export class ServicesGridComponent {
  /*
   * Each service is an object with an icon name (from Material Symbols),
   * a title, and a short subtitle. Add more objects here to add more cards.
   */
  services = [
    {
      icon: 'build',
      title: 'Emergency Repairs',
      subtitle: 'Fast localized support',
    },
    {
      icon: 'thermostat',
      title: 'Water Heaters',
      subtitle: 'Install & Repair',
    },
    {
      icon: 'water_drop',
      title: 'Drain Cleaning',
      subtitle: 'Clog removal experts',
    },
    {
      icon: 'home_repair_service',
      title: 'Pipe Relining',
      subtitle: 'Modern trenchless tech',
    },
  ];
}
