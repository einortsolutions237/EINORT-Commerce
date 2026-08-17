"use client";

import { AlertCircle, Check, LoaderCircle, Lock, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";
import { checkStoreSlug } from "@/server/tenant/actions";
import { SLUG_MIN_LENGTH } from "@/server/tenant/host";

import {
  slugFieldState,
  type SlugCheck,
  type SlugFieldIcon,
  type SlugFieldState,
} from "./slug-status";

/**
 * The D-02 store-address field: one input, one inert `.einort.com` suffix, one
 * live status line.
 *
 * Extracted from the signup form because `/onboarding/create-store` needs the
 * identical field. A second hand-written copy would be the obvious way to do
 * it and the wrong one — the debounce interval, the minimum length, the
 * stale-response guard and the fail-open rule are behaviour, and behaviour
 * duplicated across two surfaces drifts. There is one implementation and both
 * routes render it.
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
 * address, `maboutique.localhost:3000` reads as a URL bar. The port is kept for
 * `storeOrigin`, which needs a navigable origin.
 */
export const DISPLAY_DOMAIN = ROOT_DOMAIN.split(":")[0];

/** The merchant's own storefront origin — a different host, so a hard nav. */
export function storeOrigin(slug: string): string {
  return `${window.location.protocol}//${slug}.${ROOT_DOMAIN}`;
}

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
type ResolvedCheck = {
  value: string;
  status: Awaited<ReturnType<typeof checkStoreSlug>>;
};

/**
 * The live availability check, with both stale-response guards.
 *
 * @param slugValue the current field value, already normalized
 */
export function useSlugCheck(slugValue: string): {
  fieldState: SlugFieldState;
  runCheck: (value: string) => void;
} {
  const [resolved, setResolved] = useState<ResolvedCheck | null>(null);

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
   * holds the value that was checked, the only honest state is "checking": a
   * request is either in flight or about to be, and submission stays disabled
   * until a fresh answer for the current text arrives.
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

  return { fieldState, runCheck: (value: string) => void runCheck(value) };
}

export function StoreAddressField({
  registration,
  setSlug,
  fieldState,
  runCheck,
  errorMessage,
}: {
  /** `form.register("slug")` from the owning form. */
  registration: UseFormRegisterReturn;
  /** Writes the normalized value back into the owning form. */
  setSlug: (value: string) => void;
  fieldState: SlugFieldState;
  runCheck: (value: string) => void;
  /** A server-returned field error, which outranks the live status line. */
  errorMessage?: string;
}) {
  const StatusIcon = fieldState.icon ? SLUG_ICONS[fieldState.icon] : null;

  return (
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
            errorMessage || fieldState.tone === "destructive" ? true : undefined
          }
          aria-describedby="slug-status"
          {...registration}
          onChange={(event) => {
            /**
             * Normalize as they type (01-UI-SPEC.md § Normalization) so the
             * merchant never sees a value the server would reject on case
             * alone. Lowercase and whitespace only — no character stripping and
             * no suggested alternative, because silently rewriting the address
             * someone chose is worse than telling them it is invalid. Typing is
             * never blocked.
             */
            const normalized = event.target.value
              .toLowerCase()
              .replace(/\s+/g, "");
            if (normalized === event.target.value) {
              void registration.onChange(event);
            } else {
              setSlug(normalized);
            }
          }}
          onBlur={(event) => {
            // Also check on blur: a merchant who types and immediately tabs
            // away must not be left looking at the checking state.
            void registration.onBlur(event);
            runCheck(event.target.value);
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
       * `aria-live="polite"` announces each resolved state without interrupting
       * typing, and the input points here through `aria-describedby` so the
       * message is read as part of the field.
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
          errorMessage ? "text-destructive" : TONE_CLASS[fieldState.tone],
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
        {errorMessage ?? fieldState.message}
      </p>
    </div>
  );
}
