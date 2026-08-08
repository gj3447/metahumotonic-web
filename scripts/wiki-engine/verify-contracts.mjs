import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function text(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function uniqueTexts(values, label) {
  invariant(Array.isArray(values) && values.length > 0 && values.every(text), `${label} must be non-empty strings`);
  invariant(new Set(values).size === values.length, `${label} contains duplicates`);
  return new Set(values);
}

function verifyEngine(engine) {
  invariant(engine.schema_version === 'engine-spec/v1', 'engine schema_version must be engine-spec/v1');
  invariant(engine.decision?.verdict === 'engine', 'engine decision must remain engine');
  for (const key of ['purpose', 'boundary', 'model', 'state_model', 'runtime', 'durability']) {
    invariant(engine[key] != null, `engine.${key} is required`);
  }
  for (const key of ['commands', 'events', 'effects']) {
    uniqueTexts(engine.protocol?.[key], `engine.protocol.${key}`);
  }
  for (const key of ['invariants', 'ports', 'failure_model', 'security', 'verification', 'falsifiers']) {
    uniqueTexts(engine[key], `engine.${key}`);
  }
  invariant(engine.public_community_api?.base_path === '/api/wiki/v1', 'public API base path must be /api/wiki/v1');
  invariant(engine.public_community_api?.application_service_rule?.includes('/commands is not a public HTTP route'), 'public REST adapters must map into an internal command gateway');
  uniqueTexts(engine.public_community_api?.read_routes, 'engine.public_community_api.read_routes');
  const writeRoutes = uniqueTexts(engine.public_community_api?.write_routes, 'engine.public_community_api.write_routes');
  for (const route of ['POST /sessions', 'POST /pages', 'POST /pages/{slug}/revisions', 'POST /pages/{slug}/submit-review', 'POST /pages/{slug}/report']) {
    invariant(writeRoutes.has(route), `public REST contract misses ${route}`);
  }
  invariant([...writeRoutes].every((route) => !route.includes('quarantine') && !route.includes('release')), 'public REST contract must not expose moderation decisions');
  invariant(engine.internal_moderation_api?.base_path === '/internal/wiki/moderation', 'internal moderation API must remain outside /api/wiki');
  const moderationRoutes = uniqueTexts(engine.internal_moderation_api?.routes, 'engine.internal_moderation_api.routes');
  for (const route of ['GET /reports', 'POST /reports/{effect_id}/resolve', 'GET /pages/{slug}', 'POST /pages/{slug}/quarantine', 'POST /pages/{slug}/release']) {
    invariant(moderationRoutes.has(route), `internal moderation contract misses ${route}`);
  }
  uniqueTexts(engine.public_community_api?.forbidden_request_fields, 'engine.public_community_api.forbidden_request_fields');
  invariant(engine.actor_trust_boundary?.rule?.includes('untrusted'), 'actor trust boundary must classify transport input as untrusted');
  const publicCapabilities = new Set(engine.actor_trust_boundary?.principals?.public_human_or_agent ?? []);
  invariant(publicCapabilities.has('wiki:report'), 'public principals must be able to report');
  invariant(!publicCapabilities.has('wiki:moderate'), 'public principals must never receive wiki:moderate');
  uniqueTexts(engine.actor_trust_boundary?.separation_rules, 'engine.actor_trust_boundary.separation_rules');
  uniqueTexts(engine.actor_trust_boundary?.abuse_controls, 'engine.actor_trust_boundary.abuse_controls');
  invariant(engine.kg_publisher_gate?.status === 'disabled-unbound-v1', 'KG publisher must remain disabled-unbound-v1');
  invariant(engine.kg_publisher_gate?.legacy_intent_disposition?.includes('must not call'), 'legacy KG intent must forbid external canon calls');
  const proposalFields = new Set(engine.payload_requirements?.kg_proposal_plan_v2 ?? []);
  for (const field of ['proposalId', 'targetStableId', 'baseKgSnapshotHash', 'changeSet', 'planHash', 'mappingVersion', 'policyVersion', 'sourceRefs']) {
    invariant(proposalFields.has(field), `kg_proposal_plan_v2 misses ${field}`);
  }
  const supersededFields = new Set(engine.payload_requirements?.kg_superseded_event ?? []);
  for (const field of ['proposalId', 'revisionId', 'contentHash', 'planHash', 'previousStatus', 'replacementRevisionId', 'reason']) {
    invariant(supersededFields.has(field), `kg_superseded_event misses ${field}`);
  }
  invariant(text(engine.cross_runtime_fixture_contract?.fixture), 'shared-runtime fixture path is required');
}

function verifyFsmAndTraces(spec, traces) {
  invariant(spec.schema_version === 'fsm-spec/v1', 'FSM schema_version must be fsm-spec/v1');
  const eventCatalog = new Set(Object.keys(spec.event_schemas ?? {}));
  const guardCatalog = new Set(Object.keys(spec.guards ?? {}));
  const effectCatalog = new Set(Object.keys(spec.effects ?? {}));
  const machines = new Map();

  for (const [event, schema] of Object.entries(spec.event_schemas ?? {})) {
    const required = uniqueTexts(schema.required, `${event}.required`);
    const properties = new Set(Object.keys(schema.properties ?? {}));
    for (const field of required) invariant(properties.has(field), `${event} required field ${field} has no property schema`);
  }

  for (const [effect, definition] of Object.entries(spec.effects ?? {})) {
    const schema = definition.payload_schema;
    const required = uniqueTexts(schema?.required, `${effect}.payload_schema.required`);
    const properties = new Set(Object.keys(schema?.properties ?? {}));
    for (const field of required) invariant(properties.has(field), `${effect} required field ${field} has no property schema`);
  }

  for (const machine of spec.machines ?? []) {
    invariant(text(machine.id) && !machines.has(machine.id), `invalid or duplicate machine id ${machine.id}`);
    const states = uniqueTexts((machine.states ?? []).map((state) => state.id), `${machine.id}.states`);
    const events = uniqueTexts(machine.events, `${machine.id}.events`);
    invariant(states.has(machine.initial), `${machine.id} initial state is unknown`);
    for (const event of events) invariant(eventCatalog.has(event), `${machine.id} event ${event} has no schema`);
    invariant(machine.invalid_event_policy?.state_change === 'none', `${machine.id} invalid events must not change state`);
    invariant(effectCatalog.has(machine.invalid_event_policy?.effect), `${machine.id} audit effect is unknown`);

    const transitionIds = new Set();
    for (const transition of machine.transitions ?? []) {
      invariant(text(transition.id) && !transitionIds.has(transition.id), `${machine.id} has an invalid or duplicate transition id`);
      transitionIds.add(transition.id);
      invariant(states.has(transition.from) && states.has(transition.to), `${machine.id}.${transition.id} references an unknown state`);
      invariant(events.has(transition.event), `${machine.id}.${transition.id} references an undeclared event`);
      if (transition.guard) invariant(guardCatalog.has(transition.guard), `${machine.id}.${transition.id} guard is unknown`);
      for (const effect of transition.effects ?? []) {
        invariant(effectCatalog.has(effect), `${machine.id}.${transition.id} effect ${effect} is unknown`);
      }
    }
    machines.set(machine.id, { ...machine, transitionIds });
  }
  invariant(machines.size > 0, 'FSM must declare at least one machine');
  const moderation = machines.get('content_moderation');
  invariant(moderation?.initial === 'visible', 'content moderation must start visible');
  invariant(
    JSON.stringify((moderation?.states ?? []).map((state) => state.id).sort()) === JSON.stringify(['quarantined', 'visible']),
    'content moderation must contain only visible and quarantined states',
  );
  const moderationTransitions = new Map((moderation?.transitions ?? []).map((transition) => [transition.id, transition]));
  const requiredModerationTransitions = {
    create_visible: ['visible', 'PAGE_CREATED', 'visible', null],
    edit_visible: ['visible', 'REVISION_COMMITTED', 'visible', null],
    report_visible: ['visible', 'PAGE_REPORTED', 'visible', null],
    quarantine_head: ['visible', 'PAGE_QUARANTINED', 'quarantined', 'moderator_can_quarantine_head'],
    release_bound_revision: ['quarantined', 'PAGE_RELEASED', 'visible', 'moderator_can_release_bound_revision'],
  };
  for (const [id, [from, event, to, guard]] of Object.entries(requiredModerationTransitions)) {
    const transition = moderationTransitions.get(id);
    invariant(transition?.from === from && transition?.event === event && transition?.to === to, `content moderation transition ${id} drifted`);
    invariant((transition.guard ?? null) === guard, `content moderation guard ${id} drifted`);
  }
  invariant(!moderation.transitions.some((transition) => transition.from === 'quarantined' && transition.event === 'REVISION_COMMITTED'), 'quarantined pages must not accept edits');

  const selected = new Map([...machines].map(([id]) => [id, new Set()]));
  const falseGuards = new Map([...machines].map(([id]) => [id, new Set()]));
  const invalidExercised = new Map([...machines].map(([id]) => [id, false]));
  const cases = traces.cases ?? [];
  invariant(Array.isArray(cases) && cases.length > 0, 'trace cases are required');

  for (const fixture of cases) {
    const machine = machines.get(fixture.machine);
    invariant(machine, `${fixture.id} references unknown machine ${fixture.machine}`);
    let state = machine.initial;
    for (const [index, step] of (fixture.steps ?? []).entries()) {
      const choices = machine.transitions.filter(
        (transition) => transition.from === state && transition.event === step.event,
      );
      for (const transition of choices) {
        if (transition.guard && step.guard_results?.[transition.guard] === false) {
          falseGuards.get(machine.id).add(transition.guard);
        }
      }
      const enabled = choices.filter(
        (transition) => !transition.guard || step.guard_results?.[transition.guard] === true,
      );
      let effects;
      if (enabled.length > 0) {
        const transition = enabled[0];
        selected.get(machine.id).add(transition.id);
        state = transition.to;
        effects = transition.effects ?? [];
      } else {
        if (choices.length === 0) invalidExercised.set(machine.id, true);
        const mode = choices.length > 0
          ? machine.invalid_event_policy.guard_false
          : machine.invalid_event_policy.mode;
        effects = mode === 'reject-and-audit' ? [machine.invalid_event_policy.effect] : [];
      }
      invariant(state === step.expected_state, `${fixture.id} step ${index} state drift: ${state}`);
      invariant(
        JSON.stringify(effects) === JSON.stringify(step.expected_effects),
        `${fixture.id} step ${index} effect drift: ${JSON.stringify(effects)}`,
      );
    }
  }

  for (const [id, machine] of machines) {
    const missingTransitions = [...machine.transitionIds].filter((value) => !selected.get(id).has(value));
    invariant(missingTransitions.length === 0, `${id} traces miss transitions: ${missingTransitions.join(', ')}`);
    const guarded = new Set(machine.transitions.flatMap((transition) => transition.guard ? [transition.guard] : []));
    const missingFalse = [...guarded].filter((value) => !falseGuards.get(id).has(value));
    invariant(missingFalse.length === 0, `${id} traces miss guard-false cases: ${missingFalse.join(', ')}`);
    invariant(invalidExercised.get(id), `${id} traces do not exercise invalid-event policy`);
  }

  return { caseCount: cases.length, machineCount: machines.size, transitionCount: [...machines.values()].reduce((count, machine) => count + machine.transitions.length, 0) };
}

function verifyGoldens(goldens, engine, spec) {
  invariant(goldens.schema_version === 'wiki-runtime-golden/v1', 'golden schema_version must be wiki-runtime-golden/v1');
  invariant(goldens.verification_mode?.includes('does not execute'), 'golden manifest must disclose that runtimes are not executed');
  const runtimeNames = Object.keys(goldens.runtimes ?? {});
  invariant(runtimeNames.includes('typescript-reference') && runtimeNames.includes('python-backend'), 'goldens must name TypeScript and Python runtimes');
  const cases = goldens.cases ?? [];
  invariant(Array.isArray(cases) && cases.length > 0, 'runtime golden cases are required');
  uniqueTexts(cases.map((fixture) => fixture.id), 'runtime golden case ids');
  const kinds = new Set(cases.map((fixture) => fixture.kind));
  for (const kind of ['kernel-v1', 'public-adapter', 'moderation-v1', 'kg-proposal-v2', 'publisher-dispatch']) {
    invariant(kinds.has(kind), `runtime goldens miss ${kind}`);
  }
  for (const fixture of cases) {
    invariant(text(fixture.kind), `${fixture.id}.kind is required`);
    invariant(['accepted', 'rejected'].includes(fixture.expected?.decision), `${fixture.id} has invalid expected decision`);
  }
  const superseded = cases.find((fixture) => fixture.id === 'superseded-payload-is-complete');
  const supersededFields = new Set(superseded?.expected?.event_payload_required ?? []);
  for (const field of ['proposalId', 'revisionId', 'contentHash', 'planHash', 'previousStatus', 'replacementRevisionId', 'reason']) {
    invariant(supersededFields.has(field), `superseded golden payload misses ${field}`);
  }
  const disabled = cases.find((fixture) => fixture.id === 'legacy-kg-intent-cannot-reach-canon-store');
  invariant(disabled?.expected?.kg_apply_enabled === false && disabled?.expected?.external_calls === 0, 'legacy KG golden must prohibit external apply');
  invariant(engine.kg_publisher_gate.status === 'disabled-unbound-v1', 'engine and golden KG gate drift');
  invariant(spec.effects?.QueueCanonApplication?.dispatch_status === 'disabled-unbound-v1', 'FSM legacy KG effect must remain disabled');
  const report = cases.find((fixture) => fixture.id === 'report-queues-review-without-public-state-change');
  invariant(report?.expected?.state?.moderation === 'visible' && report?.expected?.state?.public_report_badge === false, 'report golden must preserve visibility without a public badge');
  const quarantine = cases.find((fixture) => fixture.id === 'internal-exact-head-quarantine-hides-public-read');
  invariant(quarantine?.expected?.state?.moderation === 'quarantined' && quarantine?.expected?.state?.public_visible === false, 'quarantine golden must hide public reads');
  const publicAgent = cases.find((fixture) => fixture.id === 'public-agent-cannot-quarantine');
  invariant(publicAgent?.expected?.decision === 'rejected', 'public agent moderation golden must reject');
  const release = cases.find((fixture) => fixture.id === 'exact-bound-release-restores-public-read');
  invariant(release?.expected?.state?.moderation === 'visible' && release?.expected?.state?.public_visible === true, 'exact-bound release golden must restore visibility');
  return { caseCount: cases.length, kindCount: kinds.size };
}

const [enginePath, fsmPath, tracesPath, suppliedGoldenPath] = process.argv.slice(2);
if (!enginePath || !fsmPath || !tracesPath) {
  console.error('usage: node verify-contracts.mjs ENGINE_SPEC.json FSM_SPEC.json FSM_TRACES.json');
  process.exitCode = 2;
} else {
  try {
    const engine = readJson(enginePath);
    const spec = readJson(fsmPath);
    verifyEngine(engine);
    const traces = verifyFsmAndTraces(spec, readJson(tracesPath));
    const goldenPath = suppliedGoldenPath ?? join(dirname(enginePath), 'runtime-golden-traces.json');
    const goldens = verifyGoldens(readJson(goldenPath), engine, spec);
    console.log(`OK engine contract, ${traces.machineCount} FSM machine(s), ${traces.transitionCount} transition(s), ${traces.caseCount} abstract trace case(s), and ${goldens.caseCount} structural golden-manifest case(s) across ${goldens.kindCount} kind(s)`);
  } catch (error) {
    console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
