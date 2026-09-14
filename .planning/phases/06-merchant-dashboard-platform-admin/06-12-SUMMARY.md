---
phase: 06-merchant-dashboard-platform-admin
plan: 12
subsystem: admin-support-inbox-and-thread
tags: [adm-03, adm-05, d-08, d-11, d-12, d-20, support-thread, admin-surface, viewer-mirror]

requires:
  - phase: 06-merchant-dashboard-platform-admin (plan 06)
    provides: "src/server/support/shared.ts — SupportMessageRow/SupportAttachmentRow DTOs and UNREAD_BY_PLATFORM_AUTHORS, the one file the admin zone may import from the support domain"
  - phase: 06-merchant-dashboard-platform-admin (plan 08)
    provides: "src/server/admin/queries.ts (merchantDetailForAdmin, merchantExistsForAdmin), src/app/admin/merchants-list.tsx and merchants/[id]/page.tsx with the two deferred entry-point comments this plan fills"
  - phase: 06-merchant-dashboard-platform-admin (plan 09)
    provides: "src/components/support/message-bubble.tsx, message-list.tsx, composer.tsx, scroll-to-latest.tsx — the merchant thread UI, mirrored by viewer where the prop already existed"
  - phase: 06-merchant-dashboard-platform-admin (plan 11)
    provides: "src/server/images/thread-upload.ts (requestAdminThreadAttachmentUpload), src/app/api/upload/thread-finalize/route.ts (the merchant-door pattern this plan's admin-door sibling mirrors), src/components/support/attachment-grid.tsx"
provides:
  - "src/server/admin/support.ts — inboxForAdmin, unreadByTenant, unreadThreadCount, threadForAdmin, firstUnreadForPlatform, markThreadReadForPlatform, postPlatformMessage, postSystemMessageAsAdmin"
  - "src/server/admin/support-actions.ts — sendPlatformMessage, the adminAction-wrapped endpoint"
  - "src/app/admin/support/page.tsx and [tenantId]/page.tsx — the flat inbox and the per-merchant thread"
  - "src/app/api/upload/admin-thread-finalize/route.ts — the admin door's finalize route"
  - "src/components/support/composer.tsx's viewer/tenantId props — the completed mirror plans 06-14/06-15/06-16 can pass through unchanged"
affects: ["06-14 (suspend/restore notices call postSystemMessageAsAdmin, the AdminSupportWriteTx transaction parameter this plan built)", "06-15 (the SubscriptionClaimCard this plan's thread page leaves as a plain SYSTEM message, and the subscriptions-namespace admin upload door already usable through Composer's viewer mirror)", "06-16 (subscription confirm/reject notices via postSystemMessageAsAdmin; /admin/subscriptions is the link target this plan explicitly does not build yet)"]

tech-stack:
  added: []
  patterns:
    - "Cross-tenant inbox as three parallel reads (organization.findMany, two supportMessage.groupBy calls) plus one DEPENDENT read (a findMany matching the exact (tenantId, createdAt) pairs the groupBy's _max found) to resolve the last message's body/author, merged and sorted in JS — extends 06-RESEARCH.md Pattern 6 with the dependent-read step needed because groupBy's _max returns a timestamp, never the row it belongs to."
    - "unreadThreadCount derived from unreadByTenant's own Map.size rather than a second query — one groupBy feeds both D-11 consumers (the rail's total badge and each inbox row's per-thread count), the same derived-count doctrine the merchant side documents."
    - "A narrow structural transaction-client interface (AdminSupportWriteTx, modeled on OrderWriteTx) lets postSystemMessageAsAdmin accept an optional tx without src/server/admin/** naming a generated Prisma type directly — that import stays fenced to src/server/db/**."
    - "Composer extended with the same viewer/tenantId mirror MessageBubble/MessageList already had (defaulting to \"MERCHANT\"), rather than forking a second composer file — the component now branches at all three steps it drives (mint, finalize, send) between the merchant and admin door pairs."
    - "A second, sibling finalize Route Handler (admin-thread-finalize/route.ts) rather than one branching route — matches the two-narrow-doors-one-credential-each pattern src/server/images/thread-upload.ts's header already established for the mint step, extended to the finalize step this plan needed and 06-11 explicitly deferred."
  removed: []

key-files:
  created:
    - "src/server/admin/support.ts"
    - "src/server/admin/support-actions.ts"
    - "src/app/admin/support/page.tsx"
    - "src/app/admin/support/loading.tsx"
    - "src/app/admin/support/[tenantId]/page.tsx"
    - "src/app/admin/support/[tenantId]/loading.tsx"
    - "src/app/api/upload/admin-thread-finalize/route.ts"
  modified:
    - "src/app/admin/layout.tsx"
    - "src/app/admin/merchants-list.tsx"
    - "src/app/admin/merchants/[id]/page.tsx"
    - "src/components/support/composer.tsx"
    - "src/app/api/upload/thread-finalize/route.ts"
    - ".planning/phases/06-merchant-dashboard-platform-admin/deferred-items.md"

key-decisions:
  - "Composer.tsx (plan 06-09) shipped with zero props, hardcoded to the merchant's own Server Actions at all three steps it drives (mint, finalize, send) — despite MessageBubble and MessageList already carrying the viewer prop § S promises. Rather than fork a second composer (explicitly forbidden by § S and by the orchestrator's own instructions), this plan added viewer/tenantId props that branch at each of the three call sites, defaulting to \"MERCHANT\" so /dashboard/support is unaffected."
  - "That extension surfaced a second gap: thread-finalize/route.ts's own header explicitly deferred an admin-authenticated finalize route to this plan ('a new file built the same way this one was'), but nothing in 06-12-PLAN.md's task text named it. Composer's finalize fetch would otherwise call the merchant-only route, which authorizes via requireMerchantContext() — a call the platform owner's session cannot satisfy (D-04, no tenant). Built src/app/api/upload/admin-thread-finalize/route.ts, mirroring thread-finalize/route.ts with requireAdminContext() and a body-supplied, merchantExistsForAdmin-validated tenantId in place of ctx.tenantId. Both are Rule 3 (blocking-issue) auto-fixes: without either, an admin reply with or without an attachment would fail outright."
  - "inboxForAdmin's last-message preview (body + author) could not come from the two groupBy reads the interfaces block names (a groupBy's _max returns a timestamp, not the row it belongs to) — added one further, DEPENDENT findMany matching the exact (tenantId, createdAt) pairs already found, run after the Promise.all rather than inside it. This is still 'no raw SQL, merged in JS,' just one more JS-side step than the interfaces block's literal three-reads description."
  - "unreadThreadCount is thread count (owner-facing 'N conversations need a reply'), not a total unread-message count — derived as unreadByTenant()'s Map.size, since that groupBy already returns exactly one row per tenant with at least one unread message. Matches the rail's existing unreadCountLabel copy contract and reuses the one query rather than adding a second."
  - "Row-level parameter names in src/server/admin/support.ts are merchantId, not tenantId — tests/unit/no-tenant-id-param.test.ts bans the literal spellings tenantId/organizationId/storeId from every exported signature under src/server/admin/**, with no carve-out for a legitimate query parameter. Internal where clauses still read tenantId (the actual column name); only the function signatures changed."

requirements-completed: [ADM-03, ADM-05]

duration: ~70min (task work across four commits, including the post-Task-3 finalize-route fix); additional ~10min worktree setup (fast-forward, npm install, prisma generate, env copy)
completed: 2026-09-14
---

# Phase 06 Plan 12: Admin Support Inbox and Thread Summary

The platform owner can now see every merchant's support thread in one unread-first inbox, open any one of them, read it, and reply — with attachments — through the identical transcript components the merchant's own `/dashboard/support` uses, mirrored end-to-end (including the composer's mint/finalize/send doors, not just the read-only bubble/list) by a `viewer` prop rather than a second, forked implementation.

## Performance

- **Duration:** ~70 min task execution across 4 commits (including a post-commit blocking-bug fix), plus ~10 min worktree setup (fast-forward from a stale Phase 5.3 base, `npm install`, `npx prisma generate`, `.env.local`/`.env.test` copy)
- **Completed:** 2026-09-14
- **Tasks:** 3/3, plus one same-scope fix commit after Task 3
- **Files modified:** 13 (7 created, 6 modified)

## Accomplishments

- `src/server/admin/support.ts`: the platform owner's whole read/write surface for the thread table — `inboxForAdmin` (three parallel reads + one dependent read, merged and sorted per § C5's ordering rule in JS), `unreadByTenant`/`unreadThreadCount` (one `groupBy` feeding both D-11 consumers), `threadForAdmin`/`firstUnreadForPlatform`/`markThreadReadForPlatform` (the admin-zone mirror of the merchant-side reads), `postPlatformMessage` (one transaction, message + up to 4 attachments), `postSystemMessageAsAdmin` (the automated-notice primitive plans 06-14/06-16 will call, with an optional same-transaction `tx` parameter).
- `src/server/admin/support-actions.ts`: `sendPlatformMessage`, validating the target tenant exists before any write, then scheduling the merchant-direction email nudge inside `after()`.
- `src/app/admin/support/page.tsx` / `loading.tsx`: the flat, unread-first inbox — no table, no filters, unread signaled by both a blue count badge and foreground/muted-foreground store-name color.
- `src/app/admin/support/[tenantId]/page.tsx` / `loading.tsx`: one merchant's thread, platform side — `notFound()` on an unmatched id, read-before-mark ordering preserved, `MessageList viewer="PLATFORM"` and `Composer viewer="PLATFORM"` reused unchanged in shape (extended, not forked — see Deviations), `SYSTEM` messages carrying a subscription claim render plainly with a comment naming plans 06-15/06-16.
- `src/app/admin/layout.tsx`: wires the real `unreadThreadCount()` into the rail's Support badge, leaving the 06-16 `pendingSubscriptionClaims` placeholder untouched.
- `src/app/admin/merchants-list.tsx` / `merchants/[id]/page.tsx`: both deferred `Open support thread` entry points now resolve.
- `src/components/support/composer.tsx` (deviation, Rule 3): extended with `viewer`/`tenantId` props so it can drive the admin doors at mint, finalize, and send — completing the mirror `message-bubble.tsx`/`message-list.tsx` already had.
- `src/app/api/upload/admin-thread-finalize/route.ts` (deviation, Rule 3): the admin-authenticated finalize route `thread-finalize/route.ts`'s own header named as deferred to this plan; without it every admin-side attachment upload would fail at the last step.

## Task Commits

1. **Task 1: The admin support server module and its action module** - `78c5324` (feat)
2. **Task 2: The inbox page and the rail's unread badge** - `b530ee9` (feat)
3. **Task 3: The platform-side thread page and the two deferred entry points** - `5bdb292` (feat)
4. **Fix: admin-authenticated finalize route for thread attachments** - `2ef9725` (fix, discovered while re-verifying Task 3's composer wiring)

## Files Created/Modified

- `src/server/admin/support.ts` — the platform owner's read/write module (new)
- `src/server/admin/support-actions.ts` — `sendPlatformMessage` (new)
- `src/app/admin/support/page.tsx` / `loading.tsx` — the inbox (new)
- `src/app/admin/support/[tenantId]/page.tsx` / `loading.tsx` — the thread (new)
- `src/app/api/upload/admin-thread-finalize/route.ts` — the admin finalize route (new, deviation)
- `src/app/admin/layout.tsx` — wires `unreadThreadCount()`
- `src/app/admin/merchants-list.tsx` — `Open support thread` row action, internal-vs-external link handling
- `src/app/admin/merchants/[id]/page.tsx` — `Open support thread` header button
- `src/components/support/composer.tsx` — `viewer`/`tenantId` props added (deviation)
- `src/app/api/upload/thread-finalize/route.ts` — header updated to name its now-existing sibling
- `.planning/phases/06-merchant-dashboard-platform-admin/deferred-items.md` — three grep-count discrepancies documented (one carried from 06-11, two new to this plan)

## Decisions Made

See `key-decisions` in the frontmatter for the five substantive ones (the Composer extension, the admin finalize route it required, the dependent fourth inbox read, `unreadThreadCount`'s thread-vs-message semantics, and the `merchantId`-not-`tenantId` parameter naming).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `src/components/support/composer.tsx` had no `viewer` prop and could not serve the admin surface at all**

- **Found during:** Task 3, reading `composer.tsx` in full per the orchestrator's explicit instruction before touching it.
- **Issue:** The plan's interfaces block and the orchestrator's own briefing state that `message-bubble.tsx`, `message-list.tsx`, and `composer.tsx` are "reused unchanged, mirrored by the viewer prop." That is true of the first two; `composer.tsx` as shipped by plan 06-09 took zero props and called the merchant's own `sendSupportMessage`/`requestThreadAttachmentUpload` unconditionally — there was no `viewer` prop to reuse, and forking a second composer file is exactly the regression 06-UI-SPEC.md § S forbids by name.
- **Fix:** Added `viewer?: SupportViewer` (default `"MERCHANT"`) and `tenantId?: string` props. `draftRow`'s hardcoded `author: "MERCHANT"` became a parameter; the pending-bubble `viewer="MERCHANT"` became `viewer={viewer}`; the mint call and the send call each branch on `viewer === "PLATFORM" && tenantId !== undefined` to call the admin door instead of the merchant door. `/dashboard/support`'s existing zero-prop `<Composer/>` is unaffected — default parameters keep it calling the merchant doors exactly as before.
- **Files modified:** `src/components/support/composer.tsx`
- **Verification:** `npm run build`/`typecheck`/`test:unit` all clean; `npm run lint` clean (no import-zone violation importing `@/server/admin/support-actions` into a Client Component, since Server Actions are the sanctioned cross-boundary call shape).
- **Committed in:** `5bdb292`

**2. [Rule 3 - Blocking] The admin door had no finalize route — attachment uploads from `/admin/support/[tenantId]` would fail at the last step**

- **Found during:** immediately after Task 3's commit, while re-reading `thread-finalize/route.ts`'s own header as part of final verification (its header explicitly states: "the admin door gets its own sibling route, later" / "a new file built the same way this one was, re-authorizing through `requireAdminContext()` instead").
- **Issue:** `thread-finalize/route.ts` authorizes via `requireMerchantContext()` and derives the storage key from `ctx.tenantId` — the signed-in merchant's own session tenant. The platform owner has no tenant (D-04); calling that route from the admin composer would fail identity resolution outright. Task 3's plan text ("Attachments work here through the admin mint door plan 06-11 built") named only the mint door and did not flag that the finalize step needed its own admin-authenticated route — a gap 06-11's own file already anticipated and deferred to this plan by name.
- **Fix:** Built `src/app/api/upload/admin-thread-finalize/route.ts`, mirroring `thread-finalize/route.ts` structurally (Node runtime, 30s `maxDuration`, no key accepted from the client, errors carry a code never a key/URL) with two differences: `requireAdminContext()` in place of `requireMerchantContext()`, and a body-supplied `tenantId` — validated via `merchantExistsForAdmin` before any storage read — in place of `ctx.tenantId`, matching the same "admin identity resolves WHO, a query parameter resolves WHICH store" distinction the admin mint door already established. No `canWrite` re-check (the platform owner has no trial state to gate, matching `adminAction`'s own documented reasoning for omitting a `mode` axis). Updated `composer.tsx` to route the finalize `fetch` to this new endpoint (with `tenantId` in the body) when `viewer === "PLATFORM"`.
- **Files modified:** `src/app/api/upload/admin-thread-finalize/route.ts` (new), `src/app/api/upload/thread-finalize/route.ts` (header updated to stop describing its sibling as future work), `src/components/support/composer.tsx`
- **Verification:** `npm run build` lists `/api/upload/admin-thread-finalize`; `npm run lint`/`typecheck`/`test:unit` (685/685) all clean.
- **Committed in:** `2ef9725` (separate commit, after Task 3's own `5bdb292`, since the gap was found during post-commit re-verification rather than during Task 3 itself)

**3. [Rule 3 - Blocking, doc-comment-only] Two comment rewordings to avoid self-matching literal-absence acceptance greps**

- **Found during:** Task 1, re-verifying `src/server/admin/support.ts`'s acceptance criteria.
- **Issue:** The plan's acceptance criteria grep for the literal ABSENCE of certain substrings (`server/support/queries`/`server/support/messages`, `scopedDb`/`tenant-scoped`, `$queryRaw`/`$executeRaw`) to prove an architectural property. My own header comments named those identifiers in prose (explaining exactly why they must be absent), which the same grep then flagged — `grep` does not distinguish code from comments, and `shared.ts`'s own header states this is deliberate design: a header that names the forbidden identifier "turns a meaningful audit into one that always reports a hit."
- **Fix:** Reworded the header to describe the merchant-side modules and the raw-SQL ban without repeating their literal names/tokens (e.g. "the merchant side's own read and write modules" instead of naming `queries.ts`/`messages.ts` by path; "raw SQL escape hatches" instead of naming `$queryRaw`/`$executeRaw`).
- **Files modified:** `src/server/admin/support.ts`
- **Verification:** Re-ran every acceptance-criteria grep from the plan; all return the required counts.
- **Committed in:** `78c5324`

### Documented, Not Fixed (pre-existing, out of scope)

**4. `variant="gold"` grep count is 10, not the plan's asserted 5 — pre-existing since before this plan started (also documented by 06-10 and 06-11)**

- Confirmed via `git stash`/restore that the count was already 10 at this plan's own starting commit (`ce9ee38`), before any Task 1/2/3 work. None of this plan's files contain the string `gold`. `tests/unit/dashboard-nav.test.ts`'s real contract test (the actual enforcement, not the plan's illustrative grep) passes at 685/685. Full detail in `deferred-items.md`.

**5. `ls src/components/support/` lists 5 files, not "exactly the four" Task 3's acceptance criteria names**

- `scroll-to-latest.tsx` was already present before this plan (shipped by 06-09 alongside the other three transcript components); it is a scroll-into-view helper, not a transcript-rendering component. This plan added zero new files to that directory — only edited `composer.tsx` in place — and reused `scroll-to-latest.tsx` unchanged on the admin thread page (§ C6 inherits A2's scroll-to-newest contract). No forking occurred. Full detail in `deferred-items.md`.

**6. `viewer="PLATFORM"` grep count on the thread page is 2, not the expected 1**

- The second occurrence is `<Composer viewer="PLATFORM" tenantId={tenantId} />` — a necessary consequence of deviation #1 above, not a fork. Full detail in `deferred-items.md`.

---

**Total deviations:** 6 (3 blocking-issue auto-fixes, 3 documented-not-fixed pre-existing/consequential grep-count discrepancies)
**Impact on plan:** Deviations 1 and 2 were required for the feature to actually work end-to-end (an admin reply with an attachment would otherwise fail silently at the last network call); deviation 3 and the three documented ones are cosmetic (comment wording, a pre-existing directory listing, a legitimate second call site) and change no behavior. No scope creep beyond what correctness required.

## Known Stubs

None. Every UI path built in this plan (inbox row → thread → read → reply, with or without attachments) is wired to real server logic backed by the tables `postMerchantMessage`/`postPlatformMessage` both write; nothing renders hardcoded or empty data. The one deliberately-inert piece — a `SYSTEM` message's `subscriptionClaimId` rendering plainly instead of as a claim card — is explicitly scoped to plans 06-15/06-16 by 06-UI-SPEC.md § C6 itself, not a stub this plan introduced.

## Threat Flags

| Flag | File | Description |
|------|------|--------------|
| threat_flag: new-endpoint | `src/app/api/upload/admin-thread-finalize/route.ts` | A new network endpoint not named in this plan's own `<threat_model>` register (T-06-54..T-06-59 cover the pages/actions Task 1-3's plan text anticipated, not this deviation-discovered finalize route). Mitigated identically to the adjacent, already-registered mint door: `requireAdminContext()` gates the request, and the body-supplied `tenantId` is validated against a real organization (`merchantExistsForAdmin`) before any storage read or Sharp derive pass, mirroring T-06-54's disposition on `sendPlatformMessage`'s own `tenantId`. |

## Verification

- `npm run lint && npm run typecheck && npm run test:unit && npm run build` — all green as of the final commit (`2ef9725`). `test:unit`: 685/685 passing, 42/42 files. `build` lists `/admin/support`, `/admin/support/[tenantId]`, and `/api/upload/admin-thread-finalize` among the built routes.
- `git diff --stat eslint.config.mjs` — empty, no change.
- `grep -ro 'variant="gold"' src/app src/components | wc -l` — returns 10, not the asserted 5; confirmed pre-existing (see Deviations #4 and `deferred-items.md`).
- Task-level acceptance-criteria greps (zone-import absence, `Promise.all`/`groupBy` counts, `tenantId` naming, `min-h-11`/`line-clamp-1` presence, `notFound`/`requireAdminContext` presence, read-before-mark line ordering, no SUB-03 line, no `/admin/subscriptions` link, both merchant-surface entry points wired) all pass as re-verified after the final commit.

## Issues Encountered

- **Worktree was spawned from a stale Phase 5.3 checkpoint (`d302801`), not a descendant of `ce9ee38`.** Fast-forwarded cleanly via `git merge --ff-only ce9ee38a97a25684615cdc4d7a06906b9dea247d` before any work began — zero unique commits existed on the worktree branch, so this was a pure, safe fast-forward with no conflict, matching the orchestrator's own briefing that this has happened to every prior executor in this session.
- **A block-comment `**/` sequence inside `src/server/admin/support.ts` prematurely closed the JSDoc comment it was inside**, producing a parse error (`';' expected`). Rewrote the offending sentence to avoid the literal `**/` substring (split `src/server/db/**` and `**/generated/prisma*` across word boundaries). Caught immediately by `npm run lint`.
- See Deviations #1 and #2 above for the two substantive, blocking gaps found and fixed.

## User Setup Required

None — no external service configuration required. All env vars were already present in `.env.local`/`.env.test` (copied from the main checkout as instructed).

## Next Phase Readiness

- ADM-05's core two-way loop is complete: a merchant writes, the owner sees it in the inbox, opens it, replies (with or without attachments), and the merchant's badge lights up on their next render.
- ADM-03's support-contact clause is satisfied by the inbox plus the per-thread page.
- **ADM-05 should NOT be marked fully "Complete" in REQUIREMENTS.md** — this plan does not touch the requirements table beyond what it verifiably completes. The in-app badge and email nudge exist and work in both directions, but SUB-03's subscription-claim card (06-15) and the suspend/restore notice path (06-14) are still outstanding pieces of the same requirement's full surface, per the orchestrator's own explicit instruction.
- Plan 06-14 (suspend/restore) can call `postSystemMessageAsAdmin(tenantId, body, { tx })` directly, inside its own `adminDb.$transaction`, to post the suspension/restoration notice atomically with the status write — the `AdminSupportWriteTx` parameter type this plan built exists for exactly that caller.
- Plan 06-15/06-16 (subscription claims) can call `postSystemMessageAsAdmin` the same way for confirm/reject notices, and their own admin-side receipt-upload UI can reuse `Composer`'s `viewer="PLATFORM"` mirror and the `subscriptions` mint/finalize namespace pair (06-11's mint door already accepts it; a `subscriptions`-kind finalize route is still 06-15/06-16's own work, following this plan's `admin-thread-finalize/route.ts` as the pattern).
- No blockers for downstream plans.

---
*Phase: 06-merchant-dashboard-platform-admin*
*Completed: 2026-09-14*

## Self-Check: PASSED

All 7 newly created key-files confirmed present on disk (`src/server/admin/support.ts`,
`src/server/admin/support-actions.ts`, `src/app/admin/support/page.tsx`,
`src/app/admin/support/loading.tsx`, `src/app/admin/support/[tenantId]/page.tsx`,
`src/app/admin/support/[tenantId]/loading.tsx`,
`src/app/api/upload/admin-thread-finalize/route.ts`). All four commits (`78c5324`, `b530ee9`,
`5bdb292`, `2ef9725`) confirmed present in `git log`.
