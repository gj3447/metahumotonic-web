# Functional wiki engine research

Status: **DRAFT REFERENCE KERNEL — NOT DEPLOYED**

This directory separates three claims that must not be collapsed:

- [ADR-001](./ADR-001-functional-wiki-engine.md) explains the researched engine boundary, upstream prior art, risks, and rollout gates.
- [engine-spec.json](./engine-spec.json) is the machine-readable command/event/effect contract.
- [fsm-spec.json](./fsm-spec.json) is the semantic source for the three orthogonal state machines; [fsm-traces.json](./fsm-traces.json) supplies abstract conformance traces and [fsm-diagram.mmd](./fsm-diagram.mmd) is generated from it.
- [VERIFICATION.md](./VERIFICATION.md) records what was actually executed and what remains unimplemented.

The executable reference code lives in `src/lib/wiki-engine/`. Run its focused checks with:

```sh
npm run verify:wiki-engine
```

The contract models a public community wiki with reactive moderation: create and edit are visible immediately, reports queue private review without a public badge, and only an exact-head internal operation can quarantine. Quarantined pages are excluded from public reads and cannot be edited until an exact-bound release. Public browser, CLI, and MCP principals never receive `wiki:moderate`.

Moderation and KG canon are orthogonal. KG publisher dispatch remains `disabled-unbound-v1`; these artifacts do not claim that any runtime is deployed or live-ready.
