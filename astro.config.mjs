// @ts-check
import 'dotenv/config';
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  output: 'server',

  // canonical urls, and the base sitemap/robots tooling assume, resolve against this.
  site: 'https://spagency.theindiebrand.es',

  server: {
    port: Number(process.env.PORT) || 4321
  },

  vite: {
    plugins: [tailwindcss()]
  },

  adapter: node({
    mode: 'middleware'
  })
});