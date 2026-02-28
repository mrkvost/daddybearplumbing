/** @type {import('tailwindcss').Config} */
module.exports = {
  // content: tells Tailwind which files to scan for class names.
  // It only includes CSS for classes it actually finds here — nothing unused.
  content: ['./src/**/*.{html,ts}'],

  // darkMode: 'class' means dark: utilities activate when a parent element
  // has the class "dark" — e.g. <html class="dark">. Toggle it with JS.
  darkMode: 'class',

  theme: {
    extend: {
      // Custom colors — generates bg-primary, text-accent, etc.
      colors: {
        primary:            '#1a4731', // Dark green
        accent:             '#f97316', // Orange
        'background-light': '#f6f6f8',
        'background-dark':  '#101622',
      },
      // Custom font family — generates font-display utility class
      fontFamily: {
        display: ['Public Sans', 'sans-serif'],
      },
      // Custom border radius — generates rounded, rounded-lg, etc.
      borderRadius: {
        DEFAULT: '0.25rem',
        lg:      '0.5rem',
        xl:      '0.75rem',
        full:    '9999px',
      },
    },
  },

  plugins: [
    // Resets browser form element styles so they can be styled with utilities
    require('@tailwindcss/forms'),
    // Enables @container responsive variants
    require('@tailwindcss/container-queries'),
  ],
};
