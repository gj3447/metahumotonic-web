# Connected workbench home — 2026-09-21

## Owner request and scope

The owner requested actual development of metahumotonic.com because the UI did not represent their KG and work sufficiently. This changes the July 23 one-line/four-ring landing composition, not the underlying canon, safety qualification, compute consent, private-data boundary, or existing publication routes.

The new home groups research, systems, games and the already-public worldview. It is an editorial work map, not an operational dashboard or a raw live KG browser. No private HSPINE threads, personal profile details, credentials or host locations are published.

## Information architecture

- Home: connected practice hero, accessible project focus map, locally filtered/searchable project cards, existing world/Book entries, working principles.
- `/projects/{id}/`: question, description, scope boundary, evidence label, editorial review date, related work and explicitly reviewed public links.
- `/projects/data.json`: explicit allowlisted public projection; no inferred runtime status or source internals.
- Existing Wiki, Book, research, compute and foundation routes remain intact.

## Evidence used for editorial summaries

- HSWM: `sym:Concept:hswm`, USER_PRIMARY, definition and user_canon as retrieved 2026-09-21; persistent token-native macro-neural world-model target identity, not demonstrated efficacy. The older public research page remains historical evidence rather than being silently rewritten.
- USL: `sym:Concept:usl`, USER_PRIMARY. KG/URL/Git/filesystem semantic linkage is a goal. A link does not confer authorization.
- HSPINE: project README at `c96c8dcd599c7fe4d611805455bd8d88a0a65e72`; one program/datastore, public/private thread settings, provenance-preserving timeline. The homepage does not pull thread bodies.
- VEXI: `sym:UserVerdict:virtual-excel-replay-motivation-2026-09-08` and `sym:Concept:virtual-excel-system-map-20260920-root`. Public copy describes the game direction without claiming launch or a shipped character count.
- Game Hub: `sym:Note:chatgpt-gamehub-generic-url-platform-v1`. This is a SECONDARY_AI development proposal, not ratified user canon or deployment evidence; the detail page preserves that distinction.
- soopoolim: project README at `a4c8dab1fa2bb623eee6080d4991a484a965d7f8`; community-first, provenance/time/role hypergraph, documented public address.
- 333 and LakatoTree: existing public project surfaces; preserve alpha/research labels and consent boundaries.
- Worldview entries: explicit name/slug/icon projection from the existing public apostles catalogue, not a dump of source metadata.

All new prose is EDITORIAL_SUMMARY. Review dates are not Git commit timestamps. Graph edges are editorial conceptual relationships, not live integration claims. A source being in the KG is not alone a public-release permission. Only the owner-requested, curated project summaries are added to the public catalogue.

## Implementation boundaries

`workbench.json` is the explicit public source. `publicProjects` requires `public === true`; API serialization uses a field allowlist. Related links are intersected with public IDs. Outgoing links are allowlisted and reject credentials, non-HTTPS external addresses and query tokens. Browser code reads already-published DOM fields only, has no live KG/API fetch, and uses textContent, not HTML injection. Search is local, Unicode-normalized and multi-word AND. No analytics, storage, model calls, background compute or new backend service is introduced.

The layout uses its own CSS rather than mutating shared old-page styles. It supports keyboard focus, skip navigation, live result counts, no-JS full content, reduced motion and small screens.

## Verification contract

Run `npm run build` followed by `npm run test:release`. The release suite now includes the pure workbench tests and strict client/data type checking. The obsolete one-line visual assertion is replaced by expanded catalogue/accessibility/provenance assertions; existing compute, Wiki, ontology, semantic and foundation checks remain.

Only the bound `src/pages/index.astro` and `scripts/build/assemble-site.mjs` SHA baselines are intentionally changed: the redesigned home and registration of its generated project routes. All other baseline entries remain unchanged. The Development connector omits the workflow file from imported snapshots; that missing-file drift check must be completed on the canonical repository, not bypassed or auto-pruned.

Browser verification must check 1440/768/390/320-pixel widths, local filtering and empty/reset states, full-width search, project-focus updates, all local home links, details, no-JS content, no unexpected workers or page errors, and accessibility. Build/test success alone is not deployment evidence: confirm public HTML and project JSON after the deployment mechanism completes.

Browser QA tooling is pinned in devDependencies. Run `npx playwright install chromium` once in an appropriate test environment, or set `MH_CHROMIUM_EXECUTABLE` to an installed browser, then run `npm run test:workbench:browser`. `MH_QA_OUTPUT` selects a private output directory; no screenshots are automatically published.
