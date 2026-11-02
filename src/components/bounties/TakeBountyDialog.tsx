import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlarmClock,
  BellRing,
  Check,
  Loader2,
  Lock,
  PawPrint,
  ShieldAlert,
  Sparkles,
  Timer,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatNumber } from "@/lib/formatters";
import { usePurify } from "@/lib/purify";
import { useAuth } from "@/lib/auth";
import {
  AUTO_BLOCK_WARNINGS,
  CANCEL_FEE,
  TRUST_LEVEL_LABEL,
  canAffordTakerCancelFee,
  feeRecipientLabel,
  isEscrowBounty,
  minutesLeft,
  takeBounty,
  trustLine,
  useBountyRules,
  useBountyTrust,
  type BountyRow,
} from "@/lib/bounties";

/** "3d 4h", "2h 10m" — the same clock the card uses. */
function timeText(minutes: number): string {
  if (minutes <= 0) return "ended";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

/**
 * The full-screen "take it" sheet.
 *
 * Everything a taker is agreeing to lives here before anything is charged: the
 * prize, the escrow, the clock, the poster's trust line, the 1000-Paws fee and
 * the three-warning rule. The confirm button stays disabled until the fee
 * checkbox is ticked, and the server repeats every gate (premium, trust, block,
 * balance) because a disabled button is not a rule.
 */
export function TakeBountyDialog({
  bounty,
  open,
  onOpenChange,
  onTaken,
  initialMessage = "",
}: {
  bounty: BountyRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaken: () => void;
  initialMessage?: string;
}) {
  const { profile } = useAuth();
  const purify = usePurify();
  const rules = useBountyRules().data;
  const creatorTrust = useBountyTrust(bounty.creator_id);

  const [understood, setUnderstood] = useState(false);
  const [reminders, setReminders] = useState(true);
  const [message, setMessage] = useState(initialMessage);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  // Keep the countdown honest while the sheet is open, without a per-second
  // render when nothing on screen is that precise.
  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [open]);

  useEffect(() => {
    if (open) {
      setUnderstood(false);
      setError(null);
      setMessage(initialMessage);
    }
  }, [open, initialMessage]);

  const prize = Number(bounty.prize_paws ?? 0);
  const balance = Number(profile?.paw_balance ?? 0);
  const left = minutesLeft(bounty.expires_at, now);
  const fee = rules?.cancelFee ?? CANCEL_FEE;
  const recipient = rules?.feeRecipient ?? "creator";
  const stats = creatorTrust.data;
  const affordable = canAffordTakerCancelFee(balance);
  const premium = purify.active;
  const ready = premium && affordable && understood && left > 0 && !busy;

  const confirm = async () => {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const result = await takeBounty(bounty.id, message);
      if (result.status === "already_taken") {
        setError("You are already on this one.");
      } else {
        onOpenChange(false);
        onTaken();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't take that bounty");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong flex h-[94dvh] w-[min(100vw-0.75rem,40rem)] max-w-none flex-col gap-0 overflow-y-auto rounded-3xl border-white/10 p-0 sm:h-[88dvh]">
        <DialogHeader className="space-y-1 border-b border-white/10 px-5 py-4 text-left">
          <DialogTitle className="font-display text-lg">Take this bounty</DialogTitle>
          <DialogDescription>
            {isEscrowBounty(bounty)
              ? `${formatNumber(prize)} Paws are already held in escrow.`
              : "This is a free open call."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4">
          <div className="space-y-1">
            <h2 className="font-display text-xl font-bold leading-snug">{bounty.title}</h2>
            {bounty.description && (
              <p className="text-sm text-muted-foreground">{bounty.description}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-primary/20 bg-primary/[0.06] p-3">
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <PawPrint className="h-3.5 w-3.5 text-primary" /> Prize
              </p>
              <p className="font-display text-lg font-bold text-primary">
                {formatNumber(prize)} Paws
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Timer className="h-3.5 w-3.5" /> Deadline
              </p>
              <p className="font-display text-lg font-bold">{timeText(left)}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-muted-foreground">
              <Lock className="h-3 w-3" />
              {bounty.escrow_state === "held" ? "Held in escrow" : "No escrow"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-muted-foreground">
              by @{bounty.creator?.username ?? "someone"}
            </span>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[11px] text-muted-foreground">The poster's record</p>
            <p className="mt-0.5 text-sm font-semibold">
              {stats ? trustLine(stats) : "Loading…"}
              {stats && (
                <span className="ml-2 rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  {TRUST_LEVEL_LABEL[stats.level]}
                </span>
              )}
            </p>
          </div>

          <div className="space-y-2 rounded-2xl border border-amber-300/25 bg-amber-300/[0.06] p-3 text-[12px] leading-relaxed">
            <p className="flex items-center gap-1.5 font-bold text-amber-100">
              <ShieldAlert className="h-4 w-4" />
              What you are agreeing to
            </p>
            <p className="text-muted-foreground">
              Hand it back or miss the deadline and {formatNumber(fee)} Paws is charged as the
              cancellation fee. It goes to {feeRecipientLabel(recipient)}.
            </p>
            <p className="text-muted-foreground">
              {AUTO_BLOCK_WARNINGS} active warnings stop you taking bounties until an appeal
              succeeds. Warnings are counted on your profile.
            </p>
            {!affordable && (
              <p className="font-semibold text-amber-100">
                You need {formatNumber(fee)} Paws to cover the fee. You have {formatNumber(balance)}
                .
              </p>
            )}
          </div>

          {!premium && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-primary/25 bg-primary/[0.07] p-3 text-sm">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-semibold">Premium to take.</span>
              <span className="text-muted-foreground">Taking bounties is a Purify perk.</span>
              <Link to="/purify" className="font-bold text-primary hover:underline">
                Upgrade
              </Link>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-bold">
                <BellRing className="h-4 w-4" /> Deadline reminders
              </p>
              <p className="text-[11px] text-muted-foreground">
                A nudge on this device before the deadline.
              </p>
            </div>
            <Switch
              checked={reminders}
              onCheckedChange={setReminders}
              aria-label="Deadline reminders"
            />
          </div>

          <Textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={280}
            placeholder="Optional message to the poster — what's your plan?"
            className="glass min-h-20 border-white/10"
          />

          <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <Checkbox
              checked={understood}
              onCheckedChange={(value) => setUnderstood(value === true)}
              className="mt-0.5"
              aria-label="I understand the cancellation fee"
            />
            <span className="text-[12px] leading-relaxed">
              I understand the {formatNumber(fee)} Paws fee if I hand this back or miss the
              deadline.
            </span>
          </label>

          {error && (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-[12px] font-semibold text-destructive">
              {error}
            </p>
          )}
        </div>

        <div className="sticky bottom-0 mt-auto border-t border-white/10 bg-card/95 px-5 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur">
          <Button
            onClick={() => void confirm()}
            disabled={!ready}
            className="min-h-12 w-full border-0 bg-primary text-sm font-bold text-primary-foreground shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <>
                <Check className="h-4 w-4" />
                {premium ? `Take it · earn ${formatNumber(prize)} Paws` : "Premium to take"}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** A small "time left" label reused by the card when the clock is urgent. */
export function DeadlineChip({ expiresAt }: { expiresAt: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <AlarmClock className="h-3 w-3" />
      {timeText(minutesLeft(expiresAt))} left
    </span>
  );
}
