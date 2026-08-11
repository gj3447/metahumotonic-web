// KG: ATOM_PathHygiene_Render
// 구현보다 먼저 작성(RED). 시각은 주입받는다 — ambient 시각 참조 금지(F2 규율).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { classifyBatch } from '../src/lib/path-hygiene/batch.ts';
import { renderReport } from '../src/lib/path-hygiene/render.ts';
import type { PathRow } from '../src/lib/path-hygiene/batch.ts';

const row = (nodeId: string, value: string): PathRow => ({ nodeId, property: 'file_path', value });

const MIXED: readonly PathRow[] = [
  row('n1', '/home/lagyeongjun/CD/SYMPOSIUM/THEORY/APT/SOURCES.md'),
  row('n2', '/Users/lagyeongjun/CD/metahumotonic-web/public/js/main.js'),
  row('n3', '07_PROJECTS/ok/a.md'),
  row('n4', 'src/dispatch.rs:92-101'),
  row('n5', ''),
];

describe('renderReport — 요약', () => {
  test('총계/clean/자동교정/결정대기 수를 표기', () => {
    const out = renderReport(classifyBatch(MIXED)).join('\n');
    assert.match(out, /총 5/);
    assert.match(out, /clean 1/);
    assert.match(out, /자동교정 2/);
    assert.match(out, /결정대기 2/);
  });

  test('issue 별 카운트를 0 아닌 것만 표기', () => {
    const out = renderReport(classifyBatch(MIXED)).join('\n');
    assert.match(out, /MACHINE_ABSOLUTE\s+2/);
    assert.match(out, /LINE_ANCHOR\s+1/);
    assert.equal(/EMBEDDED_HOST_TRACE/.test(out), false, '0건 issue 는 표기하지 않는다');
  });
});

describe('renderReport — 교정안과 결정대기', () => {
  test('자동교정 항목이 nodeId·repo·repoRelative 를 제시', () => {
    const out = renderReport(classifyBatch(MIXED)).join('\n');
    assert.match(out, /n1/);
    assert.match(out, /SYMPOSIUM/);
    assert.match(out, /THEORY\/APT\/SOURCES\.md/);
  });

  test('결정대기 항목이 사유를 함께 표기', () => {
    const out = renderReport(classifyBatch(MIXED)).join('\n');
    assert.match(out, /n4/);
    assert.match(out, /레거시 앵커|재앵커링/);
  });
});

describe('renderReport — 결정성 (F1 규율)', () => {
  test('동일 입력에 바이트 동일 출력', () => {
    const a = renderReport(classifyBatch(MIXED)).join('\n');
    const b = renderReport(classifyBatch(MIXED)).join('\n');
    assert.equal(a, b);
  });

  test('ambient 시각을 읽지 않는다 — 주입 없으면 시각이 출력에 없다', () => {
    const out = renderReport(classifyBatch(MIXED)).join('\n');
    assert.equal(/\d{4}-\d{2}-\d{2}T\d{2}:/.test(out), false);
  });

  test('시각을 주입하면 그대로 표기', () => {
    const out = renderReport(classifyBatch(MIXED), { now: '2026-08-11T17:00:00+09:00' }).join('\n');
    assert.match(out, /2026-08-11T17:00:00\+09:00/);
  });

  test('반환 배열이 동결', () => {
    const lines = renderReport(classifyBatch(MIXED));
    assert.throws(() => (lines as string[]).push('X'), TypeError);
  });
});

describe('renderReport — 경계', () => {
  test('빈 입력', () => {
    const out = renderReport(classifyBatch([])).join('\n');
    assert.match(out, /총 0/);
  });

  test('전부 clean 이면 교정 섹션이 없다', () => {
    const out = renderReport(classifyBatch([row('c1', 'a/b.md')])).join('\n');
    assert.match(out, /clean 1/);
    assert.equal(/자동교정 대상/.test(out), false);
  });
});
