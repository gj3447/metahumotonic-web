import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const artifact = JSON.parse(await readFile(new URL('../src/data/learning-hub.json', import.meta.url), 'utf8'));
const readDist = name => readFile(new URL(`../dist/${name}`, import.meta.url), 'utf8');

test('public snapshot content, JSON-LD and USL keep the same digest and native identities', async () => {
  const { sourceDigest, relationDescriptions, jsonld, usl, ...source } = artifact;
  assert.equal(sourceDigest, `sha256:${createHash('sha256').update(JSON.stringify(source)).digest('hex')}`);
  assert.equal(jsonld['mh:sourceDigest'], sourceDigest);
  assert.deepEqual(JSON.parse(await readDist('learn/graph.jsonld')), jsonld);
  assert.deepEqual(JSON.parse(await readDist('learn/usl.json')), usl);
  const published = JSON.parse(await readDist('learn/data.json'));
  assert.equal(published.sourceDigest, sourceDigest);
  assert.deepEqual(published.nodes, source.nodes);
  assert.doesNotMatch(JSON.stringify(artifact), /\/home\/|\/Users\/|kg:\/\/|bolt:|MHB_|password|capability_url/);
});
test('every public entity and reading path has a rendered anchor; local resources exist', async () => {
  const html = await readDist('learn/index.html');
  for (const node of artifact.nodes) {
    assert.ok(html.includes(`id="entity-${node.id}"`), node.id);
    assert.equal(node.public, true);
    if (node.href.startsWith('https://metahumotonic.com/')) await access(new URL(`../dist/${new URL(node.href).pathname.slice(1)}index.html`, import.meta.url));
  }
  for (const path of artifact.paths) assert.ok(html.includes(`id="path-${path.id}"`));
  for (const relation of Object.keys(artifact.relationDescriptions)) assert.ok(html.includes(`id="relation-${relation.toLowerCase().replaceAll('_', '-')}"`));
  assert.match(html, /<noscript>/);
  assert.equal((html.match(/data-learning-id=/g) ?? []).length, artifact.nodes.length);
});
test('visible graph labels retain reviewed kind, authority, relation and ACTIVE status', async () => {
  const html = await readDist('learn/index.html');
  assert.match(html, /class="semantic-legend"/);
  for (const node of artifact.nodes) {
    assert.ok(html.includes(`data-learning-id="${node.id}" data-kind="${node.kind}" data-authority="${node.authority}"`), node.id);
  }
  for (const edge of artifact.edges) {
    const marker = `id="edge-${edge.id}" data-edge-relation="${edge.relation}" data-edge-status="${edge.status}"`;
    assert.equal(html.includes(marker), edge.status === 'ACTIVE', edge.id);
  }
});
test('home exposes beginner, source-code and actual video paths without loading third-party players', async () => {
  const html = await readDist('index.html');
  assert.match(html, /처음이라면 여기부터/);
  assert.match(html, /id="start"/);
  assert.match(html, /https:\/\/github.com\/gj3447/);
  for (const video of artifact.nodes.filter(node => node.kind === 'video')) assert.ok(html.includes(video.href));
  assert.doesNotMatch(html, /<iframe|youtube.com\/embed|youtube-nocookie/);
});

const axioms = JSON.parse(await readFile(new URL('../src/data/axioms.json', import.meta.url), 'utf8')).axioms;
const apostles = JSON.parse(await readFile(new URL('../src/data/apostles.json', import.meta.url), 'utf8')).apostles;
const introductions = JSON.parse(await readFile(new URL('../src/data/apostle-introductions.json', import.meta.url), 'utf8')).items;
test('all twelve axiom definitions retain exact canon text in HTML and semantic exports', async () => {
  const html = await readDist('axioms/index.html');
  for (const axiom of axioms) {
    const id = axiom.n === 3 ? 'good' : axiom.n === 12 ? 'metahumotonic' : `axiom-${axiom.n}`;
    const node = artifact.nodes.find(node => node.id === id);
    assert.equal(node.summary, axiom.body);
    assert.equal(node.authority, 'PRIMARY_SOURCE');
    assert.equal(node.href, `https://metahumotonic.com/axioms/#axiom-${axiom.n}`);
    assert.ok(html.includes(`<blockquote>${axiom.body}</blockquote>`));
    const entity = artifact.jsonld['@graph'].find(item => item['@id'].endsWith(`#entity-${id}`));
    assert.deepEqual(entity['skos:definition'], { '@value': axiom.body, '@language': 'ko' });
  }
});
test('apostles are editorial worldview entities with readable routes, not software or employees', async () => {
  assert.equal(artifact.nodes.filter(node => node.kind === 'apostle').length, 12);
  for (const apostle of apostles) {
    const node = artifact.nodes.find(node => node.id === `apostle-${apostle.id}`);
    assert.equal(node.title, apostle.name);
    assert.equal(node.summary, introductions.find(item => item.number === apostle.id).summary);
    assert.equal(node.authority, 'EDITORIAL_SUMMARY');
    const html = await readDist(`apostles/${apostle.slug}/index.html`);
    assert.ok(html.includes(node.title));
    assert.ok(html.includes(`href="/wiki/apostles/${apostle.slug}/"`));
    assert.doesNotMatch(html, /"@type":"Person"|"affiliation"|mind_path|\/home\//);
  }
});
test('the company pages expose all three primary entries and semantic entity references', async () => {
  for (const route of ['', 'projects/', 'apostles/', 'axioms/', 'philosophy/', 'agents/']) {
    const html = await readDist(route + 'index.html');
    for (const entry of ['projects', 'apostles', 'axioms', 'agents']) assert.ok(html.includes(`href="/${entry}/"`));
    assert.ok(html.includes('https://metahumotonic.com/#website'));
  }
  const agent = await readDist('agents/index.html');
  assert.match(agent, /Ultra Safety AI/);
  assert.match(agent, /Ultra Safety Agent/);
  assert.match(agent, /연구 목표/);
  const home = await readDist('index.html');
  assert.match(home, /THE AXIOM OF GOOD/);
  assert.match(home, /THE TWELVE APOSTLES/);
});
