import { useState } from "react";
import { AlertTriangle, Loader2, ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatNumber } from "@/lib/formatters";
import { toast } from "@/lib/toast";
import {
  WARNING_REASON_LABEL,
  WARNING_REASONS,
  appealBountyWarning,
  warnBountyTaker,
  type BountyRow,
  type BountyWarning,
  type WarningReason,
} from "@/lib/bounties";

/**
 * "Warn taker" — one warning per bounty per creator, with a reason the taker
 * can see. The database enforces the uniqueness; the dialog explains it before
 * the poster spends their one shot.
 */
export function WarnTakerDialog({
  bounty,
  workerName,
  open,
  onOpenChange,
  onWarned,
}: {
  bounty: BountyRow;
  workerName?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onWarned: () => void;
}) {
  const [reason, setReason] = useState<WarningReason>("no_work");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await warnBountyTaker({ dropId: bounty.id, reason, note });
      toast.success("Warning sent", {
        description: result.autoBlocked
          ? `${workerName ? `@${workerName}` : "The taker"} now has ${result.warnings} active warnings and cannot take bounties.`
          : `${workerName ? `@${workerName}` : "The taker"} now has ${result.warnings} active warning${result.warnings === 1 ? "" : "s"}.`,
      });
      onOpenChange(false);
      setNote("");
      onWarned();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't send that warning");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-white/10 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <AlertTriangle className="h-4 w-4 text-amber-300" />
            Warn {workerName ? `@${workerName}` : "the taker"}
          </DialogTitle>
          <DialogDescription>
            This goes on their record across every bounty and notifies them. They can appeal once.
            You cannot warn the same taker twice on this bounty.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-1.5">
            {WARNING_REASONS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setReason(value)}
                aria-pressed={reason === value}
                className={`min-h-10 rounded-lg border px-2 text-xs font-bold transition-colors ${
                  reason === value
                    ? "border-amber-300/40 bg-amber-300/10 text-amber-100"
                    : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground"
                }`}
              >
                {WARNING_REASON_LABEL[value]}
              </button>
            ))}
          </div>

          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={500}
            placeholder="What happened? The taker sees this."
            className="glass min-h-24 border-white/10"
          />

          {error && (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-2.5 text-[12px] font-semibold text-destructive">
              {error}
            </p>
          )}

          <Button
            onClick={() => void submit()}
            disabled={busy}
            className="min-h-11 w-full border-0 bg-amber-300 text-black shadow-md"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <AlertTriangle className="h-4 w-4" />
                Send the warning
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * "Appeal this warning" — one appeal per warning, decided by an admin. The
 * message is deliberately short: it lands in a queue, it is not a chat.
 */
export function AppealWarningDialog({
  warning,
  open,
  onOpenChange,
  onAppealed,
}: {
  warning: BountyWarning | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAppealed: () => void;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!warning) return null;

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await appealBountyWarning(warning.id, message);
      toast.success("Appeal sent", { description: "An admin will review it." });
      onOpenChange(false);
      setMessage("");
      onAppealed();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't send that appeal");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-white/10 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <ShieldAlert className="h-4 w-4 text-primary" />
            Appeal this warning
          </DialogTitle>
          <DialogDescription>
            You get one appeal per warning. While it is pending the warning still counts, so a block
            stays in place until an admin decides.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[12px]">
            <p className="font-bold">{WARNING_REASON_LABEL[warning.reason]}</p>
            {warning.note && <p className="text-muted-foreground">{warning.note}</p>}
          </div>

          <Textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={500}
            placeholder="Why is this warning wrong? At least a sentence."
            className="glass min-h-24 border-white/10"
          />

          {error && (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-2.5 text-[12px] font-semibold text-destructive">
              {error}
            </p>
          )}

          <Button
            onClick={() => void submit()}
            disabled={busy || message.trim().length < 10}
            className="min-h-11 w-full border-0 bg-primary text-primary-foreground shadow-md"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send the appeal"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** The banner at the top of the Bounties page. */
export function WarningBanner({
  warnings,
  onAppeal,
}: {
  warnings: BountyWarning[];
  onAppeal: (warning: BountyWarning) => void;
}) {
  const active = warnings.filter((warning) => warning.status === "active");
  if (active.length === 0) return null;
  const blocked = active.length >= 3;

  return (
    <div className="mb-4 rounded-2xl border border-amber-300/30 bg-amber-300/[0.07] p-3">
      <p className="flex items-center gap-2 text-sm font-bold text-amber-100">
        <ShieldAlert className="h-4 w-4" />
        {blocked
          ? "Taking bounties is blocked"
          : `${active.length} active warning${active.length === 1 ? "" : "s"} on your account`}
      </p>
      <p className="mt-1 text-[12px] text-muted-foreground">
        {blocked
          ? `${active.length} warnings close the board until an appeal succeeds. Pending appeals do not lift the block.`
          : `Three warnings close the board. A warning is a poster's report that the work was not legitimate.`}
      </p>
      <ul className="mt-2 space-y-1.5">
        {active.map((warning) => (
          <li
            key={warning.id}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-2.5 py-2 text-[12px]"
          >
            <span className="font-semibold">{WARNING_REASON_LABEL[warning.reason]}</span>
            {warning.note && <span className="text-muted-foreground">· {warning.note}</span>}
            <span className="ml-auto text-[11px] text-muted-foreground">
              {warning.appeal_status === "pending"
                ? "Appeal pending"
                : warning.appeal_status === "rejected"
                  ? "Appeal rejected"
                  : ""}
            </span>
            {warning.appeal_status === "none" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAppeal(warning)}
                className="h-7 border-white/15 bg-white/[0.04] px-2 text-[11px] font-bold"
              >
                Appeal
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Shared by the card and the review screen: "3 completed · 0 warnings · Trusted". */
export function TrustLine({
  stats,
  className = "",
}: {
  stats:
    { completed: number; warnings: number; level: "new" | "trusted" | "top" } | null | undefined;
  className?: string;
}) {
  if (!stats) return null;
  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 text-[11px] ${className}`}>
      <span className="text-muted-foreground">
        {stats.completed} completed · {stats.warnings} warning
        {stats.warnings === 1 ? "" : "s"}
      </span>
      <span className="rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
        {stats.level === "top" ? "Top" : stats.level === "trusted" ? "Trusted" : "New"}
      </span>
    </span>
  );
}
