import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const graph = JSON.parse(
  await readFile(new URL('../dist/foundation/graph.jsonld', import.meta.url), 'utf8'),
);
const usl = JSON.parse(
  await readFile(new URL('../dist/foundation/usl.json', import.meta.url), 'utf8'),
);
const byId = (id) => graph['@graph'].find((entity) => entity['@id'] === id);
const base = 'https://metahumotonic.com/foundation/';

test('Foundation graph separates initiative, charter, public page, and research evidence', () => {
  assert.equal(graph['@id'], `${base}graph.jsonld`);
  assert.equal(graph['schema:mainEntity']['@id'], `${base}#initiative`);

  const initiative = byId(`${base}#initiative`);
  const charter = byId(`${base}#charter`);
  const page = byId(`${base}#about-page`);
  const report = byId(`${base}#research-report`);

  assert.equal(initiative['@type'], 'schema:Project');
  assert.equal(initiative['mh:status'], 'PUBLIC_OPEN_SOURCE_INITIATIVE');
  assert.equal(initiative['mh:legalStatus'], 'NOT_YET_LEGALLY_INCORPORATED');
  assert.equal(initiative['mh:legalIncorporationClaimed'], false);
  assert.equal(initiative['mh:livePayoutAvailable'], false);
  assert.equal(initiative['mh:consentlessComputeAllowed'], false);
  assert.equal(initiative['schema:subjectOf'][0]['@id'], charter['@id']);
  assert.equal(initiative['schema:subjectOf'][1]['@id'], report['@id']);

  assert.equal(charter['@type'], 'schema:DigitalDocument');
  assert.equal(charter['schema:url'], 'https://github.com/gj3447/metahumotonic-foundation/blob/main/CHARTER.md');
  assert.equal(charter['schema:about']['@id'], initiative['@id']);
  assert.equal(page['@type'], 'schema:AboutPage');
  assert.equal(page['schema:mainEntity']['@id'], initiative['@id']);
  assert.equal(report['@type'], 'schema:Report');
  assert.equal(report['mh:authority'], 'SECONDARY_AI_RESEARCH_SYNTHESIS');
  assert.equal(report['mh:notSafetyCertification'], true);
});

test('Foundation USL projection preserves graph identities, status, and direction', () => {
  const entities = graph['@graph'];
  assert.equal(usl.scope, 'PUBLIC_PROJECTION_NOT_KG_CANON');
  assert.equal(usl.source, graph['@id']);
  assert.deepEqual(usl.nodes.map((node) => node.uid).sort(), entities.map((entity) => entity['@id']).sort());
  for (const entity of entities) {
    const node = usl.nodes.find((candidate) => candidate.uid === entity['@id']);
    assert.equal(node.properties.semanticType instanceof Array ? node.properties.semanticType.join('|') : node.properties.semanticType,
      entity['@type'] instanceof Array ? entity['@type'].join('|') : entity['@type']);
    assert.equal(node.properties.status, entity['mh:status']);
    assert.equal(node.properties.authority, entity['mh:authority']);
    assert.equal(node.properties.source, entity['prov:wasDerivedFrom']['@id']);
  }
  const initiativeToCharter = usl.relations.find((edge) => edge.from_uid === `${base}#initiative` && edge.to_uid === `${base}#charter`);
  assert.equal(initiativeToCharter?.type, 'https://schema.org/subjectOf');
  assert.ok(usl.relations.every((edge) => usl.nodes.some((node) => node.uid === edge.from_uid) && usl.nodes.some((node) => node.uid === edge.to_uid)));
});
