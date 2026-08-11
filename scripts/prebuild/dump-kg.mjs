#!/usr/bin/env node
// dump-kg.mjs — Bolt 접근 가능한 호스트(Mac 등)에서 실행해 src/data/kg-snapshot.json 갱신.
// 사용: NEO4J_BOLT=bolt://... NEO4J_USER=neo4j NEO4J_PASS=... node scripts/prebuild/dump-kg.mjs
import neo4j from 'neo4j-driver';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BOLT = process.env.NEO4J_BOLT || 'bolt://localhost:7687';
const USER = process.env.NEO4J_USER || 'neo4j';
const PASS = process.env.NEO4J_PASS;

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

// 체크아웃 위치에 종속되지 않는 레포 상대경로로 정규화한다.
// 2026-08-11: 기존 구현은 /Users/<x>/CD/ (macmini) 만 처리해서
// dev-01 형태 /home/<x>/CD/ 경로 약 1,562개가 미정규화로 출력됐다.
// KG 에는 sourcePathRepoRelative 가 이미 채워져 있으므로(1,628개)
// 장기적으로는 이 함수 대신 그 속성을 쿼리에서 읽는 것이 정본이다.
const CHECKOUT_ROOTS = [
  /^\/home\/[^/]+\/CD\//,
  /^\/Users\/[^/]+\/CD\//,
  /^Users\/[^/]+\/CD\//,   // 선행 슬래시가 누락된 형태
];

function publicSourcePath(sourcePath) {
  if (typeof sourcePath !== 'string') return sourcePath;
  for (const re of CHECKOUT_ROOTS) {
    if (re.test(sourcePath)) return sourcePath.replace(re, '');
  }
  return sourcePath;
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
  if (!PASS) {
    throw new Error('NEO4J_PASS is required; no default credentials are provided');
  }
  const driver = neo4j.driver(BOLT, neo4j.auth.basic(USER, PASS));
  const session = driver.session();
  try {
    console.log('[dump-kg] connecting to', BOLT);

    // Scalar counts: nodes + rels + distinct labels + distinct relationship types.
    // labels/relTypes feed ConceptProgram #02 + VOID dataset stats (Longinus drift fix 2026-05-25).
    const [stats] = await run(session, `
      CALL db.labels() YIELD label
      WITH count(label) AS labels
      CALL db.relationshipTypes() YIELD relationshipType
      WITH labels, count(relationshipType) AS relTypes
      MATCH (n) WITH labels, relTypes, count(n) AS nodes
      MATCH ()-[r]->() RETURN labels, relTypes, nodes, count(r) AS rels
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

    // Apostle anchors — per-Apostle :HAS_REFERENCE_SITE collect
    // KG: CONTRACT_KGAnchorBox_v1, contract-kg-anchor-v1-2026-05-22
    const apostleAnchors = {};
    const apostleRows = await run(session, `
      MATCH (a:Apostle)-[:HAS_REFERENCE_SITE]->(rs:ReferenceSite)
      WITH toInteger(a.id) AS id, a.name AS name,
           collect({
             id: rs.id,
             layer: rs.layer,
             sha256_prefix: substring(rs.sha256, 0, 8),
             last_validated: toString(rs.last_validated),
             source_path: rs.sourcePath
           }) AS anchors
      RETURN id, name, anchors
      ORDER BY id
    `);
    for (const r of apostleRows) {
      apostleAnchors[String(r.id)] = {
        name: r.name,
        anchors: r.anchors.map(anchor => ({
          ...anchor,
          source_path: publicSourcePath(anchor.source_path),
        })),
      };
    }
    console.log(`[dump-kg] apostle anchors: ${Object.keys(apostleAnchors).length} apostles`);

    // Apostle canon fields — canonical_meaning + mythology_referent_v2 + role + essence_v4
    // KG: CONTRACT_CanonFieldSurface_v1, contract-canon-field-v1-2026-05-22
    const apostleCanon = {};
    const canonRows = await run(session, `
      MATCH (a:Apostle)
      RETURN toInteger(a.id) AS id,
             a.canonical_meaning AS canonical_meaning,
             a.mythology_referent_v2_2026_05_22 AS mythology_referent_v2,
             a.role AS role,
             a.essence_v4 AS essence_v4
      ORDER BY id
    `);
    for (const r of canonRows) {
      apostleCanon[String(r.id)] = {
        canonical_meaning: r.canonical_meaning,
        mythology_referent_v2: r.mythology_referent_v2,
        role: r.role,
        essence_v4: r.essence_v4,
      };
    }
    const canonCount = canonRows.filter(r => r.canonical_meaning || r.mythology_referent_v2 || r.role || r.essence_v4).length;
    console.log(`[dump-kg] apostle canon fields: ${canonCount}/12 apostles have ≥1 surface field`);

    const snapshot = {
      _meta: {
        generatedAt: new Date().toISOString(),
        source: `neo4j (${BOLT}) via dump-kg.mjs`,
        note: 'Build-time fixture. Refresh: `npm run prebuild:kg`.',
      },
      stats,
      domains,
      domainDetails,
      apostleAnchors,
      apostleCanon,
    };

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const outPath = path.resolve(__dirname, '../../src/data/kg-snapshot.json');
    await writeFile(outPath, JSON.stringify(snapshot, null, 2) + '\n', 'utf-8');
    console.log('[dump-kg] wrote', outPath);

    // Sync apostles.json with 4 canon keys (idempotent merge — keeps other fields)
    // KG: CONTRACT_CanonFieldSurface_v1
    const apostlesPath = path.resolve(__dirname, '../../src/data/apostles.json');
    const apostlesData = JSON.parse(await (await import('node:fs/promises')).readFile(apostlesPath, 'utf-8'));
    for (const a of apostlesData.apostles) {
      const canon = apostleCanon[String(a.id)] || {};
      if (canon.canonical_meaning != null) a.canonical_meaning = canon.canonical_meaning;
      if (canon.mythology_referent_v2 != null) a.mythology_referent_v2 = canon.mythology_referent_v2;
      if (canon.role != null) a.role = canon.role;
      if (canon.essence_v4 != null) a.essence_v4 = canon.essence_v4;
    }
    apostlesData._meta = apostlesData._meta || {};
    apostlesData._meta.canon_synced_at = new Date().toISOString();
    apostlesData._meta.canon_synced_via = 'dump-kg.mjs apostleCanon';
    await writeFile(apostlesPath, JSON.stringify(apostlesData, null, 2) + '\n', 'utf-8');
    console.log('[dump-kg] synced apostles.json 4 canon keys');

    console.log(`[dump-kg] stats: ${stats.nodes} nodes, ${stats.rels} rels, ${domains.length} hubs, ${Object.keys(apostleAnchors).length} apostle anchors, ${canonCount}/12 canon surface`);
  } finally {
    await session.close();
    await driver.close();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
