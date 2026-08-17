# Phase 2: Merchant Auth, Entitlements & Trial - Context

**Gathered:** 2026-08-17
**Status:** Ready for planning

<domain>
## Phase Boundary

A merchant logs into a dashboard whose tenant context comes solely from their authenticated session (not the hostname-based resolution Phase 1 built for storefronts). Their subscription tier and trial state are enforced server-side on every relevant write, not just hidden in the UI. Since no product features exist yet to meaningfully gate (catalog is Phase 3, templates are Phase 4), this phase's real job is building the *mechanism* — a plan-selection step, the entitlement-checking pattern, trial countdown/expiry behavior, and the dashboard login surface itself (deliberately left out of Phase 1's signup).

Covers: TEN-04, SUB-01, SUB-02, ONB-05.

</domain>

<decisions>
## Implementation Decisions

### Plan Selection at Signup

- **D-01:** A plan-selection step is inserted between Phase 1's signup form submission and the redirect to the new storefront: `signup form → plan selection → storefront`. Not a change to Phase 1's existing 3-field form.
- **D-02:** The plan-selection screen shows real price points and the full planned per-tier feature list from the v4.0 Master Specification (Section 4.4) — Starter 5,000 FCFA/mo, Business 12,500 FCFA/mo ("Most Popular"), Professional 25,000 FCFA/mo, all with a 10-day trial — even though most listed features (bulk import, discount codes, staff accounts, etc.) aren't built or enforced yet. Sets accurate expectations for what the merchant is eventually paying for; do not invent a slimmer feature list.
- **D-03:** No payment or payment-method capture happens at signup. This is purely a preference pick. Billing/subscribing is deferred entirely to end-of-trial (see D-09/D-10).
- **D-04:** Business is pre-highlighted as the recommended/"Most Popular" tier, matching v4.0's own positioning.
- **D-05:** The plan pick is mandatory — no "decide later" skip option. The merchant must choose one of the three tiers to proceed to their storefront.
- **D-06:** The plan choice is changeable during the trial. Build a plan-switch mechanism now as part of this phase's dashboard work (not deferred) — a merchant can change their trial tier before it ends.

### Entitlement Enforcement Scope

- **D-07:** Build the generic entitlement-checking mechanism (a `checkEntitlement(tenant, feature)`-style pattern) and prove it concretely on the one thing that's real this phase: staff-account and store limits (per v4.0's numbers — Starter: no staff accounts beyond owner, Business: up to 3, Professional: up to 10). Known future limits that belong to later phases (product count caps, discount-code access, etc.) get stubbed as registered-but-unenforced placeholders for Phase 3+ to wire in, not built out now.

### Trial Expiry Behavior

- **D-08:** When the 10-day trial ends without a confirmed subscription, the dashboard goes **read-only** — the merchant can still log in and see everything (orders, products, once those exist in later phases), but cannot create/edit/publish anything until they subscribe. Not a hard lockout.
- **D-09:** Conceptually, subscribing at end-of-trial reuses the same manual-payment-claim pattern already designed for customer→merchant payments (Section 5 of the original build plan), just with the payer/payee reversed: merchant transfers to EINORT's own Mobile Money/Orange Money account, submits a claim (transaction reference + optional screenshot), and the platform owner (Super Admin) confirms it manually.
- **D-10:** **However, Phase 2 does NOT build this subscribe-via-claim flow.** It depends on the payment-claim infrastructure (transaction-reference uniqueness, claim submission, audit trail) that belongs to Phase 3 (`ORD-01` through `ORD-05`), which doesn't exist yet. Phase 2's expired-trial state shows a placeholder ("Contact us to subscribe" or equivalent — exact copy is Claude's discretion) instead of a working claim form. The real subscribe flow gets built once Phase 3's payment-claim system exists to reuse, or in a dedicated later phase — not decided here, just explicitly out of Phase 2's scope.

### Trial Visibility in the UI

- **D-11:** A persistent, visible trial countdown/banner is shown in the dashboard the whole time the trial is active ("X days left in your trial").
- **D-12:** The banner escalates in urgency: neutral styling for most of the trial, shifting to a more urgent visual treatment (e.g. warning/red) in the final 1-2 days.
- **D-13:** No email reminder in this phase — dashboard banner only. Matches the already-documented low-priority status of transactional email (Resend) for V1 in the stack research.

### Claude's Discretion

- Exact visual treatment/threshold for the escalating urgency banner (what counts as "final 1-2 days" styling vs. neutral).
- Internal data-model specifics for how plan choice, trial start/end, and entitlement checks are represented (e.g. fields on Organization vs. a separate Subscription model) — follow whatever pattern research recommends, consistent with Phase 1's `scopedDb` conventions.

### Addendum — Resolving 02-RESEARCH.md's Open Questions

- **OQ-1 (blocking) & OQ-2:** Resolved via `.planning/phases/02-merchant-auth-entitlements-trial/pricing-reference.md`, which reconstructs the v4.0 Section 4.4 pricing/feature data from earlier in this project's planning conversation. `membershipLimit` (inclusive of the owner, per research finding #3) is Starter=1, Business=4, Professional=11.
- **OQ-3 (can an expired-trial merchant switch plans?):** No. D-06's plan-switch capability applies only during an *active* trial. Once expired, the only self-service action is the D-10 "contact us" placeholder — there is no in-app plan-switch path out of read-only in this phase, consistent with the real subscribe flow being deferred.
- **OQ-4 (contact channel for the D-10 placeholder):** A WhatsApp link — `https://wa.me/237686661578`. This is a real number the founder will need to actually monitor once merchants start hitting trial expiry, not a placeholder.
- **OQ-5 (suspended-tenant route):** Reuse Phase 1's existing pattern — a suspended organization is not a new route; the storefront resolver already treats "suspended" identically to "unclaimed" for the customer-facing side (Phase 1 D-05). For the *merchant's own dashboard* login, if their organization is suspended, the researcher/planner should decide the exact UX (e.g. reuse the same read-only treatment, or a distinct "account suspended" message) — Claude's discretion, but must not silently let a suspended merchant operate normally.
- **OQ-6 (check-slug throttling):** Claude's discretion — follow whatever rate-limit pattern Phase 1's `src/server/rate-limit.ts` already established for consistency, no new founder decision needed here.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project scope & requirements
- `.planning/PROJECT.md` — core value, constraints, key decisions
- `.planning/REQUIREMENTS.md` — full v1 requirement text for TEN-04, SUB-01, SUB-02, ONB-05
- `.planning/ROADMAP.md` — Phase 2 goal, success criteria, dependencies (depends on Phase 1)

### Phase 1 outputs (this phase builds directly on top of these)
- `.planning/phases/01-multi-tenant-foundations-domain-resolution/01-01-SUMMARY.md` through `01-07-SUMMARY.md` — the existing Better Auth setup (`src/server/auth/auth.ts`), `scopedDb`/`adminDb` data-access layer, signup flow (`src/app/signup/*`), and the locked English-copy decision. In particular, `01-06-SUMMARY.md` documents the Better Auth `organization`-as-tenant-primitive setup this phase's session-scoped dashboard auth must be consistent with, and `01-07-SUMMARY.md` notes `/signup` deliberately has no sign-in link yet — building that is this phase's job.

### Pricing/tier reference (not in-repo — external source document)
- `EINORT-Commerce_Master_Specification_v4.pdf`, Section 4.4 (uploaded by the user earlier in this project's planning conversation, not committed to the repo) — the authoritative source for the specific FCFA prices and per-tier feature lists referenced in D-02. If the researcher or planner needs the exact feature bullet lists beyond what's summarized in D-02/D-07, ask the user to re-supply this document rather than inventing feature lists.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/server/auth/auth.ts` — Better Auth instance with the `organization` plugin already configured; this phase's dashboard session/login work extends this, doesn't replace it.
- `src/server/db/tenant-scoped.ts`, `src/server/db/admin.ts`, `src/server/db/platform.ts` — the `scopedDb`/`adminDb`/`platformDb` data-access layer from Phase 1. New entitlement/trial/plan data must go through `scopedDb` per TEN-02's existing enforcement (extend `TENANT_SCOPED_MODELS` if new tenant-scoped tables are added).
- `src/lib/strings.ts` — centralized copy module (English, per the locked Phase 1 decision). New UI copy (plan-selection screen, trial banner, expired-trial placeholder) belongs here, not inline JSX literals.
- `prisma/schema.prisma` — `Organization` model already has `status` (NOT NULL, hand-corrected) and other Better-Auth-managed fields. Plan/trial data likely extends this model or adds a related one.

### Established Patterns
- Server actions with Zod validation (established in `src/server/auth/signup.ts`, `src/server/tenant/actions.ts`) — new entitlement-check and plan-switch actions should follow the same pattern.
- TDD RED/GREEN commit discipline, per-task atomic commits — established throughout Phase 1's execution.

### Integration Points
- New dashboard login flow connects to the existing Better Auth session/organization primitives.
- New plan-selection step inserts into the existing signup→storefront redirect flow in `src/app/signup/signup-form.tsx` (or wherever the post-submit redirect currently lives).

</code_context>

<specifics>
## Specific Ideas

- Plan-selection screen should read like a real pricing page (price, tier name, "Most Popular" badge on Business, feature list) even though it's gating nothing yet — this is explicitly about setting accurate expectations, not a placeholder screen.
- The trial-expiry "read-only" behavior should feel like Section 5's checkout design philosophy: never leave the merchant confused about their own state (in this case, why they suddenly can't edit something).

</specifics>

<deferred>
## Deferred Ideas

- The actual subscribe-via-claim flow (merchant pays EINORT via manual Mobile Money/Orange Money transfer + claim + Super Admin verification) — explicitly deferred past Phase 2, tied to Phase 3's payment-claim infrastructure existing first. Whichever phase builds it should re-read D-09/D-10 here.
- Email reminder for trial expiry — deferred, dashboard banner only for now.
- Full billing/invoice history, annual pricing toggle, and any other subscription-management depth beyond "pick a plan, see a countdown, go read-only at expiry" — out of scope for this phase.

None — discussion stayed within phase scope otherwise.

</deferred>

---

*Phase: 02-merchant-auth-entitlements-trial*
*Context gathered: 2026-08-17*
