// @ts-check
import 'dotenv/config';
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  output: 'server',

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