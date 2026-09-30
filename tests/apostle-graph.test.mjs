import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const graph = JSON.parse(await read('dist/apostles/graph.jsonld'));
const source = JSON.parse(await read('src/data/apostles.json')).apostles;
const byId = id => graph['@graph'].find(node => node['@id'] === id);
const origin = 'https://metahumotonic.com';

test('all twelve concepts reuse the learning graph identity and resolve both public pages', async () => {
  assert.equal(new Set(graph['@graph'].map(n => n['@id'])).size, graph['@graph'].length);
  const order = byId(`${origin}/apostles/#collection`)['skos:memberList']['@list'];
  assert.deepEqual(order.map(n => n['@id']), source.map(a => `${origin}/learn/#entity-apostle-${a.id}`));
  for (const a of source) {
    const id = `${origin}/learn/#entity-apostle-${a.id}`;
    const concept = byId(id);
    assert.equal(concept['skos:prefLabel']['@value'], a.name);
    assert.equal(concept['skos:editorialNote'], 'EDITORIAL_SUMMARY');
    for (const prefix of ['apostles', 'wiki/apostles']) {
      const path = `${prefix}/${a.slug}/`;
      const html = await read(`dist/${path}index.html`);
      const scripts = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)].map(m => JSON.parse(m[1]));
      assert.ok(scripts.some(s => s['@id'] === `${origin}/${path}#page` && s.mainEntity?.some(e => e['@id'] === id)));
      assert.match(html, /href="(?:https:\/\/metahumotonic.com)?\/apostles\/graph.jsonld"/);
      assert.deepEqual(byId(`${origin}/${path}#page`)['schema:about'], { '@id': id });
    }
  }
});

test('editorial data cannot claim KG identity or leak the internal projection', async () => {
  const text = JSON.stringify(graph);
  assert.equal(graph['schema:creativeWorkStatus'], 'PUBLIC_EDITORIAL_PROJECTION_NOT_KG_CANON');
  assert.match(graph['schema:version'], /^sha256:[a-f0-9]{64}$/);
  assert.doesNotMatch(text, /sym:|stable_ref|mtg1-|\/home\/|\/Users\/|sameAs|exactMatch|X-Ontology-Key|USER_PRIMARY/);
  assert.ok(byId(`${origin}/learn/#entity-apostle-9`)['skos:scopeNote']);
  const wiki = await read('dist/wiki/apostles/jesus/index.html');
  assert.match(wiki, /공개 항목 ID/);
  assert.doesNotMatch(wiki, /<dt>KG ID<\/dt>/);
  assert.match(wiki, /9번 자리 선택을 확정하지 않습니다/);
  const nginx = await read('nginx.conf');
  assert.match(nginx, /location = \/apostles\/graph\.jsonld\s*\{\s*types \{ \}\s*default_type application\/ld\+json;/);
});

async function referenceValidator() {
  const script = await read('public/js/ontology-explorer.js');
  const root = { dataset: { projectionId: 'test-release' }, addEventListener() {} };
  const context = vm.createContext({
    URL, TextEncoder, Map, Set,
    document: { getElementById: () => root },
    window: { sessionStorage: { getItem: () => '' } },
  });
  vm.runInContext(script.replace('  if (restoredKey) connect(restoredKey);', '  globalThis.validateReferences = readWebReferences;'), context);
  return context.validateReferences;
}

function directory() {
  const meta = { content_sha256: 'a'.repeat(64), projection_id: 'test-release', publication_status: 'INTERNAL_ONLY', release_state: 'ACTIVE_INTERNAL_CONFLICT_AWARE', schema_version: 'metahumotonic-public-graph/v1' };
  const slots = source.map(a => ({ public_id: `mtg1-${a.id.toString(16).padStart(16, '0')}`, position: a.id, selection_state: a.id === 9 ? 'CONFLICT_PENDING' : 'SELECTED' }));
  return {
    release: { meta, data: { collections: { apostles: slots } } },
    body: { meta, data: { mapping_version: 'apostle-web-references/v1', items: slots.map((slot, i) => ({ ...slot, web_reference: {
      concept_iri: `${origin}/learn/#entity-apostle-${slot.position}`,
      page_url: `${origin}/apostles/${source[i].slug}/`, wiki_url: `${origin}/wiki/apostles/${source[i].slug}/`, graph_url: `${origin}/apostles/graph.jsonld`, authority: 'EDITORIAL_SUMMARY', identity_equivalence: false,
      mapping_status: slot.position === 9 ? 'CONFLICT_REFERENCE_ONLY' : 'EDITORIAL_REFERENCE',
    } })) } },
  };
}

test('explorer binds web links to the same release and preserves the conflict boundary', async () => {
  const validate = await referenceValidator();
  const { body, release } = directory();
  assert.equal(validate(body, release).size, 12);
  for (const mutate of [
    b => { b.meta.content_sha256 = 'b'.repeat(64); },
    b => { b.data.items[1].public_id = b.data.items[0].public_id; },
    b => { b.data.items[8].web_reference.mapping_status = 'EDITORIAL_REFERENCE'; },
    b => { b.data.items[0].web_reference.identity_equivalence = true; },
    b => { b.data.items[0].web_reference.page_url = 'https://evil.example/apostles/test/'; },
    b => { b.data.items[0].web_reference.page_url += '?key=secret'; },
    b => { b.data.items[0].web_reference.concept_iri = `${origin}/learn/#entity-apostle-2`; },
  ]) {
    const changed = structuredClone(body);
    mutate(changed);
    assert.throws(() => validate(changed, release));
  }
});
