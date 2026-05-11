import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { BUSINESS } from '../../globals';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
})
export class NavbarComponent {
  phone = BUSINESS.phone;
  phoneDisplay = BUSINESS.phoneDisplay;
  isMenuOpen = false;

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  closeMenu(): void {
    this.isMenuOpen = false;
  }
}
