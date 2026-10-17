import { useEffect, useState } from "react";
import { Maximize2, Mic, MicOff, Minimize2, Pause, Play, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { useVoiceCallContext } from "@/components/voice/VoiceCallProvider";
import { useGameBot, useGameOverlayUI } from "@/lib/game-bot";
import { RizzBrowserView } from "@/components/voice/RizzBrowserView";

/** Real game logo with an emoji fallback. */
function Logo({ icon, emoji, size = "h-9 w-9" }: { icon?: string; emoji?: string; size?: string }) {
  const [broken, setBroken] = useState(false);
  const isUrl = !!icon && /^https?:\/\//i.test(icon);
  return (
    <span
      className={`grid ${size} shrink-0 place-items-center overflow-hidden rounded-xl border border-primary/30 bg-primary/15`}
    >
      {isUrl && !broken ? (
        <img src={icon} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <span className="text-lg leading-none">{emoji ?? "🎮"}</span>
      )}
    </span>
  );
}

/**
 * GAME BOT overlay host — mounted once at the app root, inside the voice call
 * provider. While you are in a call and a game is live on `vc-game-bot:<room>`,
 * the game is played as an overlay over the app (Discord-activities style):
 * everyone in the channel sees the same session, pause / resume / stop stay in
 * sync, and each person can minimize it to a floating pill or take it
 * fullscreen / rotate it themselves.
 */
export function GameOverlayHost() {
  const voice = useVoiceCallContext();
  const channelId = voice?.call?.channelId ?? null;
  const { state: bot, pause, resume, stop } = useGameBot(channelId);
  const overlay = useGameOverlayUI();

  const launchedAt = bot.launchedAt;
  // A new launch (or resume after someone relaunched) pops the overlay open.
  useEffect(() => {
    if (launchedAt) overlay.expand();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [launchedAt]);

  if (!voice?.call || !channelId || !bot.activeGame) return null;

  const game = bot.activeGame;
  const paused = bot.isPaused;
  const inCall = voice.participants.length;

  return (
    <>
      {overlay.minimized && (
        <div
          className="fixed right-3 z-[150] flex items-center gap-2.5 rounded-2xl border border-primary/40 bg-[#0d0d10]/95 p-2.5 pr-3 shadow-2xl backdrop-blur"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)" }}
        >
        <Logo icon={game.icon} emoji={game.emoji} size="h-8 w-8" />
        <span className="min-w-0">
          <span className="block max-w-[9rem] truncate font-display text-xs font-bold">{game.name}</span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className={`h-1.5 w-1.5 rounded-full ${paused ? "bg-amber-300" : "bg-primary"}`} />
            {paused ? "Paused" : "Playing"} · GAME BOT
          </span>
        </span>
        <button
          type="button"
          onClick={() => overlay.expand()}
          aria-label="Expand game overlay"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary transition-colors hover:bg-primary/25"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            stop();
            toast.success("GAME BOT stopped");
          }}
          aria-label="Stop game"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-destructive/15 text-destructive transition-colors hover:bg-destructive/25"
        >
          <X className="h-4 w-4" />
        </button>
        </div>
      )}

      {/* Expanded stage stays mounted (hidden when minimized) so the game
          session survives minimize / expand. */}
      <div
        className={`fixed inset-0 z-[150] bg-[#0b0714] ${
          overlay.minimized ? "hidden" : "flex flex-col"
        }`}
      >
      {/* GAME BOT header — lime, RIZZ type, voice controls kept reachable */}
      <div className="flex shrink-0 items-center gap-2.5 border-b border-primary/20 px-3 py-2.5 sm:px-4">
        <Logo icon={game.icon} emoji={game.emoji} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-bold tracking-tight text-[#f2efe6]">
            {game.name}
          </p>
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={`h-1.5 w-1.5 rounded-full ${paused ? "bg-amber-300" : "bg-primary"}`} />
            GAME BOT · {paused ? "Paused" : "Playing"} · {voice.call.channelName}
            <span className="inline-flex items-center gap-0.5">
              <Users className="h-3 w-3" /> {inCall}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => voice.toggleMute()}
          aria-label={voice.muted ? "Unmute" : "Mute"}
          title={voice.muted ? "Unmute" : "Mute"}
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition-colors ${
            voice.muted
              ? "border-destructive/40 bg-destructive/15 text-destructive"
              : "border-white/10 bg-white/5 text-muted-foreground hover:text-foreground"
          }`}
        >
          {voice.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>

        {paused ? (
          <Button
            type="button"
            size="sm"
            onClick={() => {
              resume();
              toast.success("Game resumed for everyone");
            }}
            className="h-10 shrink-0 gap-1.5 bg-primary font-bold text-primary-foreground"
          >
            <Play className="h-4 w-4" /> Resume
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              pause();
              toast.success("Game paused for everyone");
            }}
            className="h-10 shrink-0 gap-1.5 border-primary/30 bg-primary/10 text-primary"
          >
            <Pause className="h-4 w-4" /> Pause
          </Button>
        )}

        <button
          type="button"
          onClick={() => overlay.minimize()}
          aria-label="Minimize game overlay"
          title="Minimize"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <Minimize2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            stop();
            toast.success("GAME BOT stopped");
          }}
          aria-label="Stop game for everyone"
          title="Stop"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-destructive/40 bg-destructive/10 text-destructive transition-colors hover:bg-destructive/20"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* The game itself */}
      <div className="min-h-0 flex-1 p-2 sm:p-3">
        <RizzBrowserView
          key={`${game.id}-${launchedAt ?? 0}`}
          title={game.name}
          icon={game.icon}
          url={game.url}
          paused={paused}
          onReload={() => toast.success("Reloading game…")}
        />
      </div>
      </div>
    </>
  );
}
