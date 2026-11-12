import { useEffect, useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import type { Knock, KnockMood } from "@/lib/knock";
import { KnockGlyph } from "@/components/knock/KnockGlyph";
import { KnockButton } from "@/components/knock/KnockControls";

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
  name,
  mood,
  state,
  lastSeenLabel,
  lastSeenFull,
  knocks,
  onDismiss,
}: {
  peerId: string;
  name: string;
  mood: KnockMood;
  state: DmDoorState;
  lastSeenLabel: string | null;
  lastSeenFull: string | null;
  knocks: Knock[];
  onDismiss: () => void;
}) {
  const { user } = useAuth();
  const [sentAt, setSentAt] = useState<number | null>(null);
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
      <p className="dm-knock-strip__line">{line}</p>
      {state !== "dnd" && (
        <KnockButton
          to={peerId}
          username={name}
          displayName={name}
          mood={mood}
          cooldownFrom={lastKnockAt || null}
          onSent={() => {
            setSentAt(Date.now());
            setNow(Date.now());
          }}
          renderTrigger={(openSheet) => (
            <button
              type="button"
              onClick={openSheet}
              className="dm-knock-strip__knock"
              title={remainingMs > 0 ? `Knock again in ${countdown}` : "Knock"}
              aria-haspopup="dialog"
            >
              {remainingMs > 0 ? (
                <>
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Knocked</span>
                  <span className="tabular-nums opacity-70">{countdown}</span>
                </>
              ) : (
                "Knock"
              )}
            </button>
          )}
        />
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
