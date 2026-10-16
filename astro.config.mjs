import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://cscjeventos.com.br',
  output: 'static',
  trailingSlash: 'never',
  prefetch: true,
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/404'),
    }),
  ],
  build: {
    inlineStylesheets: 'always',
    format: 'file',
  },
  server: {
    port: 4321,
  },
  vite: { plugins: [tailwindcss()] },
});
