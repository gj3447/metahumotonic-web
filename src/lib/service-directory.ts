import workbench from '../data/workbench.json' with { type: 'json' };
import learningHub from '../data/learning-hub.json' with { type: 'json' };
import { isSafeLink, publicProjects, statusLabels } from './workbench.ts';

export const directoryEdition = '2026-09-28';
export const directoryOrigin = 'https://metahumotonic.com';
export const directoryId = `${directoryOrigin}/services/#directory`;
export const directoryProjectId = (id: string) => `${directoryId}-project-${id}`;
export const directoryInternalId = (id: string) => `${directoryId}-internal-${id}`;
const learningNodeIds = new Set(learningHub.nodes.map(node => node.id));

export type ServiceGroup = 'experience' | 'knowledge' | 'developer';
export type DirectoryService = Readonly<{
  id: string;
  name: string;
  description: string;
  href: string;
  group: ServiceGroup;
  access: 'public';
  label: string;
  mark: string;
  verifiedAt: string;
}>;

// A deliberately small, reviewed public projection. Internal KG records and
// operations observations never flow directly into the company website.
export const services: readonly DirectoryService[] = [
  { id: 'soopoolim', name: '수풀림', description: '방송과 커뮤니티의 맥락을 연결하는 프로젝트 사이트.', href: 'https://soopoolim.metahumotonic.com/', group: 'experience', access: 'public', label: '공개 사이트', mark: '◌', verifiedAt: directoryEdition },
  { id: '333', name: '333 Compute', description: '동의를 먼저 확인하는 브라우저 계산 프로토콜 알파.', href: '/compute/', group: 'experience', access: 'public', label: '알파 체험', mark: '∴', verifiedAt: directoryEdition },
  { id: 'projects', name: '프로젝트', description: '제품, 게임, 연구와 시스템 작업의 공개 소개.', href: '/projects/', group: 'knowledge', access: 'public', label: '9개 소개', mark: '▦', verifiedAt: directoryEdition },
  { id: 'learn', name: '읽기 지도', description: '철학에서 코드와 영상까지 이어 읽는 의미 연결.', href: '/learn/', group: 'knowledge', access: 'public', label: '읽기', mark: '↗', verifiedAt: directoryEdition },
  { id: 'philosophy', name: '철학과 사명', description: '자유·경제·합의에서 시작하는 메타휴모토닉의 방향.', href: '/philosophy/', group: 'knowledge', access: 'public', label: '철학', mark: '◐', verifiedAt: directoryEdition },
  { id: 'axioms', name: '선의 공리', description: '열두 정의를 원문 순서대로 읽는 출발점.', href: '/axioms/', group: 'knowledge', access: 'public', label: '원문', mark: 'Ⅻ', verifiedAt: directoryEdition },
  { id: 'apostles', name: '사도', description: '철학의 개념이 이야기 속 존재로 이어지는 세계.', href: '/apostles/', group: 'knowledge', access: 'public', label: '세계관', mark: '✳', verifiedAt: directoryEdition },
  { id: 'wiki', name: 'Wiki', description: '공개된 원문, 세계관, 출처와 해석의 경계.', href: '/wiki/', group: 'knowledge', access: 'public', label: '자료', mark: 'W', verifiedAt: directoryEdition },
  { id: 'book', name: 'Book', description: '공리와 세계관을 한 흐름으로 읽는 공개 책.', href: '/book/', group: 'knowledge', access: 'public', label: '읽기', mark: 'B', verifiedAt: directoryEdition },
  { id: 'research', name: 'Research', description: '공개 연구 기록과 근거를 살펴보는 공간.', href: '/research/', group: 'knowledge', access: 'public', label: '연구 기록', mark: '◎', verifiedAt: directoryEdition },
  { id: 'github', name: 'GitHub', description: '공개 저장소와 코드, 변경 이력.', href: 'https://github.com/gj3447', group: 'developer', access: 'public', label: '외부 링크', mark: '⌘', verifiedAt: directoryEdition },
  { id: 'youtube', name: 'YouTube', description: '영상에서 질문을 찾고 관련 글로 이어가기.', href: 'https://www.youtube.com/channel/UCLVZA8cxVCEqrREfZ7NgcJA', group: 'developer', access: 'public', label: '외부 링크', mark: '▷', verifiedAt: directoryEdition },
  { id: 'api', name: '개발자 자료', description: '공개 API와 JSON-LD·USL 데이터의 읽기 경로.', href: '/developers/', group: 'developer', access: 'public', label: '개발자 안내', mark: '{ }', verifiedAt: directoryEdition },
  { id: 'mcp', name: 'MCP', description: '에이전트용 발견 문서와 레지스트리 상태 확인.', href: '/mcp/', group: 'developer', access: 'public', label: '발견 문서', mark: '◇', verifiedAt: directoryEdition },
  { id: 'operations', name: '운영 대시보드', description: 'METAHUMOTONIC_DASHBOARD와 운영자용 자료로 연결되는 안내.', href: '/operations/', group: 'developer', access: 'public', label: '운영자 안내', mark: '↗', verifiedAt: '2026-09-29' },
];

export const internalSystems = [
  { id: 'web-back', name: 'Web Back', role: '웹 API와 도메인 경계', note: '운영 Python · TypeScript 전환 후보' },
  { id: 'kg-usl', name: 'KG · USL', role: '지식 그래프와 의미 연결', note: '사내 권한 범위' },
  { id: 'data', name: 'PostgreSQL · 데이터', role: '도메인별 저장소와 이력', note: '사내 권한 범위' },
  { id: 'mcp-ops', name: 'MCP · 서버 운영', role: '도구 연결과 배포 관측', note: '사내 권한 범위' },
  { id: 'dashboard', name: 'METAHUMOTONIC_DASHBOARD', role: '저장소·장비·접속 안내를 연결하는 비공개 운영 색인', note: 'GitHub 저장소 접근권한 필요' },
] as const;

const allowedExternal = new Set([
  'https://soopoolim.metahumotonic.com/',
  'https://github.com/gj3447',
  'https://www.youtube.com/channel/UCLVZA8cxVCEqrREfZ7NgcJA',
]);
export const isSafeDirectoryLink = (href: string): boolean =>
  href.startsWith('/') ? isSafeLink(href) : allowedExternal.has(href);
export const absoluteDirectoryHref = (href: string): string =>
  href.startsWith('/') ? `${directoryOrigin}${href}` : href;
export const publicDirectoryServices = (): readonly DirectoryService[] =>
  services.filter(service => service.access === 'public' && isSafeDirectoryLink(service.href));
export const directoryProjects = () => publicProjects(workbench.projects).map(project => ({
  id: project.id,
  name: project.name,
  href: `/projects/${project.id}/`,
  status: statusLabels[project.status],
  category: project.category,
  symbol: project.symbol,
  summary: project.summary,
  liveHref: project.id === 'soopoolim' ? 'https://soopoolim.metahumotonic.com/' : project.id === '333' ? '/compute/' : null,
  liveLabel: project.id === 'soopoolim' ? '사이트 열기' : project.id === '333' ? '알파 범위 보기' : null,
}));

export const directoryProjection = () => ({
  schemaVersion: 'metahumotonic-service-directory/v1',
  edition: directoryEdition,
  publication: { mode: 'curated-public-snapshot', default: 'deny', liveStatus: false },
  services: publicDirectoryServices().map(({ id, name, description, href, group, access, label, verifiedAt }) => ({ id, name, description, href, group, access, label, verifiedAt })),
  projects: directoryProjects(),
  internalSystems: internalSystems.map(({ id, name, role, note }) => ({ id, name, role, note, access: 'internal-auth' })),
});

export const directoryJsonLd = () => ({
  '@context': { schema: 'https://schema.org/', prov: 'http://www.w3.org/ns/prov#' },
  '@graph': [
    { '@id': directoryId, '@type': 'schema:CollectionPage', 'schema:name': 'MetaHumotonic 서비스', 'schema:url': `${directoryOrigin}/services/`, 'schema:inLanguage': 'ko', 'schema:isPartOf': { '@id': `${directoryOrigin}/#website` }, 'schema:dateModified': directoryEdition, 'schema:mainEntity': { '@id': `${directoryId}-list` } },
    { '@id': `${directoryId}-list`, '@type': 'schema:ItemList', 'schema:itemListElement': publicDirectoryServices().map((service, index) => ({ '@type': 'schema:ListItem', 'schema:position': index + 1, 'schema:item': { '@id': `${directoryId}-${service.id}` } })) },
    ...publicDirectoryServices().map(service => ({ '@id': `${directoryId}-${service.id}`, '@type': 'schema:WebPage', 'schema:name': service.name, 'schema:description': service.description, 'schema:url': absoluteDirectoryHref(service.href), 'schema:dateModified': service.verifiedAt, ...(service.id === 'projects' ? { 'schema:hasPart': directoryProjects().map(project => ({ '@id': directoryProjectId(project.id) })) } : {}), ...(service.id === 'operations' ? { 'schema:about': { '@id': directoryInternalId('dashboard') } } : {}), 'prov:wasDerivedFrom': { '@id': `${directoryOrigin}/services/data.json` } })),
    ...directoryProjects().map(project => ({ '@id': directoryProjectId(project.id), '@type': 'schema:WebPage', 'schema:name': project.name, 'schema:description': project.summary, 'schema:url': absoluteDirectoryHref(project.href), ...(learningNodeIds.has(project.id) ? { 'schema:about': { '@id': `${directoryOrigin}/learn/#entity-${project.id}` } } : {}), 'prov:wasDerivedFrom': { '@id': `${directoryOrigin}/projects/data.json` } })),
    ...internalSystems.map(system => ({ '@id': directoryInternalId(system.id), '@type': 'schema:Service', 'schema:name': system.name, 'schema:description': system.role, 'schema:audience': { '@type': 'schema:Audience', 'schema:audienceType': '사내 인증' }, 'prov:wasDerivedFrom': { '@id': `${directoryOrigin}/services/data.json` } })),
  ],
});

export const directoryUsl = () => ({
  nodes: [
    { uid: directoryId, properties: { name: 'MetaHumotonic 서비스', kind: 'directory', locator: `${directoryOrigin}/services/`, authority: 'EDITORIAL_SUMMARY' } },
    ...publicDirectoryServices().map(service => ({ uid: `${directoryId}-${service.id}`, properties: { name: service.name, kind: service.group, locator: absoluteDirectoryHref(service.href), authority: 'EDITORIAL_SUMMARY' } })),
    ...directoryProjects().map(project => ({ uid: directoryProjectId(project.id), properties: { name: project.name, kind: 'project-introduction', locator: absoluteDirectoryHref(project.href), authority: 'EDITORIAL_SUMMARY' } })),
    ...internalSystems.map(system => ({ uid: directoryInternalId(system.id), properties: { name: system.name, kind: 'internal-capability', access: 'internal-auth', authority: 'EDITORIAL_SUMMARY' } })),
  ],
  relations: [
    { uid: `${directoryId}-edge-operations-dashboard`, from_uid: `${directoryId}-operations`, to_uid: directoryInternalId('dashboard'), type: 'DESCRIBES_INTERNAL', properties: { description: JSON.stringify({ label: '운영 대시보드 안내', meaning: '공개 운영자 안내가 설명하는 비공개 대시보드 역할입니다. 내부 데이터나 실행 권한은 포함하지 않습니다.', status: 'ACTIVE', authority: 'EDITORIAL_SUMMARY', source: `${directoryOrigin}/operations/` }) } },
    ...publicDirectoryServices().map(service => ({ uid: `${directoryId}-edge-${service.id}`, from_uid: directoryId, to_uid: `${directoryId}-${service.id}`, type: 'DISCOVERS', properties: { description: JSON.stringify({ label: '서비스로 이동', meaning: '공개 디렉터리에서 검토된 접근 경로를 안내합니다. 운영 상태나 접근 권한을 보증하지 않습니다.', status: 'ACTIVE', authority: 'EDITORIAL_SUMMARY', source: `${directoryOrigin}/services/data.json` }) } })),
    ...directoryProjects().map(project => ({ uid: `${directoryId}-edge-project-${project.id}`, from_uid: `${directoryId}-projects`, to_uid: directoryProjectId(project.id), type: 'INTRODUCES', properties: { description: JSON.stringify({ label: '프로젝트 소개', meaning: '프로젝트 목록에서 각 작업의 공개 소개로 연결합니다. 실행 가능성을 보증하지 않습니다.', status: 'ACTIVE', authority: 'EDITORIAL_SUMMARY', source: `${directoryOrigin}/projects/data.json` }) } })),
    ...internalSystems.map(system => ({ uid: `${directoryId}-edge-internal-${system.id}`, from_uid: directoryId, to_uid: directoryInternalId(system.id), type: 'DESCRIBES_INTERNAL', properties: { description: JSON.stringify({ label: '내부 역할 설명', meaning: '사내 시스템의 역할만 소개합니다. 접속 경로나 권한은 제공하지 않습니다.', status: 'ACTIVE', authority: 'EDITORIAL_SUMMARY', source: `${directoryOrigin}/services/data.json` }) } })),
  ],
});
