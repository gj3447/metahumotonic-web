import academicFoundations from '../../data/academic-foundations.json';

export const prerender = true;

const LEAK = /(SYMPOSIUM\/|\/Users\/|\/Volumes\/)/;
if (LEAK.test(JSON.stringify(academicFoundations))) {
  throw new Error('private path leaked into public foundations.json');
}

export function GET() {
  return new Response(`${JSON.stringify(academicFoundations, null, 2)}\n`, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
