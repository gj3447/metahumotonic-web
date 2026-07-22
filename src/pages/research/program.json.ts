import researchProgram from '../../data/research-programs.json';

export const prerender = true;

export function GET() {
  return new Response(`${JSON.stringify(researchProgram, null, 2)}\n`, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
