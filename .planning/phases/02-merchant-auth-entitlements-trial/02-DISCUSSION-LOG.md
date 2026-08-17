# Phase 2: Merchant Auth, Entitlements & Trial - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-17
**Phase:** 2-merchant-auth-entitlements-trial
**Areas discussed:** Plan selection at signup, What entitlements actually get enforced, Trial expiry behavior, Trial visibility in the UI

---

## Plan Selection at Signup

| Option | Description | Selected |
|--------|-------------|----------|
| Default everyone to Professional | No plan-choice screen, auto-default | |
| Add a plan-selection step to onboarding | New screen after signup | ✓ |

**User's choice:** Add a plan-selection step, between signup form submission and the storefront redirect.

| Option | Description | Selected |
|--------|-------------|----------|
| Price + full v4.0 feature list per tier | Real planned feature differences shown | ✓ |
| Price only, minimal copy | No specific feature claims | |

**User's choice:** Full v4.0 feature list.

| Option | Description | Selected |
|--------|-------------|----------|
| No payment at signup | Preference pick only | ✓ |
| Capture payment intent now | Lightweight payment-method capture | |

**User's choice:** No payment at signup — billing deferred to end-of-trial.

| Option | Description | Selected |
|--------|-------------|----------|
| Highlight Business | "Most Popular" badge | ✓ |
| All three neutral | No default nudge | |

**User's choice:** Highlight Business.

| Option | Description | Selected |
|--------|-------------|----------|
| Mandatory pick | Must choose one of three | ✓ |
| Skippable, defaults to Business | "Decide later" option | |

**User's choice:** Mandatory pick.

| Option | Description | Selected |
|--------|-------------|----------|
| Locked for this phase | No plan-switching UI yet | |
| Changeable, build a switch option now | Plan-switch mechanism built this phase | ✓ |

**User's choice:** Changeable — build a switch option now.

---

## What Entitlements Actually Get Enforced

| Option | Description | Selected |
|--------|-------------|----------|
| Build the mechanism only, prove it on staff/store limits | Generic pattern + one concrete proof point | ✓ |
| Build the mechanism, enforce nothing concrete yet | Pure infrastructure, nothing gated live | |

**User's choice:** Build the mechanism, prove it on staff/store limits.

---

## Trial Expiry Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only dashboard | Can log in and view, can't edit/publish | ✓ |
| Locked out entirely | Login itself blocked | |

**User's choice:** Read-only dashboard.

| Option | Description | Selected |
|--------|-------------|----------|
| Same manual-claim pattern, merchant→platform | Reuses the customer-payment-claim design, reversed | ✓ |
| Fully manual, off-platform for now | Founder handles personally, flips a flag | |

**User's choice:** Same manual-claim pattern, merchant→platform — conceptually.

| Option | Description | Selected |
|--------|-------------|----------|
| Defer the subscribe flow itself to later | Placeholder only in Phase 2; real flow waits for Phase 3's payment-claim infra | ✓ |
| Build a minimal claim flow now, ahead of Phase 3 | Duplicate a small version of the pattern early | |

**User's choice:** Defer the subscribe flow itself — real implementation waits for Phase 3+.

---

## Trial Visibility in the UI

| Option | Description | Selected |
|--------|-------------|----------|
| Visible countdown/banner | Persistent "X days left" indicator | ✓ |
| Invisible until it expires | No countdown shown | |

**User's choice:** Visible countdown/banner.

| Option | Description | Selected |
|--------|-------------|----------|
| Escalating urgency | Neutral early, urgent styling near expiry | ✓ |
| Same treatment throughout | Consistent styling for all 10 days | |

**User's choice:** Escalating urgency.

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard banner only | No email reminder this phase | ✓ |
| Add an email reminder too | Build a trial-ending email notification | |

**User's choice:** Dashboard banner only.

---

## Claude's Discretion

- Exact copy for the expired-trial placeholder
- Exact visual threshold/treatment for escalating urgency banner
- Internal data-model specifics for plan/trial/entitlement representation

## Deferred Ideas

- The actual subscribe-via-claim flow (merchant pays EINORT) — deferred past Phase 2, depends on Phase 3's payment-claim infrastructure
- Email reminder for trial expiry
- Billing/invoice history, annual pricing toggle, other subscription-management depth
