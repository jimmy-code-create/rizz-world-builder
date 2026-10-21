import { useState } from "react";
import { Copy, Expand, ExternalLink, Gamepad2, Minimize2, PhoneOff, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { GameIcon } from "@/components/GameIcon";
import { GameStage } from "@/components/games/GameStage";
import { inviteText, type GameEntry, type RoomActivity } from "@/lib/activities";

/**
 * VOICE-FIRST ACTIVITY PANEL — the game beside the call, not over it.
 *
 * This is the deliberate counterpart to `VoiceActivityOverlay`: on a wide screen
 * you can keep the participant grid primary and run the game next to it. Phones
 * never see this (the overlay is their surface), which is why only one layout
 * exists here now.
 */
export function ActivityPanel({
  activity,
  entry,
  canEnd,
  playingCount,
  players,
  minimized,
  onMinimize,
  onReopen,
  onLeave,
  onEnd,
  onExpand,
}: {
  activity: RoomActivity;
  entry: GameEntry | null;
  canEnd: boolean;
  playingCount: number;
  /** Voice-room size: built-in games scale their difficulty to it. */
  players: number;
  minimized: boolean;
  onMinimize: () => void;
  onReopen: () => void;
  onLeave: () => void;
  onEnd: () => void;
  /** Swap to the full-screen overlay (game as the background). */
  onExpand: () => void;
}) {
  const [qrOk, setQrOk] = useState(true);
  const builtin = entry?.source === "builtin";

  const copyInvite = async () => {
    const text = entry ? inviteText(entry, activity.roomCode) : activity.url;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Invite copied");
    } catch {
      toast.error("Couldn't copy the invite");
    }
  };

  if (minimized) {
    return (
      <div className="hidden w-[380px] shrink-0 md:block">
        <div className="sticky top-2 flex items-center gap-2 rounded-2xl border border-primary/40 bg-card p-2">
          <GameIcon icon={activity.gameIcon} size={22} />
          <button
            type="button"
            onClick={onReopen}
            className="min-h-[44px] min-w-0 flex-1 truncate rounded-xl px-2 text-left text-sm font-semibold hover:bg-white/5"
          >
            {activity.gameName} — reopen
          </button>
          <button
            type="button"
            onClick={onLeave}
            aria-label="Leave game"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  const helper = builtin ? (
    <div className="shrink-0 border-t border-white/[0.06] px-3 py-2 text-[11px] leading-snug text-muted-foreground">
      Runs inside RIZZ — no sign-up, no lobby. Everyone in the call can join from the banner.
    </div>
  ) : entry && entry.type !== "embed" ? (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-white/[0.06] px-3 py-2">
      {activity.roomCode ? (
        <>
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Room
          </span>
          <span className="rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1 font-mono text-sm font-bold tracking-widest text-primary">
            {activity.roomCode}
          </span>
        </>
      ) : (
        <span className="min-w-0 flex-1 basis-full text-[11px] leading-snug text-muted-foreground sm:basis-auto">
          {entry.type === "multiplayer-hub"
            ? "The host reads the room code off their game screen."
            : "Host: create a private room on the site, then paste its link in chat."}
        </span>
      )}
      <button
        type="button"
        onClick={() => void copyInvite()}
        className="flex min-h-[44px] items-center gap-1.5 rounded-full border border-border px-3 text-xs font-semibold transition-colors hover:border-primary/50"
      >
        <Copy className="h-3.5 w-3.5" /> Copy invite
      </button>
      {entry.type === "multiplayer-hub" && qrOk && (
        <img
          src={`https://api.qrserver.com/v1/create-qr-code/?size=96x96&data=${encodeURIComponent(
            inviteText(entry, activity.roomCode),
          )}`}
          onError={() => setQrOk(false)}
          alt="QR code to join the game on your phone"
          width={96}
          height={96}
          loading="lazy"
          className="ml-auto h-24 w-24 rounded-xl border border-white/10 bg-white"
        />
      )}
    </div>
  ) : null;

  return (
    <div className="hidden w-[380px] shrink-0 md:block">
      <div className="sticky top-2 flex h-[68dvh] flex-col overflow-hidden rounded-3xl border border-white/10 bg-card">
        <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.06] px-3 py-2">
          <GameIcon icon={activity.gameIcon} size={22} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">{activity.gameName}</span>
            <span className="block truncate text-[11px] text-muted-foreground">
              Started by {activity.startedByName}
              {playingCount > 0 && ` · ${playingCount} playing`}
            </span>
          </span>
          <button
            type="button"
            onClick={onExpand}
            aria-label="Play full screen over the call"
            title="Full screen with voice on top"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
          >
            <Expand className="h-4 w-4" />
          </button>
          {canEnd && (
            <button
              type="button"
              onClick={onEnd}
              aria-label="End game for everyone"
              className="flex min-h-[44px] items-center gap-1.5 rounded-full bg-destructive/15 px-3 text-xs font-bold text-destructive transition-colors hover:bg-destructive/25"
            >
              <PhoneOff className="h-3.5 w-3.5" /> End
            </button>
          )}
          {!builtin && (
            <a
              href={activity.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${activity.gameName} in a new tab`}
              title="Open in a new tab"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          <button
            type="button"
            onClick={onMinimize}
            aria-label="Minimize game"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground"
          >
            <Minimize2 className="h-4 w-4" />
          </button>
        </div>

        <div data-rizz-game-surface className="relative min-h-0 flex-1">
          <GameStage entry={entry} players={players} className="absolute inset-0" />
        </div>

        {helper}
      </div>
    </div>
  );
}

/** "X started Y" banner: every room member can jump in with one tap. */
export function JoinGameBanner({
  activity,
  playingCount,
  onJoin,
  onDismiss,
}: {
  activity: RoomActivity;
  playingCount: number;
  onJoin: () => void;
  onDismiss: () => void;
}) {
  const builtin = activity.source === "builtin";
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-3">
      <span
        aria-hidden
        className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/15"
      >
        {activity.gameIcon ? (
          <GameIcon icon={activity.gameIcon} size={26} />
        ) : (
          <Gamepad2 className="h-5 w-5 text-primary" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">
          {activity.startedByName} started {activity.gameName}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {playingCount > 0 ? `${playingCount} playing · ` : ""}
          {activity.roomCode ? `Room ${activity.roomCode} · ` : ""}
          {builtin ? "Plays here · no sign-up" : "Voice keeps running"}.
        </p>
      </div>
      {activity.roomCode && (
        <span className="hidden shrink-0 rounded-lg border border-primary/40 px-2 py-1 font-mono text-xs font-bold tracking-widest text-primary sm:block">
          {activity.roomCode}
        </span>
      )}
      <button
        type="button"
        onClick={onJoin}
        className="h-11 shrink-0 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground transition-transform hover:brightness-105 active:scale-95"
      >
        Join game
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-white/10"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
