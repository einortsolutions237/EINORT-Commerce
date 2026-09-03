import type { Metadata } from "next";

import { env } from "@/env";
import { strings } from "@/lib/strings";
import { activeProductCount } from "@/server/catalog/queries";
import { requireMerchantContext } from "@/server/merchant/context";
import { getPaymentSettings } from "@/server/payments/settings";
import { ensureStorefrontSeeded } from "@/server/theming/actions";
import { getEditorStorefront } from "@/server/theming/queries";
import {
  SECTION_TYPES,
  THEME_FIELDS,
  THEME_NON_TOKEN_FIELD,
} from "@/server/theming/registry";
import {
  sectionFieldMaxima,
  themeFieldMaxima,
  type SectionType,
} from "@/server/theming/schema";

import { EditorShell, type EditorSectionType } from "./editor-shell";

/**
 * `/dashboard/storefront-editor` (EDIT-02, EDIT-03).
 *
 * ---------------------------------------------------------------------------
 * THIS PAGE AUTHORIZES ITSELF.
 * ---------------------------------------------------------------------------
 * `requireMerchantContext()` is not inherited from `(dashboard)/layout.tsx` —
 * that file's own header explains why a Next 16 layout cannot be the gate: it
 * does not control whether its child segments render, and it does not re-run on
 * client-side navigation between sibling routes. Every page under `(dashboard)/`
 * calls the DAL itself; `React.cache()` makes the repeat call free (T-04-34).
 *
 * ---------------------------------------------------------------------------
 * THE DISABLED BUTTONS AND THE NOTICE ARE COURTESY ONLY (EDIT-03, D-13).
 * ---------------------------------------------------------------------------
 * `saveDraft`, `publishStorefront` and `discardDraft` are each reachable by a
 * POST that never loaded this page, and each calls `assertCanEditStorefront` as
 * its first handler statement — after `merchantAction({ mode: "write" })` has
 * already refused on `canWrite`. `canEditStorefront` travels down from here to
 * decide what the merchant READS, never what they may do. Nothing rendered here
 * is the control (T-04-05).
 *
 * ---------------------------------------------------------------------------
 * THE SEED CALL LIVES IN THIS AUTHENTICATED PATH AND NOWHERE PUBLIC.
 * ---------------------------------------------------------------------------
 * `ensureStorefrontSeeded` is idempotent — an `upsert` with an empty `update` on
 * both halves — and it is why an organization created before Phase 4 self-heals
 * on its first editor visit rather than needing a backfill. It is called HERE,
 * behind a session, and never on a storefront render: the public path is
 * anonymous and unrate-limited, so a lazy seed there would turn a URL and a loop
 * into free write amplification (Pitfall 11, T-04-11). Its result is
 * deliberately not branched on: a merchant whose trial expired gets a refusal
 * from the write gate and still opens a working editor, because
 * `getEditorStorefront` degrades an unseeded read to the flagship defaults.
 *
 * ---------------------------------------------------------------------------
 * THE IFRAME ADDRESS COMES FROM CONFIGURATION, NEVER FROM THE BROWSER.
 * ---------------------------------------------------------------------------
 * Pitfall 12. `previewOrigin` becomes the exact `targetOrigin` of every send the
 * shell makes, and `src/app/s/[slug]/preview/page.tsx` computes the editor's
 * origin from the same variable by the same expression — the two halves of the
 * protocol have to agree or every message is dropped by the other side's origin
 * check. It is also the local-development trap: `npm run dev` binds 3001 while
 * `NEXT_PUBLIC_ROOT_DOMAIN` says 3000 in every example env file, so a host read
 * from the browser would silently disagree with what the preview expects.
 *
 * Read through `@/env` rather than a bare `process.env`, which is this repo's
 * standing rule (CLAUDE.md § Key Dependencies) and is what the preview route —
 * the other half of this protocol — already does. `/onboarding/plan` reads the
 * raw variable because it runs outside a validated-env context; this page does
 * not, and two spellings of one value on the two ends of an origin comparison is
 * exactly the drift that comparison cannot survive.
 *
 * ---------------------------------------------------------------------------
 * NO `max-w-*` CONTAINER, AND THERE IS NOTHING TO OPT OUT OF.
 * ---------------------------------------------------------------------------
 * The editor needs the viewport (04-UI-SPEC.md § Layout). `(dashboard)/layout
 * .tsx` stopped owning a width container in Phase 3 — its own header records
 * that content width is now a per-page decision — so this page simply declares
 * none. Nothing in the shared layout had to change for every other dashboard
 * screen.
 */

export const metadata: Metadata = {
  // Renders as "Storefront editor · EINORT" through the root layout's template.
  title: strings.editor.title,
};

/**
 * The theme panel's fields, with the one descriptor that is not a token removed.
 *
 * `THEME_FIELDS` carries `logoKey` because the merchant edits it on the same
 * panel — a UI grouping, and the registry's own header says so. But `logoKey` is
 * NOT a `themeTokensSchema` member, `saveDraft` takes only a document and a
 * token set, and `editorReducer` has no action that could carry it. Rendering it
 * anyway would give the merchant an upload control whose result is silently
 * discarded, which is worse than not offering one: 04-12-SUMMARY.md records the
 * write path a later plan must add (`requestLogoUpload`, a sibling action and
 * not a `kind` parameter), and until it exists the logo is written by
 * onboarding's `saveBranding` alone.
 *
 * Computed at module scope because it depends on nothing per-request.
 */
const EDITABLE_THEME_FIELDS = THEME_FIELDS.filter(
  (field) => field.key !== THEME_NON_TOKEN_FIELD,
);

/**
 * The rail's plain data, resolved from the `server-only` registry once.
 *
 * `SECTION_TYPES` and the Zod caps both live behind the server boundary, so the
 * labels, descriptors and `{n}/{max}` numbers are flattened HERE and travel to
 * the client as plain arrays and records. `sectionFieldMaxima` reads the caps
 * back out of `schema.ts` rather than restating them, which is the whole reason
 * a descriptor carries no cap of its own (see the registry's header).
 *
 * The assertion on `Object.fromEntries` is the one TypeScript forces: it widens
 * every key to `string` and cannot know the input was the complete key set. The
 * source of that key set is `SECTION_TYPES`, which is declared
 * `Readonly<Record<SectionType, …>>`, so a sixth section type is still a compile
 * error at the registry before it can ever reach this line.
 */
const SECTION_TYPE_DATA = Object.fromEntries(
  (Object.keys(SECTION_TYPES) as SectionType[]).map((type) => [
    type,
    {
      label: SECTION_TYPES[type].label,
      repeatable: SECTION_TYPES[type].repeatable,
      fields: SECTION_TYPES[type].fields,
      maxima: sectionFieldMaxima(type),
    },
  ]),
) as Record<SectionType, EditorSectionType>;

const THEME_MAXIMA = themeFieldMaxima();

export default async function StorefrontEditorPage() {
  const ctx = await requireMerchantContext();

  await ensureStorefrontSeeded({});

  const [editor, paymentSettings, productCount] = await Promise.all([
    getEditorStorefront(ctx.tenantId),
    getPaymentSettings(ctx.tenantId),
    activeProductCount(ctx.tenantId),
  ]);

  /*
   * The canonical builder, copied from `/onboarding/plan` and from the preview
   * route: `http` locally, `https` everywhere a real root domain is configured.
   * Two spellings of one rule is how the two drift, and here they are the two
   * ends of an origin comparison.
   */
  const rootDomain = env.NEXT_PUBLIC_ROOT_DOMAIN;
  const protocol = rootDomain.startsWith("localhost") ? "http" : "https";
  const storefrontUrl = `${protocol}://${ctx.storeSlug}.${rootDomain}`;

  /*
   * `publishedAt` becomes the epoch when the merchant has never published, so
   * the shell's `draftUpdatedAt > publishedAt` reads "no unpublished changes"
   * for a store nobody has touched — `getEditorStorefront` uses the same epoch
   * on the other side of the comparison, and for the same reason.
   */
  const publishedAt = (editor.publishedAt ?? new Date(0)).toISOString();

  return (
    <>
      {/*
       * The dashboard's per-page title, kept out of the layout flow: the publish
       * bar is this region's own header and carries the status line, and a
       * second visible row would spend vertical space on a screen whose whole
       * point is the two panes beneath it. Still announced, still in the
       * document, and the browser title comes from `metadata` above.
       */}
      <h1 className="sr-only">{strings.editor.heading}</h1>

      <EditorShell
        initialDocument={editor.document}
        initialTokens={editor.tokens}
        sectionTypes={SECTION_TYPE_DATA}
        themeFields={EDITABLE_THEME_FIELDS}
        themeMaxima={THEME_MAXIMA}
        imageBaseUrl={env.R2_PUBLIC_BASE_URL}
        previewUrl={`${storefrontUrl}/preview`}
        previewOrigin={storefrontUrl}
        storefrontUrl={storefrontUrl}
        canEditStorefront={ctx.canEditStorefront}
        draftUpdatedAt={editor.draftUpdatedAt.toISOString()}
        publishedAt={publishedAt}
        /*
         * Both nudge conditions are answered on the server and travel as
         * booleans. They belong to the merchant's settings panel and never to
         * the rendered page: `/preview` IS the storefront, and a merchant has to
         * see exactly the copy their customers would.
         */
        needsWhatsappNumber={
          paymentSettings?.whatsappNumber == null ||
          paymentSettings.whatsappNumber === ""
        }
        hasNoProducts={productCount === 0}
      />
    </>
  );
}
