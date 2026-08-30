// Public MetaHumotonic wiki projection.
//
// This module is intentionally an allowlist over reviewed public mirrors. It
// must never fall back to an arbitrary node/property dump from Neo4j.
import apostlesSource from '../data/apostles.json';
import axiomsSource from '../data/axioms.json';
import worldviewSource from '../data/worldview.json';

export const WIKI_SCHEMA_VERSION = 'metahumotonic-public-wiki/v1' as const;

export const wikiAuthority = {
  canonicalUser: {
    id: 'CANONICAL_USER',
    label: '사용자 원문 정전',
    description: '사용자 1차 창작 원문을 문장 윤색 없이 공개한 항목입니다.',
  },
  kgDerived: {
    id: 'KG_DERIVED',
    label: 'KG 정전 미러',
    description: 'Neo4j KG에서 검수해 공개 데이터로 동기화한 파생 항목입니다. 새 정전 승격을 뜻하지 않습니다.',
  },
} as const;

export type WikiAuthorityId =
  (typeof wikiAuthority)[keyof typeof wikiAuthority]['id'];

export const wikiAxioms = axiomsSource.axioms.map((axiom) => ({
  id: `axiom-${axiom.n}`,
  canonicalUrl: `/wiki/axioms/#axiom-${axiom.n}`,
  authority: wikiAuthority.canonicalUser.id,
  n: axiom.n,
  num: axiom.num,
  hanja: axiom.hanja,
  name: axiom.kor,
  body: axiom.body,
  english: axiom.en,
  symbol: axiom.symbol,
}));

export const wikiApostles = apostlesSource.apostles.map((apostle) => ({
  id: `apostle-${apostle.id}`,
  canonicalUrl: `/wiki/apostles/${apostle.slug}/`,
  sourceUrl: `/apostles/${apostle.slug}/`,
  authority: wikiAuthority.kgDerived.id,
  number: apostle.id,
  numeral: apostle.num,
  slug: apostle.slug,
  name: apostle.name,
  epithet: apostle.epithet,
  essence: apostle.essence,
  body: apostle.body_ko,
  role: apostle.role,
  status: apostle.status,
  icon: apostle.icon,
}));

export const wikiWorldview = worldviewSource.worldview.map((cluster, index) => ({
  id: `worldview-${index + 1}`,
  canonicalUrl: `/wiki/worldview/#worldview-${index + 1}`,
  authority: wikiAuthority.kgDerived.id,
  number: cluster.n,
  title: cluster.title,
  english: cluster.en,
  gloss: cluster.gloss,
  terms: cluster.terms,
}));

export const publicWikiProjection = {
  schemaVersion: WIKI_SCHEMA_VERSION,
  canonicalOrigin: 'https://metahumotonic.com/wiki/',
  mode: 'read-only-kg-projection',
  publicationPolicy: {
    default: 'deny',
    includedDatasets: ['axioms-public-v1', 'apostles-public-v1', 'worldview-public-v1'],
    excluded: [
      'arbitrary Neo4j nodes and properties',
      'filesystem paths and credentials',
      'SECONDARY_AI and PSEUDEPIGRAPHA unless explicitly published',
    ],
  },
  snapshots: {
    axioms: 'CANONICAL_USER exact-text mirror',
    apostles: apostlesSource._meta.legion_commanders_synced_at,
    worldview: worldviewSource._meta.synced_at,
  },
  authority: Object.values(wikiAuthority),
  counts: {
    axioms: wikiAxioms.length,
    apostles: wikiApostles.length,
    worldviewClusters: wikiWorldview.length,
  },
  axioms: wikiAxioms,
  apostles: wikiApostles,
  worldview: wikiWorldview,
};

export const wikiSidebar = [
  {
    label: 'MetaHumotonic Wiki',
    items: [
      { label: '위키 홈', link: '/wiki/' },
      { label: '커뮤니티 위키 · 편집', link: '/wiki/community/' },
      { label: '공개·정전 경계', link: '/wiki/authority/' },
      { label: 'Ontology 내부 탐색기 · 키 필요', link: '/wiki/ontology/' },
      { label: '오픈소스 기반', link: '/wiki/open-source/' },
      { label: '선의 공리 12', link: '/wiki/axioms/' },
      { label: '세계관 지도', link: '/wiki/worldview/' },
      { label: '12사도', link: '/wiki/apostles/' },
    ],
  },
  {
    label: '사도 문서',
    collapsed: true,
    items: wikiApostles.map((apostle) => ({
      label: `${apostle.numeral}. ${apostle.name}`,
      link: apostle.canonicalUrl,
    })),
  },
  {
    label: '연결',
    items: [
      { label: 'MetaHumotonic 홈', link: '/' },
      { label: '기존 KG 탐색기', link: '/explore/' },
      { label: '공개 JSON 투영', link: '/wiki/data.json' },
    ],
  },
] as const;
