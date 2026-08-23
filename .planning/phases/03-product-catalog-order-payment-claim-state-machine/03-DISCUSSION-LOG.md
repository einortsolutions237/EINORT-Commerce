# Phase 3: Product Catalog & Order/Payment-Claim State Machine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-23
**Phase:** 03-product-catalog-order-payment-claim-state-machine
**Areas discussed:** Order state machine × checkout path, Product catalog structure, Payment claim & dispute handling, Merchant payment info & USSD tap-to-dial

---

## Order state machine × checkout path

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, always creates an Order record | Order Placed created before opening the WhatsApp deep link | ✓ |
| No, WhatsApp orders are external only | Just a deep link, no Order row | |

**User's choice:** Yes, always creates an Order record.

| Option | Description | Selected |
|--------|-------------|----------|
| Skip straight to Confirmed | Payment Pending/Payment Claimed are manual-transfer-only states | ✓ |
| Still pass through Payment Pending | All paths sit in Payment Pending as a generic "awaiting action" state | |

**User's choice:** Skip straight to Confirmed.

| Option | Description | Selected |
|--------|-------------|----------|
| Only from a rejected payment claim | Disputed = "claimed payment that didn't check out" | ✓ |
| Also reachable after Confirmed/Fulfilled | Broader complaint/chargeback mechanism | |

**User's choice:** Only from a rejected payment claim.

| Option | Description | Selected |
|--------|-------------|----------|
| Decrement at Order Placed; release on Disputed | Oversell-proof from the moment of order placement | ✓ |
| Decrement only at Confirmed | Simpler, but allows oversell during the pending window | |

**User's choice:** Decrement at Order Placed; release on Disputed.

---

## Product catalog structure

| Option | Description | Selected |
|--------|-------------|----------|
| Full matrix, capped small | Up to 2 option axes, each combination its own variant | ✓ |
| Single axis only | One option type per product | |

**User's choice:** Full matrix, capped small (~2 axes).

| Option | Description | Selected |
|--------|-------------|----------|
| Merchant-defined, free-form | Each merchant creates their own tenant-scoped category list | ✓ |
| Fixed platform taxonomy | Shared category list across all merchants | |

**User's choice:** Merchant-defined, free-form.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, build it now in Phase 3 | R2 + Sharp pipeline built now, Phase 4 reuses it | ✓ |
| Simpler interim path in Phase 3 | Minimal upload now, full pipeline later in Phase 4 | |

**User's choice:** Yes, build it now in Phase 3.

| Option | Description | Selected |
|--------|-------------|----------|
| Deactivate only, no hard delete | Preserves historical order/variant references | ✓ |
| Allow hard delete | Requires deciding what happens to referencing orders | |

**User's choice:** Deactivate only, no hard delete.

| Option | Description | Selected |
|--------|-------------|----------|
| Still shown, disabled | Out-of-stock items stay visible with a disabled add-to-cart | ✓ |
| Hidden entirely | Out-of-stock items disappear from the storefront | |

**User's choice:** Still shown, disabled.

| Option | Description | Selected |
|--------|-------------|----------|
| Small capped gallery + first-is-primary | ~5 images, first uploaded is the hero image | ✓ |
| Single image only | No gallery concept | |

**User's choice:** Small capped gallery + first-is-primary.

---

## Payment claim & dispute handling

| Option | Description | Selected |
|--------|-------------|----------|
| Merchant gives a reason; customer can resubmit | Disputed is recoverable, not terminal | ✓ |
| Dead end — contact merchant directly | Disputed is terminal from the app's perspective | |

**User's choice:** Merchant gives a reason; customer can resubmit.

| Option | Description | Selected |
|--------|-------------|----------|
| Unguessable order-tracking link | Long random token, no login, sent via WhatsApp | ✓ |
| Phone number + order number lookup | Requires a lookup form and rate-limiting | |

**User's choice:** Unguessable order-tracking link.

| Option | Description | Selected |
|--------|-------------|----------|
| In-app badge/count only | No email/SMS, consistent with Resend deprioritized | |
| Also send a WhatsApp/email nudge | Initial answer, before the WhatsApp API cost/complexity was flagged | ✓ (superseded) |
| Email only for now | Resend email, no WhatsApp | |
| Email now, WhatsApp Business API later | Explicit fast-follow flag | ✓ |
| I want WhatsApp now — let's scope it | Would require a dedicated scoping discussion | |

**User's choice:** "Also send a WhatsApp/email nudge" initially, then — after being told that proactive WhatsApp messaging requires the paid WhatsApp Business API with business verification (not a `wa.me` link) — refined to "Email now, WhatsApp Business API later."
**Notes:** This is the one area where a follow-up clarifying question changed the answer after a real technical constraint was surfaced mid-discussion.

---

## Merchant payment info & USSD tap-to-dial

| Option | Description | Selected |
|--------|-------------|----------|
| Simple settings field in Phase 3 | Minimal payment-settings surface built now | ✓ |
| Block checkout until Phase 4 ships this | Delays one of three required checkout paths | |

**User's choice:** Simple settings field in Phase 3.

| Option | Description | Selected |
|--------|-------------|----------|
| I know the codes — let me give them | User supplies the real USSD format directly | |
| Research it before planning | Flag as blocking research item; manual-copy fallback ships regardless | ✓ |

**User's choice:** Research it before planning.
**Notes:** Resolves the pre-existing blocker noted in `.planning/STATE.md`'s Blockers/Concerns section (MTN MoMo / Orange Money USSD merchant-code strings need re-verification against official Cameroon operator docs).

| Option | Description | Selected |
|--------|-------------|----------|
| Both, customer picks | Merchant configures both MTN and Orange numbers | ✓ |
| One operator only | Single receiving number/operator | |

**User's choice:** Both, customer picks.

| Option | Description | Selected |
|--------|-------------|----------|
| No verification, accepted as-entered | Matches the manual-claim system's existing trust model | ✓ |
| Require a verification step | SMS/verification-code confirmation | |

**User's choice:** No verification, accepted as-entered.

---

## Claude's Discretion

- Exact stock/variant schema shape (implicit "Default" variant for no-option products)
- Exact phone-number format validation for the payment-settings field
- Exact order-tracking token generation scheme (length, character set, expiry)
- Exact UX wording/flow for the rejection-reason field and resubmission form
- Exact image-reordering UI for picking a different primary/hero image

## Deferred Ideas

- Proactive WhatsApp Business API messaging to merchants for new claims (post-pilot fast-follow)
- SMS/verification-code confirmation of merchant payment numbers (revisit only if fraud becomes a real problem)
- Fixed/shared platform category taxonomy (only relevant if cross-tenant search/discovery is ever built)
- Hard delete for products (no identified need strong enough to justify)
