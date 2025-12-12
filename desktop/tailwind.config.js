/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // F0 Neon theme colors
        'f0-purple': '#7c3aed',
        'f0-purple-light': '#a78bfa',
        'f0-purple-dark': '#6d28d9',
        'f0-bg-dark': '#050816',
        'f0-bg-darker': '#08001b',
        'f0-border': '#251347',
      },
    },
  },
  plugins: [],
};
