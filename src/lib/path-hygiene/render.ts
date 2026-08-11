// KG: ATOM_PathHygiene_Render
// 순수·결정적 렌더러. 시각은 주입받는다(ambient 시각 참조 금지 — FLR-H F2 규율).
import type { PathIssue } from './types.ts';
import type { BatchReport, Remediation, Decision } from './batch.ts';

export type RenderOptions = { readonly now?: string };

const LABEL_WIDTH = 26;

// 카운트 내림차순 -> 이름 오름차순. 삽입 순서에 의존하지 않아 바이트 안정.
const rankedIssues = (byIssue: Readonly<Record<PathIssue, number>>): readonly (readonly [PathIssue, number])[] =>
  (Object.entries(byIssue) as (readonly [PathIssue, number])[])
    .filter(([, n]) => n > 0)
    .toSorted((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

const remediationLine = (r: Remediation): string =>
  `    ${r.row.nodeId.padEnd(14)}${r.proposed.repo.padEnd(22)}${r.proposed.repoRelative}`;

const decisionLine = (d: Decision): string =>
  `    ${d.row.nodeId.padEnd(14)}[${d.issues.join(',')}] ${d.reason}`;

const byNodeId = <T extends { readonly row: { readonly nodeId: string } }>(xs: readonly T[]): readonly T[] =>
  xs.toSorted((a, b) => a.row.nodeId.localeCompare(b.row.nodeId));

const section = (title: string, lines: readonly string[]): readonly string[] =>
  lines.length === 0 ? [] : ['', `  ${title}`, ...lines];

/** BatchReport 를 사람이 읽는 줄 배열로. 동일 입력 -> 바이트 동일 출력. */
export const renderReport = (report: BatchReport, opts: RenderOptions = {}): readonly string[] => {
  const head: readonly string[] = [
    '경로 위생 보고서',
    `  총 ${report.total} · clean ${report.clean} · 자동교정 ${report.autoRemediable.length} · 결정대기 ${report.needsDecision.length}`,
    ...(opts.now === undefined ? [] : [`  생성 ${opts.now}`]),
  ];

  const distribution = section('결함 분포',
    rankedIssues(report.byIssue).map(([issue, n]) => `    ${issue.padEnd(LABEL_WIDTH)}${n}`));

  const remediable = section(`자동교정 대상 (${report.autoRemediable.length})`,
    byNodeId(report.autoRemediable).map(remediationLine));

  const decisions = section(`결정대기 (${report.needsDecision.length})`,
    byNodeId(report.needsDecision).map(decisionLine));

  return Object.freeze([...head, ...distribution, ...remediable, ...decisions]);
};
