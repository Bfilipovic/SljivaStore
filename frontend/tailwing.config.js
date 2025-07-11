// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/routes/**/*.{svelte,ts}',
    './src/lib/**/*.{svelte,ts}',
    './src/app.html', // include entry point (default in SvelteKit)
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
