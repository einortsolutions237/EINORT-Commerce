import type { Metadata } from "next";
import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { strings } from "@/lib/strings";
import { requireMerchantContext } from "@/server/merchant/context";
import {
  getPaymentSettings,
  resolvePaymentPaths,
} from "@/server/payments/settings";

import { PaymentSettingsForm } from "./payment-settings-form";

/**
 * `/dashboard/settings/payment` — A6, D-14 / D-16 / D-17.
 *
 * ---------------------------------------------------------------------------
 * THIS PAGE AUTHORIZES ITSELF.
 * ---------------------------------------------------------------------------
 * `requireMerchantContext()` is not inherited from `(dashboard)/layout.tsx` —
 * see that file for why a Next 16 layout cannot be the gate. Every page under
 * the group calls the DAL itself; `React.cache()` makes the repeat call free.
 *
 * ---------------------------------------------------------------------------
 * THE ALERT IS DESTRUCTIVE BECAUSE THE STORE IS ACTUALLY BROKEN.
 * ---------------------------------------------------------------------------
 * `--destructive` is reserved for genuine breakage rather than nudges, and a
 * store with no payment destination at all is exactly that: a shopper can fill
 * a cart and then find no way to pay. That is not a suggestion to improve
 * something, it is a report that checkout does not work.
 *
 * The condition comes from `resolvePaymentPaths` and not from four null checks
 * written here, so this alert and 03-12's checkout selector can never disagree
 * about whether this merchant is set up.
 *
 * ---------------------------------------------------------------------------
 * D-17 IS ENFORCED HERE AS AN ABSENCE.
 * ---------------------------------------------------------------------------
 * No badge, no confirmation affordance, no pending state anywhere in this
 * tree. Saved is live. A merchant who read a confirmation badge would
 * reasonably believe the platform checked their number with the operator,
 * which it cannot do — and the customer who then pays the wrong number was
 * misled by us, not by the merchant.
 *
 * ---------------------------------------------------------------------------
 * THE NINE DIGITS, NOT THE STORAGE FORM, CROSS INTO THE CLIENT.
 * ---------------------------------------------------------------------------
 * Numbers are stored as `2376XXXXXXXX` because that is what the click-to-chat
 * link needs, but the form renders a fixed `+237` adornment beside the input,
 * so the field must hold the national part alone. Slicing here keeps the
 * client island free of any knowledge about the storage form.
 */

export const metadata: Metadata = {
  // Renders as "Payment settings · EINORT" through the root layout's template.
  title: strings.paymentSettings.title,
};

/** `2376XXXXXXXX` -> `6XXXXXXXX`, and `null` -> `""`. */
function nationalPart(msisdn: string | null): string {
  return msisdn === null ? "" : msisdn.replace(/^237/, "");
}

export default async function PaymentSettingsPage() {
  const ctx = await requireMerchantContext();
  const settings = await getPaymentSettings(ctx.tenantId);
  const paths = resolvePaymentPaths(settings);

  const nothingConfigured =
    !paths.whatsapp && !paths.manualTransfer && !paths.cod;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight text-foreground">
          {strings.paymentSettings.heading}
        </h1>
      </div>

      {nothingConfigured ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription className="text-destructive">
            {strings.paymentSettings.nothingConfigured}
          </AlertDescription>
        </Alert>
      ) : null}

      <PaymentSettingsForm
        defaultValues={{
          whatsappNumber: nationalPart(settings?.whatsappNumber ?? null),
          mtnMomoNumber: nationalPart(settings?.mtnMomoNumber ?? null),
          mtnMerchantCode: settings?.mtnMerchantCode ?? "",
          orangeMoneyNumber: nationalPart(settings?.orangeMoneyNumber ?? null),
          orangeMerchantCode: settings?.orangeMerchantCode ?? "",
          // No row yet means the column default applies, and the default is on.
          codEnabled: settings?.codEnabled ?? true,
        }}
      />
    </div>
  );
}
