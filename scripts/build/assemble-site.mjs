import {
  existsSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const dist = resolve(root, 'dist');
const required = [
  'index.html',
  'book/index.html',
  'book/read/index.html',
  'book/333/index.html',
  'compute/index.html',
  'foundation/index.html',
  'foundation/manifest.json',
  'research/hswm/index.html',
  'research/papers/index.html',
  'research/program.json',
  'wiki/index.html',
  'wiki/authority/index.html',
  'wiki/open-source/index.html',
  'wiki/axioms/index.html',
  'wiki/worldview/index.html',
  'wiki/apostles/index.html',
  'wiki/data.json',
  '.well-known/333-compute.json',
];

for (const relative of required) {
  if (!existsSync(resolve(dist, relative))) {
    throw new Error(`Astro output is incomplete: dist/${relative} is required.`);
  }
}

// The former visual demo remains source history only and must not escape into
// the public release. All current Book paths are first-class Astro routes, so
// development and production resolve the same URLs.
rmSync(resolve(dist, '333-legacy'), { recursive: true, force: true });

const manifest = {
  schema_version: 'metahumotonic-site/v2',
  surface: 'combined',
  canonical_origin: 'https://metahumotonic.com',
  product_entrypoint: '/',
  publication_entrypoint: '/book/',
  product_routes: [
    '/',
    '/compute/',
    '/foundation/',
    '/foundation/manifest.json',
    '/research/hswm/',
    '/research/papers/',
    '/research/program.json',
    '/wiki/',
    '/wiki/data.json',
    '/333/',
    '/api/',
    '/.well-known/333-compute.json',
  ],
  publication_routes: [
    '/book/',
    '/book/read/',
    '/book/333/',
    '/apostles/',
    '/domains/',
    '/explore/',
    '/wiki/authority/',
    '/wiki/open-source/',
    '/wiki/axioms/',
    '/wiki/worldview/',
    '/wiki/apostles/',
    '/research/',
    '/skills/',
    '/theories/',
    '/ontology.ttl',
    '/void.ttl',
    '/llms.txt',
  ],
  consent_boundary: {
    page_visit_may_start_worker: false,
    page_visit_may_install_software: false,
  },
};
writeFileSync(
  resolve(dist, 'SURFACE_MANIFEST.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

console.log('site-assembly=ok origin=metahumotonic.com book=/book/');
