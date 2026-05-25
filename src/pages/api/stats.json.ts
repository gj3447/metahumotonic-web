// KG: CONTRACT_Web_API
import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  // Longinus drift fix 2026-05-25: fallback도 snapshot 기준선으로 동기 + labels/relTypes 노출.
  let stats = { nodes: 582630, rels: 1104948, labels: 3095, relTypes: 4498, domains: 13, skills: 18 };
  try {
    const { getKGStats } = await import('../../lib/kg');
    const s = await getKGStats();
    stats = { ...stats, nodes: s.nodes, rels: s.rels, labels: s.labels, relTypes: s.relTypes };
  } catch {}
  return new Response(JSON.stringify(stats), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
};
