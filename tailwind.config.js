/** @type {import('tailwindcss').Config} */

const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  darkMode: 'class',
  content: ['src/pages/**/*.tsx', 'src/components/**/*.tsx'],
  theme: {
    screens: {
      xs: '500px',
      ...defaultTheme.screens
    },
    extend: {
      height: {
        app: 'var(--app-height, 100vh)',
        'app-nav': 'calc(var(--app-height, 100vh) - 3.5rem)'
      },
      minHeight: {
        app: 'var(--app-height, 100vh)'
      },
      maxHeight: {
        app: 'var(--app-height, 100vh)'
      },
      fontFamily: {
        aite: [
          '"IBM Plex Sans Arabic"',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
          '"Noto Color Emoji"'
        ],
        'aite-extended': [
          '"IBM Plex Sans Arabic"',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
          '"Noto Color Emoji"'
        ]
      },
      // prettier-ignore
      colors: {
        'main-primary': 'rgb(var(--main-primary) / <alpha-value>)',
        'main-secondary': 'rgb(var(--main-secondary) / <alpha-value>)',
        'main-background': 'rgb(var(--main-background) / <alpha-value>)',
        'main-search-background': 'rgb(var(--main-search-background) / <alpha-value>)',
        'main-sidebar-background': 'rgb(var(--main-sidebar-background) / <alpha-value>)',
        'main-accent': 'rgb(var(--main-accent) / <alpha-value>)',
        'main-accent-contrast': 'rgb(var(--main-accent-contrast) / <alpha-value>)',
        'main-accent-text': 'rgb(var(--main-accent-text) / <alpha-value>)',
        'accent-yellow': 'rgb(var(--accent-yellow) / <alpha-value>)',
        'accent-yellow-contrast': 'rgb(var(--accent-yellow-contrast) / <alpha-value>)',
        'accent-blue-contrast': 'rgb(var(--accent-blue-contrast) / <alpha-value>)',
        'accent-pink-contrast': 'rgb(var(--accent-pink-contrast) / <alpha-value>)',
        'accent-purple-contrast': 'rgb(var(--accent-purple-contrast) / <alpha-value>)',
        'accent-orange-contrast': 'rgb(var(--accent-orange-contrast) / <alpha-value>)',
        'accent-green-contrast': 'rgb(var(--accent-green-contrast) / <alpha-value>)',
        'accent-blue': 'rgb(var(--accent-blue) / <alpha-value>)',
        'accent-pink': 'rgb(var(--accent-pink) / <alpha-value>)',
        'accent-purple': 'rgb(var(--accent-purple) / <alpha-value>)',
        'accent-orange': 'rgb(var(--accent-orange) / <alpha-value>)',
        'accent-green': 'rgb(var(--accent-green) / <alpha-value>)',
        'accent-red': '#F4212E',
        'dark-primary': '#E7E9EA',
        'dark-secondary': '#71767B',
        'light-primary': '#0F1419',
        'light-secondary': '#536471',
        'dark-border': '#2F3336',
        'light-border': '#EFF3F4',
        'dark-line-reply': '#333639',
        'light-line-reply': '#CFD9DE',
        'brand-icon': '#FFFFFF',
        'image-preview-hover': '#272C30',
      }
    }
  },
  plugins: [
    ({ addVariant }) => {
      addVariant('inner', '& > *');
    }
  ]
};
