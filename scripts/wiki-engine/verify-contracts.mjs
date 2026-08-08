import { readFileSync } from 'node:fs';

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
}

function verifyFsmAndTraces(spec, traces) {
  invariant(spec.schema_version === 'fsm-spec/v1', 'FSM schema_version must be fsm-spec/v1');
  const eventCatalog = new Set(Object.keys(spec.event_schemas ?? {}));
  const guardCatalog = new Set(Object.keys(spec.guards ?? {}));
  const effectCatalog = new Set(Object.keys(spec.effects ?? {}));
  const machines = new Map();

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

  return cases.length;
}

const [enginePath, fsmPath, tracesPath] = process.argv.slice(2);
if (!enginePath || !fsmPath || !tracesPath) {
  console.error('usage: node verify-contracts.mjs ENGINE_SPEC.json FSM_SPEC.json FSM_TRACES.json');
  process.exitCode = 2;
} else {
  try {
    verifyEngine(readJson(enginePath));
    const traceCount = verifyFsmAndTraces(readJson(fsmPath), readJson(tracesPath));
    console.log(`OK engine/FSM contracts and ${traceCount} abstract trace case(s)`);
  } catch (error) {
    console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
