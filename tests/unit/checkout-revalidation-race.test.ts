import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * CHK-02 — the order-placement action must invalidate NOTHING.
 * Installed by quick task 260901-6wq, which fixed the bug described below.
 *
 * ---------------------------------------------------------------------------
 * THE BUG: EVERY SHOPPER PLACED AN ORDER AND WAS TOLD THEIR CART WAS EMPTY.
 * ---------------------------------------------------------------------------
 * `submitCheckout` in `src/server/checkout/actions.ts` used to end with
 * `revalidatePath("/s/{slug}", "layout")`, one line after the call that empties
 * the basket. On all three channels — WhatsApp, Manual Transfer (MTN/Orange
 * Money) and Cash on Delivery — the shopper submitted, the order was written,
 * and the browser landed on `/cart` showing "Your cart is empty." They never
 * saw their order number, their D-12 tracking link or, on the manual-transfer
 * path, the payment instructions. The tracking link matters most: there is no
 * account to log into and the plaintext token is stored nowhere (the row holds
 * only its SHA-256 digest), so a shopper redirected away from the confirmation
 * has PERMANENTLY lost the way back to their own order.
 *
 * ---------------------------------------------------------------------------
 * THE MECHANISM.
 * ---------------------------------------------------------------------------
 * A cache-invalidation call inside a Server Action makes Next re-render the
 * route the user is CURRENTLY ON as part of that same action's response. Here
 * that route is `/checkout`, and `src/app/s/[slug]/checkout/page.tsx` opens
 * with `payable.length === 0 -> redirect("/cart")`. The basket is empty at that
 * instant precisely BECAUSE the order just succeeded, so the guard fired, and a
 * server-issued redirect beats the client's `setOutcome(result)` in
 * `checkout-form.tsx`. Dev-server signature: `POST /checkout` 200, immediately
 * followed by `GET /cart`.
 *
 * ---------------------------------------------------------------------------
 * WHY "JUST SCOPE THE PATH NARROWER" IS NOT THE FIX. DO NOT TRY IT.
 * ---------------------------------------------------------------------------
 * Revalidating the storefront root, the PDP route and the cart page instead of
 * the whole layout — so that the open `/checkout` route is not a target — does
 * not work, and that is read from the installed package, not inferred:
 *
 *   · `node_modules/next/dist/server/web/spec-extension/revalidate.js` carries
 *     Next's own `// TODO: only revalidate if the path matches` directly above
 *     the line that sets `store.pathWasRevalidated`. Path matching is not
 *     implemented. Any path, any type, sets the flag.
 *   · `node_modules/next/dist/server/app-render/action-handler.js` then derives
 *     `skipPageRendering` from that flag ALONE — the requested path is never
 *     consulted — so every revalidating action re-renders the current page.
 *
 * `refresh()` sets the same flag (`ActionDidRevalidateDynamicOnly`), and so
 * does writing a cookie from the action, which is why a "just placed an order"
 * signal read by the page would itself force the re-render it was meant to
 * survive. That is why this guard forbids the whole family rather than one
 * name: `revalidateTag`, `updateTag` and `refresh` would resurrect the
 * identical bug wearing different letters.
 *
 * ---------------------------------------------------------------------------
 * WHY THE HEADER BUBBLE DOES NOT NEED THE CALL.
 * ---------------------------------------------------------------------------
 * `StoreHeader` is rendered by each storefront `page.tsx`, not by
 * `src/app/s/[slug]/layout.tsx`, so the `"layout"` scope was never buying it
 * anything. Every one of those pages is dynamic (`getCurrentCart` awaits
 * `cookies()`), so each navigation re-reads the cart from Redis, and the client
 * Router Cache's `staleTimes.dynamic` default has been 0s since Next 15, so no
 * <Link> navigation serves a stale count. The accepted cost is back/forward
 * only: the browser restores those entries regardless of staleness, so the
 * pre-order basket may flash on Back and the bubble on the confirmation screen
 * itself keeps its pre-order count. Both self-heal on the next interaction.
 *
 * ---------------------------------------------------------------------------
 * `src/server/cart/actions.ts` LEGITIMATELY KEEPS ITS CALL — DO NOT DELETE IT.
 * ---------------------------------------------------------------------------
 * After add-to-cart the shopper stays on the product page and the bubble must
 * go 0 -> 1 in place; there the re-render Next performs IS the feature, and no
 * page on that path has a redirect guard. Same API, opposite consequence. It is
 * scanned below as this guard's positive control, so deleting it fails here
 * too, loudly, instead of silently breaking the bubble.
 *
 * ---------------------------------------------------------------------------
 * WHEN THIS TEST FAILS.
 * ---------------------------------------------------------------------------
 * FIND ANOTHER WAY TO REFRESH THE BUBBLE. NEVER weaken the
 * `payable.length === 0` guard in `src/app/s/[slug]/checkout/page.tsx` to make
 * the re-render harmless — that leaves `/checkout` reachable with nothing
 * payable, which is the surface the guard exists to close. And NEVER redesign
 * the confirmation into a separate page it redirects to: the success view is
 * client state on the same route by design, and D-12 requires the tracking link
 * on screen immediately.
 *
 * Verified against **Next 16.3.1**. If a future Next implements that TODO,
 * `skipPageRendering` stops depending on an unmatched path and this rule may be
 * revisitable — deliberately, by re-reading the two files named above. Do not
 * delete this guard to make a build pass.
 *
 * IT MUST NOT PASS VACUOUSLY. A scan of a renamed file, or a detector that no
 * longer recognises a call, would both report "no offenders" with total
 * confidence and zero coverage. Three guards below pin that the files were
 * really read, that the detector still fires on the one call that is SUPPOSED
 * to match, and that `stripCommentLines` has not turned the scan into a no-op —
 * which matters more here than usual, because this header names every forbidden
 * token and a rule that cannot be documented is a rule nobody keeps.
 */

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

/** The module that must call none of them. */
const FORBIDDEN_IN = "src/server/checkout/actions.ts";

/** The module that must call exactly one of them — the positive control. */
const POSITIVE_CONTROL = "src/server/cart/actions.ts";

/**
 * Every API that sets `pathWasRevalidated` and so forces the current route to
 * re-render. `refresh` carries its parenthesis so the word alone — in an
 * identifier like `refreshedAt` — is not mistaken for the call.
 */
const INVALIDATION_APIS = [
  "revalidatePath",
  "revalidateTag",
  "updateTag",
  "refresh(",
];

/** The module every one of them is imported from. */
const CACHE_MODULE = "next/cache";

/**
 * Blank out comment lines, preserving line count and column offsets.
 *
 * Without this the guard is self-invalidating: the rationale comment in
 * `src/server/checkout/actions.ts` explains the rule by naming every API it
 * forbids, and so does the header above. Documenting a prohibition must not
 * trip it. Characters become spaces rather than being removed so the line
 * numbers in a failure still point at real source. Line-oriented rather than a
 * tokenizer, matching the idiom in `tests/unit/single-order-state-writer.test.ts`
 * and `tests/unit/storefront-link-prefix.test.ts`: a trailing `// …` after live
 * code is left alone, which can only cause a false POSITIVE — a failing build
 * somebody reads rather than a silent hole.
 */
function stripCommentLines(code: string): string {
  return code
    .split("\n")
    .map((line) =>
      /^\s*(?:\/\/|\/\*|\*|\{\/\*)/.test(line) ? " ".repeat(line.length) : line,
    )
    .join("\n");
}

interface Occurrence {
  readonly file: string;
  readonly line: number;
  readonly api: string;
  readonly text: string;
}

/**
 * Every live call site of a cache-invalidation API in one module.
 *
 * Import lines are skipped on purpose: an import is not a call, and counting it
 * would make the positive control below read 2 for a module holding exactly one
 * call. The import is checked separately, and only where it must be absent.
 */
function callSitesIn(file: string, code: string): Occurrence[] {
  const found: Occurrence[] = [];

  stripCommentLines(code)
    .split("\n")
    .forEach((text, index) => {
      if (/^\s*import\b/.test(text)) return;
      for (const api of INVALIDATION_APIS) {
        if (text.includes(api)) {
          found.push({
            file,
            line: index + 1,
            api,
            text: text.trim().slice(0, 120),
          });
        }
      }
    });

  return found;
}

/** Every live import of the cache module in one file. */
function cacheImportsIn(file: string, code: string): Occurrence[] {
  return stripCommentLines(code)
    .split("\n")
    .flatMap((text, index) =>
      text.includes(CACHE_MODULE)
        ? [
            {
              file,
              line: index + 1,
              api: CACHE_MODULE,
              text: text.trim().slice(0, 120),
            },
          ]
        : [],
    );
}

function read(file: string): string {
  return readFileSync(join(repoRoot, file), "utf8");
}

/** How to fix it, appended to every failure so the reader is never guessing. */
const REMEDY =
  `\n  ${FORBIDDEN_IN} must not invalidate anything. A call there re-renders ` +
  "the /checkout route the shopper is standing on, as part of this same " +
  "Server Action response, and the page's `payable.length === 0 -> " +
  'redirect("/cart")` guard then fires — because the basket is empty ' +
  "precisely BECAUSE the order just succeeded. The shopper is bounced to an " +
  "empty cart and loses their order number, their D-12 tracking link and " +
  "their payment instructions. The order is placed; only the screen proving " +
  "it is lost.\n" +
  "  Scoping the path narrower does NOT help: revalidatePath performs no " +
  "path matching in Next 16.3.1 (see this file's header), and refresh() and " +
  "cookie writes set the same pathWasRevalidated flag.\n" +
  `  ${POSITIVE_CONTROL} is the ONE module where the call is correct — there ` +
  "the shopper stays on the product page, the bubble must change in place, " +
  "and no page on that path has a redirect guard.\n" +
  "  NEVER weaken the guard in src/app/s/[slug]/checkout/page.tsx instead, " +
  "and never redesign the confirmation into a separate page. Quick task " +
  "260901-6wq.";

const forbiddenSource = existsSync(join(repoRoot, FORBIDDEN_IN))
  ? read(FORBIDDEN_IN)
  : "";
const controlSource = existsSync(join(repoRoot, POSITIVE_CONTROL))
  ? read(POSITIVE_CONTROL)
  : "";

describe("the checkout action never invalidates the route it renders inside", () => {
  it("actually read both modules off disk", () => {
    for (const file of [FORBIDDEN_IN, POSITIVE_CONTROL]) {
      expect(
        existsSync(join(repoRoot, file)),
        `${file} was not found on disk. A moved or renamed module must fail ` +
          "loudly here — silently scanning nothing is the one failure mode a " +
          "source-level guard must not have.",
      ).toBe(true);
    }
  });

  it("still detects the call where it is supposed to survive", () => {
    // The positive control against real source. cart/actions.ts calls
    // revalidatePath exactly once, on purpose, so the detector MUST find it.
    // If this ever reads zero, either the detector has drifted from the code —
    // and the assertion below is passing over nothing — or somebody applied
    // "checkout does not revalidate" as a general rule and broke the
    // add-to-cart bubble.
    const control = callSitesIn(POSITIVE_CONTROL, controlSource);

    expect(
      control.map((hit) => `${hit.file}:${hit.line} — ${hit.text}`),
      `${POSITIVE_CONTROL} should contain exactly one cache-invalidation ` +
        "call. Finding none means this guard is vacuous (or the add-to-cart " +
        "bubble just silently stopped updating in place); finding several " +
        "means the invalidation surface grew and this control needs " +
        "revisiting.",
    ).toHaveLength(1);
  });

  it("detects a reintroduced call and ignores one that is only documented", () => {
    // A synthetic control, so the detector is proven on both answers without
    // depending on the repository staying in any particular state.
    const reintroduced = [
      "export async function submitCheckout() {",
      '  revalidatePath("/s/megasolution", "layout");',
      "}",
    ].join("\n");

    expect(
      callSitesIn("synthetic-offender.ts", reintroduced).map((hit) => hit.line),
      "The detector no longer fires on a reintroduced revalidatePath call, " +
        "so the scan below proves nothing.",
    ).toEqual([2]);

    const documentedOnly = [
      "// Never call revalidatePath here — see 260901-6wq.",
      " * Nor revalidateTag, nor updateTag, nor refresh().",
      "/* Nor in a block comment. updateTag() is forbidden too. */",
      "  await cartCache.clearStoredCart(cartId);",
    ].join("\n");

    expect(
      callSitesIn("synthetic-clean.ts", documentedOnly),
      "Comment stripping is broken: a comment that merely NAMES a forbidden " +
        "API was counted as a call. The rule would then be undocumentable — " +
        `the rationale comment in ${FORBIDDEN_IN}, which exists to stop the ` +
        "call being re-added, would itself fail this test.",
    ).toEqual([]);
  });

  it("finds no cache-invalidation call in the checkout action", () => {
    expect(
      callSitesIn(FORBIDDEN_IN, forbiddenSource).map(
        (hit) => `${hit.file}:${hit.line} — ${hit.api} — ${hit.text}`,
      ),
      `A cache-invalidation API is called in ${FORBIDDEN_IN}.` + REMEDY,
    ).toEqual([]);
  });

  it("finds no next/cache import in the checkout action", () => {
    // The import is the call's only source, so an unused one is either a call
    // about to be written or dead weight that fails `npm run lint`
    // (--max-warnings=0). Either way it does not belong here.
    expect(
      cacheImportsIn(FORBIDDEN_IN, forbiddenSource).map(
        (hit) => `${hit.file}:${hit.line} — ${hit.text}`,
      ),
      `${FORBIDDEN_IN} imports ${CACHE_MODULE}, which it has no legitimate ` +
        "use for." + REMEDY,
    ).toEqual([]);
  });
});
