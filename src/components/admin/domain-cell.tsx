import { ExternalLink, Globe, GlobeLock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { strings } from "@/lib/strings";
import { domainStatusFor, type DomainLiveness } from "@/server/admin/domain";

import { DomainCopyButton } from "./domain-copy-button";

/**
 * `06-UI-SPEC.md § D` — the domain LIST cell, rendered as the Domain column on
 * `/admin` and as the full-size Domain card on `/admin/merchants/[id]`.
 *
 * ---------------------------------------------------------------------------
 * A SERVER COMPONENT ON PURPOSE — IT CALLS `domainStatusFor` DIRECTLY.
 * ---------------------------------------------------------------------------
 * `src/server/admin/domain.ts` opens with `import "server-only"`, which throws
 * at build time if a client bundle ever reaches it. This component imports that
 * function directly rather than receiving a pre-computed status as a prop,
 * because that IS the point of the pure derivation — "the chip state comes from
 * `domainStatusFor`, never inline JSX logic" (06-08-PLAN.md). The one piece of
 * this cell that genuinely needs a browser — the clipboard copy button — is
 * split into `domain-copy-button.tsx`, a small client island, so this file can
 * stay a Server Component. See that file's header for the full reasoning.
 *
 * ---------------------------------------------------------------------------
 * A LIST, TODAY ALWAYS ONE ENTRY. THAT IS THE WHOLE POINT.
 * ---------------------------------------------------------------------------
 * `domainStatusFor` returns an array so Phase 15 can add a second, merchant-
 * owned entry without this component being restructured — only the `.map`
 * below has to exist for that day to be a data change, not a rewrite. Do not
 * "simplify" this to a single object.
 *
 * ---------------------------------------------------------------------------
 * `rel="noopener"` ON THE EXTERNAL LINK IS NOT OPTIONAL (T-06-35).
 * ---------------------------------------------------------------------------
 * The opened tab is a merchant's storefront, reachable from the platform
 * owner's own console — the highest-privilege session in the product.
 * Omitting `rel="noopener"` would let that storefront reach back through
 * `window.opener` into this tab.
 *
 * ---------------------------------------------------------------------------
 * NO PROMISE OF A BRING-YOUR-OWN DOMAIN, NO "LATER" COPY, NO DEAD BUTTON.
 * ---------------------------------------------------------------------------
 * `06-UI-SPEC.md § D`'s "Do not write" row, restated as code: unshipped scope
 * is not a product surface. This component's whole copy surface is
 * `strings.admin.domain`, and that namespace carries none of those strings.
 */

export interface DomainCellProps {
  readonly slug: string;
  /** `Organization.status`, raw. Passed straight to `domainStatusFor`. */
  readonly status: string;
  readonly isPublished: boolean;
  readonly rootDomain: string;
  /**
   * `true` on the `/admin` list column and the `< md` stacked-card row —
   * tighter type and spacing for a dense table. `false` (default) on the
   * `/admin/merchants/[id]` Domain card, per § D "at full size".
   */
  readonly compact?: boolean;
}

const STATUS_CHIP: Readonly<
  Record<
    DomainLiveness,
    { readonly icon: typeof Globe; readonly variant: "outline-success" | "secondary" }
  >
> = {
  live: { icon: Globe, variant: "outline-success" },
  offline: { icon: GlobeLock, variant: "secondary" },
};

/** `http` only for a localhost root domain — the same rule every other
 * storefront-URL builder in this codebase applies (e.g. `storeOriginFor` in
 * `src/server/checkout/actions.ts`). Kept local: this is URL-scheme plumbing
 * for a link, not a domain-status fact, so it does not belong in the pure
 * `domainStatusFor` derivation. */
function storefrontUrlFor(host: string): string {
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

export function DomainCell({
  slug,
  status,
  isPublished,
  rootDomain,
  compact = false,
}: DomainCellProps) {
  const entries = domainStatusFor({ slug, status, isPublished, rootDomain });

  return (
    <div className={compact ? "flex flex-col gap-2" : "flex flex-col gap-3"}>
      {entries.map((entry) => {
        const chip = STATUS_CHIP[entry.status];
        const Icon = chip.icon;

        return (
          <div
            key={entry.host}
            className="flex min-w-0 flex-wrap items-center gap-2"
          >
            <span
              title={entry.host}
              className={
                compact
                  ? "min-w-0 truncate font-mono text-sm leading-normal font-medium text-foreground"
                  : "min-w-0 truncate font-mono text-base leading-normal font-medium text-foreground"
              }
            >
              {entry.host}
            </span>

            <Badge variant={chip.variant}>
              <Icon aria-hidden="true" />
              {entry.status === "live"
                ? strings.admin.domain.statusLive
                : strings.admin.domain.statusOffline}
            </Badge>

            <div className="ml-auto flex items-center gap-1">
              <DomainCopyButton host={entry.host} />

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="min-h-11 min-w-11"
                aria-label={strings.admin.domain.openLabel}
                render={
                  <a
                    href={storefrontUrlFor(entry.host)}
                    target="_blank"
                    rel="noopener"
                  />
                }
              >
                <ExternalLink aria-hidden="true" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
