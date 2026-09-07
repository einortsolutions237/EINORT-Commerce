# Preview Placeholder Photography (D-06)

THIS IMAGERY IS FOR TEMPLATE-PREVIEW SCREENSHOTS ONLY (D-06). It must
never reach `TEMPLATE_DEFAULTS`, anything under `src/server/theming/`,
`public/`, or any file reachable by a real merchant request. The six
JPEGs in this directory exist to be composited into templates' default
product grids by the (future) screenshot-generation script alone, so a
screenshot of an otherwise-empty default document does not read as a
broken template.

## Why this exists

Templates ship zero stock imagery by hard invariant (Phase 5 D-04):
`backgroundImageKey`/`imageKey` are `null` for all 50 `TEMPLATE_DEFAULTS`
rows, and `storageKeySchema`'s tenant-prefixed regex makes a shared stock
asset structurally unreferenceable from a template default — a real
merchant supplies their own photos, on purpose, always. This directory
does not change that invariant. It exists purely so the one-time preview
screenshot script (05.1-07) can composite a generic, licence-safe photo
into a product tile slot for the duration of a screenshot render, the way
Shopify's own theme-store previews show a stocked-looking store rather
than an empty one.

## The boundary is enforced automatically, not by convention

`tests/unit/preview-photo-isolation.test.ts` source-scans every `.ts` and
`.tsx` file under `src/` for both the literal token `preview-assets` and
the identifier `PREVIEW_PLACEHOLDER_PHOTOS`, with a named assertion
against `src/server/theming/defaults.ts` specifically (D-06 names that
file explicitly), and fails the build the moment either token crosses the
`scripts/` → `src/` boundary. It is a real, testable enforcement
mechanism — not a comment promising a rule that nothing checks.

## What is here

Six photographs, one per `INDUSTRY_SEGMENT`
(`src/server/theming/registry.ts`), named `{segment-id}.jpg`:
`fashion-apparel.jpg`, `electronics.jpg`, `beauty-cosmetics.jpg`,
`grocery-food.jpg`, `furniture-home.jpg`, `general-retail.jpg`. Every
photograph is licensed CC0 (Creative Commons Public Domain Dedication) —
see `LICENSES.md` for the per-file source URL, photographer credit, and
the licence text itself. Every one was confirmed at the Task 2
`checkpoint:human-verify` gate before being committed.

Sourcing constraints (enforced by eye at acquisition time, not by a
script): commercial-use-safe licence with no attribution obligation this
repo cannot satisfy; neutral, product-forward, well-lit, mostly-plain
background (these render as small 200-350px grid tiles inside a preview
crop, so busy scenes read as noise); no recognisable brand mark, logo, or
identifiable person's face (imagery shipped across 50 template cards is
effectively an endorsement surface).

## Regeneration recipe

If a photo ever needs replacing, the normalisation step is a throwaway
`sharp` invocation — not a permanent script, because this is a one-time
acquisition step, not a runtime code path:

```js
// Run once, from the repo root, with `node <this>.cjs` — then delete it.
const sharp = require("sharp");
const { readFileSync, writeFileSync } = require("node:fs");

const buf = await sharp(readFileSync("<source-file>"))
  .resize(2000, 2000, { fit: "inside", withoutEnlargement: true })
  .jpeg({ quality: 82 }) // re-encoding also strips whatever EXIF the source carried
  .toBuffer();

writeFileSync("scripts/preview-assets/<segment-id>.jpg", buf);
```

Requirements the output must meet (checked in Task 1's `<verify>` block):
long edge exactly 2000px with aspect preserved (`fit: "inside"`), each
file under 400 KB, and the new source's licence and content re-documented
in `LICENSES.md` before it is committed — the licence checkpoint applies
to a replacement exactly as it applied to the original.
