import { Gamepad2 } from "lucide-react";
import { BuiltinSurface } from "@/components/games/registry";
import { isValidGameUrl, type GameEntry } from "@/lib/activities";

/**
 * One surface for every game, wherever it runs.
 *
 * Built-in games render as real React components (no iframe, no borders, they
 * can be drawn as a layer behind the voice controls). Web games render in a
 * sandboxed frame: scripts and forms are allowed because games need them, but
 * the frame gets no top-level navigation and no access to RIZZ storage.
 */

// Real games need forms (logins, nicknames), popups and fullscreen; scripts stay
// sandboxed and the frame gets no access to RIZZ storage or top nav.
const IFRAME_SANDBOX =
  "allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-pointer-lock";
const IFRAME_ALLOW = "autoplay; microphone; camera; fullscreen; gamepad";

export function GameStage({
  entry,
  players = 1,
  fullscreen = false,
  className = "",
}: {
  entry: GameEntry | null;
  /** Voice-room size — built-in games scale their bots and speed from it. */
  players?: number;
  fullscreen?: boolean;
  className?: string;
}) {
  if (!entry) {
    return (
      <div
        className={`grid h-full w-full place-items-center bg-[#08080a] p-6 text-center ${className}`}
      >
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
          <Gamepad2 className="mx-auto h-6 w-6 text-primary" />
          <p className="mt-2 text-sm font-semibold text-foreground">
            That game is no longer in the library
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Pick another one from the Games hub.
          </p>
        </div>
      </div>
    );
  }

  if (entry.source === "builtin") {
    return (
      <div className={`h-full w-full ${className}`}>
        <BuiltinSurface id={entry.id} players={players} fullscreen={fullscreen} />
      </div>
    );
  }

  if (!isValidGameUrl(entry.url)) {
    return (
      <div
        className={`grid h-full w-full place-items-center bg-[#08080a] p-6 text-center ${className}`}
      >
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
          <p className="text-sm font-bold text-foreground">{entry.name} has no link yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Paste its URL into <span className="font-mono">src/data/games.json</span> — one line,
            under a minute.
          </p>
        </div>
      </div>
    );
  }

  return (
    <iframe
      title={entry.name}
      src={entry.url}
      sandbox={IFRAME_SANDBOX}
      allow={IFRAME_ALLOW}
      allowFullScreen
      className={`h-full w-full border-0 bg-black ${className}`}
    />
  );
}
