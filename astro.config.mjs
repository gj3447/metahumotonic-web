// @ts-check
// KG: CONTRACT_Web_AstroSetup
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import { wikiSidebar } from './src/lib/wiki.ts';

export default defineConfig({
  site: 'https://metahumotonic.com',
  output: 'static',
  integrations: [
    starlight({
      title: 'MetaHumotonic Wiki',
      description: 'MetaHumotonic KG의 공개 정전 투영',
      disable404Route: true,
      credits: true,
      favicon: '/favicon.svg',
      locales: {
        root: { label: '한국어', lang: 'ko' },
      },
      customCss: ['/src/styles/wiki.css'],
      components: {
        SiteTitle: './src/components/wiki/WikiSiteTitle.astro',
      },
      sidebar: wikiSidebar,
      social: [
        {
          icon: 'github',
          label: 'MetaHumotonic GitHub',
          href: 'https://github.com/gj3447/metahumotonic-web',
        },
      ],
    }),
  ],
  vite: {
    css: {
      postcss: {
        plugins: [],
      },
    },
  },
});
