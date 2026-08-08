import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = {
  // Starlight owns the wiki presentation shell. Public KG documents are
  // rendered by typed Astro routes, so this collection is intentionally empty.
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
};
