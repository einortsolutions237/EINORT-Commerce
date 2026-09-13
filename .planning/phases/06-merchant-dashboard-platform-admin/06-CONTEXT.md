# Phase 6: Merchant Dashboard & Platform Admin - Context

**Gathered:** 2026-09-13
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase was defined and requirement-mapped during v1.0 but never planned or executed. It becomes milestone v2.0's foundation phase and executes first, because three later v2.0 phases depend on what it builds (Phase 8 migrates the dashboard surfaces this phase creates; Phase 13's MMKT-06 moderation page lives inside this phase's Super Admin; Phases 9-15 use the ADM-05 support thread as their only real notification channel).

Two halves:

1. **Merchant dashboard** — the Overview page's core content (orders with Payment Claims queue, products/inventory, basic sales numbers) is largely already delivered by quick task `260906-egn`'s dashboard rebuild; this phase's remaining merchant-facing work is mostly the new support-thread surface (a persistent nav item + a per-merchant conversation with the platform owner), not a rebuild of Overview itself. Confirm what `260906-egn` already satisfies before planning net-new dashboard work.
2. **Platform Super Admin** — a from-scratch build. Nothing exists yet under `src/app/**` or `src/server/**` for admin routes, merchant/store management, a cross-tenant payment-claims ledger, domain-status view, or the support-thread's platform side. Only the unscoped `adminDb` client facade (`src/server/db/admin.ts`) and the `User.platformRole` auth field exist as building blocks.

Explicitly NOT in scope: the full ~17-page Platform Admin surface from the Master Product Specification V3 design reference (analytics, fraud/abuse, theme library management, feature flags, broadcast notifications, full observability, usage dashboards) — that stays deferred per v2.0's own milestone decision (ADM-04). This phase builds exactly the pilot-sized list: merchant/store view + suspend, a global payment-claims ledger, a domain-status view, a support-contact/messaging surface, and the subscription-payment-claim flow that reuses it.

</domain>

<decisions>
## Implementation Decisions

### Super Admin surface identity
- **D-01:** A separate route tree with its own layout (e.g. `src/app/admin/**` or `src/app/(admin)/**`), not the merchant dashboard shell with an extra nav section. Admin-only code and layout stay out of the merchant dashboard bundle entirely.
- **D-02:** Visually distinct from the merchant dashboard — reuse the existing gold accent (already reserved in the design system as "a deliberate brand highlight, never generic") for admin chrome, plus a persistent "you are here" banner (e.g. "EINORT Platform Admin") given how consequential its actions (suspend, moderate) are.
- **D-03:** Reached only via an unlinked URL — no link anywhere in the merchant dashboard UI (deliberately more obscure than re-adding the removed header stub from `260907-a2v`; no discoverability risk at all).
- **D-04:** The platform owner's account is admin-only — `platformRole = "admin"` with no `Organization`/store of its own. No switching between a merchant dashboard and the Super Admin from the same account.
- **D-05:** Login flow is unchanged — same `/login` page as merchants (email/password via Better Auth), then post-auth routing sends `platformRole === "admin"` sessions to `/admin` instead of `/dashboard`. No second login page.
- **D-06:** A non-admin session hitting `/admin/*` sees an indistinguishable 404 — the same not-found page as a route that doesn't exist at all, not a "you don't have permission" page. Matches this codebase's existing fail-closed, ambiguous-on-purpose pattern (suspended/unknown tenants already resolve identically).

### Support messaging thread (ADM-05 / SUB-03's channel)
- **D-07:** Placement in the merchant dashboard: a persistent sidebar nav item (e.g. "Support" or "Messages"), same visual weight as Orders/Products, with an unread badge — not tucked into Settings, not gated behind the header bell alone.
- **D-08:** The Super Admin inbox is a flat list of every merchant thread, sorted unread/most-recent first — not grouped by urgency/reason category (no such taxonomy exists or is needed at pilot scale).
- **D-09:** A new message triggers both the in-app badge AND an email nudge — this is the first real wiring of `resend` (currently a declared dependency with zero send calls anywhere under `src/`).
- **D-10:** Attachments (files/images) are allowed on ANY message in the thread, not restricted to the payment-claim-submission flow — matches ADM-05's literal wording ("text plus file/image attachments"). Reuses the existing R2 upload pipeline.
- **D-11:** Unread indication is both a total-count badge at the inbox entry point AND a per-thread indicator in the flat list — both derive from the same unread-message query, so building one gets the other nearly free.
- **D-12:** A merchant's thread is one continuous conversation, never archived or closed — matches ADM-05's "persistent, per-merchant thread" wording. No thread-lifecycle UI to build.
- **D-13:** No canned/quick-reply templates for the owner in this phase — freeform typing only. Revisit if message volume grows past what a solo owner can handle by typing.

### Suspend action
- **D-14:** Suspending opens a confirm dialog with a REQUIRED reason field — the reason is logged (not just a plain "Are you sure?").
- **D-15:** Suspending automatically posts a message into that merchant's support thread containing the reason — reuses the thread built above; no separate notification system.
- **D-16:** A suspended merchant's dashboard login resolves to the existing branded `/suspended` page, dashboard otherwise fully inaccessible — reuses the fail-closed pattern `ARCHITECTURE.md` documents for the storefront ("an unknown, suspended, or non-existent tenant/organization all resolve identically... `/suspended` only when the caller's own session is bound to it"). Do not build a read-only dashboard mode for suspended merchants.
- **D-17:** Suspension is reversible from the same Super Admin control — a symmetric toggle (suspend when active, un-suspend when suspended). No separate reactivation flow, no "needs a manual DB fix" friction.

### Payment-claims ledger & domain status
- **D-18:** The global payment-claims ledger is one flat, sortable/filterable table across every tenant (merchant name as a column) — not grouped-by-merchant/expandable.
- **D-19:** Confirm/reject happens inline, directly from the ledger row — same one-tap pattern as the existing merchant-side Payment Claims queue (ORD-03). No jump into a per-merchant context required to act.
- **D-20:** Customer→merchant order-payment claims (Phase 3's existing `PaymentClaim` model) and merchant→platform subscription-payment claims (this phase's new SUB-03 flow) get TWO SEPARATE views/pages in the Super Admin — different actors and different consequences (confirming one releases an order; confirming the other extends a subscription). Do not build one combined table with a type-discriminator column.
- **D-21:** ADM-03's "domain status" requirement is satisfied as a column/section within the merchant/store list, NOT its own dedicated page — at this phase, only `{store}.einort.com` subdomains exist (custom domains are Phase 15, not yet built), so there is no real per-domain content to justify a separate page yet. Design the merchant-list column so Phase 15 has an obvious place to extend it later, without over-building a near-empty page now.

### Claude's Discretion
- Exact SUB-03 data model: whether the subscription-payment claim reuses/extends the existing `PaymentClaim` model with a discriminator, or is a new, separate model (e.g. `SubscriptionPaymentClaim`) tied to `Organization` rather than `Order`. Research should evaluate both against the existing claim pattern in `src/server/claims/**` (or wherever Phase 3's claim logic lives) and recommend one — this is an implementation detail, not a vision question.
- Exact `/admin` route naming and internal structure (`src/app/admin/**` vs. a route group like `src/app/(admin)/**`), and how `requireMerchantContext`'s sibling admin-auth check should be named/shaped — technical detail for planning.
- Exact confirmation of what quick task `260906-egn`'s dashboard Overview already satisfies against DASH-01/DASH-02's literal wording, so this phase's plan doesn't redundantly rebuild it — a research/planning task, not a discussion topic.
- Whether the merchant-list "suspend" action lives as a row action, a detail-page action, or both — left to UI-SPEC.
- Exact visual treatment of the gold accent + banner (banner copy, placement, whether it's a full-width top bar or a smaller badge near the Admin surface's own header) — left to UI-SPEC.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design reference
- `.planning/design-references/EINORT-COMMERCE-FRONT-END-MERCHANT-PLATFORM.md` — the locked blue/gold/zinc token system this phase's Super Admin surface must extend (gold as the deliberate, non-generic brand highlight, per D-02). Note this document's own "Canonical-source flag" section: it names this exact repo as the canonical source for Phases 3-6 dashboard/admin work.
- `.planning/design-references/EINORT-V3-MASTER-SPEC-AND-PROTOTYPE-V6.md` — registers the newer v6 snapshot of the same reference and the v2.0 milestone's scope decisions (Platform Admin explicitly deferred beyond this phase's pilot-sized list).

### Locked prior decisions this phase must honor, not re-litigate
- `src/server/auth/auth.ts` lines ~71-98 (`platformRole` additionalField, comment cites "C-8") — the single-owner Super Admin marker, `input: false` for security, default `"merchant"`, deliberately not the Better Auth `admin` plugin. "Nothing reads this in Phase 1; Phase 6 does." This phase is what makes that field load-bearing for the first time.
- `prisma/schema.prisma` `Organization.status` (NOT NULL, default `"active"`, `input: false`) — "suspension is a Phase 6 admin-only write." The suspend/un-suspend action this phase builds is the first writer of this column.
- `.planning/codebase/ARCHITECTURE.md` — Error Handling section: "an unknown, suspended, or non-existent tenant/organization all resolve identically (`null` → branded not-found, or `/suspended` only when the *caller's own* session is bound to it)" — the exact fail-closed behavior D-16 reuses for the dashboard-login case.
- `src/components/dashboard-header-controls.tsx` (comment near line 30) — notes the Super Admin Panel header stub removed in quick task `260907-a2v` "returns in Phase 6, gated on a real `User.platformRole` check." D-03 deliberately does NOT re-add this link (unlinked URL only) — record this as a considered deviation from that comment's expectation, not an oversight.
- `.planning/quick/260907-a2v-*/` — the removal of the ungated Admin Panel stub; the reasoning there (misleading to show every merchant a link to a surface with no real gating) is exactly what D-01/D-03/D-06 now solve for real.
- `.planning/PROJECT.md` — Active requirements list confirms the pilot-scoped Super Admin's exact boundary (merchants/stores list with suspend, payment-claims ledger view, domains, support contact — "not the full ~20-module admin surface from the design reference").

### Requirements this phase implements
- `.planning/REQUIREMENTS.md` — DASH-01, DASH-02, ADM-01, ADM-02, ADM-03, ADM-04, ADM-05, SUB-03 (see the "Platform Admin (Super Admin)" and "Subscriptions & Entitlements" sections).
- `.planning/ROADMAP.md` § "Phase 6: Merchant Dashboard & Platform Admin" — goal, success criteria, and the v2.0 reconciliation note explaining why this v1.0-mapped phase executes first in v2.0.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/server/db/admin.ts` (`adminDb`) — the unscoped, cross-tenant Prisma client facade, ESLint-fenced to `src/server/admin/**`. This phase is the first real consumer.
- `User.platformRole` (Better Auth `additionalFields`, `src/server/auth/auth.ts`) — already emitted into the schema and generated client; this phase writes the first code path that reads it.
- `Organization.status` (`prisma/schema.prisma`) — already NOT NULL with a default; this phase writes the first code path that sets it to anything other than `"active"`.
- The existing merchant-side Payment Claims queue (ORD-03, Phase 3) — one-tap confirm/reject UI pattern D-19 explicitly reuses for the global ledger.
- `src/server/images/r2.ts` / Sharp pipeline — the existing upload pattern the support thread's attachments (D-10) should reuse rather than building a second upload path.
- `next-themes`/Resend precedent: Resend (`resend` npm package) is a declared dependency in `src/env.ts` (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`, both optional) but zero send calls exist anywhere under `src/` today — D-09 is its first real use. Follow this project's established pattern for introducing a first-use of an already-declared-but-unwired dependency (verify the env vars are actually validated/optional-safe per `src/env.ts`'s existing shape).

### Established Patterns
- `merchantAction()` factory (`src/server/merchant/action.ts`) — the sanctioned pattern for gated dashboard Server Actions; the Super Admin needs its own equivalent (an `adminAction()`-shaped wrapper checking `platformRole === "admin"` instead of tenant/entitlement checks) rather than reusing `merchantAction` directly, since the trust model is different (platform-wide, not tenant-scoped).
- Fail-closed, ambiguous-on-purpose resolution (`resolveTenantBySlug`, `classifyHost`, `requireMerchantContext`) — D-06's indistinguishable-404 decision and D-16's suspended-session handling both extend this existing house style rather than inventing a new one.
- Single-sanctioned-writer pattern (`transition.ts` for `Order.state`) — likely the right shape for whichever module becomes the one place that writes `Organization.status` (suspend/un-suspend) and the one place that writes listing/claim confirmation state, consistent with this codebase's repeated "one module, one append-only event trail" convention.

### Integration Points
- The support thread (D-07 through D-13) is the ONLY real notification channel every later v2.0 phase (7 through 15) can rely on — per `ROADMAP.md`'s v2.0 reconciliation note. Build its data model and server actions with that downstream reuse in mind (e.g., a generic enough "post a system message into a merchant's thread" function that suspend (D-15), and later phases' own automated notices, can all call).
- Phase 13's MMKT-06 moderation page is explicitly planned to live inside this phase's Super Admin (`src/app/admin/**`) — this phase should leave that nav/route structure reasonably extensible, though building the moderation page itself is out of this phase's scope.

</code_context>

<specifics>
## Specific Ideas

No new visual reference screenshots were supplied for this phase specifically — the design direction (D-02's gold accent + banner) extends the already-locked merchant-platform design reference rather than introducing a new one.

The user's own framing on the admin/merchant separation: choosing "Admin-only account, no store" and "Unlinked URL only" together reflects a preference for the Super Admin to be a genuinely separate, low-discoverability control surface rather than a feature bolted onto the merchant experience — consistent with the existing `260907-a2v` removal of the ungated header stub.

</specifics>

<deferred>
## Deferred Ideas

- **The full ~17-page Platform Admin surface** (analytics, fraud/abuse, theme library management, feature flags, broadcast notifications, full observability, usage dashboards) from the Master Product Specification V3 design reference — explicitly deferred to a future milestone per v2.0's own scoping decision (see `PROJECT.md` "Explicitly deferred from this milestone").
- **Canned/quick-reply templates** for the support thread (D-13) — deferred, not rejected; revisit if message volume grows.
- **Grouped/categorized inbox** (D-08) — deferred in favor of a flat list; revisit only if the flat list stops scaling.
- **Domains as its own Super Admin page** (D-21) — deferred until Phase 15 (Custom Domains) actually ships real per-domain content worth a dedicated page.

### Reviewed Todos (not folded)
None — no pending todos matched this phase.

</deferred>

---

*Phase: 6-merchant-dashboard-platform-admin*
*Context gathered: 2026-09-13*
