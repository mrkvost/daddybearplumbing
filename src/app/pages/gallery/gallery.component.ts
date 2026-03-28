/*
 * GalleryComponent — the "/gallery" route
 *
 * Displays a filterable grid of completed project photos.
 * Each card shows a project image, category, title, and location.
 * Clicking a card opens a lightbox modal with more detail.
 *
 * Navbar and Footer are provided by AppComponent — this component
 * only renders its own page content.
 */
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Project {
  id: number;
  title: string;
  category: string;
  location: string;
  description: string;
  icon: string;
  gradient: string;
}

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gallery.component.html',
})
export class GalleryComponent {
  /*
   * Categories for the filter bar.
   * "All" shows every project; the rest filter by category name.
   */
  categories = ['All', 'Emergency Repairs', 'Water Heaters', 'Drain Cleaning', 'Pipe Relining', 'Bathroom', 'Kitchen'];

  activeCategory = 'All';

  /*
   * Sample project data. Replace with real photos and descriptions
   * once the business provides them. Each project uses a Material
   * Symbols icon and a CSS gradient as a placeholder for a real image.
   */
  projects: Project[] = [
    {
      id: 1,
      title: 'Kitchen Sink Replacement',
      category: 'Kitchen',
      location: 'La Grange, IL',
      description: 'Full kitchen sink and faucet replacement including garbage disposal installation. Updated supply lines and drain connections to modern code standards.',
      icon: 'countertops',
      gradient: 'from-emerald-600 to-teal-700',
    },
    {
      id: 2,
      title: 'Emergency Pipe Burst',
      category: 'Emergency Repairs',
      location: 'Villa Park, IL',
      description: 'Responded within 45 minutes to a burst pipe in the basement. Isolated the water supply, repaired the damaged copper section, and restored full water flow same day.',
      icon: 'emergency_home',
      gradient: 'from-red-500 to-rose-700',
    },
    {
      id: 3,
      title: 'Tankless Water Heater Install',
      category: 'Water Heaters',
      location: 'Western Springs, IL',
      description: 'Replaced a 15-year-old tank water heater with a high-efficiency tankless unit. Upgraded gas line and venting to support the new system.',
      icon: 'thermostat',
      gradient: 'from-orange-500 to-amber-600',
    },
    {
      id: 4,
      title: 'Main Sewer Line Cleaning',
      category: 'Drain Cleaning',
      location: 'Elmhurst, IL',
      description: 'Camera inspection revealed heavy root intrusion in the main sewer line. Cleared with hydro-jetting and verified flow with a follow-up camera run.',
      icon: 'water_drop',
      gradient: 'from-blue-500 to-cyan-600',
    },
    {
      id: 5,
      title: 'Sewer Pipe Relining',
      category: 'Pipe Relining',
      location: 'Countryside, IL',
      description: 'Trenchless CIPP relining of a 40-foot sewer lateral under the driveway. No excavation needed — completed in one day with a 50-year warranty liner.',
      icon: 'home_repair_service',
      gradient: 'from-violet-500 to-purple-700',
    },
    {
      id: 6,
      title: 'Bathroom Remodel Plumbing',
      category: 'Bathroom',
      location: 'Oak Brook, IL',
      description: 'Complete rough-in and finish plumbing for a master bathroom remodel. Installed new shower valve, double vanity, and relocated the toilet drain.',
      icon: 'bathtub',
      gradient: 'from-sky-500 to-blue-600',
    },
    {
      id: 7,
      title: 'Water Heater Repair',
      category: 'Water Heaters',
      location: 'La Grange, IL',
      description: 'Diagnosed a faulty thermocouple causing intermittent hot water loss. Replaced the thermocouple and flushed sediment from the tank.',
      icon: 'local_fire_department',
      gradient: 'from-orange-600 to-red-500',
    },
    {
      id: 8,
      title: 'Floor Drain Unclogging',
      category: 'Drain Cleaning',
      location: 'Villa Park, IL',
      description: 'Basement floor drain backed up during heavy rain. Snaked the drain line and installed a backwater valve to prevent future sewer backups.',
      icon: 'plumbing',
      gradient: 'from-teal-500 to-emerald-600',
    },
    {
      id: 9,
      title: 'Gas Line Emergency Shutoff',
      category: 'Emergency Repairs',
      location: 'Elmhurst, IL',
      description: 'Detected gas smell near the water heater. Shut off the gas supply, located a corroded fitting, and replaced the connection with a new flex line.',
      icon: 'warning',
      gradient: 'from-yellow-500 to-orange-600',
    },
  ];

  /*
   * filteredProjects is a getter — Angular re-evaluates it during
   * change detection. When activeCategory changes, the grid updates.
   */
  get filteredProjects(): Project[] {
    if (this.activeCategory === 'All') {
      return this.projects;
    }
    return this.projects.filter(p => p.category === this.activeCategory);
  }

  /* Lightbox state */
  selectedProject: Project | null = null;

  setCategory(category: string): void {
    this.activeCategory = category;
  }

  openLightbox(project: Project): void {
    this.selectedProject = project;
  }

  closeLightbox(): void {
    this.selectedProject = null;
  }
}
