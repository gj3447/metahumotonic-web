// Compatibility tombstone for the retired 2026-04 infrastructure route map.
// The reviewed public service directory lives at /services/data.json.
export const GET = () => new Response(JSON.stringify({
  retired: true,
  reason: 'The former static infrastructure route map is no longer maintained.',
  replacement: '/services/data.json',
}), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
