import "server-only";

import { cache } from "react";

import { scopedDb } from "@/server/db/tenant-scoped";

import { flagshipDefaultDocument, flagshipDefaultTokens } from "./defaults";
import {
  pageDocumentSchema,
  themeTokensSchema,
  type PageDocument,
  type ThemeTokens,
} from "./schema";

/**
 * The theming domain's reads — EDIT-01's public path and the editor's own load.
 *
 * Every export here is a plain read behind `scopedDb(tenantId)` — there is no
 * write in this file, and no caller may pass anything the client supplied as
 * `tenantId`; it always comes from `resolveTenantBySlug` (the storefront) or
 * from the session via `requireMerchantContext` (the editor). The wording is
 * `src/server/storefront/queries.ts`'s, verbatim, because the rule is the same
 * one and a second phrasing of it would eventually be a second, weaker rule.
 *
 * Three properties are load-bearing and none of them is an accident.
 *
 * ---------------------------------------------------------------------------
 * 1. IT NEVER WRITES (Pitfall 11).
 * ---------------------------------------------------------------------------
 * `getPublishedStorefront` runs on the anonymous, unauthenticated, unlimited
 * storefront render path. A lazy "seed the row if it is missing" here — which
 * is the obvious-looking fix the first time someone sees an unseeded store —
 * turns every hit on an unseeded store URL into a database write, and therefore
 * into a free write-amplification lever for anyone with a URL and a loop
 * (T-04-11). There is no `create`, no `update` and no `upsert` in this file and
 * there must never be one. Seeding happens ONLY in authenticated paths:
 * `ensureStorefrontSeeded` (the dashboard editor) and `saveBranding`
 * (onboarding), both in `src/server/theming/actions.ts`.
 *
 * ---------------------------------------------------------------------------
 * 2. IT NEVER THROWS ON BAD DATA (Pitfall 9, T-04-12).
 * ---------------------------------------------------------------------------
 * `safeParse`, never `parse`. A document the CURRENT registry cannot parse —
 * because `version` was bumped, because a settings key was renamed, because a
 * backfill wrote something wrong — degrades to `flagshipDefaultDocument()` /
 * `flagshipDefaultTokens()` with a `console.error`, because a live storefront
 * going white is strictly worse than a live storefront showing default copy.
 *
 * A MISSING ROW TAKES THE SAME PATH, and that is not a side effect: it is how a
 * pre-Phase-4 organization renders correctly with no migration and no backfill,
 * and how the millisecond between an organization existing and its seed landing
 * renders too. `StorefrontNotSeededError` exists for the WRITE paths and is
 * deliberately not imported here.
 *
 * This is the lenient half of a deliberate asymmetry. The STRICT half lives on
 * `publishStorefront`, which uses `parse` and refuses the promotion. Do not
 * "make them consistent" — see that handler's own comment for why each side is
 * the way it is.
 *
 * ---------------------------------------------------------------------------
 * 3. THE LOG LINE NAMES THE TENANT ID AND NOTHING ELSE (Phase 3 T-03-27).
 * ---------------------------------------------------------------------------
 * Its shape is copied from `resolveEntitlements`'s `SUB-01 degraded: …` line so
 * both read the same way in a Vercel log. No storage key, no presigned URL, no
 * settings content and no document body is ever interpolated into it: the
 * degraded document is by definition attacker-influenced merchant data, and a
 * log is not a safe place to render it.
 */

/** `StorefrontPage.pageType` for the storefront home page — the only page this phase has. */
const HOME_PAGE_TYPE = "home";

/** What the anonymous storefront render needs, and nothing more. */
export type PublishedStorefront = {
  document: PageDocument;
  tokens: ThemeTokens;
  /** The R2 derivative PREFIX, never a URL. `null` when no logo was uploaded. */
  logoKey: string | null;
};

/**
 * The storefront's ONE theming read (EDIT-01).
 *
 * `tenantId` comes from `resolveTenantBySlug`, which derived it from the `Host`
 * header — the storefront's untrusted-free channel (DOM-02). It is never a
 * path parameter, a query string or a form field.
 *
 * Two `findUnique`s in a `Promise.all` rather than one relation read: neither
 * model declares a relation to the other or to `Organization` (plan 04-01 —
 * `scopedDb` is the isolation mechanism, not a foreign key), so there is no
 * join to make. Both are single-row lookups on a unique index.
 *
 * ---------------------------------------------------------------------------
 * WRAPPED IN REACT'S `cache()`, AND NOT IN REDIS (plan 04-10, T-04-28).
 * ---------------------------------------------------------------------------
 * TWO callers read this per storefront render: `src/app/s/[slug]/layout.tsx`
 * needs the tokens and the logo for the chrome, and `src/app/s/[slug]/page.tsx`
 * needs the document for the section list. `cache()` dedupes them to one pair of
 * lookups inside a single render pass — the same per-render memoization
 * `resolveTenantBySlug` uses, and for the same two callers.
 *
 * It is PER-RENDER ONLY. Cross-request caching is deliberately not added here:
 * widening the Redis tenant cache to carry theme data would create an
 * `invalidateTenantHost` obligation on every publish (`src/server/tenant/
 * cache.ts` documents it), and the visible failure of forgetting it is a
 * merchant who publishes a colour change and still sees the old accent for up
 * to five minutes. One extra pair of indexed reads on an already-dynamic page
 * is the correct trade.
 *
 * `cache()` changes nothing about the no-write rule above — memoizing a read
 * does not make it a write, and there is still no `create`, `update` or
 * `upsert` in this file.
 */
export const getPublishedStorefront = cache(async function getPublishedStorefront(
  tenantId: string,
): Promise<PublishedStorefront> {
  const db = scopedDb(tenantId);

  const [page, theme] = await Promise.all([
    db.storefrontPage.findUnique({
      where: { tenantId_pageType: { tenantId, pageType: HOME_PAGE_TYPE } },
      select: { published: true },
    }),
    db.storefrontTheme.findUnique({
      where: { tenantId },
      select: { publishedTokens: true, logoKey: true },
    }),
  ]);

  const parsedDocument = pageDocumentSchema.safeParse(page?.published);
  const parsedTokens = themeTokensSchema.safeParse(theme?.publishedTokens);

  /*
   * The log fires only when a row EXISTS and fails to parse. A missing row is
   * the expected pre-seed state described in the header — logging it would
   * print a line for every request to every legacy store and drown the case
   * that actually needs a human.
   */
  if (page?.published != null && !parsedDocument.success) {
    console.error(
      `EDIT-01 degraded: tenant ${tenantId} has an unparseable published ` +
        `document; falling back to flagship defaults.`,
    );
  }
  if (theme?.publishedTokens != null && !parsedTokens.success) {
    console.error(
      `EDIT-01 degraded: tenant ${tenantId} has unparseable published brand ` +
        `tokens; falling back to flagship defaults.`,
    );
  }

  return {
    document: parsedDocument.success
      ? parsedDocument.data
      : flagshipDefaultDocument(),
    tokens: parsedTokens.success ? parsedTokens.data : flagshipDefaultTokens(),
    logoKey: theme?.logoKey ?? null,
  };
});

/** What `/dashboard/storefront-editor` loads before it renders. */
export type EditorStorefront = {
  document: PageDocument;
  tokens: ThemeTokens;
  logoKey: string | null;
  templateKey: string;
  /**
   * Raw, so the caller can answer "are there unpublished changes?" with
   * `draftUpdatedAt > publishedAt`.
   */
  draftUpdatedAt: Date;
  /** `null` until the merchant has published at least once. */
  publishedAt: Date | null;
};

/**
 * The editor's load (EDIT-02) — the DRAFT columns, not the published ones.
 *
 * Same `safeParse`-with-defaults posture as the public read, for a different
 * reason: an unparseable DRAFT must still let the merchant into the editor to
 * fix it. Throwing here would lock a merchant out of the only surface that can
 * repair the row, which is the same self-defeating loop the redirect ladder in
 * `src/server/merchant/context.ts` documents for `selectPlan`.
 *
 * `draftUpdatedAt` and `publishedAt` come back RAW rather than as a computed
 * `hasUnpublishedChanges` boolean, and that is the point (04-RESEARCH.md
 * Pattern 2). The comparison is two timestamps. The alternatives are both
 * worse: deep-comparing the two JSON documents on every dashboard render costs
 * a full parse of both on a page that only needs to decide whether to show one
 * status line, and an `isDirty` column is derived state stored — a second
 * source of truth that goes stale the first time a write path forgets to set
 * it.
 */
export async function getEditorStorefront(
  tenantId: string,
): Promise<EditorStorefront> {
  const db = scopedDb(tenantId);

  const [page, theme] = await Promise.all([
    db.storefrontPage.findUnique({
      where: { tenantId_pageType: { tenantId, pageType: HOME_PAGE_TYPE } },
      select: { draft: true, draftUpdatedAt: true, publishedAt: true },
    }),
    db.storefrontTheme.findUnique({
      where: { tenantId },
      select: { draftTokens: true, logoKey: true, templateKey: true },
    }),
  ]);

  const parsedDocument = pageDocumentSchema.safeParse(page?.draft);
  const parsedTokens = themeTokensSchema.safeParse(theme?.draftTokens);

  if (page?.draft != null && !parsedDocument.success) {
    console.error(
      `EDIT-01 degraded: tenant ${tenantId} has an unparseable draft ` +
        `document; falling back to flagship defaults.`,
    );
  }
  if (theme?.draftTokens != null && !parsedTokens.success) {
    console.error(
      `EDIT-01 degraded: tenant ${tenantId} has unparseable draft brand ` +
        `tokens; falling back to flagship defaults.`,
    );
  }

  return {
    document: parsedDocument.success
      ? parsedDocument.data
      : flagshipDefaultDocument(),
    tokens: parsedTokens.success ? parsedTokens.data : flagshipDefaultTokens(),
    logoKey: theme?.logoKey ?? null,
    /*
     * The column carries a database default, so an unseeded read still hands
     * the editor a template it can render. `templateKey` stays a plain string
     * rather than the `TemplateKey` union: the column is a `String` and D-03
     * keeps it independent of everything else, so narrowing belongs at the one
     * call site that maps it to a renderer, via `isTemplateKey`.
     */
    templateKey: theme?.templateKey ?? "flagship-fashion",
    /*
     * `new Date(0)` for an unseeded page, not `new Date()`. The epoch is
     * strictly less than any real `publishedAt`, so the caller's
     * `draftUpdatedAt > publishedAt` comparison reports "no unpublished
     * changes" for a store that has never been touched — reading the clock here
     * would instead claim unpublished changes on a document nobody has edited.
     */
    draftUpdatedAt: page?.draftUpdatedAt ?? new Date(0),
    publishedAt: page?.publishedAt ?? null,
  };
}
