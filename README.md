# metahumotonic.com

This repository builds the public Astro site for [metahumotonic.com](https://metahumotonic.com). The root is the MetaHumotonic Agent Operations and 333 Compute product surface; [`/book/`](https://metahumotonic.com/book/) is the preserved canon/publication entry. The publication does not give AI interpretation authority to create or revise canon.

The backend API lives in [`metahumotonic-web-back`](https://github.com/gj3447/metahumotonic-web-back). Development follows the OMD coordination, ooptdd measurement, and LakatoTree judgment stack documented in [`docs/DEV_STACK.md`](docs/DEV_STACK.md).

## Local development

Use Node.js 22.12 or newer, as required by `package.json`.

```sh
npm ci
npm run dev
```

The development server listens on `http://localhost:4321` by default. Build and inspect the production output with:

```sh
npm run build
npm run preview
```

`npm run build` writes one combined static site to `dist/`: SaaS at `/`, canon entry at `/book/`, the KG-backed public wiki at `/wiki/`, and existing publication routes on the same origin. The repository also provides a build-artifact receipt check; it requires `uv` and Python 3.12:

```sh
npm run build
npm run verify:build-trace
```

## Canon layers

Public content must keep its authority layer explicit:

- `CANONICAL_USER` — user-authored primary material and direct user verdicts. This is the highest narrative authority; only the user can settle or revise it.
- `CANONICAL_FORMAL` — formalizations that trace back to user canon. A proof can validate the formal statement, but it cannot silently change the source meaning.
- `SECONDARY_AI` — AI summaries, interpretations, mappings, and proposals. These remain commentary unless the user ratifies them.
- `PSEUDEPIGRAPHA` — suspected attribution drift, including text that may present AI writing as the user's voice. Quarantine and label it; do not publish it as user canon.

Do not fill gaps in apostle identities, relationships, or doctrine by inference. Preserve unresolved questions and conflicting user-primary sources until the user gives a canonical decision. New public content should retain source provenance rather than replacing source material with a cleaner retrospective story.

## Public wiki

[`/wiki/`](https://metahumotonic.com/wiki/) is an Astro Starlight publication surface, not a second canon database. `src/lib/wiki.ts` builds a typed, read-only projection from reviewed public mirrors in `src/data/`; publication is default-deny and every rendered record carries an explicit authority label. The browser never receives Neo4j credentials, arbitrary Cypher access, private source paths, or KG write tools.

`/wiki/data.json` exposes the same bounded projection for machine readers. Expanding it to additional KG records or relationships requires an explicit public allowlist and publication approval; a KG label or canonical tier alone is not consent to publish.

### Internal ontology explorer

`/wiki/ontology/` is a noindex static shell for the conflict-aware ontology
facade. It embeds neither the ontology snapshot nor a credential. An operator
enters an independent `X-Ontology-Key`; the client retains it only in the
current tab's `sessionStorage`, validates the pinned release metadata, and
renders server-side allowlisted DTOs with DOM `textContent` rather than HTML
injection. Slot 9 remains visibly unresolved, OMC is the current abbreviation,
Harness/Hades occupies one slot, and HSWM is shown as identity scope rather than
implementation completeness.

Local Astro development proxies `/api/v1/ontology/*` to
`http://127.0.0.1:8000`. Production ingress is intentionally not opened while
the release is `INTERNAL_ONLY`; the shell handles that state without bundling a
fallback snapshot. Do not place the internal key in frontend source, build
variables, URLs, or deployment artifacts.

## Public-code curation

[`src/data/repos.json`](src/data/repos.json) is a curated allowlist of repositories that visitors can inspect publicly. Entries must use a confirmed public URL and a plain description supported by the repository itself. Private repositories and internal paths do not belong in this file.

LakatoTree is the featured flagship repository. Its card describes its public engineering contract—deterministic scoring of registered predictions and measurements, with verdicts tied to receipts—without turning MetaHumotonic mythology into a software guarantee. The `highlight` field controls presentation only; it is not a canon level or a quality verdict.

## Repository map

- `src/pages/` — Astro routes and public page composition.
- `src/components/` — shared presentation components.
- `src/data/` — curated site data and generated KG snapshots.
- `public/` — static assets, ontology exports, and machine-readable discovery files.
- `scripts/` and `gates/` — KG prebuild, Longinus drift checks, and ooptdd build-trace verification.

When changing canonical site data, verify its source layer first. Do not promote generated summaries into user canon or rewrite open canon to make the site appear more complete.

## License

Original software in this repository is available under the [MIT License](LICENSE).
Original MetaHumotonic text, visual material, ontology content, and KG data are
available under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
Vendored and third-party material retains its own license. See
[`LICENSING.md`](LICENSING.md) for the exact scope and attribution map.
