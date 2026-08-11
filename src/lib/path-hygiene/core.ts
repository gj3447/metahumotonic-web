// KG: ATOM_PathHygiene_PureCore
// 순수 함수만. 부수효과(Neo4j/fs/HTTP)는 어댑터로 밀어낸다 — ADR-001 경계 원칙 준수.
import type { PathIssue, ParsedSourcePath } from './types.ts';

type CheckoutPattern = { readonly re: RegExp; readonly missingSlash: boolean };

const CHECKOUT_PATTERNS: readonly CheckoutPattern[] = Object.freeze([
  Object.freeze({ re: /^(\/home\/[^/]+\/CD\/)/, missingSlash: false }),
  Object.freeze({ re: /^(\/Users\/[^/]+\/CD\/)/, missingSlash: false }),
  Object.freeze({ re: /^(Users\/[^/]+\/CD\/)/, missingSlash: true }),
]) as readonly CheckoutPattern[];

const matchCheckout = (raw: string): CheckoutPattern | null =>
  CHECKOUT_PATTERNS.find((p) => p.re.test(raw)) ?? null;

// 내용 기반 결함 탐지기 — 체크아웃 루트와 무관하게 성립하는 것들
const CONTENT_DETECTORS: readonly (readonly [PathIssue, (s: string) => boolean])[] = Object.freeze([
  Object.freeze(['LINE_ANCHOR', (s: string) => /:\d+(?:-\d+)?$/.test(s)]),
  Object.freeze(['PROSE_ANNOTATION', (s: string) => /\s\([^)]*\)\s*$/.test(s)]),
  Object.freeze(['EMBEDDED_HOST_TRACE', (s: string) => /-(?:Users|home)-[^/]*-CD-/.test(s)]),
]) as readonly (readonly [PathIssue, (s: string) => boolean])[];

const contentIssues = (raw: string): readonly PathIssue[] =>
  CONTENT_DETECTORS.filter(([, hit]) => hit(raw)).map(([issue]) => issue);

const structuralIssues = (raw: string, m: CheckoutPattern | null): readonly PathIssue[] =>
  m !== null
    ? m.missingSlash ? ['MACHINE_ABSOLUTE', 'MISSING_LEADING_SLASH'] : ['MACHINE_ABSOLUTE']
    : raw.startsWith('/') ? ['ABSOLUTE_OUTSIDE_CHECKOUT'] : [];

/** 경로 문자열의 결함 목록. 순수·결정적. */
// AuditEvent 가 명령줄 출력 리다이렉트를 그대로 저장한 값. "/dev/null)" 괄호 오염형 실측.
const NOT_A_FILE = /^\/dev\/null\)?$/;

export const issuesOf = (raw: string): readonly PathIssue[] => {
  if (raw.length === 0) return Object.freeze<PathIssue[]>(['EMPTY']);
  if (NOT_A_FILE.test(raw)) return Object.freeze<PathIssue[]>(['NOT_A_FILE_REFERENCE']);
  const m = matchCheckout(raw);
  return Object.freeze([...structuralIssues(raw, m), ...contentIssues(raw)]);
};

/**
 * 체크아웃 루트를 분해해 repo 기준과 CD 기준 상대경로를 함께 돌려준다.
 * 두 규약(dump-kg 의 CD 기준 vs KG 의 repo 기준)을 승자 선택 없이 양쪽 유도 가능하게 만든다.
 */
export const parseSourcePath = (raw: string): ParsedSourcePath => {
  const issues = issuesOf(raw);
  const m = matchCheckout(raw);
  if (m === null) {
    return Object.freeze({
      raw, checkoutRoot: null, repo: null,
      repoRelative: raw.length === 0 ? null : raw,
      cdRelative: raw.length === 0 ? null : raw,
      issues,
    });
  }
  const root = raw.match(m.re)![1]!;
  const rest = raw.slice(root.length);
  const slash = rest.indexOf('/');
  const repo = slash === -1 ? rest : rest.slice(0, slash);
  const repoRelative = slash === -1 ? '.' : rest.slice(slash + 1);
  return Object.freeze({
    raw, checkoutRoot: root, repo, repoRelative, cdRelative: rest, issues,
  });
};

/** 결함이 하나도 없을 때만 true. */
export const isClean = (raw: string): boolean => issuesOf(raw).length === 0;
