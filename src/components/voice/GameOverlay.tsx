import { useEffect, useRef, useState } from "react";
import { Check, Copy, Maximize2, Mic, MicOff, Minimize2, MonitorPlay, Pause, Play, Radio, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { useAuth } from "@/lib/auth";
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
 * provider. It renders only the session *this* user launched or joined, so
 * Jimmy's game never hijacks Bob's screen. Pause / room code / stop apply to
 * that session; each person can minimize it to a floating pill or take it
 * fullscreen / rotate it themselves.
 */
export function GameOverlayHost() {
  const voice = useVoiceCallContext();
  const { user } = useAuth();
  const channelId = voice?.call?.channelId ?? null;
  const selfName =
    voice?.participants.find((participant) => participant.user_id === user?.id)?.user?.display_name ||
    voice?.participants.find((participant) => participant.user_id === user?.id)?.user?.username ||
    undefined;
  const gameBot = useGameBot(channelId, true, selfName);
  const { state: bot, pause, resume, stop } = gameBot;
  const overlay = useGameOverlayUI();
  const isHost = gameBot.isHost;
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeDraft, setCodeDraft] = useState(bot.roomCode ?? "");
  const [linkDraft, setLinkDraft] = useState(bot.joinUrl ?? "");
  const [copied, setCopied] = useState(false);
  const lastLaunchRef = useRef<number | null>(null);

  const launchedAt = bot.launchedAt;
  // Only my own launch pops the overlay. Other people's games show up as Join
  // cards in the call instead of hijacking everyone's screen.
  useEffect(() => {
    if (!launchedAt || lastLaunchRef.current === launchedAt) return;
    lastLaunchRef.current = launchedAt;
    if (bot.launchedBy === user?.id) overlay.expand();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [launchedAt, bot.launchedBy, user?.id]);

  useEffect(() => {
    setCodeDraft(bot.roomCode ?? "");
    setLinkDraft(bot.joinUrl ?? "");
    setCodeOpen(false);
  }, [bot.sessionId, bot.roomCode, bot.joinUrl]);

  /** Stopping a game must not leave a stream pointed at an empty surface. */
  const finishSession = () => {
    if (voice.sharingScreen && voice.shareMode === "game") voice.toggleScreenShare();
    stop();
    toast.success(isHost ? "Your game stopped" : "Left that game");
  };

  const copyRoomCode = async () => {
    if (!bot.roomCode) return;
    try {
      await navigator.clipboard.writeText(bot.roomCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
      toast.success("Room code copied");
    } catch {
      toast.error("Couldn't copy the room code");
    }
  };

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
          onClick={finishSession}
          aria-label={isHost ? "Stop your game" : "Leave this game"}
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
            {isHost ? "YOUR GAME" : `${bot.hostName ?? "SOMEONE"}'S GAME`} ·{" "}
            {paused ? "Paused" : "Playing"} · {voice.call.channelName}
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

        <button
          type="button"
          onClick={() =>
            voice.sharingScreen && voice.shareMode === "game"
              ? voice.toggleScreenShare()
              : voice.startGameShare()
          }
          disabled={!voice.screenSupported}
          aria-label={
            voice.sharingScreen && voice.shareMode === "game"
              ? "Stop game stream"
              : "Stream only this game"
          }
          title={
            voice.sharingScreen && voice.shareMode === "game"
              ? "Stop streaming the game"
              : "Stream only the game, not your screen or desktop"
          }
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition-colors disabled:opacity-40 ${
            voice.sharingScreen && voice.shareMode === "game"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
          }`}
        >
          {voice.sharingScreen && voice.shareMode === "game" ? (
            <Radio className="h-4 w-4" />
          ) : (
            <MonitorPlay className="h-4 w-4" />
          )}
        </button>

        {isHost ? (
          paused ? (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                resume();
                toast.success("Your game resumed");
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
                toast.success("Your game paused");
              }}
              className="h-10 shrink-0 gap-1.5 border-primary/30 bg-primary/10 text-primary"
            >
              <Pause className="h-4 w-4" /> Pause
            </Button>
          )
        ) : (
          <span className="hidden shrink-0 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary sm:block">
            Joined
          </span>
        )}

        <button
          type="button"
          onClick={() => {
            // Region Capture films the game element itself; hiding it would
            // stream a black rectangle, so minimizing ends the stream first.
            if (voice.sharingScreen && voice.shareMode === "game") voice.toggleScreenShare();
            overlay.minimize();
          }}
          aria-label="Minimize game overlay"
          title="Minimize"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <Minimize2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={finishSession}
          aria-label={isHost ? "Stop your game" : "Leave this game"}
          title={isHost ? "Stop your game" : "Leave (the host keeps playing)"}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-destructive/40 bg-destructive/10 text-destructive transition-colors hover:bg-destructive/20"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {(isHost || bot.roomCode) && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/5 bg-black/20 px-3 py-1.5 text-[11px]">
          <span className="text-muted-foreground">Team / room code</span>
          {isHost ? (
            <button
              type="button"
              onClick={() => setCodeOpen((open) => !open)}
              className="rounded-lg border border-primary/40 bg-primary/10 px-2 py-1 font-mono font-bold tracking-widest text-primary"
            >
              {bot.roomCode || "Add code"}
            </button>
          ) : (
            <span className="rounded-lg border border-primary/40 bg-primary/10 px-2 py-1 font-mono font-bold tracking-widest text-primary">
              {bot.roomCode}
            </span>
          )}
          {bot.roomCode && (
            <button
              type="button"
              onClick={() => void copyRoomCode()}
              aria-label="Copy room code"
              className="flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-muted-foreground hover:text-foreground"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          )}
          {!isHost && bot.joinUrl && (
            <span className="text-primary">Opening the host&apos;s invite link</span>
          )}
          {isHost && (
            <span className="text-muted-foreground">
              Joiners see this code, so they can enter the same team on the game site.
            </span>
          )}
        </div>
      )}

      {codeOpen && isHost && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            gameBot.setRoomCode(codeDraft);
            gameBot.setJoinUrl(linkDraft);
            setCodeOpen(false);
            toast.success(
              codeDraft.trim() || linkDraft.trim()
                ? "Team details shared with joiners"
                : "Team details cleared",
            );
          }}
          className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/5 bg-black/30 px-3 py-2"
        >
          <input
            autoFocus
            value={codeDraft}
            onChange={(event) => setCodeDraft(event.target.value)}
            maxLength={24}
            placeholder="Room / team code"
            className="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <input
            value={linkDraft}
            onChange={(event) => setLinkDraft(event.target.value)}
            maxLength={500}
            inputMode="url"
            placeholder="Invite link (optional) — joiners open it directly"
            className="h-9 min-w-[220px] flex-1 rounded-lg border border-white/10 bg-black/40 px-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <Button type="submit" size="sm" className="h-9 bg-primary font-bold text-primary-foreground">
            Share code
          </Button>
        </form>
      )}

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
