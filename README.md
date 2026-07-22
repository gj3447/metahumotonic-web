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

`npm run build` writes one combined static site to `dist/`: SaaS at `/`, canon entry at `/book/`, and existing publication routes on the same origin. The repository also provides a build-artifact receipt check; it requires `uv` and Python 3.12:

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
