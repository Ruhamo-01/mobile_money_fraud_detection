/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Times New Roman"', 'Times', 'serif'],
        mono: ['"JetBrains Mono"', '"Courier New"', 'ui-monospace', 'monospace'],
      },

      /* ── Font sizes mapped to pt equivalents ──
         text-xs  = 12pt  (labels, badges, metadata)
         text-sm  = 14pt  (body text, nav, table data)
         text-base= 16pt  (card titles, section headings)
         text-lg  = 18pt  (dashboard page titles)
         text-xl  = 20pt  (large headings)
         text-2xl = 24pt  (stat values, hero sub-headings)
      ─────────────────────────────────────────── */
      fontSize: {
        'xs':   ['0.75rem',   { lineHeight: '1.4',  letterSpacing: '0' }],   /* 12px / ~9pt  */
        'sm':   ['0.875rem',  { lineHeight: '1.5',  letterSpacing: '0' }],   /* 14px / ~10pt */
        'base': ['1rem',      { lineHeight: '1.55', letterSpacing: '0' }],   /* 16px / 12pt  */
        'lg':   ['1.125rem',  { lineHeight: '1.5',  letterSpacing: '0' }],   /* 18px / ~14pt */
        'xl':   ['1.25rem',   { lineHeight: '1.4',  letterSpacing: '0' }],   /* 20px / 15pt  */
        '2xl':  ['1.5rem',    { lineHeight: '1.3',  letterSpacing: '0' }],   /* 24px / 18pt  */
        '3xl':  ['1.875rem',  { lineHeight: '1.25', letterSpacing: '0' }],   /* 30px */
        '4xl':  ['2.25rem',   { lineHeight: '1.2',  letterSpacing: '-0.01em' }],
        '5xl':  ['3rem',      { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        '6xl':  ['3.75rem',   { lineHeight: '1.1',  letterSpacing: '-0.02em' }],
      },

      colors: {
        brand: {
          50:  '#ecfdf5',
          100: '#d1fae5',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        }
      },
      boxShadow: {
        'brand': '0 4px 24px -4px rgba(16,185,129,0.25)',
      }
    },
  },
  plugins: [],
}
