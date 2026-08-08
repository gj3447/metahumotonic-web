# Wiki engine verification receipt

- Date: 2026-08-08 (Asia/Seoul)
- Scope: functional TypeScript reference kernel plus shared TypeScript/Python contract manifest, API-boundary, reactive-moderation FSM, and golden schemas
- Status: **verified contract/reference slice; this receipt does not attest a deployment or live service, and actual KG apply remains `disabled-unbound-v1`**

## Passed

| Check | Result |
|---|---|
| Engine/API trust-boundary contract validator | `engine-spec.json`: PASS |
| FSM semantic validator | 3 machines, 20 transitions: PASS |
| Abstract model traces | 18/18 cases |
| Shared-runtime golden manifest | 12/12 structurally validated cases across 5 kinds; runtimes not executed from this manifest |
| Repository-native contract and trace drift check | PASS |
| Focused TypeScript typecheck | PASS (`tsconfig.wiki-engine.json`) |
| Functional kernel tests | 12/12 PASS |
| Generated FSM diagram drift check | PASS |

The twelve kernel tests cover immutable create/replay, stale-head conflict rejection, body-to-SHA-256 binding, revision-ID uniqueness, idempotent command receipts and reuse fencing, separated review/USER_PRIMARY/publisher authority with exact receipts, pre-canon-only supersession, rejection/resubmission, fail-closed invalid-event replay, forged provenance rejection, delete/restore history, and rebuildable backlink/history projections.

The contract validator derives machine, transition, abstract-trace, golden-manifest-case, and kind counts from the JSON files at runtime; these values are not hard-coded in the script. It validates the golden manifest's schema and required safety bindings, but it does not execute TypeScript or Python from those fixtures. The Node test runner separately reports twelve executable TypeScript kernel tests; Python runtime/API/adapter and real-PostgreSQL evidence belongs to the backend test and deployment receipts.

`content_moderation` starts `visible` and contains only `visible` and `quarantined`. The verified traces cover visible create/edit, visibility-preserving report queueing, exact-head quarantine, exact-bound release, stale quarantine/release rejection, and edit rejection while quarantined. Golden cases also require no public report badge, exclusion from public reads, and rejection when a public MCP/CLI/browser principal attempts moderation.

This machine is required for the Python public runtime and intentionally remains contract-only in the TypeScript reference. Passing these JSON and reference-kernel checks does not claim that a running Python service, database migration, reverse proxy, or production URL was inspected.

## Commands executed

```sh
npm run verify:wiki-engine
```

`verify:wiki-engine` runs the focused typecheck, executable TypeScript kernel tests, abstract FSM traces, structural golden-manifest validation, and generated-diagram drift check. It is not a cross-language executable parity runner.

## Runtime/deployment evidence still required

- live readback of authenticated session/RBAC, CSRF, rate/body limits, and sanitized renderer behavior
- applied transactional event + command receipt + outbox migration, global slug uniqueness, real stream-version compare-and-set, backup/restore, and replay consistency
- public REST, CLI, and MCP parity through one application service, including report intake and server-derived actor/capabilities/time/IDs
- proof that public credentials never contain `wiki:moderate` and that `/internal/wiki/moderation` is reachable only from the separately keyed operations plane
- durable report queue plus exact-head quarantine/exact-bound release receipts, public-read exclusion, and quarantined edit rejection under concurrent and stale requests
- typed KG proposal plan containing target, change-set, plan/base hashes, mapping/policy versions, and source provenance
- isolated KG proposal/publisher adapter with exact approval and readback receipts; legacy `ApplyKgCanonRevision` dispatch is explicitly disabled and must make zero external calls
- before adding USER_PRIMARY revoke: bounded publication lease or proven late-success reconciliation for revoke versus an in-flight publisher
- XSS/CSRF, concurrent edit, duplicate report, rate-limit, worker crash, and lease-expiry fault tests

Until these are supplied by runtime and deployment receipts, this document makes no live-readiness claim.
