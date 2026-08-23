"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { strings } from "@/lib/strings";
import { signInMerchant } from "@/server/auth/login";

/**
 * The returning-merchant sign-in form (TEN-04, T-02-20).
 *
 * Field order is Email -> Password -> CTA (02-UI-SPEC.md § `/login`). Modeled
 * on `src/app/signup/signup-form.tsx`, the two-field precedent, with ONE
 * deliberate divergence: a failure here marks BOTH fields `aria-invalid` and
 * renders a single message, because there is no field the merchant can be
 * told is wrong without rebuilding the account-enumeration oracle Better
 * Auth's own uniform `INVALID_EMAIL_OR_PASSWORD` code was built to close.
 */

const loginFormSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

export function LoginForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    mode: "onSubmit",
    defaultValues: { email: "", password: "" },
  });

  const {
    formState: { isSubmitting },
  } = form;

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);

    const result = await signInMerchant(values);

    if (result.ok) {
      /**
       * Success is a navigation, never a transient notification
       * (02-UI-SPEC.md § Success). `router.push`, not a full-page navigation
       * — `/dashboard` is same-origin apex, and a hard navigation would
       * throw away the client router for no reason.
       *
       * `redirecting` holds the button in its submitting state across the
       * hand-off so it cannot flash back to "Sign in" while the browser is
       * already leaving.
       */
      setRedirecting(true);
      router.push("/dashboard");
      return;
    }

    // One message, whole-form. Never a field-scoped error here (see the file
    // header) — both fields are marked invalid below via `hasError`.
    const message = Object.values(result.error)[0]?.[0];
    setFormError(message ?? strings.login.genericError);
  });

  const busy = isSubmitting || redirecting;
  const hasError = formError !== null;

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

      <div className="flex flex-col gap-4">
        {/* ---------------------------------------------------- email --- */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="email" className="text-sm leading-snug font-semibold">
            {strings.login.emailLabel}
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            className="min-h-11 bg-background"
            aria-invalid={hasError ? true : undefined}
            aria-describedby={hasError ? "login-form-error" : undefined}
            {...form.register("email")}
          />
        </div>

        {/* ------------------------------------------------- password --- */}
        <div className="flex flex-col gap-2">
          <Label
            htmlFor="password"
            className="text-sm leading-snug font-semibold"
          >
            {strings.login.passwordLabel}
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            className="min-h-11 bg-background"
            aria-invalid={hasError ? true : undefined}
            aria-describedby={hasError ? "login-form-error" : undefined}
            {...form.register("password")}
          />
        </div>
      </div>

      {formError ? (
        <span id="login-form-error" className="sr-only">
          {formError}
        </span>
      ) : null}

      {/* One primary button on the page. */}
      <Button
        type="submit"
        disabled={busy}
        className="min-h-11 w-full px-6 text-sm font-semibold"
      >
        {busy ? (
          <>
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            {strings.login.ctaSubmitting}
          </>
        ) : (
          strings.login.cta
        )}
      </Button>
    </form>
  );
}
