"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Check, LoaderCircle, Lock, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";
import { signUpMerchant } from "@/server/auth/signup";
import { checkStoreSlug } from "@/server/tenant/actions";
import { SLUG_MIN_LENGTH } from "@/server/tenant/host";
import { storeSlugSchema } from "@/server/tenant/slug";

import {
  slugFieldState,
  type SlugCheck,
  type SlugFieldIcon,
} from "./slug-status";

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

/** 01-UI-SPEC.md § Slug availability check. */
const SLUG_CHECK_DEBOUNCE_MS = 400;

/**
 * `localhost:3000` in development, `einort.com` in production. Read as a
 * literal `process.env` reference so Next inlines it into the client bundle;
 * a destructure or a dynamic key yields `undefined` in the browser.
 */
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "einort.com";

/**
 * The suffix adornment drops the port: `maboutique.localhost` reads as an
 * address, `maboutique.localhost:3000` reads as a URL bar. The port is added
 * back for the post-signup redirect, which needs a real origin.
 */
const DISPLAY_DOMAIN = ROOT_DOMAIN.split(":")[0];

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

const SLUG_ICONS: Record<SlugFieldIcon, typeof Check> = {
  check: Check,
  x: X,
  lock: Lock,
  "alert-circle": AlertCircle,
  "loader-circle": LoaderCircle,
};

const TONE_CLASS = {
  muted: "text-muted-foreground",
  success: "text-success",
  destructive: "text-destructive",
} as const;

/** A resolved availability answer, bound to the exact value it answers for. */
type ResolvedCheck = { value: string; status: Awaited<ReturnType<typeof checkStoreSlug>> };

/**
 * The store name is derived rather than asked for: D-01 is explicit that the
 * merchant types ONE thing, their address. `alpha-store` becomes "Alpha Store",
 * which is what the storefront renders until Phase 4 gives them a real branding
 * surface. `storeSlugSchema` guarantees at least 3 characters, so the derived
 * name always clears the server's 2-character floor.
 */
export function storeNameFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function SignupForm() {
  const [resolved, setResolved] = useState<ResolvedCheck | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  /**
   * Stale-response guard, layer 1 (T-01-51).
   *
   * Every request is stamped with a monotonically increasing sequence number
   * and only the newest may write state. Without it, a slow "available" for an
   * address the merchant already replaced can land after a fast "taken" for the
   * one currently in the field, and they are shown a green check for an address
   * they cannot have. A ref, not state: it must be readable synchronously
   * inside the async callback and must never trigger a render.
   */
  const requestSeq = useRef(0);

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

  const runCheck = useCallback(async (value: string) => {
    // Below the minimum there is nothing worth asking, and asking anyway would
    // spend a rate-limit token per keystroke on the way to three characters.
    if (value.length < SLUG_MIN_LENGTH) return;

    requestSeq.current += 1;
    const seq = requestSeq.current;

    try {
      const status = await checkStoreSlug(value);
      if (seq !== requestSeq.current) return; // superseded — discard
      setResolved({ value, status });
    } catch {
      if (seq !== requestSeq.current) return;
      /**
       * A transport failure is the same thing to the merchant as a throttled
       * checker: the check could not run. Mapping it onto `rate-limited` is
       * what makes the field fail OPEN (T-01-52) — leaving it pending would
       * disable the submit button permanently on one dropped request.
       */
      setResolved({
        value,
        status: {
          status: "rate-limited",
          message: strings.signup.slugCheckUnavailable,
        },
      });
    }
  }, []);

  /**
   * Debounced check, 400ms after the last keystroke. The effect only schedules
   * work — it deliberately sets no state of its own, because the displayed
   * state is derived below rather than synchronised here.
   */
  useEffect(() => {
    if (slugValue.length < SLUG_MIN_LENGTH) return;
    const timer = setTimeout(
      () => void runCheck(slugValue),
      SLUG_CHECK_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [slugValue, runCheck]);

  /**
   * Stale-response guard, layer 2 — and the reason the resolved answer is
   * stored together with the value it answers for.
   *
   * The sequence number stops an out-of-order RESPONSE from winning; this stops
   * an out-of-date ANSWER from being displayed at all. If the field no longer
   * holds the value that was checked, the only honest state is "checking":
   * a request is either in flight or about to be, and submission stays
   * disabled until a fresh answer for the current text arrives.
   */
  const check: SlugCheck =
    slugValue.length < SLUG_MIN_LENGTH
      ? undefined
      : resolved?.value === slugValue
        ? resolved.status
        : { pending: true };

  const fieldState = slugFieldState(
    check,
    slugValue ? `${slugValue}.${DISPLAY_DOMAIN}` : DISPLAY_DOMAIN,
  );
  const StatusIcon = fieldState.icon ? SLUG_ICONS[fieldState.icon] : null;

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
       * Success is a navigation, never a transient notification. A hard
       * navigation is required rather than preferred:
       * `useRouter().push()` is a client-side transition
       * within one origin and cannot reach `{slug}.einort.com`, which is a
       * different host. The lint rule below assumes an internal destination.
       *
       * `redirecting` holds the button in its submitting state across the
       * hand-off so it cannot flash back to "Create my store" while the browser
       * is already leaving.
       */
      setRedirecting(true);
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- cross-origin: the merchant's own subdomain (DOM-01)
      window.location.assign(
        `${window.location.protocol}//${result.slug}.${ROOT_DOMAIN}`,
      );
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
  const slugField = form.register("slug");

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
        <div className="flex flex-col gap-2">
          <Label htmlFor="slug" className="text-sm leading-snug font-semibold">
            {strings.signup.slugLabel}
          </Label>

          {/*
           * The inline group is D-01's familiarity cue: the merchant sees the
           * address they are actually getting, the way Shopify shows
           * "yourstore.myshopify.com". The suffix is inert text, not an input.
           */}
          <div className="flex items-stretch overflow-hidden rounded-lg border border-border bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
            <Input
              id="slug"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className="min-h-11 rounded-none border-0 bg-transparent focus-visible:ring-0"
              aria-invalid={
                errors.slug || fieldState.tone === "destructive"
                  ? true
                  : undefined
              }
              aria-describedby="slug-status"
              {...slugField}
              onChange={(event) => {
                /**
                 * Normalize as they type (01-UI-SPEC.md § Normalization) so the
                 * merchant never sees a value the server would reject on case
                 * alone. Lowercase and whitespace only — no character stripping
                 * and no suggested alternative, because silently rewriting the
                 * address someone chose is worse than telling them it is
                 * invalid. Typing is never blocked.
                 */
                const normalized = event.target.value
                  .toLowerCase()
                  .replace(/\s+/g, "");
                if (normalized === event.target.value) {
                  void slugField.onChange(event);
                } else {
                  setValue("slug", normalized, { shouldValidate: false });
                }
              }}
              onBlur={(event) => {
                // Also check on blur: a merchant who types and immediately tabs
                // away must not be left looking at the checking state.
                void slugField.onBlur(event);
                void runCheck(event.target.value);
              }}
            />
            <span
              aria-hidden="true"
              className="flex min-h-11 shrink-0 items-center border-l border-border bg-muted px-4 text-sm leading-snug font-semibold text-muted-foreground"
            >
              .{DISPLAY_DOMAIN}
            </span>
          </div>

          {/*
           * One live region for the whole field. `role="status"` +
           * `aria-live="polite"` announces each resolved state without
           * interrupting typing, and the input points here through
           * `aria-describedby` so the message is read as part of the field.
           *
           * Icon AND text AND colour on every state — colour alone is never the
           * signal (WCAG 1.4.1).
           */}
          <p
            id="slug-status"
            role="status"
            aria-live="polite"
            className={cn(
              "flex min-h-5 items-center gap-1 text-sm leading-snug",
              TONE_CLASS[fieldState.tone],
            )}
          >
            {StatusIcon ? (
              <StatusIcon
                aria-hidden="true"
                className={cn(
                  "size-4 shrink-0",
                  fieldState.state === "checking" && "animate-spin",
                )}
              />
            ) : null}
            {errors.slug?.message ?? fieldState.message}
          </p>
        </div>
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
