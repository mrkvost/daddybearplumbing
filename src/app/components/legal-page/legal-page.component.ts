import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BUSINESS } from '../../globals';

/** One card/article on a legal page (Privacy / Terms / Cookies). */
export interface LegalSection {
  icon: string;
  title: string;
  /** Either paragraphs OR bullets (or both — paragraphs render first). */
  paragraphs?: string[];
  bullets?: string[];
}

/** Whole-page content, passed in from the wrapping page component. */
export interface LegalPageContent {
  /** First word of the headline (rendered in navy). */
  title: string;
  /** Optional second word/phrase (rendered in primary-orange). */
  titleAccent?: string;
  /** Optional "Last amended: …" caption above the intro. */
  lastAmended?: string;
  /** Optional opening paragraph between the subhead and the section cards. */
  intro?: string;
  /** Ordered list of cards. */
  sections: LegalSection[];
}

@Component({
  selector: 'app-legal-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './legal-page.component.html',
})
export class LegalPageComponent {
  @Input({ required: true }) data!: LegalPageContent;

  /** Email used in the built-in Contact footer card. */
  email = BUSINESS.email;
}
