import { createHash } from 'node:crypto';
import { apostles, entityIri } from './public-content';

const origin = 'https://metahumotonic.com';
export const apostleGraphUrl = `${origin}/apostles/graph.jsonld`;
const scheme = `${origin}/apostles/#scheme`;
const collection = `${origin}/apostles/#collection`;
const source = `${origin}/wiki/data.json`;
const ref = (id: string) => ({ '@id': id });

// Only already-public identity, editorial summary and page URLs enter this graph.
// Private KG bindings, source paths and internal release data are never imported.
const publicRows = apostles.map(a => ({
  number: a.number, name: a.name, summary: a.summary,
  concept: entityIri(a.nodeId), page: `${origin}${a.href}`,
  wiki: `${origin}${a.sourceHref}`,
}));
if (publicRows.length !== 12 || publicRows.some((a, i) => a.number !== i + 1)
  || new Set(publicRows.map(a => a.concept)).size !== 12) {
  throw new Error('Apostle public graph requires twelve distinct ordered entries');
}
export const apostleGraphDigest = createHash('sha256')
  .update(JSON.stringify(publicRows), 'utf8').digest('hex');

export const apostleGraph = {
  '@context': {
    schema: 'https://schema.org/',
    skos: 'http://www.w3.org/2004/02/skos/core#',
    prov: 'http://www.w3.org/ns/prov#',
  },
  '@id': apostleGraphUrl,
  '@type': 'schema:Dataset',
  'schema:name': '12사도 공개 문서 연결 그래프',
  'schema:version': `sha256:${apostleGraphDigest}`,
  'schema:creativeWorkStatus': 'PUBLIC_EDITORIAL_PROJECTION_NOT_KG_CANON',
  'schema:mainEntity': ref(collection),
  'prov:wasDerivedFrom': ref(source),
  '@graph': [
    {
      '@id': scheme, '@type': 'skos:ConceptScheme',
      'skos:prefLabel': { '@value': '메타휴모토닉 사도 공개 용어', '@language': 'ko' },
      'skos:hasTopConcept': publicRows.map(a => ref(a.concept)),
      'skos:scopeNote': '기존 공개판의 편집 개념. KG의 자리·엔티티·정전 판정과 구분합니다.',
    },
    {
      '@id': collection, '@type': 'skos:OrderedCollection',
      'skos:prefLabel': { '@value': '12사도 공개판 순서', '@language': 'ko' },
      'skos:memberList': { '@list': publicRows.map(a => ref(a.concept)) },
    },
    ...publicRows.flatMap(a => [
      {
        '@id': a.concept, '@type': ['skos:Concept', 'schema:DefinedTerm'],
        'skos:prefLabel': { '@value': a.name, '@language': 'ko' },
        'skos:notation': `apostle-${a.number}`,
        'skos:inScheme': ref(scheme),
        'schema:description': a.summary,
        'skos:editorialNote': 'EDITORIAL_SUMMARY',
        ...(a.number === 9 ? {
          'skos:scopeNote': '기존 공개판의 예수 항목. 아텐과 동일시하거나 KG의 9번 자리 선택을 확정하지 않습니다.',
        } : {}),
        'schema:subjectOf': [ref(`${a.page}#page`), ref(`${a.wiki}#page`)],
        'prov:wasDerivedFrom': ref(source),
      },
      {
        '@id': `${a.page}#page`, '@type': 'schema:WebPage',
        'schema:url': a.page, 'schema:name': a.name,
        'schema:about': ref(a.concept), 'schema:mainEntity': ref(a.concept),
        'prov:wasDerivedFrom': ref(`${a.wiki}#page`),
      },
      {
        '@id': `${a.wiki}#page`, '@type': 'schema:WebPage',
        'schema:url': a.wiki, 'schema:name': a.name,
        'schema:about': ref(a.concept), 'schema:mainEntity': ref(a.concept),
        'prov:wasDerivedFrom': ref(source),
      },
    ]),
    { '@id': source, '@type': ['schema:Dataset', 'prov:Entity'], 'schema:url': source },
  ],
};
