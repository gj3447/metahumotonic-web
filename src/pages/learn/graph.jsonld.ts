import hub from '../../data/learning-hub.json';
export const GET = () => new Response(JSON.stringify(hub.jsonld), { headers: { 'Content-Type': 'application/ld+json; charset=utf-8', 'X-Hub-Source-Digest': hub.sourceDigest } });
