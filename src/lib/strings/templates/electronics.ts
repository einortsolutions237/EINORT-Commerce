/**
 * Per-template copy for the `electronics` segment (TMPL-04, Phase 5).
 *
 * Spliced flat into `strings.templates` by `src/lib/strings/index.ts` — see
 * that namespace's own header for why this stays flat by template key rather
 * than nested under a segment key.
 *
 * Shape mirrors `strings.flagship` structurally (`name`, `segmentTag`,
 * `announcement`, `footerTagline`, `hero.{eyebrow,heading,body,ctaLabel,
 * ctaHref}`, `trustBar.item{One,Two,Three}.{heading,body}`,
 * `productGrid.{heading,viewAllLabel,viewAllHref}`,
 * `editorialSplit.{eyebrow,heading,body,ctaLabel,ctaHref}`,
 * `contact.{heading,body,ctaLabel}`) via `FlagshipCopy`
 * (`src/lib/strings/flagship.ts`, `typeof flagshipCopy` — the exact value
 * `strings.flagship` is assigned from) rather than a hand-declared duplicate
 * interface, so this namespace can never drift from `strings.flagship`'s own
 * type. Imported from `./flagship`, not `@/lib/strings`, because
 * `@/lib/strings` (`index.ts`) imports this module's own export back to
 * build `strings.templates` — importing `strings` here would be a circular
 * type reference (see `flagship.ts`'s header for the full explanation).
 *
 * Character caps every string here must satisfy (`src/server/theming/
 * schema.ts`): `heading` 120, `body` 280, `ctaLabel` 30, trust-bar `heading`
 * 48, trust-bar `body` 140, product-grid `heading` 80.
 *
 * Voice contract (`src/lib/strings/index.ts` lines 1-33): direct, second
 * person, no exclamation marks, no "Oops", no emoji.
 *
 * This plan (05-03) ships this namespace EMPTY. The outer `Partial` on the
 * exported type is why an unauthored template key simply has no entry, and
 * the inner `Partial` is why a template that omits a section (per its
 * registry row) simply omits that section's copy group. Plan 05-13 (Wave 3)
 * fills this file with the segment's 9 templates' real copy under this exact
 * type — no hand-widened or narrowed type at that point, this one stands.
 */

import type { TemplateKey } from "@/server/theming/registry";
import type { FlagshipCopy } from "../flagship";

export const electronicsTemplates: Partial<Record<TemplateKey, Partial<FlagshipCopy>>> = {};
