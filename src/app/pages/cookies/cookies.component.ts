import { Component } from '@angular/core';
import { LegalPageComponent, LegalPageContent } from '../../components/legal-page/legal-page.component';

@Component({
  selector: 'app-cookies',
  standalone: true,
  imports: [LegalPageComponent],
  templateUrl: './cookies.component.html',
})
export class CookiesComponent {
  data: LegalPageContent = {
    title: 'Cookies',
    intro: 'A cookie is a small piece of data that a website asks your browser to store on your device in order to remember information about you — your language preference, login state, or analytics signals. Cookies set by us are first-party cookies; cookies set from a different domain (for example, an analytics provider we use) are third-party cookies.',
    sections: [
      {
        icon: 'gpp_maybe',
        title: 'Strictly Necessary Cookies',
        paragraphs: [
          'These cookies are necessary for the website to function and cannot be switched off in our systems. They are usually only set in response to actions made by you, such as setting your privacy preferences, logging in, or filling in forms. These cookies do not store any personally identifiable information.',
        ],
      },
      {
        icon: 'settings_suggest',
        title: 'Functional Cookies',
        paragraphs: [
          'These cookies enable the website to provide enhanced functionality and personalization. They may be set by us or by third-party providers whose services we have added to our pages. If you do not allow these cookies, some or all of these services may not function properly.',
        ],
      },
      {
        icon: 'insights',
        title: 'Performance Cookies',
        paragraphs: [
          'These cookies allow us to count visits and traffic sources so we can measure and improve the performance of our site. They help us to know which pages are the most and least popular and see how visitors move around the site. All information these cookies collect is aggregated and therefore anonymous.',
        ],
      },
      {
        icon: 'ads_click',
        title: 'Targeting Cookies',
        paragraphs: [
          'These cookies may be set through our site by our advertising partners. They may be used by those companies to build a profile of your interests and show you relevant adverts on other sites. They do not store directly personal information, but are based on uniquely identifying your browser and internet device. If you do not allow these cookies, you will experience less targeted advertising.',
        ],
      },
    ],
  };
}
