"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";
import { signUpMerchant } from "@/server/auth/signup";
import { storeNameFromSlug, storeSlugSchema } from "@/server/tenant/slug";

import { StoreAddressField, useSlugCheck } from "./store-address-field";

/**
 * The merchant signup form (ONB-01, D-01, D-02).
 *
 * Field order is Email -> Password -> Store address -> CTA, with the address
 * last on purpose: it is the only field with live feedback, so it gets the
 * merchant's attention when nothing else is competing for it.
 *
 * Composed from Base UI primitives + `react-hook-form` directly rather than
 * shadcn's `form` wrapper, which is a Radix construct and ships empty under the
 * Base UI distribution this project initialized with (deferred item D1).
 */

/**
 * The client schema reuses `storeSlugSchema` verbatim rather than restating the
 * rules, so the form-time parse and the un-bypassable server gate cannot
 * disagree about what a valid address is — including the exact wording of the
 * message the merchant reads.
 */
const signupFormSchema = z.object({
  email: z.email(),
  password: z.string().min(8, strings.signup.passwordHelper).max(128),
  slug: storeSlugSchema,
});

type SignupFormValues = z.infer<typeof signupFormSchema>;

export function SignupForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupFormSchema),
    mode: "onBlur",
    defaultValues: { email: "", password: "", slug: "" },
  });

  const {
    control,
    formState: { errors, isSubmitting },
    setError,
    setValue,
  } = form;

  /**
   * `useWatch` rather than `form.watch(...)`: the latter returns a function the
   * React Compiler cannot memoize safely, which opts this whole component out
   * of compilation. `useWatch` is a subscription and re-renders on exactly the
   * same changes.
   */
  const slugValue = useWatch({ control, name: "slug" }) ?? "";
  const { fieldState, runCheck } = useSlugCheck(slugValue);

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);

    const result = await signUpMerchant({
      email: values.email,
      password: values.password,
      storeName: storeNameFromSlug(values.slug),
      slug: values.slug,
    });

    if (result.ok) {
      /**
       * Success is a navigation, never a transient notification — and the next
       * step is no longer the storefront. D-05 makes plan selection mandatory,
       * so signup hands off to `/onboarding/plan`, which owns the (cross-origin,
       * therefore hard) hop to `{slug}.einort.com` once a tier is chosen.
       *
       * `router.push` rather than `window.location.assign`: `/onboarding/plan`
       * is same-origin apex, and a full-page assign would throw away the client
       * router in the middle of onboarding.
       *
       * `redirecting` holds the button in its submitting state across the
       * hand-off so it cannot flash back to "Create my store" while the browser
       * is already leaving.
       */
      setRedirecting(true);
      router.push("/onboarding/plan");
      return;
    }

    // Field-scoped errors land on their field and mark it aria-invalid;
    // whole-form errors render in the destructive alert above the form.
    for (const [field, messages] of Object.entries(result.error)) {
      const message = messages?.[0];
      if (!message) continue;
      if (field === "email" || field === "password" || field === "slug") {
        setError(field, { type: "server", message });
      } else {
        setFormError(message);
      }
    }
  });

  const busy = isSubmitting || redirecting;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {formError ? (
        /**
         * Above the form, and in the document flow: a blocking error the
         * merchant has to act on must not be able to disappear on a timer
         * (01-UI-SPEC.md § Error). The transient-notification library that
         * would make that mistake easy is deliberately not installed.
         */
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription className="text-destructive">
            {formError}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-4">
        {/* ---------------------------------------------------- email --- */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="email" className="text-sm leading-snug font-semibold">
            {strings.signup.emailLabel}
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            className="min-h-11 bg-background"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "email-error" : undefined}
            {...form.register("email")}
          />
          {errors.email ? (
            <p id="email-error" className="text-sm text-destructive">
              {errors.email.message}
            </p>
          ) : null}
        </div>

        {/* ------------------------------------------------- password --- */}
        <div className="flex flex-col gap-2">
          <Label
            htmlFor="password"
            className="text-sm leading-snug font-semibold"
          >
            {strings.signup.passwordLabel}
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            className="min-h-11 bg-background"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby="password-helper"
            {...form.register("password")}
          />
          <p
            id="password-helper"
            className={cn(
              "text-sm",
              errors.password ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {errors.password?.message ?? strings.signup.passwordHelper}
          </p>
        </div>

        {/* --------------------------------------------- store address --- */}
        <StoreAddressField
          registration={form.register("slug")}
          setSlug={(value) => setValue("slug", value, { shouldValidate: false })}
          fieldState={fieldState}
          runCheck={runCheck}
          errorMessage={errors.slug?.message}
        />
      </div>

      {/*
       * One primary button on the page. Disabled while the address is
       * checking, taken, reserved or invalid — and deliberately ENABLED when
       * the check itself could not run.
       */}
      <Button
        type="submit"
        disabled={fieldState.submitDisabled || busy}
        className="min-h-11 w-full px-6 text-sm font-semibold"
      >
        {busy ? (
          <>
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            {strings.signup.ctaSubmitting}
          </>
        ) : (
          strings.signup.cta
        )}
      </Button>
    </form>
  );
}
