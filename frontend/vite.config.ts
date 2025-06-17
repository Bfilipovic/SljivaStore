import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: {
    proxy: {
      '/nfts': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        // optional: rewrite path if needed
        // rewrite: (path) => path
      }
    }
  }
});
