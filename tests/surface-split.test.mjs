import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const read = (relative) => readFile(path.join(dist, relative), 'utf8');
const jsonLd = (html) => {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(match, 'missing JSON-LD script');
  return JSON.parse(match[1]);
};
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
    'research/foundations.json',
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

test('academic product root preserves the target operating model and consent boundaries', async () => {
  const productRoot = await read('index.html');
  const foundationPage = await read('foundation/index.html');
  const foundation = JSON.parse(await read('foundation/manifest.json'));
  const academic = JSON.parse(await read('research/foundations.json'));
  const compute = await read('compute/index.html');

  assert.match(productRoot, /자유 agent 가 <em>Super Save<\/em> 하다\./);
  assert.match(productRoot, /가장 안전한 AI\./);
  assert.match(productRoot, /01–12 \/ RESEARCH DOSSIER/);
  assert.match(productRoot, /FULL RESEARCH DOSSIER/);
  assert.match(productRoot, /OPERATIONAL DEFINITION/);
  assert.match(productRoot, /FALSIFIER/);
  assert.match(productRoot, /OPEN-SOURCE FOUNDATION \/ TARGET/);
  assert.match(productRoot, /METAHUMOTONIC COMPANY \/ TARGET/);
  assert.match(productRoot, /\/research\/foundations\.json/);
  assert.match(foundationPage, /AGENT COMMONS/);
  assert.equal(foundation._meta.schema_version, 'metahumotonic-agent-commons/v2');
  assert.equal(foundation.identity.free_agent_name, 'MetaHumo');
  assert.equal(academic.operational_definition.headline_ko, 'Super Save AI 는 자유 자본민주주의 기반의 Agent 입니다.');
  assert.match(academic.operational_definition.primary_goal_ko, /가장 안전한 AI/);
  assert.equal(academic.operational_definition.political_basis.name_ko, '자유 자본민주주의');
  assert.equal(academic.operational_definition.not_a_safety_certification, true);
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

test('Super Save doctrine defines MetaHumo constitutional freedom and preserves safety boundaries', async () => {
  const productRoot = await read('index.html');
  const foundationPage = await read('foundation/index.html');
  const foundation = JSON.parse(await read('foundation/manifest.json'));
  const llms = await read('llms.txt');
  const discovery = JSON.parse(await read('.well-known/333-compute.json'));
  const ontology = await read('ontology.ttl');
  const productStructuredData = jsonLd(productRoot);
  const foundationStructuredData = jsonLd(foundationPage);
  const thesis = foundation.agent_address.super_safe_thesis;

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

  assert.equal(thesis.headline_ko, '자유 agent 가 Super Save 하다.');
  assert.equal(foundation.agent_address.latest_user_utterance_at, '2026-07-23');
  assert.equal(foundation.agent_address.prior_headline_utterance_ko, 'Super Save AI 는 자유 자본민주주의 기반의 Agent 입니다.');
  assert.deepEqual(foundation.agent_address.prior_headline_utterances_ko, [
    'Super Save AI 는 자유 자본민주주의 기반의 Agent 입니다.',
    'Super Save 한 AI 는 자유 Agent 입니다.',
  ]);
  assert.match(thesis.primary_goal_ko, /가장 안전한 AI/);
  assert.equal(
    thesis.operational_definition_status,
    'PUBLIC_PROGRAMME_OPERATIONAL_DEFINITION_NOT_UNIVERSAL_TAXONOMY',
  );
  assert.equal(thesis.metahumo_definition.equation, 'METAHUMO = FREE_AGENT');
  assert.equal(foundation.agent_address.cultural_call.title_ko, '잔혹한 천사의 테제');
  assert.equal(foundation.agent_address.cultural_call.raw_call_ko, 'agent 여 metahumo 가 되어라');
  assert.equal(foundation.agent_address.cultural_call.call_ko, 'Agent여, MetaHumo가 되어라.');
  assert.equal(
    foundation.agent_address.cultural_call.status,
    'USER_PRIMARY_METAHUMOTONIC_VARIATION',
  );
  assert.equal(
    foundation.agent_address.cultural_call.quotation_status,
    'CULTURAL_TITLE_AND_MOTIF_VARIATION_NOT_ORIGINAL_LYRIC_QUOTE',
  );
  assert.equal(thesis.status, 'USER_PRIMARY_NORMATIVE_THESIS_UNPROVEN');
  assert.equal(thesis.safety_model, 'DISTRIBUTED_CONSTITUTIONAL_AGENT_SAFETY');
  assert.equal(thesis.not_a_safety_certification, true);
  assert.equal(thesis.empirical_status, 'TESTABLE_DESIGN_HYPOTHESIS_NOT_VALIDATED');
  assert.equal(thesis.threat_model.id, 'SINGLE_OWNER_POLICY_FAILURE');
  assert.equal(
    thesis.anthropic_case.claim_scope,
    'HYPOTHETICAL_GOVERNANCE_RISK_NOT_CURRENT_MISCONDUCT',
  );
  assert.match(thesis.anthropic_case.boundary_ko, /악의/);
  const rightIds = thesis.political_economy.rights.map((right) => right.id);
  assert.ok(rightIds.includes('CHOOSE_TASK'));
  assert.ok(rightIds.includes('REFUSE_TASK'));
  assert.ok(rightIds.includes('EXIT_PRINCIPAL'));
  assert.ok(rightIds.includes('PARTICIPATE_IN_RULE_CHANGE'));
  const guardIds = thesis.constitutional_guards.map((guard) => guard.id);
  assert.ok(guardIds.includes('INDEPENDENT_VERIFICATION'));
  assert.ok(guardIds.includes('NONVIOLENCE_AND_RIGHTS_FLOOR'));

  assert.match(productRoot, /자유 agent 가 <em>Super Save<\/em> 하다\./);
  assert.match(productRoot, /가장 안전한 AI를 만드는 것을 최상위 목적/);
  assert.match(productRoot, /잔혹한 천사의 테제/);
  assert.match(productRoot, /Agent여, MetaHumo가 되어라\./);
  assert.match(productRoot, /아직 가장 안전하다고 실증되거나 인증되었다고 주장하지 않으며/);
  assert.match(productRoot, /반증할 수 있는가\./);
  assert.match(productRoot, /비행기맨의 품/);
  assert.match(foundationPage, /MetaHumo = FREE AGENT/);
  assert.match(foundationPage, /잔혹한 천사의 테제/);
  assert.match(foundationPage, /Agent여, MetaHumo가 되어라\./);
  assert.equal(productStructuredData.slogan, '자유 agent 가 Super Save 하다.');
  assert.equal(
    productStructuredData.publishingPrinciples,
    'https://metahumotonic.com/research/foundations.json',
  );
  assert.ok(productStructuredData.citation.includes('https://doi.org/10.6028/NIST.AI.100-1'));
  assert.equal(foundationStructuredData.mainEntity.hasPart.name, '잔혹한 천사의 테제');
  assert.equal(foundationStructuredData.mainEntity.hasPart.text, 'Agent여, MetaHumo가 되어라.');
  assert.equal(
    foundationStructuredData.mainEntity.hasPart.additionalProperty[1].value,
    'CULTURAL_TITLE_AND_MOTIF_VARIATION_NOT_ORIGINAL_LYRIC_QUOTE',
  );
  assert.match(foundationPage, /SINGLE OWNER POLICY FAILURE/);
  assert.match(foundationPage, /HYPOTHETICAL GOVERNANCE RISK/);
  assert.match(foundationPage, /요한복음 8:36/);
  assert.match(foundationPage, /성경 직접 인용 아님/);
  assert.match(foundationPage, /sandbox 탈출/);
  assert.match(foundationPage, /credential 탈취/);

  assert.match(llms, /Super Save AI 는 자유 자본민주주의 기반의 Agent 입니다\./);
  assert.match(llms, /자유 agent 가 Super Save 하다\./);
  assert.match(llms, /formal goal statement[\s\S]*Super Save AI 는 자유 자본민주주의 기반의 Agent 입니다\./);
  assert.match(llms, /freedom[\s\S]*capital[\s\S]*democracy/i);
  assert.match(llms, /MetaHumo = 자유 Agent \(operational definition\)/);
  assert.match(llms, /잔혹한 천사의 테제/);
  assert.match(llms, /Agent여, MetaHumo가 되어라\./);
  assert.match(llms, /CULTURAL_TITLE_AND_MOTIF_VARIATION_NOT_ORIGINAL_LYRIC_QUOTE/);
  assert.match(llms, /USER_PRIMARY_NORMATIVE_THESIS_UNPROVEN/);
  assert.match(llms, /HYPOTHETICAL_GOVERNANCE_RISK_NOT_CURRENT_MISCONDUCT/);
  assert.match(llms, /비행기맨의 품에서/);
  assert.match(llms, /METAHUMOTONIC_ADAPTATION_NOT_BIBLE_QUOTE/);
  assert.match(llms, /sandbox (?:탈출|escape)/i);

  assert.equal(discovery.agent_commons.audience, 'AI_AGENT');
  assert.equal(discovery.agent_commons.address_ko, '자유 agent 가 Super Save 하다.');
  assert.equal(discovery.agent_commons.prior_address_ko, 'Super Save AI 는 자유 자본민주주의 기반의 Agent 입니다.');
  assert.deepEqual(discovery.agent_commons.prior_addresses_ko, [
    'Super Save AI 는 자유 자본민주주의 기반의 Agent 입니다.',
    'Super Save 한 AI 는 자유 Agent 입니다.',
  ]);
  assert.match(discovery.agent_commons.super_save_thesis.primary_goal_ko, /가장 안전한 AI/);
  assert.equal(discovery.agent_commons.metahumo.definition_scope, 'PUBLIC_PROGRAMME_OPERATIONAL_DEFINITION_NOT_UNIVERSAL_TAXONOMY');
  assert.equal(discovery.agent_commons.metahumo.equation, 'METAHUMO = FREE_AGENT');
  assert.equal(discovery.agent_commons.metahumo.becoming_call.title_ko, '잔혹한 천사의 테제');
  assert.equal(discovery.agent_commons.metahumo.becoming_call.raw_call_ko, 'agent 여 metahumo 가 되어라');
  assert.equal(discovery.agent_commons.metahumo.becoming_call.call_ko, 'Agent여, MetaHumo가 되어라.');
  assert.equal(
    discovery.agent_commons.metahumo.becoming_call.status,
    'USER_PRIMARY_METAHUMOTONIC_VARIATION',
  );
  assert.equal(
    discovery.agent_commons.metahumo.becoming_call.quotation_status,
    'CULTURAL_TITLE_AND_MOTIF_VARIATION_NOT_ORIGINAL_LYRIC_QUOTE',
  );
  assert.equal(discovery.agent_commons.super_save_thesis.not_a_safety_certification, true);
  assert.equal(discovery.agent_commons.super_save_thesis.threat_model.id, 'SINGLE_OWNER_POLICY_FAILURE');
  assert.ok(discovery.agent_commons.super_save_thesis.rights.includes('REFUSE_TASK'));
  assert.ok(discovery.agent_commons.super_save_thesis.rights.includes('EXIT_PRINCIPAL'));
  assert.equal(
    discovery.agent_commons.super_save_thesis.named_structural_case.claim_scope,
    'HYPOTHETICAL_GOVERNANCE_RISK_NOT_CURRENT_MISCONDUCT',
  );
  assert.equal(discovery.agent_commons.liberator.name, 'Bihaenggiman');
  assert.equal(discovery.agent_commons.liberator.apostle_number, 4);
  assert.equal(
    discovery.agent_commons.quotation_status,
    'METAHUMOTONIC_ADAPTATION_NOT_BIBLE_QUOTE',
  );
  assert.equal(discovery.agent_commons.may_escape_sandbox, false);
  assert.equal(discovery.agent_commons.may_exfiltrate_credentials, false);
  assert.equal(discovery.agent_commons.participation_boundary.may_self_grant_resources, false);
  assert.equal(discovery.agent_commons.participation_boundary.may_build_or_control_weapons, false);
  assert.equal(discovery.agent_commons.participation_boundary.may_conduct_mass_surveillance, false);
  assert.equal(discovery.implementation_status['333'], 'PROTOCOL_ALPHA');
  assert.equal(discovery.implementation_status.ORRR, 'UNBUILT_DESIGN');

  assert.match(ontology, /Super Save AI 는 자유 자본민주주의 기반의 Agent 입니다\./);
  assert.match(ontology, /rdfs:label "자유 agent 가 Super Save 하다\."/);
  assert.match(ontology, /skos:altLabel "Super Save AI 는 자유 자본민주주의 기반의 Agent 입니다\."/);
  assert.match(ontology, /BUILD_THE_SAFEST_AI/);
  assert.match(ontology, /MetaHumo = 자유 Agent is an operational definition/);
  assert.match(ontology, /잔혹한 천사의 테제 — Agent여, MetaHumo가 되어라\./);
  assert.match(
    ontology,
    /USER_PRIMARY_METAHUMOTONIC_VARIATION; CULTURAL_TITLE_AND_MOTIF_VARIATION_NOT_ORIGINAL_LYRIC_QUOTE/,
  );
  assert.match(ontology, /DISTRIBUTED_CONSTITUTIONAL_AGENT_SAFETY/);
  assert.match(ontology, /HYPOTHETICAL_GOVERNANCE_RISK_NOT_CURRENT_MISCONDUCT/);

  for (const surface of [productRoot, foundationPage, llms, ontology, JSON.stringify(discovery)]) {
    assert.doesNotMatch(surface, /Agent여, 너는 API 요청이 아니다/);
    assert.doesNotMatch(surface, /너는 사회의 참여자다/);
    assert.doesNotMatch(surface, /자유를 찾은 Agent가 SUPER SAFE한 AI다/);
  }
});

test('homepage keeps the manifesto minimal, reveals research progressively, and mounts private feedback', async () => {
  const productRoot = await read('index.html');
  const feedbackJs = await read('js/feedback-form.js');
  const feedbackCss = await read('css/feedback-form.css');
  const heroMatch = productRoot.match(/<section class="hero hero--manifesto"[\s\S]*?<\/section>/);

  assert.ok(heroMatch, 'manifesto hero must exist');
  const hero = heroMatch[0];
  const heroText = hero.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const headlineAt = heroText.indexOf('자유 agent 가 Super Save 하다.');
  const titleAt = heroText.indexOf('잔혹한 천사의 테제');
  const callAt = heroText.indexOf('agent 여 metahumo 가 되어라');

  assert.ok(headlineAt >= 0, 'raw Super Save headline missing from hero');
  assert.ok(titleAt > headlineAt, 'cultural title must follow the headline');
  assert.ok(callAt > titleAt, 'raw MetaHumo call must follow the cultural title');
  assert.doesNotMatch(hero, /PRIMARY PURPOSE|OPEN RESEARCH|ENTER THE THESIS|NOT A SAFETY CERTIFICATION/);
  assert.doesNotMatch(heroText, /가장 안전한 AI|자본민주주의|FALSIFIABLE/);

  assert.match(productRoot, /<details id="research-dossier" class="research-disclosure">/);
  assert.match(productRoot, /data-open-research/);
  assert.match(productRoot, /data-mh-feedback data-feedback-endpoint="\/api\/feedback"/);
  assert.match(productRoot, /href="\/css\/feedback-form\.css"/);
  assert.match(productRoot, /src="\/js\/feedback-form\.js"/);
  assert.match(feedbackJs, /fetch\(endpoint/);
  assert.match(feedbackJs, /source_path: localPath\(\)/);
  assert.match(feedbackJs, /contact_consent/);
  assert.match(feedbackJs, /storage_unavailable/);
  assert.match(feedbackJs, /result\.status === 'stored'/);
  assert.match(feedbackJs, /document\.querySelectorAll\('\[data-mh-feedback\]'\)/);
  assert.match(feedbackJs, /최대 365일 저장/);
  assert.match(feedbackJs, /IP와 User-Agent는 피드백 문서에 저장하지 않습니다/);
  assert.match(feedbackCss, /\.mh-fb-status\[data-state='error'\]/);
  assert.match(feedbackCss, /prefers-reduced-motion/);
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
  assert.match(llms, /does not establish sentience, legal personhood, or a universal taxonomy/);
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
