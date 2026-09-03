---
phase: quick/260903-nxf
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/assets/brand/einort-logo.png
  - scripts/generate-brand-icons.mjs
  - src/app/icon.png
  - src/app/apple-icon.png
  - src/app/favicon.ico
  - src/components/app-sidebar.tsx
  - src/app/login/page.tsx
  - src/app/signup/page.tsx
autonomous: false
requirements: [QUICK-260903-nxf]

must_haves:
  truths:
    - "The browser tab for any apex-hostname page (e.g. /login, /dashboard) shows the EINORT gradient mark, not the default Next.js icon."
    - "The dashboard sidebar header (src/components/app-sidebar.tsx) displays the EINORT logo mark beside the existing EINORT wordmark."
    - "The /login page displays the EINORT logo mark above its heading."
    - "The /signup page displays the EINORT logo mark above its heading."
    - "No reference to the platform logo asset or its generated derivatives exists anywhere under src/app/s/ (the merchant storefront surface) — this is the platform's own mark, never a merchant's."
    - "next.config.ts is byte-for-byte unchanged — a local static import needs no remote-pattern entry."
  artifacts:
    - path: "src/assets/brand/einort-logo.png"
      provides: "Master platform logo asset (645x606, transparent PNG) — source of truth for every derivative icon and every inline <Image> render"
      min_lines: 1
    - path: "scripts/generate-brand-icons.mjs"
      provides: "Sharp-based, rerunnable generator that derives src/app/icon.png, src/app/apple-icon.png and src/app/favicon.ico from the master asset"
      contains: "einort-logo.png"
    - path: "src/app/icon.png"
      provides: "Next 16 App Router auto-served favicon (square, transparent-padded, 64x64)"
    - path: "src/app/apple-icon.png"
      provides: "Next 16 App Router auto-served Apple touch icon (180x180, Apple's documented size)"
    - path: "src/app/favicon.ico"
      provides: "Classic favicon.ico — a hand-built ICONDIR/ICONDIRENTRY wrapper around a 32x32 PNG derivative, replacing the Next.js placeholder"
    - path: "src/components/app-sidebar.tsx"
      provides: "Sidebar header rendering the logo mark via a next/image static import, alongside the existing {BRAND} wordmark span"
      contains: "einort-logo.png"
    - path: "src/app/login/page.tsx"
      provides: "Logo mark rendered above the sign-in heading"
      contains: "einort-logo.png"
    - path: "src/app/signup/page.tsx"
      provides: "Logo mark rendered above the create-store heading"
      contains: "einort-logo.png"
  key_links:
    - from: "src/components/app-sidebar.tsx"
      to: "src/assets/brand/einort-logo.png"
      via: "static import einortLogo from \"@/assets/brand/einort-logo.png\", rendered with next/image"
      pattern: "@/assets/brand/einort-logo.png"
    - from: "src/app/login/page.tsx"
      to: "src/assets/brand/einort-logo.png"
      via: "same static-import pattern"
      pattern: "@/assets/brand/einort-logo.png"
    - from: "src/app/signup/page.tsx"
      to: "src/assets/brand/einort-logo.png"
      via: "same static-import pattern"
      pattern: "@/assets/brand/einort-logo.png"
    - from: "scripts/generate-brand-icons.mjs"
      to: "src/app/icon.png, src/app/apple-icon.png, src/app/favicon.ico"
      via: "sharp resize(size, size, { fit: \"contain\", background: transparent }) piped to fs.writeFileSync, plus a hand-rolled ICO container for favicon.ico"
      pattern: "writeFileSync"
---

<objective>
Add the EINORT-Commerce platform's own brand mark — the blue-to-purple gradient faceted "S" with a keyhole cutout — as the platform's identity across four surfaces: the browser-tab favicon, the dashboard sidebar header, and the `/login` and `/signup` page headers.

This is the PLATFORM's own logo (the SaaS itself), never a merchant's. It must never appear under `src/app/s/**`, the fully merchant-branded storefront surface that `tests/unit/surface-token-isolation.test.ts` polices — that system (`StorefrontTheme.logoKey`, the `logo` image preset in `src/server/images/pipeline.ts`) is untouched.

Today there is no `public/` folder, no logo asset anywhere in the repo, and `src/app/favicon.ico` is still Next's default placeholder — branding is text-only ("EINORT" via the root layout's `"%s · EINORT"` metadata template). Verified by reading `src/app/layout.tsx`, `src/components/app-sidebar.tsx`, `src/app/login/page.tsx`, `src/app/signup/page.tsx` and `ls`-ing the repo root before writing this plan.

Purpose: give the platform a visible identity mark on every apex-hostname surface, matching what a merchant admin/auth product looks like once it has real branding, without touching the storefront's merchant-branding system or expanding into a dashboard redesign (that is a separate, deliberately deferred task).

Output: one committed master asset, one rerunnable generator script, three generated icon files, and three edited `.tsx` files.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md

@src/app/layout.tsx
@src/components/app-sidebar.tsx
@src/app/login/page.tsx
@src/app/signup/page.tsx
@src/lib/strings.ts
@next.config.ts
@scripts/prisma-generate.mjs
@tests/unit/surface-token-isolation.test.ts
@tests/unit/dashboard-nav.test.ts

<source_asset>
The verified-correct source file for this task lives at:
`C:\Users\LFDSER~1\AppData\Local\Temp\claude\D--Maxs-Claude\9df7ec9a-19ef-4966-bbd2-adff81447b5f\scratchpad\einort-logo.png`

504,499 bytes, PNG, 645x606, transparent background, blue-to-purple gradient faceted "S" mark with a keyhole cutout. This is a temp path outside the repo and outside version control — Task 1's first step copies it in. If that exact path is gone by the time this plan executes (a different machine, a cleaned temp dir), STOP and ask where the source asset now lives rather than substituting a placeholder; do not invent a logo.
</source_asset>

<constraints_verified_by_the_planner>
Do not re-derive these; they were checked against this repo and against the installed Next 16.3.1 package, not assumed.

1. **No `public/` folder exists.** Next.js's App Router icon file conventions do not require one — `favicon`, `icon` and `apple-icon` are special reserved filenames read directly out of `src/app/` (confirmed by reading `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.md`, this repo's own installed docs, per CLAUDE.md's "read the local docs before touching Next 16" instruction). Do not create a `public/` folder for this task.

2. **Next 16's icon file-convention rules, exactly as documented:**
   - `favicon` — `.ico` only, and only at the top level of `app/` (`src/app/favicon.ico`, which already exists as Next's placeholder).
   - `icon` — `.ico`, `.jpg`, `.jpeg`, `.png` or `.svg`, anywhere under `app/**/*`. A file at `src/app/icon.png` is auto-detected; Next emits the `<link rel="icon" href="/icon?...">` tag itself. No exported `size`/`contentType`/default-export function is needed for the image-file convention — only the "generate icons using code" convention (a `.tsx`/`.ts` file) needs those, and this task does not use it.
   - `apple-icon` — `.jpg`, `.jpeg` or `.png`, anywhere under `app/**/*`. Same auto-detection, emits `<link rel="apple-touch-icon">`.
   - Placing a file at these reserved names is the entire integration — no code change to `src/app/layout.tsx` or its `metadata` export is needed or wanted for this task.

3. **`favicon.ico` cannot hold a `.png` directly per the docs' own format table**, so replacing it faithfully means writing real ICO bytes, not renaming a PNG. `sharp` (already a dependency, no install needed) has no ICO encoder, so the plan hand-builds a minimal, standard ICO container: a 6-byte `ICONDIR` header, one 16-byte `ICONDIRENTRY`, followed by a normal PNG byte stream. Embedding a PNG inside an ICO container this way (rather than an uncompressed BMP bitmap) has been valid ICO format since Windows Vista and is what every "png-to-ico" npm package does under the hood — this plan just does it inline rather than adding that dependency.

4. **`next.config.ts` needs no change.** Its `images.remotePatterns` allowlist exists only for R2-hosted remote images (confirmed by reading the file); a locally imported static asset (`import x from "@/assets/..."`) is resolved by Next's own bundler, not the remote-pattern allowlist, and never touches that config.

5. **Static image imports are already typed.** `next-env.d.ts` carries `/// <reference types="next/image-types/global" />`, so `import einortLogo from "@/assets/brand/einort-logo.png"` type-checks out of the box (yields `{ src, height, width, blurDataURL? }`) — no `tsconfig.json`/type-declaration change needed. `tsconfig.json`'s `@/*` -> `./src/*` path alias already covers a new `src/assets/**` directory; nothing to add there either.

6. **`strings.ts` needs no new entry.** `src/lib/strings.ts` already exports `export const BRAND = "EINORT" as const;`, centralized copy per this repo's convention. Every `alt` attribute added by this plan reads `alt={BRAND}` — reusing that existing export satisfies "no inline UI copy literal" without inventing a new namespace. This mirrors the existing precedent at `src/app/s/[slug]/store-header.tsx:95` (`alt={storeName}`) and `.../add-to-cart.tsx:54` (`alt={productName}`): alt text as a JSX expression referencing an already-centralized value, never a bare string literal.

7. **`tests/unit/dashboard-nav.test.ts`'s "inlines no user-facing copy" check** only matches quoted string literals (`QUOTED_PROSE`) in `src/components/app-sidebar.tsx`. `alt={BRAND}` is an identifier reference, not a quoted literal, so it does not trip that scanner — confirmed by reading the test.

8. **No ESLint import-order rule exists** in `eslint.config.mjs` (only import-zone/`no-restricted-imports` boundary rules for the Prisma/tenant layers, which do not touch `src/assets/**` or `src/app/login|signup`). New import lines do not need a specific position to pass lint.

9. **`scripts/*.mjs` is this repo's existing convention for small Node tooling** (see `scripts/prisma-generate.mjs`, the `postinstall` hook) — `.mjs` extension makes the new script ESM regardless of `package.json` having no `"type": "module"` field, matching that file's own pattern (`fileURLToPath(new URL(relativePath, import.meta.url))`).

10. **`tests/unit/surface-token-isolation.test.ts` bans 1 and 2** (no literal `#hex`/`oklch(`/`rgb(`/`hsl(`, no `zinc|slate|blue|amber|emerald|red|green|yellow|indigo|gray`-NNN Tailwind utility) scan every `.tsx` under `src/app` and `src/components` — including the three files this plan edits. Irrelevant risk in practice: this plan only adds an `<Image>` element and sizing/layout utilities (`h-*`, `w-auto`, `gap-*`, `flex`, `items-center`), never a colour utility, so no ban is at risk — but do not add one.
</constraints_verified_by_the_planner>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Bring the logo into the repo and derive the favicon/icon/apple-icon files</name>

  <files>src/assets/brand/einort-logo.png, scripts/generate-brand-icons.mjs, src/app/icon.png, src/app/apple-icon.png, src/app/favicon.ico</files>

  <action>
Four steps, in order.

---

**A. Copy the master asset in, byte-for-byte.**

Create the directory `src/assets/brand/` and copy the source file at the exact path named in `<source_asset>` above to `src/assets/brand/einort-logo.png`, using a raw filesystem copy (`cp` — not the Write tool, which is for text content and would corrupt binary PNG bytes; not the Read tool either, which renders the image rather than exposing raw bytes). Verify the copy is byte-identical to the source (same byte count at minimum; a checksum comparison if convenient) before continuing. This file becomes the single source of truth: every derivative icon and every inline `<Image>` render in Task 2 traces back to it.

---

**B. Write `scripts/generate-brand-icons.mjs`.**

Follow `scripts/prisma-generate.mjs`'s existing style: a short header comment stating what the script does and why it exists as a rerunnable tool rather than a one-off, then `node:fs` (`readFileSync`, `writeFileSync`), `node:url` (`fileURLToPath`), and `sharp` imports. Resolve the master path the same way that file resolves `schemaPath` — `fileURLToPath(new URL("../src/assets/brand/einort-logo.png", import.meta.url))` — and resolve the three output paths (`../src/app/icon.png`, `../src/app/apple-icon.png`, `../src/app/favicon.ico`) the same way.

**Sanity check the master first.** Read its `sharp(...).metadata()` and assert `width === 645`, `height === 606` and `hasAlpha === true`. If any assertion fails, `console.error` a message naming which dimension/alpha check failed and what was found, then `process.exitCode = 1` and return — mirroring `prisma-generate.mjs`'s guarded-exit style. This exists so a future swap of the master asset that silently changes its shape gets caught here rather than producing a subtly wrong favicon.

**A `squareIcon(size)` helper.** For a given pixel size, `sharp(masterPath).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()`. `fit: "contain"` letterboxes onto a transparent square rather than cropping — the master is 645x606 (very close to square already), and padding preserves the complete faceted mark and its keyhole cutout instead of risking slicing a corner off it.

**Generate and write the three outputs:**
1. `icon.png` — `squareIcon(64)`, written to the `icon.png` path via `writeFileSync`.
2. `apple-icon.png` — `squareIcon(180)` (Apple's documented apple-touch-icon size), written to the `apple-icon.png` path.
3. `favicon.ico` — `squareIcon(32)` (the classic favicon pixel size, kept small since this file is fetched directly by browsers/crawlers hitting `/favicon.ico` with no HTML to size-negotiate from), then wrapped in a hand-built ICO container as follows.

**The ICO container, byte-exact.** Build a `Buffer` in three concatenated parts:
- `ICONDIR` header, 6 bytes, all fields little-endian `uint16`: offset 0-1 `reserved = 0`; offset 2-3 `imageType = 1` (1 means icon, not cursor); offset 4-5 `imageCount = 1`.
- `ICONDIRENTRY`, 16 bytes: byte 0 `width = 32`; byte 1 `height = 32` (both single bytes — a value of 0 would mean 256, not applicable here since our size is 32); byte 2 `colorCount = 0` (no palette, true-colour image); byte 3 `reserved = 0`; bytes 4-5 little-endian `uint16` `colorPlanes = 1`; bytes 6-7 little-endian `uint16` `bitsPerPixel = 32` (RGBA); bytes 8-11 little-endian `uint32` `sizeInBytes` = the PNG buffer's byte length; bytes 12-15 little-endian `uint32` `imageOffset = 22` (6 + 16, the byte offset where the PNG data begins).
- The raw 32x32 PNG buffer from `squareIcon(32)`, appended as-is — this "PNG inside ICO" encoding has been valid since Windows Vista and every current browser accepts it; there is no legacy uncompressed-bitmap encoding step needed.

Concatenate all three parts and `writeFileSync` the result to the `favicon.ico` path.

**Self-verify the written favicon.ico before exiting.** Read the file back and assert: bytes 0-5 read as `[0, 0, 1, 0, 1, 0]` (the header fields above); the 4 bytes at offset 22 equal the PNG signature bytes `0x89, 0x50, 0x4E, 0x47`. On any mismatch, `console.error` naming what was expected vs. found and `process.exitCode = 1`.

On full success, `console.log` each of the three output paths with its byte size, so a run of the script is self-documenting.

---

**C. Run it.** Execute `node scripts/generate-brand-icons.mjs` from the repo root. It must exit 0 and print the three success lines.

---

**D. Do not touch** `src/app/layout.tsx`, `next.config.ts`, or anything under `src/app/s/**`. The icon-file convention needs zero code changes to pick these files up.

Commit as one atomic commit:
`feat(260903-nxf): add platform brand mark and generate favicon/icon/apple-icon`
  </action>

  <verify>
    <automated>
bash -c '
set -e
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"
FAIL=0

for f in src/assets/brand/einort-logo.png scripts/generate-brand-icons.mjs src/app/icon.png src/app/apple-icon.png src/app/favicon.ico; do
  [ -f "$f" ] || { echo "FAIL: $f does not exist"; FAIL=1; }
done
[ "$FAIL" = "0" ] || exit 1

MASTER_SIZE=$(wc -c < src/assets/brand/einort-logo.png | tr -d " ")
[ "$MASTER_SIZE" -gt 100000 ] || { echo "FAIL: src/assets/brand/einort-logo.png is only $MASTER_SIZE bytes — too small to be the real 504499-byte source logo"; FAIL=1; }

# Re-run the generator: it must be idempotent and exit 0, proving its own
# internal self-checks (master dimensions/alpha, favicon.ico header bytes) pass.
node scripts/generate-brand-icons.mjs || { echo "FAIL: scripts/generate-brand-icons.mjs did not exit 0 on a re-run"; FAIL=1; }

TMP=$(mktemp --suffix=.mjs)
cat > "$TMP" <<'"'"'NODEEOF'"'"'
import { readFileSync } from "node:fs";
import sharp from "sharp";

let fail = false;

const iconMeta = await sharp("src/app/icon.png").metadata();
if (iconMeta.width !== 64 || iconMeta.height !== 64) {
  console.error(`FAIL: src/app/icon.png is ${iconMeta.width}x${iconMeta.height}, expected 64x64`);
  fail = true;
}
if (!iconMeta.hasAlpha) {
  console.error("FAIL: src/app/icon.png lost its alpha channel");
  fail = true;
}

const appleMeta = await sharp("src/app/apple-icon.png").metadata();
if (appleMeta.width !== 180 || appleMeta.height !== 180) {
  console.error(`FAIL: src/app/apple-icon.png is ${appleMeta.width}x${appleMeta.height}, expected 180x180`);
  fail = true;
}

const ico = readFileSync("src/app/favicon.ico");
const header = [...ico.subarray(0, 6)];
if (header[0] !== 0 || header[1] !== 0 || header[2] !== 1 || header[3] !== 0 || header[4] !== 1 || header[5] !== 0) {
  console.error(`FAIL: src/app/favicon.ico header bytes are [${header.join(",")}], expected [0,0,1,0,1,0]`);
  fail = true;
}
const pngSig = [...ico.subarray(22, 26)];
if (pngSig[0] !== 0x89 || pngSig[1] !== 0x50 || pngSig[2] !== 0x4e || pngSig[3] !== 0x47) {
  console.error(`FAIL: src/app/favicon.ico has no PNG signature at offset 22 — got [${pngSig.join(",")}]`);
  fail = true;
}
if (ico.length <= 22) {
  console.error("FAIL: src/app/favicon.ico has no image data appended after the ICONDIRENTRY");
  fail = true;
}

if (fail) process.exit(1);
console.log("PASS: icon.png 64x64, apple-icon.png 180x180, favicon.ico header + PNG signature correct");
NODEEOF
node "$TMP" || FAIL=1
rm -f "$TMP"

git diff --quiet -- next.config.ts src/app/layout.tsx || { echo "FAIL: next.config.ts or src/app/layout.tsx was modified — the icon file convention needs no code change"; FAIL=1; }

find src/app/s -iname "*einort-logo*" 2>/dev/null | grep -q . && { echo "FAIL: the master logo asset was copied under src/app/s/ — it must never reach the storefront tree"; FAIL=1; }

[ "$FAIL" = "0" ] && echo "PASS: Task 1 gates green"
exit $FAIL
'
    </automated>
    <automated>npm run lint</automated>
    <automated>npm run typecheck</automated>
    <automated>npm run build</automated>
  </verify>

  <done>
`src/assets/brand/einort-logo.png` exists and is the full-size (>100KB) master asset. `scripts/generate-brand-icons.mjs` exists, is rerunnable (exits 0 on a second run), and its own internal self-checks (master dimensions 645x606 with alpha; favicon.ico header bytes; PNG signature at offset 22) pass. `src/app/icon.png` is 64x64 with alpha, `src/app/apple-icon.png` is 180x180, `src/app/favicon.ico` is a valid single-image PNG-in-ICO container. `next.config.ts` and `src/app/layout.tsx` are byte-for-byte unchanged. Nothing under `src/app/s/` references the asset. `npm run lint`, `npm run typecheck` and `npm run build` are all green (the build step is Next's own validation that it can read and serve the three icon files).
  </done>
</task>

<task type="auto">
  <name>Task 2: Render the logo in the dashboard sidebar, login and signup headers</name>

  <files>src/components/app-sidebar.tsx, src/app/login/page.tsx, src/app/signup/page.tsx</files>

  <action>
Three files, same import pattern in each: `import Image from "next/image";` and `import einortLogo from "@/assets/brand/einort-logo.png";`, plus `BRAND` added to whatever is already imported from `@/lib/strings"` (it is already exported there — see `<constraints_verified_by_the_planner>` #6). Do not add anything to `src/lib/strings.ts`.

---

**A. `src/components/app-sidebar.tsx`.**

Add the two new imports near the existing `next/navigation` and `@/lib/strings` imports (exact position does not matter — no import-order lint rule is active). `BRAND` is already imported alongside `strings`; no new identifier needed there.

Inside `<SidebarHeader className="min-h-14 justify-center border-b border-sidebar-border px-4">`, wrap the existing `<span>{BRAND}</span>` together with a new `<Image>` in a `<div className="flex items-center gap-2">`. The `<Image>` goes first, sized `className="h-6 w-auto shrink-0"` (24px tall, matching the header's compact height and sitting comfortably beside `text-sm` type), with `src={einortLogo}` and `alt={BRAND}`. Do not pass explicit `width`/`height` props — the static import already supplies intrinsic dimensions, and the `h-6 w-auto` className scales it down while the browser preserves the source aspect ratio. The existing `<span>` and its className stay byte-for-byte unchanged, just now a sibling of the image inside the new wrapping div instead of the header's only child.

---

**B. `src/app/login/page.tsx`.**

Add the two new imports near the existing `next/link` and `@/components/ui/card` imports. Change `import { strings } from "@/lib/strings";` to `import { BRAND, strings } from "@/lib/strings";`.

Inside `<div className="w-full max-w-md">`, insert the `<Image>` as the FIRST child, immediately before the existing `<h1>`: `<Image src={einortLogo} alt={BRAND} className="mb-6 h-9 w-auto" priority />`. 36px tall — larger than the sidebar's mark, appropriate for the sole brand element on an otherwise text-only auth page — with `mb-6` matching this file's existing vertical rhythm (`mt-2`, `mt-8`, `mt-6` steps already present). `priority` is justified here (and not in the sidebar): this logo is plausibly the largest above-the-fold image on the page and a reasonable LCP candidate. Change nothing else — the `<h1>`, `<p>` subline, `<Card>`, `<LoginForm />` and the sign-up cross-link stay exactly as they are.

---

**C. `src/app/signup/page.tsx`.**

Identical treatment to B: same two new imports, same `BRAND` addition to the `@/lib/strings` import, same `<Image src={einortLogo} alt={BRAND} className="mb-6 h-9 w-auto" priority />` inserted as the first child of `<div className="w-full max-w-md">`, before the existing `<h1>`. Change nothing else.

---

**D. Scope discipline.** Do not touch `src/app/(dashboard)/layout.tsx`, any other dashboard page, `src/app/login/login-form.tsx`, `src/app/signup/signup-form.tsx`, or anything under `src/app/s/**`. This is exactly four surfaces (favicon/icon done in Task 1, plus these three renders) — no broader dashboard redesign.

Commit as one atomic commit:
`feat(260903-nxf): render the platform logo in the sidebar, login and signup headers`
  </action>

  <verify>
    <automated>
bash -c '
set -e
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"
FAIL=0

for f in src/components/app-sidebar.tsx src/app/login/page.tsx src/app/signup/page.tsx; do
  grep -q "@/assets/brand/einort-logo.png" "$f" || { echo "FAIL: $f does not import the logo asset"; FAIL=1; }
  grep -q "next/image" "$f" || { echo "FAIL: $f does not import next/image"; FAIL=1; }
  grep -qE "alt=\{BRAND\}" "$f" || { echo "FAIL: $f does not render alt={BRAND} — alt text must reuse the centralized BRAND export, never a literal"; FAIL=1; }
done

# The sidebar wordmark span must survive unchanged as a sibling of the new image.
grep -qF "text-sm leading-normal font-semibold tracking-wide text-sidebar-foreground" src/components/app-sidebar.tsx || { echo "FAIL: src/components/app-sidebar.tsx lost its existing wordmark span styling"; FAIL=1; }

# No new key in strings.ts for this change.
git diff --quiet -- src/lib/strings.ts || { echo "FAIL: src/lib/strings.ts was modified — this task reuses the existing BRAND export and needs no new key"; FAIL=1; }

# The platform mark must never reach the merchant storefront surface.
grep -rl "einort-logo" src/app/s/ 2>/dev/null | grep -q . && { echo "FAIL: a reference to einort-logo was found under src/app/s/ — the platform logo must never appear on the storefront surface"; FAIL=1; }
grep -rl "generate-brand-icons\|assets/brand" src/app/s/ 2>/dev/null | grep -q . && { echo "FAIL: a reference to the brand-icon tooling was found under src/app/s/"; FAIL=1; }

# No color-utility bans tripped by this diff (sanity check on the three edited files only).
for f in src/components/app-sidebar.tsx src/app/login/page.tsx src/app/signup/page.tsx; do
  grep -qE "#[0-9a-fA-F]{3,8}|oklch\(|rgb\(|hsl\(" "$f" && { echo "FAIL: $f contains a literal colour value"; FAIL=1; }
  grep -qE "\b(zinc|slate|blue|amber|emerald|red|green|yellow|indigo|gray)-[0-9]{2,3}\b" "$f" && { echo "FAIL: $f contains a raw Tailwind palette utility"; FAIL=1; }
done

[ "$FAIL" = "0" ] && echo "PASS: Task 2 gates green"
exit $FAIL
'
    </automated>
    <automated>npx vitest run tests/unit/dashboard-nav.test.ts tests/unit/surface-token-isolation.test.ts --reporter=dot</automated>
    <automated>npm run lint</automated>
    <automated>npm run typecheck</automated>
    <automated>npm run build</automated>
  </verify>

  <done>
`src/components/app-sidebar.tsx`, `src/app/login/page.tsx` and `src/app/signup/page.tsx` each import and render the logo via `next/image` with `alt={BRAND}`. The sidebar shows the mark beside the unchanged `{BRAND}` wordmark span; login and signup show it above their headings. `src/lib/strings.ts` is unmodified. No reference to the asset or the generator script exists under `src/app/s/`. `tests/unit/dashboard-nav.test.ts` and `tests/unit/surface-token-isolation.test.ts` pass unmodified. `npm run lint`, `npm run typecheck` and `npm run build` are green.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Confirm the mark renders correctly in a real browser</name>

  <what-built>
The EINORT platform logo now exists as a committed asset (`src/assets/brand/einort-logo.png`) with three generated derivatives (`src/app/icon.png`, `src/app/apple-icon.png`, `src/app/favicon.ico`) picked up automatically by Next 16's App Router icon convention, and is rendered inline via `next/image` in the dashboard sidebar header and above the `/login` and `/signup` headings.

No automated test can confirm an image *looks right* — correct aspect ratio, no visible clipping of the faceted mark or its keyhole cutout, the transparent background sitting cleanly against each surface's fill, and the actual browser tab icon updating. This checkpoint is that proof.
  </what-built>

  <how-to-verify>
If a dev server is already reachable at `http://localhost:3001`, use it; otherwise start one with `npm run dev` (port 3001).

1. **Favicon.** Open `http://localhost:3001/login` in a real browser tab. The browser tab icon must show the blue-to-purple gradient mark, not the default Next.js icon. Open a new tab and type `http://localhost:3001/favicon.ico` directly — it must load an image (not a 404), and it should visually be the same mark, just smaller/simpler.

2. **Sidebar.** Sign in (or use an already-authenticated session) and land on `/dashboard`. The sidebar header must show the logo mark immediately to the left of the "EINORT" text, both vertically centered, with reasonable spacing and no visible clipping of the mark against the sidebar's background fill.

3. **Login.** Visit `/login` directly (log out first if needed). The logo mark renders above "Sign in", left-aligned with the rest of the card content, at a size that reads as a deliberate brand mark rather than a tiny icon or an oversized graphic.

4. **Signup.** Visit `/signup`. Same check: the logo mark renders above "Create your store", left-aligned, sized consistently with what you saw on `/login`.

5. **Storefront untouched.** Visit any seeded storefront, e.g. `http://megasolution.localhost:3001/`. Confirm the platform logo does NOT appear anywhere on this page — the storefront keeps its own merchant-branding system (a merchant's own uploaded logo or none at all), which this task does not touch.

Report any surface where the mark is missing, visibly cropped, stretched/squashed, showing a hard-edged (non-transparent) box around it, or wrongly sized relative to the surrounding text.
  </how-to-verify>

  <resume-signal>Type "approved" or describe which surface looked wrong and how</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Build-time asset -> browser | The logo and its derivatives are static files bundled at build time from a source the developer supplied directly (not user/network input). No runtime trust boundary is crossed by this task. |
| `src/app/s/**` (storefront) vs. apex (platform) | The boundary this task must not cross in the wrong direction — the platform's own mark must stay out of the merchant-branded storefront tree, which is the one surface where an accidental appearance would misrepresent whose brand a shopper is looking at. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-nxf-01 | Tampering | `scripts/generate-brand-icons.mjs` | mitigate | A malformed or unexpectedly-shaped master asset (wrong dimensions, no alpha channel) would silently propagate into a distorted or opaque-boxed favicon across every apex page. The script asserts master dimensions (645x606) and alpha presence before generating anything, and self-verifies the favicon.ico header/PNG-signature bytes after writing it — both fail loudly (`process.exitCode = 1`) rather than producing a corrupt asset silently. |
| T-nxf-02 | Spoofing (of brand identity) | `src/app/s/[slug]/**` | mitigate | The platform's own mark appearing on a merchant storefront would let a shopper mistake a merchant's page for the platform's own surface, or vice versa — a brand-identity confusion, not a security exploit, but the wrong outcome for a system that already deliberately separates the two (`data-surface="storefront"`, `surface-token-isolation.test.ts`). Mitigated by scope discipline (this task never edits anything under `src/app/s/`) and an explicit grep gate in both tasks' `<verify>` blocks asserting no reference to the asset exists there. |
| T-nxf-03 | Denial of Service (performance) | favicon/icon file sizes | accept | All three generated derivatives are small, resized PNGs (64x64, 180x180, and a 32x32 PNG wrapped in a minimal ICO) — negligible payload added to every page load. No mitigation needed beyond the sizes already chosen. |
| T-nxf-SC | Tampering | npm/pip/cargo installs | n/a | No package is installed by this task. `sharp` is an existing declared dependency (0.35.3) used only for local image resizing; the ICO container is hand-built specifically to avoid adding a new dependency. Both tasks' gates confirm `package.json` is untouched via the standard build/lint/typecheck run (no install step is invoked). |
</threat_model>

<verification>
- Task 1 gate script: all five new/derived files exist; master asset is full-size; the generator script is idempotent and self-validating; `icon.png` is 64x64 with alpha, `apple-icon.png` is 180x180; `favicon.ico`'s ICONDIR/ICONDIRENTRY header and embedded PNG signature are byte-correct; `next.config.ts` and `layout.tsx` untouched; nothing under `src/app/s/` references the asset.
- Task 2 gate script: all three edited files import the asset and `next/image`, and render `alt={BRAND}` (never a literal); the sidebar's existing wordmark span survives untouched; `strings.ts` untouched; no reference under `src/app/s/`; no literal-colour or raw-palette-utility violations in the diff.
- `npx vitest run tests/unit/dashboard-nav.test.ts tests/unit/surface-token-isolation.test.ts` — both pass unmodified.
- `npm run lint` (`--max-warnings=0`), `npm run typecheck`, `npm run build` — all green after each task.
- Human-verify checkpoint: real-browser confirmation of the tab favicon, the sidebar mark, the login/signup marks, and the storefront's continued absence of the platform mark.
</verification>

<success_criteria>
- Every apex-hostname page's browser tab shows the EINORT gradient mark; `/favicon.ico` resolves to an image, not a 404.
- The dashboard sidebar header shows the logo beside the existing wordmark.
- `/login` and `/signup` each show the logo above their heading.
- The merchant storefront (`src/app/s/**`) is completely unaffected — no new reference, no visual change.
- `next.config.ts`, `src/app/layout.tsx` and `src/lib/strings.ts` are unmodified.
- No new dependency installed; `sharp` (already present) is the only image-processing tool used.
- `npm run lint`, `npm run typecheck` and `npm run build` are green throughout.
</success_criteria>

<output>
Create `.planning/quick/260903-nxf-platform-logo/260903-nxf-SUMMARY.md` when done.
</output>
