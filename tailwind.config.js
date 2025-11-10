/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        charcoal: {
          900: '#0b0c10',
          800: '#111217',
          700: '#1a1c24',
          600: '#232633',
          500: '#2b2f3f',
        },
        ralph: {
          pink: '#EB008B',
          teal: '#31BDBF',
          purple: '#8a63ff',
          cyan: '#3be8ff',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', 'Inter', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'Noto Sans', 'Apple Color Emoji', 'Segoe UI Emoji'],
      },
      boxShadow: {
        glow: '0 0 0 2px rgba(235, 0, 139, 0.35), 0 0 24px rgba(49, 189, 191, 0.2)',
      },
      backgroundImage: {
        'grid-charcoal': 'linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)',
      },
      backgroundSize: {
        'grid-24': '24px 24px',
      },
    },
  },
  plugins: [],
}
