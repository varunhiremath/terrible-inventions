/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      /*
       * A phone on its side.
       *
       * Not `landscape:`, which is true of a tablet with plenty of room. What
       * the layouts actually need to know is that there is very little height
       * — 360 or 412 pixels of it — because that is what pushed the fourth
       * answer of a question off the bottom of the screen.
       */
      screens: {
        short: { raw: '(max-height: 540px)' },
      },
      colors: {
        ink: { DEFAULT: '#14161f', soft: '#1d2030', line: '#2c3145' },
        bolt: '#ffc84a',
        rust: '#ff6b53',
        moss: '#4ade80',
        sky: '#58b9ff',
        chalk: '#e8ebf5',
        dim: '#8a91ab',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        block: '0 4px 0 0 rgba(0,0,0,0.45)',
        'block-sm': '0 3px 0 0 rgba(0,0,0,0.45)',
      },
    },
  },
  plugins: [],
}
