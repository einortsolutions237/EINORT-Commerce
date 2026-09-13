# Phase 6: Merchant Dashboard & Platform Admin - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-13
**Phase:** 6-merchant-dashboard-platform-admin
**Areas discussed:** Super Admin surface identity, Support thread placement & UX, Suspend action — confirmation & messaging, Payment-claims ledger — cross-tenant view design

---

## Super Admin surface identity

| Option | Description | Selected |
|--------|-------------|----------|
| Separate route + layout | A distinct /admin route tree with its own shell | ✓ |
| Same dashboard shell, extra nav section | Reuses the merchant dashboard layout with an Admin nav group | |

| Option | Description | Selected |
|--------|-------------|----------|
| Distinct accent/banner | A clear visual signal so it's unmistakable which mode you're in | ✓ |
| Same styling, just labeled "Admin" | No new visual treatment | |

| Option | Description | Selected |
|--------|-------------|----------|
| Re-add the header link, now correctly gated | Visible link rendered only for platformRole="admin" | |
| Unlinked URL only | No link anywhere in the merchant UI | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| Admin-only account, no store | platformRole="admin" with no Organization of its own | ✓ |
| Same account also runs a store | Blurs the admin/merchant boundary | |

| Option | Description | Selected |
|--------|-------------|----------|
| Same /login, route by role after auth | Reuses the existing Better Auth login flow | ✓ |
| Separate /admin/login page | A distinct login page for the admin account | |

| Option | Description | Selected |
|--------|-------------|----------|
| Indistinguishable 404 | Doesn't confirm the admin surface exists to a prober | ✓ |
| A "you don't have permission" page | Confirms the route exists but denies access | |

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse the existing gold accent | Already reserved as a deliberate brand highlight | ✓ |
| A new caution tone (amber/red) | A color never used elsewhere | |

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, persistent banner | An always-visible reminder of context | ✓ |
| No, the accent color is enough | Skip the banner | |

**User's choice:** A fully separate, low-discoverability Super Admin — its own route/shell, gold accent + persistent banner, unlinked URL, admin-only account, same login page routed post-auth, indistinguishable 404 for non-admins.
**Notes:** The unlinked-URL choice deliberately deviated from the recommended option (re-adding the removed header stub). Reflects a preference for the Super Admin to be a genuinely separate, low-discoverability control surface, consistent with the reasoning behind quick task 260907-a2v's removal of the ungated stub.

---

## Support thread placement & UX

| Option | Description | Selected |
|--------|-------------|----------|
| Persistent nav item | A Support/Messages entry in the sidebar, always visible, unread badge | ✓ |
| Notification-bell slide-over | Triggered from the existing header bell icon | |
| Inside Settings | Tucked under a Settings tab | |

| Option | Description | Selected |
|--------|-------------|----------|
| Flat list, unread/recent first | One list sorted by recent activity | ✓ |
| Grouped by urgency/reason | Threads bucketed by category | |

| Option | Description | Selected |
|--------|-------------|----------|
| Email nudge too | First real use of Resend | ✓ |
| In-app badge only, no email | Skips wiring Resend for now | |

| Option | Description | Selected |
|--------|-------------|----------|
| Attach anywhere in the thread | Matches ADM-05's stated requirement literally | ✓ |
| Only on payment-claim submissions | Narrower than ADM-05 as written | |

**User's choice:** Persistent sidebar nav item, flat unread-first inbox, email nudge wired to Resend, attachments allowed on any message.
**Notes:** Initially selected "Only on payment-claim submissions" for attachments; on a reconciliation follow-up question pointing out this narrows ADM-05's literal wording ("text plus file/image attachments"), the user corrected to "allow attachments everywhere in the thread." Recorded as the final decision (D-10).

Follow-up round:

| Option | Description | Selected |
|--------|-------------|----------|
| Both (total badge + per-thread) | Standard inbox pattern | ✓ |
| Per-thread only, no total badge | Simpler | |

| Option | Description | Selected |
|--------|-------------|----------|
| One continuous thread, never closed | Matches ADM-05's "persistent" wording | ✓ |
| Can be archived | Adds a lifecycle affordance | |

| Option | Description | Selected |
|--------|-------------|----------|
| Freeform only for now | No canned-response system | ✓ |
| Include canned/quick replies | A small template system | |

---

## Suspend action — confirmation & messaging

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm dialog with a required reason | Logged, can be surfaced to the merchant | ✓ |
| Plain confirm dialog, no reason field | Faster, no record of why | |

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, via an automatic thread message | Reuses the support thread | ✓ |
| No automatic message | Merchant discovers it by hitting the block | |

| Option | Description | Selected |
|--------|-------------|----------|
| A branded /suspended page, dashboard inaccessible | Reuses the existing fail-closed pattern | ✓ |
| Read-only dashboard with a suspension banner | More visibility, bigger gating surface | |

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, same Super Admin control, toggle back to active | Symmetric, no separate flow | ✓ |
| One-way, needs manual DB fix | Deliberately hard to reverse | |

**User's choice:** Required-reason confirm dialog, automatic thread notification, existing /suspended page reused, symmetric reversible toggle.
**Notes:** All recommended options selected without deviation.

---

## Payment-claims ledger — cross-tenant view design

| Option | Description | Selected |
|--------|-------------|----------|
| One flat, sortable/filterable table | Easier to scan across merchants at pilot scale | ✓ |
| Grouped by merchant (expandable list) | Merchant-first navigation | |

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm/reject directly from the ledger | Same one-tap pattern as ORD-03 | ✓ |
| Jump into the merchant's context to act | More clicks, single locus of confirmation logic | |

| Option | Description | Selected |
|--------|-------------|----------|
| Two separate views | Different actors, different consequences | ✓ |
| One combined ledger with a type column | Fewer pages, mixes two action types | |

| Option | Description | Selected |
|--------|-------------|----------|
| Section within the merchant/store list | Only subdomains exist until Phase 15 | ✓ |
| Its own dedicated page | Gives Phase 15 room to extend, mostly empty for now | |

**User's choice:** Flat sortable table, inline confirm/reject, order-claims and subscription-claims kept as two separate views, domain status as a merchant-list column.
**Notes:** All recommended options selected without deviation.

---

## Claude's Discretion

- Exact SUB-03 data model (extend `PaymentClaim` with a discriminator vs. a new `SubscriptionPaymentClaim` model) — left to research/planning.
- Exact `/admin` route naming/structure and the admin-auth-check equivalent of `merchantAction()`.
- Confirming what quick task `260906-egn` already satisfies against DASH-01/DASH-02's literal wording, before planning any redundant rebuild.
- Whether "suspend" is a row action, a detail-page action, or both.
- Exact visual treatment of the gold accent + banner (copy, placement, full-width bar vs. smaller badge).

## Deferred Ideas

- The full ~17-page Platform Admin surface (analytics, fraud/abuse, theme library, feature flags, broadcast notifications, observability, usage dashboards) — deferred to a future milestone per v2.0's own scoping decision.
- Canned/quick-reply templates for the support thread — revisit if message volume grows.
- Grouped/categorized inbox — revisit only if the flat list stops scaling.
- Domains as its own dedicated Super Admin page — revisit once Phase 15 ships real custom-domain content.
