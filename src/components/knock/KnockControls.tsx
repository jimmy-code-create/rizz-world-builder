import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DoorOpen } from "lucide-react";
import { toast } from "@/lib/toast";
import { haptic, hapticError } from "@/lib/haptics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveOverlay } from "@/components/ui/responsive-overlay";
import { cn } from "@/lib/utils";
import {
  knockMoodColor,
  knockSentMessage,
  sendKnock,
  type KnockMood,
} from "@/lib/knock";

/**
 * The knock controls: one pill you can press almost anywhere a person's name
 * shows up, and the little sheet behind it.
 *
 * The pill carries the verdict as well as the action on purpose — "Live now" is
 * the reason to knock and the thing that makes the answer feel alive, and the
 * old passive "Active now" line could never tell you whether the app was even
 * open.
 */

export function KnockMoodLine({
  mood,
  action,
  className,
}: {
  mood: KnockMood;
  /** Overrides the default action label on the right of the pill. */
  action?: string;
  className?: string;
}) {
  const color = knockMoodColor(mood.verdict);
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{
          backgroundColor: color,
          boxShadow: mood.verdict === "live" ? `0 0 6px ${color}` : undefined,
        }}
        aria-hidden="true"
      />
      <span className="truncate font-semibold" style={{ color }}>
        {mood.label}
      </span>
      <span className="truncate text-muted-foreground">{action ?? mood.action}</span>
    </span>
  );
}

const PRESET_KNOCKS = ["Knock knock 🚪", "You up? 👀", "Free to talk?", "5 mins?"];

export function KnockButton({
  to,
  username,
  displayName,
  mood,
  variant = "pill",
  className,
  label,
  onOpenChange,
}: {
  to: string;
  username: string;
  displayName?: string | null;
  mood: KnockMood;
  /** `pill` is the compact header chip, `button` the full action on profiles. */
  variant?: "pill" | "button";
  className?: string;
  /** Shortens the trigger label ("Knock") without changing the sheet's action. */
  label?: string;
  onOpenChange?: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [open, setOpenState] = useState(false);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sentAt, setSentAt] = useState<number | null>(null);

  const name = displayName || username;
  const justKnocked = sentAt !== null && Date.now() - sentAt < 60_000;

  const setOpen = (next: boolean) => {
    setOpenState(next);
    onOpenChange?.(next);
  };

  const knock = async () => {
    if (sending || justKnocked) return;
    setSending(true);
    haptic("medium");
    try {
      await sendKnock(to, note.trim() || null);
      setSentAt(Date.now());
      void qc.invalidateQueries({ queryKey: ["knocks"] });
      void qc.invalidateQueries({ queryKey: ["knock-doorbell"] });
      toast.success(knockSentMessage(mood, username));
      setNote("");
      setOpen(false);
    } catch (error) {
      hapticError();
      toast.error(error instanceof Error ? error.message : "Couldn't knock");
    } finally {
      setSending(false);
    }
  };

  const trigger: ReactNode =
    variant === "pill" ? (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          event.preventDefault();
          haptic("light");
          setOpen(true);
        }}
        title={`Knock on ${name}'s door`}
        className={cn(
          "inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] transition-colors hover:border-white/20 hover:bg-white/[0.08]",
          className,
        )}
      >
        <KnockMoodLine mood={mood} action={justKnocked ? "Knocked · waiting" : undefined} />
      </button>
    ) : (
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          haptic("light");
          setOpen(true);
        }}
        className={cn("gap-1.5", className)}
      >
        <DoorOpen className="h-4 w-4" />
        {justKnocked ? "Knocked" : (label ?? mood.action)}
      </Button>
    );

  return (
    <>
      {trigger}
      <ResponsiveOverlay
        open={open}
        onOpenChange={setOpen}
        title={`Knock on ${name}'s door`}
        description={mood.detail}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--brand-line,rgba(244,241,231,0.13))] bg-[var(--brand-ink-3,#1c1c1f)] px-3.5 py-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Right now</p>
              <p className="mt-0.5 font-display text-lg font-bold tracking-tight" style={{ color: knockMoodColor(mood.verdict) }}>
                {mood.label}
              </p>
            </div>
            <span
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-lg"
              style={{
                backgroundColor: `${knockMoodColor(mood.verdict)}1a`,
                color: knockMoodColor(mood.verdict),
              }}
              aria-hidden="true"
            >
              <DoorOpen className="h-5 w-5" />
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {PRESET_KNOCKS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  haptic("selection");
                  setNote(preset);
                }}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  note === preset
                    ? "border-[var(--brand-signal,#c9ff3d)]/70 bg-[var(--brand-signal,#c9ff3d)]/15 text-[var(--brand-signal,#c9ff3d)]"
                    : "border-white/10 bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08] hover:text-foreground",
                )}
              >
                {preset}
              </button>
            ))}
          </div>

          <Input
            value={note}
            maxLength={120}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Say something through the door (optional)"
            className="glass border-white/10"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void knock();
              }
            }}
          />

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {mood.verdict === "offline"
              ? `${name} has the app closed. The knock waits in your chat, so it will be there when they open Rizz.`
              : `${name} will hear a knock and can open the door in one tap.`}
          </p>

          <Button
            onClick={() => void knock()}
            disabled={sending || justKnocked}
            className="h-11 w-full gap-2 font-bold"
          >
            <DoorOpen className="h-4 w-4" />
            {sending ? "Knocking…" : justKnocked ? "Already knocked" : mood.action}
          </Button>
        </div>
      </ResponsiveOverlay>
    </>
  );
}
