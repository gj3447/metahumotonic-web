import { publicWikiProjection } from '../../lib/wiki';

export const prerender = true;

export function GET() {
  return new Response(`${JSON.stringify(publicWikiProjection, null, 2)}\n`, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
