import { Component, Input, computed, signal } from '@angular/core';
import { BUSINESS } from '../../globals';

/**
 * Variants used across the redesigned pages. Each maps to a fixed bundle of
 * copy + visual flag (e.g. pulsing icon disc) in the template.
 *
 *   help        Need Plumbing Help?            — home, about, residential, gallery, commercial
 *   planning    Planning a Project?            — construction interior + exterior
 *   questions   Still Have Questions?          — faq
 *   experience  Ready to Experience…           — contact, reviews   (split-color, pulsing disc)
 */
export type CallBannerVariant = 'help' | 'planning' | 'questions' | 'experience';

interface VariantCopy {
  title: string;
  /** Optional second word/phrase rendered in primary-orange on its own line. */
  titleAccent?: string;
  subtitle: string;
  /** Button label prefix; phone number is appended via the template. */
  buttonPrefix: string;
}

const COPY: Record<CallBannerVariant, VariantCopy> = {
  help: {
    title: 'Need Plumbing Help?',
    subtitle: "We're ready to help — fast, reliable, and honest service.",
    buttonPrefix: 'Call',
  },
  planning: {
    title: 'Planning a Project?',
    subtitle: "Let's talk about your build — we handle the plumbing end-to-end.",
    buttonPrefix: 'Call',
  },
  questions: {
    title: 'Still Have Questions?',
    subtitle: "Give us a call — we'll walk you through it.",
    buttonPrefix: 'Call',
  },
  experience: {
    title: 'Ready to Experience',
    titleAccent: 'the Difference?',
    subtitle: 'Join our satisfied customers. Call us today for honest, professional plumbing service you can trust.',
    buttonPrefix: 'Call',
  },
};

@Component({
  selector: 'app-call-banner',
  standalone: true,
  imports: [],
  templateUrl: './call-banner.component.html',
})
export class CallBannerComponent {
  @Input() variant: CallBannerVariant = 'help';

  phone = BUSINESS.phone;
  phoneDisplay = BUSINESS.phoneDisplay;

  /** Lookup the copy bundle for the active variant; falls back to `help`. */
  get copy(): VariantCopy {
    return COPY[this.variant] ?? COPY.help;
  }
}
