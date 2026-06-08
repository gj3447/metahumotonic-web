// KG: CONTRACT_Web_API
import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  // Longinus drift fix 2026-05-25; counts re-measured 2026-06-08 (post-Occam
  // AI-domain cleanup; old 582,630 was pre-cleanup). Matches llms.txt + backend.
  let stats = { nodes: 90808, rels: 614376, labels: 3249, relTypes: 4682, domains: 13, skills: 17 };
  try {
    const { getKGStats } = await import('../../lib/kg');
    const s = await getKGStats();
    stats = { ...stats, nodes: s.nodes, rels: s.rels, labels: s.labels, relTypes: s.relTypes };
  } catch {}
  return new Response(JSON.stringify(stats), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
};
