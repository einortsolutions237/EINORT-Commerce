# Deferred Items

## From plan 06-11

### `variant="gold"` grep count is 10, not the expected 5

**Found during:** Task 3 final verification (`grep -ro 'variant="gold"' src/app src/components | wc -l`).

**Detail:** The plan's acceptance criteria (Task 3 and the plan-level `<verification>` block)
assert this command returns exactly 5. As of this plan's starting commit (`6d41ae9`, before
any 06-11 work), it already returns 10. The gap is comment-text mentions of the literal string
`variant="gold"` inside doc comments that discuss the "5 real usages" convention
(`src/app/(dashboard)/dashboard/orders/loading.tsx`, `src/app/(dashboard)/dashboard/recent-orders.tsx`,
`src/components/admin/admin-banner.tsx`, `src/components/admin/admin-sidebar.tsx`,
`src/components/app-sidebar.tsx`, `src/components/order-state-chip.tsx`) — a plain `grep -o`
counts those prose mentions alongside the real JSX usages, and the actual JSX usage count (5)
has not changed.

**Verified out of scope:** `git diff --stat 6d41ae9 HEAD -- <those six files>` is empty —
none of them were touched by any 06-11 commit, and none of 06-11's own new/modified files
(`src/components/support/**`, `src/server/images/thread-upload.ts`,
`src/app/api/upload/thread-finalize/route.ts`) contain the string `gold` anywhere. This is a
pre-existing condition in the repository, not a regression introduced by this plan.

**Action:** Not fixed here — out of scope per the executor's scope-boundary rule (only fix
issues directly caused by the current task's changes). Left for a future plan or a dedicated
cleanup pass to either tighten the grep pattern (e.g. exclude comment lines) or reduce the
prose mentions.

**No actual regression:** `tests/unit/dashboard-nav.test.ts`'s own contract test — "spends the
gold accent exactly five times, in the five files the budget names" — is the REAL, precise
enforcement of this invariant (it scans `.tsx` source specifically, not comment prose), and it
passes cleanly as part of the 685-test `npm run test:unit` run. The plan's illustrative
`grep -ro` command is a simplified approximation that double-counts comment mentions; the
underlying budget itself is intact.

## From plan 06-12

### Same `variant="gold"` grep discrepancy observed, unchanged

**Found during:** Task 2 and Task 3 final verification (same `grep -ro 'variant="gold"' src/app
src/components | wc -l` command named above).

**Detail:** Confirmed via `git stash` before and after this plan's Task 2 edits that the count
was already 10 at this plan's starting commit (`ce9ee38`, itself a descendant of the `6d41ae9`
base 06-11 recorded against) — identical to 06-11's own finding. None of 06-12's new or modified
files (`src/server/admin/support.ts`, `src/server/admin/support-actions.ts`,
`src/app/admin/support/page.tsx`, `src/app/admin/support/loading.tsx`,
`src/app/admin/support/[tenantId]/page.tsx`, `src/app/admin/support/[tenantId]/loading.tsx`,
`src/app/admin/layout.tsx`, `src/app/admin/merchants-list.tsx`,
`src/app/admin/merchants/[id]/page.tsx`) reference the string `gold` anywhere — verified by grep
against each file individually.

**Action:** Not fixed here, for the identical reason 06-11 did not fix it — out of scope, and
`tests/unit/dashboard-nav.test.ts`'s real contract test still passes at 685/685.

### `ls src/components/support/` lists 5 files, not "exactly the four" Task 3's acceptance criteria names

**Found during:** Task 3 final verification.

**Detail:** The Task 3 acceptance criteria expect `ls src/components/support/` to show "exactly
the four components from plans 06-09 and 06-11" as evidence no forked transcript component was
added. The directory actually contains five: `attachment-grid.tsx`, `composer.tsx`,
`message-bubble.tsx`, `message-list.tsx`, and `scroll-to-latest.tsx`. `scroll-to-latest.tsx` was
already present at this plan's starting commit (`ce9ee38`, shipped by plan 06-09 alongside the
other three transcript components) — it is a scroll-into-view helper, not a transcript-rendering
component, which is presumably why the plan's prose names "four." This plan added zero new files
to that directory; it only edited `composer.tsx` in place (see the `viewer`/`tenantId` deviation
in `06-12-SUMMARY.md`) and reused `scroll-to-latest.tsx` unchanged on the admin thread page (§ C6
inherits A2's "scrolls to newest on load" contract). No forking occurred.

### `viewer="PLATFORM"` grep count on the thread page is 2, not the expected 1

**Found during:** Task 3 final verification (`grep -c 'viewer="PLATFORM"' src/app/admin/support/[tenantId]/page.tsx`).

**Detail:** The acceptance criterion expected exactly one occurrence (on `<MessageList
viewer="PLATFORM" .../>`). This plan's `<Composer viewer="PLATFORM" tenantId={tenantId} />` call
is a second, necessary occurrence — see `06-12-SUMMARY.md`'s deviation note on extending
`Composer` with the same `viewer` mirror `MessageBubble`/`MessageList` already had, since the
component shipped by plan 06-09 took no props at all and could not otherwise serve the admin
surface without forking. Both occurrences are legitimate call sites, not a fork.

## From plan 06-13

### Same `variant="gold"` grep discrepancy observed, unchanged

**Found during:** Task 3 final verification (`grep -ro 'variant="gold"' src/app src/components |
wc -l`, the plan's own final `<verification>`-block command).

**Detail:** Returns 10, identical to 06-11's and 06-12's own findings — none of this plan's
new or modified files (`src/server/images/r2.ts`, `src/server/images/thread-upload.ts`, the four
new route files, `src/server/support/messages.ts`, `src/server/support/actions.ts`,
`src/server/admin/support.ts`, `src/server/admin/support-actions.ts`,
`src/components/support/attachment-grid.tsx`, `src/components/support/composer.tsx`,
`src/components/support/message-bubble.tsx`, `src/components/support/message-list.tsx`,
`src/lib/strings/support.ts`, the two `page.tsx` files) contain the string `gold` anywhere —
verified by grep against each file individually. Not fixed here, for the identical reason 06-11
and 06-12 did not fix it — out of scope, pre-existing, and `tests/unit/dashboard-nav.test.ts`'s
real contract test still passes (701/701 in this plan's full unit run).

### Task 3's stated `<files>` list omitted `message-bubble.tsx`, `message-list.tsx`, and both
### support `page.tsx` files — editing them was required for D-22 to actually render

**Found during:** Task 3, while tracing how a persisted `DOCUMENT` attachment would reach the
screen after `attachment-grid.tsx` gained a `DOCUMENT` branch.

**Detail:** `message-bubble.tsx` (plan 06-11) filtered `row.attachments` down to
`kind === "IMAGE"` before ever calling `<AttachmentGrid mode="sent" />` — a `DOCUMENT` row would
persist correctly via `postMerchantMessage`/`postPlatformMessage` but never reach the grid at
all, and even if it had, `AttachmentGrid`'s new `downloadBasePath` prop (required for a
`DOCUMENT` tile's link) had no source anywhere in the existing prop chain
(`page.tsx` → `MessageList` → `MessageBubble` → `AttachmentGrid`). Task 3's plan text focuses
entirely on `attachment-grid.tsx`'s own rendering branch and does not mention this filter or the
missing prop. Without editing all four files, D-22's own `must_haves.truths` — "the platform
owner can open it" — could not be satisfied: the PDF would upload, verify, and persist, but stay
permanently invisible in both threads.

**Action:** Fixed as part of Task 3's own commit (Rule 2 — missing critical functionality),
not deferred. See `06-13-SUMMARY.md`'s Deviations section for the full change list.
