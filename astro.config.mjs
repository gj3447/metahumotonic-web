// @ts-check
// KG: CONTRACT_Web_AstroSetup
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://metahumotonic.com',
  output: 'static',
  vite: {
    css: {
      postcss: {
        plugins: [],
      },
    },
  },
});
