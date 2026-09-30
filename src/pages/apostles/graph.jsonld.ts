import { apostleGraph } from '../../lib/apostle-graph';

export const prerender = true;
export const GET = () => new Response(`${JSON.stringify(apostleGraph, null, 2)}\n`, {
  headers: { 'Content-Type': 'application/ld+json; charset=utf-8', 'X-Content-Type-Options': 'nosniff' },
});
