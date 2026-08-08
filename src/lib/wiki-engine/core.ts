import { createHash } from 'node:crypto';

import {
  COMMAND_SCHEMA_VERSION,
  EVENT_SCHEMA_VERSION,
  STATE_SCHEMA_VERSION,
  type Capability,
  type Decision,
  type EffectIntent,
  type EventStep,
  type PageState,
  type PublicationState,
  type Rejection,
  type RevisionInput,
  type RevisionRecord,
  type WikiCommand,
  type WikiEvent,
} from './types.ts';

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
const SLUG_PATTERN = /^[\p{Letter}\p{Number}](?:[\p{Letter}\p{Number}_-]{0,127})$/u;

export function initialPageState(pageId: string): PageState {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    pageId,
    lifecycle: 'absent',
    authority: 'COMMUNITY',
    slug: null,
    title: null,
    headRevisionId: null,
    headContentHash: null,
    revisionCount: 0,
    revisionIds: [],
    publication: { kind: 'unsubmitted' },
    lastAppliedCanon: null,
  };
}

function rejected(
  code: Rejection['code'],
  message: string,
  details?: Readonly<Record<string, string>>,
): Decision {
  return { ok: false, rejection: { code, message, ...(details ? { details } : {}) } };
}

function accepted(events: readonly WikiEvent[]): Decision {
  return { ok: true, events };
}

function hasCapability(command: WikiCommand, capability: Capability): boolean {
  return command.actor.capabilities.includes(capability);
}

function validateCommandEnvelope(state: PageState, command: WikiCommand): Decision | null {
  if (
    command.schemaVersion !== COMMAND_SCHEMA_VERSION ||
    !command.commandId.trim() ||
    !command.pageId.trim() ||
    !command.actor.id.trim() ||
    !command.occurredAt.trim()
  ) {
    return rejected('INVALID_COMMAND', 'The command envelope is incomplete.');
  }
  if (command.pageId !== state.pageId) {
    return rejected('INVALID_COMMAND', 'The command targets a different page stream.', {
      expectedPageId: state.pageId,
      actualPageId: command.pageId,
    });
  }
  return null;
}

function validateRevision(revision: RevisionInput): Decision | null {
  if (
    !revision.revisionId.trim() ||
    !revision.content.trim() ||
    !SHA256_PATTERN.test(revision.contentHash)
  ) {
    return rejected(
      'INVALID_REVISION',
      'A revision needs an id, non-empty content, and a sha256:<64 lowercase hex> hash.',
    );
  }
  const actualContentHash = `sha256:${createHash('sha256').update(revision.content).digest('hex')}`;
  if (revision.contentHash !== actualContentHash) {
    return rejected('CONTENT_HASH_MISMATCH', 'The revision content does not match its declared SHA-256.', {
      declaredContentHash: revision.contentHash,
      actualContentHash,
    });
  }
  return null;
}

function requireActive(state: PageState): Decision | null {
  if (state.lifecycle === 'absent') {
    return rejected('PAGE_NOT_FOUND', 'The page does not exist.');
  }
  if (state.lifecycle === 'deleted') {
    return rejected('PAGE_DELETED', 'The page is deleted and must be restored first.');
  }
  return null;
}

function requireExpectedHead(state: PageState, expectedHeadRevisionId: string): Decision | null {
  if (state.headRevisionId !== expectedHeadRevisionId) {
    return rejected('REVISION_CONFLICT', 'The page changed after the editor loaded it.', {
      expectedHeadRevisionId,
      actualHeadRevisionId: state.headRevisionId ?? 'none',
    });
  }
  return null;
}

function eventBase(command: WikiCommand, index: number) {
  return {
    schemaVersion: EVENT_SCHEMA_VERSION,
    eventId: `${command.commandId}:${index}`,
    commandId: command.commandId,
    pageId: command.pageId,
    actorId: command.actor.id,
    occurredAt: command.occurredAt,
  } as const;
}

function revisionRecord(
  revision: RevisionInput,
  parentRevisionId: string | null,
  command: WikiCommand,
): RevisionRecord {
  return {
    ...revision,
    parentRevisionId,
    authorId: command.actor.id,
    committedAt: command.occurredAt,
  };
}

function supersessionSource(publication: PublicationState):
  | Readonly<{
      revisionId: string;
      contentHash: string;
      previousStatus:
        | 'in_review'
        | 'review_approved'
        | 'rejected';
    }>
  | null {
  switch (publication.kind) {
    case 'in_review':
    case 'review_approved':
    case 'rejected':
      return {
        revisionId: publication.revisionId,
        contentHash: publication.contentHash,
        previousStatus: publication.kind,
      };
    case 'unsubmitted':
    case 'canon_authorized':
    case 'canon_applied':
    case 'superseded':
      return null;
  }
}

export function decide(state: PageState, command: WikiCommand): Decision {
  const envelopeFailure = validateCommandEnvelope(state, command);
  if (envelopeFailure) return envelopeFailure;

  switch (command.type) {
    case 'CreatePage': {
      if (!hasCapability(command, 'wiki:edit')) {
        return rejected('FORBIDDEN', 'wiki:edit is required to create a page.');
      }
      if (state.lifecycle !== 'absent') {
        return rejected('PAGE_ALREADY_EXISTS', 'The page stream already exists.');
      }
      if (!SLUG_PATTERN.test(command.slug) || !command.title.trim()) {
        return rejected('INVALID_SLUG', 'The slug or title is invalid.');
      }
      const revisionFailure = validateRevision(command.revision);
      if (revisionFailure) return revisionFailure;
      return accepted([
        {
          ...eventBase(command, 0),
          type: 'PageCreated',
          slug: command.slug,
          title: command.title.trim(),
          revision: revisionRecord(command.revision, null, command),
        },
      ]);
    }

    case 'CommitRevision': {
      if (!hasCapability(command, 'wiki:edit')) {
        return rejected('FORBIDDEN', 'wiki:edit is required to commit a revision.');
      }
      const activeFailure = requireActive(state);
      if (activeFailure) return activeFailure;
      const conflict = requireExpectedHead(state, command.expectedHeadRevisionId);
      if (conflict) return conflict;
      const revisionFailure = validateRevision(command.revision);
      if (revisionFailure) return revisionFailure;
      if (state.revisionIds.includes(command.revision.revisionId)) {
        return rejected('REVISION_ID_REUSED', 'A revision id is immutable and cannot be reused in a page stream.');
      }
      if (command.revision.contentHash === state.headContentHash) {
        return rejected('NO_CHANGES', 'The proposed content is identical to the current head.');
      }

      const events: WikiEvent[] = [
        {
          ...eventBase(command, 0),
          type: 'RevisionCommitted',
          revision: revisionRecord(command.revision, state.headRevisionId, command),
        },
      ];
      const superseded = supersessionSource(state.publication);
      if (superseded) {
        events.push({
          ...eventBase(command, 1),
          type: 'KgProposalSuperseded',
          ...superseded,
          replacementRevisionId: command.revision.revisionId,
          reason: 'new_revision',
        });
      }
      return accepted(events);
    }

    case 'DeletePage': {
      if (!hasCapability(command, 'wiki:edit')) {
        return rejected('FORBIDDEN', 'wiki:edit is required to delete a page.');
      }
      const activeFailure = requireActive(state);
      if (activeFailure) return activeFailure;
      const conflict = requireExpectedHead(state, command.expectedHeadRevisionId);
      if (conflict) return conflict;
      if (!command.reason.trim()) {
        return rejected('INVALID_COMMAND', 'A deletion reason is required.');
      }

      const events: WikiEvent[] = [
        {
          ...eventBase(command, 0),
          type: 'PageDeleted',
          headRevisionId: command.expectedHeadRevisionId,
          reason: command.reason.trim(),
        },
      ];
      const superseded = supersessionSource(state.publication);
      if (superseded) {
        events.push({
          ...eventBase(command, 1),
          type: 'KgProposalSuperseded',
          ...superseded,
          replacementRevisionId: null,
          reason: 'page_deleted',
        });
      }
      return accepted(events);
    }

    case 'RestorePage': {
      if (!hasCapability(command, 'wiki:edit')) {
        return rejected('FORBIDDEN', 'wiki:edit is required to restore a page.');
      }
      if (state.lifecycle === 'absent') {
        return rejected('PAGE_NOT_FOUND', 'The page does not exist.');
      }
      if (state.lifecycle === 'active') {
        return rejected('PAGE_ACTIVE', 'The page is already active.');
      }
      const conflict = requireExpectedHead(state, command.expectedHeadRevisionId);
      if (conflict) return conflict;
      return accepted([
        {
          ...eventBase(command, 0),
          type: 'PageRestored',
          headRevisionId: command.expectedHeadRevisionId,
        },
      ]);
    }

    case 'SubmitForKgReview': {
      if (!hasCapability(command, 'kg:submit')) {
        return rejected('FORBIDDEN', 'kg:submit is required to request KG publication.');
      }
      const activeFailure = requireActive(state);
      if (activeFailure) return activeFailure;
      if (command.revisionId !== state.headRevisionId) {
        return rejected('NOT_HEAD_REVISION', 'Only the current head revision can be submitted.');
      }
      if (!['unsubmitted', 'rejected', 'superseded', 'canon_applied'].includes(state.publication.kind)) {
        return rejected('INVALID_PUBLICATION_STATE', 'This revision already has an active review or canon workflow.');
      }
      return accepted([
        {
          ...eventBase(command, 0),
          type: 'KgReviewSubmitted',
          revisionId: command.revisionId,
          contentHash: state.headContentHash as string,
          submitterId: command.actor.id,
        },
      ]);
    }

    case 'ApproveKgProposal': {
      if (!hasCapability(command, 'kg:review')) {
        return rejected('FORBIDDEN', 'kg:review is required to approve publication.');
      }
      const activeFailure = requireActive(state);
      if (activeFailure) return activeFailure;
      if (state.publication.kind !== 'in_review') {
        return rejected('INVALID_PUBLICATION_STATE', 'There is no review awaiting approval.');
      }
      if (command.revisionId !== state.publication.revisionId) {
        return rejected('NOT_HEAD_REVISION', 'The approval does not target the submitted revision.');
      }
      if (command.actor.id === state.publication.submitterId) {
        return rejected('SELF_REVIEW_FORBIDDEN', 'The submitter cannot approve the same revision.');
      }
      return accepted([
        {
          ...eventBase(command, 0),
          type: 'KgProposalApproved',
          revisionId: state.publication.revisionId,
          contentHash: state.publication.contentHash,
          submitterId: state.publication.submitterId,
          reviewerId: command.actor.id,
        },
      ]);
    }

    case 'RejectKgProposal': {
      if (!hasCapability(command, 'kg:review')) {
        return rejected('FORBIDDEN', 'kg:review is required to reject publication.');
      }
      const activeFailure = requireActive(state);
      if (activeFailure) return activeFailure;
      if (state.publication.kind !== 'in_review') {
        return rejected('INVALID_PUBLICATION_STATE', 'There is no review awaiting a verdict.');
      }
      if (command.revisionId !== state.publication.revisionId) {
        return rejected('NOT_HEAD_REVISION', 'The rejection does not target the submitted revision.');
      }
      if (command.actor.id === state.publication.submitterId) {
        return rejected('SELF_REVIEW_FORBIDDEN', 'The submitter cannot review the same revision.');
      }
      if (!command.reason.trim()) {
        return rejected('INVALID_COMMAND', 'A rejection reason is required.');
      }
      return accepted([
        {
          ...eventBase(command, 0),
          type: 'KgReviewRejected',
          revisionId: state.publication.revisionId,
          contentHash: state.publication.contentHash,
          submitterId: state.publication.submitterId,
          reviewerId: command.actor.id,
          reason: command.reason.trim(),
        },
      ]);
    }

    case 'AuthorizeKgCanonApplication': {
      if (!hasCapability(command, 'kg:authorize')) {
        return rejected('FORBIDDEN', 'kg:authorize is required to authorize a canon application.');
      }
      const activeFailure = requireActive(state);
      if (activeFailure) return activeFailure;
      if (state.publication.kind !== 'review_approved') {
        return rejected('INVALID_PUBLICATION_STATE', 'The proposal has not passed independent review.');
      }
      if (command.revisionId !== state.publication.revisionId) {
        return rejected('NOT_HEAD_REVISION', 'The authorization does not target the reviewed revision.');
      }
      if (command.contentHash !== state.publication.contentHash) {
        return rejected('APPROVAL_TARGET_MISMATCH', 'The authorization content hash differs from the reviewed revision.');
      }
      if (!command.approvalReceiptId.trim()) {
        return rejected('INVALID_COMMAND', 'An exact USER_PRIMARY approval receipt is required.');
      }
      return accepted([
        {
          ...eventBase(command, 0),
          type: 'KgCanonApplicationAuthorized',
          revisionId: state.publication.revisionId,
          contentHash: state.publication.contentHash,
          submitterId: state.publication.submitterId,
          reviewerId: state.publication.reviewerId,
          authorizerId: command.actor.id,
          approvalReceiptId: command.approvalReceiptId.trim(),
        },
      ]);
    }

    case 'RecordKgCanonApplication': {
      if (!hasCapability(command, 'kg:publish')) {
        return rejected('FORBIDDEN', 'kg:publish is required to record an exact KG application receipt.');
      }
      if (state.publication.kind !== 'canon_authorized') {
        return rejected('INVALID_PUBLICATION_STATE', 'The revision has no USER_PRIMARY canon authorization.');
      }
      if (command.revisionId !== state.publication.revisionId) {
        return rejected('NOT_HEAD_REVISION', 'The KG receipt does not target the authorized revision.');
      }
      if (
        command.contentHash !== state.publication.contentHash ||
        command.approvalReceiptId !== state.publication.approvalReceiptId
      ) {
        return rejected('RECEIPT_MISMATCH', 'The KG readback is not bound to the authorized hash and approval receipt.');
      }
      if (!command.applicationReceiptId.trim()) {
        return rejected('INVALID_COMMAND', 'An exact KG application readback receipt is required.');
      }
      return accepted([
        {
          ...eventBase(command, 0),
          type: 'KgCanonApplicationRecorded',
          revisionId: state.publication.revisionId,
          contentHash: state.publication.contentHash,
          submitterId: state.publication.submitterId,
          reviewerId: state.publication.reviewerId,
          authorizerId: state.publication.authorizerId,
          publisherId: command.actor.id,
          approvalReceiptId: state.publication.approvalReceiptId,
          applicationReceiptId: command.applicationReceiptId.trim(),
        },
      ]);
    }
  }
}

function eventRejected(
  message: string,
  details?: Readonly<Record<string, string>>,
): Rejection {
  return {
    code: 'INVALID_EVENT_TRANSITION',
    message,
    ...(details ? { details } : {}),
  };
}

function exactPublicationTarget(
  publication: Exclude<PublicationState, Readonly<{ kind: 'unsubmitted' }>>,
  event: Readonly<{ revisionId: string; contentHash: string }>,
): boolean {
  return publication.revisionId === event.revisionId && publication.contentHash === event.contentHash;
}

function validateRevisionProvenance(
  revision: RevisionRecord,
  event: Readonly<{ actorId: string; occurredAt: string }>,
): Rejection | null {
  if (revision.authorId !== event.actorId || revision.committedAt !== event.occurredAt) {
    return eventRejected('The revision author and commit time must match its event envelope.');
  }
  return null;
}

function validateEventTransition(state: PageState, event: WikiEvent): Rejection | null {
  if (
    event.schemaVersion !== EVENT_SCHEMA_VERSION ||
    event.pageId !== state.pageId ||
    !event.eventId.trim() ||
    !event.commandId.trim() ||
    !event.actorId.trim() ||
    !event.occurredAt.trim()
  ) {
    return eventRejected('The event envelope is invalid or targets another page stream.');
  }

  switch (event.type) {
    case 'PageCreated': {
      if (state.lifecycle !== 'absent' || state.revisionCount !== 0) {
        return eventRejected('PageCreated is valid only for an empty absent stream.');
      }
      if (!SLUG_PATTERN.test(event.slug) || !event.title.trim() || event.title !== event.title.trim()) {
        return eventRejected('PageCreated contains an invalid slug or non-normalized title.');
      }
      if (event.revision.parentRevisionId !== null) {
        return eventRejected('The first revision cannot name a parent.');
      }
      const revisionFailure = validateRevision(event.revision);
      if (revisionFailure && !revisionFailure.ok) return revisionFailure.rejection;
      return validateRevisionProvenance(event.revision, event);
    }
    case 'RevisionCommitted': {
      if (state.lifecycle !== 'active') {
        return eventRejected('RevisionCommitted requires an active page.');
      }
      if (event.revision.parentRevisionId !== state.headRevisionId) {
        return eventRejected('The revision parent does not equal the current head.');
      }
      if (state.revisionIds.includes(event.revision.revisionId)) {
        return eventRejected('The revision id already exists in this page stream.');
      }
      const revisionFailure = validateRevision(event.revision);
      if (revisionFailure && !revisionFailure.ok) return revisionFailure.rejection;
      const provenanceFailure = validateRevisionProvenance(event.revision, event);
      if (provenanceFailure) return provenanceFailure;
      return event.revision.contentHash === state.headContentHash
        ? eventRejected('RevisionCommitted cannot append content identical to the current head.')
        : null;
    }
    case 'PageDeleted':
      return state.lifecycle === 'active' &&
        event.headRevisionId === state.headRevisionId &&
        Boolean(event.reason.trim())
        ? null
        : eventRejected('PageDeleted requires an active page, the exact current head, and a reason.');
    case 'PageRestored':
      return state.lifecycle === 'deleted' && event.headRevisionId === state.headRevisionId
        ? null
        : eventRejected('PageRestored requires a deleted page and the preserved exact head.');
    case 'KgReviewSubmitted':
      if (
        state.lifecycle !== 'active' ||
        event.revisionId !== state.headRevisionId ||
        event.contentHash !== state.headContentHash ||
        event.submitterId !== event.actorId
      ) {
        return eventRejected('KG review submission must bind its actor, active current head, and hash.');
      }
      return ['unsubmitted', 'rejected', 'superseded', 'canon_applied'].includes(state.publication.kind)
        ? null
        : eventRejected('The KG workflow cannot accept a new review submission in its current state.');
    case 'KgProposalApproved':
    case 'KgReviewRejected':
      if (
        state.lifecycle !== 'active' ||
        state.publication.kind !== 'in_review' ||
        !exactPublicationTarget(state.publication, event) ||
        event.submitterId !== state.publication.submitterId ||
        event.reviewerId !== event.actorId ||
        event.reviewerId === state.publication.submitterId
      ) {
        return eventRejected('The review verdict does not match an active proposal or uses its submitter.');
      }
      if (event.type === 'KgReviewRejected' && !event.reason.trim()) {
        return eventRejected('A rejected proposal must preserve a non-empty reason.');
      }
      return null;
    case 'KgCanonApplicationAuthorized':
      if (
        state.lifecycle !== 'active' ||
        state.publication.kind !== 'review_approved' ||
        !exactPublicationTarget(state.publication, event) ||
        event.submitterId !== state.publication.submitterId ||
        event.reviewerId !== state.publication.reviewerId ||
        event.authorizerId !== event.actorId ||
        !event.approvalReceiptId.trim()
      ) {
        return eventRejected('The canon authorization does not match the reviewed proposal and exact receipt.');
      }
      return null;
    case 'KgCanonApplicationRecorded':
      if (
        state.publication.kind !== 'canon_authorized' ||
        !exactPublicationTarget(state.publication, event) ||
        event.submitterId !== state.publication.submitterId ||
        event.reviewerId !== state.publication.reviewerId ||
        event.authorizerId !== state.publication.authorizerId ||
        event.publisherId !== event.actorId ||
        event.approvalReceiptId !== state.publication.approvalReceiptId ||
        !event.applicationReceiptId.trim()
      ) {
        return eventRejected('The KG application readback does not match the exact authorization.');
      }
      return null;
    case 'KgProposalSuperseded':
      if (
        (state.publication.kind !== 'in_review' &&
          state.publication.kind !== 'review_approved' &&
          state.publication.kind !== 'rejected') ||
        !exactPublicationTarget(state.publication, event) ||
        event.previousStatus !== state.publication.kind
      ) {
        return eventRejected('Only a pre-canon proposal can be superseded by a community page change.');
      }
      if (
        (event.reason === 'new_revision' &&
          (state.lifecycle !== 'active' ||
            event.replacementRevisionId !== state.headRevisionId ||
            event.replacementRevisionId === event.revisionId)) ||
        (event.reason === 'page_deleted' &&
          (state.lifecycle !== 'deleted' || event.replacementRevisionId !== null))
      ) {
        return eventRejected('The supersession reason does not match the resulting page lifecycle and head.');
      }
      return null;
  }
}

function evolveUnchecked(state: PageState, event: WikiEvent): PageState {
  switch (event.type) {
    case 'PageCreated':
      return {
        ...state,
        lifecycle: 'active',
        slug: event.slug,
        title: event.title,
        headRevisionId: event.revision.revisionId,
        headContentHash: event.revision.contentHash,
        revisionCount: 1,
        revisionIds: [event.revision.revisionId],
        publication: { kind: 'unsubmitted' },
      };
    case 'RevisionCommitted':
      return {
        ...state,
        headRevisionId: event.revision.revisionId,
        headContentHash: event.revision.contentHash,
        revisionCount: state.revisionCount + 1,
        revisionIds: [...state.revisionIds, event.revision.revisionId],
      };
    case 'PageDeleted':
      return { ...state, lifecycle: 'deleted' };
    case 'PageRestored':
      return { ...state, lifecycle: 'active' };
    case 'KgReviewSubmitted':
      return {
        ...state,
        publication: {
          kind: 'in_review',
          revisionId: event.revisionId,
          contentHash: event.contentHash,
          submitterId: event.submitterId,
          submittedAt: event.occurredAt,
        },
      };
    case 'KgProposalApproved':
      return {
        ...state,
        publication: {
          kind: 'review_approved',
          revisionId: event.revisionId,
          contentHash: event.contentHash,
          submitterId: event.submitterId,
          reviewerId: event.reviewerId,
          approvedAt: event.occurredAt,
        },
      };
    case 'KgReviewRejected':
      return {
        ...state,
        publication: {
          kind: 'rejected',
          revisionId: event.revisionId,
          contentHash: event.contentHash,
          submitterId: event.submitterId,
          reviewerId: event.reviewerId,
          reason: event.reason,
          rejectedAt: event.occurredAt,
        },
      };
    case 'KgCanonApplicationAuthorized':
      return {
        ...state,
        publication: {
          kind: 'canon_authorized',
          revisionId: event.revisionId,
          contentHash: event.contentHash,
          submitterId: event.submitterId,
          reviewerId: event.reviewerId,
          authorizerId: event.authorizerId,
          approvalReceiptId: event.approvalReceiptId,
          authorizedAt: event.occurredAt,
        },
      };
    case 'KgCanonApplicationRecorded':
      return {
        ...state,
        publication: {
          kind: 'canon_applied',
          revisionId: event.revisionId,
          contentHash: event.contentHash,
          submitterId: event.submitterId,
          reviewerId: event.reviewerId,
          authorizerId: event.authorizerId,
          publisherId: event.publisherId,
          approvalReceiptId: event.approvalReceiptId,
          applicationReceiptId: event.applicationReceiptId,
          appliedAt: event.occurredAt,
        },
        lastAppliedCanon: {
          revisionId: event.revisionId,
          contentHash: event.contentHash,
          authorizerId: event.authorizerId,
          publisherId: event.publisherId,
          approvalReceiptId: event.approvalReceiptId,
          applicationReceiptId: event.applicationReceiptId,
          appliedAt: event.occurredAt,
        },
      };
    case 'KgProposalSuperseded':
      return {
        ...state,
        publication: {
          kind: 'superseded',
          revisionId: event.revisionId,
          contentHash: event.contentHash,
          previousStatus: event.previousStatus,
          replacementRevisionId: event.replacementRevisionId,
          reason: event.reason,
          supersededAt: event.occurredAt,
        },
      };
  }
}

function effectBase(event: WikiEvent, index: number) {
  return {
    effectId: `${event.eventId}:effect:${index}`,
    eventId: event.eventId,
    pageId: event.pageId,
  } as const;
}

export function effects(event: WikiEvent): readonly EffectIntent[] {
  switch (event.type) {
    case 'PageCreated':
    case 'RevisionCommitted':
      return [
        {
          ...effectBase(event, 0),
          type: 'IndexRevision',
          revisionId: event.revision.revisionId,
          contentHash: event.revision.contentHash,
          content: event.revision.content,
        },
        {
          ...effectBase(event, 1),
          type: 'UpdateBacklinks',
          revisionId: event.revision.revisionId,
          content: event.revision.content,
        },
        {
          ...effectBase(event, 2),
          type: 'RenderPage',
          revisionId: event.revision.revisionId,
        },
        {
          ...effectBase(event, 3),
          type: 'AppendRecentChange',
          changeType: event.type,
          revisionId: event.revision.revisionId,
          actorId: event.actorId,
          occurredAt: event.occurredAt,
        },
      ];
    case 'PageDeleted':
      return [
        { ...effectBase(event, 0), type: 'RemoveSearchDocument' },
        {
          ...effectBase(event, 1),
          type: 'AppendRecentChange',
          changeType: event.type,
          revisionId: event.headRevisionId,
          actorId: event.actorId,
          occurredAt: event.occurredAt,
        },
      ];
    case 'PageRestored':
      return [
        {
          ...effectBase(event, 0),
          type: 'RebuildPageProjection',
          revisionId: event.headRevisionId,
        },
        {
          ...effectBase(event, 1),
          type: 'AppendRecentChange',
          changeType: event.type,
          revisionId: event.headRevisionId,
          actorId: event.actorId,
          occurredAt: event.occurredAt,
        },
      ];
    case 'KgReviewSubmitted':
      return [
        {
          ...effectBase(event, 0),
          type: 'UpdateReviewProjection',
          status: 'in_review',
          revisionId: event.revisionId,
        },
      ];
    case 'KgProposalApproved':
      return [
        {
          ...effectBase(event, 0),
          type: 'UpdateReviewProjection',
          status: 'review_approved',
          revisionId: event.revisionId,
        },
      ];
    case 'KgReviewRejected':
      return [
        {
          ...effectBase(event, 0),
          type: 'UpdateReviewProjection',
          status: 'rejected',
          revisionId: event.revisionId,
        },
      ];
    case 'KgCanonApplicationAuthorized':
      return [
        {
          ...effectBase(event, 0),
          type: 'UpdateReviewProjection',
          status: 'canon_authorized',
          revisionId: event.revisionId,
        },
        {
          ...effectBase(event, 1),
          type: 'ApplyKgCanonRevision',
          revisionId: event.revisionId,
          contentHash: event.contentHash,
          authorizerId: event.authorizerId,
          approvalReceiptId: event.approvalReceiptId,
        },
      ];
    case 'KgCanonApplicationRecorded':
      return [
        {
          ...effectBase(event, 0),
          type: 'UpdateReviewProjection',
          status: 'canon_applied',
          revisionId: event.revisionId,
        },
      ];
    case 'KgProposalSuperseded':
      return [
        {
          ...effectBase(event, 0),
          type: 'UpdateReviewProjection',
          status: 'superseded',
          revisionId: event.revisionId,
        },
      ];
  }
}

export function effectsFor(events: readonly WikiEvent[]): readonly EffectIntent[] {
  return events.flatMap(effects);
}

export function step(state: PageState, event: WikiEvent): EventStep {
  const rejection = validateEventTransition(state, event);
  if (rejection) {
    return {
      ok: false,
      state,
      rejection,
      effects: [
        {
          ...effectBase(event, 0),
          type: 'AuditInvalidTransition',
          eventType: event.type,
          lifecycle: state.lifecycle,
          publicationKind: state.publication.kind,
          reason: rejection.message,
        },
      ],
    };
  }
  return {
    ok: true,
    state: evolveUnchecked(state, event),
    effects: effects(event),
  };
}

export function evolve(state: PageState, event: WikiEvent): PageState {
  const result = step(state, event);
  if (!result.ok) {
    throw new Error(
      `Invalid event ${event.eventId}: ${result.rejection.code} ${result.rejection.message}`,
    );
  }
  return result.state;
}

export function replay(pageId: string, events: readonly WikiEvent[]): PageState {
  let state = initialPageState(pageId);
  for (const event of events) {
    const result = step(state, event);
    if (!result.ok) {
      throw new Error(
        `Invalid event stream at ${event.eventId}: ${result.rejection.code} ${result.rejection.message}`,
      );
    }
    state = result.state;
  }
  return state;
}
