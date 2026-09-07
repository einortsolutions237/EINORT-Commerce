---
phase: quick-260906-egn
quick: 260906-egn
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: false
requirements: [QT-01, QT-02, QT-03, QT-04]

files_modified:
  # Task 1 (checkpoint) — install only
  - package.json
  - package-lock.json
  # Task 2 — shell chrome
  - src/components/app-sidebar.tsx
  - src/components/theme-provider.tsx
  - src/components/theme-toggle.tsx
  - src/components/dashboard-header-controls.tsx
  - "src/app/(dashboard)/layout.tsx"
  - src/app/layout.tsx
  # Task 3 — search stack
  - src/components/dashboard-topbar-search.tsx
  - src/components/ui/combobox.tsx
  - src/components/ui/input-group.tsx
  - src/server/search/queries.ts
  - src/server/search/actions.ts
  - src/server/rate-limit.ts
  - tests/isolation/search.test.ts
  # Task 4 — Overview page
  - src/server/dashboard/queries.ts
  - src/server/dashboard/buckets.ts
  - "src/app/(dashboard)/dashboard/page.tsx"
  - "src/app/(dashboard)/dashboard/overview-metrics.tsx"
  - "src/app/(dashboard)/dashboard/revenue-bars.tsx"
  - "src/app/(dashboard)/dashboard/recent-orders.tsx"
  - tests/unit/overview-buckets.test.ts
  # Shared across tasks 2/3/4
  - src/lib/strings/index.ts

user_setup: []

must_haves:
  truths:
    - "A merchant sees the 7 sidebar destinations under three section headings: General, Commerce, Configuration."
    - "Pressing Ctrl+K (Windows/Linux) or Cmd+K (Mac) anywhere in the dashboard opens a search modal."
    - "Typing a product name or order number in that modal returns matching results from the merchant's own store only, and selecting a result navigates to it."
    - "The visible keyboard hint reads 'Ctrl K' on Windows/Linux and '⌘K' on Mac — never the wrong one for the current machine."
    - "A merchant can switch the dashboard between Light, System and Dark, the choice survives a page reload, and there is no flash of the wrong theme on load."
    - "The dashboard header shows a notification bell and a Super Admin Panel control alongside the theme toggle and sign-out."
    - "/dashboard shows four metric cards, a 7-bar revenue chart, and a recent-orders list built from the merchant's real orders."
    - "The Active orders card counts the merchant's whole open backlog, not just the last 7 days, and says so on the card."
    - "A brand-new merchant with zero orders sees zeroes and empty states, not NaN, null, or a crash."
    - "Exactly one sonner Toaster is mounted in the dashboard shell."
  artifacts:
    - path: "src/components/app-sidebar.tsx"
      provides: "NAV_GROUPS structure rendering 3 SidebarGroup/SidebarGroupLabel sections"
      contains: "NAV_GROUPS"
    - path: "src/components/theme-provider.tsx"
      provides: "'use client' next-themes ThemeProvider wrapper, attribute='class', defaultTheme='system'"
      contains: "next-themes"
    - path: "src/components/theme-toggle.tsx"
      provides: "3-way Light/System/Dark dropdown-menu control with mounted gate"
      contains: "useTheme"
    - path: "src/components/dashboard-header-controls.tsx"
      provides: "Theme toggle + decorative bell + Super Admin Panel stub, composed for the header"
    - path: "src/server/search/queries.ts"
      provides: "searchMerchantSurface(tenantId, q) over Product + Order via scopedDb"
      exports: ["searchMerchantSurface"]
    - path: "src/server/search/actions.ts"
      provides: "merchantAction({ mode: 'read' }) search endpoint, zod schema of only { q }"
      contains: 'mode: "read"'
    - path: "src/server/dashboard/queries.ts"
      provides: "overviewMetrics(tenantId, since) + recentOrders(tenantId)"
      exports: ["overviewMetrics", "recentOrders"]
    - path: "src/server/dashboard/buckets.ts"
      provides: "Pure bucketByDay() — 7 day buckets, Africa/Douala UTC+1, no I/O"
      exports: ["bucketByDay"]
    - path: "tests/unit/overview-buckets.test.ts"
      provides: "Pure-function coverage of bucketByDay incl. UTC+1 midnight boundary and empty window"
    - path: "tests/isolation/search.test.ts"
      provides: "Cross-tenant leak assertion for searchMerchantSurface"
    - path: "src/app/(dashboard)/dashboard/page.tsx"
      provides: "Real Overview: metrics row, revenue chart, recent orders"
      contains: "requireMerchantContext"
  key_links:
    - from: "src/components/dashboard-topbar-search.tsx"
      to: "src/server/search/actions.ts"
      via: "debounced Server Action call from the client island"
      pattern: "searchMerchantSurfaceAction"
    - from: "src/server/search/actions.ts"
      to: "src/server/search/queries.ts"
      via: "handler passes ctx.tenantId (session-derived) into searchMerchantSurface"
      pattern: "ctx\\.tenantId"
    - from: "src/server/search/actions.ts"
      to: "src/server/rate-limit.ts"
      via: "searchLimiter.limit(ctx.tenantId) before any database read"
      pattern: "searchLimiter\\.limit"
    - from: "src/app/(dashboard)/layout.tsx"
      to: "src/components/theme-provider.tsx"
      via: "ThemeProvider mounted around the dashboard shell (not the root layout)"
      pattern: "<ThemeProvider"
    - from: "src/app/layout.tsx"
      to: "next-themes pre-paint script"
      via: "suppressHydrationWarning on <html>"
      pattern: "suppressHydrationWarning"
    - from: "src/app/(dashboard)/dashboard/page.tsx"
      to: "src/server/dashboard/queries.ts"
      via: "server-side call to overviewMetrics + recentOrders"
      pattern: "overviewMetrics"
    - from: "src/app/(dashboard)/dashboard/revenue-bars.tsx"
      to: "globals.css --chart-1"
      via: "bg-chart-1 utility (never a literal colour, never bg-chart-3/gold)"
      pattern: "bg-chart-1"
---

<objective>
Rebuild the merchant dashboard shell and Overview page toward the owner-supplied design reference, scoped to the four low-risk items: sidebar nav grouping, a real Cmd/Ctrl+K search modal over Products and Orders, header controls (3-way theme toggle, decorative bell, Super Admin Panel stub), and a real Overview page (metrics, 7-day revenue chart, recent orders).

Purpose: `/dashboard` is currently a Phase-2 empty-state placeholder and the top-bar search box is decorative. Both are the first things a merchant sees after signing in, and both currently look unfinished. This closes that gap using primitives the codebase already owns.

Output: 3 new client components, 2 new server query modules, 1 new server action module, 3 new Overview render components, 2 new tests, 2 shadcn registry components, 1 new npm dependency (`next-themes`), and a rewrite of `/dashboard`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/260906-egn-rebuild-the-merchant-dashboard-shell-and/260906-egn-CONTEXT.md
@.planning/quick/260906-egn-rebuild-the-merchant-dashboard-shell-and/260906-egn-RESEARCH.md
@.planning/design-references/EINORT-COMMERCE-FRONT-END-MERCHANT-PLATFORM.md

@src/components/app-sidebar.tsx
@src/components/dashboard-topbar-search.tsx
@src/app/(dashboard)/layout.tsx
@src/app/(dashboard)/dashboard/page.tsx
@src/server/merchant/action.ts
@src/server/rate-limit.ts

<interfaces>
<!-- Contracts the executor needs. Extracted from the codebase during planning. -->
<!-- Use these directly — do not go exploring for them. -->

From src/server/merchant/action.ts:
```typescript
export type ActionResult<T = void> =
  | ({ ok: true } & T)
  | { ok: false; error: Record<string, string[]> };

export function merchantAction<S extends z.ZodType, R>(config: {
  mode: "read" | "write";
  schema: S;
  handler: (ctx: MerchantContext, input: z.infer<S>) => Promise<ActionResult<R>>;
}): (raw: unknown) => Promise<ActionResult<R>>;
```
`mode: "read"` skips the `ctx.canWrite` gate. `ctx.tenantId` is derived from the
session inside the wrapper — it never crosses the client boundary.

From src/server/rate-limit.ts:
```typescript
export interface RateLimiter {
  readonly prefix: string;
  limit(identifier: string): Promise<{ success: boolean }>;
}

type LimiterSpec = {
  readonly prefix: string;
  readonly tokens: number;
  readonly window: `${number} ${"ms" | "s" | "m" | "h" | "d"}`;
  readonly surface: string;   // named so the degradation warning can say what is unprotected
};

function createLimiter(spec: LimiterSpec): RateLimiter;   // module-private
```
Existing exported limiters all follow one shape:
`export const xLimiter: RateLimiter = createLimiter({ prefix, tokens, window, surface })`.
The module degrades to allow-all with a loud `console.warn` when Upstash is unconfigured.

From src/server/db/enums.ts:
```typescript
export { OrderState } from "@/generated/prisma/enums";
// OrderState is BOTH a type and a frozen value object. Members:
// ORDER_PLACED | PAYMENT_PENDING | PAYMENT_CLAIMED | CONFIRMED | DISPUTED | FULFILLED
// No `import "server-only"` here on purpose — Client Components may import it.
```

From src/app/(dashboard)/dashboard/orders/format.ts:
```typescript
export function formatXaf(amountXaf: number): string;      // fr-CM / XAF / maxFractionDigits 0
export function formatAbsoluteTime(date: Date): string;
export function formatRelativeTime(/* ... */): string;     // Intl.RelativeTimeFormat
```
Deliberately NOT `server-only` — safe on either side of the boundary.

From src/components/ui/sidebar.tsx (already exported, no new primitive needed):
```typescript
export { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
         SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu,
         SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger };
```

Base UI composition idiom (NOT Radix `asChild`):
```tsx
<SidebarMenuButton render={<Link href={item.href} />}>…</SidebarMenuButton>
```
</interfaces>

<binding_constraints>
These are contract-tested. Violating any of them fails `npm run test:unit`.

1. **`tests/unit/surface-token-isolation.test.ts`** recurses `src/app` and `src/components`
   and rejects, in every `.tsx`:
   - literal colours: `/#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?\b|\boklch\(|\brgba?\(|\bhsla?\(/`
   - palette utilities: `/\b(zinc|slate|blue|amber|emerald|red|green|yellow|indigo|gray)-[0-9]{2,3}\b/`

   Legal colour vocabulary for everything in this plan: `bg-background`, `bg-card`,
   `bg-muted`, `bg-primary`, `bg-chart-1`…`bg-chart-5`, `text-foreground`,
   `text-muted-foreground`, `border-border`, `bg-sidebar*`, `text-success`/`bg-success`.
   Do **not** use `brand-accent` anywhere (D-12 makes it storefront-only).

2. **`tests/unit/dashboard-nav.test.ts`**:
   - The 7 `REQUIRED_HREFS` string literals must still appear in `app-sidebar.tsx`.
     Do **not** refactor away the `OVERVIEW_HREF = "/dashboard"` line — that literal
     is what satisfies the check.
   - `aria-current={current ? "page" : undefined}` must survive.
   - `app-sidebar.tsx` must contain **exactly one** literal `variant="gold"`
     (the pending-claims `<Badge>`). Every other file in `src/app`/`src/components`
     must contain **zero**, except basenames matching `/order-state/`.
   - `app-sidebar.tsx` may inline no user-facing prose — new group labels go in `strings`.

3. **`$queryRaw` / `$executeRaw` are lint-banned repository-wide.** Day-bucketing
   for the chart is computed in Node.

4. **`bg-chart-3` is gold-500.** It would not trip the regex, but it spends the gold
   budget on decoration. Use `bg-chart-1` for the single revenue series.

5. **All user-facing copy lives in `src/lib/strings/index.ts`.** No inline prose literals.

6. **44px touch-target floor** (`min-h-11`) on every new interactive header control —
   this market's hardware, inherited from `app-sidebar.tsx`.
</binding_constraints>
</context>

<decisions_made_during_planning>
Three calls the research left open, decided here so the executor does not have to.

**A-01 — Active orders is UNWINDOWED.** Revenue, units sold and new customers are all
last-7-days per the locked CONTEXT decision. The open-orders card is deliberately *not*:
it counts the merchant's whole current backlog (`state` in ORDER_PLACED, PAYMENT_PENDING,
PAYMENT_CLAIMED, CONFIRMED), regardless of when the order was placed. A 9-day-old
unfulfilled order is still work the merchant owes a customer; windowing it turns a to-do
gauge into a lie. The card's own sublabel must say "All time" while the other three say
"Last 7 days", so the difference is visible on screen and not just in the code.

**A-02 — Add `searchLimiter` rather than defer it.** The orchestrator's default was to
defer new rate-limit infrastructure as out-of-scope for a quick task. Overriding that,
with reasons: the addition is a single purely-additive `export const` following seven
existing examples of the exact same `createLimiter({ prefix, tokens, window, surface })`
call; no existing limiter's behaviour changes; and the module already degrades to
allow-all with a warning when Upstash is absent, so local dev and the test suites are
unaffected. Against that, shipping the codebase's first authenticated typeahead — one
POST per keystroke — with no limiter at all is the DoS/enumeration gap the research
flagged explicitly. Keyed by `ctx.tenantId`, not caller IP: this is an authenticated
surface, and the tenant is the correct blast-radius unit (it also avoids a `headers()`
read inside the action).

**A-03 — Toaster dedup.** `src/app/(dashboard)/layout.tsx` mounts `<Toaster />` twice
(once inside `<SidebarInset>`, once as its sibling), each with a justifying comment
written without sight of the other. Keep the **outer** one (sibling of `SidebarInset`) —
its placement is structurally better, outside the scrolling inset — and fold the inner
comment's one genuinely additional sentence ("in the layout rather than in each page so
that two dashboard routes both calling `toast()` share one stack instead of racing two")
into the surviving comment before deleting the inner mount. Fixed here rather than as a
separate quick task because this plan already rewrites that exact region.
</decisions_made_during_planning>

<tasks>

<task type="checkpoint:human-verify" gate="blocking-human">
  <name>Task 1: Package legitimacy gate — next-themes</name>
  <what-built>
    Nothing yet. This gate runs BEFORE the install.

    `260906-egn-RESEARCH.md`'s Package Legitimacy Audit could not run `slopcheck`
    (unavailable in this environment), so per protocol `next-themes` is tagged
    **[ASSUMED]** and its install must be human-verified. This checkpoint is not
    auto-approvable regardless of any auto-advance setting.

    Supporting evidence already gathered: version 0.4.6, created 2020-10-10 (~5.9 yrs),
    26,547,324 downloads/week, repo `github.com/pacocoursey/next-themes`, zero runtime
    dependencies, no `postinstall` script, peer range includes React ^19.
  </what-built>
  <action>
    Do not install anything yet. Present the evidence below to the developer, wait for an
    explicit approval, and only then run `npm install next-themes@0.4.6`. If rejected, switch
    Task 2(b) to the hand-rolled toggle described in RESEARCH.md and drop the dependency.
  </action>
  <how-to-verify>
    1. Open https://www.npmjs.com/package/next-themes
    2. Confirm the linked repository is `github.com/pacocoursey/next-themes` (Paco Coursey)
       and that it is not a recently-created lookalike.
    3. Confirm the weekly download count is in the tens of millions, and that the latest
       version is 0.4.6 (or note the newer version if one has shipped).
    4. Confirm no `postinstall`/`preinstall` script is listed.
    5. If approved, the executor runs: `npm install next-themes@0.4.6`
  </how-to-verify>
  <resume-signal>Type "approved" to allow the install, or "rejected" to fall back to the hand-rolled toggle documented in RESEARCH.md § Alternatives Considered (~80 lines: pre-paint blocking script, matchMedia subscription, cross-tab storage sync).</resume-signal>
</task>

<task type="auto">
  <name>Task 2: Shell chrome — nav grouping, theme toggle, header controls, Toaster dedup</name>
  <files>
    src/components/app-sidebar.tsx,
    src/components/theme-provider.tsx,
    src/components/theme-toggle.tsx,
    src/components/dashboard-header-controls.tsx,
    src/app/(dashboard)/layout.tsx,
    src/app/layout.tsx,
    src/lib/strings/index.ts
  </files>
  <action>
    Four independent edits to the dashboard shell. Every new module opens with a
    substantial "why" header comment citing quick task 260906-egn, per the codebase's
    comment convention.

    (a) NAV GROUPING (CONTEXT locked decision 1). In `app-sidebar.tsx`, replace the
    flat `NAV_ITEMS: readonly NavItem[]` with `NAV_GROUPS: readonly { label: string;
    items: readonly NavItem[] }[]`, preserving every existing `NavItem` field and the
    existing render shape verbatim. Three groups, in this order: General (Overview),
    Commerce (Products, Storefront Editor, Orders, Claims), Configuration (Plan,
    Payment Settings). Render one `SidebarGroup` per group with a `SidebarGroupLabel`
    above its `SidebarGroupContent` / `SidebarMenu className="gap-1"`. `SidebarGroupLabel`
    is already exported from `src/components/ui/sidebar.tsx` — do not author a new heading
    primitive. Keep the `OVERVIEW_HREF` constant line intact, keep `aria-current`, keep the
    single `variant="gold"` Badge, and keep the `h-auto min-h-11 …` className string on
    `SidebarMenuButton` exactly as it is. The three group labels go in
    `strings.dashboard.nav.groupGeneral` / `.groupCommerce` / `.groupConfiguration`.
    Carry forward the existing NAV_ITEMS header comment about the paired `REQUIRED_HREFS`
    edit — it is still true of the grouped structure.

    (b) THEME PROVIDER + TOGGLE (CONTEXT locked decision 3). Create
    `src/components/theme-provider.tsx`: a thin `"use client"` wrapper exporting
    `ThemeProvider` that renders next-themes' provider with `attribute="class"`,
    `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`. Create
    `src/components/theme-toggle.tsx`: a `"use client"` control using the already-installed
    `src/components/ui/dropdown-menu.tsx` with three items — Light / System / Dark — reading
    `{ theme, setTheme }` from `useTheme()`. Icons `Sun`, `Moon`, `Monitor` from lucide-react.
    HYDRATION GATE IS MANDATORY: `resolvedTheme` is `undefined` on the server and on the
    first client render by design, so hold a `mounted` state set in a `useEffect` and render
    a neutral placeholder icon until mounted — never branch the first render on
    `resolvedTheme`. Mount the provider inside `src/app/(dashboard)/layout.tsx` only,
    NOT the root layout: it keeps next-themes out of the storefront bundle and dark mode is
    a merchant-surface feature (`globals.css` states the storefront's lack of a dark variant
    is deliberate — do not add one). Passing children through the client provider is React
    composition; the dashboard layout stays a Server Component. Add `suppressHydrationWarning`
    to the `html` element in `src/app/layout.tsx` — next-themes mutates it before React
    hydrates, and this is the one required root-layout edit.

    (c) HEADER CONTROLS. Create `src/components/dashboard-header-controls.tsx` composing
    three controls for the right side of the dashboard header: the theme toggle; a decorative
    notification bell (`Bell` icon, focusable icon button, `aria-label` from `strings`, header
    comment stating it is decorative because no notification data model exists — and NO badge,
    since a `0` badge is exactly the anti-pattern `app-sidebar.tsx` argues against); and a
    "Super Admin Panel" control linking to `/admin`. The admin control is a header button,
    deliberately NOT a nav item: `/admin` does not exist yet, and a rail entry pointing at a
    404 is precisely what `dashboard-nav.test.ts`'s reachability contract defends against. Do
    not add `/admin` to `NAV_GROUPS` or to `REQUIRED_HREFS`. Give it an inline comment naming
    Phase 6+ as its owner. Render it unconditionally — no role check is available today. Wire
    the composed controls into the existing `header` in `src/app/(dashboard)/layout.tsx`,
    inside the existing `div className="ml-auto"` group alongside `SignOutButton`. Every
    control carries `min-h-11`.

    (d) TOASTER DEDUP (A-03). In `src/app/(dashboard)/layout.tsx`, delete the inner
    `Toaster` mounted inside `SidebarInset` and keep the outer one that is a sibling of
    `SidebarInset`. Before deleting, fold the inner comment's one additional point into the
    surviving comment: that it lives in the layout rather than in each page so two dashboard
    routes both calling `toast()` share one stack instead of racing two.

    All new user-facing copy — group labels, theme option labels, theme toggle aria-label,
    bell aria-label, Super Admin Panel label — goes in `src/lib/strings/index.ts` under the
    `dashboard` namespace. No inline prose literals in any `.tsx`.
  </action>
  <verify>
    <automated>npm run lint && npm run typecheck && npx vitest run tests/unit/dashboard-nav.test.ts tests/unit/surface-token-isolation.test.ts --reporter=dot && test "$(grep -v '^\s*\*' 'src/app/(dashboard)/layout.tsx' | grep -c 'Toaster />')" = "1" && grep -q 'suppressHydrationWarning' src/app/layout.tsx && grep -q 'SidebarGroupLabel' src/components/app-sidebar.tsx</automated>
  </verify>
  <done>
    Sidebar renders 7 destinations under 3 labelled groups; `dashboard-nav.test.ts` still
    green (7 hrefs present, aria-current present, exactly 1 gold in sidebar and 0 in the new
    files); theme provider mounted in the dashboard layout and not the root; the html element
    carries `suppressHydrationWarning`; header shows theme toggle + bell + Super Admin Panel;
    exactly one Toaster in the dashboard layout; lint and typecheck clean.
  </done>
</task>

<task type="auto">
  <name>Task 3: Real Cmd/Ctrl+K search over Products and Orders</name>
  <files>
    src/components/ui/combobox.tsx,
    src/components/ui/input-group.tsx,
    src/components/dashboard-topbar-search.tsx,
    src/server/search/queries.ts,
    src/server/search/actions.ts,
    src/server/rate-limit.ts,
    tests/isolation/search.test.ts,
    src/lib/strings/index.ts
  </files>
  <action>
    Replace the decorative top-bar search box with a working modal. Zero new npm
    dependencies — `npx shadcn@latest add combobox` resolves to the `base-nova` (Base UI)
    variant via `components.json` and pulls `input-group` + `button` transitively; its only
    npm deps are `cn` and `@base-ui/react`, both already installed. Do NOT use the shadcn
    `command` component: it wraps `cmdk`, which drags four Radix packages into a deliberately
    Base-UI-only component tree.

    RATE LIMITER (A-02). Add a `searchLimiter` export to `src/server/rate-limit.ts`
    following the existing `createLimiter({ prefix, tokens, window, surface })` shape used by
    the seven limiters already there. Prefix `rl:search`, surface named for the degradation
    warning, budget sized for a debounced human typeahead (a merchant typing a query issues a
    handful of calls; pick something generous for a human and useless for scripted
    enumeration, in the spirit of the existing `slugCheck` 30/minute comment). Document in its
    doc comment that this is the first authenticated limiter in the file and is therefore
    keyed by tenant rather than by caller IP.

    SERVER QUERY (`src/server/search/queries.ts`). First line `import "server-only"`.
    Export `searchMerchantSurface(tenantId: string, q: string)` returning `{ products, orders }`.
    Use `scopedDb(tenantId)` and one `Promise.all` of two `findMany` calls, each with
    `take: 5`. Products: `where { name: { contains: q, mode: "insensitive" } }`, ordered by
    `updatedAt` desc, selecting id/name/active/basePriceXaf. Orders: a top-level `OR` over
    `orderNumber` and `customerName` (both `mode: "insensitive"`) plus `customerPhone` (NO
    `mode` — it is a normalized digits-only MSISDN, so case-insensitivity is meaningless
    there), ordered by `placedAt` desc, selecting id/orderNumber/customerName/state/totalXaf.
    Every `contains` on a text column gets `mode: "insensitive"` — Postgres LIKE is
    case-sensitive and "shirt" must match "Shirt". Document in the header why the top-level
    `OR` is tenant-safe: the scopedDb extension sets `where.tenantId` as a sibling key, and a
    sibling of a top-level `OR` is an implicit AND in Prisma, so the tenant filter cannot be
    escaped through the `OR`. Also document that a `%q%` pattern cannot use a B-tree index and
    that this is an accepted sequential scan over a tiny tenant-filtered set at pilot scale —
    do NOT add `pg_trgm` or a full-text index (scope creep, and `$queryRaw` is banned anyway).

    SERVER ACTION (`src/server/search/actions.ts`). Use the `merchantAction` factory with
    `mode: "read"` — this is the codebase's first read-mode caller, and read mode is correct
    because a merchant on an expired trial must still be able to look at their own data. The
    zod schema contains ONLY `{ q: z.string().trim().min(1).max(64) }`. The 64-char cap is a
    security control, not cosmetics: an unbounded `contains` term is a free sequential scan.
    NO `tenantId` in the schema, ever — identity comes from `ctx` inside the wrapper. Call
    `searchLimiter.limit(ctx.tenantId)` before any database read and return the `ActionResult`
    failure shape when refused, with copy from `strings`. Let unexpected errors rethrow
    uncaught, per `merchantAction`'s documented contract — do not swallow a search failure
    into an empty result set, which would render as "no results" and hide the fault.

    CLIENT ISLAND (`src/components/dashboard-topbar-search.tsx`). Convert from Server
    Component to `"use client"`. Keep the existing trigger's visual treatment (muted rounded
    input look, `Search` icon, `Kbd` hint, hidden below `sm`) but make it a button that opens
    the modal rather than a bare `Input`. Register a global keydown listener accepting
    `(event.metaKey || event.ctrlKey) && event.key === "k"` with `preventDefault()` —
    platform-aware per CONTEXT locked decision 5, never Meta-only. Render results in the Base
    UI combobox grouped into Products and Orders, each result a link to
    `/dashboard/products/{id}` and `/dashboard/orders/{id}` respectively; reuse
    `OrderStateChip` from `src/components/order-state-chip.tsx` for order state (it is the
    authorized second gold spender — never write the `variant="gold"` literal in this file)
    and `formatXaf` from the orders `format` module for amounts. Debounce the action call at
    ~200–250ms.

    PLATFORM-AWARE HINT WITH A HYDRATION GATE. `navigator` does not exist during SSR, so any
    first render that branches on it mismatches. Server-render the `Ctrl K` glyph as the
    default — CLAUDE.md names Cameroon/Windows-majority hardware as this product's market, so
    Ctrl is the right default and the Mac glyph is the exception — then swap post-mount when
    Mac is detected. Detect via `navigator.userAgentData?.platform` with a `navigator.userAgent`
    `/Mac|iPhone|iPad/` fallback; `navigator.platform` is deprecated. No `navigator.` reference
    outside a `useEffect`. Replace the single `strings.dashboard.topbar.searchShortcutHint`
    with two strings (Ctrl and Mac variants).

    REWRITE THE TWO STALE COMMENT BLOCKS — THEY ARE NOW LIES. The block above
    `strings.dashboard.topbar` in `src/lib/strings/index.ts` currently asserts "VISUAL
    PLACEHOLDER ONLY … no search Server Action or query is wired to this copy anywhere in the
    codebase" and "no keydown listener is registered anywhere in this task". The header of
    `dashboard-topbar-search.tsx` asserts "Deliberately a Server Component — there is no
    state, no onChange, no keydown listener". Both become false in this task. Rewrite both to
    describe what is now true, citing 260906-egn. Leaving them is the exact failure this
    codebase's comment convention exists to prevent.

    ISOLATION TEST (`tests/isolation/search.test.ts`). Following
    `tests/setup/seed-two-tenants.ts`'s fixed-identifier fixture style (`tenant-a-fixed-id`,
    not random UUIDs, so a failure names the leak directly): seed a product and an order under
    tenant A whose names/numbers would match a query, then assert
    `searchMerchantSurface(tenantB, q)` returns neither. This is the highest-value test on the
    new endpoint — it is the one control standing between a typeahead and a cross-tenant
    disclosure.

    All new copy — modal title, placeholder, empty-state, group headings, rate-limited
    message, both shortcut hints — in `src/lib/strings/index.ts`.
  </action>
  <verify>
    <automated>npm run lint && npm run typecheck && npx vitest run tests/unit/surface-token-isolation.test.ts tests/unit/dashboard-nav.test.ts --reporter=dot && npm run test:full -- tests/isolation/search.test.ts && grep -q 'searchLimiter' src/server/rate-limit.ts && grep -q 'mode: "read"' src/server/search/actions.ts && ! grep -q 'VISUAL PLACEHOLDER ONLY' src/lib/strings/index.ts</automated>
  </verify>
  <done>
    `searchMerchantSurface` returns tenant-scoped Product and Order hits (max 5 each);
    the search action is `mode: "read"`, schema is `{ q }` only, and is rate-limited by
    tenant; the modal opens on both Cmd+K and Ctrl+K; the visible hint reads `Ctrl K` on
    Windows/Linux and the Mac glyph on Mac with no hydration warning; the cross-tenant
    isolation test passes; both stale "placeholder only" comment blocks are rewritten;
    zero new npm dependencies added by this task.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Real Overview page — metrics, 7-day revenue chart, recent orders</name>
  <files>
    src/server/dashboard/buckets.ts,
    src/server/dashboard/queries.ts,
    src/app/(dashboard)/dashboard/page.tsx,
    src/app/(dashboard)/dashboard/overview-metrics.tsx,
    src/app/(dashboard)/dashboard/revenue-bars.tsx,
    src/app/(dashboard)/dashboard/recent-orders.tsx,
    tests/unit/overview-buckets.test.ts,
    src/lib/strings/index.ts
  </files>
  <behavior>
    `bucketByDay(rows, since)` — pure, no I/O, no clock read:
    - Returns exactly 7 buckets regardless of input, oldest first.
    - Empty input returns 7 buckets each totalling 0 (not an empty array, not NaN).
    - An order placed at 23:30 UTC on day N lands in day N+1's bucket, because Douala
      is UTC+1 — this is the boundary case most likely to silently regress.
    - An order placed exactly at a bucket boundary lands in the later bucket.
    - Bucket index is clamped to 0..6; a row outside the window cannot write out of range.
    - `percentOfMax` is 0 for every bucket when the max is 0 (no division by zero).
  </behavior>
  <action>
    Replace the Phase-2 empty-state placeholder at `/dashboard` with the real Overview.
    Write `tests/unit/overview-buckets.test.ts` FIRST, from the behavior block above, and
    watch it fail before implementing `bucketByDay`.

    BUCKETING (`src/server/dashboard/buckets.ts`). A pure module — no `server-only` marker
    needed and no database import, which is what makes it unit-testable without a Neon branch.
    Export `bucketByDay(rows: { placedAt: Date; totalXaf: number }[], since: Date)` returning
    7 entries carrying an ISO day key, a short day label, the day's total, and `percentOfMax`.
    Bucket index is `Math.floor((placedAt + offset - since) / 86_400_000)` clamped to 0..6.
    Define `DOUALA_UTC_OFFSET_MINUTES = 60` as a named module constant with a comment
    recording why a fixed offset is correct: Cameroon is UTC+1 year-round (WAT, no DST), so
    `Intl.DateTimeFormat` with a `timeZone` is unnecessary here. This is computed in Node
    rather than in SQL because `$queryRaw`/`$executeRaw` are lint-banned repo-wide and
    Prisma's `groupBy` cannot truncate a DateTime to a day.

    QUERIES (`src/server/dashboard/queries.ts`). First line `import "server-only"`.
    Export `overviewMetrics(tenantId, since)` and `recentOrders(tenantId)`, both on
    `scopedDb(tenantId)`. Define two named state sets as module constants with doc comments:
    `EARNED_STATES` = CONFIRMED + FULFILLED ("money is only real once a human has confirmed
    it" — deliberately excludes ORDER_PLACED, PAYMENT_PENDING, PAYMENT_CLAIMED and DISPUTED),
    and `OPEN_STATES` = ORDER_PLACED + PAYMENT_PENDING + PAYMENT_CLAIMED + CONFIRMED. Import
    `OrderState` from `@/server/db/enums`, never from the generated client.

    `overviewMetrics` runs one `Promise.all` of six reads: revenue — `order.aggregate`
    `_sum.totalXaf` where `placedAt >= since` and state in EARNED_STATES; open orders —
    `order.count` where state in OPEN_STATES WITH NO `placedAt` FILTER AT ALL (decision A-01:
    the backlog is not a period measure); units — `orderItem.aggregate` `_sum.quantity` via
    the relation filter on `order`; and, for new customers, two
    `order.groupBy(["customerPhone"])` calls — one for the window and one for everything
    before it — whose set difference is the count. Plus a `findMany` of
    `{ placedAt, totalXaf }` over the window feeding `bucketByDay`; give that `findMany` a
    defensive `take:` with a comment noting it is bounded at pilot scale but unbounded in
    principle.

    `_sum` RETURNS `null`, NOT `0`, ON AN EMPTY WINDOW — SQL SUM() over an empty set is NULL.
    Coalesce with `?? 0`. Never `!` and never `as number`; a brand-new merchant must see
    zeroes, not a NaN currency string.

    THE CUSTOMERS METRIC NEEDS CARE. There is no `Customer` model in the schema — the only
    customer identity is the `Order.customerName`/`customerPhone` snapshot pair. What makes
    the metric defensible is that `src/server/checkout/actions.ts` runs
    `normalizeCameroonMsisdn()` before `placeOrder` persists the phone, so `customerPhone` is
    a stable MSISDN and cannot double-count a `+237`-prefixed number against a bare one. Use
    the two-query set difference above and label the card "New customers". If the set
    difference is dropped for any reason, the card must be relabelled "Customers who ordered"
    — a raw distinct count labelled "New" is a different metric wearing the wrong name.

    `recentOrders(tenantId)` is a `findMany` `take: 5` ordered by `placedAt` desc, selecting
    what the list renders. Same pattern as `dashboard/orders/page.tsx`.

    RENDER COMPONENTS (all Server Components — no `"use client"` anywhere in this task):

    `overview-metrics.tsx` — four cards using `src/components/ui/card.tsx`: Revenue (7d),
    Active orders, Units sold (7d), New customers (7d). Each card carries a sublabel; THE
    ACTIVE ORDERS SUBLABEL READS "All time" WHILE THE OTHER THREE READ "Last 7 days", so
    A-01's deliberate asymmetry is visible on screen and not buried in a comment. Format money
    with `formatXaf` imported from `./orders/format` — do not construct a new
    `Intl.NumberFormat`.

    `revenue-bars.tsx` — a hand-rolled 7-bar chart. No charting library: recharts would force
    a client boundary and a large bundle for 7 static bars, and its `ChartConfig` idiom invites
    a literal colour that the token-isolation test rejects. Each bar is a div with
    `className="w-full rounded-sm bg-chart-1"` and an inline `height` style expressed as a
    percentage — a percentage is a number, not a colour, so the literal-colour ban is
    unaffected. Use `bg-chart-1` (brand-600 light / brand-400 dark), NOT `bg-chart-3`, which
    is gold-500. A bar chart is unreadable to a screen reader: give the container `role="img"`
    and an `aria-label` summarising the series from `strings`, so colour is never the only
    signal.

    `recent-orders.tsx` — uses `src/components/ui/table.tsx` (the same primitives
    `dashboard/orders/page.tsx` uses, so the two lists stay visually consistent),
    `OrderStateChip` for state, `formatXaf` for amounts, `formatRelativeTime` for timestamps.
    Include an empty state for a merchant with no orders yet.

    `page.tsx` — keep and preserve the existing "THIS PAGE AUTHORIZES ITSELF" header comment
    and its `requireMerchantContext()` call: the `(dashboard)` layout is explicitly not the
    auth boundary, and that comment is load-bearing. Compute `since` as now minus 7 days on
    the server, call `overviewMetrics` and `recentOrders`, and compose the three components.
    Update the surrounding prose in that header to describe the real Overview rather than the
    Phase-2 empty state, and widen the content column from `max-w-3xl` (a form width) to
    something appropriate for a metrics dashboard. Keep the storefront address line and "view
    store" link — they remain the merchant's fastest path to their own shop.

    All card titles, sublabels, chart aria-label, table headers and empty-state copy in
    `src/lib/strings/index.ts`.
  </action>
  <verify>
    <automated>npm run lint && npm run typecheck && npx vitest run tests/unit/overview-buckets.test.ts tests/unit/surface-token-isolation.test.ts tests/unit/dashboard-nav.test.ts --reporter=dot && grep -q 'bg-chart-1' 'src/app/(dashboard)/dashboard/revenue-bars.tsx' && ! grep -q 'bg-chart-3' 'src/app/(dashboard)/dashboard/revenue-bars.tsx' && grep -q 'requireMerchantContext' 'src/app/(dashboard)/dashboard/page.tsx' && npm run build</automated>
  </verify>
  <done>
    `tests/unit/overview-buckets.test.ts` passes including the UTC+1 midnight boundary and
    the empty-window case; `/dashboard` renders four metric cards, a 7-bar `bg-chart-1`
    chart and a recent-orders table from real tenant-scoped data; the Active orders card is
    unwindowed and its sublabel says "All time"; a zero-order tenant renders zeroes and
    empty states with no NaN and no crash; `requireMerchantContext()` still called by the
    page itself; `npm run build` clean.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 5: Live browser verification of the rebuilt shell and Overview</name>
  <what-built>
    The full task: grouped sidebar nav, working Cmd/Ctrl+K search modal over Products and
    Orders, header controls (3-way theme toggle, decorative bell, Super Admin Panel stub),
    and a real Overview page with metrics, a 7-day revenue chart and recent orders. Plus the
    duplicate Toaster fix.

    Every automated gate (lint, typecheck, test:unit, the two contract tests, the isolation
    test, build) is already green — this checkpoint covers what those cannot see. The
    precedent is task 260903-ugl, where a real nav-item contrast bug passed every automated
    gate and was only caught in a live browser.
  </what-built>
  <action>
    Confirm all automated gates are green, then start the dev server and walk the developer
    through the eight checks below. Record any defect found as a follow-up rather than
    silently patching outside this plan's scope.
  </action>
  <how-to-verify>
    Run `npm run dev` and open http://localhost:3001/dashboard signed in as a merchant.

    1. SIDEBAR — 7 destinations under exactly 3 headings: General, Commerce, Configuration.
       Every one still navigates. The active item is highlighted and is NOT blue. The
       pending-claims badge is still the only gold on screen.
    2. SEARCH — press Ctrl+K (you are on Windows). The modal opens. The hint in the collapsed
       search box reads `Ctrl K`, not the Mac glyph. Type part of a real product name, then
       part of a real order number — both return results, and clicking one navigates to the
       right page. Confirm the browser console shows no hydration warning.
    3. THEME — cycle Light -> Dark -> System. Dark mode actually applies across the whole
       dashboard (sidebar, header, cards, chart bars). Reload the page: the choice persists
       and there is NO flash of the wrong theme before paint. Then open a storefront subdomain
       (e.g. http://{slug}.localhost:3001) and confirm it is unaffected — the storefront has
       no dark mode by design.
    4. HEADER CONTROLS — the bell and the Super Admin Panel button are visible and reachable
       by keyboard. The admin button links to `/admin` (a 404 today — expected, it is a
       Phase 6+ stub).
    5. OVERVIEW — four cards read plausibly against your real data. Confirm the Active orders
       card says "All time" while the other three say "Last 7 days". The revenue chart shows
       7 bars in brand blue (not gold). Recent orders lists your latest 5 with correct XAF
       amounts and state chips.
    6. EMPTY TENANT — if you have (or can make) a merchant with zero orders, confirm the
       Overview shows zeroes and empty states, never a NaN amount.
    7. TOASTS — trigger a toast (e.g. confirm an order on /dashboard/orders). Exactly one
       toast appears, not two.
    8. MOBILE — narrow the window below `lg`: the off-canvas sidebar sheet still opens and the
       grouped headings render correctly inside it.
  </how-to-verify>
  <resume-signal>Type "approved" or describe what is wrong.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Merchant browser → search Server Action | Untrusted query string crosses here; the first authenticated typeahead endpoint in the codebase |
| Merchant browser → localStorage theme value | Untrusted, but consumed only by next-themes' own class application |
| Server Action → Postgres | Tenant scoping enforced by the `scopedDb` Prisma extension |
| npm registry → build | New dependency (`next-themes`) enters the dependency tree |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-egn-01 | Information Disclosure | `src/server/search/queries.ts` | mitigate | `scopedDb(tenantId)` injects `where.tenantId` as a sibling of the top-level `OR` (implicit AND — the `OR` cannot escape it). Backed by a new cross-tenant assertion in `tests/isolation/search.test.ts` |
| T-egn-02 | Spoofing / Elevation | `src/server/search/actions.ts` | mitigate | The zod schema contains only `{ q }`. `tenantId` is read from `ctx` inside `merchantAction`, never from the payload — the invariant `tests/unit/no-tenant-id-param.test.ts` already enforces |
| T-egn-03 | Denial of Service | search endpoint | mitigate | New `searchLimiter` keyed by `ctx.tenantId`, checked before any DB read (decision A-02), plus a ~200–250ms client debounce and a `.max(64)` cap on `q` so an unbounded `contains` cannot be used to force sequential scans |
| T-egn-04 | Tampering | Prisma query construction | mitigate | Prisma parameterizes; `$queryRaw`/`$executeRaw` are lint-banned repo-wide via `no-restricted-syntax` |
| T-egn-05 | Information Disclosure | search result rendering | accept | React escapes text by default; no `dangerouslySetInnerHTML` anywhere in this plan. Reflected data is the merchant's own |
| T-egn-06 | Tampering | theme bootstrap script | mitigate | Using `next-themes` avoids hand-writing a `dangerouslySetInnerHTML` pre-paint script — one fewer injection surface |
| T-egn-07 | Elevation of Privilege | Super Admin Panel button | accept | A visible link to a non-existent `/admin` route. No privilege is granted; `src/server/db/admin.ts` remains import-restricted to the unbuilt `src/server/admin/**`. Real gating is Phase 6+ scope |
| T-egn-SC | Tampering | npm install (`next-themes`) | mitigate | slopcheck unavailable → `[ASSUMED]` → Task 1 is a blocking human-verify gate before install. Not auto-approvable |
</threat_model>

<source_audit>
## Multi-Source Coverage Audit

**GOAL** (quick task description — 4 scoped items):

| Item | Status | Covered by |
|------|--------|-----------|
| Nav grouping | COVERED | Task 2(a) |
| Working search modal | COVERED | Task 3 |
| Header controls | COVERED | Task 2(c) |
| Real Overview page | COVERED | Task 4 |

**CONTEXT** (locked decisions):

| Decision | Status | Covered by |
|----------|--------|-----------|
| 3 nav groups: General / Commerce / Configuration | COVERED | Task 2(a) |
| Search scope = Products + Orders only, no Customers | COVERED | Task 3 (two findMany calls; no Customers nav item added) |
| 3-way Light/System/Dark theme toggle | COVERED | Task 2(b) |
| Fixed last-7-days for metrics cards and chart | COVERED | Task 4 — with the documented, user-facing A-01 exception for the Active orders backlog |
| Platform-aware shortcut (Meta OR Ctrl; glyph matches the machine) | COVERED | Task 3 |

**CONTEXT** (Claude's discretion — all exercised and documented):

| Area | Resolution |
|------|-----------|
| Metrics set + computation | Revenue / Active orders / Units sold / New customers, each traced to a real schema field (Task 4) |
| Chart approach | Hand-rolled 7-bar CSS chart, `bg-chart-1`, zero new dependencies (Task 4) |
| Copy | All new strings routed through `src/lib/strings/index.ts` (Tasks 2, 3, 4) |
| Super Admin Panel placement | Header button, not a nav item, with a Phase 6+ ownership comment (Task 2c) |

**RESEARCH** (features and constraints):

| Item | Status | Covered by |
|------|--------|-----------|
| Base UI `combobox` + `input-group`, reject cmdk/`command` | COVERED | Task 3 |
| `next-themes@0.4.6` as the single new dependency, `[ASSUMED]` → human gate | COVERED | Tasks 1, 2(b) |
| Reject recharts; hand-roll the chart | COVERED | Task 4 |
| Mount ThemeProvider in the dashboard layout, not root | COVERED | Task 2(b) |
| `suppressHydrationWarning` on the html element | COVERED | Task 2(b) |
| Gold budget + literal-colour bans | COVERED | binding_constraints + automated gates on Tasks 2, 3, 4 |
| `_sum` is `null` not `0` on an empty window | COVERED | Task 4 |
| `customerPhone` is a normalized MSISDN; no Customer model | COVERED | Task 4 |
| Day-bucketing in Node (no `$queryRaw`) | COVERED | Task 4 |
| Hydration gates for `navigator` and `resolvedTheme` | COVERED | Tasks 2(b), 3 |
| Stale "VISUAL PLACEHOLDER ONLY" comment blocks | COVERED | Task 3 |
| Duplicate Toaster | COVERED | Task 2(d) |
| Search endpoint is unrated | COVERED | Task 3 (`searchLimiter`, decision A-02) |
| `contains` needs `mode: "insensitive"` | COVERED | Task 3 |
| Wave 0 gap: `bucketByDay` unit test | COVERED | Task 4 |
| Wave 0 gap: cross-tenant search isolation test | COVERED | Task 3 |

**Deliberately excluded (not gaps):** Analytics, Inventory, Customers, Domains, Delivery,
Settings pages and the Super Admin console itself — all listed as Deferred Ideas in
CONTEXT.md. Also excluded per RESEARCH.md: `pg_trgm`/full-text indexing (scope creep),
and a `.dark` variant for the storefront (a deliberate omission in `globals.css`).

**No unplanned items.**
</source_audit>

<verification>
Run after all tasks complete:

```
npm run lint          # eslint . --max-warnings=0
npm run typecheck     # tsc --noEmit
npm run test:unit     # vitest run tests/unit
npm run test:full     # full suite incl. the new isolation test (needs TEST_DATABASE_URL)
npm run build
```

The two contract tests that most directly police this task's blast radius:

```
npx vitest run tests/unit/dashboard-nav.test.ts
npx vitest run tests/unit/surface-token-isolation.test.ts
```

Regression watch — the specific things most likely to break silently here:
- `tests/unit/dashboard-nav.test.ts` gold count: exactly 1 in `app-sidebar.tsx`, 0 in every
  new file. `OrderStateChip` may be RENDERED freely; the `variant="gold"` literal may not be
  WRITTEN outside the sidebar and `order-state-chip.tsx`.
- `surface-token-isolation.test.ts` auto-covers new files because it recurses `src/app` and
  `src/components` — a literal hex in the chart or a `bg-slate-100` in a card fails the build.
- Hydration: neither `navigator.*` nor `resolvedTheme` may be read in a first render path.
</verification>

<success_criteria>
- Sidebar shows the 7 existing destinations under General / Commerce / Configuration; all 7
  still navigate; `dashboard-nav.test.ts` green.
- Cmd+K AND Ctrl+K both open a working search modal returning tenant-scoped Product and Order
  results; the visible hint matches the actual platform.
- The search action is `mode: "read"`, its schema is `{ q }` only, and it is rate-limited by
  tenant before any database read.
- A cross-tenant search isolation test exists and passes.
- Light / System / Dark all work, persist across reload, and produce no theme flash; the
  storefront is unaffected.
- Header carries theme toggle, decorative bell, and Super Admin Panel stub, all `min-h-11`.
- `/dashboard` renders four metric cards, a 7-bar `bg-chart-1` revenue chart, and a
  recent-orders table from real data; a zero-order tenant renders zeroes, never NaN.
- The Active orders card is unwindowed and says "All time" on screen.
- Exactly one Toaster in the dashboard layout.
- Both stale "placeholder only" comment blocks rewritten to match reality.
- `npm run lint`, `typecheck`, `test:unit`, `test:full`, `build` all clean.
- Exactly one new npm dependency (`next-themes`), human-gated before install.
</success_criteria>

<output>
Create `.planning/quick/260906-egn-rebuild-the-merchant-dashboard-shell-and/260906-egn-SUMMARY.md` when done.

The SUMMARY must record, as explicit decisions with rationale:
- A-01 — Active orders is unwindowed while the other three cards are 7-day, and the card says
  so on screen.
- A-02 — `searchLimiter` was added rather than deferred (overriding the orchestrator's
  tentative defer), keyed by tenant rather than caller IP, with the reasoning.
- A-03 — which Toaster survived and why.
- The `next-themes` legitimacy verdict from Task 1.
- Any known remaining gap, including that `/admin` is a deliberate 404 stub owned by Phase 6+.
</output>
