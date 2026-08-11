// KG: ATOM_PathHygiene_PureCore
// 경로 참조 위생 판정의 타입. 2026-08-11 실측 결함에서 도출.
export type PathIssue =
  | 'EMPTY'
  | 'MACHINE_ABSOLUTE'          // 체크아웃 루트가 경로에 박혀 이식 불가 (2026-08-11 1,562건 실측)
  | 'MISSING_LEADING_SLASH'     // 'Users/…' 처럼 선행 / 누락 (3건)
  | 'ABSOLUTE_OUTSIDE_CHECKOUT' // 절대경로지만 알려진 체크아웃 루트 밖 — 건드리지 않는다
  | 'LINE_ANCHOR'               // 'src/a.rs:92-101' file:line 레거시 앵커 (5건)
  | 'PROSE_ANNOTATION'          // 'src/lib.rs (설명)' 산문 혼입 (3건)
  | 'EMBEDDED_HOST_TRACE'       // '-Users-lagyeongjun-CD-…' 경로 내 호스트 흔적 (1건)
  | 'NOT_A_FILE_REFERENCE';     // '/dev/null' 류 출력 리다이렉트 기록 — 파일 참조가 아님 (610건 실측, 괄호 오염형 포함)

export type ParsedSourcePath = {
  readonly raw: string;
  readonly checkoutRoot: string | null;  // 예 '/home/lagyeongjun/CD/'
  readonly repo: string | null;          // 예 'SYMPOSIUM'
  readonly repoRelative: string | null;  // 예 'THEORY/APT/SOURCES.md'  (레포 루트 기준)
  readonly cdRelative: string | null;    // 예 'SYMPOSIUM/THEORY/APT/SOURCES.md' (CD 기준)
  readonly issues: readonly PathIssue[];
};
