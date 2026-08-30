"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Info, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { useForm, useWatch, type UseFormRegister } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { strings } from "@/lib/strings";
import { likelyOperatorFor, normalizeCameroonMsisdn } from "@/server/payments/phone";
import { savePaymentSettings } from "@/server/payments/actions";
import { MERCHANT_CODE_PATTERN } from "@/server/payments/ussd";

/**
 * The A6 client island — four cards, one primary CTA, no confirmation theatre.
 *
 * ---------------------------------------------------------------------------
 * THE CLIENT SCHEMA IS A COURTESY. THE SERVER IS THE CONTROL.
 * ---------------------------------------------------------------------------
 * `savePaymentSettings` re-runs `normalizeCameroonMsisdn` and the six-digit
 * merchant-code rule on everything it receives, and it is reachable by a direct
 * POST that never loaded this form. The schema below exists so a typo is caught
 * before a round trip, not because the server trusts it. Both sides read the
 * same two validators from `@/server/payments/{phone,ussd}` — those modules are
 * pure and carry no server marker precisely so this import is legal — so the
 * two rules cannot drift into disagreeing about the same number.
 *
 * ---------------------------------------------------------------------------
 * THE PREFIX LINE IS MUTED AND NEVER DESTRUCTIVE, AND NEVER BLOCKS.
 * ---------------------------------------------------------------------------
 * Cameroon has mobile number portability. A number allocated in the MTN block
 * that now receives Orange Money is ordinary, not wrong, so the hint is a muted
 * line with an info icon and submission is untouched. It appears from two
 * sources — live as the merchant types, and from the notices
 * `savePaymentSettings` returns in its SUCCESS payload — because a merchant who
 * pasted a number without watching the field should still see it afterwards.
 *
 * ---------------------------------------------------------------------------
 * D-17: NOTHING IN THIS FILE IMPLIES A NUMBER WAS CHECKED.
 * ---------------------------------------------------------------------------
 * No badge, no second-step affordance, no pending state, no SMS. Saved is live.
 *
 * A blocking error is a destructive `alert` above the action row AND
 * `aria-invalid` on the offending input — never a toast alone, which a merchant
 * can miss entirely and which leaves them no way to find the bad field. The
 * toast is reserved for the stay-on-page success, which is what a toast is for.
 */

const optionalNumber = z
  .string()
  .refine(
    (value) => value.trim() === "" || normalizeCameroonMsisdn(value) !== null,
    strings.paymentSettings.numberFormatError,
  );

const optionalMerchantCode = z
  .string()
  .refine(
    (value) =>
      value.trim() === "" || MERCHANT_CODE_PATTERN.test(value.trim()),
    strings.paymentSettings.merchantCodeFormatError,
  );

const formSchema = z.object({
  whatsappNumber: optionalNumber,
  mtnMomoNumber: optionalNumber,
  mtnMerchantCode: optionalMerchantCode,
  orangeMoneyNumber: optionalNumber,
  orangeMerchantCode: optionalMerchantCode,
  codEnabled: z.boolean(),
});

export type PaymentSettingsFormValues = z.infer<typeof formSchema>;

type FieldName = keyof PaymentSettingsFormValues;

/**
 * `NumberField` and `MerchantCodeField` are declared at module scope, not
 * inside `PaymentSettingsForm`'s body: a component created during render is
 * a fresh function identity on every render, which the React Compiler
 * (`react-hooks/static-components`) flags because it would reset the field's
 * internal state every time the parent re-renders. Taking `register` and
 * `error` as props rather than closing over `form`/`errors` is what makes
 * that hoist possible.
 */

/** The fixed, non-editable `+237` adornment plus its nine-digit input. */
function NumberField({
  name,
  label,
  id,
  warning,
  error,
  register,
}: {
  readonly name: FieldName;
  readonly label: string;
  readonly id: string;
  readonly warning?: string | null;
  readonly error?: string;
  readonly register: UseFormRegister<PaymentSettingsFormValues>;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-stretch gap-0">
        <span
          aria-hidden="true"
          className="inline-flex min-h-9 items-center rounded-l-lg border border-r-0 border-input bg-muted px-2.5 text-sm text-muted-foreground"
        >
          {strings.paymentSettings.phonePrefix}
        </span>
        <Input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          aria-invalid={error !== undefined}
          className="min-h-9 rounded-l-none"
          {...register(name)}
        />
      </div>
      {warning ? (
        <p className="flex items-start gap-1.5 text-sm leading-normal text-muted-foreground">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {warning}
        </p>
      ) : null}
    </div>
  );
}

/** The optional six-digit operator-issued code. */
function MerchantCodeField({
  name,
  label,
  id,
  error,
  register,
}: {
  readonly name: FieldName;
  readonly label: string;
  readonly id: string;
  readonly error?: string;
  readonly register: UseFormRegister<PaymentSettingsFormValues>;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        maxLength={6}
        aria-invalid={error !== undefined}
        className="min-h-9"
        {...register(name)}
      />
    </div>
  );
}

export function PaymentSettingsForm({
  defaultValues,
}: {
  readonly defaultValues: PaymentSettingsFormValues;
}) {
  const router = useRouter();
  const fieldId = useId();

  const [formError, setFormError] = useState<string | null>(null);
  const [savedNotices, setSavedNotices] = useState<
    Partial<Record<FieldName, string>>
  >({});

  const form = useForm<PaymentSettingsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const { control } = form;
  const { errors, isSubmitting } = form.formState;

  /**
   * `useWatch` rather than `form.watch(...)`: the latter returns a function
   * the React Compiler cannot memoize safely, which opts this whole component
   * out of compilation. `useWatch` is a subscription and re-renders on
   * exactly the same changes — see `signup-form.tsx` for the same pattern.
   */
  const watchedMtn = useWatch({ control, name: "mtnMomoNumber" });
  const watchedOrange = useWatch({ control, name: "orangeMoneyNumber" });
  const watchedCodEnabled = useWatch({ control, name: "codEnabled" });

  /**
   * A number sitting in the OTHER operator's block. `likelyOperatorFor` is
   * advisory by construction, so this only ever chooses a sentence to show.
   */
  const mtnPrefixWarning =
    likelyOperatorFor(watchedMtn) === "ORANGE_MONEY"
      ? strings.paymentSettings.prefixWarningOrange
      : (savedNotices.mtnMomoNumber ?? null);

  const orangePrefixWarning =
    likelyOperatorFor(watchedOrange) === "MTN_MOMO"
      ? strings.paymentSettings.prefixWarningMtn
      : (savedNotices.orangeMoneyNumber ?? null);

  const blockingMessage =
    formError ??
    errors.whatsappNumber?.message ??
    errors.mtnMomoNumber?.message ??
    errors.mtnMerchantCode?.message ??
    errors.orangeMoneyNumber?.message ??
    errors.orangeMerchantCode?.message ??
    null;

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    setSavedNotices({});

    const result = await savePaymentSettings(values);

    if (!result.ok) {
      for (const [field, messages] of Object.entries(result.error)) {
        const message = messages[0];
        if (message === undefined) continue;
        if (field === "form") {
          setFormError(message);
          continue;
        }
        form.setError(field as FieldName, { message });
      }
      return;
    }

    setSavedNotices(
      Object.fromEntries(
        result.notices.map((notice) => [notice.field, notice.message]),
      ),
    );

    toast.success(strings.paymentSettings.savedToast);
    // The nothing-configured alert lives in the Server Component above; without
    // this the merchant saves their first number and it stays on screen.
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8">
      <Card>
        <CardHeader>
          <CardTitle>{strings.paymentSettings.whatsappCardTitle}</CardTitle>
          <CardDescription>
            {strings.paymentSettings.whatsappHelper}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NumberField
            name="whatsappNumber"
            id={`${fieldId}-whatsapp`}
            label={strings.paymentSettings.whatsappNumberLabel}
            error={errors.whatsappNumber?.message}
            register={form.register}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{strings.paymentSettings.mtnCardTitle}</CardTitle>
          <CardDescription>{strings.paymentSettings.mtnHelper}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <NumberField
            name="mtnMomoNumber"
            id={`${fieldId}-mtn-number`}
            label={strings.paymentSettings.mtnNumberLabel}
            warning={mtnPrefixWarning}
            error={errors.mtnMomoNumber?.message}
            register={form.register}
          />
          <MerchantCodeField
            name="mtnMerchantCode"
            id={`${fieldId}-mtn-code`}
            label={strings.paymentSettings.mtnMerchantCodeLabel}
            error={errors.mtnMerchantCode?.message}
            register={form.register}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{strings.paymentSettings.orangeCardTitle}</CardTitle>
          <CardDescription>
            {strings.paymentSettings.orangeHelper}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <NumberField
            name="orangeMoneyNumber"
            id={`${fieldId}-orange-number`}
            label={strings.paymentSettings.orangeNumberLabel}
            warning={orangePrefixWarning}
            error={errors.orangeMoneyNumber?.message}
            register={form.register}
          />
          <MerchantCodeField
            name="orangeMerchantCode"
            id={`${fieldId}-orange-code`}
            label={strings.paymentSettings.orangeMerchantCodeLabel}
            error={errors.orangeMerchantCode?.message}
            register={form.register}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{strings.paymentSettings.codCardTitle}</CardTitle>
          <CardDescription>{strings.paymentSettings.codHelper}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Switch
              id={`${fieldId}-cod`}
              checked={watchedCodEnabled}
              onCheckedChange={(checked: boolean) => {
                form.setValue("codEnabled", checked, { shouldDirty: true });
              }}
            />
            <Label htmlFor={`${fieldId}-cod`}>
              {strings.paymentSettings.codLabel}
            </Label>
          </div>
        </CardContent>
      </Card>

      {blockingMessage === null ? null : (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription className="text-destructive">
            {blockingMessage}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex">
        <Button
          type="submit"
          disabled={isSubmitting}
          /*
           * `min-w-56` retains the button's width across the label swap, so the
           * action row does not shift under the merchant's finger mid-save.
           */
          className="min-h-11 min-w-56 px-6 text-sm font-semibold"
        >
          {isSubmitting ? (
            <>
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              {strings.paymentSettings.saveSubmitting}
            </>
          ) : (
            strings.paymentSettings.saveCta
          )}
        </Button>
      </div>
    </form>
  );
}
