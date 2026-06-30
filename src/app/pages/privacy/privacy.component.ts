import { Component } from '@angular/core';
import { LegalPageComponent, LegalPageContent } from '../../components/legal-page/legal-page.component';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [LegalPageComponent],
  templateUrl: './privacy.component.html',
})
export class PrivacyComponent {
  data: LegalPageContent = {
    title: 'Privacy',
    titleAccent: 'Policy',
    lastAmended: 'Last amended: April 2026',
    intro: 'At Daddy Bear Plumbing, we value and respect the privacy of our website users. This Privacy Policy explains the types of personal information that we collect from users, how we use it, and how we keep it secure.',
    sections: [
      {
        icon: 'person_search',
        title: 'Information Collection and Use',
        paragraphs: [
          'We may collect personal information from users, such as their name, email address, phone number, and home address, when they submit a form on our website or contact us via email or phone.',
          'We use this information to provide users with the services they requested and to keep them updated about our offers, promotions, and events.',
        ],
      },
      {
        icon: 'lock',
        title: 'Data Security',
        paragraphs: [
          'Daddy Bear Plumbing takes reasonable precautions to protect the personal information we collect from users. We use industry-standard security measures to prevent unauthorized access, disclosure, alteration, or destruction of personal information.',
          'However, no method of data transmission or storage can be guaranteed 100% secure.',
        ],
      },
      {
        icon: 'share',
        title: 'Disclosure of Personal Information',
        paragraphs: [
          "We do not sell, trade, or otherwise transfer users' personal information to outside parties. We may share personal information with trusted partners and contractors only to the extent necessary for service performance.",
          'We may disclose personal information if required by law or to protect rights, property, or safety.',
        ],
      },
      {
        icon: 'sms',
        title: 'SMS Consent and Phone Number Privacy',
        paragraphs: [
          'Phone numbers and SMS consent will not be shared with third parties under any circumstances. We may use your phone number to contact you via SMS only if you have provided explicit consent.',
        ],
      },
      {
        icon: 'business',
        title: 'Third-Party Providers',
        paragraphs: ['We do not work with third-party marketing organizations.'],
      },
      {
        icon: 'history_edu',
        title: 'Changes to This Policy',
        paragraphs: [
          'Daddy Bear Plumbing reserves the right to update this Privacy Policy at any time without prior notice. Changes will be posted on this page.',
        ],
      },
    ],
  };
}
