import { foundationGraph } from './graph.jsonld';

export const prerender = true;

type Entity = Record<string, unknown> & { '@id': string; '@type': string | string[] };
const entities = foundationGraph['@graph'] as Entity[];
const entityIds = new Set(entities.map((entity) => entity['@id']));
const predicates = ['schema:subjectOf', 'schema:about', 'schema:mainEntity', 'schema:mainEntityOfPage'] as const;

function targets(value: unknown): string[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values
    .filter((item): item is { '@id': string } => typeof item === 'object' && item !== null && typeof item['@id'] === 'string')
    .map((item) => item['@id'])
    .filter((id) => entityIds.has(id));
}

const relations = entities.flatMap((entity) => predicates.flatMap((predicate) => targets(entity[predicate]).map((to) => ({
  uid: `${foundationGraph['@id']}#edge-${entity['@id'].split('#')[1]}-${predicate.split(':')[1]}-${to.split('#')[1]}`,
  from_uid: entity['@id'],
  to_uid: to,
  type: `https://schema.org/${predicate.split(':')[1]}`,
  properties: { source: foundationGraph['@id'], authority: 'PUBLIC_SOURCE_PROJECTION', status: 'PUBLISHED' },
}))));

export const foundationUsl = {
  source: foundationGraph['@id'],
  scope: 'PUBLIC_PROJECTION_NOT_KG_CANON',
  nodes: entities.map((entity) => ({
    uid: entity['@id'],
    properties: {
      name: entity['schema:name'],
      semanticType: entity['@type'],
      locator: entity['schema:url'],
      status: entity['mh:status'],
      authority: entity['mh:authority'],
      source: (entity['prov:wasDerivedFrom'] as { '@id'?: string } | undefined)?.['@id'],
      ...(entity['mh:legalStatus'] ? { legalStatus: entity['mh:legalStatus'] } : {}),
      ...(typeof entity['mh:legalIncorporationClaimed'] === 'boolean' ? { legalIncorporationClaimed: entity['mh:legalIncorporationClaimed'] } : {}),
    },
  })),
  relations,
};

export function GET() {
  return new Response(`${JSON.stringify(foundationUsl, null, 2)}\n`, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
