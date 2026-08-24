/**
 * The one sanctioned door to the generated Prisma enums (RESEARCH.md Pitfall 10).
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `eslint.config.mjs` makes any `generated/prisma*` import an `error` under
 * `src/`,
 * with an exemption for exactly three directories: `src/server/db/**`,
 * `src/server/tenant/**` and `src/server/auth/**`. That rule is not style
 * policing — it is the enforcement mechanism for TEN-02 and TEN-05, the only
 * thing standing between a feature module and the unscoped client, and it
 * cannot be waived for convenience.
 *
 * But the enum NAMES are not dangerous. `OrderState`, `ClaimStatus` and the
 * rest are plain string unions plus a frozen value object; nothing about them
 * reaches a database. Feature code needs them constantly — every state
 * transition, every claim review, every order badge — and the alternatives are
 * both bad:
 *
 *   - an `// eslint-disable-next-line no-restricted-imports` at each site,
 *     which trains every future reader (human or agent) that the boundary is
 *     negotiable, and hides a real violation among dozens of benign ones;
 *   - a hand-maintained duplicate of the enum members, which silently drifts
 *     from `prisma/schema.prisma` the first time a member is added.
 *
 * So the import lives here once, inside the sanctioned zone, and everything
 * else imports from `@/server/db/enums`. The lint rule stays absolute, and
 * `grep -rn "generated/prisma" src/` stays a meaningful audit.
 *
 * WHAT IS RE-EXPORTED
 * -------------------
 * Both halves of each enum, from a single statement. Prisma 7 generates each
 * enum as a `const` object plus a same-named `type` alias over its values, and
 * a bare `export { X } from` re-exports the value binding and the type binding
 * together. So this works for both uses:
 *
 * ```ts
 * import { OrderState } from "@/server/db/enums";
 *
 * function badge(state: OrderState) { … }          // the type
 * await transition(order, OrderState.CONFIRMED);   // the value
 * ```
 *
 * Deliberately NOT a `export * from "@/generated/prisma/enums"`: an explicit
 * list means adding an enum to the schema is a visible decision here rather
 * than something that appears in feature code's autocomplete unannounced.
 *
 * NOTE: no `import "server-only"`. Every other module in this directory opens
 * with it because it holds a live database client; this one holds string
 * constants, and Client Components legitimately need `ClaimStatus.PENDING` to
 * render a badge. Adding the marker would push callers back toward duplicating
 * the members by hand, which is the problem this file exists to prevent.
 */

export {
  ClaimStatus,
  EventActor,
  OrderChannel,
  OrderState,
  PaymentOperator,
} from "@/generated/prisma/enums";
