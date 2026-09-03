"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  Info,
  LoaderCircle,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Sofa,
  Sparkles,
  Store,
  TriangleAlert,
  Upload,
  type LucideIcon,
} from "lucide-react";
import {
  useId,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { useForm, useWatch } from "react-hook-form";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CONTRAST_TEXT, contrastRatio } from "@/lib/contrast";
import { strings } from "@/lib/strings";
import {
  ACCENT_FOREGROUND_LIGHT,
  DEFAULT_PRIMARY_ACCENT,
  DEFAULT_SECONDARY_ACCENT,
} from "@/lib/theme-defaults";
import { requestLogoUpload } from "@/server/images/actions";
import { saveBranding } from "@/server/theming/actions";
import { hexColorSchema } from "@/server/theming/schema";

/**
 * The branding step's one client island — ONB-02, ONB-03 and ONB-04 in a single
 * submit (D-02, D-10, D-11, D-12).
 *
 * Four cards, one primary button, and a navigation as the success signal.
 *
 * ---------------------------------------------------------------------------
 * SURFACE 2. THE MERCHANT'S COLOUR TOUCHES EXACTLY ONE ELEMENT PER FIELD.
 * ---------------------------------------------------------------------------
 * D-12, and 04-UI-SPEC.md § The colour field names the single exception: the
 * sample chip beneath each picker. NOTHING ELSE on this page may take a value
 * the merchant typed — no button fill, no link, no focus ring, no border, no
 * badge, no panel, no active state, and no "here is your CTA" preview widget.
 * The chrome here is the platform's fixed blue/gold/slate, exactly like every
 * other onboarding step, and the place a merchant sees their accent APPLIED is
 * the editor's preview iframe, which is a different document rendering the
 * storefront route tree. `tests/unit/surface-token-isolation.test.ts` ban 6
 * fails the build on the accent utility appearing here at all.
 *
 * That is also why the two defaults are IMPORTED from `@/lib/theme-defaults`
 * rather than typed: ban 1 greps every `.tsx` under `src/app` for a literal
 * colour value on any non-comment line, so a hex constant sitting next to the
 * picker that needs it is a red build rather than a lint nit.
 *
 * ---------------------------------------------------------------------------
 * THE CLIENT SCHEMA REUSES THE SERVER'S HEX VALIDATOR. IT DOES NOT RESTATE IT.
 * ---------------------------------------------------------------------------
 * T-04-09. `hexColorSchema` is the same anchored regex `saveBranding` enforces
 * and the same one the storefront layout re-checks on read, so client-time and
 * server-time validation cannot disagree — the `signup-form.tsx` precedent with
 * `storeSlugSchema`. It matters more than usual here because the value ends up
 * in a `style` attribute, and React sets custom properties through
 * `setProperty`, which does not sanitise. The chip below is painted from a
 * value that has cleared that parse and never from raw field state.
 *
 * ---------------------------------------------------------------------------
 * THE UPLOAD IS THE PRODUCT GALLERY'S, STRUCTURALLY UNCHANGED.
 * ---------------------------------------------------------------------------
 * Presign -> direct PUT -> finalize, copied from
 * `src/app/(dashboard)/dashboard/products/image-gallery-field.tsx` with the
 * kind changed and the count fixed at one. No filename, no key and no path ever
 * leaves this file (T-04-01): the presign action composes the key from the
 * session's tenant and a server-minted uuid, and the finalize route picks its
 * Sharp preset from a server-side map. Every failure branch is a status change,
 * never a thrown error — a logo is optional, so a failed upload must never be
 * able to block the step.
 */

// ---------------------------------------------------------------------------
// The contract with the route above and the two endpoints below
// ---------------------------------------------------------------------------

/**
 * One industry tile, as plain data.
 *
 * `icon` is a NAME, not a component: `src/server/theming/registry.ts` carries
 * `server-only` and must not import React, so the mapping to a lucide component
 * happens here, at the client boundary that already depends on the icon set.
 */
export interface SegmentTile {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
}

/**
 * The six names `INDUSTRY_SEGMENT_ICONS` can hold, resolved.
 *
 * A lookup with a fallback rather than an exhaustive `Record<IndustrySegment,
 * …>`: the segment type lives behind the `server-only` boundary, and a missing
 * glyph must degrade to a generic one rather than crash the step a merchant
 * cannot skip.
 */
const SEGMENT_ICONS: Readonly<Record<string, LucideIcon>> = {
  shirt: Shirt,
  smartphone: Smartphone,
  sparkles: Sparkles,
  "shopping-basket": ShoppingBasket,
  sofa: Sofa,
  store: Store,
};

/** The finalize endpoint. `kind` is what scopes it to this surface. */
const FINALIZE_ENDPOINT = "/api/upload/finalize";
const FINALIZE_KIND = "logos";

/**
 * The derivative rendered in the preview — the 512px label from the `logo`
 * preset in `src/server/images/pipeline.ts`. A stored key is a PREFIX and only
 * derivatives are ever addressed (T-03-58); the unprocessed uploaded bytes have
 * no URL here.
 */
const LOGO_DERIVATIVE = "large.webp";

/**
 * A courtesy mirror of the server's allowlist, never a replacement.
 *
 * The list in `src/server/images/r2.ts` is the authority and is checked before
 * anything is signed; that module is `server-only`, so it cannot be imported
 * here. This copy saves a round trip on a file the server was always going to
 * refuse and drives the picker's `accept` filter. If the two ever drift the
 * server wins, which is the correct direction for them to drift in.
 */
const ACCEPTED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * `localhost:3000` in development, `einort.com` in production. Read as a
 * LITERAL `process.env` reference so Next inlines it into the client bundle —
 * a destructure or a dynamic key yields `undefined` in the browser.
 */
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "einort.com";

/**
 * The merchant's own storefront origin, built exactly as
 * `src/app/onboarding/plan/page.tsx` builds it: `http` when the configured root
 * domain is local, `https` everywhere else.
 *
 * THE HOST COMES FROM THE BUILD-TIME ROOT DOMAIN, NEVER FROM THE BROWSER'S OWN
 * LOCATION. `window.location.host` would read whatever hostname this page
 * happens to be served under, which is a value an attacker who can frame or
 * proxy the page controls — and the result of that read would then be navigated
 * to. The one thing taken from the current document is nothing at all.
 *
 * A named function rather than an inline template because the destination is
 * cross-origin: `@next/next/no-location-assign-relative-destination` cannot
 * prove a template literal is absolute and fails the build on it, which is the
 * same shape `plan-picker.tsx` already settled into.
 */
function storefrontOrigin(slug: string): string {
  const protocol = ROOT_DOMAIN.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${slug}.${ROOT_DOMAIN}`;
}

/** What the finalize route reports back, narrowed from an unknown body. */
function readFinalizeResult(body: unknown): { storageKey: string } | null {
  if (typeof body !== "object" || body === null) return null;
  const record = body as Record<string, unknown>;
  if (typeof record.storageKey !== "string") return null;
  return { storageKey: record.storageKey };
}

// ---------------------------------------------------------------------------
// The form's own shape
// ---------------------------------------------------------------------------

/**
 * `businessName`'s bounds are `saveBranding`'s, which are `signUpMerchant`'s —
 * all three write the same organization name column, and a cap declared three
 * times with three numbers is a cap that disagrees with itself.
 *
 * `industry` is a non-empty string here rather than the closed segment union:
 * the union is `server-only` and the server narrows through `isIndustrySegment`
 * before any write (T-04-13). The client's job is to refuse an EMPTY selection,
 * which is the only failure a merchant using the tiles can actually produce.
 *
 * The logo is deliberately absent. It is optional, it is not a text field, and
 * its key is only known once an upload has finalised — so it is held as
 * component state and read at submit, the same way the product gallery hands
 * only its `ready` entries to the product form.
 */
const brandingFormSchema = z.object({
  businessName: z.string().trim().min(2).max(80),
  industry: z.string().min(1),
  primaryAccent: hexColorSchema,
  secondaryAccent: hexColorSchema,
});

type BrandingFormValues = z.infer<typeof brandingFormSchema>;

/** The logo field's four visual states (04-UI-SPEC.md § Onboarding card 3). */
type LogoStatus = "empty" | "uploading" | "ready" | "failed";

interface LogoState {
  readonly status: LogoStatus;
  /** The local object URL while uploading, the derivative once stored. */
  readonly previewUrl: string | null;
  /** Retained so a failed upload retries without a second file pick. */
  readonly file: File | null;
  readonly storageKey: string | null;
}

const EMPTY_LOGO: LogoState = {
  status: "empty",
  previewUrl: null,
  file: null,
  storageKey: null,
};

/**
 * The value the sample chip is painted with: the merchant's colour once it
 * parses, the ink default until it does.
 *
 * This is the whole of T-04-09's client-side half. A half-typed value is not a
 * colour, and handing one to a `style` attribute is the thing the anchored
 * regex exists to prevent — so the chip shows the default rather than nothing,
 * and the field's own error tells the merchant why it has not moved.
 */
function sampleColour(value: string, fallback: string): string {
  return hexColorSchema.safeParse(value).success ? value : fallback;
}

// ---------------------------------------------------------------------------
// The colour field
// ---------------------------------------------------------------------------

/**
 * One accent: a native swatch, a monospace hex input, and a sample chip.
 *
 * ONE COMPONENT RENDERED TWICE, NOT TWO COPIES. The behaviour — two controls
 * bound to one value, auto-uppercasing, the 7-character cap, the chip painted
 * from validated state — is identical for both accents, and a second copy of
 * behaviour is how two fields that must agree silently stop agreeing. The one
 * real difference is the contrast warning, which the parent passes in as a
 * node: it belongs to the PRIMARY accent only, deliberately (see the call
 * site).
 */
function ColourField({
  label,
  caption,
  value,
  sample,
  invalid,
  warning,
  onChange,
}: {
  readonly label: string;
  readonly caption: string;
  readonly value: string;
  readonly sample: string;
  readonly invalid: boolean;
  readonly warning: ReactNode;
  readonly onChange: (next: string) => void;
}) {
  const labelId = useId();
  const inputId = useId();
  const errorId = useId();

  return (
    <div className="flex flex-col gap-2">
      <Label id={labelId} htmlFor={inputId}>
        {label}
      </Label>

      <div className="flex items-center gap-3">
        {/*
         * 44x44. A native picker rather than a hand-rolled one: it is the
         * control the platform already knows how to render on a low-end
         * Android, and it emits `#rrggbb` and nothing else, which is why
         * `hexColorSchema` can afford to refuse three-digit shorthand.
         */}
        <input
          type="color"
          aria-labelledby={labelId}
          value={sample}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="size-11 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-1 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        />

        <Input
          id={inputId}
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          maxLength={7}
          spellCheck={false}
          autoCapitalize="characters"
          autoCorrect="off"
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId : undefined}
          className="min-h-11 font-mono uppercase"
        />
      </div>

      <div className="flex items-center gap-2">
        {/*
         * THE ONE ELEMENT ON THIS PAGE THAT TAKES THE MERCHANT'S COLOUR
         * (D-12's named exception). `sample` has cleared `hexColorSchema`
         * above — it is validated state and never a literal.
         */}
        <span
          aria-hidden="true"
          style={{ backgroundColor: sample }}
          className="size-6 shrink-0 rounded border border-border"
        />
        <Label className="text-sm leading-normal font-normal text-muted-foreground">
          {caption}
        </Label>
      </div>

      {invalid ? (
        <p
          id={errorId}
          className="text-sm leading-normal text-destructive"
        >
          {strings.branding.invalidHex}
        </p>
      ) : null}

      {warning}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The form
// ---------------------------------------------------------------------------

export function BrandingForm({
  businessName,
  segments,
  imageBaseUrl,
}: {
  readonly businessName: string;
  readonly segments: readonly SegmentTile[];
  readonly imageBaseUrl: string;
}) {
  const nameInputId = useId();
  const nameHelperId = useId();
  const industryLabelId = useId();
  const industryHelperId = useId();
  const tilePrefix = useId();
  const logoInputId = useId();
  const contrastId = useId();

  const [formError, setFormError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [logo, setLogo] = useState<LogoState>(EMPTY_LOGO);

  const form = useForm<BrandingFormValues>({
    resolver: zodResolver(brandingFormSchema),
    mode: "onBlur",
    defaultValues: {
      // ONB-02 asks the merchant to CONFIRM the name captured at signup, not to
      // invent a new one.
      businessName,
      industry: "",
      primaryAccent: DEFAULT_PRIMARY_ACCENT,
      secondaryAccent: DEFAULT_SECONDARY_ACCENT,
    },
  });

  const {
    control,
    formState: { errors, isSubmitting },
    register,
    setError,
    setValue,
  } = form;

  const industry = useWatch({ control, name: "industry" }) ?? "";
  const primaryAccent = useWatch({ control, name: "primaryAccent" }) ?? "";
  const secondaryAccent = useWatch({ control, name: "secondaryAccent" }) ?? "";
  const nameValue = useWatch({ control, name: "businessName" }) ?? "";

  const primarySample = sampleColour(primaryAccent, DEFAULT_PRIMARY_ACCENT);
  const secondarySample = sampleColour(
    secondaryAccent,
    DEFAULT_SECONDARY_ACCENT,
  );

  /**
   * D-11, PRIMARY ONLY, AND NON-BLOCKING.
   *
   * The primary accent is the one that becomes a LINK on a white page, which is
   * a readability judgement the merchant is allowed to make badly — so this is
   * an informational line, never a destructive alert, and it is deliberately
   * not wired to the submit button's `disabled`.
   *
   * There is NO equivalent for the secondary accent and adding one would be a
   * regression. That colour is only ever a fill whose foreground is derived
   * server-side by `deriveThemeCssVars`, so it is readable at every value, and
   * warning about a problem that cannot occur teaches merchants to dismiss
   * warnings that matter. The button-fill and focus-ring cases are auto-fixed
   * rather than warned about for the same reason, one step further: a merchant
   * must not be able to produce a button whose own label is unreadable.
   */
  const lowContrast =
    contrastRatio(primarySample, ACCENT_FOREGROUND_LIGHT) < CONTRAST_TEXT;

  // -------------------------------------------------------------------------
  // The logo's three hops
  // -------------------------------------------------------------------------

  async function runUpload(file: File, previewUrl: string) {
    setLogo({ status: "uploading", previewUrl, file, storageKey: null });

    const fail = () =>
      setLogo({ status: "failed", previewUrl, file, storageKey: null });

    if (!ACCEPTED_CONTENT_TYPES.includes(file.type)) {
      fail();
      return;
    }

    const grant = await requestLogoUpload({
      contentType: file.type,
      byteSize: file.size,
    });
    if (!grant.ok) {
      fail();
      return;
    }

    /*
     * The header must be byte-for-byte the signed value. R2 compares it against
     * the signature, so a differently-cased media type here is a 403 blamed on
     * storage and caused three lines above.
     */
    const stored = await fetch(grant.uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });
    if (!stored.ok) {
      fail();
      return;
    }

    const finalized = await fetch(FINALIZE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uploadId: grant.uploadId, kind: FINALIZE_KIND }),
    });
    if (!finalized.ok) {
      fail();
      return;
    }

    const result = readFinalizeResult(await finalized.json());
    if (result === null) {
      fail();
      return;
    }

    // The local blob has done its job; the derivative is a plain URL.
    URL.revokeObjectURL(previewUrl);
    setLogo({
      status: "ready",
      previewUrl: `${imageBaseUrl}/${result.storageKey}/${LOGO_DERIVATIVE}`,
      file,
      storageKey: result.storageKey,
    });
  }

  function handleLogoSelection(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    // Cleared so picking the same file twice in a row still fires a change.
    event.target.value = "";
    if (!picked) return;

    if (logo.previewUrl !== null && logo.file !== null) {
      URL.revokeObjectURL(logo.previewUrl);
    }
    void runUpload(picked, URL.createObjectURL(picked));
  }

  function removeLogo() {
    if (logo.previewUrl !== null && logo.file !== null) {
      URL.revokeObjectURL(logo.previewUrl);
    }
    setLogo(EMPTY_LOGO);
  }

  function retryLogo() {
    if (logo.file === null || logo.previewUrl === null) return;
    void runUpload(logo.file, logo.previewUrl);
  }

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);

    /*
     * Five fields and NO TENANT IDENTIFIER (T-04-04). The organization this
     * writes to is the session's active one, resolved server-side; there is
     * deliberately nothing in this payload for a direct POST to substitute.
     * Only a `ready` upload contributes a key — an in-flight or failed one is
     * not a logo the store has.
     */
    const result = await saveBranding({
      businessName: values.businessName,
      industry: values.industry,
      logoKey: logo.status === "ready" ? logo.storageKey : null,
      primaryAccent: values.primaryAccent,
      secondaryAccent: values.secondaryAccent,
    });

    if (result.ok) {
      /*
       * The store is already live — `saveBranding` wrote the published halves
       * in the same transaction (ONB-04) — so the success signal is the
       * navigation itself and there is no toast.
       *
       * The storefront is a DIFFERENT HOST, so this is a full navigation and the
       * router cannot do it. `storefrontOrigin` is the same builder
       * `/onboarding/plan` uses — see its header for why the host is never read
       * off the current document.
       */
      setRedirecting(true);
      window.location.assign(storefrontOrigin(result.slug));
      return;
    }

    for (const [field, messages] of Object.entries(result.error)) {
      const message = messages?.[0];
      if (!message) continue;
      if (
        field === "businessName" ||
        field === "industry" ||
        field === "primaryAccent" ||
        field === "secondaryAccent"
      ) {
        setError(field, { type: "server", message });
      } else {
        // `form`, and `logoKey` — which has no field of its own to point at.
        setFormError(message);
      }
    }
  });

  const busy = isSubmitting || redirecting;

  return (
    <form onSubmit={onSubmit} noValidate className="mt-8 flex flex-col gap-6">
      {/* --- 1. Business name ------------------------------------------- */}
      <Card className="rounded-lg border border-border bg-muted ring-0 [--card-spacing:--spacing(4)] sm:[--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle>{strings.branding.nameCardTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Label htmlFor={nameInputId}>{strings.branding.nameLabel}</Label>
          <Input
            id={nameInputId}
            {...register("businessName")}
            required
            aria-invalid={errors.businessName !== undefined}
            aria-describedby={nameHelperId}
            className="min-h-11"
          />
          <p
            id={nameHelperId}
            className="text-sm leading-normal text-muted-foreground"
          >
            {strings.branding.nameHelper}
          </p>
          {errors.businessName ? (
            <p className="text-sm leading-normal text-destructive">
              {errors.businessName.message}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* --- 2. What do you sell? --------------------------------------- */}
      <Card className="rounded-lg border border-border bg-muted ring-0 [--card-spacing:--spacing(4)] sm:[--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle id={industryLabelId}>
            {strings.branding.industryCardTitle}
          </CardTitle>
          <CardDescription id={industryHelperId}>
            {strings.branding.industryHelper}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <RadioGroup
            value={industry}
            onValueChange={(value: unknown) => {
              setValue("industry", String(value), { shouldValidate: true });
            }}
            aria-labelledby={industryLabelId}
            aria-describedby={industryHelperId}
            className="grid grid-cols-2 gap-4 sm:grid-cols-3"
          >
            {segments.map((segment) => {
              const Icon = SEGMENT_ICONS[segment.icon] ?? Store;
              const selected = industry === segment.id;
              const tileLabelId = `${tilePrefix}-${segment.id}`;
              return (
                <div
                  key={segment.id}
                  className={
                    /*
                     * THE WHOLE TILE IS THE TAP TARGET. The radio itself is
                     * stretched over the tile at zero opacity rather than
                     * shrunk into a corner, so there is no 16px dot to hit on a
                     * phone — the border and ring below are what communicate
                     * the selection instead.
                     */
                    selected
                      ? "relative flex min-h-24 flex-col items-start gap-2 rounded-lg border border-primary bg-card p-4 text-left ring-2 ring-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring"
                      : "relative flex min-h-24 flex-col items-start gap-2 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring"
                  }
                >
                  <RadioGroupItem
                    value={segment.id}
                    aria-labelledby={tileLabelId}
                    className="absolute inset-0 aspect-auto size-full rounded-lg border-0 bg-transparent opacity-0 after:hidden data-checked:bg-transparent"
                  />
                  <Icon aria-hidden="true" className="size-6 text-foreground" />
                  <Label
                    id={tileLabelId}
                    className="text-sm leading-normal font-medium text-foreground"
                  >
                    {segment.label}
                  </Label>
                </div>
              );
            })}
          </RadioGroup>
          {errors.industry ? (
            <p className="text-sm leading-normal text-destructive">
              {errors.industry.message}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* --- 3. Logo (optional) ----------------------------------------- */}
      <Card className="rounded-lg border border-border bg-muted ring-0 [--card-spacing:--spacing(4)] sm:[--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle>{strings.branding.logoCardTitle}</CardTitle>
          <CardDescription>{strings.branding.logoHelper}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <input
            id={logoInputId}
            type="file"
            accept={ACCEPTED_CONTENT_TYPES.join(",")}
            onChange={handleLogoSelection}
            className="sr-only"
          />

          {logo.status === "empty" ? (
            <label
              htmlFor={logoInputId}
              className="flex min-h-11 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border p-6 text-center hover:bg-accent has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"
            >
              <Upload
                aria-hidden="true"
                className="size-5 text-muted-foreground"
              />
              <span className="text-sm leading-normal font-semibold text-foreground">
                {strings.branding.logoAdd}
              </span>
            </label>
          ) : logo.status === "failed" ? (
            <button
              type="button"
              onClick={retryLogo}
              className="flex min-h-24 w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-destructive p-6 text-center focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <TriangleAlert
                aria-hidden="true"
                className="size-5 text-destructive"
              />
              <span
                role="status"
                aria-live="polite"
                className="text-sm leading-normal text-destructive"
              >
                {strings.branding.logoUploadFailed}
              </span>
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative size-24 shrink-0 overflow-hidden rounded-lg bg-muted">
                {/*
                 * A plain `img`, not `next/image`: R2's public hostname is only
                 * known at runtime. `object-contain`, never `object-cover` — a
                 * logo is never cropped.
                 */}
                {logo.previewUrl === null ? null : (
                  // eslint-disable-next-line @next/next/no-img-element -- see the note above.
                  <img
                    src={logo.previewUrl}
                    alt={nameValue}
                    className={
                      logo.status === "uploading"
                        ? "size-full object-contain opacity-40"
                        : "size-full object-contain"
                    }
                  />
                )}
                {logo.status === "uploading" ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <LoaderCircle className="size-6 animate-spin text-foreground" />
                  </span>
                ) : null}
              </div>

              {logo.status === "ready" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <label
                    htmlFor={logoInputId}
                    className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-border px-4 text-sm leading-normal font-semibold text-foreground hover:bg-accent has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"
                  >
                    {strings.branding.logoReplace}
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={removeLogo}
                    className="min-h-11 px-4 text-sm font-semibold"
                  >
                    {strings.branding.logoRemove}
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      {/* --- 4. Brand colours ------------------------------------------- */}
      <Card className="rounded-lg border border-border bg-muted ring-0 [--card-spacing:--spacing(4)] sm:[--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle>{strings.branding.coloursCardTitle}</CardTitle>
          <CardDescription>{strings.branding.coloursHelper}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <ColourField
            label={strings.branding.primaryAccentLabel}
            caption={strings.branding.primaryAccentCaption}
            value={primaryAccent}
            sample={primarySample}
            invalid={errors.primaryAccent !== undefined}
            onChange={(next) =>
              setValue("primaryAccent", next, { shouldValidate: true })
            }
            warning={
              lowContrast ? (
                <p
                  id={contrastId}
                  role="status"
                  aria-live="polite"
                  className="flex items-start gap-2 text-sm leading-normal text-muted-foreground"
                >
                  <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  {strings.branding.contrastWarning}
                </p>
              ) : null
            }
          />

          <ColourField
            label={strings.branding.secondaryAccentLabel}
            caption={strings.branding.secondaryAccentCaption}
            value={secondaryAccent}
            sample={secondarySample}
            invalid={errors.secondaryAccent !== undefined}
            onChange={(next) =>
              setValue("secondaryAccent", next, { shouldValidate: true })
            }
            /* No warning here, deliberately — see `lowContrast` above. */
            warning={null}
          />
        </CardContent>
      </Card>

      {/*
       * A blocking failure is a destructive alert above the CTA, never a toast
       * alone: a toast is gone before a merchant on a slow phone has finished
       * reading it, and this one has to be actionable.
       */}
      {formError ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription className="text-destructive">
            {formError}
          </AlertDescription>
        </Alert>
      ) : null}

      {/*
       * The one primary button on this page, and there is no "skip" beside it:
       * the industry answer gates the redirect ladder, so skipping it would
       * return the merchant here on their next request. The logo and the two
       * colours are optional and fall back to the ink defaults, which is why
       * the label reads the same either way.
       */}
      <Button
        type="submit"
        disabled={busy}
        className="min-h-11 w-full px-6 text-sm font-semibold"
      >
        {busy ? (
          <>
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            {strings.branding.ctaSubmitting}
          </>
        ) : (
          strings.branding.cta
        )}
      </Button>
    </form>
  );
}
