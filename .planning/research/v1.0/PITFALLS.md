# Pitfalls Research

**Domain:** Multi-tenant commerce storefront-builder SaaS (Cameroon-first, manual-payment-claim checkout, custom Next.js/Prisma commerce layer, block-based template system, solo 30-day AI-assisted build)
**Researched:** 2026-08-16
**Confidence:** MEDIUM-HIGH (tenant isolation, subdomain routing, and inventory-race patterns are well-documented and verified against multiple sources; manual-payment-fraud and "AI-generic-template" findings are MEDIUM — synthesized from adjacent domain reporting, not EINORT-specific case studies)

## Critical Pitfalls

### Pitfall 1: Cross-tenant data leak via forgotten or client-trusted tenant scoping

**What goes wrong:**
A query somewhere — a raw SQL query, a background job, an export, a cache read, an admin "view as merchant" feature, a newly-added API route written late at night on day 22 — omits the `WHERE tenantId = ?` filter, or worse, trusts a `tenantId` sent by the client (query param, hidden form field, JWT claim the server doesn't re-verify) instead of deriving it server-side from the authenticated session/hostname. One merchant sees, edits, or (worst case) deletes another merchant's products, orders, or payment claims.

**Why it happens:**
On a solo/fast build, tenant scoping is usually added correctly to the "main path" (products, orders) early, then forgotten on routes added later under time pressure — notification jobs, CSV-ish exports, the Super Admin surface, a quick debug endpoint. Prisma has no built-in per-model tenant guard; every model access is a manual opt-in unless middleware/extension enforces it. Connection pooling (PgBouncer/Prisma) can also silently reuse a session variable meant for tenant-scoped Postgres RLS across requests if session state isn't reset per query.

**How to avoid:**
- Every tenant-scoped Prisma model gets `tenantId` as an indexed column from the first migration (already a stated requirement — keep it non-negotiable).
- Use a single Prisma Client extension/middleware that injects the tenant filter automatically for every read/write on tenant-scoped models, so no hand-written query can "forget" it — the escape hatch (raw queries, admin cross-tenant views) must be an explicit, named, reviewed exception, not the default.
- Derive `tenantId` server-side only: from the resolved hostname/subdomain (storefront requests) or from the authenticated session (dashboard requests). Never read it from a request body, query string, or unverified header.
- Add Postgres Row-Level Security as a second independent layer (defense in depth), not a replacement for app-level filtering — RLS alone has had real CVEs where subqueries/optimizer stats leaked rows.
- Write an automated test suite pattern: seed Tenant A data, authenticate as Tenant B, assert every list/detail/export endpoint returns empty/403. Run this on every deploy, not just once.

**Warning signs:**
- Any route handler that takes `tenantId` as a parameter instead of computing it internally.
- Any `findMany`/`findFirst` call without a visible tenant filter in the same file.
- Background jobs (notification sends, payment-claim reminders) that receive an `orderId` alone and re-derive tenant from the order row without re-validating that the caller is scoped to that tenant.
- No test ever creates two tenants in the same test run.

**Phase to address:**
Foundational/schema phase (tenant-indexed schema + enforcement middleware must exist before any feature is built on top of it), then re-verified explicitly at the end of every subsequent phase that adds new data access paths (dashboard, admin, notifications).

---

### Pitfall 2: Subdomain/hostname routing edge cases open cross-tenant or platform-level holes

**What goes wrong:**
A merchant registers a business name that resolves to a reserved word (`api`, `www`, `admin`, `app`, `assets`, `dashboard`) as their subdomain slug, and traffic meant for the platform's own infrastructure gets routed through the tenant storefront layout — or vice versa, a tenant's storefront becomes unreachable because it collides with a platform route. Separately, auth cookies set without an explicit `Domain` scope default to being shared across all subdomains, letting a logged-in merchant's dashboard session (or worse, Super Admin session) leak into a storefront subdomain context, or letting one tenant's cached hostname→tenant lookup serve stale data after a merchant is suspended or renamed.

**Why it happens:**
Subdomain-based multi-tenancy in Next.js is implemented in middleware that pattern-matches the `Host` header — this is easy to get "basically working" for the happy path (valid, unique, alphanumeric slugs) and easy to leave unhardened against the edge cases, because they don't show up until someone deliberately or accidentally hits them.

**How to avoid:**
- Reserve a hard-coded blocklist of subdomain slugs (`api`, `www`, `admin`, `app`, `dashboard`, `assets`, `cdn`, `mail`, `static`, `status`, plus the platform's own product name variants) and enforce it at signup/slug-selection time, not just in middleware.
- Enforce slug format (lowercase alphanumeric + hyphen, length capped well under the 63-char DNS label limit) at the database constraint level, not just client-side validation.
- Set auth cookies with an explicit, narrow `Domain` (or better, keep merchant-dashboard and Super Admin auth on a separate non-wildcard host, e.g. `app.einort.com` / `admin.einort.com`, entirely separate from `{tenant}.einort.com` storefront hosts) so no cookie set for one context is readable from another.
- Cache hostname→tenant lookups with short TTL or explicit invalidation on suspend/rename/delete — a suspended merchant's storefront must stop resolving promptly, not "eventually."
- Serve a proper branded 404/"store not found" page for unmatched subdomains, not a generic framework error or (worse) a blank storefront shell.

**Warning signs:**
- No explicit reserved-slug list exists anywhere in the codebase.
- Cookies inspected in devtools show no `Domain` attribute or a wildcard-parent `Domain`.
- Deleting/suspending a tenant in the admin panel doesn't immediately affect what the storefront subdomain shows.

**Phase to address:**
Multi-tenant foundations phase, alongside tenant-schema work — hostname resolution and auth-cookie scoping are architectural decisions, expensive to retrofit once dashboard and storefront auth are both live.

---

### Pitfall 3: Manual payment-claim flow becomes a fraud and trust liability

**What goes wrong:**
Because there's no live payment gateway, the system's entire notion of "this order is paid" rests on a merchant manually eyeballing a transaction reference and/or screenshot and clicking confirm. This is exploitable in multiple directions: a customer submits a fake or reused transaction reference (or a real reference from a smaller unrelated transfer) hoping a busy merchant rubber-stamps it; a customer submits a doctored screenshot; a customer reuses the same real transaction reference against two different orders (double-spend against the claim system since there's no PSP to detect it); or the merchant, trusting the "I've paid" state, ships/fulfills before actually checking their Mobile Money app, then discovers no money arrived. On the flip side, an untrustworthy or careless merchant could mark a claim "confirmed" without verifying, or (harder to prevent in a manual system) simply never respond, leaving a customer stuck in permanent "payment being confirmed" limbo with no recourse.

**Why it happens:**
Manual verification shifts 100% of fraud-detection work onto a busy, non-specialist merchant with no tooling beyond "does this look right." This is a known weak point even in markets with mature banking rails (fake proof-of-payment fraud is a well-documented problem for manual EFT acceptance); it's structurally harder in a Mobile Money context where transaction references are short alphanumeric strings that are easy to fabricate plausibly.

**How to avoid:**
- Make the transaction reference field **unique per tenant** at the database level (a claimed reference cannot be submitted twice against the same store) — this alone kills the cheapest reuse attack.
- Show the merchant, at claim-review time, exactly what to cross-check (amount, reference format for MTN vs Orange, timestamp window) rather than a bare "confirm/reject" button — reduce the cognitive load of manual verification.
- Default new orders to a hard, visible SLA on the "Payment Pending"/"Payment Claimed" state (e.g., auto-flag claims un-reviewed after N hours) so customers aren't silently ghosted and merchants can't quietly ignore fraud-suspicious claims.
- Treat the screenshot upload as evidence only, never as proof — never auto-confirm based on an uploaded image; it is a human-review aid, not a verification mechanism.
- Log every claim decision (who, when, what reference, approve/reject) immutably — this is the platform's only fraud-forensics trail in a no-PSP world, and it's also what protects the platform when a merchant/customer dispute escalates.
- Rate-limit claim submission per order/customer to prevent someone hammering the same order with different fake references hoping one slips through during a busy period.

**Warning signs:**
- Transaction reference field has no uniqueness constraint.
- No audit log of claim approve/reject decisions.
- No merchant-facing guidance on what a legitimate MTN/Orange transaction reference looks like.
- Customers report "confirmed but never shipped" or "shipped but I never got confirmation" — signals the state machine's edges aren't watertight.

**Phase to address:**
Order/payment-claim phase — this is arguably the single highest-trust-risk feature in the product (it's the moment money is asserted to have moved) and deserves its own hardening pass distinct from "build the order state machine happy path."

---

### Pitfall 4: Inventory oversell / stock race conditions around the payment-claim window

**What goes wrong:**
Because payment confirmation is asynchronous and manual (potentially minutes to hours after "Order Placed"), stock can be oversold in the gap: two customers place orders for the last unit before either payment is claimed/confirmed, or a merchant manually edits stock while an order is mid-flight. Classic read-modify-write races (`stock = 1`, two requests both read `1`, both decrement, both "succeed") are made worse here because the "hold" window is much longer than a typical instant-checkout flow — it's not milliseconds, it's however long a customer takes to open Mobile Money and pay.

**Why it happens:**
Simple stock decrement logic (`UPDATE products SET stock = stock - 1 WHERE id = ?` without a stock-floor guard, or worse, decrement-on-confirm rather than decrement-on-placement) looks correct in single-user testing and breaks only under concurrent load or long pending-payment windows — exactly the conditions a real launch produces and a solo dev's manual testing doesn't.

**How to avoid:**
- Decide explicitly (and document) when stock is decremented: at "Order Placed" (reserve immediately, release on cancel/timeout) is the safer default for a manual-payment flow with a long pending window, versus at "Confirmed" which risks overselling to whoever pays first among several placed orders.
- Use an atomic, conditional update (`UPDATE ... SET stock = stock - 1 WHERE id = ? AND stock > 0`, checking rows-affected) rather than read-then-write, for every stock mutation.
- Add a reservation TTL: an "Order Placed"/"Payment Pending" order that never reaches a claim within a set window (e.g., 24-48h) should release its stock hold automatically.
- This matters more, not less, given the low-stock-count reality of small Cameroonian merchants (a "simple stock count" per the requirements) — a single-digit stock item is exactly where a race condition becomes visible and embarrassing fast.

**Warning signs:**
- Stock decrement logic reads current stock in one query and writes in a separate query/statement.
- No status/timeout path exists for orders stuck in "Payment Pending" indefinitely.
- No test simulates two near-simultaneous orders against a 1-unit-stock product.

**Phase to address:**
Product catalog + order-placement phase, verified again when the payment-claim state machine is built (the two features interact directly).

---

### Pitfall 5: Block-based template recombination produces visually generic, "templatey" storefronts despite the premium-design goal

**What goes wrong:**
The plan to hit ~20 visually distinct storefronts by recombining a small flagship set through a Theme→Page→Section→Block system is architecturally sound, but the most common failure mode of that approach is that "distinct" collapses to "same layout, different accent color" — merchants and visitors immediately perceive the storefronts as instances of one template, not as bespoke-feeling stores, which directly undermines the stated core value ("looks like it cost them money to build"). This is the same failure mode widely reported for AI-assisted and template-driven site builders generally: modular components + swapped color tokens + swapped stock photography reads as generic no matter how clean the code architecture is, because differentiation was never designed at the layout/rhythm/typography-pairing/photography-direction level — only at the theme-token level.

**Why it happens:**
Block systems are optimized for engineering reuse (one component, many configurations), which is exactly the opposite axis from visual distinctiveness (which comes from spacing rhythm, type scale, image treatment, section ordering, density, and motion — decisions that are expensive to vary and easy to leave defaulted). Under 30-day solo pressure, the flagship gets real design attention and the other 5-6 segment variations get "swap the palette and logo" treatment because that's what's fast.

**How to avoid:**
- Explicitly define, per segment-flagship (not per store), a distinct **layout skeleton** — not just a color palette: different hero section types (full-bleed image vs. grid vs. editorial split), different product-grid density, different type pairing, different section ordering — so segment variation is a real design decision made ~5-6 times (once per flagship), not skipped.
- Within a flagship, individual merchant storefronts should vary by content (their own photography, copy, brand color extracted from their logo) — this is legitimate personalization, not fake distinctiveness — but different *flagships* (fashion vs. electronics vs. grocery) must differ structurally, not just chromatically, or the "~20 distinct variations" claim doesn't hold up to a user actually clicking through several of them back to back.
- Treat placeholder/stock imagery as a known genericness trap: a merchant who hasn't uploaded real product photos yet will make even a well-designed template look like a demo. Design explicit "empty state" visual treatments (not blank gray boxes) so early-stage merchant stores still look intentional.
- Budget real design-review time against 2-3 flagships minimum before declaring the pattern library "done" — validate distinctiveness by placing screenshots of two flagships side by side and asking "would a stranger think these are the same product?"

**Warning signs:**
- Segment variations differ only in a `theme.json`/CSS-variable color and font swap with identical component tree and section order.
- No one has looked at two different flagship storefronts side-by-side at the same zoom level before calling the template system done.
- Section library grows by "add a settings option to the existing hero" rather than "this segment needs a structurally different hero."

**Phase to address:**
Template/theme-system phase — specifically the point where the flagship pattern library is generalized into the section/block system for the remaining segments; this is the single highest design-risk phase per the project's own stated priorities and deserves an explicit distinctiveness checkpoint, not just a completion checkbox.

---

### Pitfall 6: AI-assisted (Claude Code) solo build drifts architecturally over 30 days

**What goes wrong:**
Each individual Claude Code session/change looks reasonable in isolation, but without a stable source of truth for conventions, module boundaries, and "load-bearing" decisions, the codebase accumulates small inconsistencies — a new API route that doesn't use the shared tenant-scoping middleware because that session's context didn't include it, a new section component that duplicates logic an earlier component already had, formatting/naming drift, subtly different error-handling patterns per feature. On a 30-day solo timeline with no second engineer to catch drift in review, this compounds into a codebase that "mostly works" but has inconsistent guarantees — exactly the kind of inconsistency that produces the tenant-isolation and race-condition bugs described above.

**Why it happens:**
Long AI-assisted sessions are subject to context compression — earlier instructions and established patterns get dropped from working context as the session grows, and the assistant optimizes locally for the current request without full visibility into prior architectural decisions.

**How to avoid:**
- Maintain a living architecture/conventions reference (this project already has `PROJECT.md` and a `.planning/` structure — keep it current, not just at kickoff) that gets re-read at the start of every work session, not relied upon from memory.
- Keep the tenant-scoping, entitlement-checking, and payment-state-transition logic centralized in a small number of shared modules/helpers that every feature is required to call — this makes "did this session use the right pattern" a code-review-able, greppable question rather than a memory question.
- Periodically (e.g., at each phase boundary) do a deliberate consistency pass: grep for direct Prisma calls that bypass the tenant-scoping extension, grep for hand-rolled auth checks instead of the shared entitlement helper, etc.
- Prefer smaller, scoped sessions with clear boundaries over one continuous marathon session — this project's phase structure is itself a mitigation, use it deliberately.

**Warning signs:**
- Multiple different patterns exist in the codebase for the same concern (e.g., two different ways tenant ID gets resolved in route handlers).
- Code review (even self-review) surfaces "wait, why did I do it this way here and that way there."
- Increasing time spent re-explaining project conventions to Claude Code each session instead of it inferring them from a stable reference.

**Phase to address:**
Cross-cutting — establish the shared-module discipline in the foundations phase; re-audit at every phase transition rather than only at the end.

---

### Pitfall 7: Subscription tier / entitlement enforcement checked only in the UI, not the server

**What goes wrong:**
The section/block customization editor and other tier-gated capabilities are hidden or disabled in the dashboard UI for lower tiers, but the underlying API routes that actually perform the mutation don't independently re-check the merchant's plan — so a Starter-tier merchant who understands network requests (or a competitor probing the API) can call the "Business tier" endpoint directly and get Business-tier behavior for free. Similarly, the 10-day trial's "server-side enforced" requirement is trivially undermined if trial expiry is checked only at login/page-load rather than on every entitlement-gated write.

**Why it happens:**
It's fast to build a feature and gate it with `{tier === 'business' && <Component />}` and call it done — the UI gate genuinely stops the vast majority of normal users from seeing or using the feature, so it "looks" secure in manual testing, and the missing server check isn't visible until someone actively probes the API.

**How to avoid:**
- Every tier-gated mutation must independently verify entitlement server-side, sourced from the merchant's current subscription state in the database (not a client-supplied plan value, not a JWT claim that isn't re-verified against current DB state — trials expire and downgrades happen mid-session).
- Centralize entitlement checks in one helper/middleware used by every gated route, mirroring the tenant-scoping discipline in Pitfall 1/6 — this is the same architectural pattern applied to a different axis (plan tier instead of tenant ID).
- Treat "10-day trial, server-side enforced" literally: check trial expiry against a server-computed timestamp on every gated action, not just at dashboard load.

**Warning signs:**
- Any tier check exists only as a conditional in a React component with no matching server-side check in the corresponding API route.
- Trial expiry is computed client-side from a value fetched once at login rather than checked fresh on each gated request.

**Phase to address:**
Subscription/entitlements phase, verified again whenever the block-based editor (the flagship gated feature) ships.

---

### Pitfall 8: Scope creep on the "~20 template variations" target eats the 30-day budget

**What goes wrong:**
The single highest-effort, highest-subjectivity requirement in this project is visual template quality across ~20 variations. On a solo build, this is exactly the kind of requirement that silently expands — "just one more tweak to make electronics feel right," "let me redo the grocery hero" — because design quality has no hard completion signal the way "endpoint returns 200" does. Every day spent polishing template N is a day not spent on payment-claim hardening, tenant isolation testing, or launch readiness, and template polish is the easiest place for a solo builder to lose track of time because it's also the most enjoyable/visible work.

**Why it happens:**
Solo builders lack a second person to say "ship it, that's good enough for V1" — subjective, high-visibility work (design) crowds out invisible, high-risk work (security, payment integrity) precisely because design has no natural stopping point and payment/security bugs don't announce themselves until they're exploited.

**How to avoid:**
- Set an explicit, non-negotiable time budget per flagship (not per storefront variation) before starting, and treat "recombination is mechanical" as the actual load-bearing assumption of the 20-variation plan — if a segment flagship can't be produced within its budget through recombination, that's a signal the block system needs work, not a signal to hand-craft that segment.
- Sequence the roadmap so tenant isolation, payment-claim integrity, and the order state machine are proven correct *before* the majority of template-variation time is spent — a beautiful storefront on a leaky multi-tenant foundation is a worse outcome than a plainer storefront on a solid one.
- Explicitly timebox: decide up front how many of the ~20 variations are truly required for launch vs. fast-follow (the project's own Out of Scope section already treats custom domains this way — apply the same discipline to variation count if day budget gets tight).

**Warning signs:**
- Days 20+ still show open work on template variation #4 while payment-claim fraud handling or tenant-isolation tests are unstarted.
- No fixed "done" definition exists per template (e.g., "flagship + N section variants reviewed side-by-side against 2 competitor storefronts").

**Phase to address:**
Roadmap/phase-ordering decision itself — sequence security/payment-integrity phases before or interleaved with, not strictly after, template-system phases; give template work an explicit ceiling.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| App-level tenant filtering only, no Postgres RLS | Faster to ship, one less moving part | Single point of failure — one missed filter = full cross-tenant leak | Only as an interim step in week 1; add RLS as a second layer before any real merchant data exists |
| Decrement stock on payment confirmation instead of order placement | Simpler mental model initially | Overselling under concurrent orders against low-stock items (common at this scale) | Never for a manual-payment flow with a multi-hour pending window — reserve at placement |
| Synchronous notification sends (WhatsApp/email) inline in the request handler | No queue/Redis job infra needed early | Slow/failing third-party calls block order placement; tenant context bugs harder to catch without explicit job-level scoping | Acceptable for pilot volume (dozens of orders/day) if wrapped in try/catch that never fails the order write; revisit before any real growth |
| Single S3/R2 bucket with tenant ID only as a path prefix, no per-tenant IAM scoping | Fast to implement | A path-traversal or presigned-URL bug exposes every tenant's images at once | Acceptable for V1 given solo scope, but path prefixes must be enforced server-side on every upload/read, never client-supplied |
| Client-side-only tier gating (hide button, no server check) | Fast to ship the editor | Trivially bypassed via direct API calls; silently violates the "server-side enforced" trial requirement already stated as a constraint | Never — this one is explicitly called out as non-negotiable in the project's own constraints |
| Color/logo-only template differentiation instead of structural layout variation | Reaches "20 variations" number fastest | Undermines the stated core value proposition (storefronts that "look like they cost money") | Never for the flagship-to-flagship axis; acceptable *within* a single flagship for merchant-to-merchant personalization |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|-------------------|
| Wildcard subdomain hosting (Vercel) | Assuming custom-domain SSL/DNS propagation is instant, blocking the merchant's storefront from going live at the promised speed | Design onboarding to work fully on the `.einort.com` subdomain immediately; treat custom-domain verification as async, with clear "pending" UI, per the project's own fast-follow framing |
| WhatsApp order deep link (`wa.me`) | Pre-filled message text exceeds practical length/encoding limits, or includes characters that break URL encoding, producing a garbled or truncated order message the merchant can't act on | Keep the pre-filled message compact (order ref + item summary + total, not full cart line-by-line for large carts) and test the generated link on both Android and iOS WhatsApp before relying on it as a checkout path |
| Cloudflare R2 / S3-compatible storage for product images | Presigned upload URLs scoped only by convention (client sends the "correct" tenant-prefixed key) rather than server-enforced | Generate presigned URLs server-side with the tenant-prefixed key baked in, never accept a client-supplied storage key |
| Redis (sessions/cache/queue) | Cache keys or job payloads without a tenant prefix, causing one tenant's cached data (e.g., storefront page cache) to be served to another | Prefix every Redis key with tenant ID/slug as a hard convention enforced through a shared cache-access helper, not ad hoc per call site |
| Image auto-enhancement/cropping pipeline | Uncapped processing cost/time if merchants upload very large or numerous images with no validation | Enforce file size/dimension/count limits server-side before processing; queue heavy image work rather than blocking the upload request |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Missing/non-composite index on `tenantId` columns | Dashboard and storefront queries slow down as order/product volume per tenant grows | Composite indexes on `(tenantId, createdAt)` / `(tenantId, status)` etc. from the first migration, matching actual query patterns | Noticeable well before pilot scale if skipped — even a few hundred orders per tenant with a full table scan is slow |
| Storefront pages fetching unoptimized full-resolution product images | Slow storefront load on the mobile networks and data costs typical of the target market, directly undermining the "premium" perception goal | Serve responsive/optimized images (Next.js Image or equivalent), enforce upload size caps, use a CDN | Immediately visible on any real 3G/4G Cameroonian mobile connection, not just at scale |
| Super Admin "all merchants" views doing per-tenant N+1 queries | Admin dashboard slows down proportionally to merchant count | Aggregate queries designed for cross-tenant admin views from the start (separate query pattern from tenant-scoped app queries, still respecting the platform-owner-only access boundary) | Becomes visible once merchant count reaches even low hundreds, i.e. plausibly within the stated growth trajectory |
| Connection pool exhaustion under Prisma + serverless (Vercel) | Intermittent "too many connections" errors under concurrent load, hard to reproduce in solo manual testing | Use a pooler (e.g., PgBouncer or the managed Postgres provider's built-in pooling) and Prisma's connection-pooling guidance for serverless from the start | Shows up under real concurrent traffic, i.e. exactly at launch/pilot, not before |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Trusting client-supplied price, stock, or order total (already a stated constraint) | Customer manipulates a request to pay less than the real total, or claims a payment for an amount that doesn't match | Always recompute price/total/stock server-side at order placement and again at claim-confirmation time; never accept a client-sent total as authoritative |
| No rate limiting on payment-claim submission | Fraud attempts hammer an order with repeated fake references hoping one gets rubber-stamped during a busy period | Rate-limit claim submissions per order/customer/IP |
| Super Admin and merchant dashboard sharing session/auth infrastructure without a hard boundary | A bug in tenant-session handling could expose platform-owner-level access through a merchant-facing code path | Keep Super Admin auth and route-level authorization fully separate from merchant auth, ideally on its own subdomain with its own session cookie scope |
| Screenshot/proof-of-payment upload accepted without file-type/size validation | Storage abuse, potential for malicious file upload, unnecessary storage cost | Validate MIME type and size server-side, store outside any publicly executable path, serve via signed URLs |
| IDOR on order detail / claim endpoints (sequential or guessable order IDs) | A customer or outsider views/edits another customer's order by guessing/incrementing an ID | Use non-sequential IDs (UUID/cuid) and always authorize the requester against the specific order + tenant, not just "is authenticated" |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Customer left in an ambiguous state after submitting a payment claim | Anxiety, repeat support messages ("did my order go through?"), abandoned trust in the platform | The stated "payment being confirmed" state is the right instinct — pair it with an expected-response-time message and a merchant-side SLA/reminder so the state doesn't stall indefinitely |
| WhatsApp-order and manual-payment-claim treated as fully separate code paths | Orders placed via WhatsApp don't show up consistently in the merchant's Orders dashboard/state machine, creating two sources of truth | Route WhatsApp orders through the same order state machine as claim-based orders, even if the "payment" leg differs |
| Empty/early-stage storefronts (no real products or photos yet) look broken or unfinished | Undermines the "looks like it cost money" promise at exactly the moment (merchant's first look, or their first customer's first look) that matters most for retention | Design deliberate empty/low-content states for every template, not default framework placeholders |
| Tap-to-dial USSD assist only tested on mobile | Desktop customers get a dead/no-op button | Detect device context and offer a fallback (copyable USSD string, on-screen instructions) when tap-to-dial can't function |
| No visible timeout or escalation if a merchant never reviews a claim | Customer stuck indefinitely, no recourse, damages trust in the whole platform not just one merchant | Auto-flag stale claims to the merchant (and eventually to Super Admin) after a fixed window |

## "Looks Done But Isn't" Checklist

- [ ] **Tenant isolation:** Manually tested with one tenant only — verify with an automated test that creates two tenants and asserts zero cross-visibility across every list/detail/export/admin endpoint, not just the obvious ones.
- [ ] **Subdomain routing:** Works for a couple of hand-picked tenant slugs — verify reserved-word blocking, suspended-tenant deresolution speed, and the 404/"store not found" experience for unmatched subdomains.
- [ ] **Payment-claim queue:** Confirm path tested — verify the reject path, the duplicate-reference-submission path, and what the customer actually sees/receives in each outcome, not just the merchant-side happy path.
- [ ] **Stock/inventory:** Works under one-user manual testing — verify with a simulated concurrent order test against a 1-unit-stock item, and confirm what happens to stock when an order is abandoned/never claimed.
- [ ] **Template distinctiveness:** Visually reviewed alone, looks fine — verify by placing two segment flagships side by side at the same viewport and asking whether a stranger would say "these are different products," not just "these are different colors."
- [ ] **Subscription tier gating:** UI correctly hides gated features — verify every gated mutation independently rejects a direct API call from a lower-tier account, including a trial account past its server-computed expiry.
- [ ] **Image upload:** Works for a couple of normal photos — verify size/type/count limits, and what happens with a very large or malformed file.
- [ ] **Order totals:** Cart displays correct total client-side — verify the server independently recomputes price/total from current product data at both order-placement and claim-confirmation time.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|------------------|
| Cross-tenant data leak discovered post-launch | HIGH | Immediately audit and patch the specific query path; force-rotate any exposed sensitive data (payment claim references, contact info); notify affected merchants transparently; add the missed path to the automated cross-tenant test suite so the class of bug can't recur silently |
| Template variations visually indistinct after template phase "complete" | MEDIUM | Cheaper to fix here than most pitfalls — re-audit flagships for structural (not just chromatic) differentiation before wide launch; the block architecture should make retrofitting section-order/layout variation feasible without a full rebuild if it was built with real section flexibility from the start |
| Stock oversold on a live order | LOW-MEDIUM | Manual merchant-side resolution (contact affected customer, offer alternative/refund) is workable at pilot scale; fix the underlying atomic-update/reservation logic before volume grows past what manual resolution can absorb |
| Payment-claim fraud incident (fake reference accepted) | MEDIUM | Merchant absorbs the loss at pilot scale; use the incident to tighten claim-review guidance and add the specific fraud pattern (e.g., reused reference) to a validation rule going forward |
| Subscription tier bypass discovered | LOW-MEDIUM | Patch the missing server-side check; audit billing/usage logs for other accounts that may have exploited the same gap; no data-integrity risk, mainly a revenue-leakage and precedent issue |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| Cross-tenant data leak (Pitfall 1) | Multi-tenant foundations / schema phase | Automated two-tenant isolation test suite passes on every deploy |
| Subdomain/hostname routing edge cases (Pitfall 2) | Multi-tenant foundations phase | Reserved-slug list enforced at signup; suspended-tenant deresolution tested; cookie scoping verified in devtools across subdomains |
| Manual payment-claim fraud (Pitfall 3) | Order/payment-claim state machine phase | Unique-reference constraint enforced; claim audit log exists; SLA/timeout on stale claims implemented |
| Inventory oversell race conditions (Pitfall 4) | Product catalog + order-placement phase | Concurrent-order simulation against low-stock item does not oversell; abandoned-order stock release verified |
| Generic-looking template recombination (Pitfall 5) | Template/theme-system phase | Side-by-side flagship review confirms structural (not just chromatic) distinctiveness before phase is marked complete |
| AI-assisted architectural drift (Pitfall 6) | Cross-cutting, anchored at foundations phase | Shared tenant-scoping/entitlement helpers exist and are the only sanctioned pattern; consistency grep pass at each phase boundary |
| Client-side-only tier enforcement (Pitfall 7) | Subscription/entitlements phase | Direct API calls from lower-tier/expired-trial accounts are rejected server-side, independent of UI state |
| Scope creep on template count (Pitfall 8) | Roadmap/phase-sequencing decision itself | Security/payment-integrity phases sequenced before or alongside template-system phases, not strictly after; explicit per-flagship time budget set upfront |

## Sources

- [Multi-tenant SaaS with Claude Code: Tenant Isolation and Row Level Security — DEV Community](https://dev.to/myougatheaxo/multi-tenant-saas-with-claude-code-tenant-isolation-and-row-level-security-17ik) — MEDIUM confidence
- [Multi-Tenant Leakage: When "Row-Level Security" Fails in SaaS — InstaTunnel](https://instatunnel.my/blog/multi-tenant-leakage-when-row-level-security-fails-in-saas) — MEDIUM confidence, corroborated by CVE references (CVE-2024-10976, CVE-2025-8713)
- [Multi-Tenant SaaS Security Testing: How to Prevent Cross-Tenant Data Leaks — Bugstrix](https://bugstrix.com/blogs/multi-tenant-saas-security-testing-how-to-prevent-cross-tenant-data-leaks/) — MEDIUM confidence
- [Multi-Tenant SaaS Mistakes I'll Never Make Again — Medium](https://medium.com/@Fahad06/multi-tenant-saas-mistakes-ill-never-make-again-ef358e1feb9f) — MEDIUM confidence
- [Multi-Tenant Subdomain Routing in Next.js: The Complete Pattern — peal.dev](https://www.peal.dev/blog/multi-tenant-subdomain-routing-nextjs-patterns) — MEDIUM confidence
- [Vercel Multi-Tenant Platform Concepts / Quickstart / Reference — official docs](https://vercel.com/docs/multi-tenant) — HIGH confidence (official documentation)
- [Building Modular Shopify Themes with Sections 2.0 and Theme Blocks — Speed Boostr](https://speedboostr.com/building-modular-shopify-themes-with-sections-2-0-and-theme-blocks-advanced-architecture-patterns/) — MEDIUM confidence
- [Shopify: Building with sections and blocks — official docs](https://shopify.dev/docs/storefronts/themes/best-practices/templates-sections-blocks) — HIGH confidence (official documentation)
- [Why AI-Generated Websites Still Feel Generic and How to Fix It — Graystudio](https://graystud.io/blog/why-ai-generated-websites-still-feel-generic) — LOW-MEDIUM confidence (single-source pattern, but corroborated across multiple independent articles in the same search)
- [How to fix the 'AI-generated' look in your frontend — DEV Community](https://dev.to/alanwest/how-to-fix-the-ai-generated-look-in-your-frontend-1ahh) — LOW-MEDIUM confidence
- [Black Friday fraud prevention / fake proof-of-payment fraud — Netcash](https://netcash.co.za/blog/black-friday-fraud-prevention-how-to-protect-your-online-store-during-peak-sales/) — MEDIUM confidence (adjacent market, same manual-EFT-style fraud pattern)
- [Fraud Prediction and Prevention in Mobile Money Payment Systems — Wiley Security and Communication Networks](https://onlinelibrary.wiley.com/doi/10.1155/sec/8913715) — MEDIUM confidence (academic literature review)
- [How I Eliminated Inventory Race Conditions in a Production E-Commerce System — Medium](https://medium.com/@chaturvediinitin/how-i-eliminated-inventory-race-conditions-in-a-production-e-commerce-system-2302ba81846b) — MEDIUM confidence
- [Inventory Reservation Patterns: How to Stop Overselling — Stoa Logistics](https://stoalogistics.com/blog/inventory-reservation-patterns) — MEDIUM confidence
- [Free Trial Abuse Prevention for SaaS Platforms — Stripe](https://stripe.com/resources/more/free-trial-abuse) — HIGH confidence (official vendor resource, well-established pattern)
- [Fixing Claude Code's 3 Hidden Problems in Large Codebases — Stork.AI](https://www.stork.ai/blog/claudes-3-fatal-coding-flaws) — LOW-MEDIUM confidence
- [Claude Code Context Management: Keep AI Output Consistent on Long Projects — DEV Community](https://dev.to/myougatheaxo/claude-code-context-management-keep-ai-output-consistent-on-long-projects-4d5h) — LOW-MEDIUM confidence
- Solo-founder scope creep pattern synthesized from multiple 2026 indie-builder retrospectives (Indie Hackers, Medium "Default-No Rule") — LOW-MEDIUM confidence, general pattern rather than domain-specific

---
*Pitfalls research for: Multi-tenant commerce storefront-builder SaaS, Cameroon-first, manual-payment-claim checkout*
*Researched: 2026-08-16*
