import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import {
  COMMAND_SCHEMA_VERSION,
  EVENT_SCHEMA_VERSION,
  dispatchMemory,
  emptyMemoryEngineStore,
  evolve,
  extractWikiLinks,
  initialPageState,
  projectBacklinks,
  projectHistory,
  projectRecentChanges,
  replay,
  step,
  type Actor,
  type Capability,
  type MemoryEngineStore,
  type RevisionInput,
  type WikiCommand,
  type WikiEvent,
} from '../src/lib/wiki-engine/index.ts';

const T0 = '2026-08-08T00:00:00.000Z';
const T1 = '2026-08-08T00:01:00.000Z';
const T2 = '2026-08-08T00:02:00.000Z';
const T3 = '2026-08-08T00:03:00.000Z';
const T4 = '2026-08-08T00:04:00.000Z';
const T5 = '2026-08-08T00:05:00.000Z';
const T6 = '2026-08-08T00:06:00.000Z';
const T7 = '2026-08-08T00:07:00.000Z';
const T8 = '2026-08-08T00:08:00.000Z';

function actor(id: string, capabilities: readonly Capability[]): Actor {
  return { id, capabilities };
}

const editor = actor('user:editor', ['wiki:edit', 'kg:submit']);
const reviewer = actor('user:reviewer', ['kg:review']);
const authorizer = actor('user:root', ['kg:authorize']);
const publisher = actor('service:kg-publisher', ['kg:publish']);

function revision(revisionId: string, content: string): RevisionInput {
  return {
    revisionId,
    content,
    contentHash: `sha256:${createHash('sha256').update(content).digest('hex')}`,
    editSummary: `commit ${revisionId}`,
  };
}

function createPage(
  commandId = 'cmd:create:alpha',
  pageId = 'page:alpha',
  slug = 'alpha',
  content = '# Alpha\n\n[[beta]]',
): Extract<WikiCommand, { type: 'CreatePage' }> {
  return {
    schemaVersion: COMMAND_SCHEMA_VERSION,
    type: 'CreatePage',
    commandId,
    pageId,
    actor: editor,
    occurredAt: T0,
    slug,
    title: 'Alpha',
    revision: revision(`${pageId}:r1`, content),
  };
}

function run(store: MemoryEngineStore, command: WikiCommand) {
  return dispatchMemory(store, command);
}

test('create is immutable, replayable, and schedules derived projections', () => {
  const empty = emptyMemoryEngineStore();
  const created = run(empty, createPage());

  assert.equal(created.execution.kind, 'accepted');
  assert.equal(created.execution.state.lifecycle, 'active');
  assert.equal(created.execution.state.headRevisionId, 'page:alpha:r1');
  assert.equal(empty.streams['page:alpha'], undefined);
  assert.equal(created.store.streams['page:alpha']?.length, 1);
  assert.deepEqual(
    created.execution.effects.map((effect) => effect.type),
    ['IndexRevision', 'UpdateBacklinks', 'RenderPage', 'AppendRecentChange'],
  );
  assert.deepEqual(
    replay('page:alpha', created.store.streams['page:alpha'] ?? []),
    created.execution.state,
  );
});

test('optimistic concurrency rejects a stale base revision without appending an event', () => {
  const created = run(emptyMemoryEngineStore(), createPage());
  const staleEdit: WikiCommand = {
    schemaVersion: COMMAND_SCHEMA_VERSION,
    type: 'CommitRevision',
    commandId: 'cmd:stale-edit',
    pageId: 'page:alpha',
    actor: editor,
    occurredAt: T1,
    expectedHeadRevisionId: 'page:alpha:r0',
    revision: revision('page:alpha:r2', '# Changed'),
  };
  const result = run(created.store, staleEdit);

  assert.equal(result.execution.kind, 'rejected');
  assert.equal(result.execution.rejection?.code, 'REVISION_CONFLICT');
  assert.equal(result.store.streams['page:alpha']?.length, 1);
});

test('revision content is bound to its declared SHA-256', () => {
  const command = createPage();
  const forged = {
    ...command,
    revision: {
      ...command.revision,
      contentHash: revision('unused', '# Different content').contentHash,
    },
  };
  const result = run(emptyMemoryEngineStore(), forged);

  assert.equal(result.execution.kind, 'rejected');
  assert.equal(result.execution.rejection?.code, 'CONTENT_HASH_MISMATCH');
  assert.equal(result.store.streams['page:alpha'], undefined);
});

test('revision ids cannot be reused anywhere in one page stream', () => {
  const created = run(emptyMemoryEngineStore(), createPage());
  const edited = run(created.store, {
    schemaVersion: COMMAND_SCHEMA_VERSION,
    type: 'CommitRevision',
    commandId: 'cmd:edit:r2',
    pageId: 'page:alpha',
    actor: editor,
    occurredAt: T1,
    expectedHeadRevisionId: 'page:alpha:r1',
    revision: revision('page:alpha:r2', '# Alpha v2'),
  });
  const reused = run(edited.store, {
    schemaVersion: COMMAND_SCHEMA_VERSION,
    type: 'CommitRevision',
    commandId: 'cmd:reuse:r1',
    pageId: 'page:alpha',
    actor: editor,
    occurredAt: T2,
    expectedHeadRevisionId: 'page:alpha:r2',
    revision: revision('page:alpha:r1', '# Forged reuse'),
  });

  assert.equal(reused.execution.rejection?.code, 'REVISION_ID_REUSED');
  assert.equal(reused.store.streams['page:alpha']?.length, 2);
});

test('same command id is idempotent and a changed payload with that id is fenced', () => {
  const command = createPage();
  const first = run(emptyMemoryEngineStore(), command);
  const advanced = run(first.store, {
    schemaVersion: COMMAND_SCHEMA_VERSION,
    type: 'CommitRevision',
    commandId: 'cmd:advance-after-create',
    pageId: 'page:alpha',
    actor: editor,
    occurredAt: T1,
    expectedHeadRevisionId: 'page:alpha:r1',
    revision: revision('page:alpha:r2', '# Alpha advanced'),
  });
  const replayed = run(advanced.store, {
    ...command,
    actor: { ...command.actor, capabilities: [...command.actor.capabilities].reverse() },
  });

  assert.equal(replayed.execution.kind, 'replayed');
  assert.equal(replayed.store, advanced.store);
  assert.equal(replayed.execution.state.headRevisionId, 'page:alpha:r1');
  assert.equal(replayed.execution.effects.length, 0);
  assert.equal(replayed.store.outbox.length, advanced.store.outbox.length);

  const reused = run(advanced.store, createPage(command.commandId, 'page:other', 'other'));
  assert.equal(reused.execution.kind, 'rejected');
  assert.equal(reused.execution.rejection?.code, 'IDEMPOTENCY_KEY_REUSED');
  assert.equal(reused.store, advanced.store);
});

test('KG canon application requires review, USER_PRIMARY authorization, and exact readback', () => {
  const created = run(emptyMemoryEngineStore(), createPage());
  const submitted = run(created.store, {
    schemaVersion: COMMAND_SCHEMA_VERSION,
    type: 'SubmitForKgReview',
    commandId: 'cmd:submit',
    pageId: 'page:alpha',
    actor: editor,
    occurredAt: T1,
    revisionId: 'page:alpha:r1',
  });
  assert.equal(submitted.execution.state.publication.kind, 'in_review');

  const selfReview = run(submitted.store, {
    schemaVersion: COMMAND_SCHEMA_VERSION,
    type: 'ApproveKgProposal',
    commandId: 'cmd:self-review',
    pageId: 'page:alpha',
    actor: actor('user:editor', ['kg:review']),
    occurredAt: T2,
    revisionId: 'page:alpha:r1',
  });
  assert.equal(selfReview.execution.rejection?.code, 'SELF_REVIEW_FORBIDDEN');

  const reviewed = run(selfReview.store, {
    schemaVersion: COMMAND_SCHEMA_VERSION,
    type: 'ApproveKgProposal',
    commandId: 'cmd:approve',
    pageId: 'page:alpha',
    actor: reviewer,
    occurredAt: T3,
    revisionId: 'page:alpha:r1',
  });
  assert.equal(reviewed.execution.state.publication.kind, 'review_approved');
  assert.ok(!reviewed.execution.effects.some((effect) => effect.type === 'ApplyKgCanonRevision'));

  const wrongTarget = run(reviewed.store, {
    schemaVersion: COMMAND_SCHEMA_VERSION,
    type: 'AuthorizeKgCanonApplication',
    commandId: 'cmd:authorize-wrong-target',
    pageId: 'page:alpha',
    actor: authorizer,
    occurredAt: T4,
    revisionId: 'page:alpha:r1',
    contentHash: revision('unused', '# Different content').contentHash,
    approvalReceiptId: 'user-verdict:wrong-target',
  });
  assert.equal(wrongTarget.execution.rejection?.code, 'APPROVAL_TARGET_MISMATCH');

  const authorized = run(reviewed.store, {
    schemaVersion: COMMAND_SCHEMA_VERSION,
    type: 'AuthorizeKgCanonApplication',
    commandId: 'cmd:authorize-canon',
    pageId: 'page:alpha',
    actor: authorizer,
    occurredAt: T4,
    revisionId: 'page:alpha:r1',
    contentHash: revision('unused', '# Alpha\n\n[[beta]]').contentHash,
    approvalReceiptId: 'user-verdict:123',
  });
  assert.equal(authorized.execution.state.publication.kind, 'canon_authorized');
  assert.ok(authorized.execution.effects.some((effect) => effect.type === 'ApplyKgCanonRevision'));

  const editedWhileAuthorized = run(authorized.store, {
    schemaVersion: COMMAND_SCHEMA_VERSION,
    type: 'CommitRevision',
    commandId: 'cmd:edit-after-authorization',
    pageId: 'page:alpha',
    actor: editor,
    occurredAt: T5,
    expectedHeadRevisionId: 'page:alpha:r1',
    revision: revision('page:alpha:r2', '# Alpha v2\n\n[[gamma]]'),
  });
  assert.deepEqual(
    editedWhileAuthorized.execution.events.map((event) => event.type),
    ['RevisionCommitted'],
  );
  assert.equal(editedWhileAuthorized.execution.state.publication.kind, 'canon_authorized');

  const wrongReceipt = run(editedWhileAuthorized.store, {
    schemaVersion: COMMAND_SCHEMA_VERSION,
    type: 'RecordKgCanonApplication',
    commandId: 'cmd:record-wrong-receipt',
    pageId: 'page:alpha',
    actor: publisher,
    occurredAt: T5,
    revisionId: 'page:alpha:r1',
    contentHash: revision('unused', '# Alpha\n\n[[beta]]').contentHash,
    approvalReceiptId: 'user-verdict:different',
    applicationReceiptId: 'kg-readback:wrong-receipt',
  });
  assert.equal(wrongReceipt.execution.rejection?.code, 'RECEIPT_MISMATCH');

  const applied = run(wrongReceipt.store, {
    schemaVersion: COMMAND_SCHEMA_VERSION,
    type: 'RecordKgCanonApplication',
    commandId: 'cmd:record-canon-application',
    pageId: 'page:alpha',
    actor: publisher,
    occurredAt: T6,
    revisionId: 'page:alpha:r1',
    contentHash: revision('unused', '# Alpha\n\n[[beta]]').contentHash,
    approvalReceiptId: 'user-verdict:123',
    applicationReceiptId: 'kg-readback:123',
  });
  assert.equal(applied.execution.state.publication.kind, 'canon_applied');
  assert.equal(applied.execution.state.headRevisionId, 'page:alpha:r2');
  assert.equal(applied.execution.state.lastAppliedCanon?.revisionId, 'page:alpha:r1');

  const edited = run(applied.store, {
    schemaVersion: COMMAND_SCHEMA_VERSION,
    type: 'CommitRevision',
    commandId: 'cmd:edit-after-publication',
    pageId: 'page:alpha',
    actor: editor,
    occurredAt: T7,
    expectedHeadRevisionId: 'page:alpha:r2',
    revision: revision('page:alpha:r3', '# Alpha v3\n\n[[delta]]'),
  });
  assert.deepEqual(edited.execution.events.map((event) => event.type), ['RevisionCommitted']);
  assert.equal(edited.execution.state.publication.kind, 'canon_applied');
  assert.equal(edited.execution.state.lastAppliedCanon?.revisionId, 'page:alpha:r1');

  const nextProposal = run(edited.store, {
    schemaVersion: COMMAND_SCHEMA_VERSION,
    type: 'SubmitForKgReview',
    commandId: 'cmd:submit:r3',
    pageId: 'page:alpha',
    actor: editor,
    occurredAt: T8,
    revisionId: 'page:alpha:r3',
  });
  assert.equal(nextProposal.execution.state.publication.kind, 'in_review');
  assert.equal(nextProposal.execution.state.lastAppliedCanon?.revisionId, 'page:alpha:r1');
});

test('a new community revision supersedes only a pre-canon proposal', () => {
  const created = run(emptyMemoryEngineStore(), createPage());
  const submitted = run(created.store, {
    schemaVersion: COMMAND_SCHEMA_VERSION,
    type: 'SubmitForKgReview',
    commandId: 'cmd:submit:pre-canon',
    pageId: 'page:alpha',
    actor: editor,
    occurredAt: T1,
    revisionId: 'page:alpha:r1',
  });
  const edited = run(submitted.store, {
    schemaVersion: COMMAND_SCHEMA_VERSION,
    type: 'CommitRevision',
    commandId: 'cmd:supersede:pre-canon',
    pageId: 'page:alpha',
    actor: editor,
    occurredAt: T2,
    expectedHeadRevisionId: 'page:alpha:r1',
    revision: revision('page:alpha:r2', '# New community head'),
  });

  assert.deepEqual(
    edited.execution.events.map((event) => event.type),
    ['RevisionCommitted', 'KgProposalSuperseded'],
  );
  assert.equal(edited.execution.state.publication.kind, 'superseded');
  assert.ok(!edited.execution.effects.some((effect) => effect.type === 'ApplyKgCanonRevision'));
});

test('an independently rejected proposal can be resubmitted without mutating revision history', () => {
  const created = run(emptyMemoryEngineStore(), createPage());
  const submitted = run(created.store, {
    schemaVersion: COMMAND_SCHEMA_VERSION,
    type: 'SubmitForKgReview',
    commandId: 'cmd:submit:rejectable',
    pageId: 'page:alpha',
    actor: editor,
    occurredAt: T1,
    revisionId: 'page:alpha:r1',
  });
  const rejected = run(submitted.store, {
    schemaVersion: COMMAND_SCHEMA_VERSION,
    type: 'RejectKgProposal',
    commandId: 'cmd:reject',
    pageId: 'page:alpha',
    actor: reviewer,
    occurredAt: T2,
    revisionId: 'page:alpha:r1',
    reason: 'sources need clarification',
  });
  assert.equal(rejected.execution.state.publication.kind, 'rejected');

  const resubmitted = run(rejected.store, {
    schemaVersion: COMMAND_SCHEMA_VERSION,
    type: 'SubmitForKgReview',
    commandId: 'cmd:resubmit',
    pageId: 'page:alpha',
    actor: editor,
    occurredAt: T3,
    revisionId: 'page:alpha:r1',
  });

  assert.equal(resubmitted.execution.state.publication.kind, 'in_review');
  assert.equal(resubmitted.execution.state.revisionCount, 1);
  assert.deepEqual(resubmitted.execution.state.revisionIds, ['page:alpha:r1']);
});

test('invalid domain events leave state unchanged, emit an audit intent, and fail replay closed', () => {
  const invalid: WikiEvent = {
    schemaVersion: EVENT_SCHEMA_VERSION,
    type: 'PageRestored',
    eventId: 'event:invalid-restore',
    commandId: 'cmd:invalid-restore',
    pageId: 'page:alpha',
    actorId: 'user:editor',
    occurredAt: T0,
    headRevisionId: 'page:alpha:r1',
  };
  const initial = initialPageState('page:alpha');
  const result = step(initial, invalid);

  assert.equal(result.ok, false);
  assert.equal(result.state, initial);
  assert.deepEqual(result.effects.map((effect) => effect.type), ['AuditInvalidTransition']);
  assert.throws(() => evolve(initial, invalid), /INVALID_EVENT_TRANSITION/);
  assert.throws(() => replay('page:alpha', [invalid]), /INVALID_EVENT_TRANSITION/);
});

test('replay rejects forged revision and USER_PRIMARY provenance', () => {
  const created = run(emptyMemoryEngineStore(), createPage());
  const createdEvents = created.store.streams['page:alpha'] ?? [];
  const creation = createdEvents[0];
  assert.equal(creation?.type, 'PageCreated');
  if (!creation || creation.type !== 'PageCreated') throw new Error('missing PageCreated fixture');
  const forgedCreation: WikiEvent = {
    ...creation,
    revision: { ...creation.revision, authorId: 'user:forger' },
  };
  assert.throws(() => replay('page:alpha', [forgedCreation]), /revision author/);

  const submitted = run(created.store, {
    schemaVersion: COMMAND_SCHEMA_VERSION,
    type: 'SubmitForKgReview',
    commandId: 'cmd:submit:provenance',
    pageId: 'page:alpha',
    actor: editor,
    occurredAt: T1,
    revisionId: 'page:alpha:r1',
  });
  const reviewed = run(submitted.store, {
    schemaVersion: COMMAND_SCHEMA_VERSION,
    type: 'ApproveKgProposal',
    commandId: 'cmd:approve:provenance',
    pageId: 'page:alpha',
    actor: reviewer,
    occurredAt: T2,
    revisionId: 'page:alpha:r1',
  });
  const authorized = run(reviewed.store, {
    schemaVersion: COMMAND_SCHEMA_VERSION,
    type: 'AuthorizeKgCanonApplication',
    commandId: 'cmd:authorize:provenance',
    pageId: 'page:alpha',
    actor: authorizer,
    occurredAt: T3,
    revisionId: 'page:alpha:r1',
    contentHash: revision('unused', '# Alpha\n\n[[beta]]').contentHash,
    approvalReceiptId: 'user-verdict:provenance',
  });
  const authorizedEvents = authorized.store.streams['page:alpha'] ?? [];
  const authorization = authorizedEvents.at(-1);
  assert.equal(authorization?.type, 'KgCanonApplicationAuthorized');
  if (!authorization || authorization.type !== 'KgCanonApplicationAuthorized') {
    throw new Error('missing KgCanonApplicationAuthorized fixture');
  }
  const forgedAuthorization: WikiEvent = {
    ...authorization,
    actorId: 'user:forger',
  };
  assert.throws(
    () => replay('page:alpha', [...authorizedEvents.slice(0, -1), forgedAuthorization]),
    /canon authorization/,
  );

  const recorded = run(authorized.store, {
    schemaVersion: COMMAND_SCHEMA_VERSION,
    type: 'RecordKgCanonApplication',
    commandId: 'cmd:record:provenance',
    pageId: 'page:alpha',
    actor: publisher,
    occurredAt: T4,
    revisionId: 'page:alpha:r1',
    contentHash: revision('unused', '# Alpha\n\n[[beta]]').contentHash,
    approvalReceiptId: 'user-verdict:provenance',
    applicationReceiptId: 'kg-readback:provenance',
  });
  const recordedEvents = recorded.store.streams['page:alpha'] ?? [];
  const application = recordedEvents.at(-1);
  assert.equal(application?.type, 'KgCanonApplicationRecorded');
  if (!application || application.type !== 'KgCanonApplicationRecorded') {
    throw new Error('missing KgCanonApplicationRecorded fixture');
  }
  const forgedApplication: WikiEvent = {
    ...application,
    actorId: 'user:attacker',
  };
  assert.throws(
    () => replay('page:alpha', [...recordedEvents.slice(0, -1), forgedApplication]),
    /application readback/,
  );
});

test('delete and restore preserve immutable revision history', () => {
  const created = run(emptyMemoryEngineStore(), createPage());
  const deleted = run(created.store, {
    schemaVersion: COMMAND_SCHEMA_VERSION,
    type: 'DeletePage',
    commandId: 'cmd:delete',
    pageId: 'page:alpha',
    actor: editor,
    occurredAt: T1,
    expectedHeadRevisionId: 'page:alpha:r1',
    reason: 'duplicate page',
  });
  assert.equal(deleted.execution.state.lifecycle, 'deleted');

  const restored = run(deleted.store, {
    schemaVersion: COMMAND_SCHEMA_VERSION,
    type: 'RestorePage',
    commandId: 'cmd:restore',
    pageId: 'page:alpha',
    actor: editor,
    occurredAt: T2,
    expectedHeadRevisionId: 'page:alpha:r1',
  });
  assert.equal(restored.execution.state.lifecycle, 'active');
  assert.equal(projectHistory(restored.store.streams['page:alpha'] ?? []).length, 1);
  assert.deepEqual(
    projectRecentChanges(restored.store.streams['page:alpha'] ?? []).map((change) => change.type),
    ['PageRestored', 'PageDeleted', 'PageCreated'],
  );
});

test('history and backlinks are rebuildable pure projections', () => {
  const alpha = run(emptyMemoryEngineStore(), createPage());
  const beta = run(
    alpha.store,
    createPage('cmd:create:beta', 'page:beta', 'beta', '# Beta\n\n[[alpha|Alpha page]]'),
  );
  const links = projectBacklinks(beta.store.streams);

  assert.deepEqual(extractWikiLinks('[[Alpha]] [[alpha|again]] [[Beta#part]]'), ['alpha', 'beta']);
  assert.deepEqual(links, { alpha: ['beta'], beta: ['alpha'] });
});
