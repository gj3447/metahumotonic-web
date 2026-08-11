// KG: ATOM_PathHygiene_Batch
// 구현보다 먼저 작성됨(RED). 케이스는 2026-08-11 KG 실측 형태에서 도출.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { classifyBatch } from '../src/lib/path-hygiene/batch.ts';
import type { PathRow } from '../src/lib/path-hygiene/batch.ts';

const row = (nodeId: string, value: string, property = 'file_path'): PathRow =>
  ({ nodeId, property, value });

const ROWS: readonly PathRow[] = [
  row('n1', '/home/lagyeongjun/CD/SYMPOSIUM/THEORY/APT/SOURCES.md'),
  row('n2', '/Users/lagyeongjun/CD/metahumotonic-web/public/js/main.js'),
  row('n3', '07_PROJECTS/metahumotonic-web/public/js/feedback-form.js'),
  row('n4', 'src/dispatch.rs:92-101'),
  row('n5', '/etc/passwd'),
  row('n6', ''),
  row('n7', 'src/lib.rs (global_allocator 선언 필요)'),
];

describe('classifyBatch — 집계', () => {
  test('총계와 clean 수', () => {
    const r = classifyBatch(ROWS);
    assert.equal(r.total, 7);
    assert.equal(r.clean, 1);                 // n3 만 깨끗
  });

  test('issue 별 카운트', () => {
    const r = classifyBatch(ROWS);
    assert.equal(r.byIssue.MACHINE_ABSOLUTE, 2);          // n1 n2
    assert.equal(r.byIssue.LINE_ANCHOR, 1);               // n4
    assert.equal(r.byIssue.ABSOLUTE_OUTSIDE_CHECKOUT, 1); // n5
    assert.equal(r.byIssue.EMPTY, 1);                     // n6
    assert.equal(r.byIssue.PROSE_ANNOTATION, 1);          // n7
  });
});

describe('classifyBatch — 자동 교정 가능성 분리 (Constrain 축)', () => {
  test('MACHINE_ABSOLUTE 만 자동 교정 대상', () => {
    const r = classifyBatch(ROWS);
    assert.equal(r.autoRemediable.length, 2);
    assert.deepEqual(r.autoRemediable.map((x) => x.row.nodeId).toSorted(), ['n1', 'n2']);
  });

  test('교정안이 repo/repoRelative/cdRelative 를 모두 제시', () => {
    const r = classifyBatch(ROWS);
    const n1 = r.autoRemediable.find((x) => x.row.nodeId === 'n1')!;
    assert.equal(n1.proposed.repo, 'SYMPOSIUM');
    assert.equal(n1.proposed.repoRelative, 'THEORY/APT/SOURCES.md');
    assert.equal(n1.proposed.cdRelative, 'SYMPOSIUM/THEORY/APT/SOURCES.md');
  });

  test('유도 불가한 것은 자동 교정하지 않고 결정 대기로 분리', () => {
    const r = classifyBatch(ROWS);
    const ids = r.needsDecision.map((x) => x.row.nodeId).toSorted();
    assert.deepEqual(ids, ['n4', 'n5', 'n6', 'n7']);
  });

  test('clean 행은 어느 목록에도 들어가지 않는다', () => {
    const r = classifyBatch(ROWS);
    const all = [...r.autoRemediable.map((x) => x.row.nodeId), ...r.needsDecision.map((x) => x.row.nodeId)];
    assert.equal(all.includes('n3'), false);
  });

  test('총계 항등: total = clean + autoRemediable + needsDecision', () => {
    const r = classifyBatch(ROWS);
    assert.equal(r.total, r.clean + r.autoRemediable.length + r.needsDecision.length);
  });
});

describe('classifyBatch — 순수성', () => {
  test('입력 배열을 변형하지 않는다', () => {
    const before = JSON.stringify(ROWS);
    classifyBatch(ROWS);
    assert.equal(JSON.stringify(ROWS), before);
  });

  test('동일 입력에 동일 출력', () => {
    assert.deepEqual(classifyBatch(ROWS), classifyBatch(ROWS));
  });

  test('반환 목록이 동결됨', () => {
    const r = classifyBatch(ROWS);
    assert.throws(() => (r.autoRemediable as unknown[]).push(1), TypeError);
  });

  test('빈 입력에 항등원', () => {
    const r = classifyBatch([]);
    assert.equal(r.total, 0);
    assert.equal(r.clean, 0);
    assert.deepEqual(r.autoRemediable, []);
  });
});
