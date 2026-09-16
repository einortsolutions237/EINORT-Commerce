---
phase: 06-merchant-dashboard-platform-admin
plan: 13
subsystem: pdf-attachment-path
tags: [d-22, adm-05, r-2, discretion-q5, support-thread, storage, non-re-encoding-path]

requires:
  - phase: 06-merchant-dashboard-platform-admin (plan 11)
    provides: "src/server/images/r2.ts (ALLOWED_UPLOAD_CONTENT_TYPES/isAllowedContentType, objectKeyFor, publicUrlFor's /original refusal, getObjectBuffer), src/server/images/thread-upload.ts (the two image mint doors and MAX_THREAD_UPLOAD_BYTES), src/app/api/upload/thread-finalize/route.ts (the image finalize pattern this plan's document finalize deliberately does NOT extend)"
  - phase: 06-merchant-dashboard-platform-admin (plan 12)
    provides: "src/server/admin/support.ts (postPlatformMessage, MESSAGE_SELECT) and src/server/admin/support-actions.ts (sendPlatformMessage) — the platform-side attachment path this plan extends with the DOCUMENT kind"
provides:
  - "src/server/images/r2.ts — ALLOWED_DOCUMENT_CONTENT_TYPES/isAllowedDocumentContentType, looksLikePdf (a second, separate allowlist and magic-byte predicate, image allowlist untouched)"
  - "src/server/images/thread-upload.ts — requestThreadDocumentUpload/requestAdminThreadDocumentUpload, the two document mint doors"
  - "src/app/api/upload/thread-document-finalize/route.ts + admin-thread-document-finalize/route.ts — the verifying finalize doors, no Sharp, no derive, magic-byte checked, write no row"
  - "src/app/api/support/attachment/[attachmentId]/route.ts + admin/support/attachment/[attachmentId]/route.ts — the two authorized download doors, one credential each, forcing a download"
  - "src/server/admin/support.ts's attachmentForAdmin — the admin-zone query the admin download door calls (ESLint's adminDb import-zone fence forced this addition)"
  - "Discriminated-union attachment descriptors (kind: IMAGE | DOCUMENT) across support/messages.ts, support/actions.ts, admin/support.ts, admin/support-actions.ts"
  - "attachment-grid.tsx DOCUMENT tiles, composer.tsx's widened accept + mint/finalize branch, strings/support.ts's PDF-inclusive copy"
affects: ["06-14 (none — files_modified lists did not overlap)", "06-16 (none — files_modified lists did not overlap)", "any future plan extending support-thread attachments should read this plan's Task 2 header on the two-narrow-doors discipline before adding a third attachment kind"]

tech-stack:
  added: []
  patterns:
    - "A second, parallel allowlist (ALLOWED_DOCUMENT_CONTENT_TYPES) beside an existing one (ALLOWED_UPLOAD_CONTENT_TYPES), never merged, with a regression test asserting the two never converge (isAllowedContentType(\"application/pdf\") stays false forever) — the pattern for any future 'this format needs a genuinely different storage contract' addition."
    - "Magic-byte verification at finalize time (looksLikePdf, anchored at offset zero) as the substitute for a Sharp derive step's implicit 'this decoded, so it's real' guarantee — the finalize route reads the object back and asserts a real header before any database row can reference it."
    - "SupportAttachment.storageKey stays the derivative-PREFIX shape for BOTH kinds (never a raw /original key in the DB), matching prisma/schema.prisma's and shared.ts's own storageKey contract; the two download doors reconstruct the real R2 key by re-appending the literal /original suffix at read time."
    - "Two more narrow doors (thread-document-finalize + admin-thread-document-finalize; the two attachment download routes) extending the two-narrow-doors-one-credential-each discipline plans 06-11/06-12 already established for the mint and image-finalize steps."
    - "A narrow query function (attachmentForAdmin) added to the admin zone specifically to satisfy ESLint's adminDb import-zone fence for a Route Handler living under src/app/api/admin/** rather than src/server/admin/** — the fence is directory-based, not URL-prefix-based, and a route sharing the /admin/ URL segment does not automatically sit inside the fenced zone."
  removed: []

key-files:
  created:
    - "tests/unit/pdf-attachment.test.ts"
    - "src/app/api/upload/thread-document-finalize/route.ts"
    - "src/app/api/upload/admin-thread-document-finalize/route.ts"
    - "src/app/api/support/attachment/[attachmentId]/route.ts"
    - "src/app/api/admin/support/attachment/[attachmentId]/route.ts"
  modified:
    - "src/server/images/r2.ts"
    - "src/server/images/thread-upload.ts"
    - "src/server/admin/support.ts"
    - "src/server/support/messages.ts"
    - "src/server/support/actions.ts"
    - "src/server/admin/support-actions.ts"
    - "src/components/support/attachment-grid.tsx"
    - "src/components/support/composer.tsx"
    - "src/components/support/message-bubble.tsx"
    - "src/components/support/message-list.tsx"
    - "src/lib/strings/support.ts"
    - "src/app/(dashboard)/dashboard/support/page.tsx"
    - "src/app/admin/support/[tenantId]/page.tsx"
    - ".planning/phases/06-merchant-dashboard-platform-admin/deferred-items.md"

key-decisions:
  - "SupportAttachment.storageKey for a DOCUMENT row is the derivative PREFIX (tenants/{tenantId}/threads/{uploadId}), never the raw /original key — resolved a real tension between the plan's own <interfaces> prose ('a DOCUMENT key must match the /original shape') and prisma/schema.prisma's + shared.ts's explicit, pre-written storageKey contract ('NEVER an /original key in either case'). The schema comment was written specifically anticipating this plan ('here from day one so plan 06-13's document path needs no second migration') and is unambiguous; the plan's phrase is read as 'the shape that derives from an /original key' rather than literally requiring the suffix. Both finalize routes return the prefix (via derivativePrefixFor); both download doors reconstruct the real key by appending the literal /original suffix at read time."
  - "Built TWO document finalize routes (thread-document-finalize + admin-thread-document-finalize), not the one the frontmatter's files_modified list names — Task 2's own action text explicitly instructs 'build two routes rather than one with an \"or\"; mirror plan 06-11's arrangement', matching the codebase-wide two-narrow-doors convention every sibling mint/finalize pair already follows. The frontmatter list appears to have been an oversight; the task body's explicit instruction and the established pattern both point the same direction."
  - "The admin download door cannot import adminDb directly (ESLint's src/server/admin/** import-zone fence — a Route Handler under src/app/api/admin/** is a different directory that merely shares the /admin/ URL prefix). Added attachmentForAdmin(attachmentId) to src/server/admin/support.ts as the one function inside the fenced zone the route calls instead — mirroring how merchantExistsForAdmin already serves the same role for the mint and finalize doors."
  - "message-bubble.tsx, message-list.tsx, and both support page.tsx files were edited despite not appearing in Task 3's <files> list, because message-bubble.tsx filtered row.attachments down to kind === \"IMAGE\" before ever reaching AttachmentGrid — a DOCUMENT attachment would persist correctly but never render or become clickable without threading a new downloadBasePath prop through the whole chain (page -> MessageList -> MessageBubble -> AttachmentGrid). Without this, the plan's own must_haves.truths ('the platform owner can open it') could not be satisfied."
  - "D-22 supersedes 06-UI-SPEC.md § S's Assumption A2 ('No PDF — see the Open Items'). A2 was a narrowing pending confirmation, not a locked rule; D-22 (06-CONTEXT.md) is the confirmation and names the mechanism this plan builds. Recorded in code (composer.tsx's header, the widened accept attribute's surrounding comment, strings/support.ts's attachments-namespace header) and here."

requirements-completed: [ADM-05]

duration: ~65min task execution across three commits; ~5min worktree setup (fast-forward, npm install, prisma generate, env copy)
completed: 2026-09-16
---

# Phase 06 Plan 13: PDF Attachment Path (D-22) Summary

A merchant whose Mobile Money app exports a PDF receipt rather than a screenshot can attach it to a support message, and the platform owner can open it — through a genuinely separate, non-re-encoding storage and serving path with its own allowlist, its own finalize verification, and its own two authorized download doors, built without touching the existing image allowlist or its serving path at all.

## Performance

- **Duration:** ~65 min task execution across 3 commits, plus ~5 min worktree setup (fast-forward from a stale Phase 5.3 checkpoint, `npm install`, `npx prisma generate`, `.env.local`/`.env.test` copy)
- **Completed:** 2026-09-16
- **Tasks:** 3/3
- **Files modified:** 19 (5 created, 14 modified)

## Accomplishments

- `src/server/images/r2.ts`: `ALLOWED_DOCUMENT_CONTENT_TYPES`/`isAllowedDocumentContentType` — a second, separate allowlist beside `ALLOWED_UPLOAD_CONTENT_TYPES`, exact-match, never merged — and `looksLikePdf`, a pure magic-byte predicate anchored at offset zero.
- `src/server/images/thread-upload.ts`: `requestThreadDocumentUpload`/`requestAdminThreadDocumentUpload` — the two document mint doors, gated by the document allowlist, capped by the existing `MAX_THREAD_UPLOAD_BYTES`, composing the same `/original`-suffixed key `objectKeyFor` always produces.
- `src/app/api/upload/thread-document-finalize/route.ts` + `admin-thread-document-finalize/route.ts`: the two verifying finalize doors. No Sharp, no derive, no second object written. Reads the object back, asserts `looksLikePdf` and the byte ceiling, returns `{ storageKey, contentType, byteSize }` with no width/height and no URL. Writes no database row.
- `src/app/api/support/attachment/[attachmentId]/route.ts` + `src/app/api/admin/support/attachment/[attachmentId]/route.ts`: the two authorized download doors, one credential each. `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="receipt.pdf"` (server-generated), `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; sandbox`, `Cache-Control: private, no-store`. Neither calls the R2 client's public-URL helper.
- Discriminated-union attachment descriptors (`kind: "IMAGE" | "DOCUMENT"`) threaded through `src/server/support/messages.ts`, `src/server/support/actions.ts`, `src/server/admin/support.ts`, `src/server/admin/support-actions.ts` — a `DOCUMENT` descriptor carrying `width`/`height`, or an `IMAGE` descriptor missing them, is a Zod schema rejection, not a runtime possibility nobody checks.
- `src/components/support/attachment-grid.tsx`: `DOCUMENT` tiles (a `file-text` icon, formatted file size, no lightbox, no `Dialog`, no `<Image`) for both `sent` and `staged` modes; the authorized download route's base path arrives as a prop (`downloadBasePath`) chosen by the page, never a branch on `viewer`.
- `src/components/support/composer.tsx`: `accept` widened to `image/jpeg,image/png,image/webp,application/pdf`; `stageFile` branches on the picked file's MIME type to the correct mint/finalize door pair, because the two finalize endpoints return different shapes.
- `src/lib/strings/support.ts`: the `attachments` namespace widened to name PDF explicitly (`typeHelper`, `typeError`, `sizeError` now read "file" not "image"), plus a document-tile label and a download aria-label — with a header comment recording the D-22-over-A2 resolution.
- (Deviation) `src/components/support/message-bubble.tsx`, `message-list.tsx`, and both support `page.tsx` files: threaded a `downloadBasePath` prop end-to-end and stopped filtering `DOCUMENT` attachments out before they ever reached `AttachmentGrid` — without this, a persisted `DOCUMENT` row would never actually become visible or clickable in either thread.

## Task Commits

1. **Task 1: The document allowlist, the document mint door, and the verification unit test** - `7b9df9e` (feat)
2. **Task 2: The verifying finalize route and the two authorized download doors** - `58fc6ca` (feat)
3. **Task 3: Persist document attachments, render them, and widen the copy** - `bd10171` (feat)

## Files Created/Modified

- `tests/unit/pdf-attachment.test.ts` — allowlist and magic-byte regression tests (new)
- `src/app/api/upload/thread-document-finalize/route.ts` — merchant document finalize door (new)
- `src/app/api/upload/admin-thread-document-finalize/route.ts` — admin document finalize door (new, deviation from the frontmatter's files_modified list, required by Task 2's own action text)
- `src/app/api/support/attachment/[attachmentId]/route.ts` — merchant download door (new)
- `src/app/api/admin/support/attachment/[attachmentId]/route.ts` — admin download door (new)
- `src/server/images/r2.ts` — the document allowlist and `looksLikePdf`
- `src/server/images/thread-upload.ts` — the two document mint doors
- `src/server/admin/support.ts` — `PlatformThreadAttachmentInput` widened to a discriminated union, `postPlatformMessage`'s create call handles `kind`/null dimensions, plus `attachmentForAdmin` (deviation, see below)
- `src/server/support/messages.ts` — `ThreadAttachmentInput` widened, `postMerchantMessage`'s create call handles `kind`/null dimensions
- `src/server/support/actions.ts` — `attachmentSchema` becomes a `z.discriminatedUnion`
- `src/server/admin/support-actions.ts` — same discriminated-union widening, admin side
- `src/components/support/attachment-grid.tsx` — `DOCUMENT` tiles, `downloadBasePath` prop, `formatFileSize`
- `src/components/support/composer.tsx` — widened `accept`, document mint/finalize branch, D-22 header section
- `src/components/support/message-bubble.tsx` — `downloadBasePath` prop, stops filtering out `DOCUMENT` attachments (deviation)
- `src/components/support/message-list.tsx` — threads `downloadBasePath` through to `MessageBubble` (deviation)
- `src/lib/strings/support.ts` — widened `attachments` namespace, D-22-over-A2 header note
- `src/app/(dashboard)/dashboard/support/page.tsx` — passes `downloadBasePath="/api/support/attachment"` (deviation)
- `src/app/admin/support/[tenantId]/page.tsx` — passes `downloadBasePath="/api/admin/support/attachment"` (deviation)
- `.planning/phases/06-merchant-dashboard-platform-admin/deferred-items.md` — two new entries (the `variant="gold"` grep re-confirmation, the file-list omission)

## Decisions Made

See `key-decisions` in the frontmatter for the five substantive ones: the `storageKey` shape resolution between the plan's own prose and the pre-written schema contract, building two finalize routes against a frontmatter list naming only one, the `attachmentForAdmin` addition forced by the ESLint import-zone fence, the message-bubble/message-list/page.tsx wiring required for the feature to actually render, and the D-22-over-A2 resolution.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The admin download door could not import `adminDb` directly**

- **Found during:** Task 2, first `npm run lint` after writing the admin download route.
- **Issue:** `eslint.config.mjs` restricts `adminDb` to `src/server/admin/**`. `src/app/api/admin/support/attachment/[attachmentId]/route.ts` lives under `src/app/api/admin/**` — a directory that merely shares the `/admin/` URL prefix, not the fenced zone.
- **Fix:** Added `attachmentForAdmin(attachmentId)` to `src/server/admin/support.ts` — the one function inside the fenced zone the route now calls instead, mirroring how `merchantExistsForAdmin` already serves an identical role for the mint and finalize doors.
- **Files modified:** `src/server/admin/support.ts`, `src/app/api/admin/support/attachment/[attachmentId]/route.ts`
- **Verification:** `npm run lint` clean after the fix; `npm run build` lists the route.
- **Committed in:** `58fc6ca`

**2. [Rule 1 - Comment-only] Several header comments named forbidden-substring literals the plan's own acceptance-criteria greps check for absence**

- **Found during:** Tasks 2 and 3, re-verifying acceptance-criteria greps after writing explanatory headers.
- **Issue:** Comments explaining "this route never calls `publicUrlFor`" or "never imports `requireAdminContext`" contain the literal substring being checked for absence, so a plain `grep -c <substring>` counts the comment mention alongside any real usage — the identical class of self-defeating grep `06-12-SUMMARY.md`'s own Deviation #3 already documents.
- **Fix:** Reworded four header passages (in `thread-document-finalize/route.ts` and both download doors) to describe the same rule without repeating the literal function/identifier name (e.g. "the R2 client's own public-URL helper" instead of `publicUrlFor`; "the admin zone's own identity resolver" instead of `requireAdminContext`).
- **Files modified:** `src/app/api/upload/thread-document-finalize/route.ts`, `src/app/api/support/attachment/[attachmentId]/route.ts`, `src/app/api/admin/support/attachment/[attachmentId]/route.ts`
- **Verification:** Re-ran every named grep from the plan's acceptance criteria; all return the required counts.
- **Committed in:** `58fc6ca`

**3. [Rule 2 - Missing critical functionality] `message-bubble.tsx`/`message-list.tsx`/both support `page.tsx` files were not in Task 3's stated file list, but editing them was required for the feature to render at all**

- **Found during:** Task 3, tracing how a persisted `DOCUMENT` attachment would reach the screen after widening `attachment-grid.tsx`.
- **Issue:** `message-bubble.tsx` (plan 06-11) filtered `row.attachments` down to `kind === "IMAGE"` before ever calling `AttachmentGrid` in `sent` mode. A `DOCUMENT` row would persist correctly through `postMerchantMessage`/`postPlatformMessage` but never appear in either thread, and even if the filter were removed, `AttachmentGrid`'s new `downloadBasePath` prop had no source anywhere in the existing `page.tsx -> MessageList -> MessageBubble` prop chain. This plan's own `must_haves.truths` — "the platform owner can open it" — could not be satisfied without this wiring.
- **Fix:** Added an optional `downloadBasePath` prop to `MessageBubbleProps` and `MessageListProps`, mirroring `resolveAttachmentUrl`'s existing optionality (both undefined only for the composer's optimistic pending bubble, whose `attachments` is always empty anyway). Replaced the `kind === "IMAGE"`-only filter with a `flatMap` that includes a `DOCUMENT` attachment (with an unused empty `url`) whenever `downloadBasePath` is defined. Both surface pages now pass their own base path (`/api/support/attachment` and `/api/admin/support/attachment`).
- **Files modified:** `src/components/support/message-bubble.tsx`, `src/components/support/message-list.tsx`, `src/app/(dashboard)/dashboard/support/page.tsx`, `src/app/admin/support/[tenantId]/page.tsx`
- **Verification:** `npm run build`/`typecheck`/`test:unit` (701/701) all clean; manually traced the full prop chain from each page down to the tile's `href`.
- **Committed in:** `bd10171`

### Documented, Not Fixed (pre-existing, out of scope)

**4. `variant="gold"` grep count is 10, not the plan's asserted 5 — pre-existing, unchanged by this plan**

- Confirmed none of this plan's created or modified files contain the string `gold` anywhere. Identical, pre-existing condition already documented by plans 06-10, 06-11, and 06-12. Full detail appended to `deferred-items.md`.

---

**Total deviations:** 4 (2 blocking-issue/missing-functionality auto-fixes, 1 comment-only self-defeating-grep fix, 1 documented-not-fixed pre-existing discrepancy)
**Impact on plan:** Deviations 1 and 3 were required for the feature to compile and to actually render end-to-end respectively — without either, D-22 would be undeliverable despite every Task 1/2 file being individually correct. Deviation 2 is cosmetic (comment wording only, changes no behavior). Deviation 4 is a pre-existing, unrelated repository condition.

## Known Stubs

None. Every path this plan builds is wired to real server logic: a PDF mints a real presigned grant, finalizes against real R2 bytes with a real magic-byte check, persists a real `SupportAttachment` row, and renders as a real, clickable tile linking to a real authorized route that streams the real object back. Nothing here renders hardcoded or placeholder data.

## Threat Flags

None beyond what this plan's own `<threat_model>` register (T-06-60..T-06-67, T-06-SC) already names — no new network endpoints, auth paths, or trust-boundary schema changes were introduced outside that register. `attachmentForAdmin` (the ESLint-fence workaround) is a query function inside the already-registered admin zone, gated by the same `requireAdminContext()` the register's T-06-62/T-06-63 entries already cover; it does not introduce a new authorization surface.

## Verification

- `npm run lint && npm run build && npm run typecheck && npm run test:unit` — all green as of the final commit (`bd10171`). `test:unit`: 701/701 passing, 43/43 files. `build` lists all six new routes (`/api/upload/thread-document-finalize`, `/api/upload/admin-thread-document-finalize`, `/api/support/attachment/[attachmentId]`, `/api/admin/support/attachment/[attachmentId]`, plus the two pre-existing image routes unchanged).
- `npx vitest run tests/unit/pdf-attachment.test.ts tests/unit/r2-key.test.ts tests/unit/image-pipeline.test.ts` — 107/107 passing.
- `git diff --stat eslint.config.mjs` — empty, no change.
- `git diff aefadc9 -- src/server/images/r2.ts` — additions only; `ALLOWED_UPLOAD_CONTENT_TYPES`'s own three lines are byte-identical to the base commit.
- Every task-level acceptance-criteria grep from the plan (allowlist isolation, mint-door counts, magic-byte checks, no-`publicUrlFor`, security-header presence, single-credential-per-door, discriminated-union presence, no-Dialog/no-Image in the `DOCUMENT` branch, `D-22` mention in `composer.tsx`, PDF mentions in `strings/support.ts`) re-verified and passing after the final commit.

## Issues Encountered

- **Worktree was spawned from a stale Phase 5.3 checkpoint (`d302801`), not a descendant of `aefadc9`.** Fast-forwarded cleanly via `git merge --ff-only aefadc9` before any work began — zero unique commits existed on the worktree branch, so this was a pure, safe fast-forward with no conflict, matching the dispatch instructions' own note that this has happened to every prior executor in this session.
- **A real tension between the plan's own `<interfaces>` prose and `prisma/schema.prisma`'s pre-written `storageKey` contract** required careful reconciliation before writing any code — see the first `key-decision` above for the full resolution.
- See Deviations #1–#3 above for the three substantive gaps found and fixed.

## User Setup Required

None — no external service configuration required. All env vars were already present in `.env.local`/`.env.test` (copied from the main checkout as instructed). No new npm package was added (T-06-SC's own disposition).

## Next Phase Readiness

- D-22 is delivered rather than deferred: a merchant can attach a PDF receipt and the platform owner can open it, end to end, on both surfaces.
- ADM-05's attachment surface now covers both accepted kinds; no further plan is required to complete the PDF half of this requirement.
- The two-narrow-doors pattern this plan extends (mint, finalize, download) is now established for a THIRD kind beyond the two images/documents already had — any future attachment kind (should one ever be proposed) has three worked examples to follow rather than one.
- No blockers for downstream plans. This plan's `files_modified` did not overlap with sibling plans 06-14 or 06-16, and no coordination was required during execution.

---
*Phase: 06-merchant-dashboard-platform-admin*
*Completed: 2026-09-16*

## Self-Check: PASSED
