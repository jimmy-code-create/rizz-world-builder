import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Gamepad2, Mic, Pause, Play, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";
import { useVoiceCallContext } from "@/components/voice/VoiceCallProvider";
import { useGameBot, useGameOverlayUI } from "@/lib/game-bot";
import { GAME_CATEGORIES, GAME_LIBRARY, type GameEntry } from "@/lib/game-library";

export const Route = createFileRoute("/_app/games")({
  head: () => ({ meta: [{ title: "Games · RIZZ" }] }),
  component: GamesPage,
});

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
 * The Games section — ready-made, embeddable titles with real cover art.
 *
 * Games play with voice, like the music bot: while you are in a call, tapping a
 * game launches it into GAME BOT and it opens as an overlay for everyone in the
 * channel (pause / resume / fullscreen / rotate in sync). Outside a call the
 * cards point you to a voice channel first.
 */
function GamesPage() {
  const { call, openView } = useVoiceCallContext();
  const gameBot = useGameBot(call?.channelId ?? null, !!call?.channelId);
  const overlay = useGameOverlayUI();
  const bot = gameBot.state;

  const [category, setCategory] = useState<"all" | GameEntry["category"]>("all");
  const [query, setQuery] = useState("");

  const inCall = !!call;

  const play = (game: GameEntry) => {
    if (!inCall) {
      toast.error("Games play in voice — join a call first", {
        description: "Open a realm's voice channel, then launch from here or the Games menu.",
      });
      return;
    }
    gameBot.launch(game);
    overlay.expand();
    toast.success(`${game.name} launched in GAME BOT`, {
      description: `An overlay just popped for everyone in ${call?.channelName}.`,
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
    <div className="mx-auto w-full max-w-3xl px-3 py-3 sm:px-4 md:py-4">
      <p className="font-display text-[11px] font-bold uppercase tracking-[0.08em] text-primary/80">
        Activities
      </p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight text-[#f2efe6]">Games</h1>
        {call ? (
          <button
            type="button"
            onClick={openView}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 font-display text-xs font-bold text-primary transition-colors hover:bg-primary/20"
          >
            <Mic className="h-3 w-3" /> In call · {call.channelName}
            <span className="inline-flex items-center gap-0.5 text-primary/80">
              <Users className="h-3 w-3" />
            </span>
          </button>
        ) : (
          <span className="shrink-0 rounded-full border border-white/10 px-3 py-1.5 font-display text-xs font-semibold text-muted-foreground">
            Not in call
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {inCall
          ? "Tap a game — it launches in GAME BOT and plays as an overlay for everyone in the call."
          : "Games play together in voice. Join a voice channel in a realm, then launch anything here."}
      </p>

      {!inCall && (
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/[0.07] p-3">
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-bold">Start with voice</p>
            <p className="text-xs text-muted-foreground">
              GAME BOT runs inside the call so everyone lands in the same session — same as MUSIC BOT.
            </p>
          </div>
          <Link
            to="/realms"
            className="grid h-10 shrink-0 place-items-center gap-2 rounded-xl bg-primary px-4 font-display text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Open Realms
          </Link>
        </div>
      )}

      {/* Active GAME BOT */}
      {bot.activeGame && inCall && (
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/[0.14] to-primary/[0.05] p-3">
          <Logo icon={bot.activeGame.icon} emoji={bot.activeGame.emoji} size="h-11 w-11" text="text-xl" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-bold">{bot.activeGame.name}</p>
            <p className="text-xs text-muted-foreground">
              <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle ${bot.isPaused ? "bg-amber-300" : "bg-primary"}`} />
              {bot.isPaused ? "Paused" : "Playing"} · GAME BOT
            </p>
          </div>
          {bot.isPaused ? (
            <Button
              type="button"
              size="sm"
              onClick={() => gameBot.resume()}
              className="h-10 shrink-0 gap-1.5 bg-primary font-bold text-primary-foreground"
            >
              <Play className="h-4 w-4" /> Resume
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => gameBot.pause()}
              className="h-10 shrink-0 gap-1.5 border-primary/30 bg-primary/10 font-bold text-primary"
            >
              <Pause className="h-4 w-4" /> Pause
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={() => overlay.expand()}
            className="h-10 shrink-0 bg-primary/15 font-semibold text-primary hover:bg-primary/25"
          >
            Show
          </Button>
        </div>
      )}

      {/* Search */}
      <div className="relative mt-3">
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
      <div className="no-scrollbar -mx-3 mt-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:-mx-4 sm:px-4">
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
      <p className="mb-2 mt-3 text-[11px] font-bold uppercase tracking-wider text-primary/80">
        {filtered.length} games · {inCall ? "launch in GAME BOT" : "join voice to play"}
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
              <div className="relative h-24 w-full overflow-hidden sm:h-28">
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
                <p className="truncate font-display text-sm font-bold tracking-tight text-[#f2efe6]">
                  {g.name}
                </p>
                <p className="text-[10px] font-semibold text-primary/80">{g.players} players</p>
                <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground/80">{g.description}</p>
              </div>
            </button>
          );
        })}
      </div>
      {filtered.length === 0 && (
        <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center font-display text-sm text-muted-foreground">
          No games match “{query}”.
        </p>
      )}

      <Link
        to="/bots/developer"
        className="mt-3 flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-white/10 font-display text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <Gamepad2 className="h-4 w-4" /> Build your own? See developer tools
      </Link>
    </div>
  );
}
