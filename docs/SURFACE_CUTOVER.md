# metahumotonic.com path cutover

MetaHumotonic uses one origin and one deploy artifact:

- `https://metahumotonic.com/` — Agent Operations and 333 Compute SaaS.
- `https://metahumotonic.com/book/` — preserved canon/publication entry.
- `https://metahumotonic.com/book/read/` — focused Axiom of Good reading surface.
- Existing publication routes such as `/apostles/`, `/research/`, and `/explore/` stay stable.

There is no second domain dependency, second TLS certificate, second service,
cross-origin API route, or publication redirect between domains.

## Build contract

```sh
npm ci
npm run build
npm run test:release
npm run verify:build-trace
```

`npm run build` runs Astro and then `scripts/build/assemble-site.mjs`. `/book/`,
`/book/read/`, and `/book/333/` are first-class Astro routes in both development
and production. The assembler validates the required routes, removes only the
archived 333 visual-demo output, and writes the release manifest.

The final `dist/` contains both the SaaS and publication. `SURFACE_MANIFEST.json`
records the two entry points and the consent boundary.

## Deployment gate

The workflow validates and uploads the combined artifact but does not update the
production `deploy` branch unless this repository variable is exactly:

```text
METAHUMOTONIC_SURFACE_CUTOVER=path-live
```

Set it only after reviewing the generated artifact. No domain purchase or DNS
change is required. Existing MX, SPF, DKIM, DMARC, and Email Routing records are
untouched.

## Required evidence

```sh
curl -fsSI https://metahumotonic.com/
curl -fsSI https://metahumotonic.com/book/
curl -fsSI https://metahumotonic.com/book/read/
curl -fsSI https://metahumotonic.com/apostles/
curl -fsSI https://metahumotonic.com/compute/
curl -fsS https://metahumotonic.com/.well-known/333-compute.json
```

The `/compute/` response must preserve:

```text
Content-Security-Policy: frame-ancestors 'none'
X-Frame-Options: DENY
```

## Rollback

Keep the last known-good `dist.tar.gz`. Rollback is redeploying that single
artifact; no host, DNS, TLS, API CORS, or mail change is involved.
