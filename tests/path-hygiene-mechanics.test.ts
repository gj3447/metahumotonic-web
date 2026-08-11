// KG: ATOM_PathHygiene_FMechanics
// FLR-H M1 의 mechanics_tests(F1/F2/F3) 를 규율로 도입한 것. M1 적합 배지 주장 아님 —
// M1 completion_boundary 는 Python pure-F reference slice/corpus 로 한정되며 이 모듈은 그 밖이다.
// 출처: agent-coding-paradigm spec/m1-manifest.v1.json mechanics_tests
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseSourcePath, classifyBatch } from '../src/lib/path-hygiene/index.ts';
import type { PathRow } from '../src/lib/path-hygiene/batch.ts';

const CORPUS: readonly string[] = [
  '/home/lagyeongjun/CD/SYMPOSIUM/THEORY/APT/SOURCES.md',
  '/Users/lagyeongjun/CD/metahumotonic-web/public/js/main.js',
  'Users/lagyeongjun/CD/SYMPOSIUM/x.md',
  '07_PROJECTS/metahumotonic-web/public/js/feedback-form.js',
  'src/dispatch.rs:92-101',
  'src/lib.rs (global_allocator 선언 필요)',
  '.claude/projects/-Users-lagyeongjun-CD-SERVER/memory/MEMORY.md',
  '/etc/passwd',
  '',
];

describe('F1 — 두 개의 새 프로세스에서 byte-stable 출력', () => {
  test('별도 spawn 된 두 클린 프로세스의 정규 JSON 이 바이트 동일', () => {
    const script = `
      import { parseSourcePath } from '${process.cwd()}/src/lib/path-hygiene/core.ts';
      const corpus = ${JSON.stringify(CORPUS)};
      process.stdout.write(JSON.stringify(corpus.map(parseSourcePath)));
    `;
    const run = () => execFileSync(process.execPath,
      ['--experimental-strip-types', '--input-type=module', '--eval', script],
      { encoding: 'utf-8', env: { PATH: process.env.PATH ?? '' } });
    const a = run();
    const b = run();
    assert.equal(a, b);
    assert.ok(a.length > 100);
  });
});

describe('F2 — ambient 접근 거부 (정적 감사)', () => {
  test('코어 소스가 ambient 표면을 import 하지 않는다', () => {
    const files = ['core.ts', 'batch.ts', 'types.ts', 'index.ts'];
    const forbidden = /from\s+'node:(fs|net|http|https|child_process|os|process|dns|tls)'/;
    for (const f of files) {
      const src = readFileSync(`src/lib/path-hygiene/${f}`, 'utf-8');
      assert.equal(forbidden.test(src), false, `${f} 가 ambient 표면을 import`);
    }
  });

  test('코어 소스가 시각·난수 같은 ambient 값을 읽지 않는다', () => {
    const files = ['core.ts', 'batch.ts'];
    const ambient = /Date\.now|new Date\(|Math\.random|process\.env|performance\.now/;
    for (const f of files) {
      const src = readFileSync(`src/lib/path-hygiene/${f}`, 'utf-8');
      assert.equal(ambient.test(src), false, `${f} 가 ambient 값 참조`);
    }
  });
});

describe('F3 — caller 입력을 재귀적으로 write-detect', () => {
  test('동결된 입력으로도 정상 동작', () => {
    const frozen: readonly PathRow[] = Object.freeze([
      Object.freeze({ nodeId: 'n1', property: 'file_path', value: '/home/u/CD/R/a.md' }),
    ]);
    assert.doesNotThrow(() => classifyBatch(frozen));
  });

  test('caller 가 나중에 입력을 변형해도 보고서가 흔들리지 않는다 (깊은 불변)', () => {
    const mutable: PathRow = { nodeId: 'n1', property: 'file_path', value: '/home/u/CD/R/a.md' };
    const report = classifyBatch([mutable]);
    const before = report.autoRemediable[0]!.row.value;
    (mutable as { value: string }).value = 'MUTATED';
    assert.equal(report.autoRemediable[0]!.row.value, before,
      '보고서가 caller 입력을 참조로 들고 있어 외부 변형에 오염된다');
  });

  test('보고서 내부 row 객체가 동결되어 있다', () => {
    const report = classifyBatch([{ nodeId: 'n1', property: 'file_path', value: '/home/u/CD/R/a.md' }]);
    assert.throws(() => { (report.autoRemediable[0]!.row as { value: string }).value = 'X'; }, TypeError);
  });

  test('parseSourcePath 반환 객체도 동결', () => {
    const r = parseSourcePath('/home/u/CD/R/a.md');
    assert.throws(() => { (r as { raw: string }).raw = 'X'; }, TypeError);
  });
});
