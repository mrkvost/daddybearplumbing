import { Component } from '@angular/core';
import { LegalPageComponent, LegalPageContent } from '../../components/legal-page/legal-page.component';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [LegalPageComponent],
  templateUrl: './terms.component.html',
})
export class TermsComponent {
  data: LegalPageContent = {
    title: 'Terms',
    titleAccent: '& Conditions',
    lastAmended: 'Last amended: April 2026',
    sections: [
      {
        icon: 'business_center',
        title: 'Scope of Work',
        paragraphs: [
          'Daddy Bear Plumbing will provide plumbing services as requested by the customer. These services will be provided in a professional, courteous, and timely manner.',
        ],
      },
      {
        icon: 'attach_money',
        title: 'Pricing',
        paragraphs: [
          'Pricing for services will be provided prior to work being performed. Any additional work required will be approved by the customer before proceeding. Payment is due upon completion of the work.',
        ],
      },
      {
        icon: 'verified',
        title: 'Warranties',
        paragraphs: [
          'Daddy Bear Plumbing warranties all work for a period of 90 days from the date of completion. This warranty covers labor only and does not include materials or parts used in the repair. Any defects in materials or parts will be covered under the manufacturer\'s warranty.',
        ],
      },
      {
        icon: 'shield',
        title: 'Liability',
        paragraphs: [
          "Daddy Bear Plumbing is not responsible for any damage caused to the customer's property or plumbing system that is not a direct result of our work. The customer is responsible for providing a safe work area and removing any obstacles that may impede the work. Daddy Bear Plumbing is not liable for any damages caused by natural disasters or acts of God.",
        ],
      },
      {
        icon: 'gavel',
        title: 'Code Compliance',
        paragraphs: [
          "All work will be performed in accordance with local building codes and regulations. It is the customer's responsibility to obtain any necessary permits and inspections.",
        ],
      },
      {
        icon: 'event_busy',
        title: 'Cancellation Policy',
        paragraphs: [
          'If the customer needs to cancel an appointment, they must do so at least 24 hours in advance. Failure to do so may result in a cancellation fee.',
        ],
      },
      {
        icon: 'balance',
        title: 'Governing Law',
        paragraphs: [
          'These terms and conditions are governed by the laws of the State of Illinois. Any legal action arising from these terms and conditions will be brought in the courts of the State of Illinois.',
        ],
      },
      {
        icon: 'edit_note',
        title: 'Modification',
        paragraphs: [
          'Daddy Bear Plumbing reserves the right to modify these terms and conditions at any time without notice. Any changes will be posted on this page.',
        ],
      },
      {
        icon: 'description',
        title: 'Entire Agreement',
        paragraphs: [
          'These terms and conditions constitute the entire agreement between Daddy Bear Plumbing and the customer. Any other agreements or representations, verbal or written, are not part of this agreement.',
        ],
      },
    ],
  };
}
