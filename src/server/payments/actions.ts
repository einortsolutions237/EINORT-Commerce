"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { strings } from "@/lib/strings";
import type { MerchantPaymentSettingsCreateInput } from "@/server/db/model-inputs";
import { scopedCreateData, scopedDb } from "@/server/db/tenant-scoped";
import { merchantAction } from "@/server/merchant/action";
import { likelyOperatorFor, normalizeCameroonMsisdn } from "./phone";
import { MERCHANT_CODE_PATTERN } from "./ussd";

/**
 * D-14 — the merchant tells the platform where their money should arrive.
 *
 * ---------------------------------------------------------------------------
 * THERE IS NO VERIFICATION STEP IN THIS FILE, AND THAT IS D-17.
 * ---------------------------------------------------------------------------
 * No confirmation code, no SMS, no pending state, no `verified` column, no
 * badge anywhere downstream. Saved is live. The absence is the decision, so it
 * is recorded here rather than left to be re-litigated by the next reader:
 *
 *   - The platform CANNOT check a Mobile Money number against the operator.
 *     There is no API in V1 and no PSP integration at all. Any affordance that
 *     implied a check would be theatre, and worse than nothing — a customer who
 *     reads a confirmation badge and then pays the wrong number was misled by
 *     this product, not by the merchant.
 *   - The whole manual-claim system already rests on the merchant honestly
 *     confirming that money arrived. A merchant who would enter a false
 *     receiving number is not stopped by a code sent to that same number.
 *   - A wrong number is SELF-CORRECTING in the only way that matters: the
 *     merchant does not get paid, notices immediately, and fixes it. The
 *     feedback loop is already tighter than any check we could build.
 *
 * ---------------------------------------------------------------------------
 * THE PREFIX MISMATCH IS A NOTICE, NEVER A REFUSAL.
 * ---------------------------------------------------------------------------
 * Cameroon has mobile number portability, so a number sitting in the MTN block
 * and receiving Orange Money is an ordinary fact, not an error. The save always
 * goes through; the mismatch travels back in the SUCCESS payload so the form
 * can render a muted line beneath the field (T-03-44).
 *
 * ---------------------------------------------------------------------------
 * NO TRIAL CHECK AND NO TENANT ID LIVE IN THIS HANDLER.
 * ---------------------------------------------------------------------------
 * `mode: "write"` IS the read-only gate — re-checking it here would create a
 * second place for D-08 to drift. And the schema below accepts five strings and
 * a boolean and nothing else, so there is no field a direct POST could set to
 * retarget the write: the target is `ctx.tenantId`, resolved from the session
 * before this handler runs, and `scopedDb` stamps both halves of the upsert
 * (T-03-42).
 */

/**
 * Every number field arrives as free text, deliberately.
 *
 * The form shows a fixed `+237` adornment and the merchant types nine digits,
 * but they also paste `+237 6XX XX XX XX` out of a contact card, and a schema
 * that rejected that would be rejecting a correct number. Blank is legal on
 * every field and means "clear this" — a merchant must be able to remove a
 * number they no longer use, and a required field would trap them.
 *
 * Validation therefore lives in the handler rather than in the schema, so each
 * refusal carries the A6 copy from `strings.paymentSettings` instead of a Zod
 * default no one wrote.
 */
const savePaymentSettingsSchema = z.object({
  whatsappNumber: z.string(),
  mtnMomoNumber: z.string(),
  mtnMerchantCode: z.string(),
  orangeMoneyNumber: z.string(),
  orangeMerchantCode: z.string(),
  codEnabled: z.boolean(),
});

/** The fields a soft prefix notice can attach to. */
export type PrefixNoticeField = "mtnMomoNumber" | "orangeMoneyNumber";

/** A non-blocking hint rendered beneath a field after a successful save. */
export type PrefixNotice = {
  field: PrefixNoticeField;
  message: string;
};

export type SavePaymentSettingsData = {
  notices: PrefixNotice[];
};

/**
 * Blank means "clear the column"; anything else must normalize or it is an
 * error. Returns `undefined` for the error case so the caller can tell the
 * three states apart — cleared, valid, rejected — without a sentinel string.
 */
function resolveNumber(
  raw: string,
): { ok: true; value: string | null } | { ok: false } {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: true, value: null };

  const normalized = normalizeCameroonMsisdn(trimmed);
  return normalized === null ? { ok: false } : { ok: true, value: normalized };
}

/**
 * A merchant code is an ENHANCEMENT and never a requirement (D-15), so a blank
 * one clears the column and is never an error. A present one must be exactly
 * six digits, because it is interpolated into a `tel:` URI the customer's OS
 * will act on and the builder refuses anything else anyway (T-03-40). Refusing
 * at the write too means a bad code is caught where the merchant can fix it,
 * not silently dropped at render time.
 */
function resolveMerchantCode(
  raw: string,
): { ok: true; value: string | null } | { ok: false } {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: true, value: null };

  return MERCHANT_CODE_PATTERN.test(trimmed)
    ? { ok: true, value: trimmed }
    : { ok: false };
}

export const savePaymentSettings = merchantAction({
  mode: "write",
  schema: savePaymentSettingsSchema,
  handler: async (ctx, input): Promise<
    | ({ ok: true } & SavePaymentSettingsData)
    | { ok: false; error: Record<string, string[]> }
  > => {
    const errors: Record<string, string[]> = {};

    const whatsapp = resolveNumber(input.whatsappNumber);
    if (!whatsapp.ok) {
      errors.whatsappNumber = [strings.paymentSettings.numberFormatError];
    }

    const mtnNumber = resolveNumber(input.mtnMomoNumber);
    if (!mtnNumber.ok) {
      errors.mtnMomoNumber = [strings.paymentSettings.numberFormatError];
    }

    const orangeNumber = resolveNumber(input.orangeMoneyNumber);
    if (!orangeNumber.ok) {
      errors.orangeMoneyNumber = [strings.paymentSettings.numberFormatError];
    }

    const mtnCode = resolveMerchantCode(input.mtnMerchantCode);
    if (!mtnCode.ok) {
      errors.mtnMerchantCode = [
        strings.paymentSettings.merchantCodeFormatError,
      ];
    }

    const orangeCode = resolveMerchantCode(input.orangeMerchantCode);
    if (!orangeCode.ok) {
      errors.orangeMerchantCode = [
        strings.paymentSettings.merchantCodeFormatError,
      ];
    }

    // Every field is reported at once. Saving the valid half and complaining
    // about the rest would leave the merchant unable to tell what landed.
    if (Object.keys(errors).length > 0) return { ok: false, error: errors };

    if (
      !whatsapp.ok ||
      !mtnNumber.ok ||
      !orangeNumber.ok ||
      !mtnCode.ok ||
      !orangeCode.ok
    ) {
      // Unreachable — the guard above already returned. Present so the
      // narrowing below is a fact rather than a cast.
      return { ok: false, error: errors };
    }

    const data = {
      whatsappNumber: whatsapp.value,
      mtnMomoNumber: mtnNumber.value,
      mtnMerchantCode: mtnCode.value,
      orangeMoneyNumber: orangeNumber.value,
      orangeMerchantCode: orangeCode.value,
      codEnabled: input.codEnabled,
    };

    // The single-field unique on `tenantId` makes this a direct upsert, and
    // `scopedDb` stamps both `where` and `create`.
    await scopedDb(ctx.tenantId).merchantPaymentSettings.upsert({
      where: { tenantId: ctx.tenantId },
      create: scopedCreateData<MerchantPaymentSettingsCreateInput>(data),
      update: data,
    });

    const notices: PrefixNotice[] = [];
    if (
      mtnNumber.value !== null &&
      likelyOperatorFor(mtnNumber.value) === "ORANGE_MONEY"
    ) {
      notices.push({
        field: "mtnMomoNumber",
        message: strings.paymentSettings.prefixWarningOrange,
      });
    }
    if (
      orangeNumber.value !== null &&
      likelyOperatorFor(orangeNumber.value) === "MTN_MOMO"
    ) {
      notices.push({
        field: "orangeMoneyNumber",
        message: strings.paymentSettings.prefixWarningMtn,
      });
    }

    // The nothing-configured alert lives in the Server Component above the
    // form, so without this the merchant saves their first number and the
    // "customers can't check out" alert stays on screen until a hard reload.
    revalidatePath("/dashboard/settings/payment");

    return { ok: true, notices };
  },
});
