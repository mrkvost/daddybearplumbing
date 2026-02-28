/*
 * NavbarComponent
 *
 * A "component" in Angular is a self-contained piece of UI. It has three parts:
 *   1. The TypeScript class  — logic and state (this file)
 *   2. The HTML template     — what gets rendered (navbar.component.html)
 *   3. Optional CSS          — styles scoped to this component only
 *
 * The @Component decorator tells Angular this class is a component and
 * provides its configuration.
 */
import { Component } from '@angular/core';

// RouterLink is an Angular directive that makes <a> tags work with the router
// (navigation without full page reloads).
import { RouterLink } from '@angular/router';

@Component({
  // selector: the HTML tag name used to embed this component in other templates.
  // e.g. <app-navbar /> in app.component.html renders this component.
  selector: 'app-navbar',

  // standalone: true means this component does not belong to an NgModule.
  // It declares its own dependencies in the imports array below.
  standalone: true,

  // imports: other components, directives, and pipes this template needs.
  imports: [RouterLink],

  // templateUrl: points to the HTML file that defines this component's markup.
  templateUrl: './navbar.component.html',
})
export class NavbarComponent {
  /*
   * isMenuOpen tracks whether the mobile hamburger menu is visible.
   * In Angular, when a class property changes, the template automatically
   * re-renders the affected parts — no manual DOM manipulation needed.
   */
  isMenuOpen = false;

  /*
   * toggleMenu() flips the boolean. The template calls this method when
   * the hamburger button is clicked.
   */
  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }
}
