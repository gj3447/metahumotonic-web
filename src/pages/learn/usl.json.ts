import hub from '../../data/learning-hub.json';
export const GET = () => new Response(JSON.stringify(hub.usl), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Hub-Source-Digest': hub.sourceDigest } });
