import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Gamepad2, Maximize2, Minimize2, Pause, Play, RotateCw, Search, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useVoiceCallContext } from "@/components/voice/VoiceCallProvider";
import {
  GAME_BOT_CHANNEL,
  GAME_CATEGORIES,
  GAME_LIBRARY,
  type GameBotState,
  type GameEntry,
} from "@/lib/game-library";
import { RizzBrowserView } from "@/components/voice/RizzBrowserView";

type RealmGamesHubProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  realmId: string;
  roomId: string;
  roomName?: string;
};

/**
 * Dedicated Games menu for a realm voice channel.
 *
 * Opened from the game icon in the realm voice bar AND from the VC header, so
 * both entry points land on the same hub. Choosing a game launches it into the
 * shared GAME BOT (`vc-game-bot:<roomId>`): pause / resume / stop sync to
 * everyone in the channel, and the game itself renders in the RIZZ browser
 * (cat mark + lime loader) so it feels native.
 */
export function RealmGamesHub({ open, onOpenChange, realmId, roomId, roomName }: RealmGamesHubProps) {
  const { user } = useAuth();
  const voice = useVoiceCallContext();

  const [category, setCategory] = useState<"all" | GameEntry["category"]>("all");
  const [query, setQuery] = useState("");
  const [bot, setBot] = useState<GameBotState>({
    activeGame: null,
    isPlaying: false,
    isPaused: false,
    launchedAt: null,
    launchedBy: null,
  });
  const [fullscreen, setFullscreen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const inThisCall = voice?.call?.channelId === roomId;
  const joining = voice?.busy ?? false;

  // Shared GAME BOT state — same realtime channel the VC GameLauncher uses, so
  // launching from the realm or from inside the call stays in sync.
  useEffect(() => {
    if (!open || !roomId || !user) return;
    const channel = supabase.channel(GAME_BOT_CHANNEL(roomId));
    channelRef.current = channel;
    channel
      .on("broadcast", { event: "game-bot-state" }, ({ payload }) => {
        if (payload?.userId === user.id) return;
        const s = payload?.state;
        if (!s) return;
        setBot({
          activeGame: (s.activeGame as GameEntry | null) ?? null,
          isPlaying: !!s.isPlaying && !s.isPaused,
          isPaused: !!s.isPaused,
          launchedAt: (s.launchedAt as number | null) ?? null,
          launchedBy: (s.launchedBy as string | null) ?? null,
        });
        if (s.activeGame == null) setFullscreen(false);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [open, roomId, user]);

  const broadcast = (next: GameBotState) => {
    if (!channelRef.current || !user) return;
    channelRef.current.send({
      type: "broadcast",
      event: "game-bot-state",
      payload: { userId: user.id, state: next },
    });
  };

  const launch = (game: GameEntry) => {
    if (!user) return;
    const next: GameBotState = {
      activeGame: game,
      isPlaying: true,
      isPaused: false,
      launchedAt: Date.now(),
      launchedBy: user.id,
    };
    setBot(next);
    setFullscreen(false);
    setReloadKey((k) => k + 1);
    broadcast(next);
    toast.success(`Launched ${game.name} in GAME BOT`);
  };

  const pause = () => {
    const next: GameBotState = { ...bot, isPlaying: false, isPaused: true };
    setBot(next);
    broadcast(next);
    toast.success("Game paused for everyone");
  };

  const resume = () => {
    if (!bot.activeGame) return;
    const next: GameBotState = { ...bot, isPlaying: true, isPaused: false };
    setBot(next);
    setReloadKey((k) => k + 1);
    broadcast(next);
    toast.success("Game resumed");
  };

  const stop = () => {
    const next: GameBotState = {
      activeGame: null,
      isPlaying: false,
      isPaused: false,
      launchedAt: null,
      launchedBy: null,
    };
    setBot(next);
    setFullscreen(false);
    broadcast(next);
    toast.success("GAME BOT stopped");
  };

  const reload = () => {
    setReloadKey((k) => k + 1);
    toast.success("Reloading game…");
  };

  const filtered = useMemo(
    () =>
      GAME_LIBRARY.filter((g) => {
        const okCat = category === "all" || g.category === category;
        const q = query.trim().toLowerCase();
        const okQ =
          !q ||
          g.name.toLowerCase().includes(q) ||
          g.description.toLowerCase().includes(q) ||
          g.players.includes(q);
        return okCat && okQ;
      }),
    [category, query],
  );

  return (
    <>
      <Sheet open={open && !fullscreen} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[88dvh] overflow-y-auto rounded-t-3xl border-white/10 bg-[#0b0714] px-4 pb-[max(env(safe-area-inset-bottom),1rem)]"
        >
          <SheetHeader className="pb-3 pt-2 text-left">
            <SheetTitle className="flex items-center gap-2 font-display text-2xl">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary">
                <Gamepad2 className="h-5 w-5" />
              </span>
              Games
              {roomName && (
                <span className="ml-1 truncate text-xs font-normal text-muted-foreground">
                  · {roomName}
                </span>
              )}
            </SheetTitle>
            <p className="text-xs text-muted-foreground">
              Pick a game — it launches into GAME BOT for everyone in this voice channel, with
              pause / resume in sync.
            </p>
          </SheetHeader>

          {/* Join prompt when browsing from the realm without being in the call */}
          {!inThisCall && (
            <div className="mb-4 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/[0.07] p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">Play together in voice</p>
                <p className="text-xs text-muted-foreground">
                  Join the channel so pause, resume and the game state stay in sync for everyone.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={joining || !voice}
                onClick={() =>
                  voice?.joinChannel({ id: roomId, realmId, name: roomName ?? "Voice channel" })
                }
                className="h-10 shrink-0 gap-2 bg-primary px-4 text-primary-foreground"
              >
                <Play className="h-4 w-4" /> {joining ? "Joining…" : "Join VC"}
              </Button>
            </div>
          )}

          {/* Active GAME BOT */}
          {bot.activeGame && (
            <div className="mb-4 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.12] to-primary/[0.05] p-4">
              <div className="mb-3 flex items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-white/10 bg-black/40 text-2xl">
                  {bot.activeGame.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{bot.activeGame.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {bot.isPaused ? "⏸ Paused" : bot.isPlaying ? "▶ Playing now" : "Ready"} ·{" "}
                    {bot.activeGame.players} players
                  </p>
                </div>
                {bot.isPaused ? (
                  <Button
                    type="button"
                    size="icon"
                    onClick={resume}
                    aria-label="Resume game"
                    className="h-11 w-11 shrink-0 rounded-full bg-primary text-primary-foreground"
                  >
                    <Play className="h-5 w-5" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="icon"
                    onClick={pause}
                    aria-label="Pause game"
                    className="h-11 w-11 shrink-0 rounded-full bg-primary text-primary-foreground"
                  >
                    <Pause className="h-5 w-5" />
                  </Button>
                )}
              </div>

              <div className="mb-3 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setFullscreen(true)}
                  className="h-9 flex-1 gap-1.5 border-white/10 bg-white/5 text-xs"
                >
                  <Maximize2 className="h-3.5 w-3.5" /> Fullscreen
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={reload}
                  className="h-9 flex-1 gap-1.5 border-white/10 bg-white/5 text-xs"
                >
                  <RotateCw className="h-3.5 w-3.5" /> Reload
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    bot.activeGame &&
                    window.open(bot.activeGame.url, "_blank", "noopener,noreferrer")
                  }
                  className="h-9 flex-1 gap-1.5 border-white/10 bg-white/5 text-xs"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> New tab
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={stop}
                  className="h-9 gap-1.5 border-destructive/30 bg-destructive/10 text-xs text-destructive hover:bg-destructive/20"
                >
                  <X className="h-3.5 w-3.5" /> Stop
                </Button>
              </div>

              <div key={reloadKey}>
                <RizzBrowserView
                  title={bot.activeGame.name}
                  icon={bot.activeGame.icon}
                  url={bot.activeGame.url}
                  paused={bot.isPaused}
                  onReload={reload}
                  compact
                />
              </div>
            </div>
          )}

          {/* Search */}
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search games…"
              aria-label="Search games"
              className="glass h-11 border-white/10 pl-9"
            />
          </div>

          {/* Categories */}
          <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
            {GAME_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  category === c.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-white/5 text-muted-foreground hover:bg-white/10"
                }`}
              >
                <span className="mr-1.5">{c.icon}</span>
                {c.name}
              </button>
            ))}
          </div>

          {/* Grid */}
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {filtered.length} games · tap to launch in GAME BOT
          </p>
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((g) => {
              const active = bot.activeGame?.id === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => launch(g)}
                  className={`relative rounded-2xl border bg-gradient-to-br p-4 text-left transition-all active:scale-[0.98] ${g.borderColor} ${g.color} ${
                    active ? "ring-2 ring-primary/50" : "hover:ring-2 hover:ring-primary/20"
                  }`}
                >
                  {active && (
                    <span className="absolute right-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-foreground">
                      {bot.isPaused ? "Paused" : "Live"}
                    </span>
                  )}
                  <span className="text-4xl">{g.icon}</span>
                  <p className="mt-2 text-sm font-bold">{g.name}</p>
                  <p className="text-[10px] text-muted-foreground">{g.players} players</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/80">
                    {g.description}
                  </p>
                </button>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No games match “{query}”.
            </p>
          )}
        </SheetContent>
      </Sheet>

      {/* Fullscreen GAME BOT stage */}
      {fullscreen && bot.activeGame && (
        <div className="fixed inset-0 z-[140] flex flex-col bg-[#0b0714]">
          <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-xl">
              {bot.activeGame.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-base font-bold">{bot.activeGame.name}</p>
              <p className="text-[11px] text-muted-foreground">
                GAME BOT · {bot.isPaused ? "Paused" : "Playing"} · {roomName ?? "Voice channel"}
              </p>
            </div>
            {bot.isPaused ? (
              <Button type="button" size="sm" onClick={resume} className="h-10 gap-2 bg-primary">
                <Play className="h-4 w-4" /> Resume
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={pause}
                className="h-10 gap-2 border-white/10"
              >
                <Pause className="h-4 w-4" /> Pause
              </Button>
            )}
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => setFullscreen(false)}
              aria-label="Exit fullscreen"
              className="h-10 w-10 shrink-0 border-white/10"
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div key={`fs-${reloadKey}`}>
              <RizzBrowserView
                title={bot.activeGame.name}
                icon={bot.activeGame.icon}
                url={bot.activeGame.url}
                paused={bot.isPaused}
                onReload={reload}
              />
            </div>
            <div className="mx-auto mt-3 flex max-w-lg gap-2 pb-[max(env(safe-area-inset-bottom),1rem)]">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={reload}
                className="h-10 flex-1 gap-2 border-white/10"
              >
                <RotateCw className="h-4 w-4" /> Reload
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  bot.activeGame &&
                  window.open(bot.activeGame.url, "_blank", "noopener,noreferrer")
                }
                className="h-10 flex-1 gap-2 border-white/10"
              >
                <ExternalLink className="h-4 w-4" /> New tab
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={stop}
                className="h-10 flex-1 gap-2 border-destructive/30 text-destructive"
              >
                <X className="h-4 w-4" /> Stop
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
