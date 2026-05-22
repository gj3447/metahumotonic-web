#!/usr/bin/env node
// dump-kg.mjs — Bolt 접근 가능한 호스트(Mac 등)에서 실행해 src/data/kg-snapshot.json 갱신.
// 사용: NEO4J_BOLT=bolt://... NEO4J_USER=neo4j NEO4J_PASS=... node scripts/prebuild/dump-kg.mjs
import neo4j from 'neo4j-driver';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BOLT = process.env.NEO4J_BOLT || 'bolt://localhost:7687';
const USER = process.env.NEO4J_USER || 'neo4j';
const PASS = process.env.NEO4J_PASS || 'neo4jpassword';

const LABEL_MAP = {
  'domain-hub-ai': 'KG_AI',
  'domain-hub-sym': 'KG_SYM',
  'domain-hub-reference': 'KG_REFERENCE',
  'domain-hub-cs': 'KG_CS',
  'domain-hub-projects': 'KG_PROJECTS',
  'domain-hub-infra': 'KG_INFRA',
  'domain-hub-creative': 'KG_CREATIVE',
  'domain-hub-apt': 'KG_APT',
  'domain-hub-import': 'KG_Import',
  'domain-hub-orphan': 'KG_ORPHAN',
  'domain-hub-333': 'KG_333',
  'domain-hub-imported': 'KG_Imported',
  'domain-hub-unlabeled': 'KG_UNLABELED',
};

function toJS(v) {
  if (v == null) return v;
  if (typeof v?.toNumber === 'function') return v.toNumber();
  if (Array.isArray(v)) return v.map(toJS);
  if (typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v)) o[k] = toJS(v[k]);
    return o;
  }
  return v;
}

async function run(session, cypher, params = {}) {
  const result = await session.run(cypher, params);
  return result.records.map(r => {
    const obj = {};
    r.keys.forEach(k => { obj[k] = toJS(r.get(k)); });
    return obj;
  });
}

async function main() {
  const driver = neo4j.driver(BOLT, neo4j.auth.basic(USER, PASS));
  const session = driver.session();
  try {
    console.log('[dump-kg] connecting to', BOLT);

    const [stats] = await run(session, `
      MATCH (n) WITH count(n) as nodes
      MATCH ()-[r]->() WITH nodes, count(r) as rels
      RETURN nodes, rels
    `);

    const domains = await run(session, `
      MATCH (d:DomainHub)
      RETURN d.name as name, d.displayName as displayName,
             d.nodeCount as nodeCount, d.description as description
      ORDER BY d.nodeCount DESC
    `);

    const domainDetails = {};
    for (const d of domains) {
      const kgLabel = LABEL_MAP[d.name] || '';
      console.log(`[dump-kg] detail: ${d.name} -> ${kgLabel}`);
      const topLabels = await run(session, `
        MATCH (n) WHERE $label IN labels(n)
        WITH [l IN labels(n) WHERE l <> $label] as lbls
        UNWIND lbls as lbl
        WITH lbl, count(*) as cnt
        RETURN lbl, cnt ORDER BY cnt DESC LIMIT 15
      `, { label: kgLabel });
      const topRelTypes = await run(session, `
        MATCH (n)-[r]->(m) WHERE $label IN labels(n)
        WITH type(r) as relType, count(*) as cnt
        RETURN relType, cnt ORDER BY cnt DESC LIMIT 10
      `, { label: kgLabel });
      const sampleNodes = await run(session, `
        MATCH (n) WHERE $label IN labels(n) AND n.description IS NOT NULL AND size(n.description) > 20
        RETURN n.name as name, [l IN labels(n) WHERE l <> $label][0] as type,
               substring(n.description, 0, 150) as desc
        ORDER BY rand() LIMIT 8
      `, { label: kgLabel });
      const crossDomain = await run(session, `
        MATCH (b:CrossDomainBridge)-[:BRIDGES]->(d:DomainHub {name: $name})
        MATCH (b)-[:BRIDGES]->(other:DomainHub)
        WHERE other.name <> $name
        RETURN other.name as otherDomain, other.displayName as otherDisplay,
               b.name as bridge, b.description as bridgeDesc
        LIMIT 5
      `, { name: d.name });
      domainDetails[d.name] = { topLabels, topRelTypes, sampleNodes, crossDomain };
    }

    const snapshot = {
      _meta: {
        generatedAt: new Date().toISOString(),
        source: `neo4j (${BOLT}) via dump-kg.mjs`,
        note: 'Build-time fixture. Refresh: `npm run prebuild:kg`.',
      },
      stats,
      domains,
      domainDetails,
    };

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const outPath = path.resolve(__dirname, '../../src/data/kg-snapshot.json');
    await writeFile(outPath, JSON.stringify(snapshot, null, 2) + '\n', 'utf-8');
    console.log('[dump-kg] wrote', outPath);
    console.log(`[dump-kg] stats: ${stats.nodes} nodes, ${stats.rels} rels, ${domains.length} hubs`);
  } finally {
    await session.close();
    await driver.close();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
