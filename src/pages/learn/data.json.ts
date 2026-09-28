import hub from '../../data/learning-hub.json';
export const GET = () => {
  const { jsonld, usl, ...catalog } = hub;
  return new Response(JSON.stringify(catalog), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Hub-Source-Digest': hub.sourceDigest } });
};
