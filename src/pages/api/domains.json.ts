// KG: CONTRACT_Web_API
import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  let domains: any[] = [];
  try {
    const { getDomains } = await import('../../lib/kg');
    domains = await getDomains();
  } catch {}
  if (!domains.length) {
    domains = [
      { name:'domain-personal', displayName:'Personal', nodeCount:1200 },
      { name:'domain-math-physics', displayName:'Math & Physics', nodeCount:5346 },
      { name:'domain-cs', displayName:'Computer Science', nodeCount:3200 },
      { name:'domain-infra', displayName:'Infrastructure', nodeCount:2844 },
      { name:'domain-ai', displayName:'Artificial Intelligence', nodeCount:4200 },
      { name:'domain-apt', displayName:'APT Methodology', nodeCount:1500 },
      { name:'domain-literature', displayName:'Literature & Writing', nodeCount:2100 },
      { name:'domain-religion', displayName:'Religion & Theology', nodeCount:1800 },
      { name:'domain-philosophy', displayName:'Philosophy', nodeCount:1100 },
      { name:'domain-community', displayName:'Community', nodeCount:900 },
      { name:'domain-business', displayName:'Business & Career', nodeCount:800 },
      { name:'domain-health', displayName:'Health & Biology', nodeCount:700 },
      { name:'domain-streaming', displayName:'Streaming & Media', nodeCount:600 },
    ];
  }
  return new Response(JSON.stringify(domains), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
};
