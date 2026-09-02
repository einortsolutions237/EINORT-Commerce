"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { strings } from "@/lib/strings";
import type {
  StorefrontPageCreateInput,
  StorefrontThemeCreateInput,
} from "@/server/db/model-inputs";
import { scopedCreateData, scopedDb } from "@/server/db/tenant-scoped";
import { assertCanEditStorefront } from "@/server/entitlements/assert";
import { merchantAction } from "@/server/merchant/action";

import { flagshipDefaultDocument, flagshipDefaultTokens } from "./defaults";
import { StorefrontNotSeededError } from "./errors";
import {
  pageDocumentSchema,
  themeTokensSchema,
  type PageDocument,
  type ThemeTokens,
} from "./schema";

/**
 * The theming domain's writes — EDIT-02, EDIT-03 and ONB-04.
 *
 * `"use server"` is the first line and it is the ONLY marker here. The
 * server-boundary marker that `queries.ts` and `defaults.ts` carry is the wrong
 * one for this file and is deliberately not spelled out — the audit for that
 * boundary is a plain grep and this header must not be the thing it finds. The
 * two are mutually exclusive, and it is the Server Actions directive that makes
 * these reachable from the editor's client islands. Every export below is
 * therefore an async function Next can register as an endpoint — no exported
 * constant, no exported type. Anything a caller needs the shape of, it derives
 * with `Awaited<ReturnType<typeof …>>`.
 *
 * ---------------------------------------------------------------------------
 * NO TRIAL CHECK AND NO TENANT ID LIVE IN THESE HANDLERS.
 * ---------------------------------------------------------------------------
 * `mode: "write"` IS the read-only gate (D-08/SUB-02) — re-checking `canWrite`
 * here would create a second place for that rule to drift, and the wrapper
 * already refuses before the parse and before any database call, so a replayed
 * POST from an expired trial costs nothing.
 *
 * And NO SCHEMA IN THIS FILE CONTAINS A TENANT IDENTIFIER, a price, a product id
 * or a storage URL (T-04-04). The target of every write is `ctx.tenantId`,
 * resolved from the session before the handler runs, and `scopedDb` stamps it
 * LAST into both the `where` and the `create` halves of an upsert. There is no
 * field a direct POST could set to retarget any of this. The audit for that
 * boundary is a plain grep, which is why the token appears below only as
 * `ctx.tenantId` or as a Prisma selector.
 *
 * ---------------------------------------------------------------------------
 * PUBLISH IS ONE TRANSACTION OVER TWO SINGLE-ROW UPDATES. THAT IS WHY THE DATA
 * MODEL IS A DOCUMENT PER PAGE.
 * ---------------------------------------------------------------------------
 * `$queryRaw` and `$executeRaw` are banned repository-wide by
 * `no-restricted-syntax` in `eslint.config.mjs` (they are not intercepted by the
 * tenant-scope extension, verified empirically), and Prisma cannot express a
 * column-to-column assignment such as `SET published = draft` through
 * `updateMany`. A row-per-section model would therefore have made publishing an
 * N-row read-then-update loop whose correctness depends on the loop, the
 * transaction and the ordering all being right. With one row per page it is two
 * `update` calls in one `$transaction`, and a half-published storefront is not
 * representable. That constraint is the reason for the model, not a consequence
 * of it — see 04-RESEARCH.md Pattern 2.
 *
 * ---------------------------------------------------------------------------
 * NOTHING IN THIS DOMAIN IS SECTION-RENDERED (Pattern 12).
 * ---------------------------------------------------------------------------
 * A route that can take money or change order state is never assembled from
 * merchant-authored sections. These actions only ever touch `pageType: "home"`;
 * cart, checkout and order pages stay fixed Phase-3 layouts, outside the section
 * system entirely.
 */

/**
 * The one page this phase edits. `StorefrontPage` is keyed by
 * `@@unique([tenantId, pageType])` so the column already exists for the pages
 * Phase 5 will add — this constant is what keeps every selector in this file
 * naming the same one.
 */
const HOME_PAGE_TYPE = "home";

/** The template every storefront starts on this phase (TMPL-01, D-03). */
const DEFAULT_TEMPLATE_KEY = "flagship-fashion";

// ---------------------------------------------------------------------------
// saveDraft — EDIT-02
// ---------------------------------------------------------------------------

/**
 * The editor holds its draft in the browser and saves it WHOLESALE (D-07), so
 * this schema is the entire document and the entire token set rather than a
 * field-level patch. `pageDocumentSchema` and `themeTokensSchema` are the same
 * validators the publish gate and the preview receiver use — one boundary, three
 * doors.
 */
const saveDraftSchema = z.object({
  document: pageDocumentSchema,
  tokens: themeTokensSchema,
});

/**
 * `merchantAction`'s success arm is `{ ok: true } & R`, and `R` appears only in
 * the handler's return position, so TypeScript cannot infer it from the config
 * object — it has to be named (the `images/actions.ts` precedent).
 */
type SaveDraftData = {
  /** ISO, so the publish bar can recompute "unpublished changes" without a refetch. */
  draftUpdatedAt: string;
};

export const saveDraft = merchantAction<typeof saveDraftSchema, SaveDraftData>({
  mode: "write",
  schema: saveDraftSchema,
  handler: async (ctx, { document, tokens }) => {
    /*
     * EDIT-03 / D-13 / D-15, and it is the FIRST statement — before any database
     * call. Both `saveDraft` and `publishStorefront` are gated, not publish
     * alone: a draft a Starter merchant can save but never publish reads as a
     * bug, and it would leave writes on the table for an account with no write
     * entitlement (T-04-05). Throws `EditorLockedError`, which extends
     * `EntitlementError`, so `merchantAction`'s existing catch arm turns it into
     * a form-level message with no change to that file.
     */
    assertCanEditStorefront(ctx, strings.editor.starterViewOnly);

    const db = scopedDb(ctx.tenantId);
    const draftUpdatedAt = new Date();

    await db.$transaction(async (tx) => {
      const [page, theme] = await Promise.all([
        tx.storefrontPage.findUnique({
          where: {
            tenantId_pageType: {
              tenantId: ctx.tenantId,
              pageType: HOME_PAGE_TYPE,
            },
          },
          select: { id: true },
        }),
        tx.storefrontTheme.findUnique({
          where: { tenantId: ctx.tenantId },
          select: { id: true },
        }),
      ]);
      if (!page || !theme) throw new StorefrontNotSeededError(ctx.tenantId);

      /*
       * `published` AND `publishedTokens` ARE LEFT BYTE-IDENTICAL. That is the
       * whole of D-08's draft/publish split: a merchant editing their store must
       * be able to make any change at all, including a broken one, without a
       * customer ever seeing it. Adding either column to the `data` objects below
       * would silently turn every keystroke into a deploy. Plan 04-13's isolation
       * suite asserts the published halves are unchanged across a save.
       *
       * `draftUpdatedAt` is set EXPLICITLY rather than left to `@updatedAt`,
       * because it is half of the "are there unpublished changes?" comparison and
       * an implicit clock read would make that answer depend on write timing
       * nobody controls.
       */
      await tx.storefrontPage.update({
        where: { id: page.id },
        data: { draft: document, draftUpdatedAt },
      });
      await tx.storefrontTheme.update({
        where: { tenantId: ctx.tenantId },
        data: { draftTokens: tokens },
      });
    });

    return { ok: true as const, draftUpdatedAt: draftUpdatedAt.toISOString() };
  },
});

// ---------------------------------------------------------------------------
// publishStorefront — EDIT-02, EDIT-03, D-08
// ---------------------------------------------------------------------------

/**
 * Empty on purpose. Publishing promotes what is ALREADY STORED; it does not
 * accept a document. Taking one would make "publish" a second write path for
 * merchant content that skips whatever `saveDraft` did, and would hand a direct
 * POST a way to put a document straight onto the live storefront without it ever
 * having existed as a draft.
 */
const publishStorefrontSchema = z.object({});

type PublishStorefrontData = {
  /** ISO. The publish bar renders "Published just now" from this. */
  publishedAt: string;
};

export const publishStorefront = merchantAction<
  typeof publishStorefrontSchema,
  PublishStorefrontData
>({
  mode: "write",
  schema: publishStorefrontSchema,
  handler: async (ctx) => {
    assertCanEditStorefront(ctx, strings.editor.starterViewOnly);

    const db = scopedDb(ctx.tenantId);
    const publishedAt = new Date();

    await db.$transaction(async (tx) => {
      const [page, theme] = await Promise.all([
        tx.storefrontPage.findUnique({
          where: {
            tenantId_pageType: {
              tenantId: ctx.tenantId,
              pageType: HOME_PAGE_TYPE,
            },
          },
          select: { id: true, draft: true },
        }),
        tx.storefrontTheme.findUnique({
          where: { tenantId: ctx.tenantId },
          select: { id: true, draftTokens: true },
        }),
      ]);
      if (!page || !theme) throw new StorefrontNotSeededError(ctx.tenantId);

      /*
       * PARSE BEFORE PROMOTING — STRICT `parse`, NOT `safeParse`.
       *
       * This is the one gate that stops a draft written under an OLDER registry
       * from becoming the live storefront: `version: z.literal(1)` turns a
       * settings rename into a refused parse rather than a silent misread
       * (T-04-12). The draft was validated when it was saved, but the registry
       * can move underneath it between then and now.
       *
       * THE ASYMMETRY WITH `queries.ts` IS DELIBERATE AND MUST NOT BE "MADE
       * CONSISTENT". Strict here, lenient there, because the two failures land
       * on different people: a parse failure HERE is a refused publish the
       * merchant can see and act on, with `published` left exactly as it was, so
       * customers keep seeing the last good storefront. A parse failure on the
       * public read path is a customer looking at nothing, which is why that
       * path degrades to flagship defaults instead of throwing.
       */
      const document = pageDocumentSchema.parse(page.draft);
      const tokens = themeTokensSchema.parse(theme.draftTokens);

      // Two rows, one statement each, one transaction. See the file header for
      // why the data model was chosen to make this expressible without raw SQL.
      await tx.storefrontPage.update({
        where: { id: page.id },
        data: { published: document, publishedAt },
      });
      await tx.storefrontTheme.update({
        where: { tenantId: ctx.tenantId },
        data: { publishedTokens: tokens, publishedAt },
      });
    });

    /*
     * The publish bar's status line is rendered by the Server Component above
     * the editor, from `draftUpdatedAt`/`publishedAt`. Without this it keeps
     * saying "unpublished changes" until a hard reload — the same staleness the
     * payment-settings form hit (`src/server/payments/actions.ts`).
     */
    revalidatePath("/dashboard/storefront-editor");

    return { ok: true as const, publishedAt: publishedAt.toISOString() };
  },
});

// ---------------------------------------------------------------------------
// discardDraft — EDIT-02
// ---------------------------------------------------------------------------

/** Same reasoning as `publishStorefrontSchema`: the target is already stored. */
const discardDraftSchema = z.object({});

type DiscardDraftData = {
  /**
   * What the draft now is. The editor holds its state in the browser (D-07), so
   * without this payload a discard would leave the open editor showing the
   * content it just threw away until a full reload.
   */
  document: PageDocument;
  tokens: ThemeTokens;
};

export const discardDraft = merchantAction<
  typeof discardDraftSchema,
  DiscardDraftData
>({
  mode: "write",
  schema: discardDraftSchema,
  handler: async (ctx) => {
    assertCanEditStorefront(ctx, strings.editor.starterViewOnly);

    const db = scopedDb(ctx.tenantId);
    const draftUpdatedAt = new Date();

    const reverted = await db.$transaction(async (tx) => {
      const [page, theme] = await Promise.all([
        tx.storefrontPage.findUnique({
          where: {
            tenantId_pageType: {
              tenantId: ctx.tenantId,
              pageType: HOME_PAGE_TYPE,
            },
          },
          select: { id: true, published: true },
        }),
        tx.storefrontTheme.findUnique({
          where: { tenantId: ctx.tenantId },
          select: { id: true, publishedTokens: true },
        }),
      ]);
      if (!page || !theme) throw new StorefrontNotSeededError(ctx.tenantId);

      /*
       * THIS OVERWRITES. IT NEVER DELETES.
       *
       * D-08's no-hard-delete convention covers merchant-owned data, and
       * "discard my changes" is the exact request that looks like it wants a
       * delete: drop the draft row and let the read fall back. It must not.
       * Deleting would take the merchant's page row out of existence between the
       * discard and the next seed, and plan 04-13's isolation suite asserts the
       * row survives a discard. `setProductActive(false)` is the same shape of
       * decision one domain over.
       *
       * `published` is nullable — a merchant who has never published has nothing
       * to revert TO — so the fallback is the registry default rather than a
       * refusal. That is the same document a brand-new store gets, which is the
       * honest meaning of "undo everything I did".
       *
       * A safeParse-with-default rather than a strict parse: this reads the same
       * column the public path reads, so an unparseable `published` must not
       * strand the merchant with a draft they cannot revert.
       */
      const parsedDocument = pageDocumentSchema.safeParse(page.published);
      const parsedTokens = themeTokensSchema.safeParse(theme.publishedTokens);
      const document = parsedDocument.success
        ? parsedDocument.data
        : flagshipDefaultDocument();
      const tokens = parsedTokens.success
        ? parsedTokens.data
        : flagshipDefaultTokens();

      await tx.storefrontPage.update({
        where: { id: page.id },
        // `draftUpdatedAt` records when the draft column was last WRITTEN, which
        // is now. It is not a claim about whether the content differs from
        // `published` — that comparison belongs to the caller rendering the
        // status line, and this column must stay an honest write timestamp.
        data: { draft: document, draftUpdatedAt },
      });
      await tx.storefrontTheme.update({
        where: { tenantId: ctx.tenantId },
        data: { draftTokens: tokens },
      });

      return { document, tokens };
    });

    revalidatePath("/dashboard/storefront-editor");

    return { ok: true as const, ...reverted };
  },
});

// ---------------------------------------------------------------------------
// ensureStorefrontSeeded — ONB-04's self-heal for pre-Phase-4 organizations
// ---------------------------------------------------------------------------

/** Nothing to supply. The seed content comes from the registry, not the caller. */
const ensureStorefrontSeededSchema = z.object({});

export const ensureStorefrontSeeded = merchantAction({
  mode: "write",
  schema: ensureStorefrontSeededSchema,
  handler: async (ctx) => {
    /*
     * NO EDITOR GATE HERE, AND ITS ABSENCE IS DELIBERATE — DO NOT ADD ONE.
     *
     * D-13's view-only restriction is about SAVING and PUBLISHING, not about the
     * editor existing. A Starter merchant whose trial has ended must be able to
     * open a working editor and see their real storefront — that is the whole
     * proposition `strings.editor.starterViewOnly` describes ("try the editor as
     * much as you like"). Gating the seed would hand a legacy Starter
     * organization an empty editor and nothing to look at, which is a worse
     * refusal than the one D-13 actually asks for.
     */
    const now = new Date();
    const document = flagshipDefaultDocument();
    const tokens = flagshipDefaultTokens();

    /*
     * `upsert`, NOT `create`, and `update: {}` ON BOTH HALVES.
     *
     * Two properties come from that choice and both matter. It is idempotent
     * against a double submit or a double render, so calling it on every editor
     * visit is correct rather than merely tolerable; and it NEVER CLOBBERS AN
     * EXISTING MERCHANT'S WORK — an empty `update` means a tenant that already
     * has rows is read and left alone. A `create` would throw on the second
     * visit, and an `update` with data would quietly overwrite a published
     * storefront with defaults every time a merchant opened the editor.
     *
     * `scopedCreateData<T>()` is REQUIRED on both `create` halves: every
     * tenant-scoped model declares `tenantId` required with no default (that is
     * the nested-write defence), so the generated input demands a value the
     * caller must not supply — `scopedDb` stamps it into BOTH the `where` and the
     * `create` halves of an upsert, last, so anything passed here would be
     * overwritten anyway.
     */
    await scopedDb(ctx.tenantId).$transaction(async (tx) => {
      await tx.storefrontTheme.upsert({
        where: { tenantId: ctx.tenantId },
        create: scopedCreateData<StorefrontThemeCreateInput>({
          templateKey: DEFAULT_TEMPLATE_KEY,
          logoKey: null,
          draftTokens: tokens,
          // Published at seed time, exactly as at onboarding: a storefront that
          // exists but renders nothing is not a storefront (ONB-04).
          publishedTokens: tokens,
          publishedAt: now,
        }),
        update: {},
      });
      await tx.storefrontPage.upsert({
        where: {
          tenantId_pageType: {
            tenantId: ctx.tenantId,
            pageType: HOME_PAGE_TYPE,
          },
        },
        create: scopedCreateData<StorefrontPageCreateInput>({
          pageType: HOME_PAGE_TYPE,
          draft: document,
          published: document,
          publishedAt: now,
          draftUpdatedAt: now,
        }),
        update: {},
      });
    });

    return { ok: true as const };
  },
});
