import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const read = (relative) => readFile(path.join(dist, relative), 'utf8');
const exists = async (relative) => {
  try {
    await access(path.join(dist, relative));
    return true;
  } catch {
    return false;
  }
};

async function textArtifacts(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await textArtifacts(absolute));
    } else if (/\.(?:html|json|txt|xml|ttl|js|css)$/.test(entry.name)) {
      files.push(absolute);
    }
  }
  return files;
}

test('one origin exposes product root and preserved Book entry', async () => {
  const manifest = JSON.parse(await read('SURFACE_MANIFEST.json'));
  assert.equal(manifest.surface, 'combined');
  assert.equal(manifest.canonical_origin, 'https://metahumotonic.com');
  assert.equal(manifest.product_entrypoint, '/');
  assert.equal(manifest.publication_entrypoint, '/book/');
  assert.equal(manifest.consent_boundary.page_visit_may_start_worker, false);
  assert.equal(manifest.consent_boundary.page_visit_may_install_software, false);

  const productRoot = await read('index.html');
  const bookRoot = await read('book/index.html');
  const bookText = await read('book/read/index.html');
  assert.match(productRoot, /rel="canonical" href="https:\/\/metahumotonic\.com\/"/);
  assert.match(productRoot, /href="\/book\/"/);
  assert.match(bookRoot, /rel="canonical" href="https:\/\/metahumotonic\.com\/book\/"/);
  assert.match(bookRoot, /12 사도/);
  assert.match(bookText, /rel="canonical" href="https:\/\/metahumotonic\.com\/book\/read\/"/);
  assert.match(bookText, /선의 공리/);
});

test('combined artifact contains both enrollment and publication routes', async () => {
  for (const route of [
    'compute/index.html',
    '333/index.html',
    '.well-known/333-compute.json',
    'book/333/index.html',
    'apostles/index.html',
    'research/index.html',
    'ontology.ttl',
    'void.ttl',
    'llms.txt',
  ]) {
    assert.equal(await exists(route), true, `missing combined-site path: ${route}`);
  }
  for (const internal of ['canon', '333-book', '333-legacy']) {
    assert.equal(await exists(internal), false, `internal staging route escaped: ${internal}`);
  }

  const reference333 = await read('book/333/index.html');
  assert.match(reference333, /https:\/\/metahumotonic\.com\/book\/333\//);
  assert.match(reference333, /CANONICAL_USER/);
  assert.match(reference333, /ENGINEERING PROPOSAL/);

  const discovery = JSON.parse(await read('.well-known/333-compute.json'));
  assert.equal(discovery.protocol.kind, 'custom-discovery-only');
  assert.equal(discovery.discovery.may_start_worker, false);
  assert.equal(discovery.discovery.may_install_software, false);
});

test('semantic and crawler surfaces use the single .com origin', async () => {
  assert.match(await read('robots.txt'), /https:\/\/metahumotonic\.com\/sitemap\.xml/);
  const sitemap = await read('sitemap.xml');
  assert.match(sitemap, /https:\/\/metahumotonic\.com\/compute\//);
  assert.match(sitemap, /https:\/\/metahumotonic\.com\/book\//);
  assert.match(sitemap, /https:\/\/metahumotonic\.com\/apostles\//);

  const ontology = await read('ontology.ttl');
  const voidDataset = await read('void.ttl');
  assert.match(ontology, /@prefix mh:\s+<https:\/\/metahumotonic\.com\/ontology#>/);
  assert.match(ontology, /schema:url <https:\/\/metahumotonic\.com\/apostles\/orbital-cloud\/>/);
  assert.match(voidDataset, /<https:\/\/metahumotonic\.com\/book\/#kg>/);
  assert.match(voidDataset, /void:sparqlEndpoint <https:\/\/metahumotonic\.com\/sparql>/);

  for (const file of await textArtifacts(dist)) {
    const body = await readFile(file, 'utf8');
    assert.doesNotMatch(body, /metahumotonic\.book/, `stale .book origin in ${path.relative(dist, file)}`);
  }
});

test('compute CSP and origin anti-framing policy remain enforced', async () => {
  const compute = await read('compute/index.html');
  assert.match(compute, /connect-src 'none'/);
  assert.match(compute, /worker-src 'self'/);
  const nginx = await readFile(path.join(root, 'nginx.conf'), 'utf8');
  assert.match(nginx, /Content-Security-Policy "frame-ancestors 'none'" always/);
  assert.match(nginx, /X-Frame-Options "DENY" always/);
  assert.match(nginx, /location = \/js\/333-compute-worker\.js/);
  assert.match(nginx, /default-src 'none'; connect-src 'none'; script-src 'none'; worker-src 'none'/);
  assert.match(nginx, /Cross-Origin-Resource-Policy "same-origin" always/);
});
