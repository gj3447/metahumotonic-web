import { createHash } from 'node:crypto';

import { decide, effectsFor, replay } from './core.ts';
import type {
  CommandExecution,
  Decision,
  MemoryEngineStore,
  Rejection,
  WikiCommand,
} from './types.ts';

export function emptyMemoryEngineStore(): MemoryEngineStore {
  return {
    streams: {},
    commandReceipts: {},
    outbox: [],
  };
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;

  const entries = Object.entries(value as Readonly<Record<string, unknown>>)
    .filter(([, child]) => child !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries
    .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
    .join(',')}}`;
}

export function commandFingerprint(command: WikiCommand): string {
  const normalized = {
    ...command,
    actor: {
      ...command.actor,
      capabilities: [...command.actor.capabilities].sort(),
    },
  };
  return `sha256:${createHash('sha256').update(canonicalJson(normalized)).digest('hex')}`;
}

function executionFromDecision(
  kind: CommandExecution['kind'],
  state: CommandExecution['state'],
  decision: Decision,
  scheduleEffects: boolean,
): CommandExecution {
  if (!decision.ok) {
    return {
      kind,
      state,
      events: [],
      effects: [],
      rejection: decision.rejection,
    };
  }
  return {
    kind,
    state,
    events: decision.events,
    effects: scheduleEffects ? effectsFor(decision.events) : [],
  };
}

export function dispatchMemory(
  store: MemoryEngineStore,
  command: WikiCommand,
): Readonly<{ store: MemoryEngineStore; execution: CommandExecution }> {
  const fingerprint = commandFingerprint(command);
  const prior = store.commandReceipts[command.commandId];

  if (prior) {
    if (prior.fingerprint !== fingerprint) {
      const rejection: Rejection = {
        code: 'IDEMPOTENCY_KEY_REUSED',
        message: 'The command id was already used for a different command.',
        details: { commandId: command.commandId },
      };
      return {
        store,
        execution: {
          kind: 'rejected',
          state: replay(command.pageId, store.streams[command.pageId] ?? []),
          events: [],
          effects: [],
          rejection,
        },
      };
    }
    return {
      store,
      execution: executionFromDecision('replayed', prior.resultingState, prior.decision, false),
    };
  }

  const currentEvents = store.streams[command.pageId] ?? [];
  const currentState = replay(command.pageId, currentEvents);
  const decision = decide(currentState, command);

  if (!decision.ok) {
    const receipt = { fingerprint, decision, resultingState: currentState } as const;
    const nextStore: MemoryEngineStore = {
      ...store,
      commandReceipts: {
        ...store.commandReceipts,
        [command.commandId]: receipt,
      },
    };
    return {
      store: nextStore,
      execution: executionFromDecision('rejected', currentState, decision, false),
    };
  }

  const nextEvents = [...currentEvents, ...decision.events];
  const nextEffects = effectsFor(decision.events);
  const resultingState = replay(command.pageId, nextEvents);
  const receipt = { fingerprint, decision, resultingState } as const;
  const nextStore: MemoryEngineStore = {
    streams: {
      ...store.streams,
      [command.pageId]: nextEvents,
    },
    commandReceipts: {
      ...store.commandReceipts,
      [command.commandId]: receipt,
    },
    outbox: [...store.outbox, ...nextEffects],
  };
  return {
    store: nextStore,
    execution: executionFromDecision('accepted', resultingState, decision, true),
  };
}
