"use client";

import { LoaderCircle, Star, TriangleAlert, Upload, X } from "lucide-react";
import {
  useEffect,
  useId,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";

import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { strings } from "@/lib/strings";
import { requestProductImageUpload } from "@/server/images/actions";

/**
 * A2 Card 2 — the D-10 product gallery (CAT-02, D-07, D-10).
 *
 * ---------------------------------------------------------------------------
 * THE BYTES NEVER TOUCH A SERVER ACTION. THREE STEPS, AND THE MIDDLE ONE IS AIR.
 * ---------------------------------------------------------------------------
 *   1. `requestProductImageUpload` mints a five-minute presigned PUT for one
 *      key, one content type and one byte count.
 *   2. The BROWSER puts the file straight at that URL. Next 16 caps Server
 *      Action bodies at 1 MB, which a phone photo routinely exceeds, and
 *      raising `serverActions.bodySizeLimit` would only route megabytes through
 *      metered compute to reach the same bucket. The `Content-Type` header must
 *      be byte-for-byte the value that was signed — R2 answers
 *      403 SignatureDoesNotMatch on anything else.
 *   3. A `POST` to the finalize route named in `FINALIZE_ENDPOINT` below reads
 *      the stored bytes back, derives the WebP renditions and reports what was
 *      written.
 *
 * ---------------------------------------------------------------------------
 * THIS COMPONENT PERSISTS NOTHING. THE FORM SUBMISSION DOES (D-07).
 * ---------------------------------------------------------------------------
 * The finalize route deliberately writes no `ProductImage` row: a product photo
 * is uploaded on `/dashboard/products/new` BEFORE a `Product` exists, so there
 * is no row to attach it to at that moment. Only `ready` entries are handed up
 * to the form, which submits them as `createProduct`/`updateProduct`'s `images`
 * array — the one caller that knows the owning product id.
 *
 * ---------------------------------------------------------------------------
 * NO FILENAME, NO KEY AND NO PATH EVER LEAVES THIS FILE (T-03-55).
 * ---------------------------------------------------------------------------
 * The two requests carry `{ contentType, byteSize }` and `{ uploadId, kind }`
 * and nothing else. The storage key is composed server-side from the session's
 * tenant and a server-minted uuid. The name a file carries on the merchant's
 * phone is the one input a browser fully controls, and every path-traversal bug
 * in the history of file uploads is the same sentence — "we appended the name
 * the user gave us". It is discarded here, not sanitised, and it is never read
 * anywhere in this file.
 *
 * ---------------------------------------------------------------------------
 * ONLY DERIVATIVES ARE EVER ADDRESSED (T-03-58).
 * ---------------------------------------------------------------------------
 * A stored key is a PREFIX, and the only URL this component builds appends
 * `/card.webp` to it. The unprocessed uploaded bytes are never addressed:
 * serving them would hand an attacker a way to publish arbitrary uploaded bytes
 * from the platform's own hostname, which is the exact outcome the server-side
 * re-encode exists to prevent.
 *
 * `imageBaseUrl` is passed down from the route rather than read here, because
 * `src/server/images/r2.ts` carries `server-only` — importing `publicUrlFor`
 * into a client island is a build failure, and `R2_PUBLIC_BASE_URL` is not a
 * `NEXT_PUBLIC_` variable. The route reads it once and hands over a string.
 *
 * ---------------------------------------------------------------------------
 * A STAR, NOT A DRAG.
 * ---------------------------------------------------------------------------
 * Choosing the customer-facing photo is an explicit `Make main photo` action at
 * a 44px target. 03-UI-SPEC.md § Traceability settled that discretion item
 * against drag-and-drop: a drag on a low-end Android touch screen — the device
 * this product is built for — is a gesture that fails silently and often, and
 * there is no undo for a reorder the merchant did not mean to make.
 */

// ---------------------------------------------------------------------------
// The contract with the two routes it is wired between
// ---------------------------------------------------------------------------

/** One stored, derived image, exactly as the form submits it. */
export interface GalleryImage {
  readonly storageKey: string;
  readonly width: number;
  readonly height: number;
}

/** D-10's ceiling. Five photos is a product page, not a gallery app. */
const MAX_IMAGES = 5;

/** The finalize endpoint. `kind` is what scopes it to this surface. */
const FINALIZE_ENDPOINT = "/api/upload/finalize";
const FINALIZE_KIND = "products";

/**
 * The derivative rendered in a tile — the mid-size square from the `product`
 * preset in `src/server/images/pipeline.ts`.
 */
const TILE_DERIVATIVE = "card.webp";

/**
 * A courtesy mirror of `ALLOWED_UPLOAD_CONTENT_TYPES`, never a replacement.
 *
 * The list in `src/server/images/r2.ts` is the authority and is checked before
 * anything is signed; that module is `server-only`, so it cannot be imported
 * here. This copy saves a round trip on a file the server was always going to
 * refuse and drives the picker's `accept` filter. If the two ever drift the
 * server wins, which is the correct direction for them to drift in.
 */
const ACCEPTED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"];

// ---------------------------------------------------------------------------
// Entry state
// ---------------------------------------------------------------------------

type GalleryStatus = "uploading" | "ready" | "failed";

interface GalleryEntry {
  /** Stable across reorders, so a moved tile is moved and not remounted. */
  readonly id: string;
  readonly status: GalleryStatus;
  /** The local preview while uploading, the derivative once stored. */
  readonly previewUrl: string;
  /** Retained so a failed upload can be retried without a second file pick. */
  readonly file: File | null;
  readonly storageKey: string | null;
  readonly width: number;
  readonly height: number;
}

/** What the finalize route reports back, narrowed from an unknown body. */
function readFinalizeResult(
  body: unknown,
): { storageKey: string; width: number; height: number } | null {
  if (typeof body !== "object" || body === null) return null;
  const record = body as Record<string, unknown>;
  if (
    typeof record.storageKey !== "string" ||
    typeof record.width !== "number" ||
    typeof record.height !== "number"
  ) {
    return null;
  }
  return {
    storageKey: record.storageKey,
    width: record.width,
    height: record.height,
  };
}

// ---------------------------------------------------------------------------
// Tiles
// ---------------------------------------------------------------------------

/**
 * One tile's picture.
 *
 * A plain `img`, not `next/image`: R2's public hostname is only known at
 * runtime, and wiring it into `next.config.ts`'s `images.remotePatterns` is a
 * build-configuration change outside this plan's file list. The sibling A1 list
 * page renders its thumbnails the same way for the same reason, and
 * `deferred-items.md` records the follow-up.
 */
function TileImage({
  src,
  alt,
  dimmed,
}: {
  readonly src: string;
  readonly alt: string;
  readonly dimmed: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- see the note above.
    <img
      src={src}
      alt={alt}
      className={
        dimmed
          ? "size-full object-cover opacity-40"
          : "size-full object-cover"
      }
    />
  );
}

/** A 44px icon control. Always visible on touch, revealed on hover at pointer sizes. */
function TileAction({
  label,
  className,
  onClick,
  children,
}: {
  readonly label: string;
  readonly className: string;
  readonly onClick: () => void;
  readonly children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex size-11 items-center justify-center rounded-lg bg-background/85 text-foreground transition-opacity hover:bg-background focus-visible:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none md:opacity-0 md:group-hover:opacity-100 ${className}`}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// The field
// ---------------------------------------------------------------------------

export function ImageGalleryField({
  imageBaseUrl,
  productName,
  initialImages,
  onImagesChange,
}: {
  readonly imageBaseUrl: string;
  readonly productName: string;
  readonly initialImages: readonly GalleryImage[];
  readonly onImagesChange: (images: GalleryImage[]) => void;
}) {
  const inputId = useId();

  const [entries, setEntries] = useState<GalleryEntry[]>(() =>
    initialImages.map((image) => ({
      id: crypto.randomUUID(),
      status: "ready" as const,
      previewUrl: `${imageBaseUrl}/${image.storageKey}/${TILE_DERIVATIVE}`,
      file: null,
      storageKey: image.storageKey,
      width: image.width,
      height: image.height,
    })),
  );

  /*
   * Only `ready` entries reach the form. An upload still in flight, or one that
   * failed, is not a photo the product has — submitting its key would write a
   * row pointing at bytes that were never derived.
   */
  useEffect(() => {
    onImagesChange(
      entries.flatMap((entry) =>
        entry.status === "ready" && entry.storageKey !== null
          ? [
              {
                storageKey: entry.storageKey,
                width: entry.width,
                height: entry.height,
              },
            ]
          : [],
      ),
    );
  }, [entries, onImagesChange]);

  function patch(id: string, change: Partial<GalleryEntry>) {
    setEntries((previous) =>
      previous.map((entry) =>
        entry.id === id ? { ...entry, ...change } : entry,
      ),
    );
  }

  async function runUpload(id: string, file: File) {
    patch(id, { status: "uploading" });

    if (!ACCEPTED_CONTENT_TYPES.includes(file.type)) {
      patch(id, { status: "failed" });
      return;
    }

    const grant = await requestProductImageUpload({
      contentType: file.type,
      byteSize: file.size,
    });
    if (!grant.ok) {
      patch(id, { status: "failed" });
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
      patch(id, { status: "failed" });
      return;
    }

    const finalized = await fetch(FINALIZE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uploadId: grant.uploadId, kind: FINALIZE_KIND }),
    });
    if (!finalized.ok) {
      patch(id, { status: "failed" });
      return;
    }

    const result = readFinalizeResult(await finalized.json());
    if (result === null) {
      patch(id, { status: "failed" });
      return;
    }

    patch(id, {
      status: "ready",
      previewUrl: `${imageBaseUrl}/${result.storageKey}/${TILE_DERIVATIVE}`,
      storageKey: result.storageKey,
      width: result.width,
      height: result.height,
    });
  }

  function handleSelection(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    // The picker is cleared so choosing the same photo twice in a row still
    // fires a change event.
    event.target.value = "";

    const room = MAX_IMAGES - entries.length;
    const accepted = picked.slice(0, Math.max(room, 0));
    if (accepted.length === 0) return;

    const added = accepted.map((file) => ({
      id: crypto.randomUUID(),
      status: "uploading" as const,
      previewUrl: URL.createObjectURL(file),
      file,
      storageKey: null,
      width: 0,
      height: 0,
    }));

    setEntries((previous) => [...previous, ...added]);
    for (const entry of added) {
      void runUpload(entry.id, entry.file);
    }
  }

  /** D-10's primary picker: move to index 0 and let the rest close up. */
  function makePrimary(id: string) {
    setEntries((previous) => {
      const chosen = previous.find((entry) => entry.id === id);
      if (chosen === undefined) return previous;
      return [chosen, ...previous.filter((entry) => entry.id !== id)];
    });
  }

  /*
   * No confirmation. An upload the merchant has not saved yet is not a
   * deletion, and D-08's no-hard-delete rule is about stored catalog rows — a
   * photo dropped before submit was never one.
   */
  function remove(id: string) {
    const dropped = entries.find((entry) => entry.id === id);
    // A local preview holds a blob alive until it is revoked. A stored
    // derivative is a plain URL and has nothing to release.
    if (dropped !== undefined && dropped.file !== null) {
      URL.revokeObjectURL(dropped.previewUrl);
    }
    setEntries((previous) => previous.filter((entry) => entry.id !== id));
  }

  function retry(id: string) {
    const entry = entries.find((candidate) => candidate.id === id);
    if (entry === undefined || entry.file === null) return;
    void runUpload(id, entry.file);
  }

  const full = entries.length >= MAX_IMAGES;
  const counter = strings.products.imagesCounter.replace(
    "{n}",
    String(entries.length),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={inputId}>{strings.products.imagesAddCta}</Label>
        <span
          role="status"
          aria-live="polite"
          className="text-base leading-normal tabular-nums text-muted-foreground"
        >
          {counter}
        </span>
      </div>

      <input
        id={inputId}
        type="file"
        multiple
        accept={ACCEPTED_CONTENT_TYPES.join(",")}
        disabled={full}
        onChange={handleSelection}
        className="sr-only"
      />

      <label
        htmlFor={inputId}
        className={
          full
            ? "flex min-h-11 cursor-not-allowed flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border p-6 text-center opacity-60"
            : "flex min-h-11 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border p-6 text-center hover:bg-muted has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50"
        }
      >
        <Upload aria-hidden="true" className="size-5 text-muted-foreground" />
        <span className="text-sm leading-normal font-semibold text-foreground">
          {strings.products.imagesAddCta}
        </span>
        <span className="text-base leading-normal text-muted-foreground">
          {full ? strings.products.imagesFull : strings.products.imagesHelper}
        </span>
      </label>

      {entries.length === 0 ? null : (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {entries.map((entry, index) => (
            <li
              key={entry.id}
              className={
                index === 0
                  ? "group relative aspect-square overflow-hidden rounded-lg bg-muted ring-2 ring-primary"
                  : entry.status === "failed"
                    ? "group relative aspect-square overflow-hidden rounded-lg bg-muted ring-2 ring-destructive"
                    : "group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
              }
            >
              {entry.status === "failed" ? (
                <button
                  type="button"
                  onClick={() => retry(entry.id)}
                  className="flex size-full min-h-11 flex-col items-center justify-center gap-1 p-2 text-center"
                >
                  <TriangleAlert
                    aria-hidden="true"
                    className="size-5 text-destructive"
                  />
                  <span
                    role="status"
                    aria-live="polite"
                    className="text-base leading-normal text-destructive"
                  >
                    {strings.products.imageUploadFailed}
                  </span>
                </button>
              ) : (
                <TileImage
                  src={entry.previewUrl}
                  alt={productName}
                  dimmed={entry.status === "uploading"}
                />
              )}

              {entry.status === "uploading" ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <LoaderCircle className="size-6 animate-spin text-foreground" />
                </span>
              ) : null}

              {index === 0 && entry.status === "ready" ? (
                <Badge
                  variant="outline"
                  className="absolute top-1.5 left-1.5 bg-background/85"
                >
                  {strings.products.imagePrimaryBadge}
                </Badge>
              ) : null}

              {index !== 0 && entry.status === "ready" ? (
                <TileAction
                  label={strings.products.imageMakePrimary}
                  className="absolute bottom-1 left-1"
                  onClick={() => makePrimary(entry.id)}
                >
                  <Star aria-hidden="true" className="size-4" />
                </TileAction>
              ) : null}

              <TileAction
                label={strings.products.imageRemove}
                className="absolute top-1 right-1"
                onClick={() => remove(entry.id)}
              >
                <X aria-hidden="true" className="size-4" />
              </TileAction>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
