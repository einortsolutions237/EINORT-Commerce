# Phase 1: Multi-Tenant Foundations & Domain Resolution - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-16
**Phase:** 1-multi-tenant-foundations-domain-resolution
**Areas discussed:** Subdomain selection at signup, Unrecognized hostname behavior, Root domain behavior

---

## Subdomain Selection at Signup

| Option | Description | Selected |
|--------|-------------|----------|
| Merchant types it at signup | Signup asks for a desired store name/slug directly, with live availability check | ✓ |
| Auto-generate, rename later | Slug auto-generated from email/random; renamed during Phase 4 onboarding | |
| You decide | Claude picks the default | |

**User's choice:** Merchant types it at signup.

| Option | Description | Selected |
|--------|-------------|----------|
| Live availability check | Check as they type/on blur, show taken/available inline | ✓ |
| Check on submit only | Validate server-side on form submit | |

**User's choice:** Live availability check.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, changeable later | Rename path in Phase 4 onboarding or dashboard settings | ✓ |
| Locked at signup | No rename path in V1 | |

**User's choice:** Yes, changeable later.

**Notes:** Explicitly modeled on Shopify's own signup pattern ("yourstore.myshopify.com").

---

## Unrecognized Hostname Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Branded "store not found" page | EINORT-branded page with link to root domain | ✓ |
| Generic 404 | Plain Next.js not-found page | |

**User's choice:** Branded "store not found" page.

| Option | Description | Selected |
|--------|-------------|----------|
| Same generic message | One message for both suspended and never-existed hostnames | ✓ |
| Distinct "temporarily unavailable" message | Suspended stores get their own message | |

**User's choice:** Same generic message — avoids revealing suspension status to anonymous visitors, keeps scope smaller.

---

## Root Domain Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal placeholder root page | Bare-bones page at einort.com; middleware knows root is never a tenant lookup | ✓ |
| No root page needed yet | Root not built at all in Phase 1 | |

**User's choice:** Minimal placeholder root page.

| Option | Description | Selected |
|--------|-------------|----------|
| Root domain (einort.com) | Signup/login/dashboard live on the root domain itself | ✓ |
| Dedicated subdomain (app.einort.com) | Merchant-facing app on its own reserved subdomain | |

**User's choice:** Root domain (einort.com).

---

## Claude's Discretion

- Exact reserved-slug list (api, admin, www, app, dashboard, mail, support, help, blog, status, docs, cdn, static, etc.)
- Exact slug format/validation rules (length, allowed characters, case normalization)
- Internal data model specifics for rename-safe hostname resolution (separate `Domain` table vs. slug column on `Tenant`) — deferred to ARCHITECTURE.md's existing guidance

## Deferred Ideas

- Full marketing/landing site at the root domain (placeholder only in Phase 1)
- Custom domain connection beyond the EINORT subdomain (already tracked as PLAT-V2-01)
- Distinct "temporarily unavailable" messaging for suspended stores (explicitly deferred by decision, not just out of scope by default)
