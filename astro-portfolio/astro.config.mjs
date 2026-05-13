// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  integrations: [
    // React islands — only the ProjectGallery component is hydrated client-side.
    // All other pages remain pure static HTML with zero framework JS.
    react(),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
