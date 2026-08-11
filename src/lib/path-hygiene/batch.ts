// KG: ATOM_PathHygiene_Batch
// 배치 판정도 순수 함수다. Neo4j 조회·쓰기는 이 모듈 밖(어댑터) 책임.
import { parseSourcePath } from './core.ts';
import type { PathIssue, ParsedSourcePath } from './types.ts';

export type PathRow = {
  readonly nodeId: string;
  readonly property: string;
  readonly value: string;
};

export type Proposal = {
  readonly repo: string;
  readonly repoRelative: string;
  readonly cdRelative: string;
};

export type Remediation = {
  readonly row: PathRow;
  readonly issues: readonly PathIssue[];
  readonly proposed: Proposal;
};

export type Decision = {
  readonly row: PathRow;
  readonly issues: readonly PathIssue[];
  readonly reason: string;
};

export type BatchReport = {
  readonly total: number;
  readonly clean: number;
  readonly byIssue: Readonly<Record<PathIssue, number>>;
  readonly autoRemediable: readonly Remediation[];
  readonly needsDecision: readonly Decision[];
  readonly samples: Readonly<Partial<Record<PathIssue, readonly string[]>>>;
};

const ALL_ISSUES: readonly PathIssue[] = Object.freeze([
  'EMPTY', 'MACHINE_ABSOLUTE', 'MISSING_LEADING_SLASH',
  'ABSOLUTE_OUTSIDE_CHECKOUT', 'LINE_ANCHOR', 'PROSE_ANNOTATION', 'EMBEDDED_HOST_TRACE',
]) as readonly PathIssue[];

// 기계적으로 유도 가능한 결함만 자동 교정 대상이다.
// 나머지(줄번호 앵커, 산문 혼입, 체크아웃 밖 절대경로, 호스트 흔적)는
// 의도를 알 수 없으므로 사람 결정으로 넘긴다 — Constrain 축의 코드화.
const DERIVABLE: readonly PathIssue[] = Object.freeze(['MACHINE_ABSOLUTE', 'MISSING_LEADING_SLASH']) as readonly PathIssue[];

const DECISION_REASON: Readonly<Partial<Record<PathIssue, string>>> = Object.freeze({
  LINE_ANCHOR: 'file:line 레거시 앵커. content-hash/AST-symbol 로 재앵커링할지 결정 필요(PROM16 T2).',
  PROSE_ANNOTATION: '경로 문자열에 산문이 섞여 있어 파일 경로로 해석 불가. 원저자 의도 확인 필요.',
  ABSOLUTE_OUTSIDE_CHECKOUT: '알려진 체크아웃 루트 밖 절대경로. 시스템 경로일 수 있어 건드리지 않는다.',
  EMBEDDED_HOST_TRACE: '경로 내부에 호스트 흔적이 인코딩돼 있어 단순 접두 제거로 해결되지 않는다.',
  EMPTY: '값이 비어 있다. 참조 자체를 폐기할지 결정 필요.',
});

// caller 가 넘긴 row 를 참조로 보관하면 보고서가 외부 변형에 오염된다.
// FLR-H M1 F3 역학("caller 입력을 재귀적으로 write-detect")을 도입해 발견한 결함 —
// 얕은 Object.freeze 는 중첩 참조를 보호하지 못한다. 값 복사 후 동결한다.
const freezeRow = (r: PathRow): PathRow =>
  Object.freeze({ nodeId: r.nodeId, property: r.property, value: r.value });

const isDerivable = (p: ParsedSourcePath): boolean =>
  p.issues.length > 0
  && p.issues.every((i) => DERIVABLE.includes(i))
  && p.repo !== null
  && p.repoRelative !== null
  && p.cdRelative !== null;

const reasonFor = (issues: readonly PathIssue[]): string =>
  issues.map((i) => DECISION_REASON[i]).filter((s): s is string => s !== undefined).join(' / ')
  || '분류되지 않은 결함.';

/** 행 묶음을 판정해 보고서를 만든다. 순수·결정적이며 입력을 변형하지 않는다. */
export const classifyBatch = (rows: readonly PathRow[]): BatchReport => {
  const parsed: readonly (readonly [PathRow, ParsedSourcePath])[] =
    rows.map((raw) => {
      const row = freezeRow(raw);
      return Object.freeze([row, parseSourcePath(row.value)] as const);
    });

  const withIssues = parsed.filter(([, p]) => p.issues.length > 0);

  const autoRemediable: readonly Remediation[] = Object.freeze(
    withIssues.filter(([, p]) => isDerivable(p)).map(([row, p]) =>
      Object.freeze({
        row,
        issues: p.issues,
        proposed: Object.freeze({
          repo: p.repo as string,
          repoRelative: p.repoRelative as string,
          cdRelative: p.cdRelative as string,
        }),
      })),
  );

  const needsDecision: readonly Decision[] = Object.freeze(
    withIssues.filter(([, p]) => !isDerivable(p)).map(([row, p]) =>
      Object.freeze({ row, issues: p.issues, reason: reasonFor(p.issues) })),
  );

  const byIssue = Object.freeze(Object.fromEntries(
    ALL_ISSUES.map((i) => [i, parsed.filter(([, p]) => p.issues.includes(i)).length]),
  )) as Readonly<Record<PathIssue, number>>;

  const samples = Object.freeze(Object.fromEntries(
    ALL_ISSUES
      .map((i) => [i, Object.freeze(parsed.filter(([, p]) => p.issues.includes(i)).slice(0, 3).map(([r]) => r.value))] as const)
      .filter(([, v]) => v.length > 0),
  )) as Readonly<Partial<Record<PathIssue, readonly string[]>>>;

  return Object.freeze({
    total: rows.length,
    clean: parsed.length - withIssues.length,
    byIssue, autoRemediable, needsDecision, samples,
  });
};
