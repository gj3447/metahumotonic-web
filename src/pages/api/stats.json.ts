// KG: CONTRACT_Web_API
import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  let stats = { nodes: 547552, rels: 1062014, domains: 13, skills: 18 };
  try {
    const { getKGStats } = await import('../../lib/kg');
    const s = await getKGStats();
    stats = { ...stats, nodes: s.nodes, rels: s.rels };
  } catch {}
  return new Response(JSON.stringify(stats), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
};
