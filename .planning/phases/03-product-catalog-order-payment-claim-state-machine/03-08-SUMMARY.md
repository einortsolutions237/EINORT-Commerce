---
phase: 03-product-catalog-order-payment-claim-state-machine
plan: 08
subsystem: payments
tags: [react-hook-form, zod, next.js, tel-uri, wa.me, prisma, mobile-money]

# Dependency graph
requires:
  - phase: 03-01
    provides: MerchantPaymentSettings model (tenantId @unique), PaymentOperator enum
  - phase: 03-04
    provides: strings.paymentSettings namespace, dashboard shell shape, requireMerchantContext pattern
provides:
  - Three pure D-15 deep-link builders (normalizeCameroonMsisdn, buildMerchantUssd, buildWhatsAppOrderLink) unit-tested against the verified MTN/Orange operator strings
  - getPaymentSettings / resolvePaymentPaths as the single source of truth for which checkout paths a merchant can accept
  - savePaymentSettings server action (no verification step, per D-17)
  - The A6 /dashboard/settings/payment page: four cards, nothing-configured destructive alert, soft prefix warning
affects: [03-12-checkout-selector, phase-4-onboarding]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure deep-link string builders live outside src/server/payments/{settings,actions}.ts with no Prisma/server-only import, so they load in the `unit` vitest project and can be imported into a client form for a courtesy client-side check"
    - "useWatch({ control, name }) instead of form.watch(name) for any React-Compiler-linted client form — form.watch returns a function the compiler can't memoize; useWatch is a subscription"
    - "Field-level subcomponents inside a client form must be declared at module scope, not inside the parent component body (react-hooks/static-components), taking register/error as props instead of closing over the parent's form/errors"

key-files:
  created:
    - src/server/payments/phone.ts
    - src/server/payments/ussd.ts
    - src/server/payments/whatsapp.ts
    - src/server/payments/settings.ts
    - src/server/payments/actions.ts
    - src/app/(dashboard)/dashboard/settings/payment/page.tsx
    - src/app/(dashboard)/dashboard/settings/payment/payment-settings-form.tsx
    - src/app/(dashboard)/dashboard/settings/payment/loading.tsx
    - tests/unit/phone.test.ts
    - tests/unit/ussd.test.ts
    - tests/unit/whatsapp.test.ts
  modified:
    - src/app/(dashboard)/layout.tsx

key-decisions:
  - "Only MTN's merchant-payment string (*126*4*<code>*<amount>#) is emitted as a tap-to-dial link; Orange's merchant flow and both operators' P2P flows are never one-shot strings and buildMerchantUssd returns null for them, rendering the manual-copy block instead of a dead or misleading button"
  - "likelyOperatorFor drives a soft, non-blocking warning only, never a refusal, because Cameroon's mobile number portability makes a prefix mismatch an ordinary fact rather than an error"
  - "No verification/pending/SMS state anywhere in settings.ts, actions.ts or the A6 page (D-17) — a wrong number is self-correcting because the merchant simply doesn't get paid"
  - "resolvePaymentPaths is the single derived answer for both the A6 nothing-configured alert and 03-12's future checkout selector, so the two can never disagree about whether a merchant is set up"

requirements-completed: [CHK-02, CHK-03]

# Metrics
duration: not tracked (session-limit disconnect mid-execution; resumed from committed Task 1/2 state)
completed: 2026-08-30
---

# Phase 3 Plan 08: Payment settings + deep-link builders Summary

**A6 four-card payment-settings page (WhatsApp/MTN/Orange/COD) backed by three unit-tested pure deep-link builders that encode the D-15 research finding: only one verified tap-to-dial string exists, and it's MTN's merchant code, not a P2P transfer.**

## Performance

- **Tasks:** 3/3 completed
- **Files modified:** 12 (11 created, 1 modified)

## Accomplishments
- `normalizeCameroonMsisdn`, `formatMsisdnForDisplay`, `likelyOperatorFor` — pure phone normalization with the portability caveat encoded directly in the module, never used to reject a number
- `buildMerchantUssd` — the one genuinely working dial string (`*126*4*<code>*<amount>#`), with the `#` → `%23` `href`/`display` split that fixes Pitfall 9, and `null` as the correct, common return for every other case
- `buildWhatsAppOrderLink` / `buildOrderMessage` — the `wa.me` order handoff, XAF-formatted via `Intl.NumberFormat`, no currency library
- `getPaymentSettings` + `resolvePaymentPaths` — one derived answer for which of WhatsApp / manual-transfer / COD a merchant can actually accept
- `savePaymentSettings` — upsert-by-`tenantId` write with format validation in the handler (not the schema) so error copy comes from `strings.paymentSettings`, and non-blocking prefix notices in the success payload
- The A6 page and client form: four cards in the WhatsApp → MTN → Orange → COD order, `+237` prefix adornment, destructive nothing-configured alert, destructive blocking-error alert + `aria-invalid`, `sonner` success toast, four-card `loading.tsx` skeleton
- `<Toaster />` mounted once in the dashboard shell so the settings page's success toast has a host

## Task Commits

Each task was committed atomically:

1. **Task 1: The three pure builders** — `4960e80` (test, RED) → `3e03e01` (feat, GREEN)
2. **Task 2: getPaymentSettings and savePaymentSettings** — `ccdbe14` (feat)
3. **Task 3: The A6 payment-settings page** — `f6aa7fe` (feat)

**Plan metadata:** commit follows this summary (docs: complete plan)

_Note: Task 1 is TDD (`tdd="true"`), hence the separate RED/GREEN commits._

## Files Created/Modified
- `src/server/payments/phone.ts` - `normalizeCameroonMsisdn`, `formatMsisdnForDisplay`, `likelyOperatorFor`, pure, no I/O
- `src/server/payments/ussd.ts` - the three verified operator constants and `buildMerchantUssd`
- `src/server/payments/whatsapp.ts` - `buildWhatsAppOrderLink`, `buildOrderMessage`
- `src/server/payments/settings.ts` - `getPaymentSettings`, `resolvePaymentPaths` (`server-only`)
- `src/server/payments/actions.ts` - `savePaymentSettings` (`use server`, `merchantAction({ mode: "write" })`)
- `src/app/(dashboard)/dashboard/settings/payment/page.tsx` - the A6 Server Component, `requireMerchantContext` + `resolvePaymentPaths` + nothing-configured alert
- `src/app/(dashboard)/dashboard/settings/payment/payment-settings-form.tsx` - the client island, `react-hook-form` + Zod, four cards
- `src/app/(dashboard)/dashboard/settings/payment/loading.tsx` - four stacked card skeletons at real heights
- `src/app/(dashboard)/layout.tsx` - mounts `<Toaster />` once for the dashboard shell
- `tests/unit/{phone,ussd,whatsapp}.test.ts` - table-driven unit tests for every `<behavior>` row

## Decisions Made
- Kept `MERCHANT_CODE_PATTERN` exported from `ussd.ts` (beyond the plan's stated export list) so the six-digit rule is one expression shared by `buildMerchantUssd`, `savePaymentSettings`, and the client-side Zod schema — one source of truth for T-03-40's mitigation rather than three copies of `/^\d{6}$/`.
- `savePaymentSettings`'s success shape is `{ ok: true, notices }` rather than `{ ok: true, data: { notices } }`, matching the codebase's actual `ActionResult<T> = ({ ok: true } & T) | { ok: false; error }` convention in `src/server/merchant/action.ts` (the plan's own `<interfaces>` block paraphrased this slightly differently; the real wrapper's contract took precedence).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `form.watch()` opted the client form out of React Compiler memoization**
- **Found during:** Task 3 verification (`npm run lint`)
- **Issue:** `payment-settings-form.tsx` called `form.watch("mtnMomoNumber")`, `form.watch("orangeMoneyNumber")` and `form.watch("codEnabled")`. React Hook Form's `watch()` returns a function the React Compiler cannot memoize safely, tripping `react-hooks/incompatible-library` at `--max-warnings=0`.
- **Fix:** Replaced all three calls with `useWatch({ control, name })`, matching the existing pattern in `src/app/signup/signup-form.tsx` and `src/app/onboarding/create-store/create-store-form.tsx`.
- **Files modified:** `src/app/(dashboard)/dashboard/settings/payment/payment-settings-form.tsx`
- **Verification:** `npm run lint` exits 0 at `--max-warnings=0`
- **Committed in:** `f6aa7fe` (Task 3 commit)

**2. [Rule 1 - Bug] `NumberField`/`MerchantCodeField` created during render**
- **Found during:** Task 3 verification (`npm run lint`, after fixing deviation 1 above — the compiler analyzed the component more deeply once the `watch()` bail-out was resolved)
- **Issue:** `NumberField` and `MerchantCodeField` were declared as nested function components inside `PaymentSettingsForm`'s body, closing over `form`/`errors`. `react-hooks/static-components` flags this as an error: a component recreated on every parent render resets its own state each time.
- **Fix:** Hoisted both to module scope, taking `register: UseFormRegister<PaymentSettingsFormValues>` and `error?: string` as explicit props instead of closing over the parent's `form`/`errors`. Updated all four call sites to pass `error={errors.<field>?.message}` and `register={form.register}`.
- **Files modified:** `src/app/(dashboard)/dashboard/settings/payment/payment-settings-form.tsx`
- **Verification:** `npm run lint` exits 0; `npm run typecheck` exits 0; `npx next build` completes; `npm run test:unit` still 331/331
- **Committed in:** `f6aa7fe` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs, both `--max-warnings=0` lint violations introduced by the interrupted session's in-progress Task 3 work)
**Impact on plan:** Both fixes were required to pass the plan's own `<verify>` gate for Task 3 (`npm run lint` at zero warnings). No scope creep — no behavior changed, only component structure and the watch API used to read the same three fields.

## Issues Encountered
- Session was interrupted mid-Task-3 by a session limit. On resume, `src/app/(dashboard)/dashboard/settings/payment/page.tsx` and `payment-settings-form.tsx` were already present and functionally complete against the plan's `<action>` and `<behavior>` spec; only `loading.tsx` was missing and the two lint violations above needed fixing. The uncommitted `src/app/(dashboard)/layout.tsx` diff (mounting `<Toaster />`) was inspected and kept — it is a necessary addition for the form's `sonner` success toast to have a host, consistent with the plan's stated interaction contract even though the layout file isn't in the plan's `files_modified` list.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `resolvePaymentPaths` is ready for 03-12's checkout selector to reuse directly — no separate null-check logic should be written there.
- `buildMerchantUssd` and `buildWhatsAppOrderLink` are ready for the checkout/order-confirmation surfaces that will render the actual payment instructions to a customer.
- No blockers.

---
*Phase: 03-product-catalog-order-payment-claim-state-machine*
*Completed: 2026-08-30*

## Self-Check: PASSED

All 11 claimed created/modified files under `src/server/payments/`, `src/app/(dashboard)/dashboard/settings/payment/` and `tests/unit/` were verified present on disk, and all four task commit hashes (`4960e80`, `3e03e01`, `ccdbe14`, `f6aa7fe`) were verified present in `git log --oneline --all`.
