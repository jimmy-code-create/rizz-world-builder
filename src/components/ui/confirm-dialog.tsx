import { useEffect, useState, type ReactNode } from "react";
import { ResponsiveOverlay } from "@/components/ui/responsive-overlay";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

/**
 * One confirm dialog for the whole app.
 *
 * Replaces `window.confirm`, which on Android Chrome and iOS looks like an OS
 * warning pasted over the app. This uses the shared responsive overlay: a
 * bottom sheet with a drag handle on phones, a compact centered card on
 * desktop, in the Rizz ink/glass style.
 *
 * `onConfirm` may be async; the dialog stays open with a spinner until it
 * settles and only closes when it resolves. Errors are the caller's job (throw
 * and toast), so a failed delete never looks like it worked.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" fills the confirm button red; only for destructive actions. */
  tone?: "default" | "danger";
  onConfirm: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  // A stale spinner must never greet the next open.
  useEffect(() => {
    if (!open) setBusy(false);
  }, [open]);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // Keep the dialog open: the caller shows the error, the user can retry.
    } finally {
      setBusy(false);
    }
  };

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        onOpenChange(next);
      }}
      title={title}
      description={typeof description === "string" ? description : undefined}
      showClose={!busy}
    >
      <div className="space-y-4">
        {/* The overlay prints a string description under the title; non-string
            nodes (e.g. a bolded name) render here instead. */}
        {description && typeof description !== "string" ? (
          <div className="text-sm leading-relaxed text-muted-foreground">{description}</div>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-full sm:w-auto"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={tone === "danger" ? "destructive" : "default"}
            className="h-11 w-full sm:w-auto"
            disabled={busy}
            aria-busy={busy}
            onClick={() => void confirm()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </ResponsiveOverlay>
  );
}
