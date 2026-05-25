// KG: CONTRACT_SkillPortal_LandingAPIs
// Static service route map — embedded at build time
// Source of truth: CLAUDE.md routemap-metahumotonic-2026-04-10 + skill-portal additions
import type { APIRoute } from 'astro';

interface ServiceRecord {
  name: string;
  type: 'path' | 'host';
  url: string;
  description: string;
  public: boolean;
  namespace?: string;
}

const BASE = 'https://metahumotonic.com';
const API_BASE = 'https://api.metahumotonic.com';

const services: ServiceRecord[] = [
  // ── public ──────────────────────────────────────────────────────────────
  {
    name: 'Landing Site',
    type: 'host',
    url: BASE + '/',
    description: 'MetaHumotonic home — KG + skills + infra',
    public: true,
    namespace: 'infra',
  },
  {
    name: 'Skill Registry',
    type: 'path',
    url: BASE + '/skills/',
    description: 'Claude Code skill registry (read-only)',
    public: true,
    namespace: 'apps',
  },
  {
    name: 'Skill Portal API',
    type: 'host',
    url: API_BASE + '/api/v1/',
    description: 'Skill upload CRUD — POST /api/v1/skills/upload (X-API-Key)',
    public: true,
    namespace: 'apps',
  },
  {
    name: 'AI Plugin Manifest',
    type: 'path',
    url: BASE + '/.well-known/ai-plugin.json',
    description: 'OpenAI-compatible plugin manifest',
    public: true,
    namespace: 'apps',
  },
  {
    name: 'MCP Discovery',
    type: 'path',
    url: BASE + '/.well-known/mcp.json',
    description: 'MCP server list for agent tool discovery',
    public: true,
    namespace: 'apps',
  },
  {
    name: 'Server Info',
    type: 'path',
    url: BASE + '/.well-known/server-info.json',
    description: 'Full service catalogue JSON',
    public: true,
    namespace: 'apps',
  },

  // ── protected (BasicAuth) ────────────────────────────────────────────────
  {
    name: 'Infra Portal',
    type: 'path',
    url: BASE + '/infra/',
    description: 'Infrastructure management dashboard',
    public: false,
    namespace: 'infra',
  },
  {
    name: 'Neo4j Browser',
    type: 'path',
    url: BASE + '/neo4j/',
    description: 'Knowledge graph browser. Cypher query console.',
    public: false,
    namespace: 'data',
  },
  {
    name: 'n8n Workflows',
    type: 'path',
    url: BASE + '/n8n/',
    description: 'Workflow automation',
    public: false,
    namespace: 'apps',
  },
  {
    name: 'MinIO Console',
    type: 'path',
    url: BASE + '/minio/',
    description: 'Object storage console',
    public: false,
    namespace: 'data',
  },
  {
    name: 'Grafana',
    type: 'path',
    url: BASE + '/grafana/',
    description: 'Metrics and observability',
    public: false,
    namespace: 'monitoring',
  },
  {
    name: 'Prometheus',
    type: 'path',
    url: BASE + '/prometheus/',
    description: 'Metrics scraping',
    public: false,
    namespace: 'monitoring',
  },
  {
    name: 'Alertmanager',
    type: 'path',
    url: BASE + '/alertmanager/',
    description: 'Alert routing',
    public: false,
    namespace: 'monitoring',
  },
  {
    name: 'Kafka UI',
    type: 'path',
    url: BASE + '/kafka/',
    description: 'Kafka topic management',
    public: false,
    namespace: 'data',
  },
  {
    name: 'Ollama LLM',
    type: 'path',
    url: BASE + '/ollama/',
    description: 'Local GPU LLM inference (dgx-worker)',
    public: false,
    namespace: 'ai',
  },
  {
    name: 'Mongo Express',
    type: 'path',
    url: BASE + '/mongo/',
    description: 'MongoDB admin (BasicAuth)',
    public: false,
    namespace: 'data',
  },
  {
    name: 'pgAdmin',
    type: 'path',
    url: BASE + '/pgadmin/',
    description: 'PostgreSQL admin',
    public: false,
    namespace: 'data',
  },
  {
    name: 'Redis Insight',
    type: 'path',
    url: BASE + '/redis/',
    description: 'Redis browser',
    public: false,
    namespace: 'data',
  },
  {
    name: '333 Signaling',
    type: 'path',
    url: BASE + '/ws333/',
    description: 'WebRTC signaling server',
    public: false,
    namespace: 'apps',
  },

  // ── host-based ───────────────────────────────────────────────────────────
  {
    name: 'Neo4j Bolt',
    type: 'host',
    url: 'bolt+s://bolt.metahumotonic.com:443',
    description: 'Neo4j Bolt over TLS (MCP / driver)',
    public: false,
    namespace: 'data',
  },
  {
    name: 'MinIO S3',
    type: 'host',
    url: 'https://s3.metahumotonic.com',
    description: 'MinIO S3-compatible object storage API',
    public: false,
    namespace: 'data',
  },
  {
    name: 'Headscale',
    type: 'host',
    url: 'https://headscale.metahumotonic.com',
    description: 'Self-hosted Tailscale VPN control plane',
    public: false,
    namespace: 'infra',
  },
];

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify(services), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
};
