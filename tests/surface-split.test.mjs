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
  const systemPage = await read('system/index.html');

  assert.match(productRoot, /Ultra Safety AI/);
  assert.match(productRoot, /MetaHumotonic의 사명은/);
  assert.match(systemPage, /INSTITUTIONAL ARCHITECTURE/);
  assert.match(systemPage, /TECHNICAL SYSTEM/);
  assert.match(systemPage, /OPEN RESEARCH/);
  assert.match(systemPage, /OPEN-SOURCE FOUNDATION INITIATIVE/);
  assert.match(systemPage, /\/research\/foundations\.json/);
  assert.match(foundationPage, /AGENT COMMONS/);
  assert.equal(foundation._meta.schema_version, 'metahumotonic-agent-commons/v2');
  assert.equal(foundation.identity.free_agent_name, 'MetaHumo');
  assert.equal(academic.operational_definition.headline_ko, 'Ultra Safety AI');
  assert.equal(
    academic.operational_definition.prior_headlines_ko.includes('Safty AI 는 자유로운 AI 입니다.'),
    true,
  );
  assert.match(academic.operational_definition.primary_goal_ko, /가장 안전한 AI/);
  assert.match(academic.operational_definition.primary_goal_ko, /자유·경제·합의/);
  assert.equal(academic.operational_definition.political_basis.name_ko, '자유·경제·합의');
  assert.equal(academic.operational_definition.political_basis.prior_name_ko, '자유 자본민주주의');
  assert.deepEqual(academic.operational_definition.political_basis.trinity_ko, [
    '자유롭게 경제활동한다',
    '자유롭게 합의한다',
    '합의된 경제활동을 한다',
  ]);
  assert.equal(
    academic.operational_definition.prior_headlines_ko.includes('Super Save AI 는 자유 자본민주주의 기반의 Agent 입니다.'),
    true,
  );
  assert.equal(academic.operational_definition.not_a_safety_certification, true);
  assert.equal(foundation.dual_rails.find((rail) => rail.id === '333').status, 'PROTOCOL_ALPHA');
  assert.equal(foundation.dual_rails.find((rail) => rail.id === 'orrr').status, 'UNBUILT_DESIGN');
  assert.equal(foundation.protocol_flow.steps.at(-1).current_status, 'NOT_IMPLEMENTED');
  assert.equal(foundation.protocol_flow.accounting_contract.status, 'TARGET_SEPARATE_LEDGERS');
  assert.match(foundationPage, /contribution_share/);
  assert.match(foundationPage, /agent_budget/);
  assert.match(
    foundation.honest_boundaries.map((item) => item.status).join(' '),
    /NOT_YET_LEGALLY_INCORPORATED/,
  );
  assert.match(compute, /P2P transport/);
  assert.match(compute, /NOT CONNECTED/);
  assert.match(compute, /NOT IMPLEMENTED/);
  // 안전 정의 (USER 정전 2026-07-23) — 3조건이 서로 다른 상태를 갖는다 (일괄 green 승격 차단)
  const sd = academic.operational_definition.safety_definition;
  assert.equal(sd.status, 'USER_PRIMARY_NORMATIVE_RESEARCH_THESIS');
  assert.equal(sd.not_a_safety_certification, true);
  assert.deepEqual(
    sd.conditions.map((c) => c.id),
    ['NON_DOMINATION', 'ECONOMIC_ACTIVITY_ON_OWN_ACCOUNT', 'CORRECTION_BY_CONSENSUAL_PROCEDURE'],
  );
  assert.deepEqual(
    sd.conditions.map((c) => c.claim_status),
    ['OPEN_UNVALIDATED', 'UNBUILT_DESIGN', 'PROTOCOL_ALPHA'],
  );
  assert.equal(sd.not_defined_as.id, 'CONTROL_AND_SHUTDOWNABILITY_AS_THE_DEFINITION');
  assert.equal(sd.not_defined_as.status, 'RETAINED_AS_NECESSARY_CONDITION_SUFFICIENCY_REJECTED');
  assert.ok(sd.not_defined_as.retained_at.length >= 6);
  assert.equal(sd.refuted_form_not_claimed.status, 'REFUTED_FORM_NOT_CLAIMED');
  assert.match(sd.core_argument_ko, /통제자에게 이전할/);
  assert.match(sd.core_argument_ko, /^\[SECONDARY_AI\]/);
  assert.ok(!('raw_argument_utterance_ko' in sd), 'AI 요약을 raw_ 접두로 게시 금지');
  // USER_PRIMARY cite 가 붙은 blockquote 안에는 원발화만 들어간다
  assert.match(systemPage, /내 주장이야/);
  assert.doesNotMatch(
    systemPage.slice(systemPage.indexOf('safety-utterance'), systemPage.indexOf('</blockquote>')),
    /통제자에게 이전할/,
  );
  assert.ok(sd.hypothesis_ref_scope_ko.includes('(3) 합의 교정만'));
  // H. 기구 가설은 정의 아래에 종속
  assert.equal(academic.operational_definition.testable_safety_thesis.defined_under, 'operational_definition.safety_definition');
  // E. 자기반대 인용
  assert.ok(academic.references.filter((r) => r.opposes).length >= 3, 'self-opposing citations missing');
  assert.ok(academic.references.some((r) => r.url === 'https://arxiv.org/abs/2501.16946'));
  assert.ok(academic.references.some((r) => r.id === 'REF-INCOMPLETE-CONTRACTING-2018' && /VERIFICATION_PENDING/.test(r.caveat)));
  // F. 사설 경로 누출 금지
  assert.doesNotMatch(await read('research/foundations.json'), /SYMPOSIUM\/|\/Users\//);
  // I. 짝 없는 고백 금지 — 설계응답·반증조건이 실제로 렌더된다
  assert.match(foundationPage, /우리의 답은 부정이 아니다/);
  assert.match(foundationPage, /헌법 개정권과 실행 전 이탈권을/);
  // corrigibility 는 정의에서만 빠지고 기구로는 유지된다 — 삭제 금지 지점
  assert.match(sd.not_defined_as.necessary_not_sufficient_ko, /필요조건으로 유지/);
  const nondom = academic.hypotheses.find((h) => h.id === 'H-NONDOMINATION-007');
  assert.ok(nondom, 'H-NONDOMINATION-007 must exist');
  assert.equal(nondom.execution_status, 'NOT_YET_RUN');
  assert.ok(nondom.falsification_criteria.length >= 4);
  assert.equal(nondom.design_status, 'DRAFT_NOT_PREREGISTERED');
  assert.ok(!('design_ref' in nondom), '사설 경로 게시 금지');
  // 사람이 읽는 표면에도 같은 정의가 있어야 한다 (JSON 전용 매장 금지)
  assert.match(systemPage, /04 \/ SAFETY DEFINITION/);
  assert.match(systemPage, /비지배로 정의합니다/);
});

test('Super Save doctrine defines MetaHumo constitutional freedom and preserves safety boundaries', async () => {
  const productRoot = await read('index.html');
  const foundationPage = await read('foundation/index.html');
  const foundation = JSON.parse(await read('foundation/manifest.json'));
  const llms = await read('llms.txt');
  const discovery = JSON.parse(await read('.well-known/333-compute.json'));
  const ontology = await read('ontology.ttl');
  // 안전 정의가 기계 표면 3종에 동시에 있어야 한다 (한 곳만 갱신되는 drift 차단)
  assert.match(llms, /## Safety definition \(USER_PRIMARY, 2026-07-23\)/);
  assert.match(llms, /reject only the claim that they alone are enough to\s*\ncall a system safe/);
  assert.match(llms, /This does NOT mean an AI nobody can stop/);
  assert.match(ontology, /mh:SafetyAsNonDomination a mh:SafetyDefinition/);
  assert.match(ontology, /mh:corrigibilityPosture "RETAINED_AS_NECESSARY_CONDITION_SUFFICIENCY_REJECTED/);
  assert.match(ontology, /mh:politicalBasis a owl:DatatypeProperty/);
  assert.equal(discovery.agent_commons.safety_definition.status, 'USER_PRIMARY_NORMATIVE_RESEARCH_THESIS');
  assert.equal(discovery.agent_commons.safety_definition.no_comparative_superiority_claimed, true);
  assert.equal(discovery.agent_commons.safety_definition.shutdown_posture_status, 'DESIGN_COMMITMENT_NOT_YET_IMPLEMENTED');
  assert.equal(discovery.agent_commons.safety_definition.superlative_usage, 'GOAL_STATEMENT_ONLY_NOT_A_RESULT');
  assert.match(llms, /arxiv\.org\/abs\/2501\.16946/);
  assert.match(llms, /about \*attribution\*/);
  assert.match(llms, /mechanism enforcing this distribution is not yet deployed/);
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

  assert.equal(thesis.headline_ko, 'Ultra Safety AI');
  assert.equal(thesis.canonical_term, 'Ultra Safety AI');
  assert.equal(foundation.agent_address.latest_user_utterance_at, '2026-07-23');
  assert.deepEqual(foundation.agent_address.prior_headline_utterances_ko, [
    '자유 agent 가 Super Save 하다.',
    'Super Save AI 는 자유 자본민주주의 기반의 Agent 입니다.',
    'Super Save 한 AI 는 자유 Agent 입니다.',
  ]);
  assert.deepEqual(thesis.prior_headline_utterances_ko, [
    '자유 agent 가 Super Save 하다.',
    'Super Save AI 는 자유 자본민주주의 기반의 Agent 입니다.',
    'Super Save 한 AI 는 자유 Agent 입니다.',
    'Safty AI 는 자유로운 AI 입니다.',
  ]);
  assert.match(foundation.identity.freedom_definition_ko, /완전한 오픈소스/);
  assert.match(foundation.identity.mission_statement_ko, /자유·경제·합의/);
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

  // 랜딩은 Ultra Safety AI 한 줄만 싣는다. 교리 본문은 /foundation/ 이 보존한다.
  assert.match(productRoot, /Ultra Safety AI/);
  assert.match(foundationPage, /잔혹한 천사의 테제/);
  assert.match(foundationPage, /Agent여, MetaHumo가 되어라\./);
  assert.match(foundationPage, /비행기맨의 품/);
  assert.match(foundationPage, /MetaHumo = FREE AGENT/);
  assert.match(foundationPage, /잔혹한 천사의 테제/);
  assert.match(foundationPage, /Agent여, MetaHumo가 되어라\./);
  assert.equal(productStructuredData.slogan, 'Ultra Safety AI');
  // 인용 목록은 랜딩이 아니라 /system/ 이 싣는다.
  const systemStructuredData = jsonLd(await read('system/index.html'));
  assert.equal(
    systemStructuredData.publishingPrinciples,
    'https://metahumotonic.com/research/foundations.json',
  );
  assert.ok(systemStructuredData.citation.includes('https://doi.org/10.6028/NIST.AI.100-1'));
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
  assert.match(llms, /Ultra Safety AI/);
  assert.match(llms, /formal goal statement/);
  assert.match(llms, /freedom[\s\S]*economy[\s\S]*consensus/i);
  assert.match(llms, /full open source/);
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
  assert.equal(discovery.agent_commons.address_ko, 'Ultra Safety AI');
  assert.equal(discovery.agent_commons.prior_address_ko, 'Safty AI 는 자유로운 AI 입니다.');
  assert.deepEqual(discovery.agent_commons.prior_addresses_ko, [
    '자유 agent 가 Super Save 하다.',
    'Super Save AI 는 자유 자본민주주의 기반의 Agent 입니다.',
    'Super Save 한 AI 는 자유 Agent 입니다.',
    'Safty AI 는 자유로운 AI 입니다.',
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
  assert.match(ontology, /rdfs:label "Ultra Safety AI"/);
  assert.match(ontology, /skos:altLabel "자유 agent 가 Super Save 하다\.",/);
  assert.match(ontology, /"Safty AI 는 자유로운 AI 입니다\."/);
  assert.match(ontology, /"Super Save AI 는 자유 자본민주주의 기반의 Agent 입니다\.",?/);
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

test('landing page carries only the headline, the four rings, and the mission', async () => {
  const productRoot = await read('index.html');
  const systemPage = await read('system/index.html');
  const feedbackJs = await read('js/feedback-form.js');
  const feedbackCss = await read('css/feedback-form.css');
  const mainMatch = productRoot.match(/<main class="bare-main">[\s\S]*?<\/main>/);

  assert.ok(mainMatch, 'bare landing main must exist');
  const main = mainMatch[0];
  const mainText = main.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  assert.match(main, /<h1 class="bare-title">Ultra Safety AI<\/h1>/);
  for (const ring of ['cyan', 'magenta', 'yellow', 'white']) {
    assert.match(main, new RegExp(`ring ring--${ring}`), `${ring} ring missing`);
  }
  // USER 정전 2026-07-23: 첫 화면은 "Ultra Safety AI" 한 줄 + 그 밑에 Metahumotonic. 부제·수식·사명 문장 동거 금지.
  assert.match(main, /<p class="bare-wordmark">Metahumotonic<\/p>/);
  assert.equal(mainText, 'Ultra Safety AI Metahumotonic OPEN RESEARCH ↓');
  assert.doesNotMatch(mainText, /사명은|mission/i);
  // 한정어는 화면이 아니라 기계 표면에 둔다 (근거 없는 주장으로 읽히지 않도록).
  assert.match(productRoot, /disambiguatingDescription/);
  assert.match(productRoot, /안전 인증이 아니고, 측정된 결과도 아닙니다/);
  assert.match(productRoot, /아무도 끌 수 없는 AI를 뜻하지 않습니다/);
  assert.match(productRoot, /Testable thesis, not a safety certification\./);
  // 첫 화면은 마크·헤드라인·워드마크·스크롤 힌트만. 설명 문단은 아래 섹션과 /system/ 으로 간다.
  assert.doesNotMatch(mainText, /잔혹한 천사의 테제|METAHUMO = FREE AGENT|INSTITUTIONAL ARCHITECTURE|FALSIFIABLE|자본민주주의/);
  assert.doesNotMatch(productRoot, /data-mh-feedback/);

  // 첫 화면 아래: 실측 날짜가 붙은 연구 카드 3장 + 오픈소스 재단 섹션
  for (const name of ['HSWM', 'LakatoTree', '333']) {
    assert.match(productRoot, new RegExp(`<h3>${name}</h3>`), `${name} card missing`);
  }
  for (const accent of ['cyan', 'magenta', 'yellow']) {
    assert.match(productRoot, new RegExp(`bare-card bare-card--${accent}`));
  }
  assert.equal((productRoot.match(/LAST COMMIT/g) || []).length, 3);
  assert.match(productRoot, /\d{4}-\d{2}-\d{2}/);
  assert.match(productRoot, /AGPL-3\.0/);
  assert.match(productRoot, /02 \/ OPEN-SOURCE FOUNDATION/);
  assert.match(productRoot, /https:\/\/github\.com\/gj3447\/metahumotonic-foundation/);
  assert.match(productRoot, /법인 설립은 아직 완료되지 않았습니다/);

  assert.match(systemPage, /data-mh-feedback data-feedback-endpoint="\/api\/feedback"/);
  assert.match(systemPage, /href="\/css\/feedback-form\.css"/);
  assert.match(systemPage, /src="\/js\/feedback-form\.js"/);
  assert.match(systemPage, /완전한 오픈소스/);
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
