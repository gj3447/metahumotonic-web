import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

// The public hub keeps one reviewed catalog and derives its JSON-LD/USL views
// from it. This prevents a new public entity from gaining a different identity,
// provenance, status, or relationship direction in one representation only.
const path = 'src/data/learning-hub.json';
const catalog = JSON.parse(await readFile(path, 'utf8'));
const base = 'https://metahumotonic.com/learn/';
const iri = (id) => `${base}#entity-${id}`;
const predicate = (relation) => `${base}#relation-${relation.toLowerCase().replaceAll('_', '-')}`;
const types = {
  apostle: 'DefinedTerm', concept: 'DefinedTerm', article: 'LearningResource',
  project: 'SoftwareApplication', repository: 'SoftwareSourceCode',
  channel: 'CollectionPage', video: 'VideoObject',
};
const raw = (({ schema, edition, publication, nodes, edges, paths }) => ({ schema, edition, publication, nodes, edges, paths }))(catalog);
const sourceDigest = `sha256:${createHash('sha256').update(JSON.stringify(raw)).digest('hex')}`;
const activeTargets = (node, relation) => catalog.edges
  .filter((edge) => edge.from === node.id && edge.relation === relation && edge.status === 'ACTIVE')
  .map((edge) => ({ '@id': iri(edge.to) }));

const entity = (node) => {
  const result = {
    '@id': iri(node.id), '@type': types[node.kind], name: node.title,
    description: node.summary, url: node.href,
  };
  if (node.kind === 'concept' || node.kind === 'apostle') {
    result['skos:prefLabel'] = { '@value': node.title, '@language': 'ko' };
    if (node.authority === 'PRIMARY_SOURCE') result['skos:definition'] = { '@value': node.summary, '@language': 'ko' };
  }
  const about = activeTargets(node, 'INTRODUCES');
  if (about.length) result.about = about;
  result['mh:authority'] = node.authority;
  result['mh:reviewedAt'] = node.reviewedAt;
  result['prov:wasDerivedFrom'] = node.sources.map((source) => ({ '@id': source.url }));
  if (node.semanticType) result.additionalType = node.semanticType;
  if (node.status) result['mh:status'] = node.status;
  for (const relation of Object.keys(catalog.relationDescriptions)) {
    const targets = activeTargets(node, relation);
    if (targets.length) result[predicate(relation)] = targets;
  }
  if (node.kind === 'repository') result.codeRepository = node.href;
  return result;
};

const jsonld = {
  '@context': {
    '@version': 1.1, skos: 'http://www.w3.org/2004/02/skos/core#', '@vocab': 'https://schema.org/',
    mh: `${base}#`, rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#', prov: 'http://www.w3.org/ns/prov#',
  },
  '@id': `${base}graph.jsonld`, 'mh:sourceDigest': sourceDigest,
  '@graph': [
    { '@id': base, '@type': 'CollectionPage', name: 'MetaHumotonic · 처음부터 이어 읽기', url: base,
      hasPart: catalog.paths.map((item) => ({ '@id': `${base}#path-${item.id}` })) },
    ...catalog.nodes.map(entity),
    ...catalog.edges.map((edge) => ({
      '@id': `${base}#edge-${edge.id}`, '@type': 'rdf:Statement',
      'rdf:subject': { '@id': iri(edge.from) }, 'rdf:predicate': { '@id': predicate(edge.relation) },
      'rdf:object': { '@id': iri(edge.to) }, description: edge.label,
      'mh:status': edge.status, 'mh:authority': edge.authority,
      'prov:wasDerivedFrom': { '@id': edge.source },
    })),
    ...catalog.paths.map((item) => ({
      '@id': `${base}#path-${item.id}`, '@type': 'ItemList', name: item.title, description: item.description,
      itemListOrder: 'https://schema.org/ItemListOrderAscending',
      itemListElement: item.steps.map((step, index) => ({ '@type': 'ListItem', position: index + 1, item: { '@id': iri(step) } })),
    })),
    ...Object.entries(catalog.relationDescriptions).map(([name, description]) => ({
      '@id': predicate(name), '@type': 'rdf:Property', name, description,
    })),
  ],
};
const usl = {
  nodes: catalog.nodes.map((node) => ({
    uid: iri(node.id), properties: {
      name: node.title, kind: node.kind, locator: node.href, authority: node.authority,
      ...(node.semanticType ? { semanticType: node.semanticType } : {}),
      ...(node.status ? { status: node.status } : {}),
    },
  })),
  relations: catalog.edges.map((edge) => ({
    uid: `${base}#edge-${edge.id}`, from_uid: iri(edge.from), to_uid: iri(edge.to), type: edge.relation,
    properties: { description: JSON.stringify({ label: edge.label, meaning: catalog.relationDescriptions[edge.relation], status: edge.status, authority: edge.authority, source: edge.source }) },
  })),
};

const next = { ...raw, sourceDigest, relationDescriptions: catalog.relationDescriptions, jsonld, usl };
await writeFile(path, `${JSON.stringify(next, null, 2)}\n`);
console.log(`learning-hub projections refreshed: ${sourceDigest}`);
