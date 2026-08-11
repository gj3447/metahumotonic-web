// KG: ATOM_PathHygiene_Triage
// 구현보다 먼저 작성(RED). 2026-08-11 전수조사 실측에서 도출:
// /dev/null 610건(그중 "/dev/null)" 괄호 오염 포함)이 결정대기로 과잉 경보됨 —
// README 의 D3 함정(alert fatigue) 그대로. 파일 참조가 아닌 값을 별도 버킷으로 뺀다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { classifyBatch } from '../src/lib/path-hygiene/batch.ts';
import { renderReport } from '../src/lib/path-hygiene/render.ts';
import type { PathRow } from '../src/lib/path-hygiene/batch.ts';

const row = (nodeId: string, value: string): PathRow => ({ nodeId, property: 'file_path', value });

describe('NOT_A_FILE_REFERENCE — /dev/null 류', () => {
  test('/dev/null 은 결정대기가 아니라 해당없음', () => {
    const r = classifyBatch([row('a1', '/dev/null')]);
    assert.equal(r.notApplicable.length, 1);
    assert.equal(r.needsDecision.length, 0);
    assert.deepEqual(r.notApplicable[0]!.issues, ['NOT_A_FILE_REFERENCE']);
  });

  test('괄호 오염형 "/dev/null)" 도 해당없음 (실측 존재)', () => {
    const r = classifyBatch([row('a2', '/dev/null)')]);
    assert.equal(r.notApplicable.length, 1);
    assert.equal(r.needsDecision.length, 0);
  });

  test('/dev/null 을 접두로만 가진 실제 경로는 해당없음이 아니다', () => {
    const r = classifyBatch([row('a3', '/dev/nullish/config.md')]);
    assert.equal(r.notApplicable.length, 0);
    assert.equal(r.needsDecision.length, 1); // ABSOLUTE_OUTSIDE_CHECKOUT
  });

  test('총계 항등 확장: total = clean + auto + decision + notApplicable', () => {
    const r = classifyBatch([
      row('c', 'ok/rel.md'),
      row('m', '/home/u/CD/R/x.md'),
      row('d', 'src/a.rs:10'),
      row('n', '/dev/null'),
    ]);
    assert.equal(r.total,
      r.clean + r.autoRemediable.length + r.needsDecision.length + r.notApplicable.length);
    assert.equal(r.notApplicable.length, 1);
  });
});

describe('renderReport — 해당없음 표기와 패딩', () => {
  test('요약에 해당없음 수를 표기', () => {
    const out = renderReport(classifyBatch([row('n', '/dev/null'), row('c', 'ok.md')])).join('\n');
    assert.match(out, /해당없음 1/);
  });

  test('긴 nodeId 에서도 컬럼이 붙지 않는다 (실측 표본에서 발견된 패딩 결함)', () => {
    const r = classifyBatch([
      row('DOC_ICE_V2_KG_STRUCTURE', '/Users/gj3447/CD/ICE/ICE_V2_KG_STRUCTURE.md'),
      row('short', '/Users/gj3447/CD/ICE/ROADMAP.md'),
    ]);
    const out = renderReport(r).join('\n');
    assert.match(out, /DOC_ICE_V2_KG_STRUCTURE\s+ICE\s+/,
      'nodeId 와 repo 사이에 공백이 최소 1개 있어야 한다');
    assert.equal(/DOC_ICE_V2_KG_STRUCTUREICE/.test(out), false);
  });

  test('결정대기 항목도 긴 nodeId 뒤에 공백 보장', () => {
    const r = classifyBatch([row('M3 Registration backend 선택 불가', 'prism/modules/m3_register.py:33')]);
    const out = renderReport(r).join('\n');
    assert.match(out, /M3 Registration backend 선택 불가\s+\[LINE_ANCHOR\]/);
  });
});
