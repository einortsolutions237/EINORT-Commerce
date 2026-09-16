import Image from "next/image";
import { FileText, LoaderCircle, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { strings } from "@/lib/strings";
import type { SupportAttachmentRow } from "@/server/support/shared";

/**
 * The multi-thumb attachment grid — 06-UI-SPEC.md § S / § Interaction & State
 * Contract, plan 06-11.
 *
 * ---------------------------------------------------------------------------
 * TWO MODES, ONE COMPONENT. THE LIGHTBOX IS SHARED, THE GRID IS NEW.
 * ---------------------------------------------------------------------------
 * `sent` renders up to four PERSISTED attachments inside a `MessageBubble`,
 * `staged` renders pre-send thumbs inside the composer with a remove control
 * and an upload-progress state. 06-PATTERNS.md § No Analog Found records that
 * a multi-thumb grid with staged-upload state has no precedent in this
 * codebase — `claim-card.tsx`'s `Screenshot` is ONE thumb with ONE lightbox,
 * so that lightbox `dialog` shape is reused verbatim here (the same
 * `max-h-[90vh]`, `object-contain`, plain-text-close dialog), while the grid
 * itself — the 2/4-column layout, the cap, the staged variant — is authored
 * fresh rather than forced into that single-image component's shape.
 *
 * ---------------------------------------------------------------------------
 * THIS COMPONENT NEVER COMPOSES A URL.
 * ---------------------------------------------------------------------------
 * The URL-composing helper in `src/server/images/r2.ts` is `server-only`, and
 * this component is reachable from a client tree (`composer.tsx` renders it for
 * the staged variant, and imports `message-bubble.tsx`, which is reachable
 * from the very same client tree — a static import graph, not a runtime
 * branch). Importing anything from `src/server/images/**` here would drag a
 * `server-only` module into that client bundle and fail the build. So a
 * `sent`-mode attachment arrives with its URL ALREADY resolved by the server
 * component that rendered it — `MessageList` does that resolution, exactly
 * as `claim-card.tsx`'s `page.tsx` resolves `screenshotUrl` before handing it
 * to a client component. `storageKey` alone (the derivative PREFIX) is never
 * enough to render an `<img>`.
 *
 * A `staged`-mode attachment's `previewUrl` is a LOCAL `URL.createObjectURL`
 * blob, chosen by the merchant on their own device before any upload has
 * happened — not an R2 URL at all, so composing it here is not the thing the
 * paragraph above forbids.
 */

/**
 * A persisted attachment, plus the one field `SupportAttachmentRow` never
 * carries.
 *
 * D-22: for `kind: "IMAGE"` this is the already-resolved, publicly reachable
 * derivative URL — the merchant/admin server component resolves it before
 * this client component ever sees the row, per this file's own header. For
 * `kind: "DOCUMENT"` there is no such URL (a document is never served from
 * `R2_PUBLIC_BASE_URL` at all), so `url` is unused for that kind; the
 * `DOCUMENT` tile links to `downloadBasePath` + the attachment's own `id`
 * instead, composed by THIS component rather than resolved upstream, because
 * the download route is keyed by attachment id and not by a storage key a
 * server component would otherwise have to leak.
 */
export interface SentAttachment extends SupportAttachmentRow {
  readonly url: string;
}

/**
 * A not-yet-sent attachment, staged in the composer.
 *
 * `kind` (D-22) tells this component whether to render an image thumbnail
 * or a file tile before any server round-trip has happened — the composer
 * already knows the file's MIME type the instant it is picked, so this is
 * set at stage time, not inferred later. `byteSize` renders on a `DOCUMENT`
 * tile only; an `IMAGE` tile shows the thumbnail instead and has no use for
 * it.
 */
export interface StagedAttachment {
  /** Client-generated, for the React key and for `onRemove` — never sent to the server. */
  readonly id: string;
  readonly kind: "IMAGE" | "DOCUMENT";
  /** `URL.createObjectURL(file)` — revoked by the composer when the attachment leaves state. Rendered as an `<img>` src for `IMAGE` only. */
  readonly previewUrl: string;
  readonly byteSize: number;
  readonly status: "uploading" | "ready";
}

interface SentModeProps {
  readonly mode: "sent";
  readonly attachments: readonly SentAttachment[];
  /** Interpolated into `strings.support.attachments.attachmentAlt` — never an empty alt, never a filename. */
  readonly authorLabel: string;
  readonly time: string;
  /**
   * D-22 — the authorized download route's base path, chosen by the PAGE
   * rendering this component: `/api/support/attachment` on the merchant
   * surface, `/api/admin/support/attachment` on the admin surface. A prop,
   * not a branch on `viewer`: `viewer` exists for mirroring copy and layout,
   * and overloading it with a routing decision would put a
   * security-relevant choice inside a presentation component instead of the
   * page that already knows which surface it is.
   */
  readonly downloadBasePath: string;
}

interface StagedModeProps {
  readonly mode: "staged";
  readonly attachments: readonly StagedAttachment[];
  readonly onRemove: (id: string) => void;
}

export type AttachmentGridProps = SentModeProps | StagedModeProps;

/** 96px thumbs, 2 columns below `sm`, 4 at and above — one row at the cap of four. */
const GRID_CLASS = "grid grid-cols-2 gap-1 sm:grid-cols-4";
const THUMB_CLASS =
  "relative aspect-square size-24 overflow-hidden rounded-md border border-border";

function altFor(authorLabel: string, time: string): string {
  return strings.support.attachments.attachmentAlt
    .replace("{author}", authorLabel)
    .replace("{time}", time);
}

/**
 * D-22 — "1.2 MB" / "245 KB", for the document tile's label and its download
 * link's accessible name. Display-only: the byte cap itself is enforced by
 * the mint schema's `.max()`, signed into `content-length` (see
 * `thread-upload.ts`'s own header), and this function never feeds a decision,
 * only a rendered string.
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${Math.round(kilobytes)} KB`;
  const megabytes = kilobytes / 1024;
  return `${megabytes.toFixed(1)} MB`;
}

/** The shared file-tile body — a `file-text` icon plus the size label, never
 * an image thumb and never inside the lightbox `Dialog` (D-22: a PDF has no
 * raster preview and is never rendered inline). */
function DocumentTileBody({ byteSize }: { readonly byteSize: number }) {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-1 bg-muted p-2 text-center">
      <FileText aria-hidden="true" className="size-6 text-muted-foreground" />
      <span className="text-xs leading-tight font-normal text-muted-foreground">
        {formatFileSize(byteSize)}
      </span>
    </div>
  );
}

export function AttachmentGrid(props: AttachmentGridProps) {
  if (props.mode === "sent") {
    if (props.attachments.length === 0) return null;

    const alt = altFor(props.authorLabel, props.time);

    return (
      <div className={`mt-2 ${GRID_CLASS}`}>
        {props.attachments.map((attachment) => {
          if (attachment.kind === "DOCUMENT") {
            const sizeLabel = formatFileSize(attachment.byteSize);
            return (
              <a
                key={attachment.id}
                href={`${props.downloadBasePath}/${attachment.id}`}
                aria-label={strings.support.attachments.downloadLabel.replace(
                  "{size}",
                  sizeLabel,
                )}
                title={strings.support.attachments.documentLabel}
                className={`${THUMB_CLASS} block outline-none focus-visible:ring-3 focus-visible:ring-ring/50`}
              >
                <DocumentTileBody byteSize={attachment.byteSize} />
              </a>
            );
          }

          return (
            <Dialog key={attachment.id}>
              <DialogTrigger
                render={
                  <button
                    type="button"
                    aria-label={strings.support.attachments.openLabel}
                    className={`${THUMB_CLASS} outline-none focus-visible:ring-3 focus-visible:ring-ring/50`}
                  />
                }
              >
                <Image
                  src={attachment.url}
                  alt={alt}
                  width={96}
                  height={96}
                  className="aspect-square size-full object-cover"
                />
              </DialogTrigger>
              <DialogContent className="sm:max-w-3xl">
                <DialogTitle className="sr-only">{alt}</DialogTitle>
                <Image
                  src={attachment.url}
                  alt={alt}
                  width={1200}
                  height={1200}
                  className="h-auto max-h-[90vh] w-full object-contain"
                />
              </DialogContent>
            </Dialog>
          );
        })}
      </div>
    );
  }

  if (props.attachments.length === 0) return null;

  return (
    <div className={GRID_CLASS}>
      {props.attachments.map((attachment) => (
        <div key={attachment.id} className={THUMB_CLASS}>
          {attachment.kind === "DOCUMENT" ? (
            <DocumentTileBody byteSize={attachment.byteSize} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- a local blob URL; next/image cannot optimise one.
            <img
              src={attachment.previewUrl}
              alt={strings.support.attachments.stagedAlt}
              className="size-full object-cover"
            />
          )}

          {attachment.status === "uploading" ? (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70">
              <LoaderCircle
                aria-hidden="true"
                role="img"
                aria-label={strings.support.attachments.uploading}
                className="size-5 animate-spin"
              />
            </div>
          ) : null}

          <button
            type="button"
            aria-label={strings.support.attachments.removeLabel}
            onClick={() => props.onRemove(attachment.id)}
            className="absolute top-1 right-1 flex min-h-11 min-w-11 items-center justify-center rounded-full bg-background/90 text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
