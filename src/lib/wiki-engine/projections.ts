import { replay } from './core.ts';
import type { RevisionRecord, WikiEvent } from './types.ts';

export type RevisionView = Readonly<{
  pageId: string;
  revisionNumber: number;
  revision: RevisionRecord;
}>;

export type RecentChange = Readonly<{
  eventId: string;
  pageId: string;
  type: 'PageCreated' | 'RevisionCommitted' | 'PageDeleted' | 'PageRestored';
  revisionId: string;
  actorId: string;
  occurredAt: string;
}>;

export function projectHistory(events: readonly WikiEvent[]): readonly RevisionView[] {
  return events.flatMap((event) => {
    if (event.type !== 'PageCreated' && event.type !== 'RevisionCommitted') return [];
    return [
      {
        pageId: event.pageId,
        revisionNumber: 0,
        revision: event.revision,
      },
    ];
  }).map((view, index) => ({ ...view, revisionNumber: index + 1 }));
}

export function projectRecentChanges(events: readonly WikiEvent[]): readonly RecentChange[] {
  const changes = events.flatMap((event): readonly RecentChange[] => {
    switch (event.type) {
      case 'PageCreated':
      case 'RevisionCommitted':
        return [
          {
            eventId: event.eventId,
            pageId: event.pageId,
            type: event.type,
            revisionId: event.revision.revisionId,
            actorId: event.actorId,
            occurredAt: event.occurredAt,
          },
        ];
      case 'PageDeleted':
      case 'PageRestored':
        return [
          {
            eventId: event.eventId,
            pageId: event.pageId,
            type: event.type,
            revisionId: event.headRevisionId,
            actorId: event.actorId,
            occurredAt: event.occurredAt,
          },
        ];
      default:
        return [];
    }
  });
  return [...changes].sort(
    (left, right) =>
      right.occurredAt.localeCompare(left.occurredAt) ||
      right.eventId.localeCompare(left.eventId),
  );
}

export function extractWikiLinks(content: string): readonly string[] {
  const targets = [...content.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g)]
    .map((match) => match[1]?.trim().replaceAll(' ', '_').toLowerCase() ?? '')
    .filter(Boolean);
  return [...new Set(targets)].sort();
}

export function projectBacklinks(
  streams: Readonly<Record<string, readonly WikiEvent[]>>,
): Readonly<Record<string, readonly string[]>> {
  const sourcesByTarget = new Map<string, Set<string>>();

  for (const [pageId, events] of Object.entries(streams)) {
    const state = replay(pageId, events);
    if (state.lifecycle !== 'active' || !state.slug) continue;
    const current = projectHistory(events).at(-1)?.revision;
    if (!current) continue;

    for (const target of extractWikiLinks(current.content)) {
      const sources = sourcesByTarget.get(target) ?? new Set<string>();
      sources.add(state.slug);
      sourcesByTarget.set(target, sources);
    }
  }

  return Object.fromEntries(
    [...sourcesByTarget.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([target, sources]) => [target, [...sources].sort()]),
  );
}
