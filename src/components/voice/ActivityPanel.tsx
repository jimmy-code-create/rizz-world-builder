import { useState } from "react";
import { ChevronLeft, Copy, ExternalLink, Gamepad2, Minimize2, PhoneOff, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { GameIcon } from "@/components/GameIcon";
import { inviteText, isValidGameUrl, type GameEntry, type RoomActivity } from "@/lib/activities";

// Real games need forms (logins, nicknames), popups and fullscreen; scripts
// stay sandboxed and the frame gets no access to RIZZ storage or top nav.
const IFRAME_SANDBOX = "allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-pointer-lock";
const IFRAME_ALLOW = "autoplay; microphone; camera; fullscreen";

/**
 * The live game panel: sandboxed iframe + room-code helper. Desktop renders
 * as a side panel next to the tiles; phones get a full-screen overlay.
 * Voice is owned by the provider, so it keeps running either way.
 */
export function ActivityPanel({
  activity,
  entry,
  canEnd,
  layout,
  minimized,
  onMinimize,
  onReopen,
  onLeave,
  onEnd,
}: {
  activity: RoomActivity;
  entry: GameEntry | null;
  canEnd: boolean;
  layout: "side" | "overlay";
  minimized: boolean;
  onMinimize: () => void;
  onReopen: () => void;
  onLeave: () => void;
  onEnd: () => void;
}) {
  const [qrOk, setQrOk] = useState(true);
  const valid = isValidGameUrl(activity.url);

  const copyInvite = async () => {
    const text = entry ? inviteText(entry, activity.roomCode) : activity.url;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Invite copied");
    } catch {
      toast.error("Couldn't copy the invite");
    }
  };

  if (minimized && layout === "side") {
    return (
      <div className="hidden w-[380px] shrink-0 md:block">
        <div className="sticky top-0 flex items-center gap-2 rounded-2xl border border-[#c8ff3d]/40 bg-[#141416] p-2">
          <GameIcon icon={activity.gameIcon} size={22} />
          <button
            type="button"
            onClick={onReopen}
            className="min-h-[44px] min-w-0 flex-1 truncate rounded-xl px-2 text-left text-sm font-semibold text-[#f2efe6] hover:bg-white/5"
          >
            {activity.gameName} — reopen
          </button>
          <button
            type="button"
            onClick={onLeave}
            aria-label="Leave game"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-[#f2efe6]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  const helper =
    entry && entry.type !== "embed" ? (
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-white/[0.06] px-3 py-2">
        {activity.roomCode ? (
          <>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Room</span>
            <span className="rounded-lg border border-[#c8ff3d]/40 bg-[#c8ff3d]/10 px-2.5 py-1 font-mono text-sm font-bold tracking-widest text-[#c8ff3d]">
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
          className="flex min-h-[44px] items-center gap-1.5 rounded-full border border-[#2a2a2e] px-3 text-xs font-semibold text-[#f2efe6] transition-colors hover:border-[#c8ff3d]/50"
        >
          <Copy className="h-3.5 w-3.5" /> Copy invite
        </button>
        {entry.type === "multiplayer-hub" && layout === "side" && qrOk && (
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

  const chrome = (
    <>
      <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.06] px-3 py-2">
        {layout === "overlay" ? (
          <button
            type="button"
            onClick={onLeave}
            aria-label="Leave game"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[#f2efe6] hover:bg-white/10"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : null}
        <GameIcon icon={activity.gameIcon} size={22} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-[#f2efe6]">{activity.gameName}</span>
          <span className="block truncate text-[11px] text-muted-foreground">
            Started by {activity.startedByName}
          </span>
        </span>
        {canEnd && (
          <button
            type="button"
            onClick={onEnd}
            aria-label="End game for everyone"
            className="flex min-h-[44px] items-center gap-1.5 rounded-full bg-[#ff5d5d]/15 px-3 text-xs font-bold text-[#ff5d5d] transition-colors hover:bg-[#ff5d5d]/25"
          >
            <PhoneOff className="h-3.5 w-3.5" /> End
          </button>
        )}
        <a
          href={activity.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${activity.gameName} in a new tab`}
          title="Open in a new tab"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-white/10 hover:text-[#f2efe6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d]"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
        {layout === "side" ? (
          <button
            type="button"
            onClick={onMinimize}
            aria-label="Minimize game"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-[#f2efe6]"
          >
            <Minimize2 className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onLeave}
            aria-label="Leave game"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-[#f2efe6]"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {valid ? (
        <iframe
          title={activity.gameName}
          src={activity.url}
          sandbox={IFRAME_SANDBOX}
          allow={IFRAME_ALLOW}
          allowFullScreen
          className="min-h-0 w-full flex-1 border-0 bg-black"
        />
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
            <p className="text-sm font-bold text-[#f2efe6]">{activity.gameName} has no link yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Paste its URL into <span className="font-mono">src/data/games.json</span> — one line, under a minute.
            </p>
          </div>
        </div>
      )}

      {helper}
    </>
  );

  if (layout === "overlay") {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={activity.gameName}
        className="fixed inset-0 z-[140] flex flex-col bg-[#0b0b0c] md:hidden"
        style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {chrome}
      </div>
    );
  }

  return (
    <div className="hidden w-[380px] shrink-0 md:block">
      <div className="sticky top-0 flex h-[68dvh] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#141416]">
        {chrome}
      </div>
    </div>
  );
}

/** "X started Y" banner: every room member can jump in with one tap. */
export function JoinGameBanner({
  activity,
  onJoin,
  onDismiss,
}: {
  activity: RoomActivity;
  onJoin: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#c8ff3d]/40 bg-[#c8ff3d]/10 p-3">
      <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#c8ff3d]/15">
        {activity.gameIcon ? (
          <GameIcon icon={activity.gameIcon} size={26} />
        ) : (
          <Gamepad2 className="h-5 w-5 text-[#c8ff3d]" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-[#f2efe6]">
          {activity.startedByName} started {activity.gameName}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {activity.roomCode ? `Room ${activity.roomCode} · ` : ""}Voice keeps running.
        </p>
      </div>
      {activity.roomCode && (
        <span className="hidden shrink-0 rounded-lg border border-[#c8ff3d]/40 px-2 py-1 font-mono text-xs font-bold tracking-widest text-[#c8ff3d] sm:block">
          {activity.roomCode}
        </span>
      )}
      <button
        type="button"
        onClick={onJoin}
        className="h-11 shrink-0 rounded-full bg-[#c8ff3d] px-4 text-sm font-bold text-[#0b0b0c] transition-transform hover:bg-[#c8ff3d]/90 active:scale-95"
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
