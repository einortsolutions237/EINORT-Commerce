# Quick Task 260906-egn: Dashboard shell + Overview page — Research

**Researched:** 2026-09-06
**Domain:** Next.js 16 App Router dashboard UI (Base UI / shadcn base-nova), Prisma 7 tenant-scoped aggregation
**Confidence:** HIGH (every finding below traced to a file/line in this repo or to a registry response fetched this session)

## Summary

The headline finding is that **three of the four sub-tasks need zero new npm dependencies**, and the fourth (theme toggle) needs at most one small one. `@base-ui/react` 1.7.0 — already installed — ships `combobox` and `autocomplete` primitives, and shadcn's `base-nova` style has a `combobox` registry entry whose only npm dependency is `@base-ui/react` itself. That is the correct ⌘K search foundation for this codebase; the shadcn `command` component is the wrong one here because it wraps `cmdk`, which pulls four Radix packages into a deliberately Base-UI-only component tree.

For the Overview page, the data situation is honest but constrained. There is **no `Customer` model** in `prisma/schema.prisma` — the only customer identity is the `Order.customerName` / `Order.customerPhone` snapshot pair. The saving grace is that `src/server/checkout/actions.ts:385` normalizes every phone through `normalizeCameroonMsisdn()` **before** `placeOrder` persists it, so `customerPhone` is a stable MSISDN and a `groupBy(["customerPhone"])` is a defensible distinct-customer key. Revenue, units sold, and open-order counts all have clean backing. Date-bucketing for the 7-bar chart **must happen in application code**, because `$queryRaw` / `$executeRaw` are banned repository-wide by `eslint.config.mjs`'s `no-restricted-syntax` and Prisma has no date-truncation group-by.

The hardest constraint on this task is not a library choice — it is `tests/unit/surface-token-isolation.test.ts` ban 1 and ban 2, which grep every `.tsx` under `src/app` and `src/components` for literal colour values (`#rrggbb`, `oklch(`, `rgb(`, `hsl(`) and for Tailwind palette utilities (`slate-500`, `blue-600`, …). A hand-rolled chart or a `recharts` `ChartConfig` that names a colour inline fails the build. The `--chart-1..5` tokens already exist in both `:root` and `.dark` (`globals.css:134-138`, `:319-323`) and are exposed as `bg-chart-1` etc. through `@theme inline` — those are the only legal way to colour a chart here.

**Primary recommendation:** Install nothing for search or the chart. Add `combobox` + `input-group` from shadcn base-nova (0 npm deps), hand-roll a 7-bar CSS chart using `bg-chart-1`, and add `next-themes@0.4.6` as the single new dependency for the theme toggle.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Nav grouping**
- 3 groups: **General** (Overview alone), **Commerce** (Products, Storefront Editor, Orders, Claims), **Configuration** (Plan, Payment Settings). Not the reference's 4-group taxonomy — a "Channels" group with only Storefront Editor in it would be a group of one.

**Search scope**
- The ⌘K modal searches **Products and Orders** only. No Customers scope (no dedicated Customers page exists yet to link results to).

**Theme toggle**
- **3-way**: Light / System / Dark. Dark-mode CSS variables already exist in `globals.css` (from the `260823-gu4` retrofit) but have never been wired to a real switcher — this task wires them.

**Overview window**
- **Fixed last-7-days** for both the metrics cards and the revenue chart. No date-range picker — matches the reference's Overview page (its Analytics page, not Overview, is the 30-day/range-picker surface, and Analytics is out of scope here).

**Keyboard shortcut platform-awareness**
- The user flagged that ⌘K is Mac-only notation. The search shortcut must be platform-aware: the listener accepts **either** `metaKey` (Mac) **or** `ctrlKey` (Windows/Linux) + `K`, and the visible hint in the search box renders `⌘K` on Mac and `Ctrl K` on Windows/Linux (detected client-side, e.g. via `navigator.platform`/`navigator.userAgent`, never hardcoded to one symbol). This is EINORT's own target market (Cameroon, Windows-majority merchant hardware per `CLAUDE.md`), so defaulting to the Mac-only glyph would be wrong for most real users.

### Claude's Discretion
- Exact metrics-card set and how each metric is computed from existing `src/server/orders`/`src/server/catalog` queries (must derive from what's actually queryable today — do not fabricate a metric with no backing data).
- Chart implementation approach (library choice, if any, vs. hand-rolled) — must not introduce a new dependency without checking what's already installed.
- Exact wording/copy for all new UI strings, routed through `src/lib/strings.ts` per the codebase's centralized-copy convention.
- The "Super Admin Panel" button's exact placement/styling, given `/admin` doesn't exist yet — should be styled real per 03-UI-SPEC.md conventions, with an inline comment noting the route is future (Phase 6+) scope.

### Deferred Ideas (OUT OF SCOPE)
Analytics, Inventory, Customers, Domains, Delivery, Settings pages, and the Super Admin console itself — these require their own data-model decisions and are separate, larger future phase scope.
</user_constraints>

## Project Constraints (from CLAUDE.md)

Binding directives extracted from `./CLAUDE.md` that this task must satisfy:

| # | Directive | Where it bites in this task |
|---|-----------|-----------------------------|
| C-1 | Never call raw Prisma outside sanctioned zones; always `scopedDb(tenantId)` | Every new Overview + search query |
| C-2 | Never trust a client-supplied `tenantId` | The search Server Action must derive tenant from session, never a param |
| C-3 | UI copy is centralized in `src/lib/strings/index.ts` — never inline a user-facing literal | All new nav group labels, header control labels, metric card titles, empty states |
| C-4 | Currency formatting uses `Intl.NumberFormat("fr-CM", { style: "currency", currency: "XAF" })` directly — no currency library | Revenue card, recent-orders list. **Reuse `formatXaf` from `src/app/(dashboard)/dashboard/orders/format.ts:27`** |
| C-5 | `npm run lint` is `eslint . --max-warnings=0` — zero tolerance | No unused imports, no `any`, `_`-prefix intentionally-unused params |
| C-6 | `$queryRaw` / `$executeRaw` banned repository-wide via `no-restricted-syntax` | Date-bucketing for the chart must be JS-side |
| C-7 | kebab-case for every `.ts`/`.tsx` filename | `theme-toggle.tsx`, `dashboard-search-dialog.tsx`, `overview-metrics.tsx` |
| C-8 | Every non-trivial module opens with a substantial "why" header comment citing decision IDs | All new modules |
| C-9 | Domain errors set `override readonly name` explicitly | Only if a new error class is added (likely none) |
| C-10 | `"use server"` and `import "server-only"` are mutually exclusive, first line of file | New query module gets `import "server-only"`; search action module gets the `merchantAction` factory pattern |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Nav grouping (3 section labels) | Browser/Client | — | `app-sidebar.tsx` is already `"use client"` (needs `usePathname`); grouping is pure render-time structure |
| ⌘K keyboard listener + modal open state | Browser/Client | — | Keyboard events and dialog state have no server representation |
| Search query execution (Products + Orders) | API/Backend | Database | Tenant scoping is server-only; `scopedDb` is unreachable from a client bundle |
| Platform detection for `⌘K` vs `Ctrl K` glyph | Browser/Client | — | `navigator.*` does not exist on the server; must be a post-mount effect to avoid hydration mismatch |
| Theme persistence + class application | Browser/Client | — | `localStorage` + `documentElement.classList`; no server round-trip |
| Notification bell (decorative) | Browser/Client | — | No data source exists; purely presentational |
| Super Admin Panel button | Frontend Server (SSR) | — | A `<Link>` in a Server Component; `/admin` route does not exist yet |
| Overview metric aggregation | Database | API/Backend | Prisma `aggregate`/`groupBy` push the arithmetic to Postgres |
| 7-day revenue bucketing | API/Backend | — | Prisma cannot date-truncate; `$queryRaw` banned; must bucket in Node from a bounded row set |
| Chart rendering (7 bars) | Frontend Server (SSR) | — | Static bars from server-computed numbers; no interactivity required |
| Recent-orders list | Frontend Server (SSR) | Database | Same pattern as `dashboard/orders/page.tsx` — Server Component reading `scopedDb` |

## Standard Stack

### Already installed — use these, add nothing

| Library | Version | Purpose | Evidence |
|---------|---------|---------|----------|
| `@base-ui/react` | 1.7.0 | Combobox/Autocomplete/Dialog primitives for the search modal | `package.json` dep; `node_modules/@base-ui/react/{combobox,autocomplete,dialog}/` all present [VERIFIED: filesystem] |
| `lucide-react` | ^1.31.0 | `Search`, `Bell`, `Sun`, `Moon`, `Monitor`, `ShieldCheck` icons | `package.json`; already used in `app-sidebar.tsx:6-15` |
| `next` | 16.3.1 | App Router, Server Actions | `package.json` |
| `react` / `react-dom` | 19.2.8 | — | `package.json` |
| `@prisma/client` | 7.9.1 | `aggregate` / `groupBy` for metrics | `package.json` |
| `zod` | 4.4.3 | Search action input schema | `package.json` |
| `shadcn` CLI | ^4.18.0 | Adding `combobox` + `input-group` | `package.json` devDep-equivalent |

### shadcn registry components to add — 0 new npm dependencies

| Registry component | Style | npm `dependencies` | `registryDependencies` | Evidence |
|--------------------|-------|--------------------|------------------------|----------|
| `combobox` | `base-nova` | `["cn", "@base-ui/react"]` — both already present | `["button", "input-group"]` | [VERIFIED: https://ui.shadcn.com/r/styles/base-nova/combobox.json] |
| `input-group` | `base-nova` | `["cn"]` — already present | `["button", "input", "textarea"]` — all three already in `src/components/ui/` | [VERIFIED: https://ui.shadcn.com/r/styles/base-nova/input-group.json] |

`components.json` confirms `"style": "base-nova"`, `"rsc": true`, `"iconLibrary": "lucide"`, aliases `@/components/ui` — so `npx shadcn@latest add combobox` resolves to the Base UI variant automatically. `button.tsx`, `input.tsx`, `textarea.tsx`, `dialog.tsx` all already exist under `src/components/ui/`.

### The one new npm dependency worth adding

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `next-themes` | 0.4.6 | 3-way Light/System/Dark toggle | Handles the FOUC-prevention inline script, `prefers-color-scheme` `matchMedia` subscription, cross-tab `storage` sync, and SSR-safe `resolvedTheme` — the four things a hand-rolled toggle gets subtly wrong |

`npm view next-themes` returns version `0.4.6`, `time.modified` `2025-03-11`, repo `github.com/pacocoursey/next-themes`, `peerDependencies` `react: ^16.8 \|\| ^17 \|\| ^18 \|\| ^19 \|\| ^19.0.0-rc` (React 19 supported), and **zero runtime `dependencies`**. Last-week downloads: **26,547,324**. [VERIFIED: npm registry — but see Package Legitimacy Audit; slopcheck was unavailable, so this is tagged ASSUMED pending human verification.]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `combobox` (Base UI) | shadcn `command` (`base-nova`) | Its `dependencies` are `["cn", "cmdk"]` and its source is `import { Command as CommandPrimitive } from "cmdk"` [VERIFIED: https://ui.shadcn.com/r/styles/base-nova/command.json]. `npm view cmdk dependencies` shows it pulls `@radix-ui/react-id`, `@radix-ui/react-dialog`, `@radix-ui/react-primitive`, `@radix-ui/react-compose-refs` — four Radix packages into a codebase whose entire `src/components/ui/` tree is Base UI. Also requires the same `input-group` registry dep. **Reject.** |
| Hand-rolled CSS bar chart | `recharts` 3.10.1 (via shadcn `chart`) | shadcn `chart.json` `dependencies` are `["cn", "recharts@3.8.0"]` [VERIFIED]. recharts is a large client-only bundle that forces the whole Overview page (or a wrapper island) to `"use client"`, for 7 static bars with no tooltips required by the reference's Overview screenshot. Its `ChartConfig` idiom also invites a literal colour, which ban 1 rejects. **Reject for this task**; revisit if/when the out-of-scope Analytics page needs real interactive charts. |
| `next-themes` | Hand-rolled `<script dangerouslySetInnerHTML>` + `useState` island | Saves one 0-dependency package but requires getting the pre-paint blocking script, `matchMedia("(prefers-color-scheme: dark)")` change subscription, and cross-tab `storage` events right by hand. Legitimate if the planner wants literally zero new deps — budget ~80 lines and a dedicated pitfall review. |

**Installation:**
```bash
npx shadcn@latest add combobox        # pulls input-group + button transitively; 0 new npm deps
npm install next-themes@0.4.6         # gate behind checkpoint:human-verify (see audit below)
```

## Package Legitimacy Audit

`slopcheck` could not be installed in this environment (`pip install slopcheck` failed; `command -v slopcheck` → not found). **Per protocol, every package below is therefore tagged `[ASSUMED]`, and the planner must gate each install behind a `checkpoint:human-verify` task.**

| Package | Registry | Age | Downloads/wk | Source Repo | slopcheck | Disposition |
|---------|----------|-----|--------------|-------------|-----------|-------------|
| `next-themes` | npm | ~5.9 yrs (created 2020-10-10) | 26,547,324 | github.com/pacocoursey/next-themes | unavailable | **[ASSUMED]** — recommended, gate behind human-verify |
| `cmdk` | npm | — | 43,982,400 | (not fetched) | unavailable | **NOT RECOMMENDED** — rejected on architecture grounds (Radix in a Base UI tree), not legitimacy |
| `recharts` | npm | ~11 yrs (created 2015-08-07) | 57,304,894 | github.com/recharts/recharts | unavailable | **NOT RECOMMENDED** for this task — rejected on bundle-size/ban-1 grounds, not legitimacy |

**Packages removed due to slopcheck [SLOP] verdict:** none (tool unavailable)
**Packages flagged as suspicious [SUS]:** none (tool unavailable)

**Postinstall check:** `npm view next-themes scripts.postinstall` returned nothing — no postinstall script. [VERIFIED: npm registry]

## Architecture Patterns

### System Architecture Diagram

```
                        Merchant browser
                               │
              ┌────────────────┼─────────────────┐
              │                │                 │
        ⌘K / Ctrl+K      theme toggle       page navigation
        keydown            click                  │
              │                │                  │
              ▼                ▼                  │
   ┌──────────────────┐  ┌──────────────┐         │
   │ search-dialog    │  │ theme-toggle │         │
   │ (client island)  │  │ (client)     │         │
   │ Base UI Combobox │  │ next-themes  │         │
   └────────┬─────────┘  └──────┬───────┘         │
            │ debounced          │ documentElement │
            │ Server Action      │ .classList      │
            ▼                    │ + localStorage  │
   ┌──────────────────┐          ▼                 │
   │ merchantAction   │    .dark on <html>         │
   │ mode:"read"      │    → globals.css:294       │
   │ + zod schema     │                            │
   └────────┬─────────┘                            │
            │ ctx.tenantId (from session, never a param)
            ▼                                      │
   ┌──────────────────────────────────┐            │
   │ searchMerchantSurface(tenantId,q)│            │
   │  scopedDb(tenantId)              │            │
   │   ├─ product.findMany  take 5    │            │
   │   └─ order.findMany    take 5    │            │
   └────────┬─────────────────────────┘            │
            │                                      │
            ▼                                      ▼
      ┌───────────────────────────────────────────────────────┐
      │            Postgres (Neon) — tenant-filtered           │
      └───────────────────────────────────────────────────────┘
                               ▲
                               │
   ┌───────────────────────────┴──────────────────────────────┐
   │  GET /dashboard  (Server Component, no client JS)        │
   │                                                          │
   │  requireMerchantContext()  ──► ctx.tenantId              │
   │           │                                              │
   │           ▼                                              │
   │  overviewMetrics(tenantId, since)   ── Promise.all ──┐   │
   │    ├─ order.aggregate  _sum.totalXaf   (revenue)     │   │
   │    ├─ order.groupBy    by state        (open count)  │   │
   │    ├─ orderItem.aggregate _sum.quantity(units)       │   │
   │    ├─ order.groupBy    by customerPhone (customers)  │   │
   │    └─ order.findMany   placedAt+totalXaf ──┐         │   │
   │                                             │        │   │
   │                          bucketByDay()  ◄───┘        │   │
   │                          (JS, Africa/Douala UTC+1)   │   │
   │                                 │                    │   │
   │  recentOrders(tenantId) ────────┼────────────────────┘   │
   │    order.findMany take 5 desc   │                        │
   │                                 ▼                        │
   │   <MetricCards/> <RevenueBars/> <RecentOrders/>          │
   │   colours from bg-chart-1 / semantic tokens only         │
   └──────────────────────────────────────────────────────────┘
```

### Recommended file layout

```
src/components/
├── app-sidebar.tsx                 # MODIFY — add NAV_GROUPS structure
├── dashboard-topbar-search.tsx     # REPLACE — becomes the ⌘K trigger + dialog host (client)
├── theme-toggle.tsx                # NEW — client island, next-themes useTheme()
├── theme-provider.tsx              # NEW — thin "use client" wrapper over next-themes
├── notification-bell.tsx           # NEW — decorative, or inline in layout
└── ui/
    ├── combobox.tsx                # NEW via shadcn add
    └── input-group.tsx             # NEW via shadcn add (transitive)

src/app/(dashboard)/
├── layout.tsx                      # MODIFY — header controls, mount ThemeProvider
└── dashboard/
    ├── page.tsx                    # REPLACE — real Overview
    ├── overview-metrics.tsx        # NEW — metric card row (server-rendered)
    ├── revenue-bars.tsx            # NEW — hand-rolled 7-bar chart (server-rendered)
    └── recent-orders.tsx           # NEW — reuses OrderStateChip + formatXaf

src/server/
├── dashboard/queries.ts            # NEW — overviewMetrics(), recentOrders()
└── search/
    ├── queries.ts                  # NEW — searchMerchantSurface() (server-only)
    └── actions.ts                  # NEW — merchantAction({ mode: "read" }) wrapper

src/app/layout.tsx                  # MODIFY — add suppressHydrationWarning to <html>
src/lib/strings/index.ts            # MODIFY — new copy under dashboard.*
```

### Pattern 1: Nav grouping without breaking the contract test

`SidebarGroupLabel` is already exported from `src/components/ui/sidebar.tsx` (line 433, in the export block at line 739-762) — no new primitive needed.

The change to `app-sidebar.tsx` is structural only: turn the flat `NAV_ITEMS: readonly NavItem[]` (line 95) into `NAV_GROUPS: readonly { label: string; items: readonly NavItem[] }[]`, and render one `<SidebarGroup>` per group with a `<SidebarGroupLabel>{group.label}</SidebarGroupLabel>` above its `<SidebarGroupContent><SidebarMenu>`.

**Three assertions in `tests/unit/dashboard-nav.test.ts` constrain this file specifically:**

1. `it("offers every dashboard destination")` (line 212) — checks `sidebarCode.includes(\`"${href}"\`)` for each of the 7 `REQUIRED_HREFS`. Grouping does not move the href string literals, so this stays green. **But note the `OVERVIEW_HREF` indirection at `app-sidebar.tsx:87`**: the literal `"/dashboard"` is present on that line, which is what satisfies the check. Do not refactor `OVERVIEW_HREF` away or inline it into a template string.
2. `it("marks the active destination with aria-current")` (line 231) — regex `/aria-current=(?:"page"|\{[^}]*"page"[^}]*\})/`. `app-sidebar.tsx:191` already satisfies this; keep it.
3. `it("inlines no user-facing copy")` (line 244) — **this test scans `app-sidebar.tsx` ONLY** (`SIDEBAR_FILE` at line 43). The three new group labels must come from `strings.dashboard.nav.*`. Exact failure shape: `QUOTED_PROSE` (line 181) matches any quoted run, `looksLikeProse` (line 183) fails a value of **3+ words all matching `/^[A-Za-z][A-Za-z'’]*$/`**. So `"General"` (1 word) would technically pass the test — but C-3 in CLAUDE.md still requires it in `strings`. Put them in `strings`.

### Pattern 2: Gold budget — exactly what the test counts

```typescript
// tests/unit/dashboard-nav.test.ts:189
const GOLD_VARIANT = /variant="gold"/g;
```

It counts that **literal string only**, across every `.tsx` under `src/app` and `src/components` (`GOLD_SCAN_DIRS`, line 46), with comments blanked but string literals preserved (`stripComments`, line 95).

Two assertions:
- `app-sidebar.tsx` must contain **exactly 1** (`toBe(1)`, line 289) — not zero. Preserve the `<Badge variant="gold">` at `app-sidebar.tsx:197`.
- Any **other** file with count > 0 must have a basename matching `/order-state/` (`ORDER_STATE_CHIP`, line 80).

**Practical implications for this task:**
- New header controls and the Overview page must contain **zero** occurrences of the literal `variant="gold"`.
- Rendering `<OrderStateChip state={...}/>` in the recent-orders list is **safe** — the `variant="gold"` literal lives inside `src/components/order-state-chip.tsx`, which is the authorized second spender. The Overview page never writes the literal.
- `bg-chart-3` resolves to gold-500 (`globals.css:136`). It would **not** trip this test (different string), but it would visually spend gold on decoration, which is exactly what the budget exists to prevent. **Use `bg-chart-1` (brand-600) for the single revenue series.**

### Pattern 3: The colour ban that actually governs new files

`tests/unit/surface-token-isolation.test.ts` scans `SHARED_DIRS = ["src/app", "src/components"]` (line 50), which includes every file this task creates:

```typescript
// line 146
const LITERAL_COLOUR = /#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?\b|\boklch\(|\brgba?\(|\bhsla?\(/;
// line 149
const PALETTE_UTILITY = /\b(zinc|slate|blue|amber|emerald|red|green|yellow|indigo|gray)-[0-9]{2,3}\b/;
```

- **Ban 1** kills any inline hex/oklch/rgb/hsl. A recharts `ChartConfig` with `color: "#2563eb"` fails. So does `style={{ background: "oklch(...)" }}`.
- **Ban 2** kills `bg-slate-100`, `text-blue-600`, `border-emerald-500`. Note it does **not** match `chart-1` (single digit, and `chart` is not in the alternation) or `gold-accent`.
- Ban 4 (storefront surface attribute outside `src/app/s`) and ban 6 (`brand-accent` outside the storefront) are also live — do not use `brand-accent` anywhere in this task's output. D-12 makes the merchant's chosen accent storefront-only.

Legal colour vocabulary for everything in this task: `bg-background`, `bg-card`, `bg-muted`, `bg-primary`, `bg-chart-1`…`bg-chart-5`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-sidebar*`, `bg-gold-accent` (dashboard side only, and don't), `text-success` / `bg-success`.

### Pattern 4: The search Server Action — first `mode: "read"` caller in the codebase

```bash
$ grep -rn 'mode: "read"' src/
src/server/merchant/action.ts:67:  mode: "read" | "write";
```

`merchantAction` supports read mode (`src/server/merchant/action.ts:66-93`) but **nothing uses it yet**. This search action is the first. The signature:

```typescript
export function merchantAction<S extends z.ZodType, R>(config: {
  mode: "read" | "write";
  schema: S;
  handler: (ctx: MerchantContext, input: z.infer<S>) => Promise<ActionResult<R>>;
})
```

`mode: "read"` skips the `ctx.canWrite` gate (line 88) — correct, because a merchant on an expired trial should still be able to look at their own data.

The critical security property: **`ctx.tenantId` comes from `requireMerchantContext()` inside the wrapper**, so no `tenantId` ever crosses the client boundary. This matches `tests/unit/no-tenant-id-param.test.ts`'s enforced invariant that `requireMerchantContext()` takes no parameters.

```typescript
// src/server/search/queries.ts — sketch
import "server-only";
import { scopedDb } from "@/server/db/tenant-scoped";

const RESULT_LIMIT = 5;

export async function searchMerchantSurface(tenantId: string, q: string) {
  const db = scopedDb(tenantId);
  const [products, orders] = await Promise.all([
    db.product.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      orderBy: { updatedAt: "desc" },
      take: RESULT_LIMIT,
      select: { id: true, name: true, active: true, basePriceXaf: true },
    }),
    db.order.findMany({
      where: {
        OR: [
          { orderNumber: { contains: q, mode: "insensitive" } },
          { customerName: { contains: q, mode: "insensitive" } },
          { customerPhone: { contains: q } },
        ],
      },
      orderBy: { placedAt: "desc" },
      take: RESULT_LIMIT,
      select: { id: true, orderNumber: true, customerName: true, state: true, totalXaf: true },
    }),
  ]);
  return { products, orders };
}
```

**Why this is tenant-safe:** the extension at `src/server/db/tenant-scoped.ts:128-144` handles `findMany` in the `default` arm — `a.where = { ...(a.where as object), tenantId }`. A top-level `OR` array plus a sibling `tenantId` key is an implicit **AND** in Prisma, so the tenant filter cannot be escaped by the `OR`. Both `Product` and `Order` are in `REGISTERED_MODELS` (`tenant-scoped.ts:57`, `:60`), so an unregistered-model throw is not a risk. [VERIFIED: read `src/server/db/tenant-scoped.ts` this session]

### Pattern 5: Overview metrics — four queries, one `Promise.all`

```typescript
// src/server/dashboard/queries.ts — sketch
import "server-only";
import { scopedDb } from "@/server/db/tenant-scoped";
import type { OrderState } from "@/server/db/enums";

/** Money is only real once a human has confirmed it. Excludes ORDER_PLACED,
 *  PAYMENT_PENDING, PAYMENT_CLAIMED and DISPUTED on purpose. */
const EARNED_STATES: readonly OrderState[] = ["CONFIRMED", "FULFILLED"];

/** Work still waiting on the merchant. Deliberately UNWINDOWED — a backlog
 *  is not a period measure (see Open Question 1). */
const OPEN_STATES: readonly OrderState[] = [
  "ORDER_PLACED", "PAYMENT_PENDING", "PAYMENT_CLAIMED", "CONFIRMED",
];

export async function overviewMetrics(tenantId: string, since: Date) {
  const db = scopedDb(tenantId);
  const [revenue, openOrders, units, phonesInWindow, phonesBefore, chartRows] =
    await Promise.all([
      db.order.aggregate({
        where: { placedAt: { gte: since }, state: { in: [...EARNED_STATES] } },
        _sum: { totalXaf: true },
      }),
      db.order.count({ where: { state: { in: [...OPEN_STATES] } } }),
      db.orderItem.aggregate({
        where: { order: { placedAt: { gte: since }, state: { in: [...EARNED_STATES] } } },
        _sum: { quantity: true },
      }),
      db.order.groupBy({ by: ["customerPhone"], where: { placedAt: { gte: since } } }),
      db.order.groupBy({ by: ["customerPhone"], where: { placedAt: { lt: since } } }),
      db.order.findMany({
        where: { placedAt: { gte: since }, state: { in: [...EARNED_STATES] } },
        select: { placedAt: true, totalXaf: true },
      }),
    ]);

  const seenBefore = new Set(phonesBefore.map((r) => r.customerPhone));
  const newCustomers = phonesInWindow.filter(
    (r) => !seenBefore.has(r.customerPhone),
  ).length;

  return {
    revenueXaf: revenue._sum.totalXaf ?? 0,   // _sum is NULL on zero rows
    openOrders,
    unitsSold: units._sum.quantity ?? 0,
    newCustomers,
    daily: bucketByDay(chartRows, since),      // 7 entries, JS-side
  };
}
```

**Data provenance for each metric** (all traced to `prisma/schema.prisma`):

| Card | Backing field(s) | Line(s) | Honest? |
|------|-----------------|---------|---------|
| Revenue (7d) | `Order.totalXaf` filtered by `Order.state` ∈ {CONFIRMED, FULFILLED}, `Order.placedAt` | `schema.prisma:444`, `:435`, `:458` | ✅ Clean |
| Open orders | `Order.state` count | `schema.prisma:435` | ✅ Clean |
| Units sold (7d) | `sum(OrderItem.quantity)` via relation filter on `order` | `schema.prisma:486`, `:476` | ✅ Clean |
| New customers (7d) | `distinct Order.customerPhone` in window **minus** distinct before window | `schema.prisma:439` | ⚠️ **Proxy, not a real entity** — see Pitfall 1 |

**Index alignment:** `Order` carries `@@index([tenantId, state, placedAt])` (`schema.prisma:467`), which is exactly the shape `scopedDb`'s injected `tenantId` + the `state`/`placedAt` filters ride. `OrderItem` carries `@@index([tenantId, orderId])` (`:490`). Both metric queries are index-covered.

### Pattern 6: Day-bucketing without `$queryRaw`

`eslint.config.mjs` bans `$queryRaw`/`$executeRaw` repository-wide via `no-restricted-syntax` (per CLAUDE.md's Architectural Constraints section). Prisma's `groupBy` cannot truncate a `DateTime` to a day. Therefore the chart's 7 buckets **must** be computed in Node from a `findMany` of `{ placedAt, totalXaf }` over the window. At pilot scale (Cameroon SMBs, 7 days) this is a small bounded set — but it is unbounded in principle. Add a defensive `take:` and document it.

```typescript
/** Cameroon is UTC+1 year-round (WAT, no DST), so a fixed offset is correct
 *  and Intl.DateTimeFormat with a timeZone is unnecessary. The server clock is
 *  the authority here, exactly as orders/format.ts documents for timestamps. */
const DOUALA_UTC_OFFSET_MINUTES = 60;
```

Bucket index = `Math.floor((placedAt + offset - since) / 86_400_000)`, clamped to `0..6`. Render each bar with `style={{ height: \`${pct}%\` }}` — a **percentage number** is not a colour, so ban 1 is unaffected. Colour with `bg-chart-1`.

### Pattern 7: Theme toggle placement

```tsx
// src/components/theme-provider.tsx
"use client";
import { ThemeProvider as NextThemesProvider } from "next-themes";
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem
                        disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
```

**Mount it in `src/app/(dashboard)/layout.tsx`, not the root layout.** Two reasons: (a) it keeps next-themes out of the storefront bundle, and (b) it is a merchant-surface feature — the storefront has no dark mode (`globals.css:174-176` states "There is no dark variant of this selector, deliberately"). Passing `{children}` through a `"use client"` provider is React composition — the children are still server-rendered. The dashboard layout stays a Server Component.

`attribute="class"` writes `.dark` to `document.documentElement`, which is what `globals.css:5`'s `@custom-variant dark (&:is(.dark *))` and the `.dark { … }` block at line 294 are keyed on. [VERIFIED: read `globals.css` this session]

**One required root-layout edit:** `src/app/layout.tsx:54-57` currently has no `suppressHydrationWarning`. next-themes mutates `<html>` before React hydrates, so it must be added:

```tsx
<html lang="en" suppressHydrationWarning className={...}>
```

The 3-way control itself: `src/components/ui/dropdown-menu.tsx` is already installed and is a `"use client"` module — use it with three items (Light / System / Dark) reading `useTheme()`'s `{ theme, setTheme }`. Render the trigger icon from `resolvedTheme` **after mount only** (see Pitfall 3).

### Anti-Patterns to Avoid

- **Making `(dashboard)/layout.tsx` a Client Component** to host the theme toggle or search dialog. It calls `requireMerchantContext()` and `pendingClaimCount()` — both server-only. Keep the layout a Server Component and drop in small client islands.
- **Passing `tenantId` from the client** to the search action. Contradicts C-2 and the invariant `tests/unit/no-tenant-id-param.test.ts` enforces.
- **Using `variant="gold"` anywhere new.** It is a counted budget, not a style choice.
- **Making the metrics window govern the open-orders count.** A 9-day-old unfulfilled order is still work; hiding it behind a 7-day filter turns a to-do list into a lie.
- **Labelling distinct-phone-count as "New customers" without the before-window exclusion.** That is a "customers who ordered" count wearing a different name.
- **Adding a `Customers` nav item.** CONTEXT explicitly defers Customers, and adding an href without also adding it to `REQUIRED_HREFS` (or vice versa) fails `dashboard-nav.test.ts`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Combobox keyboard nav + ARIA | Custom `<div role="listbox">` with arrow-key handling | `@base-ui/react/combobox` via shadcn `base-nova` `combobox` | Roving focus, `aria-activedescendant`, type-ahead, virtual anchoring, `Escape`/`Enter` semantics, RTL — all shipped, all already in `node_modules` |
| Modal focus trap + scroll lock | Custom overlay | Existing `src/components/ui/dialog.tsx` (Base UI) | Already installed and already used by `claims/reject-dialog.tsx` |
| Theme persistence + FOUC prevention | Inline `<script>` + `useState` | `next-themes` | The blocking pre-paint script, `matchMedia` subscription, and cross-tab `storage` sync are three separate correctness bugs waiting to happen |
| XAF currency formatting | New `Intl.NumberFormat` instance | `formatXaf` from `src/app/(dashboard)/dashboard/orders/format.ts:27` | Already `fr-CM` / `XAF` / `maximumFractionDigits: 0`, already shared by the orders list and detail pages, deliberately not `server-only` so client components can use it |
| Relative timestamps on recent orders | `Date` arithmetic | `formatRelativeTime` from the same `format.ts` | Uses `Intl.RelativeTimeFormat` with the standard divisions ladder (`format.ts:50-61`) |
| Order state pill | New badge | `<OrderStateChip>` / `<OrderChannelChip>` from `src/components/order-state-chip.tsx` | Already the authorized gold spender; already imported by `dashboard/orders/page.tsx:5` |
| Table markup for recent orders | Custom `<div>` grid | `src/components/ui/table.tsx` | Same primitives `dashboard/orders/page.tsx:6-14` uses; keeps the two lists visually consistent |
| Sidebar section headings | Custom `<h3>` | `SidebarGroupLabel` (`ui/sidebar.tsx:433`) | Already exported, already styled against `--sidebar-*` |

**Key insight:** This codebase has spent four phases building shared, contract-tested primitives. Every piece of this task except the bar chart and the day-bucketing function already exists somewhere in `src/` or in `node_modules/@base-ui/react`. The plan should read as "compose these" far more than "build these."

## Common Pitfalls

### Pitfall 1: There is no `Customer` model — the metric can be built, but not named carelessly

**What goes wrong:** A "New customers" card gets built on `Order.customerName`, or on a raw distinct-`customerPhone` count, and silently means something other than what it says.

**Why it happens:** `prisma/schema.prisma` has `User`, `Session`, `Account`, `Member`, `Organization`, `Category`, `Product`, `ProductVariant`, `ProductImage`, `Order`, `OrderItem`, `OrderEvent`, `PaymentClaim`, `MerchantPaymentSettings`, `StorefrontTheme`, `StorefrontPage` — and **no customer entity of any kind**. Storefront checkout is anonymous; `Order.customerName` (line 438) and `Order.customerPhone` (line 439) are snapshots, exactly like `OrderItem.productName` (line 483).

**How to avoid:** The one thing that makes this workable is that **`customerPhone` is normalized before persistence**: `src/server/checkout/actions.ts:385` runs `normalizeCameroonMsisdn(customerPhone)` and fails the field on a non-Cameroon number (`:386-388`), then passes `msisdn` — not the raw input — to `placeOrder` (`:407`). So `groupBy(["customerPhone"])` cannot double-count `+237 6XX…` against `6XX…`. Use the two-query set-difference in Pattern 5 and label the card "New customers"; or use the one-query distinct count and label it "Customers who ordered". Do not mix them up.

**Warning signs:** A plan task that says "count customers" without naming `customerPhone`.

### Pitfall 2: `_sum` returns `null`, not `0`, when the window is empty

**What goes wrong:** A brand-new merchant's Overview renders `XAF NaN` or crashes in `formatXaf`.

**Why it happens:** Prisma's `aggregate({ _sum: { totalXaf: true } })` returns `{ _sum: { totalXaf: null } }` for zero matching rows — SQL `SUM()` over an empty set is `NULL`, not `0`. TypeScript types it as `number | null`, so under `strict` mode this is caught at compile time — but only if the plan does not reach for `!` or `as number`.

**How to avoid:** `revenue._sum.totalXaf ?? 0` and `units._sum.quantity ?? 0`. Never non-null-assert.

**Warning signs:** `!` or `as number` in a metrics query diff.

### Pitfall 3: Hydration mismatch from `navigator` and from `resolvedTheme`

**What goes wrong:** React logs a hydration error, or the ⌘/Ctrl glyph flickers.

**Why it happens:** Two separate SSR/client divergences collide in this task:
1. CONTEXT locks a platform-aware shortcut hint. `navigator.platform` / `navigator.userAgent` do not exist during SSR, so any first render that branches on them mismatches.
2. `useTheme()` from next-themes returns `undefined` for `resolvedTheme` on the server and on the first client render, by design.

**How to avoid:** The standard `mounted` gate in both places:

```tsx
const [mounted, setMounted] = React.useState(false);
React.useEffect(() => setMounted(true), []);
// render a neutral placeholder (or the Ctrl-K default) until mounted
```

For the shortcut hint specifically, note that CLAUDE.md names Cameroon/Windows as the target market — **default the server-rendered glyph to `Ctrl K`** and swap to `⌘K` post-mount on Mac, rather than the reverse. The current string `searchShortcutHint: "⌘K"` (`src/lib/strings/index.ts:533`) must become two strings.

**Warning signs:** A `navigator.` reference outside a `useEffect`, or a `resolvedTheme` read in the initial render path.

### Pitfall 4: The `strings.dashboard.topbar` comment block is now a lie

**What goes wrong:** `src/lib/strings/index.ts:527-533` carries an explicit block comment stating "VISUAL PLACEHOLDER ONLY … no search Server Action or query is wired to this copy anywhere in the codebase … `searchShortcutHint` in particular is decorative only; no keydown listener is registered anywhere in this task." Leaving that comment in place while shipping a real search is the exact failure mode this codebase's comment convention exists to prevent — a future reader trusts it and skips wiring something.

**How to avoid:** The plan must include an explicit task to rewrite that comment block (and the analogous one at `src/components/dashboard-topbar-search.tsx:7-16`, which says "Deliberately a Server Component — there is no state, no `onChange`, no keydown listener").

**Warning signs:** A diff that touches `dashboard-topbar-search.tsx` behaviour but not its header.

### Pitfall 5: `<Toaster />` is currently mounted twice

**What goes wrong:** `src/app/(dashboard)/layout.tsx` renders `<Toaster />` at line 144 (inside `<SidebarInset>`) **and again** at line 155 (as a sibling of `SidebarInset`, inside `SidebarProvider`). Both have justifying comments; each comment appears to have been written without seeing the other. Two sonner hosts means a `toast()` can render twice or race.

**How to avoid:** This task rebuilds that exact header/layout region. Remove one — keep the outer one at line 155 (its comment about storefront bundle separation is the more complete rationale) and delete the inner duplicate at line 144.

**Warning signs:** Not fixing it. This is a pre-existing bug that the task's blast radius happens to cover, and it is cheap to fix now.

### Pitfall 6: Dark mode and the storefront surface scope

**What goes wrong:** Setting `.dark` on `<html>` could, in principle, leak slate/blue dark tokens into `[data-surface="storefront"]`.

**Why it mostly doesn't:** Custom properties inherit, and the storefront scope declares its own values for `--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--radius` on a **descendant** element — descendant declarations beat inherited values regardless of selector specificity. The tokens it does **not** declare (`--gold-accent`, `--success`, `--sidebar-*`, `--chart-*`) are exactly the ones ban 3 of `surface-token-isolation.test.ts` already forbids on the storefront. Additionally, each tenant storefront is a **different origin** (`maboutique.einort.com`), so `localStorage` never carries a merchant's theme choice to a shopper.

**How to avoid:** Mount `ThemeProvider` in `(dashboard)/layout.tsx`, not the root layout. That is a defence-in-depth choice, not a strict necessity, and it also keeps next-themes out of the storefront bundle. Do not add a `.dark` variant to the storefront scope — `globals.css:174-176` says that omission is deliberate.

### Pitfall 7: A search Server Action is an unrated endpoint

**What goes wrong:** Typeahead fires one POST per keystroke; a merchant holding a key, or a scripted client, hammers Postgres.

**Why it happens:** `src/server/rate-limit.ts` defines named limiters for `slugCheck` (line 142), `signup` (155), `login` (177), `orderPlacement` (221), `claimSubmission` (244), `orderTracking` (261), `uploadPresign` (280) — **there is no search limiter**, and the file's own header states the convention is "One limiter per protected surface, each with its own `prefix`."

**How to avoid:** Debounce client-side (~200-250ms) **and** add a `searchLimiter` following the existing `createLimiter({ prefix, tokens, window })` shape. Note the module degrades to allow-all with a loud `console.warn` when Upstash is unconfigured (line 74), so this costs nothing in local dev.

### Pitfall 8: `contains` without `mode: "insensitive"`

**What goes wrong:** Searching `"shirt"` misses a product named `"Shirt"`. Postgres `LIKE` is case-sensitive.

**How to avoid:** Every `contains` on a text column gets `mode: "insensitive"`. Exception: `customerPhone` is a normalized MSISDN (digits only), so `mode` is unnecessary there.

**Also note:** `contains` produces `%q%`, which cannot use a B-tree index. There is no index on `Product.name` or `Order.customerName`. At pilot scale (Starter cap is 50 products; `activeProductCount` exists at `src/server/catalog/queries.ts:192`) this is a sequential scan over a tiny tenant-filtered set and is fine. Do **not** add `pg_trgm` or a full-text index in this task — that is scope creep, and `$queryRaw` is banned anyway.

## Code Examples

### Reading verified currency + time helpers (no new `Intl` instances)

```typescript
// Source: src/app/(dashboard)/dashboard/orders/format.ts:20-28, :44-46
const XAF_FORMATTER = new Intl.NumberFormat("fr-CM", {
  style: "currency",
  currency: "XAF",
  maximumFractionDigits: 0,
});
export function formatXaf(amountXaf: number): string {
  return XAF_FORMATTER.format(amountXaf);
}
```
Import as `import { formatRelativeTime, formatXaf } from "../orders/format";` — the module deliberately carries **no** `import "server-only"` (its own header explains why: `order-row-actions.tsx` is a Client Component that needs `formatXaf`), so it is safe on either side of the boundary.

### The nav item render shape to preserve when grouping

```tsx
// Source: src/components/app-sidebar.tsx:179-203
<SidebarMenuItem key={item.href}>
  <SidebarMenuButton
    isActive={current}
    className="h-auto min-h-11 text-sm font-semibold data-active:font-semibold data-active:text-sidebar-primary"
    aria-current={current ? "page" : undefined}
    render={<Link href={item.href} />}
  >
    <Icon aria-hidden="true" />
    <span>{item.label}</span>
    {item.badged && pendingClaims > 0 ? (
      <Badge variant="gold" className="ml-auto tabular-nums">{pendingClaims}</Badge>
    ) : null}
  </SidebarMenuButton>
</SidebarMenuItem>
```

Note `render={<Link href={...} />}` — that is the **Base UI** render-prop idiom, not Radix's `asChild`. Any new Base UI composition in this task follows the same convention.

The `min-h-11` is a documented 44px touch-target floor for this market's hardware (`app-sidebar.tsx:182-189`). New header controls (theme toggle, bell, admin button) should honour the same floor.

### Bar rendering that survives ban 1 and ban 2

```tsx
// Percentages are numbers, not colours — ban 1's regex does not match them.
// bg-chart-1 resolves through @theme inline (globals.css:26) to --chart-1,
// which is brand-600 in :root (globals.css:134) and brand-400 in .dark (:319).
<div className="flex h-32 items-end gap-2" role="img" aria-label={chartLabel}>
  {daily.map((day) => (
    <div key={day.iso} className="flex flex-1 flex-col items-center gap-1">
      <div
        className="w-full rounded-sm bg-chart-1"
        style={{ height: `${day.percentOfMax}%` }}
      />
      <span className="text-xs text-muted-foreground">{day.shortLabel}</span>
    </div>
  ))}
</div>
```

A bar chart is not readable by a screen reader. Pair it with an `aria-label` summary or a visually-hidden `<table>`; the accessibility floor in this codebase (see the `aria-current` reasoning in `dashboard-nav.test.ts:231-241`) treats "colour is never the only signal" as non-negotiable.

## State of the Art

| Old approach | Current approach in this repo | Evidence |
|--------------|-------------------------------|----------|
| shadcn on Radix + `asChild` | shadcn `base-nova` on `@base-ui/react` + `render={<El/>}` | `components.json` `"style": "base-nova"`; `app-sidebar.tsx:192` |
| `cmdk` for command palettes | Base UI `Combobox` / `Autocomplete` (built in since Base UI 1.x) | `node_modules/@base-ui/react/{combobox,autocomplete}/`; base-nova `combobox.json` deps `["cn","@base-ui/react"]` |
| `middleware.ts` | `src/proxy.ts` (Next 16 rename) | CLAUDE.md; `src/proxy.ts` exists |
| Prisma with implicit Rust query engine | Prisma 7 + explicit `@prisma/adapter-pg` driver adapter | `package.json`; `src/server/db/base.ts` |
| `findUnique` → `findFirst` tenant-scoping workaround | `extendedWhereUnique` (GA since Prisma 5) — no rewrite needed | `src/server/db/tenant-scoped.ts:136-143`, which explicitly documents rejecting the stale workaround |

**Deprecated/outdated in this context:**
- shadcn `command` — still published and still works, but architecturally wrong for a Base UI tree.
- `navigator.platform` — deprecated in the HTML spec. Prefer `navigator.userAgentData?.platform` with a `navigator.userAgent` regex fallback (`/Mac|iPhone|iPad/`). Both must run post-mount.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `next-themes@0.4.6` is the legitimate `pacocoursey/next-themes` package | Standard Stack, Package Audit | slopcheck was unavailable; planner must gate the install behind `checkpoint:human-verify`. Mitigating evidence: 26.5M weekly downloads, created 2020-10-10, repo URL present, no postinstall script |
| A2 | `next-themes` 0.4.6 works correctly under Next 16.3.1 + React 19.2.8 | Pattern 7 | Peer range explicitly includes `^19`, and the package is framework-agnostic (localStorage + classList + matchMedia). But 0.4.6 predates Next 16. If it misbehaves, fall back to the hand-rolled toggle in Alternatives |
| A3 | Cameroon/Douala is UTC+1 year-round with no DST | Pattern 6 | Off-by-one-hour day boundaries in the chart. Verify before pinning the constant |
| A4 | Pilot-scale 7-day order volume is small enough that `findMany` + JS bucketing is acceptable | Pattern 6 | Memory/latency on a high-volume merchant. Mitigate with an explicit `take:` and a comment |
| A5 | `_sum` returning `null` on empty aggregate is current Prisma 7.9.1 behaviour | Pitfall 2 | Low risk — this is SQL semantics, not a Prisma choice, and `strict` TypeScript surfaces it at compile time |
| A6 | `overviewMetrics` should count open orders **unwindowed** while everything else is windowed | Pattern 5, Open Question 1 | A design call, not a fact. Flag for the user |
| A7 | `bg-chart-1` is the right single-series colour (brand-600 light / brand-400 dark) | Pattern 3 | Aesthetic; `bg-chart-3` is gold and should be avoided regardless |

## Open Questions

1. **Should "open orders" respect the 7-day window?**
   - What we know: CONTEXT locks "fixed last-7-days for both the metrics cards and the revenue chart."
   - What's unclear: a windowed backlog count is arguably dishonest — a 9-day-old unfulfilled order is still work the merchant owes a customer, and hiding it makes the card a worse to-do list than `/dashboard/orders`'s own "Needs attention" chip.
   - Recommendation: make the revenue / units / new-customers cards windowed, and the open-orders card **unwindowed**, with the card's own sublabel saying so explicitly (e.g. "All time" vs "Last 7 days"). Surface this to the user during planning — it is a deliberate, narrow departure from the locked decision and should be confirmed, not assumed.

2. **"New customers" vs "Customers who ordered"?**
   - What we know: no `Customer` model exists; `customerPhone` is a normalized MSISDN and is a usable identity key.
   - What's unclear: which of the two the reference's Overview screenshot actually shows, and whether the 2-query set difference is worth it.
   - Recommendation: build the true "new" metric (2 queries, both cheap and index-covered by `@@index([tenantId, state, placedAt])`) and label it "New customers". If the planner prefers 1 query, the card must be relabelled.

3. **Does the Super Admin Panel button render for every merchant?**
   - What we know: `/admin` does not exist; `src/server/db/admin.ts` is import-restricted to `src/server/admin/**` (not yet built); Better Auth's admin plugin surface is configured in `src/server/auth/auth.ts`.
   - What's unclear: there is no role check available to gate this button today.
   - Recommendation: render it unconditionally as a visible stub with an inline comment naming Phase 6+ as its owner, per CONTEXT's discretion grant — but do **not** add it to `NAV_ITEMS`/`REQUIRED_HREFS`, since a nav entry pointing at a 404 is exactly what `dashboard-nav.test.ts`'s reachability contract is defending against. A header button is the honest placement.

4. **Does the notification bell need an empty popover, or is a bare icon acceptable?**
   - What we know: CONTEXT says "decorative notification bell". No notification data model exists.
   - Recommendation: a disabled-looking but focusable icon button with an `aria-label` from `strings`, and a header comment stating it is decorative — mirroring how `dashboard-topbar-search.tsx` handled the same situation in task `260903-ugl`. Do not add a badge (a `0` badge is exactly the anti-pattern `app-sidebar.tsx:66-68` argues against).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| npm registry (`ui.shadcn.com`) | `shadcn add combobox` | ✓ | — | Copy the JSON payload by hand |
| `@base-ui/react` combobox/autocomplete/dialog | Search modal | ✓ | 1.7.0 | — |
| `src/components/ui/{dialog,dropdown-menu,input,button,textarea,table,card,badge,kbd,separator}.tsx` | All four sub-tasks | ✓ | — | — |
| `slopcheck` | Package legitimacy gate | ✗ | — | All packages tagged `[ASSUMED]`; planner gates installs behind `checkpoint:human-verify` |
| Upstash Redis | Search rate limiter | optional | — | `src/server/rate-limit.ts:74` degrades to allow-all with a loud `console.warn` |
| Neon Postgres (`DATABASE_URL`) | Overview metrics | required at runtime | — | none |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `slopcheck` — mitigated by the `[ASSUMED]` tagging + human-verify gate described in the Package Legitimacy Audit.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10, two projects (`unit`, `isolation`) |
| Config file | `vitest.config.ts` (aliases re-declared here; `tsconfig.json` paths are **not** read by Vitest) |
| Quick run command | `npm run test:unit` → `vitest run tests/unit --reporter=dot` |
| Full suite command | `npm run test:full` → `dotenv -e .env.test -- vitest run` (needs a second Neon branch via `TEST_DATABASE_URL`) |
| Lint gate | `npm run lint` → `eslint . --max-warnings=0` |
| Type gate | `npm run typecheck` → `tsc --noEmit` |

### Behaviour → Test Map

| Behaviour | Test type | Automated command | File exists? |
|-----------|-----------|-------------------|-------------|
| All 7 nav hrefs still reachable after grouping | static contract | `npx vitest run tests/unit/dashboard-nav.test.ts` | ✅ exists |
| Gold budget still exactly 1 in sidebar, 0 in new files | static contract | same file, `it("spends the gold accent exactly twice…")` | ✅ exists |
| No literal colour / palette utility in new `.tsx` | static contract | `npx vitest run tests/unit/surface-token-isolation.test.ts` | ✅ exists (auto-covers new files — it recurses `src/app` and `src/components`) |
| No unused imports, no `any` in new modules | lint | `npm run lint` | ✅ exists |
| `overviewMetrics` returns 0 (not NaN/null) on an empty tenant | unit or isolation | `npx vitest run tests/isolation/…` | ❌ Wave 0 |
| Day-bucketing puts an order in the right bucket across a UTC+1 midnight | unit (pure fn) | `npx vitest run tests/unit/overview-buckets.test.ts` | ❌ Wave 0 |
| Search never returns another tenant's product/order | isolation | `npx vitest run tests/isolation/…` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run lint && npm run typecheck && npm run test:unit`
- **Per wave merge:** `npm run test:full`
- **Task gate:** all three green before completion

### Wave 0 Gaps
- [ ] `tests/unit/overview-buckets.test.ts` — pure-function test for `bucketByDay()`, including the UTC+1 boundary case and the empty-window case. This is the highest-value new test: it is pure arithmetic, needs no database, and the timezone edge is the most likely silent bug in the whole task.
- [ ] Extend `tests/isolation/` with a cross-tenant search assertion, following `tests/setup/seed-two-tenants.ts`'s fixed-identifier fixture style (`tenant-a-fixed-id`) so a failure names the leak directly.

*No new framework install needed — Vitest 4.1.10 and both projects are already configured.*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard control in this codebase |
|---------------|---------|-----------------------------------|
| V2 Authentication | yes | `requireMerchantContext()` per page (`src/server/merchant/context.ts`); the `(dashboard)` layout is explicitly **not** the boundary (`layout.tsx:20-43`) — the new Overview page must call it itself |
| V3 Session Management | yes (inherited) | Better Auth 1.6.29, host-only apex cookie; no change in this task |
| V4 Access Control | **yes — the sharp edge** | `scopedDb(tenantId)` extension. The search action is the new surface: it must derive `tenantId` from `merchantAction`'s `ctx`, never from client input |
| V5 Input Validation | yes | `zod` schema on the search action: `z.object({ q: z.string().trim().min(1).max(64) })`. Cap the length — an unbounded `contains` term is a free sequential scan |
| V6 Cryptography | no | Nothing in this task touches crypto |
| V7 Error Handling / Logging | partial | `merchantAction` rethrows unexpected errors uncaught by design (`action.ts` header) — do not swallow search errors into an empty result set |

### Known Threat Patterns

| Pattern | STRIDE | Mitigation in place / required |
|---------|--------|-------------------------------|
| Cross-tenant data leak via search | Information Disclosure | `scopedDb` injects `tenantId` into `where` for every non-create op (`tenant-scoped.ts:128-144`); top-level `OR` is AND-ed with it. **Add an isolation test.** |
| SQL injection | Tampering | Structurally impossible — Prisma parameterizes, and `$queryRaw`/`$executeRaw` are lint-banned repo-wide |
| Search-endpoint DoS / enumeration | Denial of Service | **Gap.** No `searchLimiter` exists. Add one + client-side debounce (Pitfall 7) |
| Forged `tenantId` in the search payload | Spoofing / Elevation | Prevented by design: the action's zod schema must contain only `{ q }`, and `merchantAction` reads identity from the session |
| Reflected merchant data in the modal | XSS | React escapes text by default; no `dangerouslySetInnerHTML` anywhere in this task |
| Theme script injection | Tampering | Using `next-themes` avoids hand-writing a `dangerouslySetInnerHTML` bootstrap script — one fewer place to get an injection wrong |

## Sources

### Primary (HIGH confidence)
- `package.json`, `components.json` — installed dependency set and shadcn style, read this session
- `prisma/schema.prisma:274-520` — `OrderState`, `Product`, `ProductVariant`, `Order`, `OrderItem` definitions and indexes
- `src/server/db/tenant-scoped.ts:44-152` — `REGISTERED_MODELS`, the `$allOperations` switch, and the documented `extendedWhereUnique` rationale
- `src/server/merchant/action.ts:62-93` — `merchantAction` signature and `mode` gate
- `src/server/checkout/actions.ts:14, 114-120, 382-408` — phone normalization before order placement
- `src/server/orders/queries.ts:55-192` — `ORDER_FILTERS`, `FILTER_STATES`, `listOrdersForMerchant`
- `src/server/catalog/queries.ts:38-107, :192` — `listProductsForMerchant`, `activeProductCount`
- `src/components/app-sidebar.tsx` (full) — nav structure, gold budget, Base UI `render` idiom
- `src/components/ui/sidebar.tsx:739-762` — exported primitives incl. `SidebarGroupLabel`
- `src/components/ui/badge.tsx:44-63` — `gold` / `success` / `outline-success` variants
- `src/app/(dashboard)/layout.tsx` (full) — shell structure, duplicate `<Toaster/>`, auth-boundary rationale
- `src/app/(dashboard)/dashboard/page.tsx` (full) — the placeholder being replaced
- `src/app/(dashboard)/dashboard/orders/format.ts:1-61` — `formatXaf`, `formatAbsoluteTime`, `formatRelativeTime`
- `src/app/(dashboard)/dashboard/orders/page.tsx:1-40` — table-list pattern to mirror
- `src/app/globals.css:5, 85-90, 122-147, 168-176, 286-372` — dark block, chart tokens, storefront scope, `sidebar-dark-scope`
- `src/app/layout.tsx:52-61` — root `<html>` (no `suppressHydrationWarning` today)
- `src/lib/strings/index.ts:469-545` — `dashboard` namespace, `nav`, `topbar` and its now-stale placeholder comment
- `tests/unit/dashboard-nav.test.ts` (full) — all five assertions and their exact regexes
- `tests/unit/surface-token-isolation.test.ts:40-320` — bans 1-6 and their regexes
- `src/server/rate-limit.ts:13-302` — limiter roster; no search limiter
- `node_modules/@base-ui/react/` directory listing + `autocomplete/index.d.ts` — confirms `combobox`/`autocomplete` ship in 1.7.0
- https://ui.shadcn.com/r/styles/base-nova/combobox.json — deps `["cn","@base-ui/react"]`, registryDeps `["button","input-group"]`
- https://ui.shadcn.com/r/styles/base-nova/input-group.json — deps `["cn"]`, registryDeps `["button","input","textarea"]`
- https://ui.shadcn.com/r/styles/base-nova/command.json — deps `["cn","cmdk"]`, imports `cmdk`
- https://ui.shadcn.com/r/styles/base-nova/chart.json — deps `["cn","recharts@3.8.0"]`
- `npm view` output for `cmdk`, `next-themes`, `recharts` (versions, peer deps, repo URLs, creation dates)
- `api.npmjs.org/downloads/point/last-week` for the same three packages
- `.planning/design-references/EINORT-COMMERCE-FRONT-END-MERCHANT-PLATFORM.md` (full) — confirmed token values, radius 0.75rem, dark-mode inversion rule, `AppShell` deferral note

### Secondary (MEDIUM confidence)
- CLAUDE.md's architecture/constraints sections — describes `eslint.config.mjs`'s `no-restricted-syntax` `$queryRaw` ban and the import-zone rules; not re-read from `eslint.config.mjs` directly this session

### Tertiary (LOW confidence)
- Cameroon UTC+1 / no-DST claim (A3) — training knowledge, not verified this session
- `next-themes` 0.4.6 behaviour specifically under Next 16 (A2) — inferred from peer ranges and the package's framework-agnostic implementation, not tested

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — every dependency claim was checked against `package.json`, `node_modules/`, or a live registry fetch
- Data availability for metrics: **HIGH** — read directly from `prisma/schema.prisma` and the checkout action; the "no Customer model" finding is definitive
- Contract-test constraints: **HIGH** — both test files read in full; exact regexes and assertion targets quoted
- Chart approach: **MEDIUM** — the hand-rolled recommendation is a judgement call weighted by ban 1 and bundle size, not a verified fact
- Theme library choice: **MEDIUM** — `next-themes` is well-established but unverified against Next 16 specifically, and slopcheck was unavailable

**Research date:** 2026-09-06
**Valid until:** 2026-10-06 (30 days — the codebase-internal findings are stable; re-verify the shadcn registry payloads and `next-themes` compatibility if planning slips past that)
