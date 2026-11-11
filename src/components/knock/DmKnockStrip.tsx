import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { haptic, hapticError } from "@/lib/haptics";
import { useAuth } from "@/lib/auth";
import { sendKnock, type Knock } from "@/lib/knock";
import { KnockGlyph } from "@/components/knock/KnockGlyph";
import { cn } from "@/lib/utils";

/**
 * The knock strip under a DM header.
 *
 * It appears only when the door is actually shut (offline, around, or dnd).
 * It is positioned over the thread rather than in the document flow, so showing
 * it never moves the messages, and it uses the same 30s send_knock cooldown as
 * the knock sheet instead of inventing a second one.
 */

const COOLDOWN_MS = 30_000;

export type DmDoorState = "offline" | "around" | "dnd";

export function DmKnockStrip({
  peerId,
  state,
  lastSeenLabel,
  lastSeenFull,
  knocks,
  onDismiss,
}: {
  peerId: string;
  state: DmDoorState;
  lastSeenLabel: string | null;
  lastSeenFull: string | null;
  knocks: Knock[];
  onDismiss: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [sending, setSending] = useState(false);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const latestMine = useMemo(() => {
    if (!user?.id) return null;
    const mine = knocks.filter((knock) => knock.from_user === user.id && knock.to_user === peerId);
    return mine.length ? mine[mine.length - 1] : null;
  }, [knocks, peerId, user?.id]);

  const lastKnockAt = Math.max(
    sentAt ?? 0,
    latestMine ? new Date(latestMine.created_at).getTime() : 0,
  );
  const remainingMs = Math.max(0, COOLDOWN_MS - (now - lastKnockAt));

  useEffect(() => {
    if (!remainingMs) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [remainingMs]);

  const knock = async () => {
    if (!user || sending || remainingMs > 0) return;
    setSending(true);
    setError(null);
    haptic("medium");
    try {
      await sendKnock(peerId, null);
      setSentAt(Date.now());
      setNow(Date.now());
      void qc.invalidateQueries({ queryKey: ["knocks"] });
      void qc.invalidateQueries({ queryKey: ["knock-doorbell"] });
    } catch (reason) {
      hapticError();
      setError(reason instanceof Error ? reason.message : "Couldn't knock right now");
    } finally {
      setSending(false);
    }
  };

  const line =
    state === "dnd"
      ? "Do not disturb. Messages arrive quietly."
      : state === "around"
        ? "Away from the app · they'll see your message soon"
        : lastSeenLabel
          ? `Offline · ${lastSeenLabel}`
          : "Offline";

  const seconds = Math.ceil(remainingMs / 1_000);
  const countdown = seconds >= 60 ? `${Math.ceil(seconds / 60)}m` : `${seconds}s`;

  return (
    <div
      className="dm-knock-strip"
      role="status"
      aria-live="polite"
      title={state === "offline" && lastSeenFull ? lastSeenFull : undefined}
    >
      <KnockGlyph className="dm-knock-strip__glyph" />
      <p className={cn("dm-knock-strip__line", error && "text-destructive")} aria-live={error ? "assertive" : undefined}>
        {error ?? line}
      </p>
      {state !== "dnd" && (
        <button
          type="button"
          onClick={() => void knock()}
          disabled={sending || remainingMs > 0}
          className="dm-knock-strip__knock"
          title={remainingMs > 0 ? `Again in ${countdown}` : "Knock"}
        >
          {remainingMs > 0 ? (
            <>
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Knocked</span>
              <span className="tabular-nums opacity-70">{countdown}</span>
            </>
          ) : sending ? (
            "Knocking…"
          ) : (
            "Knock"
          )}
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Hide knock strip"
        className="dm-knock-strip__close"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
