// KG: CONTRACT_Web_CosmosTheme
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        cosmos: {
          void: '#050810',
          deep: '#0D1B2A',
          navy: '#132B43',
          purple: '#6B4C99',
          magenta: '#D946A1',
          cyan: '#00CED1',
          starlight: '#F5F5DC',
          gold: '#FFD700',
          pink: '#f472b6',
          lavender: '#a78bfa',
          ice: '#67e8f9',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      }
    },
  },
  plugins: [],
};
