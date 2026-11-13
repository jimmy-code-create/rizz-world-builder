import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { toast } from "@/lib/toast";
import { haptic, hapticError } from "@/lib/haptics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveOverlay } from "@/components/ui/responsive-overlay";
import { KnockGlyph } from "@/components/knock/KnockGlyph";
import { KnockDoor } from "@/components/knock/KnockDoor";
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
  renderTrigger,
  onSent,
  cooldownFrom,
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
  /**
   * Lets a surface own the trigger markup (the DM header's circular door)
   * while still using this sheet and its send/cooldown behavior.
   */
  renderTrigger?: (openSheet: () => void) => ReactNode;
  /** Fired after a knock is accepted, for a local ripple or cooldown UI. */
  onSent?: () => void;
  /**
   * The strip/header may already know when this door was last knocked. Passing
   * it in means opening the sheet during cooldown still opens the full sheet,
   * with an honest countdown instead of a second send attempt the server will
   * reject.
   */
  cooldownFrom?: number | null;
}) {
  const qc = useQueryClient();
  const [open, setOpenState] = useState(false);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sentAt, setSentAt] = useState<number | null>(cooldownFrom ?? null);
  const [now, setNow] = useState(() => Date.now());
  const [opening, setOpening] = useState(false);

  const name = displayName || username;
  const lastKnockAt = Math.max(sentAt ?? 0, cooldownFrom ?? 0);
  const remainingMs = Math.max(0, 30_000 - (now - lastKnockAt));
  const justKnocked = remainingMs > 0;
  const countdown = `${Math.ceil(remainingMs / 1_000)}s`;

  useEffect(() => {
    if (!cooldownFrom) return;
    setSentAt(cooldownFrom);
    setNow(Date.now());
  }, [cooldownFrom]);

  useEffect(() => {
    if (!open || remainingMs <= 0) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [open, remainingMs]);

  // Give the hero door one knock when the sheet opens. Without this, a touch
  // device (no hover) only saw a static closed door until it was too late.
  useEffect(() => {
    if (!open) {
      setOpening(false);
      return;
    }
    setOpening(true);
    const timer = window.setTimeout(() => setOpening(false), 780);
    return () => window.clearTimeout(timer);
  }, [open]);

  const setOpen = (next: boolean) => {
    if (next) setNow(Date.now());
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
      onSent?.();
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
        <KnockDoor className="h-4 w-4" state={justKnocked ? "sent" : "idle"} />
        {justKnocked ? "Knocked" : (label ?? mood.action)}
      </Button>
    );

  return (
    <>
      {renderTrigger
        ? renderTrigger(() => {
            haptic("light");
            setOpen(true);
          })
        : trigger}
      <ResponsiveOverlay
        open={open}
        onOpenChange={setOpen}
        title={`Knock on ${name}'s door`}
        description={mood.detail}
      >
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-3xl border border-[var(--surface-line)] bg-surface-2 px-4 pb-4 pt-5 text-center shadow-[var(--surface-shadow)]">
            <span
              className="relative mx-auto grid h-20 w-20 place-items-center rounded-full"
              style={{
                backgroundColor: `${knockMoodColor(mood.verdict)}14`,
                color: knockMoodColor(mood.verdict),
                boxShadow: `inset 0 0 0 1px ${knockMoodColor(mood.verdict)}38`,
              }}
              aria-hidden="true"
            >
              {mood.verdict === "live" && (
                <span
                  className="knock-hero-pulse absolute inset-0 rounded-full border"
                  style={{ borderColor: knockMoodColor(mood.verdict) }}
                />
              )}
              <KnockDoor
                className="h-12 w-12"
                state={
                  sending || opening
                    ? "knocking"
                    : justKnocked
                      ? "sent"
                      : mood.verdict === "live"
                        ? "live"
                        : "idle"
                }
              />
            </span>
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Right now
            </p>
            <p
              className="mt-0.5 font-display text-xl font-bold tracking-tight"
              style={{ color: knockMoodColor(mood.verdict) }}
            >
              {mood.label}
            </p>
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
            className="h-12 w-full gap-2 rounded-2xl text-[15px] font-bold"
          >
            <KnockGlyph className="h-5 w-5" state={sending ? "knocking" : justKnocked ? "sent" : "idle"} />
            {sending
              ? "Knocking…"
              : justKnocked
                ? `Already knocked · ${countdown}`
                : mood.action}
          </Button>
        </div>
      </ResponsiveOverlay>
    </>
  );
}
