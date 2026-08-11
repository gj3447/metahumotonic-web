// KG: ATOM_PathHygiene_PureCore
// 2026-08-11 세션에서 실측된 경로 결함만으로 구성한 명세. 구현보다 먼저 작성됨(RED).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseSourcePath, isClean, issuesOf } from '../src/lib/path-hygiene/core.ts';

describe('parseSourcePath — 체크아웃 루트 분해', () => {
  test('dev-01 절대경로를 repo/repoRelative/cdRelative 로 분해', () => {
    const r = parseSourcePath('/home/lagyeongjun/CD/SYMPOSIUM/THEORY/APT/SOURCES.md');
    assert.equal(r.checkoutRoot, '/home/lagyeongjun/CD/');
    assert.equal(r.repo, 'SYMPOSIUM');
    assert.equal(r.repoRelative, 'THEORY/APT/SOURCES.md');
    assert.equal(r.cdRelative, 'SYMPOSIUM/THEORY/APT/SOURCES.md');
    assert.deepEqual(r.issues, ['MACHINE_ABSOLUTE']);
  });

  test('macmini 절대경로도 동일한 repoRelative 로 수렴', () => {
    const a = parseSourcePath('/Users/lagyeongjun/CD/SYMPOSIUM/THEORY/APT/SOURCES.md');
    const b = parseSourcePath('/home/lagyeongjun/CD/SYMPOSIUM/THEORY/APT/SOURCES.md');
    assert.equal(a.repoRelative, b.repoRelative);
    assert.equal(a.repo, b.repo);
  });

  test('선행 슬래시 누락 형태를 별도 issue 로 식별', () => {
    const r = parseSourcePath('Users/lagyeongjun/CD/SYMPOSIUM/THEORY/APT/SOURCES.md');
    assert.equal(r.repoRelative, 'THEORY/APT/SOURCES.md');
    assert.ok(r.issues.includes('MISSING_LEADING_SLASH'));
    assert.ok(r.issues.includes('MACHINE_ABSOLUTE'));
  });

  test('SYMPOSIUM 밖 레포(metahumotonic-web)도 분해', () => {
    const r = parseSourcePath('/home/lagyeongjun/CD/metahumotonic-web/public/js/feedback-form.js');
    assert.equal(r.repo, 'metahumotonic-web');
    assert.equal(r.repoRelative, 'public/js/feedback-form.js');
  });

  test('이미 상대경로면 무손상 통과 (issue 없음)', () => {
    const r = parseSourcePath('THEORY/APT/SOURCES.md');
    assert.equal(r.checkoutRoot, null);
    assert.equal(r.repo, null);
    assert.equal(r.repoRelative, 'THEORY/APT/SOURCES.md');
    assert.deepEqual(r.issues, []);
  });

  test('체크아웃 루트 밖 절대경로는 건드리지 않되 별도 표시', () => {
    const r = parseSourcePath('/etc/passwd');
    assert.equal(r.checkoutRoot, null);
    assert.equal(r.repoRelative, '/etc/passwd');
    assert.deepEqual(r.issues, ['ABSOLUTE_OUTSIDE_CHECKOUT']);
  });
});

describe('issuesOf — 오늘 실측된 데이터 품질 결함', () => {
  test('줄번호 앵커 (file:line 레거시, 5건 실측)', () => {
    assert.ok(issuesOf('src/dispatch.rs:92-101').includes('LINE_ANCHOR'));
    assert.ok(issuesOf('src/p2p/webrtc.rs:52').includes('LINE_ANCHOR'));
  });

  test('산문 주석 혼입 (3건 실측)', () => {
    assert.ok(issuesOf('src/lib.rs (global_allocator 선언 필요)').includes('PROSE_ANNOTATION'));
    assert.ok(issuesOf('333-app/src/lib/om-bridge.ts (NEW)').includes('PROSE_ANNOTATION'));
  });

  test('경로 내 호스트 흔적 (1건 실측)', () => {
    assert.ok(issuesOf('.claude/projects/-Users-lagyeongjun-CD-SERVER/memory/MEMORY.md')
      .includes('EMBEDDED_HOST_TRACE'));
  });

  test('빈 값', () => {
    assert.deepEqual(issuesOf(''), ['EMPTY']);
  });
});

describe('isClean — 순수성·불변성', () => {
  test('깨끗한 상대경로만 true', () => {
    assert.equal(isClean('THEORY/APT/SOURCES.md'), true);
    assert.equal(isClean('/home/lagyeongjun/CD/SYMPOSIUM/x.md'), false);
    assert.equal(isClean('src/a.rs:10'), false);
  });

  test('동일 입력에 동일 출력 (결정성)', () => {
    const p = '/home/lagyeongjun/CD/SYMPOSIUM/THEORY/x.md';
    assert.deepEqual(parseSourcePath(p), parseSourcePath(p));
  });

  test('반환 issues 배열이 동결되어 호출자가 변형 불가', () => {
    const r = parseSourcePath('/etc/passwd');
    assert.throws(() => (r.issues as string[]).push('X'), TypeError);
  });
});
