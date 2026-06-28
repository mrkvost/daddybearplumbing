/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  darkMode: 'class',

  theme: {
    extend: {
      screens: {
        // Navbar-specific breakpoint — switch to burger menu below 890px.
        // Other components keep the default `md:` (768px) etc.
        'nav': '890px',
      },
      colors: {
        // ---- Public-site "Industrial Navy + Safety Orange" palette ----
        // Scoped names so they don't collide with the legacy admin tokens below.
        'navy':                   '#0D2B6B',
        'navy-medium':            '#445c9d',  // design's "secondary" — used for muted-navy accents
        'primary-blue':           '#1E6FEA',
        'primary-orange':         '#FF5A1F',
        'light-blue':             '#5FAEFF',
        'background-light-blue':  '#F4F9FF',
        'light-orange':           '#FF8A4D',
        'soft-orange':            '#FFF2EA',
        // ---- Legacy palette (used by admin + currently every other page) ----
        'primary':                '#000000',
        'primary-fixed':          '#b02f00',
        'primary-fixed-dim':      '#862200',
        'primary-container':      '#731b00',
        'on-primary':             '#ffdbd1',
        'on-primary-fixed':       '#ffffff',
        'on-primary-fixed-variant': '#ffdbd1',
        'on-primary-container':   '#ffffff',
        'secondary':              '#5f5e5e',
        'secondary-fixed':        '#c8c6c5',
        'secondary-fixed-dim':    '#adabaa',
        'secondary-container':    '#d6d4d3',
        'on-secondary':           '#ffffff',
        'on-secondary-container': '#1b1c1c',
        'on-secondary-fixed':     '#1b1c1c',
        'on-secondary-fixed-variant': '#3c3b3b',
        'tertiary':               '#3b3b3c',
        'tertiary-fixed':         '#5e5e5e',
        'tertiary-fixed-dim':     '#464747',
        'tertiary-container':     '#747474',
        'on-tertiary':            '#e3e2e2',
        'on-tertiary-container':  '#ffffff',
        'on-tertiary-fixed':      '#ffffff',
        'on-tertiary-fixed-variant': '#e3e2e2',
        'surface':                '#f9f9f9',
        'surface-dim':            '#dadada',
        'surface-bright':         '#f9f9f9',
        'surface-variant':        '#e2e2e2',
        'surface-container-lowest': '#ffffff',
        'surface-container-low':  '#f3f3f3',
        'surface-container':      '#eeeeee',
        'surface-container-high': '#e8e8e8',
        'surface-container-highest': '#e2e2e2',
        'surface-tint':           '#b02f00',
        'on-surface':             '#1a1c1c',
        'on-surface-variant':     '#474747',
        'on-background':          '#1a1c1c',
        'background':             '#f9f9f9',
        'outline':                '#777777',
        'outline-variant':        '#c6c6c6',
        'inverse-surface':        '#2f3131',
        'inverse-on-surface':     '#f1f1f1',
        'inverse-primary':        '#ffb5a0',
        'error':                  '#ba1a1a',
        'on-error':               '#ffffff',
        'error-container':        '#ffdad6',
        'on-error-container':     '#410002',
      },
      // Public-site "Industrial Navy" design uses Hanken Grotesk (display) +
      // Work Sans (body). Public Sans + Inter remain in the fallback stack so the
      // admin (which has its own typography rhythm) still degrades gracefully.
      fontFamily: {
        headline: ['Hanken Grotesk', 'Public Sans', 'sans-serif'],
        body:     ['Work Sans', 'Inter', 'sans-serif'],
        label:    ['Hanken Grotesk', 'Inter', 'sans-serif'],
      },
      // Restored to match the public-site "Soft-Industrial" design.
      // (Legacy admin / non-home pages don't use any non-`full` rounded classes,
      //  so re-enabling these values doesn't affect them.)
      borderRadius: {
        sm:      '0.125rem',
        DEFAULT: '0.25rem',
        md:      '0.375rem',
        lg:      '0.5rem',
        xl:      '0.75rem',
        '2xl':   '1rem',
        '3xl':   '1.5rem',
        full:    '9999px',
      },
    },
  },

  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries'),
  ],
};
