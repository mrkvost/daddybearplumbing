/*
 * AppComponent (app.ts) — the root component and layout shell
 *
 * This is the first component Angular renders. Its template wraps every page:
 *   <app-navbar>  ← always visible
 *   <router-outlet> ← Angular swaps page content here based on the URL
 *   <app-footer>  ← always visible
 *
 * Because Navbar and Footer are here (not in each page component),
 * they automatically appear on every route without repetition.
 */
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './components/navbar/navbar.component';
import { FooterComponent } from './components/footer/footer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, FooterComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
