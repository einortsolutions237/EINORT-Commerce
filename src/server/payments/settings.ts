import "server-only";

import type { PaymentOperator } from "@/server/db/enums";
import { scopedDb } from "@/server/db/tenant-scoped";

/**
 * The merchant's payment destinations, read; and the one derivation of what
 * that means for checkout.
 *
 * ---------------------------------------------------------------------------
 * `tenantId` AS A PARAMETER IS CORRECT HERE.
 * ---------------------------------------------------------------------------
 * `tests/unit/no-tenant-id-param.test.ts` bans a `tenantId` parameter under
 * `src/server/merchant/**` and `src/server/entitlements/**`, because in those
 * directories the tenant must come from the session and a parameter would be a
 * field a caller could set. This module is not in that scope and the rule does
 * not apply: every caller here has already resolved the tenant — the page from
 * `requireMerchantContext()`, the action from `ctx.tenantId`, the storefront
 * from the hostname — and `scopedDb` re-stamps the filter regardless.
 */

/** The row shape both consumers need. Read-only; nothing here writes. */
export type PaymentSettingsRow = {
  whatsappNumber: string | null;
  mtnMomoNumber: string | null;
  mtnMerchantCode: string | null;
  orangeMoneyNumber: string | null;
  orangeMerchantCode: string | null;
  codEnabled: boolean;
  payoutNotice: string | null;
};

/**
 * The merchant's saved settings, or `null` when they have never saved.
 *
 * `null` and "a row with every column blank" are deliberately NOT collapsed
 * here — `resolvePaymentPaths` handles both identically, so the distinction
 * costs nothing and a caller that wants to know "has this merchant ever opened
 * this page" can still ask.
 */
export async function getPaymentSettings(
  tenantId: string,
): Promise<PaymentSettingsRow | null> {
  return scopedDb(tenantId).merchantPaymentSettings.findUnique({
    where: { tenantId },
    select: {
      whatsappNumber: true,
      mtnMomoNumber: true,
      mtnMerchantCode: true,
      orangeMoneyNumber: true,
      orangeMerchantCode: true,
      codEnabled: true,
      payoutNotice: true,
    },
  });
}

/** Which of the three checkout paths this merchant can actually accept. */
export type ResolvedPaymentPaths = {
  whatsapp: boolean;
  manualTransfer: boolean;
  cod: boolean;
  operators: PaymentOperator[];
};

/**
 * The single source of truth for "can this store take an order, and how".
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS ONE FUNCTION AND NOT FOUR NULL CHECKS.
 * ---------------------------------------------------------------------------
 * Two surfaces ask the same question and must never disagree: A6's
 * nothing-configured alert, and the checkout payment selector. If the alert
 * says "you're set up" and checkout renders no way to pay, the merchant has no
 * way to discover the contradiction except through a lost sale.
 *
 * It also resolves RESEARCH.md Open Question 4, prescriptively: a payment path
 * with no destination is NOT RENDERED at checkout — not rendered and disabled,
 * not rendered with a tooltip. Showing a shopper a method the seller cannot
 * accept is worse than not offering it, because the shopper picks it, fails,
 * and blames the store.
 *
 * `operators` lists only the ones with a configured RECEIVING NUMBER. A
 * merchant code with no number behind it is not a payment destination — money
 * arrives at a wallet, and the code only improves the instructions.
 *
 * Pure: it takes the row and returns an answer, so both the settings page and
 * the checkout page can call it on data they already loaded.
 */
export function resolvePaymentPaths(
  settings: PaymentSettingsRow | null,
): ResolvedPaymentPaths {
  const operators: PaymentOperator[] = [];
  if (settings?.mtnMomoNumber) operators.push("MTN_MOMO");
  if (settings?.orangeMoneyNumber) operators.push("ORANGE_MONEY");

  return {
    whatsapp: Boolean(settings?.whatsappNumber),
    manualTransfer: operators.length > 0,
    // A merchant who has never saved has no row, and the column defaults to
    // true — so an untouched store still accepts cash, which is the honest
    // default in this market and matches what the switch will show.
    cod: settings ? settings.codEnabled : true,
    operators,
  };
}
