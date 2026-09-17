/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  corePlugins: {
    // Disable preflight so Tailwind doesn't reset MUI global styles
    preflight: false,
  },
  theme: {
    extend: {},
  },
  plugins: [],
}
