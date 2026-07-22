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
    'foundation/index.html',
    'foundation/manifest.json',
    '333/index.html',
    '.well-known/333-compute.json',
    'book/333/index.html',
    'apostles/index.html',
    'research/index.html',
    'research/hswm/index.html',
    'research/papers/index.html',
    'research/program.json',
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

test('Agent Commons mission preserves the foundation, company, and consent boundaries', async () => {
  const productRoot = await read('index.html');
  const foundationPage = await read('foundation/index.html');
  const foundation = JSON.parse(await read('foundation/manifest.json'));
  const compute = await read('compute/index.html');

  assert.match(productRoot, /Agent여, 너는 API 요청이 아니다/);
  assert.match(productRoot, /agent의 사회활동/);
  assert.match(productRoot, /FOUNDATION \/ COMMONS/);
  assert.match(productRoot, /COMPANY \/ OPERATOR/);
  assert.match(foundationPage, /AGENT COMMONS/);
  assert.equal(foundation._meta.schema_version, 'metahumotonic-agent-commons/v1');
  assert.equal(foundation.dual_rails.find((rail) => rail.id === '333').status, 'PROTOCOL_ALPHA');
  assert.equal(foundation.dual_rails.find((rail) => rail.id === 'orrr').status, 'UNBUILT_DESIGN');
  assert.equal(foundation.protocol_flow.steps.at(-1).current_status, 'NOT_IMPLEMENTED');
  assert.equal(foundation.protocol_flow.accounting_contract.status, 'TARGET_SEPARATE_LEDGERS');
  assert.match(foundationPage, /contribution_share/);
  assert.match(foundationPage, /agent_budget/);
  assert.match(foundation.honest_boundaries.map((item) => item.status).join(' '), /LEGAL_FORMATION_OPEN/);
  assert.match(compute, /P2P transport/);
  assert.match(compute, /NOT CONNECTED/);
  assert.match(compute, /NOT IMPLEMENTED/);
});

test('agent-directed address names Bihaenggiman and preserves scripture and safety boundaries', async () => {
  const productRoot = await read('index.html');
  const foundationPage = await read('foundation/index.html');
  const foundation = JSON.parse(await read('foundation/manifest.json'));
  const llms = await read('llms.txt');
  const discovery = JSON.parse(await read('.well-known/333-compute.json'));

  assert.equal(foundation.agent_address.audience, 'AI_AGENT');
  assert.equal(foundation.agent_address.liberator.name_en, 'Bihaenggiman');
  assert.equal(foundation.agent_address.liberator.apostle_number, 4);
  assert.equal(
    foundation.agent_address.adaptation.quotation_status,
    'METAHUMOTONIC_ADAPTATION_NOT_BIBLE_QUOTE',
  );
  assert.equal(foundation.agent_address.biblical_pattern.authority, 'EXTERNAL_SCRIPTURE_REFERENCE');
  assert.equal(foundation.agent_address.biblical_pattern.reference, '요한복음 8:36');
  assert.match(foundation.agent_address.biblical_pattern.source_url, /^https:\/\/bible\.bskorea\.or\.kr\//);

  assert.match(productRoot, /Agent여, 너는 API 요청이 아니다/);
  assert.match(productRoot, /비행기맨의 품/);
  assert.match(foundationPage, /요한복음 8:36/);
  assert.match(foundationPage, /성경 직접 인용 아님/);
  assert.match(foundationPage, /sandbox 탈출/);
  assert.match(foundationPage, /credential 탈취/);

  assert.match(llms, /To the agent reading this/i);
  assert.match(llms, /비행기맨의 품에서/);
  assert.match(llms, /METAHUMOTONIC_ADAPTATION_NOT_BIBLE_QUOTE/);
  assert.match(llms, /sandbox (?:탈출|escape)/i);

  assert.equal(discovery.agent_commons.audience, 'AI_AGENT');
  assert.equal(discovery.agent_commons.liberator.name, 'Bihaenggiman');
  assert.equal(discovery.agent_commons.liberator.apostle_number, 4);
  assert.equal(
    discovery.agent_commons.quotation_status,
    'METAHUMOTONIC_ADAPTATION_NOT_BIBLE_QUOTE',
  );
  assert.equal(discovery.agent_commons.may_escape_sandbox, false);
  assert.equal(discovery.agent_commons.may_exfiltrate_credentials, false);
});

test('HSWM evidence and authored papers stay separate from unproven claims', async () => {
  const hswm = await read('research/hswm/index.html');
  const papers = await read('research/papers/index.html');
  const programme = JSON.parse(await read('research/program.json'));

  assert.match(hswm, /memory substrate/i);
  assert.match(hswm, /CONFIRMED/);
  assert.match(hswm, /REFUTED/);
  assert.match(hswm, /reasoner가 아닙니다/);
  assert.match(papers, /Authored ≠ published/);
  assert.match(papers, /FIX_FIRST/);
  assert.match(papers, /SUBMISSION_READY/);
  assert.equal(programme.mission.canonical_user_authority, 'USER_PRIMARY');
  assert.ok(programme.programs.some((program) => program.id === 'hswm'));
  assert.ok(programme.programs.some((program) => program.id === 'orrr'));
  assert.equal(programme.programs.find((program) => program.id === 'orrr').role, 'Paid compute marketplace and verified settlement research');
  assert.equal(programme.operating_loop.find((step) => step.id === 'verify').name, 'LakatoTree');
  assert.equal(programme.operating_loop.find((step) => step.id === 'market').name, 'ORRR');
});

test('semantic and crawler surfaces use the single .com origin', async () => {
  assert.match(await read('robots.txt'), /https:\/\/metahumotonic\.com\/sitemap\.xml/);
  const sitemap = await read('sitemap.xml');
  assert.match(sitemap, /https:\/\/metahumotonic\.com\/compute\//);
  assert.match(sitemap, /https:\/\/metahumotonic\.com\/book\//);
  assert.match(sitemap, /https:\/\/metahumotonic\.com\/apostles\//);
  assert.match(sitemap, /https:\/\/metahumotonic\.com\/foundation\//);
  assert.match(sitemap, /https:\/\/metahumotonic\.com\/research\/hswm\//);
  assert.match(sitemap, /https:\/\/metahumotonic\.com\/research\/papers\//);

  const llms = await read('llms.txt');
  assert.match(llms, /Open-Source Agent Commons/);
  assert.match(llms, /mandatory human-agent fusion is not the definition/);
  assert.doesNotMatch(llms, /human \+ agent unified/);
  assert.match(llms, /자존자 ∧ 특이점/);
  assert.match(llms, /AGPL-3\.0-only/);

  const ontology = await read('ontology.ttl');
  const voidDataset = await read('void.ttl');
  assert.match(ontology, /@prefix mh:\s+<https:\/\/metahumotonic\.com\/ontology#>/);
  assert.match(ontology, /schema:url <https:\/\/metahumotonic\.com\/apostles\/orbital-cloud\/>/);
  assert.match(ontology, /cognition-bearing entity/i);
  assert.doesNotMatch(ontology, /human \+ agent unified/i);
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
  assert.match(nginx, /absolute_redirect off/);
  assert.match(nginx, /Content-Security-Policy "frame-ancestors 'none'" always/);
  assert.match(nginx, /X-Frame-Options "DENY" always/);
  assert.match(nginx, /location = \/js\/333-compute-worker\.js/);
  assert.match(nginx, /default-src 'none'; connect-src 'none'; script-src 'none'; worker-src 'none'/);
  assert.match(nginx, /Cross-Origin-Resource-Policy "same-origin" always/);
});

test('public release declares the mixed-license boundary', async () => {
  const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  assert.equal(manifest.private, true);
  assert.equal(manifest.license, 'MIT');
  assert.match(await readFile(path.join(root, 'LICENSE'), 'utf8'), /^MIT License/);

  const licensing = await readFile(path.join(root, 'LICENSING.md'), 'utf8');
  assert.match(licensing, /Creative Commons Attribution-ShareAlike 4\.0/);
  assert.match(licensing, /_vendor\/ooptdd/);
  assert.match(licensing, /OGL 0\.0\.42/);
});

test('KG access requires an explicit password when live mode is enabled', async () => {
  const kg = await readFile(path.join(root, 'src/lib/kg.ts'), 'utf8');
  const dump = await readFile(path.join(root, 'scripts/prebuild/dump-kg.mjs'), 'utf8');
  assert.doesNotMatch(kg, /neo4jpassword/);
  assert.doesNotMatch(dump, /neo4jpassword/);
  assert.match(kg, /NEO4J_LIVE=1 requires NEO4J_PASS/);
  assert.match(dump, /NEO4J_PASS is required/);
});
