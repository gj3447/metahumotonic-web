#!/usr/bin/env node
// KG: ATOM_PathHygiene_Adapter
// 경로 위생 어댑터 — 부수효과를 stdin/stdout 으로만 제한한다.
// Neo4j 접속을 의도적으로 하지 않는다: 자격증명(NEO4J_PASS)을 이 경로로 끌어들이지 않고,
// 조회는 자격증명 보유자가 담당한다. 순수 판정·렌더는 src/lib/path-hygiene 가 소유.
//
// 사용:
//   node scripts/path-hygiene/report.mjs < rows.json
//   node scripts/path-hygiene/report.mjs --now 2026-08-11T17:00:00+09:00 < rows.json
//   node scripts/path-hygiene/report.mjs --json < rows.json   # BatchReport 를 JSON 으로
//
// 입력 형식: PathRow[] — [{ "nodeId": "...", "property": "file_path", "value": "..." }, ...]
//
// 행을 만드는 정본 쿼리(자격증명 보유자가 실행).
// 분모를 좁힌 이유(2026-08-11 전수조사): file_path 5,524개 중 2,744개가
// AuditEvent/ARCHIVED 노드로 소스 바인딩이 아니었다(빈 값 1,582 + /dev/null 610).
// 바인딩 증거(binding_state/sourcePath/boundBy)가 있는 노드만 위생 대상이다 —
// 분모를 잘못 잡으면 진짜 결함(바인딩 중 기계절대경로 52건)이 노이즈에 묻힌다.
//   MATCH (n) WHERE n.file_path IS NOT NULL
//     AND apoc.meta.cypher.type(n.file_path) = 'STRING'
//     AND (n.binding_state IS NOT NULL OR n.sourcePath IS NOT NULL OR n.boundBy IS NOT NULL)
//   RETURN { nodeId: coalesce(n.id, n.name, toString(elementId(n))),
//            property: 'file_path',
//            value: toString(n.file_path) } AS row
import { classifyBatch } from '../../src/lib/path-hygiene/batch.ts';
import { renderReport } from '../../src/lib/path-hygiene/render.ts';

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
};

const readStdin = async () => {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf-8');
};

const main = async () => {
  const raw = (await readStdin()).trim();
  if (raw.length === 0) {
    process.stderr.write('입력이 비었다. PathRow[] JSON 을 stdin 으로 넘겨라.\n');
    process.exit(2);
  }
  const rows = JSON.parse(raw);
  if (!Array.isArray(rows)) {
    process.stderr.write('입력이 배열이 아니다.\n');
    process.exit(2);
  }
  const report = classifyBatch(rows);

  if (argv.includes('--json')) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    const now = flag('--now');
    process.stdout.write(renderReport(report, now === undefined ? {} : { now }).join('\n') + '\n');
  }
  // 결정대기가 남아 있으면 비영점 종료 — CI 게이트로 쓸 수 있게.
  process.exit(report.needsDecision.length > 0 ? 1 : 0);
};

await main();
