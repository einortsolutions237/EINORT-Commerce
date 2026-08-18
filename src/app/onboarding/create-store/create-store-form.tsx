"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import {
  StoreAddressField,
  useSlugCheck,
} from "@/app/signup/store-address-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { strings } from "@/lib/strings";
import { createStoreForCurrentUser } from "@/server/auth/signup";
import { storeSlugSchema } from "@/server/tenant/slug";

/**
 * The recovery form: one field, because the merchant already has an account.
 *
 * The address field itself is imported from `/signup` rather than rebuilt —
 * the debounce, the 3-character floor, the stale-response guard and the
 * fail-open rule are behaviour, and a second copy of that behaviour is how the
 * two surfaces silently drift apart.
 */

const createStoreFormSchema = z.object({ slug: storeSlugSchema });

type CreateStoreFormValues = z.infer<typeof createStoreFormSchema>;

export function CreateStoreForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  const form = useForm<CreateStoreFormValues>({
    resolver: zodResolver(createStoreFormSchema),
    mode: "onBlur",
    defaultValues: { slug: "" },
  });

  const {
    control,
    formState: { errors, isSubmitting },
    setError,
    setValue,
  } = form;

  const slugValue = useWatch({ control, name: "slug" }) ?? "";
  const { fieldState, runCheck } = useSlugCheck(slugValue);

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);

    /**
     * The slug is the ONLY thing sent. Identity is read from the session
     * server-side — there is deliberately no user id or organization id in
     * this payload for an attacker to substitute (T-01-49).
     */
    const result = await createStoreForCurrentUser({ slug: values.slug });

    if (result.ok) {
      /**
       * A merchant recovering here is in exactly the same plan-less state a
       * fresh signup is, so this route hands off to the same mandatory step
       * (D-05) rather than jumping to the storefront. Same-origin apex, so a
       * client transition — `/onboarding/plan` owns the cross-origin hop.
       */
      setRedirecting(true);
      router.push("/onboarding/plan");
      return;
    }

    for (const [field, messages] of Object.entries(result.error)) {
      const message = messages?.[0];
      if (!message) continue;
      if (field === "slug") {
        setError("slug", { type: "server", message });
      } else {
        setFormError(message);
      }
    }
  });

  const busy = isSubmitting || redirecting;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {formError ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription className="text-destructive">
            {formError}
          </AlertDescription>
        </Alert>
      ) : null}

      <StoreAddressField
        registration={form.register("slug")}
        setSlug={(value) => setValue("slug", value, { shouldValidate: false })}
        fieldState={fieldState}
        runCheck={runCheck}
        errorMessage={errors.slug?.message}
      />

      <Button
        type="submit"
        disabled={fieldState.submitDisabled || busy}
        className="min-h-11 w-full px-6 text-sm font-semibold"
      >
        {busy ? (
          <>
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            {strings.createStore.ctaSubmitting}
          </>
        ) : (
          strings.createStore.cta
        )}
      </Button>
    </form>
  );
}
