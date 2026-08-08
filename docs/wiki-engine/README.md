# Functional wiki engine research

Status: **DRAFT REFERENCE KERNEL — NOT DEPLOYED**

This directory separates three claims that must not be collapsed:

- [ADR-001](./ADR-001-functional-wiki-engine.md) explains the researched engine boundary, upstream prior art, risks, and rollout gates.
- [engine-spec.json](./engine-spec.json) is the machine-readable command/event/effect contract.
- [fsm-spec.json](./fsm-spec.json) is the semantic source for the two orthogonal state machines; [fsm-traces.json](./fsm-traces.json) supplies abstract conformance traces and [fsm-diagram.mmd](./fsm-diagram.mmd) is generated from it.
- [VERIFICATION.md](./VERIFICATION.md) records what was actually executed and what remains unimplemented.

The executable reference code lives in `src/lib/wiki-engine/`. Run its focused checks with:

```sh
npm run verify:wiki-engine
```

The existing `/wiki` site remains a read-only, default-deny canonical publication projection. A future editable namespace should begin under `/wiki/community/`; community revisions must never overwrite or impersonate the canonical projection.
