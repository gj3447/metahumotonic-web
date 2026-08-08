export const COMMAND_SCHEMA_VERSION = 'wiki-command/v1' as const;
export const EVENT_SCHEMA_VERSION = 'wiki-event/v1' as const;
export const STATE_SCHEMA_VERSION = 'wiki-page-state/v1' as const;

export type Capability =
  | 'wiki:edit'
  | 'kg:submit'
  | 'kg:review'
  | 'kg:authorize'
  | 'kg:publish';

export type Actor = Readonly<{
  id: string;
  capabilities: readonly Capability[];
}>;

export type RevisionInput = Readonly<{
  revisionId: string;
  content: string;
  contentHash: string;
  editSummary: string;
}>;

export type RevisionRecord = RevisionInput &
  Readonly<{
    parentRevisionId: string | null;
    authorId: string;
    committedAt: string;
  }>;

export type PublicationKind =
  | 'unsubmitted'
  | 'in_review'
  | 'review_approved'
  | 'canon_authorized'
  | 'canon_applied'
  | 'rejected'
  | 'superseded';

export type PublicationState =
  | Readonly<{ kind: 'unsubmitted' }>
  | Readonly<{
      kind: 'in_review';
      revisionId: string;
      contentHash: string;
      submitterId: string;
      submittedAt: string;
    }>
  | Readonly<{
      kind: 'review_approved';
      revisionId: string;
      contentHash: string;
      submitterId: string;
      reviewerId: string;
      approvedAt: string;
    }>
  | Readonly<{
      kind: 'canon_authorized';
      revisionId: string;
      contentHash: string;
      submitterId: string;
      reviewerId: string;
      authorizerId: string;
      approvalReceiptId: string;
      authorizedAt: string;
    }>
  | Readonly<{
      kind: 'canon_applied';
      revisionId: string;
      contentHash: string;
      submitterId: string;
      reviewerId: string;
      authorizerId: string;
      publisherId: string;
      approvalReceiptId: string;
      applicationReceiptId: string;
      appliedAt: string;
    }>
  | Readonly<{
      kind: 'rejected';
      revisionId: string;
      contentHash: string;
      submitterId: string;
      reviewerId: string;
      reason: string;
      rejectedAt: string;
    }>
  | Readonly<{
      kind: 'superseded';
      revisionId: string;
      contentHash: string;
      previousStatus: 'in_review' | 'review_approved' | 'rejected';
      replacementRevisionId: string | null;
      reason: 'new_revision' | 'page_deleted';
      supersededAt: string;
    }>;

export type AppliedCanon = Readonly<{
  revisionId: string;
  contentHash: string;
  authorizerId: string;
  publisherId: string;
  approvalReceiptId: string;
  applicationReceiptId: string;
  appliedAt: string;
}>;

export type PageState = Readonly<{
  schemaVersion: typeof STATE_SCHEMA_VERSION;
  pageId: string;
  lifecycle: 'absent' | 'active' | 'deleted';
  authority: 'COMMUNITY';
  slug: string | null;
  title: string | null;
  headRevisionId: string | null;
  headContentHash: string | null;
  revisionCount: number;
  revisionIds: readonly string[];
  publication: PublicationState;
  lastAppliedCanon: AppliedCanon | null;
}>;

type CommandBase = Readonly<{
  schemaVersion: typeof COMMAND_SCHEMA_VERSION;
  commandId: string;
  pageId: string;
  actor: Actor;
  occurredAt: string;
}>;

export type WikiCommand =
  | (CommandBase &
      Readonly<{
        type: 'CreatePage';
        slug: string;
        title: string;
        revision: RevisionInput;
      }>)
  | (CommandBase &
      Readonly<{
        type: 'CommitRevision';
        expectedHeadRevisionId: string;
        revision: RevisionInput;
      }>)
  | (CommandBase &
      Readonly<{
        type: 'DeletePage';
        expectedHeadRevisionId: string;
        reason: string;
      }>)
  | (CommandBase &
      Readonly<{
        type: 'RestorePage';
        expectedHeadRevisionId: string;
      }>)
  | (CommandBase &
      Readonly<{
        type: 'SubmitForKgReview';
        revisionId: string;
      }>)
  | (CommandBase &
      Readonly<{
        type: 'ApproveKgProposal';
        revisionId: string;
      }>)
  | (CommandBase &
      Readonly<{
        type: 'RejectKgProposal';
        revisionId: string;
        reason: string;
      }>)
  | (CommandBase &
      Readonly<{
        type: 'AuthorizeKgCanonApplication';
        revisionId: string;
        contentHash: string;
        approvalReceiptId: string;
      }>)
  | (CommandBase &
      Readonly<{
        type: 'RecordKgCanonApplication';
        revisionId: string;
        contentHash: string;
        approvalReceiptId: string;
        applicationReceiptId: string;
      }>);

type EventBase = Readonly<{
  schemaVersion: typeof EVENT_SCHEMA_VERSION;
  eventId: string;
  commandId: string;
  pageId: string;
  actorId: string;
  occurredAt: string;
}>;

export type WikiEvent =
  | (EventBase &
      Readonly<{
        type: 'PageCreated';
        slug: string;
        title: string;
        revision: RevisionRecord;
      }>)
  | (EventBase &
      Readonly<{
        type: 'RevisionCommitted';
        revision: RevisionRecord;
      }>)
  | (EventBase &
      Readonly<{
        type: 'PageDeleted';
        headRevisionId: string;
        reason: string;
      }>)
  | (EventBase &
      Readonly<{
        type: 'PageRestored';
        headRevisionId: string;
      }>)
  | (EventBase &
      Readonly<{
        type: 'KgReviewSubmitted';
        revisionId: string;
        contentHash: string;
        submitterId: string;
      }>)
  | (EventBase &
      Readonly<{
        type: 'KgProposalApproved';
        revisionId: string;
        contentHash: string;
        submitterId: string;
        reviewerId: string;
      }>)
  | (EventBase &
      Readonly<{
        type: 'KgReviewRejected';
        revisionId: string;
        contentHash: string;
        submitterId: string;
        reviewerId: string;
        reason: string;
      }>)
  | (EventBase &
      Readonly<{
        type: 'KgCanonApplicationAuthorized';
        revisionId: string;
        contentHash: string;
        submitterId: string;
        reviewerId: string;
        authorizerId: string;
        approvalReceiptId: string;
      }>)
  | (EventBase &
      Readonly<{
        type: 'KgCanonApplicationRecorded';
        revisionId: string;
        contentHash: string;
        submitterId: string;
        reviewerId: string;
        authorizerId: string;
        publisherId: string;
        approvalReceiptId: string;
        applicationReceiptId: string;
      }>)
  | (EventBase &
      Readonly<{
        type: 'KgProposalSuperseded';
        revisionId: string;
        contentHash: string;
        previousStatus: 'in_review' | 'review_approved' | 'rejected';
        replacementRevisionId: string | null;
        reason: 'new_revision' | 'page_deleted';
      }>);

export type RejectionCode =
  | 'FORBIDDEN'
  | 'INVALID_COMMAND'
  | 'INVALID_SLUG'
  | 'INVALID_REVISION'
  | 'CONTENT_HASH_MISMATCH'
  | 'REVISION_ID_REUSED'
  | 'PAGE_ALREADY_EXISTS'
  | 'PAGE_NOT_FOUND'
  | 'PAGE_DELETED'
  | 'PAGE_ACTIVE'
  | 'REVISION_CONFLICT'
  | 'NO_CHANGES'
  | 'NOT_HEAD_REVISION'
  | 'INVALID_PUBLICATION_STATE'
  | 'SELF_REVIEW_FORBIDDEN'
  | 'APPROVAL_TARGET_MISMATCH'
  | 'RECEIPT_MISMATCH'
  | 'INVALID_EVENT_TRANSITION'
  | 'IDEMPOTENCY_KEY_REUSED';

export type Rejection = Readonly<{
  code: RejectionCode;
  message: string;
  details?: Readonly<Record<string, string>>;
}>;

export type Decision =
  | Readonly<{ ok: true; events: readonly WikiEvent[] }>
  | Readonly<{ ok: false; rejection: Rejection }>;

type EffectBase = Readonly<{
  effectId: string;
  eventId: string;
  pageId: string;
}>;

export type EffectIntent =
  | (EffectBase &
      Readonly<{
        type: 'IndexRevision';
        revisionId: string;
        contentHash: string;
        content: string;
      }>)
  | (EffectBase &
      Readonly<{
        type: 'UpdateBacklinks';
        revisionId: string;
        content: string;
      }>)
  | (EffectBase &
      Readonly<{
        type: 'RenderPage';
        revisionId: string;
      }>)
  | (EffectBase &
      Readonly<{
        type: 'AppendRecentChange';
        changeType: WikiEvent['type'];
        revisionId: string | null;
        actorId: string;
        occurredAt: string;
      }>)
  | (EffectBase & Readonly<{ type: 'RemoveSearchDocument' }>)
  | (EffectBase &
      Readonly<{
        type: 'RebuildPageProjection';
        revisionId: string;
      }>)
  | (EffectBase &
      Readonly<{
        type: 'UpdateReviewProjection';
        status: PublicationKind;
        revisionId: string;
      }>)
  | (EffectBase &
      Readonly<{
        type: 'ApplyKgCanonRevision';
        revisionId: string;
        contentHash: string;
        authorizerId: string;
        approvalReceiptId: string;
      }>)
  | (EffectBase &
      Readonly<{
        type: 'AuditInvalidTransition';
        eventType: WikiEvent['type'];
        lifecycle: PageState['lifecycle'];
        publicationKind: PublicationKind;
        reason: string;
      }>);

export type CommandReceipt = Readonly<{
  fingerprint: string;
  decision: Decision;
  resultingState: PageState;
}>;

export type MemoryEngineStore = Readonly<{
  streams: Readonly<Record<string, readonly WikiEvent[]>>;
  commandReceipts: Readonly<Record<string, CommandReceipt>>;
  outbox: readonly EffectIntent[];
}>;

export type CommandExecution = Readonly<{
  kind: 'accepted' | 'rejected' | 'replayed';
  state: PageState;
  events: readonly WikiEvent[];
  effects: readonly EffectIntent[];
  rejection?: Rejection;
}>;

export type EventStep =
  | Readonly<{
      ok: true;
      state: PageState;
      effects: readonly EffectIntent[];
    }>
  | Readonly<{
      ok: false;
      state: PageState;
      effects: readonly EffectIntent[];
      rejection: Rejection;
    }>;
