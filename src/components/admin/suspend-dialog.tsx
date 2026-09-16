"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { strings } from "@/lib/strings";
import { restoreStore, suspendStore } from "@/server/admin/suspend-actions";

/**
 * ADM-01 / D-14..D-17 — the ONE suspend/restore dialog, mounted TWICE (R-2):
 * once in `/admin`'s row `dropdown-menu`, once on `/admin/merchants/[id]`'s
 * Store status card. Both entry points open this same component and call
 * the same pair of Server Actions (`src/server/admin/suspend-actions.ts`).
 *
 * ---------------------------------------------------------------------------
 * ONE COMPONENT, TWO REGISTERS — NOT TWO COMPONENTS.
 * ---------------------------------------------------------------------------
 * D-17: symmetric by construction. `registerFor` below is the whole of what
 * differs between a suspension and a restoration — copy, bounds, whether the
 * field is required, and whether the confirm button reads as destructive —
 * resolved once per render into a plain data object. Every line of JSX after
 * it reads THAT object rather than branching on `mode` a second time, so
 * there is exactly one submit handler, one field, one footer and one place
 * the destructive treatment can be spent.
 *
 * ---------------------------------------------------------------------------
 * NOT OPTIMISTIC (§ Interaction & State Contract).
 * ---------------------------------------------------------------------------
 * Suspending takes a merchant's business offline and writes into their
 * support thread; restoring brings it back. Both are too consequential to
 * show before the server has answered, unlike a table sort or a filter
 * toggle. This dialog shows the submitting state and waits — `router.refresh()`
 * on success is what brings the new status chip and the "last changed" line
 * back from the server, never a locally-guessed value.
 *
 * ---------------------------------------------------------------------------
 * A BLOCKING FAILURE KEEPS THE TYPED TEXT, EXACTLY AS
 * `reject-dialog.tsx` DOES.
 * ---------------------------------------------------------------------------
 * A failed suspend/restore is rendered as an inline `destructive` `Alert`,
 * never a toast alone — the merchant's business is still online (or still
 * offline) and the owner's next action is to read why and try again, not to
 * retype a reason they already wrote.
 */

/** D-15/R-2: 10–280 characters, required — posted verbatim to the thread. */
const REASON_MIN_LENGTH = 10;
const REASON_MAX_LENGTH = 280;
/** R-2: optional, ≤280 — never interpolated into the restore message. */
const NOTE_MAX_LENGTH = 280;

export type SuspendDialogMode = "suspend" | "restore";

export interface SuspendDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly mode: SuspendDialogMode;
  readonly merchantId: string;
  readonly storeName: string;
}

interface DialogRegister {
  readonly title: string;
  readonly body: string;
  readonly fieldLabel: string;
  readonly fieldHelper: string;
  readonly counterTemplate: string;
  readonly maxLength: number;
  readonly minLength: number;
  readonly required: boolean;
  readonly confirmLabel: string;
  readonly confirmingLabel: string;
  readonly cancelLabel: string;
  readonly errorMessage: string;
  readonly successToast: string;
}

/** Everything that differs between the two directions — see the header. */
function registerFor(mode: SuspendDialogMode, storeName: string): DialogRegister {
  if (mode === "suspend") {
    const copy = strings.admin.suspend;
    return {
      title: copy.title.replace("{store}", storeName),
      body: copy.body,
      fieldLabel: copy.reasonLabel,
      fieldHelper: copy.reasonHelper,
      counterTemplate: copy.reasonCounter,
      maxLength: REASON_MAX_LENGTH,
      minLength: REASON_MIN_LENGTH,
      required: true,
      confirmLabel: copy.confirm,
      confirmingLabel: copy.confirming,
      cancelLabel: copy.cancel,
      errorMessage: copy.error,
      successToast: copy.toast.replace("{store}", storeName),
    };
  }

  const copy = strings.admin.restore;
  return {
    title: copy.title.replace("{store}", storeName),
    body: copy.body,
    fieldLabel: copy.noteLabel,
    fieldHelper: copy.noteHelper,
    counterTemplate: copy.noteCounter,
    maxLength: NOTE_MAX_LENGTH,
    minLength: 0,
    required: false,
    confirmLabel: copy.confirm,
    confirmingLabel: copy.confirming,
    cancelLabel: copy.cancel,
    errorMessage: copy.error,
    successToast: copy.toast.replace("{store}", storeName),
  };
}

export function SuspendDialog({
  open,
  onOpenChange,
  mode,
  merchantId,
  storeName,
}: SuspendDialogProps) {
  const router = useRouter();
  const fieldId = useId();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const register = registerFor(mode, storeName);
  const isSuspendMode = mode === "suspend";
  const canSubmit =
    !pending &&
    (register.required ? text.trim().length >= register.minLength : true);

  function closeAndReset(next: boolean) {
    if (!next) {
      setText("");
      setError(null);
    }
    onOpenChange(next);
  }

  async function handleSubmit() {
    setError(null);
    setPending(true);

    const result = isSuspendMode
      ? await suspendStore({ merchantId, reason: text })
      : await restoreStore({
          merchantId,
          note: text.trim().length > 0 ? text : undefined,
        });

    setPending(false);

    if (result.ok) {
      toast.success(register.successToast);
      router.refresh();
      closeAndReset(false);
      return;
    }

    setError(result.error.form?.[0] ?? register.errorMessage);
  }

  return (
    <Dialog open={open} onOpenChange={closeAndReset}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{register.title}</DialogTitle>
          <DialogDescription>{register.body}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={fieldId}
            className="text-sm leading-normal font-medium text-foreground"
          >
            {register.fieldLabel}
          </label>
          <Textarea
            id={fieldId}
            value={text}
            maxLength={register.maxLength}
            rows={3}
            className="min-h-11"
            onChange={(event) => {
              setText(event.target.value);
              setError(null);
            }}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm leading-normal font-normal text-muted-foreground">
              {register.fieldHelper}
            </span>
            <span
              aria-live="polite"
              className="text-sm leading-normal font-normal tabular-nums text-muted-foreground"
            >
              {register.counterTemplate
                .replace("{n}", String(text.length))
                .replace("{max}", String(register.maxLength))}
            </span>
          </div>
        </div>

        {error === null ? null : (
          <Alert variant="destructive">
            <TriangleAlert aria-hidden="true" />
            <AlertDescription className="text-destructive">
              {error}
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={pending}
            onClick={() => {
              closeAndReset(false);
            }}
          >
            {register.cancelLabel}
          </Button>

          {isSuspendMode ? (
            <Button
              type="button"
              variant="destructive"
              className="min-h-11"
              disabled={!canSubmit}
              onClick={() => {
                void handleSubmit();
              }}
            >
              {pending ? (
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              ) : null}
              {pending ? register.confirmingLabel : register.confirmLabel}
            </Button>
          ) : (
            <Button
              type="button"
              variant="default"
              className="min-h-11"
              disabled={!canSubmit}
              onClick={() => {
                void handleSubmit();
              }}
            >
              {pending ? (
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              ) : null}
              {pending ? register.confirmingLabel : register.confirmLabel}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * `/admin/merchants/[id]`'s Store status card mount point — a trigger
 * button plus this file's own `SuspendDialog`, self-contained so the
 * Server Component page above it never needs to hold dialog-open state.
 * `/admin`'s row menu (`src/app/admin/merchants-list.tsx`) mounts the same
 * `SuspendDialog` directly instead, because a dense table row's trigger is
 * a `dropdown-menu` item, not a standalone button — the DIALOG is the one
 * shared thing between the two mounts, matching R-2.
 */
export function SuspendRestoreControl({
  merchantId,
  storeName,
  status,
}: {
  readonly merchantId: string;
  readonly storeName: string;
  readonly status: string;
}) {
  const [dialogMode, setDialogMode] = useState<SuspendDialogMode | null>(null);

  // Allowlist `active`, matching every other status-driven fail-closed
  // branch on this surface (`merchants-list.tsx`'s `StoreStatusBadge`,
  // `src/server/admin/domain.ts`).
  const canRestore = status !== "active";

  return (
    <>
      <Button
        type="button"
        variant={canRestore ? "default" : "destructive"}
        className="min-h-11 self-start"
        onClick={() => setDialogMode(canRestore ? "restore" : "suspend")}
      >
        {canRestore
          ? strings.admin.merchants.actionRestore
          : strings.admin.merchants.actionSuspend}
      </Button>

      <SuspendDialog
        open={dialogMode !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDialogMode(null);
        }}
        mode={dialogMode ?? "suspend"}
        merchantId={merchantId}
        storeName={storeName}
      />
    </>
  );
}
