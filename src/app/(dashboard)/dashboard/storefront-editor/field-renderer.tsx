"use client";

import { useId, useState, type ChangeEvent, type ReactNode } from "react";
import {
  Info,
  Link as LinkIcon,
  LoaderCircle,
  TriangleAlert,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CONTRAST_TEXT, contrastRatio } from "@/lib/contrast";
import { strings } from "@/lib/strings";
import {
  ACCENT_FOREGROUND_LIGHT,
  DEFAULT_PRIMARY_ACCENT,
} from "@/lib/theme-defaults";
import { requestProductImageUpload } from "@/server/images/actions";
import type { FieldDescriptor } from "@/server/theming/registry";
import { hexColorSchema } from "@/server/theming/schema";
import type { ThemeTokens } from "@/server/theming/schema";

/**
 * EDIT-02 — the six field kinds (04-UI-SPEC.md § The six field kinds).
 *
 * ---------------------------------------------------------------------------
 * EVERY CHANGE DISPATCHES IMMEDIATELY. DELAYING ONE IS A REGRESSION, NOT AN
 * OPTIMISATION, AND NO TIMER BELONGS IN THIS FILE.
 * ---------------------------------------------------------------------------
 * D-07 is the product's differentiator and it is spelled out in 04-UI-SPEC.md
 * § As-you-type: every keystroke, every colour change and every select change
 * calls `onChange` on the spot. The push from there to the preview is a
 * `postMessage` hop between two documents the browser already has open — there
 * is NO NETWORK IN THE LOOP — so coalescing keystrokes behind a delay would buy
 * nothing and spend latency on the one interaction the merchant is actively
 * judging. Persistence is the explicit `Save` in the publish bar, not an
 * autosave, so a keystroke costs nothing beyond a re-render either. The
 * identifiers this rule forbids are deliberately not spelled out here, because
 * the audit for it is a plain grep over this file (the `registry.ts`
 * precedent).
 *
 * ---------------------------------------------------------------------------
 * ONE SWITCH, SIX ARMS, NO `default`.
 * ---------------------------------------------------------------------------
 * A seventh `FieldKind` must be a COMPILE error here, exactly as a sixth
 * section type is at `section-renderer.tsx` and a seventh action is in
 * `editorReducer`. A `default` arm returning a plain text input would instead
 * make the new kind silently wrong: legal-looking, untested, and discovered by
 * a merchant whose colour picker is a text box.
 *
 * ---------------------------------------------------------------------------
 * THIS COMPONENT OWNS NO DRAFT STATE.
 * ---------------------------------------------------------------------------
 * `value` comes down and `onChange` goes up; plan 04-15's `editor-shell.tsx`
 * owns the `useReducer`. The only state below belongs to an upload in flight,
 * which is a fact about the network rather than about the document.
 *
 * ---------------------------------------------------------------------------
 * SURFACE 3 TOKENS ONLY — WITH ONE NAMED EXCEPTION.
 * ---------------------------------------------------------------------------
 * D-12: the merchant's accent resolves to nothing on a dashboard surface and
 * `tests/unit/surface-token-isolation.test.ts` ban 6 fails the build on that
 * token's utility family anywhere in this file — the token is deliberately not
 * spelled out here, because the audit for it is a plain grep (the `registry.ts`
 * precedent). The `size-6` sample chip in the
 * colour arm is 04-UI-SPEC's one named exception — it shows the merchant what
 * they picked, and NOTHING ELSE on this surface takes their colour. Its value
 * has cleared `hexColorSchema` before it reaches `style`, which is the same
 * anchored regex `saveDraft` and the storefront read path apply (T-04-09).
 */

// ---------------------------------------------------------------------------
// Upload contract — one implementation, reused, never a second one
// ---------------------------------------------------------------------------

/**
 * The finalize endpoint and namespace for a SECTION image.
 *
 * `products` is deliberate: a hero background and an editorial photo are
 * merchant catalogue imagery and live in the same namespace `storageKeySchema`
 * already accepts. `requestProductImageUpload` and `requestLogoUpload` are
 * SIBLING actions on purpose (see the header of `src/server/images/actions.ts`)
 * and must not be merged behind a client-supplied namespace.
 *
 * CONSEQUENCE WORTH KNOWING: `THEME_FIELDS.logoKey` is also an `image`
 * descriptor, so a logo replaced from the editor's theme panel would be signed
 * into the products namespace by this arm. That is harmless today because
 * `logoKey` is NOT part of `themeTokensSchema` and `saveDraft` therefore cannot
 * persist it at all this phase — the logo is written by onboarding's
 * `saveBranding` alone. Whichever plan wires the theme panel to a logo write
 * must route it through `requestLogoUpload`; it is recorded under Deferred
 * Issues in `04-12-SUMMARY.md`.
 */
const FINALIZE_ENDPOINT = "/api/upload/finalize";
const FINALIZE_KIND = "products";

/** The 400px rendition from the `product` preset — the settings-panel thumb. */
const THUMB_DERIVATIVE = "thumb.webp";

/**
 * A courtesy mirror of `ALLOWED_UPLOAD_CONTENT_TYPES`, never a replacement —
 * the same posture, and the same reasoning, as `image-gallery-field.tsx`. The
 * `server-only` list in `src/server/images/r2.ts` is the authority and is
 * checked before anything is signed.
 */
const ACCEPTED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** What the finalize route reports back, narrowed from an unknown body. */
function readFinalizeResult(body: unknown): { storageKey: string } | null {
  if (typeof body !== "object" || body === null) return null;
  const record = body as Record<string, unknown>;
  if (typeof record.storageKey !== "string") return null;
  return { storageKey: record.storageKey };
}

// ---------------------------------------------------------------------------
// Link validation
// ---------------------------------------------------------------------------

/**
 * The internal rewrite prefix `src/proxy.ts` hard-404s on a direct request.
 *
 * A merchant who types it has read their own address bar, so the rejection has
 * to tell them the fix and not just the rule — accepting the value would ship a
 * button that is guaranteed dead on a real customer's storefront (T-04-07).
 * `tests/unit/storefront-link-prefix.test.ts` guards the same rule on the
 * render side.
 */
const INTERNAL_ROUTE_PREFIX = "/s/";
const ABSOLUTE_PREFIX = "https://";

/** `null` when the value is acceptable, otherwise the message to render. */
function linkError(value: string): string | null {
  if (value === "") return null;
  if (value.startsWith(INTERNAL_ROUTE_PREFIX)) {
    return strings.editor.linkInternalPrefix;
  }
  if (value.startsWith("/") || value.startsWith(ABSOLUTE_PREFIX)) return null;
  return strings.editor.linkInvalid;
}

// ---------------------------------------------------------------------------
// The one field whose warning is not the same as every other field's
// ---------------------------------------------------------------------------

/**
 * The descriptor key carrying the primary accent.
 *
 * Typed as `keyof ThemeTokens` so renaming the token in `themeTokensSchema` is
 * a compile error here rather than a D-11 warning that silently stops
 * rendering. It is a literal rather than an import because
 * `src/server/theming/registry.ts` carries `server-only`.
 */
const PRIMARY_ACCENT_KEY: keyof ThemeTokens = "primaryAccent";

// ---------------------------------------------------------------------------
// Shared chrome
// ---------------------------------------------------------------------------

/** Label + control + helper + error, in that order, on every kind. */
function FieldShell({
  labelId,
  htmlFor,
  label,
  helper,
  error,
  children,
}: {
  readonly labelId?: string;
  readonly htmlFor: string;
  readonly label: string;
  readonly helper?: string;
  readonly error?: string | null;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      {/* A visible label on every field. Placeholder-as-label is a contract
          violation, not a style choice (04-UI-SPEC § Accessibility floor). */}
      <Label id={labelId} htmlFor={htmlFor}>
        {label}
      </Label>
      {children}
      {helper === undefined ? null : (
        <p className="text-sm leading-normal text-muted-foreground">{helper}</p>
      )}
      {error === undefined || error === null ? null : (
        <p className="text-sm leading-normal text-destructive">{error}</p>
      )}
    </div>
  );
}

/** `{n}/{max}`, right-aligned, destructive at the cap. */
function CharacterCounter({
  length,
  max,
}: {
  readonly length: number;
  readonly max: number;
}) {
  return (
    <span
      aria-hidden="true"
      className={
        length >= max
          ? "self-end text-sm font-semibold tabular-nums text-destructive"
          : "self-end text-sm font-semibold tabular-nums text-muted-foreground"
      }
    >
      {`${length}/${max}`}
    </span>
  );
}

// ---------------------------------------------------------------------------
// The image arm
// ---------------------------------------------------------------------------

type UploadState = "idle" | "uploading" | "failed";

/**
 * The single-image field: presign -> browser PUT -> finalize, structurally the
 * same three steps as `image-gallery-field.tsx` and for the same reasons.
 *
 * THE BYTES NEVER TOUCH A SERVER ACTION, AND NO FILENAME EVER LEAVES THIS FILE.
 * The two requests carry `{ contentType, byteSize }` and `{ uploadId, kind }`
 * and nothing else; the key is composed server-side from the session's tenant
 * and a server-minted uuid (T-03-55). `onChange` emits the `storageKey`, NEVER
 * a URL — a document that stored a URL could point the storefront's image at an
 * arbitrary host, which is the whole reason `storageKeySchema` exists.
 */
function ImageField({
  descriptor,
  value,
  imageBaseUrl,
  onChange,
}: {
  readonly descriptor: FieldDescriptor;
  readonly value: string | null;
  readonly imageBaseUrl: string;
  readonly onChange: (value: unknown) => void;
}) {
  const inputId = useId();
  const [state, setState] = useState<UploadState>("idle");
  const [preview, setPreview] = useState<string | null>(null);

  async function runUpload(file: File) {
    setState("uploading");
    setPreview(URL.createObjectURL(file));

    if (!ACCEPTED_CONTENT_TYPES.includes(file.type)) {
      setState("failed");
      return;
    }

    const grant = await requestProductImageUpload({
      contentType: file.type,
      byteSize: file.size,
    });
    if (!grant.ok) {
      setState("failed");
      return;
    }

    /*
     * The header must be byte-for-byte the signed value. R2 compares it against
     * the signature, so `image/JPEG` here is a 403 blamed on storage and caused
     * three lines above.
     */
    const stored = await fetch(grant.uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });
    if (!stored.ok) {
      setState("failed");
      return;
    }

    const finalized = await fetch(FINALIZE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uploadId: grant.uploadId, kind: FINALIZE_KIND }),
    });
    if (!finalized.ok) {
      setState("failed");
      return;
    }

    const result = readFinalizeResult(await finalized.json());
    if (result === null) {
      setState("failed");
      return;
    }

    setState("idle");
    setPreview(null);
    onChange(result.storageKey);
  }

  function handleSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Cleared so choosing the same photo twice in a row still fires a change.
    event.target.value = "";
    if (file === undefined) return;
    void runUpload(file);
  }

  const storedUrl =
    value === null || value === "" ? null : `${imageBaseUrl}/${value}/${THUMB_DERIVATIVE}`;
  const shownUrl = preview ?? storedUrl;

  return (
    <FieldShell
      htmlFor={inputId}
      label={descriptor.label}
      helper={descriptor.helper}
    >
      <input
        id={inputId}
        type="file"
        accept={ACCEPTED_CONTENT_TYPES.join(",")}
        onChange={handleSelection}
        className="sr-only"
      />

      {shownUrl === null ? (
        <label
          htmlFor={inputId}
          className={
            state === "failed"
              ? "flex min-h-11 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-destructive p-6 text-center"
              : "flex min-h-11 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border p-6 text-center hover:bg-muted has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"
          }
        >
          {state === "failed" ? (
            <>
              <TriangleAlert
                aria-hidden="true"
                className="size-5 text-destructive"
              />
              <span
                role="status"
                aria-live="polite"
                className="text-sm leading-normal text-destructive"
              >
                {strings.editor.imageUploadFailed}
              </span>
            </>
          ) : (
            <>
              <Upload
                aria-hidden="true"
                className="size-5 text-muted-foreground"
              />
              <span className="text-sm leading-normal font-semibold text-foreground">
                {strings.editor.imageAdd}
              </span>
            </>
          )}
        </label>
      ) : (
        <div className="flex items-center gap-3">
          <span className="relative block aspect-[3/2] w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
            {/*
             * A plain `img`, not `next/image`: R2's public hostname is only
             * known at runtime. `image-gallery-field.tsx` renders its tiles the
             * same way for the same reason, and carries the same recorded
             * follow-up. `alt=""` because the field's visible label above
             * already names what this picture is.
             */}
            {/* eslint-disable-next-line @next/next/no-img-element -- see the note above. */}
            <img
              src={shownUrl}
              alt=""
              className={
                state === "uploading"
                  ? "size-full object-cover opacity-40"
                  : "size-full object-cover"
              }
            />
            {state === "uploading" ? (
              <span
                aria-hidden="true"
                className="absolute inset-0 flex items-center justify-center"
              >
                <LoaderCircle className="size-6 animate-spin text-foreground" />
              </span>
            ) : null}
          </span>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="min-h-11"
              render={<label htmlFor={inputId} />}
            >
              {strings.editor.imageReplace}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              onClick={() => {
                setPreview(null);
                setState("idle");
                onChange(null);
              }}
            >
              {strings.editor.imageRemove}
            </Button>
          </div>
        </div>
      )}
    </FieldShell>
  );
}

// ---------------------------------------------------------------------------
// The colour arm
// ---------------------------------------------------------------------------

/**
 * Identical to the onboarding colour field, deliberately: 04-UI-SPEC.md makes
 * them the same control so the merchant reads the same words in both places.
 *
 * The D-11 warning is NON-BLOCKING and lands on the PRIMARY accent only. An
 * accent that is hard to read as a link is the merchant's call. There is no
 * equivalent warning on the secondary accent because that colour is only ever a
 * fill whose foreground is derived server-side, so it is readable at every
 * value — and warning about a problem that cannot occur teaches merchants to
 * dismiss warnings.
 */
function ColorField({
  descriptor,
  value,
  onChange,
}: {
  readonly descriptor: FieldDescriptor;
  readonly value: string;
  readonly onChange: (value: unknown) => void;
}) {
  const hexId = useId();
  const labelId = useId();

  const valid = hexColorSchema.safeParse(value).success;
  const isPrimary = descriptor.key === PRIMARY_ACCENT_KEY;
  const lowContrast =
    valid &&
    isPrimary &&
    contrastRatio(value, ACCENT_FOREGROUND_LIGHT) < CONTRAST_TEXT;

  return (
    <FieldShell
      labelId={labelId}
      htmlFor={hexId}
      label={descriptor.label}
      error={valid ? null : strings.branding.invalidHex}
    >
      <div className="flex items-center gap-3">
        <input
          type="color"
          aria-labelledby={labelId}
          value={valid ? value : DEFAULT_PRIMARY_ACCENT}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="size-11 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-1 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        />
        <Input
          id={hexId}
          type="text"
          inputMode="text"
          maxLength={7}
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={!valid}
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="min-h-11 font-mono"
        />
      </div>

      {valid ? (
        <p className="flex items-center gap-2 text-sm leading-normal text-muted-foreground">
          {/*
           * THE ONE PLACE ON SURFACE 3 THAT TAKES THE MERCHANT'S COLOUR (D-12).
           * The value has cleared `hexColorSchema` on the line above; it is a
           * variable, never a literal, which is what keeps ban #1 green.
           */}
          <span
            aria-hidden="true"
            style={{ backgroundColor: value }}
            className="size-6 shrink-0 rounded border border-border"
          />
          {descriptor.helper}
        </p>
      ) : null}

      {lowContrast ? (
        <p
          role="status"
          aria-live="polite"
          className="flex items-start gap-1.5 text-sm leading-normal text-muted-foreground"
        >
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {strings.branding.contrastWarning}
        </p>
      ) : null}
    </FieldShell>
  );
}

// ---------------------------------------------------------------------------
// The renderer
// ---------------------------------------------------------------------------

export interface FieldRendererProps {
  readonly descriptor: FieldDescriptor;
  /**
   * `unknown` because the descriptors are a homogeneous table — the panel
   * cannot know the narrowed type of the field it is writing. Validation is not
   * skipped, it is relocated: `pageDocumentSchema` parses the result at the
   * publish gate and again inside the preview iframe.
   */
  readonly value: unknown;
  /** The Zod `.max()` for this key, when it has one. Drives the counter. */
  readonly max?: number;
  readonly imageBaseUrl: string;
  readonly onChange: (value: unknown) => void;
}

export function FieldRenderer({
  descriptor,
  value,
  max,
  imageBaseUrl,
  onChange,
}: FieldRendererProps) {
  const id = useId();
  const text = typeof value === "string" ? value : "";

  switch (descriptor.kind) {
    case "text":
      return (
        <FieldShell
          htmlFor={id}
          label={descriptor.label}
          helper={descriptor.helper}
        >
          <Input
            id={id}
            type="text"
            maxLength={max}
            value={text}
            onChange={(event) => onChange(event.target.value)}
            className="min-h-11"
          />
          {max === undefined ? null : (
            <CharacterCounter length={text.length} max={max} />
          )}
        </FieldShell>
      );

    case "textarea":
      return (
        <FieldShell
          htmlFor={id}
          label={descriptor.label}
          helper={descriptor.helper}
        >
          <Textarea
            id={id}
            rows={4}
            maxLength={max}
            value={text}
            onChange={(event) => onChange(event.target.value)}
            className="resize-y"
          />
          {max === undefined ? null : (
            <CharacterCounter length={text.length} max={max} />
          )}
        </FieldShell>
      );

    case "link": {
      const error = linkError(text);
      return (
        <FieldShell
          htmlFor={id}
          label={descriptor.label}
          helper={strings.editor.linkHelper}
          error={error}
        >
          <div className="flex items-stretch">
            <span
              aria-hidden="true"
              className="inline-flex min-h-11 items-center rounded-l-lg border border-r-0 border-input bg-muted px-2.5 text-muted-foreground"
            >
              <LinkIcon className="size-4" />
            </span>
            <Input
              id={id}
              type="text"
              inputMode="url"
              maxLength={max}
              aria-invalid={error !== null}
              value={text}
              onChange={(event) => onChange(event.target.value)}
              className="min-h-11 rounded-l-none"
            />
          </div>
        </FieldShell>
      );
    }

    case "image":
      return (
        <ImageField
          descriptor={descriptor}
          value={typeof value === "string" ? value : null}
          imageBaseUrl={imageBaseUrl}
          onChange={onChange}
        />
      );

    case "color":
      return (
        <ColorField descriptor={descriptor} value={text} onChange={onChange} />
      );

    case "select": {
      /*
       * Options and their copy come from the descriptor, never from a literal
       * here. The registry reads them out of `strings.editor`, so the merchant
       * sees the same words the copy catalogue holds.
       */
      const options = descriptor.options ?? [];
      const selected = options.find((option) => option.value === value);
      return (
        <FieldShell
          htmlFor={id}
          label={descriptor.label}
          helper={descriptor.helper}
        >
          <Select
            items={options.map((option) => ({
              label: option.label,
              value: String(option.value),
            }))}
            value={selected === undefined ? null : String(selected.value)}
            onValueChange={(next) => {
              const picked = options.find(
                (option) => String(option.value) === next,
              );
              if (picked === undefined) return;
              onChange(picked.value);
            }}
          >
            <SelectTrigger id={id} className="min-h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={String(option.value)} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldShell>
      );
    }
  }
}
