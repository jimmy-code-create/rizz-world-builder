import { useMemo, useState } from "react";
import { Gamepad2, Play, Search, X, Pause } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";
import { useVoiceCallContext } from "@/components/voice/VoiceCallProvider";
import { useAuth } from "@/lib/auth";
import { useGameBot, useGameOverlayUI } from "@/lib/game-bot";
import { GAME_CATEGORIES, GAME_LIBRARY, type GameEntry } from "@/lib/game-library";

type RealmGamesHubProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  realmId: string;
  roomId: string;
  roomName?: string;
};

/** Real game logo (URL) with an emoji fallback. */
function Logo({ icon, emoji, size = "h-7 w-7", text = "text-base" }: { icon?: string; emoji?: string; size?: string; text?: string }) {
  const [broken, setBroken] = useState(false);
  const isUrl = !!icon && /^https?:\/\//i.test(icon);
  return (
    <span className={`grid ${size} shrink-0 place-items-center overflow-hidden rounded-lg border border-primary/25 bg-primary/15`}>
      {isUrl && !broken ? (
        <img src={icon} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <span className={`${text} leading-none`}>{emoji ?? "🎮"}</span>
      )}
    </span>
  );
}

/**
 * The Games menu — one catalog shared by the realm voice bar, the VC view and
 * (via the same GAME BOT store) the Games page.
 *
 * Games play as an overlay while you are in the voice call: tapping one starts
 * *your* GAME BOT session. Everyone else sees it as a Join game card in the VC
 * and can open the same game (and invite link) without replacing their own.
 */
export function RealmGamesHub({ open, onOpenChange, realmId, roomId, roomName }: RealmGamesHubProps) {
  const voice = useVoiceCallContext();
  const { user } = useAuth();
  const selfName =
    voice?.participants.find((participant) => participant.user_id === user?.id)?.user?.display_name ||
    voice?.participants.find((participant) => participant.user_id === user?.id)?.user?.username ||
    undefined;
  const gameBot = useGameBot(roomId, open, selfName);
  const overlay = useGameOverlayUI();
  const bot = gameBot.state;

  const [category, setCategory] = useState<"all" | GameEntry["category"]>("all");
  const [query, setQuery] = useState("");

  const inThisCall = voice?.call?.channelId === roomId;
  const joining = voice?.busy ?? false;

  const play = (game: GameEntry) => {
    if (!inThisCall) {
      toast.error("Join the voice channel first", {
        description: "GAME BOT plays games with everyone in the call — like music.",
      });
      return;
    }
    gameBot.launch(game);
    overlay.expand();
    onOpenChange(false);
    toast.success(`Your ${game.name} game is live`, {
      description: `Everyone in ${roomName ?? "the call"} can press Join game on your card — they start their own copy, not yours.`,
    });
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[88dvh] overflow-y-auto rounded-t-3xl border-primary/20 bg-[#0b0714] px-4 pb-[max(env(safe-area-inset-bottom),1rem)]"
      >
        <SheetHeader className="pb-3 pt-2 text-left">
          <SheetTitle className="flex items-center gap-2 font-display text-2xl tracking-tight text-[#f2efe6]">
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
            Ready-made games that play <span className="font-semibold text-primary">as an overlay</span>{" "}
            in the call. Every person gets their own GAME BOT session — launch yours, and anyone
            can press Join game to open it with you.
          </p>
        </SheetHeader>

        {/* Join prompt when browsing from the realm without being in the call */}
        {!inThisCall && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/[0.07] p-3">
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-bold">Join voice to play</p>
              <p className="text-xs text-muted-foreground">
                GAME BOT runs inside the call so everyone plays the same session — just like MUSIC BOT.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={joining || !voice}
              onClick={() =>
                voice?.joinChannel({ id: roomId, realmId, name: roomName ?? "Voice channel" })
              }
              className="h-10 shrink-0 gap-2 bg-primary px-4 font-bold text-primary-foreground"
            >
              <Play className="h-4 w-4" /> {joining ? "Joining…" : "Join voice"}
            </Button>
          </div>
        )}

        {/* Active GAME BOT */}
        {bot.activeGame && (
          <div className="mb-4 overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.12] to-primary/[0.04]">
            {bot.activeGame.cover && (
              <div className="relative h-24 w-full overflow-hidden">
                <img
                  src={bot.activeGame.cover}
                  alt=""
                  className="game-cover-drift h-full w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0b0714] via-[#0b0714]/30 to-transparent" />
              </div>
            )}
            <div className="p-4 pt-3">
              <div className="mb-3 flex items-center gap-3">
                <Logo icon={bot.activeGame.icon} emoji={bot.activeGame.emoji} size="h-11 w-11" text="text-xl" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-bold">
                    {bot.activeGame.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle ${bot.isPaused ? "bg-amber-300" : "bg-primary"}`} />
                    {bot.isPaused ? "Paused" : "Playing"} ·{" "}
                    {gameBot.isHost ? "your game" : `${bot.hostName ?? "someone"}'s game`} ·{" "}
                    {bot.activeGame.players} players
                  </p>
                </div>
                {gameBot.isHost ? (
                  bot.isPaused ? (
                    <Button
                      type="button"
                      size="icon"
                      onClick={() => gameBot.resume()}
                      aria-label="Resume your game"
                      className="h-11 w-11 shrink-0 rounded-full bg-primary text-primary-foreground"
                    >
                      <Play className="h-5 w-5" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="icon"
                      onClick={() => gameBot.pause()}
                      aria-label="Pause your game"
                      className="h-11 w-11 shrink-0 rounded-full bg-primary text-primary-foreground"
                    >
                      <Pause className="h-5 w-5" />
                    </Button>
                  )
                ) : (
                  <span className="shrink-0 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">
                    Joined
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    overlay.expand();
                    onOpenChange(false);
                  }}
                  className="h-9 flex-1 gap-1.5 bg-primary/15 font-semibold text-primary hover:bg-primary/25"
                >
                  Show game
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (voice?.sharingScreen && voice.shareMode === "game") voice.toggleScreenShare();
                    gameBot.stop();
                    toast.success(gameBot.isHost ? "Your game stopped" : "Left that game");
                  }}
                  className="h-9 flex-1 gap-1.5 border-destructive/30 bg-destructive/10 text-xs text-destructive hover:bg-destructive/20"
                >
                  <X className="h-3.5 w-3.5" /> {gameBot.isHost ? "Stop" : "Leave"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Games other people are running right now — one tap joins their session. */}
        {gameBot.sessions.some((session) => session.hostId !== user?.id) && (
          <div className="mb-4 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-primary/80">
              Games in this call
            </p>
            {gameBot.sessions
              .filter((session) => session.hostId !== user?.id)
              .map((session) => (
                <div
                  key={session.sessionId}
                  className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2"
                >
                  <Logo icon={session.game.icon} emoji={session.game.emoji} size="h-9 w-9" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold">{session.game.name}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {session.hostName}&apos;s game
                      {session.roomCode ? ` · room ${session.roomCode}` : ""}
                    </span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      gameBot.join(session.hostId);
                      overlay.expand();
                      onOpenChange(false);
                      toast.success(`Joined ${session.hostName}'s ${session.game.name}`);
                    }}
                    className="h-9 shrink-0 gap-1 bg-primary px-3 text-xs font-bold text-primary-foreground"
                  >
                    <Play className="h-3.5 w-3.5" /> Join game
                  </Button>
                </div>
              ))}
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
            className="glass h-11 border-primary/15 pl-9 focus-visible:ring-primary/40"
          />
        </div>

        {/* Categories */}
        <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
          {GAME_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`shrink-0 rounded-full px-4 py-2 font-display text-sm font-semibold tracking-tight transition-colors ${
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
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-primary/80">
          {filtered.length} games · tap to launch your own session
        </p>
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((g) => {
            const active = bot.activeGame?.id === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => play(g)}
                className={`group relative overflow-hidden rounded-2xl border bg-[#121216] text-left transition-all active:scale-[0.98] ${
                  active ? "border-primary/70 ring-2 ring-primary/40" : "border-white/10 hover:border-primary/50"
                }`}
              >
                <div className="relative h-24 w-full overflow-hidden">
                  {g.cover ? (
                    <img
                      src={g.cover}
                      alt=""
                      loading="lazy"
                      className="game-cover-drift h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="game-cover-drift grid h-full w-full place-items-center bg-gradient-to-br from-primary/20 via-[#121216] to-primary/5">
                      <Logo icon={g.icon} emoji={g.emoji} size="h-12 w-12" text="text-2xl" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#121216] via-[#121216]/25 to-transparent" />
                  <span className="absolute bottom-1.5 left-2 grid h-7 w-7 place-items-center overflow-hidden rounded-lg border border-primary/30 bg-[#0b0714]/85">
                    <Logo icon={g.icon} emoji={g.emoji} size="h-7 w-7" />
                  </span>
                  {active && (
                    <span className="absolute right-2 top-2 rounded-full bg-primary px-2 py-0.5 font-display text-[9px] font-bold uppercase tracking-wider text-primary-foreground">
                      {bot.isPaused ? "Paused" : "Live"}
                    </span>
                  )}
                </div>
                <div className="p-3 pt-2">
                  <p className="truncate font-display text-sm font-bold tracking-tight">{g.name}</p>
                  <p className="text-[10px] font-semibold text-primary/80">{g.players} players</p>
                  <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground/80">
                    {g.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
        {filtered.length === 0 && (
          <p className="py-10 text-center font-display text-sm text-muted-foreground">
            No games match “{query}”.
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}
