"use client";

import { useId, useOptimistic, useRef, useState, useTransition } from "react";
import { LoaderCircle, Paperclip, Send, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePlatformIsMac } from "@/hooks/use-platform-is-mac";
import { strings } from "@/lib/strings";
import { sendPlatformMessage } from "@/server/admin/support-actions";
import {
  requestAdminThreadAttachmentUpload,
  requestAdminThreadDocumentUpload,
  requestThreadAttachmentUpload,
  requestThreadDocumentUpload,
} from "@/server/images/thread-upload";
import { sendSupportMessage } from "@/server/support/actions";
import type { SupportMessageRow } from "@/server/support/shared";

import { AttachmentGrid, type StagedAttachment } from "./attachment-grid";
import { MessageBubble, type SupportViewer } from "./message-bubble";

/**
 * The sticky composer, with an optimistic send — 06-UI-SPEC.md § A2 / § S.
 *
 * ---------------------------------------------------------------------------
 * `useOptimistic` HAS NO PRECEDENT IN THIS REPOSITORY. READ THIS BEFORE
 * TOUCHING IT.
 * ---------------------------------------------------------------------------
 * Every other async write in this codebase (`claim-card.tsx`,
 * `reject-dialog.tsx`) is a plain `useState` + `await` + re-render — this is
 * the first place `useOptimistic` is used, because this is the first UI
 * whose whole point is to show something BEFORE the server has answered.
 *
 * The mechanism, and why it is honest rather than a lie the merchant later
 * discovers: `addPendingRow` is called synchronously at the top of a
 * `startTransition`, before the `await`. For as long as that transition is
 * in flight, `pendingRows` holds the draft and this component renders it —
 * via the SAME `MessageBubble` the confirmed thread uses, with `pending`
 * set, so it visibly renders DIFFERENTLY (`opacity-70`, a spinner where the
 * time would be, no timestamp — nothing here claims the server has seen it
 * yet). The instant the transition settles — success OR failure — React
 * reverts `pendingRows` back to its base value (a stable empty array), so
 * the pending bubble disappears on its own. Nothing has to remove it by
 * hand, and there is no path where it lingers after the transition ends.
 *
 * On success the real message is on the server; `router.refresh()` re-runs
 * `/dashboard/support`'s own server load, so the confirmed row appears in
 * `MessageList` in the server's own words, with the server's own id and
 * timestamp — never a client-guessed one kept around.
 *
 * On failure the pending bubble is gone (same mechanism) and `body` is NOT
 * cleared, so the merchant's typed text survives in the textarea exactly as
 * they left it (T-06-37) — a blocking `destructive` `Alert` says so above
 * the composer, never a toast alone.
 *
 * ---------------------------------------------------------------------------
 * PLAIN `Enter` INSERTS A NEWLINE. ONLY `Cmd/Ctrl+Enter` SENDS.
 * ---------------------------------------------------------------------------
 * This market is mobile-first, and an accidental send from a stray Enter is
 * worse than the extra tap Cmd/Ctrl+Enter costs a desktop user. The
 * textarea's native Enter behaviour (a newline) is therefore left alone —
 * this component adds a handler ONLY for the modified combination.
 *
 * ---------------------------------------------------------------------------
 * THE ATTACH AFFORDANCE (plan 06-11).
 * ---------------------------------------------------------------------------
 * The paperclip button drives the existing presign -> PUT -> finalize triad
 * directly against `src/server/images/thread-upload.ts` and
 * `/api/upload/thread-finalize` — the same three-step sequence
 * `claim-form.tsx` already uses for a payment screenshot, adapted to stage up
 * to four images before Send rather than exactly one before Submit. A failed
 * upload REMOVES the staged thumb and surfaces
 * `strings.support.attachments.uploadError` inline; the typed body is
 * untouched either way, matching T-06-37's "never lose what the merchant
 * typed" rule this file already applies to a failed send.
 *
 * `ACCEPTED_CONTENT_TYPES` and `MAX_THREAD_UPLOAD_BYTES` below MIRROR
 * `src/server/images/r2.ts`'s `ALLOWED_UPLOAD_CONTENT_TYPES` and
 * `thread-upload.ts`'s own private byte cap, exactly as `claim-form.tsx`
 * mirrors the same allowlist for the same reason: both source modules are
 * server-only (or, for the byte cap, simply unexported — see
 * `thread-upload.ts`'s header on why a `"use server"` file cannot export a
 * plain constant) and cannot be imported from a client component. This is
 * the picker's courtesy check; the binding limit is the mint schema's own
 * `.max()`, which signs the real ceiling into `content-length` so R2 enforces
 * it regardless of what this file believes.
 *
 * ---------------------------------------------------------------------------
 * `viewer`/`tenantId` (plan 06-12) — THE SAME MIRROR `message-bubble.tsx` AND
 * `message-list.tsx` ALREADY USE, COMPLETED HERE RATHER THAN FORKED.
 * ---------------------------------------------------------------------------
 * Plan 06-09 shipped this component with zero props, calling the merchant's
 * own `sendSupportMessage`/`requestThreadAttachmentUpload` unconditionally —
 * correct for `/dashboard/support`, the only caller that existed then, but
 * it left this the one file in `src/components/support/` NOT actually
 * mirrored by the `viewer` prop 06-UI-SPEC.md § S promises for "one
 * component, two surfaces". `/admin/support/[tenantId]` (plan 06-12) needs
 * the platform owner's doors instead, at all THREE steps this component
 * drives — mint (`requestAdminThreadAttachmentUpload`), finalize
 * (`/api/upload/admin-thread-finalize`, its own sibling Route Handler
 * mirroring `thread-finalize/route.ts`), and send (`sendPlatformMessage`) —
 * every one of which additionally requires the target `tenantId` in its
 * payload, because the admin identity function resolves WHO is calling and
 * never WHICH store they mean (see `src/server/admin/context.ts`'s header).
 * Forking a second composer file was rejected outright — § S is explicit
 * that a fork here is the exact regression the mirror exists to prevent.
 * `viewer` defaults to `"MERCHANT"` so `/dashboard/support`'s existing
 * zero-prop `<Composer/>` keeps compiling and behaving identically; only the
 * admin page opts into the other three doors, by passing both
 * `viewer="PLATFORM"` and its own `tenantId`.
 *
 * ---------------------------------------------------------------------------
 * D-22 — PDF RECEIPTS, A SECOND MINT/FINALIZE PAIR CHOSEN BY THE PICKED
 * FILE'S TYPE.
 * ---------------------------------------------------------------------------
 * 06-UI-SPEC.md § S's attachment-types row and Assumption A2 restricted this
 * `accept` attribute to three raster formats and said "No PDF — see the Open
 * Items". D-22 (06-CONTEXT.md) is the locked decision that supersedes that
 * assumption: a merchant whose Mobile Money app exports a PDF receipt can
 * attach it, on the genuinely separate, non-re-encoding path plan 06-13
 * builds (`ALLOWED_DOCUMENT_CONTENT_TYPES`, `requestThreadDocumentUpload`,
 * `/api/upload/thread-document-finalize`, and their admin-door siblings).
 * A2 was a narrowing pending confirmation, not a permanent rule; D-22 is the
 * confirmation, and this widened `accept` attribute plus the branch in
 * `stageFile` below are where the resolution actually lands in code.
 *
 * The branch belongs HERE, at the point `file.type` is first known, rather
 * than inside one function that "handles both": the two finalize endpoints
 * return different shapes (an `IMAGE` descriptor carries `width`/`height`, a
 * `DOCUMENT` one does not), so hiding which contract is in force behind a
 * single helper would be exactly the kind of merge `thread-upload.ts`'s own
 * header rejects for the mint step, applied here to the picker step.
 */

const TEXTAREA_ROWS = 3;

/** § S's attachment cap, restated as the composer's own convenience check — the schema's `max(4)` is the boundary. */
const ATTACHMENT_CAP = 4;

/**
 * See this file's header. Mirrors `ALLOWED_UPLOAD_CONTENT_TYPES` in
 * `src/server/images/r2.ts`, which is `server-only` and cannot be imported
 * here. This list is the picker filter and a courtesy check; the binding one
 * is the mint, which pins the content type into the signature so a lie here
 * produces a 403 rather than an object of the wrong kind.
 */
const ACCEPTED_IMAGE_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * D-22. Mirrors `ALLOWED_DOCUMENT_CONTENT_TYPES` in `src/server/images/r2.ts`
 * — a second, separate list, never merged into the one above, for the same
 * reason the server-side allowlist stays separate: the two are different
 * storage contracts, not two entries in one list.
 */
const ACCEPTED_DOCUMENT_CONTENT_TYPES = ["application/pdf"];

/** The `accept` attribute needs both lists joined, not re-typed. */
const ACCEPTED_CONTENT_TYPES_ATTR = [
  ...ACCEPTED_IMAGE_CONTENT_TYPES,
  ...ACCEPTED_DOCUMENT_CONTENT_TYPES,
].join(",");

/**
 * See this file's header. Mirrors `thread-upload.ts`'s private
 * `MAX_THREAD_UPLOAD_BYTES`, which cannot leave that `"use server"` module —
 * shared by both the image and document mint schemas, so one copy here
 * covers both.
 * The composer interpolates this into `strings.support.attachments.sizeError`
 * rather than hardcoding "10 MB", so the two numbers cannot read differently.
 */
const MAX_THREAD_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_THREAD_UPLOAD_LABEL = `${Math.round(MAX_THREAD_UPLOAD_BYTES / (1024 * 1024))} MB`;

const FINALIZE_ENDPOINT = "/api/upload/thread-finalize";
/** The admin door's own finalize route (plan 06-12) — see `composer.tsx`'s
 * `viewer`/`tenantId` header block and that route's own header for why a
 * second endpoint exists rather than one branching on caller type. */
const ADMIN_FINALIZE_ENDPOINT = "/api/upload/admin-thread-finalize";

/** D-22's document finalize doors — `thread-document-finalize/route.ts`'s
 * own header explains why these are separate files from the two above. */
const DOCUMENT_FINALIZE_ENDPOINT = "/api/upload/thread-document-finalize";
const ADMIN_DOCUMENT_FINALIZE_ENDPOINT =
  "/api/upload/admin-thread-document-finalize";

/**
 * One finalized attachment, either kind, exactly as the matching finalize
 * route returns it (D-22). A discriminated union, mirroring
 * `ThreadAttachmentInput` (`src/server/support/messages.ts`): an `IMAGE`
 * descriptor always carries `width`/`height`, a `DOCUMENT` one carries
 * neither — a PDF has no raster dimensions.
 */
type ThreadAttachmentDescriptor =
  | {
      readonly kind: "IMAGE";
      readonly storageKey: string;
      readonly contentType: string;
      readonly byteSize: number;
      readonly width: number;
      readonly height: number;
    }
  | {
      readonly kind: "DOCUMENT";
      readonly storageKey: string;
      readonly contentType: string;
      readonly byteSize: number;
    };

/** A staged attachment plus the descriptor it resolves to once uploaded — `null` while `status` is `"uploading"`. */
interface StagedItem extends StagedAttachment {
  readonly descriptor: ThreadAttachmentDescriptor | null;
}

/**
 * The one field of the finalize response this composer uses, narrowed by
 * hand. `kind` selects which shape to expect: an `IMAGE` response without
 * numeric `width`/`height`, or a `DOCUMENT` response with neither, is
 * refused exactly like any other malformed body.
 */
function readDescriptor(
  kind: "IMAGE" | "DOCUMENT",
  body: unknown,
): ThreadAttachmentDescriptor | null {
  if (typeof body !== "object" || body === null) return null;
  const { storageKey, contentType, byteSize, width, height } = body as Record<
    string,
    unknown
  >;
  if (
    typeof storageKey !== "string" ||
    storageKey.length === 0 ||
    typeof contentType !== "string" ||
    typeof byteSize !== "number"
  ) {
    return null;
  }
  if (kind === "IMAGE") {
    if (typeof width !== "number" || typeof height !== "number") return null;
    return { kind: "IMAGE", storageKey, contentType, byteSize, width, height };
  }
  return { kind: "DOCUMENT", storageKey, contentType, byteSize };
}

/** `useOptimistic`'s base value never changes, so a stable reference avoids a needless reset on every render. */
const NO_PENDING_ROWS: readonly SupportMessageRow[] = [];

/**
 * A draft, shaped as a `SupportMessageRow` so it can render through the same
 * `MessageBubble` the confirmed thread uses. The id is never sent anywhere —
 * it exists only as a React key for the transition's lifetime — and
 * `createdAt` is never read: `pending` suppresses the time line entirely.
 * `author` is the composing `viewer` itself, never hardcoded — a draft is
 * always this side's own message, so `MessageBubble`'s `isOwn` check
 * (`row.author === viewer`) is true on both surfaces.
 */
function draftRow(body: string, author: SupportViewer): SupportMessageRow {
  return {
    id: `optimistic-${Date.now()}`,
    author,
    authorUserId: null,
    body,
    createdAt: new Date(),
    subscriptionClaimId: null,
    attachments: [],
  };
}

export interface ComposerProps {
  /** Mirrors `MessageBubble`/`MessageList`'s own prop. Defaults to
   * `"MERCHANT"` so `/dashboard/support`'s existing zero-prop usage is
   * unaffected. */
  readonly viewer?: SupportViewer;
  /** The admin door's target tenant. Required, and used, only when `viewer`
   * is `"PLATFORM"` — the merchant door resolves its own tenant from the
   * session and never takes one. */
  readonly tenantId?: string;
}

export function Composer({ viewer = "MERCHANT", tenantId }: ComposerProps) {
  const router = useRouter();
  const textareaId = useId();
  const isMac = usePlatformIsMac();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [staged, setStaged] = useState<readonly StagedItem[]>([]);
  const [isSending, startTransition] = useTransition();
  const [pendingRows, addPendingRow] = useOptimistic(
    NO_PENDING_ROWS,
    (state, draft: SupportMessageRow) => [...state, draft],
  );

  const trimmedBody = body.trim();
  const hasUploadingAttachment = staged.some(
    (item) => item.status === "uploading",
  );
  const readyDescriptors = staged
    .map((item) => item.descriptor)
    .filter((descriptor): descriptor is ThreadAttachmentDescriptor => descriptor !== null);
  const canSend =
    (trimmedBody.length > 0 || readyDescriptors.length > 0) &&
    !isSending &&
    !hasUploadingAttachment;
  const atAttachmentCap = staged.length >= ATTACHMENT_CAP;

  /**
   * Drives the mint -> direct PUT -> finalize sequence for one file, staging
   * it optimistically and holding the returned descriptor once finalize
   * answers. A failure at any step removes the staged thumb entirely — the
   * typed body is never touched.
   *
   * D-22: the file's own `type` selects which pair of doors this drives —
   * the image mint/finalize pair, or the document one. See this file's
   * header for why that choice is made here rather than inside a merged
   * helper.
   */
  async function stageFile(file: File) {
    if (atAttachmentCap) return;

    const isDocument = ACCEPTED_DOCUMENT_CONTENT_TYPES.includes(file.type);
    const isImage = ACCEPTED_IMAGE_CONTENT_TYPES.includes(file.type);
    if (!isDocument && !isImage) {
      setAttachmentError(strings.support.attachments.typeError);
      return;
    }
    const kind: "IMAGE" | "DOCUMENT" = isDocument ? "DOCUMENT" : "IMAGE";

    if (file.size > MAX_THREAD_UPLOAD_BYTES) {
      setAttachmentError(
        strings.support.attachments.sizeError.replace(
          "{max}",
          MAX_THREAD_UPLOAD_LABEL,
        ),
      );
      return;
    }

    setAttachmentError(null);

    const id = crypto.randomUUID();
    const previewUrl = URL.createObjectURL(file);
    setStaged((prev) => [
      ...prev,
      { id, kind, previewUrl, byteSize: file.size, status: "uploading", descriptor: null },
    ]);

    function dropStaged() {
      setStaged((prev) => {
        const target = prev.find((item) => item.id === id);
        if (target) URL.revokeObjectURL(target.previewUrl);
        return prev.filter((item) => item.id !== id);
      });
    }

    try {
      const isAdmin = viewer === "PLATFORM" && tenantId !== undefined;

      const grant = isDocument
        ? isAdmin
          ? await requestAdminThreadDocumentUpload({
              tenantId,
              contentType: file.type,
              byteSize: file.size,
            })
          : await requestThreadDocumentUpload({
              contentType: file.type,
              byteSize: file.size,
            })
        : isAdmin
          ? await requestAdminThreadAttachmentUpload({
              tenantId,
              kind: "threads",
              contentType: file.type,
              byteSize: file.size,
            })
          : await requestThreadAttachmentUpload({
              kind: "threads",
              contentType: file.type,
              byteSize: file.size,
            });
      if (!grant.ok) {
        dropStaged();
        setAttachmentError(strings.support.attachments.uploadError);
        return;
      }

      /*
       * Byte-for-byte the signed value. R2 compares this header against the
       * signature, so `image/JPEG` here is a 403 blamed on storage and caused
       * three lines above.
       */
      const stored = await fetch(grant.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!stored.ok) {
        dropStaged();
        setAttachmentError(strings.support.attachments.uploadError);
        return;
      }

      const finalizeEndpoint = isDocument
        ? isAdmin
          ? ADMIN_DOCUMENT_FINALIZE_ENDPOINT
          : DOCUMENT_FINALIZE_ENDPOINT
        : isAdmin
          ? ADMIN_FINALIZE_ENDPOINT
          : FINALIZE_ENDPOINT;
      const finalizeBody = isDocument
        ? isAdmin
          ? { uploadId: grant.uploadId, tenantId }
          : { uploadId: grant.uploadId }
        : isAdmin
          ? { uploadId: grant.uploadId, kind: "threads", tenantId }
          : { uploadId: grant.uploadId, kind: "threads" };

      const finalized = await fetch(finalizeEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalizeBody),
      });
      if (!finalized.ok) {
        dropStaged();
        setAttachmentError(strings.support.attachments.uploadError);
        return;
      }

      const descriptor = readDescriptor(kind, await finalized.json());
      if (descriptor === null) {
        dropStaged();
        setAttachmentError(strings.support.attachments.uploadError);
        return;
      }

      setStaged((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: "ready", descriptor } : item,
        ),
      );
    } catch {
      // A dropped connection mid-upload. Same outcome as every other failure.
      dropStaged();
      setAttachmentError(strings.support.attachments.uploadError);
    }
  }

  function removeStaged(id: string) {
    setStaged((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  }

  function send() {
    if (!canSend) return;

    const outgoingBody = trimmedBody;
    const outgoingAttachments = readyDescriptors;
    setError(null);

    startTransition(async () => {
      addPendingRow(draftRow(outgoingBody, viewer));

      const result =
        viewer === "PLATFORM" && tenantId !== undefined
          ? await sendPlatformMessage({
              tenantId,
              body: outgoingBody,
              attachments: outgoingAttachments,
            })
          : await sendSupportMessage({
              body: outgoingBody,
              attachments: outgoingAttachments,
            });

      if (!result.ok) {
        setError(result.error.form?.[0] ?? strings.support.composer.sendError);
        return;
      }

      setBody("");
      for (const item of staged) URL.revokeObjectURL(item.previewUrl);
      setStaged([]);
      router.refresh();
    });
  }

  return (
    <div className="sticky bottom-0 flex flex-col gap-3 border-t border-border bg-background px-4 py-4 sm:px-8">
      {pendingRows.map((row) => (
        <MessageBubble
          key={row.id}
          row={row}
          viewer={viewer}
          authorOtherLabel={strings.support.thread.authorOther}
          pending
        />
      ))}

      {error === null ? null : (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden="true" />
          <AlertDescription className="text-destructive">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {attachmentError === null ? null : (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden="true" />
          <AlertDescription className="text-destructive">
            {attachmentError}
          </AlertDescription>
        </Alert>
      )}

      {staged.length > 0 ? (
        <AttachmentGrid
          mode="staged"
          attachments={staged}
          onRemove={removeStaged}
        />
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={textareaId}>{strings.support.composer.label}</Label>
        <Textarea
          id={textareaId}
          value={body}
          rows={TEXTAREA_ROWS}
          className="max-h-64 overflow-y-auto"
          onChange={(event) => {
            setBody(event.target.value);
          }}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              send();
            }
          }}
        />
        <span className="text-sm leading-normal font-normal text-muted-foreground">
          {isMac
            ? strings.support.composer.keyboardHintMac
            : strings.support.composer.keyboardHintWindows}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_CONTENT_TYPES_ATTR}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              // Cleared so picking the same photo twice in a row still fires a change.
              event.target.value = "";
              if (file) void stageFile(file);
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11"
            disabled={atAttachmentCap || isSending}
            aria-label={strings.support.composer.attachLabel}
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip aria-hidden="true" />
          </Button>
          <span className="text-sm leading-normal font-normal text-muted-foreground">
            {atAttachmentCap
              ? strings.support.composer.attachmentCapNote
              : strings.support.attachments.typeHelper}
          </span>
        </div>

        <Button
          type="button"
          className="min-h-11"
          disabled={!canSend}
          onClick={send}
        >
          {isSending ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Send aria-hidden="true" />
          )}
          {isSending
            ? strings.support.composer.sending
            : strings.support.composer.send}
        </Button>
      </div>
    </div>
  );
}
