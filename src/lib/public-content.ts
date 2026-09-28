import source from '../data/apostles.json';
import introductions from '../data/apostle-introductions.json';
import axiomsSource from '../data/axioms.json';
import hub from '../data/learning-hub.json';

// Explicit public projection: internal paths, proposal arrays and external
// engineering analogies from the canon mirror do not become public claims.
export const apostles = source.apostles.map(item => ({
  number: item.id, numeral: item.num, slug: item.slug, name: item.name,
  epithet: item.epithet, icon: item.icon, body: item.body_ko,
  summary: introductions.items.find(intro => intro.number === item.id)!.summary,
  href: `/apostles/${item.slug}/`, sourceHref: `/wiki/apostles/${item.slug}/`,
  nodeId: `apostle-${item.id}`,
}));
export const axioms = axiomsSource.axioms;
export const axiomNodeId = (number: number) => number === 3 ? 'good' : number === 12 ? 'metahumotonic' : `axiom-${number}`;
export const entityIri = (id: string) => `https://metahumotonic.com/learn/#entity-${id}`;
export const pageGraph = (path: string, name: string, ids: readonly string[]) => ({
  '@context': { '@vocab': 'https://schema.org/' },
  '@type': 'WebPage', '@id': `https://metahumotonic.com${path}#page`,
  url: `https://metahumotonic.com${path}`, name, inLanguage: 'ko',
  isPartOf: { '@id': 'https://metahumotonic.com/#website' },
  mainEntity: ids.map(id => ({ '@id': entityIri(id) })),
});
export const localHref = (href: string) => href.startsWith('https://metahumotonic.com/') ? href.slice('https://metahumotonic.com'.length) : href;
export const relatedContent = (id: string) => hub.edges.filter(edge => edge.from === id && edge.status === 'ACTIVE')
  .map(edge => ({ edge, node: hub.nodes.find(node => node.id === edge.to)! }));
