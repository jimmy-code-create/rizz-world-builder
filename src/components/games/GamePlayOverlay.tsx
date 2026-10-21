import { Maximize2, Minimize2, X, Zap } from "lucide-react";
import { GameIcon } from "@/components/GameIcon";
import { GameStage } from "@/components/games/GameStage";
import { FullScreenLayer } from "@/components/FullScreenLayer";
import { useFullscreen } from "@/lib/fullscreen";
import type { GameEntry } from "@/lib/activities";

/**
 * INSTANT PLAY — the whole promise of a built-in game, in one layer.
 *
 * Tap a card in the hub and you are playing: no account, no lobby, no tab
 * switch, and the same surface can go real fullscreen. When you are in a voice
 * call the hub launches the activity instead and this overlay is never used —
 * there, the game becomes the background of the call view.
 */
export function GamePlayOverlay({ entry, onClose }: { entry: GameEntry; onClose: () => void }) {
  const stage = useFullscreen<HTMLDivElement>();

  return (
    <FullScreenLayer open>
      <div
        ref={stage.ref}
        role="dialog"
        aria-modal="true"
        aria-label={entry.name}
        className="fixed inset-0 z-[150] flex flex-col bg-[#08080a]"
        style={{ height: "100dvh" }}
      >
        <div
          className="flex shrink-0 items-center gap-2 border-b border-white/[0.06] bg-black/70 px-3 py-2"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.5rem)" }}
        >
          <GameIcon icon={entry.icon} size={24} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-white">{entry.name}</span>
            <span className="flex items-center gap-1.5 truncate text-[11px] text-white/60">
              <Zap className="h-3 w-3 text-primary" />
              Instant play · no sign-up · {entry.players}{" "}
              {entry.players === "1" ? "player" : "players"}
            </span>
          </span>
          {stage.supported && (
            <button
              type="button"
              onClick={stage.toggle}
              aria-label={stage.isFullscreen ? "Leave fullscreen" : "Play fullscreen"}
              title={stage.isFullscreen ? "Leave fullscreen" : "Play fullscreen"}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-black/50 text-white/70 transition hover:text-white"
            >
              {stage.isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close game"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-black/50 text-white/70 transition hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {stage.error && (
          <p
            role="alert"
            className="shrink-0 bg-destructive/20 px-3 py-1.5 text-[11px] text-destructive-foreground"
          >
            {stage.error}
          </p>
        )}

        <div data-rizz-game-surface className="relative min-h-0 flex-1">
          <GameStage entry={entry} players={1} fullscreen className="absolute inset-0" />
        </div>
      </div>
    </FullScreenLayer>
  );
}
