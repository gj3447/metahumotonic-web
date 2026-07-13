#!/usr/bin/env node
// emit-build-trace.mjs — ooptdd 측정층 GENERATOR (Node).
//
// `astro build` 가 끝난 뒤 dist/ 산출물과 src/data/kg-snapshot.json 을 *읽어back* 해서,
// 실제로 렌더된 것들을 구조화 이벤트로 build-trace.jsonl(ooptdd JSONL store)에 ship 한다.
// "빌드 exit 0" 자기보고를 믿지 않고 산출물에 실물이 착지했는지 positive 하게 기록.
// VERIFIER 는 Python ooptdd(verify-build-trace.py) — generator≠verifier(교차언어).
//
// 3치 정직: dist/ 부재면 아무것도 ship 안 함(게이트 absent=RED, honest). 크래시 안 함.
//
// KG: project_metahumotonic_web_integrate_core_dev_tech_2026_07_13, web-build-trace-measurement
import { readFile, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(HERE, 'build-trace.jsonl');
const CID = process.env.OOPTDD_CID || 'web-build';
const SERVICE = 'mhb.web.build';

let seq = 0;
const lines = [];
function ship(event, attrs = {}) {
  const ev = { cid: CID, correlation_id: CID, cycle_id: CID, service: SERVICE, event, ...attrs };
  lines.push(JSON.stringify({ _stored_us: Date.now() * 1000, _stored_seq: seq++, ev }));
}

async function exists(p) {
  try { return (await stat(p)).isFile(); } catch { return false; }
}
async function readJson(p) {
  try { return JSON.parse(await readFile(p, 'utf-8')); } catch { return null; }
}

async function main() {
  // dist/ 도달 가능성 확인 — 없으면 빈 store(absent). ship 0 → 게이트 RED(정직).
  let distOk = false;
  try { distOk = (await stat(DIST)).isDirectory(); } catch { distOk = false; }
  if (!distOk) {
    console.error('[emit-build-trace] dist/ 없음 — 먼저 `npm run build`. (빈 트레이스 기록)');
    await writeFile(OUT, '', 'utf-8');
    return;
  }

  // 1) KG 스냅샷이 산출물에 실물로 실렸나 (build fixture read-back)
  const snap = await readJson(path.join(ROOT, 'src/data/kg-snapshot.json'));
  const nodes = snap?.stats?.nodes ?? 0;
  const rels = snap?.stats?.rels ?? 0;
  const domains = Array.isArray(snap?.domains) ? snap.domains.length : 0;
  if (nodes > 0 && domains > 0) {
    ship('kg_snapshot_loaded', { nodes, rels, domains });
  }

  // 2) 12사도 페이지가 dist/ 에 실제 렌더됐나 — 파일 존재 + 비자명 크기 + 이름 실제 포함(내용 착지)
  const apostlesData = await readJson(path.join(ROOT, 'src/data/apostles.json'));
  const apostles = apostlesData?.apostles ?? [];
  let built = 0;
  for (const a of apostles) {
    const page = path.join(DIST, 'apostles', a.slug, 'index.html');
    if (!(await exists(page))) continue;
    const html = await readFile(page, 'utf-8');
    // positive 내용 체크: 페이지에 사도 이름(canon)이 실제로 렌더됐는지 — 빈 셸 아님
    const nameLanded = a.name && html.includes(a.name);
    if (html.length > 500 && nameLanded) {
      ship('apostle_page_built', { id: a.id, slug: a.slug, bytes: html.length });
      built++;
    }
  }

  await writeFile(OUT, lines.join('\n') + (lines.length ? '\n' : ''), 'utf-8');
  console.log(`[emit-build-trace] cid=${CID} → ${OUT}`);
  console.log(`[emit-build-trace] shipped: kg_snapshot_loaded(${nodes} nodes) + apostle_page_built×${built}/${apostles.length}`);
}

main().catch(e => { console.error('[emit-build-trace] error:', e); process.exit(1); });
