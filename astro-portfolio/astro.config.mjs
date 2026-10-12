// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  // Canonical origin: absolute URLs for canonical links, Open Graph and the sitemap (src/data/site.ts).
  site: 'https://stephenlyons.dev',
  output: 'static',
  integrations: [
    // React islands — only the skill graph (about) is hydrated client-side.
    // All other pages remain pure static HTML with zero framework JS.
    react(),
  ],
});
