# Wiki engine verification receipt

- Date: 2026-08-08 (Asia/Seoul)
- Scope: functional TypeScript reference kernel and machine-readable engine/FSM design
- Status: **verified reference slice; no API, durable DB, UI, KG adapter, deployment, or public write path**

## Passed

| Check | Result |
|---|---|
| Engine contract validator | `engine-spec.json`: OK, 0 warnings |
| FSM semantic validator | `fsm-spec.json`: OK, 2 intentional perpetual-machine warnings |
| Abstract model traces | 14/14 cases |
| Repository-native contract and trace drift check | PASS |
| Focused TypeScript typecheck | PASS (`tsconfig.wiki-engine.json`) |
| Functional kernel tests | 12/12 PASS |
| Generated FSM diagram drift check | PASS |
| Full existing release suite plus wiki tests | 34/34 PASS |
| Astro production build | PASS, 79 pages built |

The twelve kernel tests cover immutable create/replay, stale-head conflict rejection, body-to-SHA-256 binding, revision-ID uniqueness, idempotent command receipts and reuse fencing, separated review/USER_PRIMARY/publisher authority with exact receipts, pre-canon-only supersession, rejection/resubmission, fail-closed invalid-event replay, forged provenance rejection, delete/restore history, and rebuildable backlink/history projections.

The two FSM warnings are expected: `page_lifecycle` and `kg_canon_workflow` are intentionally perpetual because edits, restoration, rejection, resubmission, and supersession remain possible.

## Commands executed

```sh
npm run verify:wiki-engine
npm run test:release
npm run build
```

The engine and FSM skill validators were also run directly against `engine-spec.json`, `fsm-spec.json`, and `fsm-traces.json`.

## Known repository-wide typecheck debt

`npx --no-install tsc --noEmit` still exits 2 on six pre-existing errors outside this slice: the readonly Starlight sidebar assignment in `astro.config.mjs`, duplicate script-global `TAU`/`PHI` declarations, and a `resize` reassignment in `src/scripts/cosmos.ts`. The focused engine typecheck and the actual Astro production build both pass. These unrelated files were not modified here.

## Deployment blockers

- authenticated session/RBAC, CSRF, rate/body limits, and sanitized renderer
- transactional event + command receipt + outbox persistence, global slug uniqueness, and real stream-version compare-and-set (the audited standalone Mongo deployment cannot supply the required multi-document transaction)
- conflict/diff/history/recent-changes UI and same-origin API
- trusted server-side actor/time command construction and cryptographic receipt verification
- isolated KG proposal/publisher adapter with exact approval and readback receipts
- before adding USER_PRIMARY revoke: bounded publication lease or proven late-success reconciliation for revoke versus an in-flight publisher
- backup/restore, replay drift, XSS/CSRF, concurrent edit, worker crash, and lease-expiry fault tests

Until these pass, the current read-only `/wiki` projection remains the only public surface.
