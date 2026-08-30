import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFile(path.join(root, relative), 'utf8');

test('ontology explorer is a noindex shell with no embedded projection', async () => {
  const source = await read('src/pages/wiki/ontology/index.astro');
  const script = await read('public/js/ontology-explorer.js');
  const styles = await read('src/styles/wiki.css');

  assert.match(source, /noindex,nofollow,noarchive/);
  assert.match(source, /data-api-base="\/api\/v1\/ontology"/);
  assert.match(source, /X-Ontology-Key/);
  assert.match(source, /sessionStorage/);
  assert.doesNotMatch(source, /예수|검은 태양신 아텐|eced120ed8ae91e3/);

  assert.match(script, /'X-Ontology-Key': activeKey/);
  assert.match(script, /window\.sessionStorage/);
  assert.doesNotMatch(script, /localStorage/);
  assert.doesNotMatch(script, /\.innerHTML\s*=/);
  assert.doesNotMatch(script, /eced120ed8ae91e3|0a4d4dbc15c60ee8/);
  assert.match(script, /stable_ref/);
  assert.match(script, /verification_path/);
  assert.match(script, /default_servable=false/);
  assert.match(script, /validatePinnedRelease/);
  assert.match(script, /ACTIVE_INTERNAL_CONFLICT_AWARE/);
  assert.match(script, /selection_state === 'CONFLICT_PENDING'\) return '선택 미결'/);
  assert.match(styles, /\.ontology-explorer \[hidden\]\s*\{\s*display:\s*none !important/);
});

test('built explorer remains internal-only and outside the sitemap', async () => {
  const html = await read('dist/wiki/ontology/index.html');
  const sitemap = await read('dist/sitemap-0.xml');
  const surface = JSON.parse(await read('dist/SURFACE_MANIFEST.json'));
  const explorerStart = html.indexOf('id="ontology-explorer"');
  const explorerEnd = html.indexOf('<script src="/js/ontology-explorer.js"', explorerStart);
  assert.ok(explorerStart >= 0 && explorerEnd > explorerStart, 'explorer content boundary missing');
  const explorerShell = html.slice(explorerStart, explorerEnd);

  assert.match(html, /noindex,nofollow,noarchive/);
  assert.match(html, /\/js\/ontology-explorer\.js/);
  assert.match(explorerShell, /내부 snapshot 연결/);
  assert.doesNotMatch(explorerShell, /예수|검은 태양신 아텐|eced120ed8ae91e3/);
  assert.doesNotMatch(sitemap, /\/wiki\/ontology\//);
  assert.deepEqual(surface.internal_shell_routes, ['/wiki/ontology/']);
  assert.equal(surface.product_routes.includes('/wiki/ontology/'), false);
  assert.equal(surface.publication_routes.includes('/wiki/ontology/'), false);
});
