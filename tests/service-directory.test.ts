import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { directoryId, directoryInternalId, directoryJsonLd, directoryProjectId, directoryProjects, directoryProjection, directoryUsl, internalSystems, isSafeDirectoryLink, publicDirectoryServices, services } from '../src/lib/service-directory.ts';

const readDist = (path: string) => readFile(new URL(`../dist/${path}`, import.meta.url), 'utf8');

test('the service directory is a reviewed public projection with explicit access boundaries', () => {
  const projection = directoryProjection();
  assert.equal(projection.schemaVersion, 'metahumotonic-service-directory/v1');
  assert.equal(projection.publication.default, 'deny');
  assert.equal(projection.publication.liveStatus, false);
  assert.equal(projection.services.length, services.length);
  assert.equal(new Set(projection.services.map(service => service.id)).size, services.length);
  assert.equal(projection.projects.length, 9);
  assert.equal(projection.internalSystems.length, 5);
  assert.ok(projection.services.every(service => service.access === 'public' && isSafeDirectoryLink(service.href)));
  assert.ok(projection.internalSystems.every(system => system.access === 'internal-auth' && !('href' in system)));
  assert.deepEqual(directoryProjects().filter(project => project.liveHref).map(project => project.id).sort(), ['333', 'soopoolim']);
  assert.doesNotMatch(JSON.stringify(projection), /192\.168\.|10\.\d+\.\d+\.|bolt:|\/home\/|\/Users\/|vault|password|token|api_key/i);
});

test('links fail closed and the graph and USL use the same public identities', () => {
  for (const href of ['http://example.com/', 'https://evil.example/', 'https://user:pass@github.com/gj3447', '//example.com', '/projects/../private', '/\\evil']) {
    assert.equal(isSafeDirectoryLink(href), false, href);
  }
  const publicServices = publicDirectoryServices();
  const jsonLd = directoryJsonLd();
  const usl = directoryUsl();
  assert.equal(jsonLd['@graph'].length, publicServices.length + directoryProjects().length + internalSystems.length + 2);
  assert.equal(usl.nodes.length, publicServices.length + directoryProjects().length + internalSystems.length + 1);
  assert.equal(usl.relations.length, usl.nodes.length);
  assert.equal(usl.nodes[0].uid, directoryId);
  assert.ok(usl.relations.every(edge => usl.nodes.some(node => node.uid === edge.from_uid) && usl.nodes.some(node => node.uid === edge.to_uid)));
  assert.deepEqual(publicServices.map(service => `${directoryId}-${service.id}`), usl.nodes.slice(1, 1 + publicServices.length).map(node => node.uid));
  assert.ok(!JSON.stringify(jsonLd).includes('/learn/#entity-333'), 'unknown learning identity must not be emitted');
  for (const project of directoryProjects()) assert.ok(usl.nodes.some(node => node.uid === directoryProjectId(project.id)));
  for (const system of internalSystems) {
    const node = usl.nodes.find(node => node.uid === directoryInternalId(system.id));
    assert.ok(node);
    assert.equal('locator' in node.properties, false);
  }
});

test('the rendered hub has every project, verified access paths and data alternatives', async () => {
  const html = await readDist('services/index.html');
  const home = await readDist('index.html');
  const manifest = JSON.parse(await readDist('SURFACE_MANIFEST.json'));
  assert.ok(manifest.product_routes.includes('/operations/'));
  const data = JSON.parse(await readDist('services/data.json'));
  const graph = JSON.parse(await readDist('services/graph.jsonld'));
  const usl = JSON.parse(await readDist('services/usl.json'));
  assert.deepEqual(data, directoryProjection());
  assert.deepEqual(graph, directoryJsonLd());
  assert.deepEqual(usl, directoryUsl());
  for (const project of directoryProjects()) assert.match(html, new RegExp(`data-service-project="${project.id}"`));
  for (const service of publicDirectoryServices()) assert.ok(html.includes(`href="${service.href}"`), service.id);
  for (const href of ['/services/data.json', '/services/graph.jsonld', '/services/usl.json']) assert.ok(html.includes(`href="${href}"`));
  assert.match(home, /href="\/services\/"/);
  assert.doesNotMatch(html, /192\.168\.|bhgman\.iptime|\/api\/mcp\/vault|REDIS_PASSWORD/i);
});

test('obsolete public infrastructure catalog is retired while developer routes remain useful', async () => {
  const oldCatalog = JSON.parse(await readDist('api/services.json'));
  const oldMcpSnapshot = JSON.parse(await readDist('mcp/manifest.json'));
  const mcpGuide = await readDist('mcp/llms.txt');
  const siteGuide = await readDist('llms.txt');
  assert.equal(oldCatalog.retired, true);
  assert.equal(oldCatalog.replacement, '/services/data.json');
  assert.doesNotMatch(JSON.stringify(oldCatalog), /neo4j|pgadmin|headscale|192\.168\./i);
  assert.equal(oldMcpSnapshot.retired, true);
  assert.equal(oldMcpSnapshot.manifest, '/api/mcp/manifest');
  assert.doesNotMatch(JSON.stringify(oldMcpSnapshot), /servers|vault|password|192\.168\./i);
  assert.match(mcpGuide, /retired on 2026-09-28/);
  assert.doesNotMatch(mcpGuide + siteGuide, /\/api\/mcp\/vault|registry password \(6 digits\)|PBKDF2-SHA256/i);
  for (const route of ['developers/index.html', 'api/index.html', 'mcp/index.html']) {
    const html = await readDist(route);
    assert.match(html, /href="\/services\/"/);
    assert.doesNotMatch(html, /bhgman\.iptime|192\.168\.|\/api\/mcp\/vault|REDIS_PASSWORD/i);
  }
});

test('operator entry links the private dashboard without publishing its inventory or transport', async () => {
  const html = await readDist('operations/index.html');
  const home = await readDist('index.html');
  const manifest = JSON.parse(await readDist('SURFACE_MANIFEST.json'));
  assert.ok(manifest.product_routes.includes('/operations/'));
  const usl = directoryUsl();
  const entry = directoryJsonLd()['@graph'].find(node => node['@id'] === `${directoryId}-operations`);
  assert.deepEqual(entry?.['schema:about'], { '@id': directoryInternalId('dashboard') });
  assert.ok(usl.relations.some(edge => edge.from_uid === `${directoryId}-operations` && edge.to_uid === directoryInternalId('dashboard') && edge.type === 'DESCRIBES_INTERNAL'));
  assert.match(html, /href="https:\/\/github.com\/gj3447\/METAHUMOTONIC_DASHBOARD"/);
  assert.match(html, /GitHub에서 열기/);
  assert.match(html, /접근권한/);
  assert.match(home, /href="\/operations\/"/);
  assert.doesNotMatch(html + JSON.stringify(directoryProjection()), /192\.168\.|100\.64\.|127\.0\.0\.1|\/home\/|\/Users\/|qm guest|ssh -|data\/snapshots/);
});
