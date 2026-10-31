# 라경준 디지털 명함

## Current layout — 2026-10-31

The user said the original page did not look like a business card. The new
presentation is a single 9:5 landscape card with a warm paper background,
company/logo, name/title, website and QR inside its bounds. Save/share controls
sit outside the card. The permanent card and QR URLs are unchanged.
The complete card image is https://metahumotonic.com/card/ra/card.png (1440 × 800).
To regenerate it from the actual HTML/CSS, add `--export-image` to the local
browser command below; the PNG is a delivered asset, not a QA screenshot.

Local and public browser checks passed at 320, 390, 768 and 1280 CSS pixels:
9:5 proportions, seven served asset hashes, no detected axe A/AA violations,
image/vCard downloads, share/copy fallback, doubled text and no-JavaScript use.
Screenshots were inspected. Independent ZXing decoding passed for the full
card PNG and both 320/390px page screenshots. Hardware acceptance remains
separate. Public readback checks the versioned stylesheet actually referenced
by the HTML: the first readback found the old cached unversioned CSS, and the
verifier was corrected to follow the deployed link, without relaxing equality.

Release artifact: `0388760561b3e3ac22f6db3e6396dfe9c79dd107460f454752397c7afa936467`.
Previous working release: `ff9b02673f8f373dd6737657777fdac0b54c6cc544afd31af7ca94f0d0fd8952`.
The existing release procedure passed its publication gates and public browser
readback. Only the card HTML/CSS and new PNG changed in the deployed archive;
all other site files were compared byte-for-byte and preserved.

## Initial publication — 2026-10-30

2026-10-30: the user requested a phone-friendly business card for
**메타휴모토닉 · 대표이사 라경준**, with a card URL and a QR-image URL.
The spelling Gyeongjun Ra follows the existing public site. Phone/email were
not supplied and are intentionally absent. The vCard currently contains the
name, company, title and website; add contact details only when supplied.

- Card: https://metahumotonic.com/card/ra/
- QR PNG: https://metahumotonic.com/card/ra/qr.png
- QR SVG: https://metahumotonic.com/card/ra/qr.svg
- Contact: https://metahumotonic.com/card/ra/contact.vcf

The standalone files in `public/card/ra/` are copied by the existing static build.
They reuse the official favicon, have no remote dependencies, and keep core
content and downloads available without JavaScript. Share uses the native share
sheet, then clipboard, then a selectable URL; cancellation is silent.

Regenerate QR/vCard with `uv run scripts/build/business-card.py`.
The QR encodes the permanent card URL, not contact fields; future contact changes
therefore do not require changing the QR. ZXing independently decoded the
740 × 740 PNG to that URL.

Browser verification, using the installed Playwright and pinned Node:

```sh
proxmox-scratch run business-card-check --timeout 240 --max-bytes 268435456 --memory-bytes 67108864 -- ./scripts/with-node.sh node scripts/qa/business-card.mjs
proxmox-scratch run business-card-public --timeout 240 --max-bytes 268435456 --memory-bytes 67108864 -- ./scripts/with-node.sh node scripts/qa/business-card.mjs --public
```

Both checks passed at 320, 390, 768 and 1280 CSS pixels, with no detected axe
WCAG A/AA violations. They cover served-byte equality for all six assets,
keyboard/touch, clipboard and manual fallback, native-share payload/cancel
(browser stubs), vCard download, doubled text and no-JavaScript use. Screenshots
were inspected. These are Chromium emulation results; physical-phone scanning,
native share-sheet UI and Contacts import have not been tested on hardware.

Deployment used the existing `pve-release.sh` LOCAL_ARTIFACT procedure. The
previous live static archive was preserved byte-for-byte and only the six card
assets were added, with public files explicitly normalized to mode 0644.
The existing publication gates and public card browser checks passed.
Initial artifact: `ff9b02673f8f373dd6737657777fdac0b54c6cc544afd31af7ca94f0d0fd8952`.
Prior complete site: `f4dc2f322d2934ea8ec7fd230e6606c554766b6f29b1deab6c8ce9f3187c2083`.
The first artifact `5a7d4fe54cf8b8a36a218a258ea8b75dd1cbb815e2c5c2b4e51ea0aea05e79c0`
failed card public readback with 403 because source files inherited mode 0600;
it was superseded by the normalized artifact, not accepted as a working card.

Source integration uses only the exact changed card files on top of the fetched
public main. The local checkout has unrelated edits overlapping the newer
licensing commit's package.json, so its branch/index/foreign working files must
remain untouched. An isolated Git index can construct the exact additive tree
on remote main without staging or publishing those foreign edits. Retain this
boundary when reconciling the canonical checkout later.
