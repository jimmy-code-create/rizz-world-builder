import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ExternalLink, Gamepad2, Pause, Play, RotateCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";
import { useVoiceCallContext } from "@/components/voice/VoiceCallProvider";
import { useGameBot } from "@/lib/game-bot";
import { GAME_CATEGORIES, GAME_LIBRARY, type GameEntry } from "@/lib/game-library";
import { RizzBrowserView } from "@/components/voice/RizzBrowserView";

export const Route = createFileRoute("/_app/games")({
  head: () => ({ meta: [{ title: "Games · RIZZ" }] }),
  component: GamesPage,
});

/**
 * The Games section: ready-made, embeddable titles that open in the RIZZ
 * browser with Discord-style fullscreen. In a call, picking a game also
 * launches it into the shared GAME BOT so the whole channel can watch and
 * play together — pause / resume stay in sync.
 */
function GamesPage() {
  const { call, openView } = useVoiceCallContext();
  const gameBot = useGameBot(call?.channelId ?? null, !!call?.channelId);
  const { state: bot } = gameBot;

  const [category, setCategory] = useState<"all" | GameEntry["category"]>("all");
  const [query, setQuery] = useState("");
  const [localGame, setLocalGame] = useState<GameEntry | null>(null);
  const [stageOpen, setStageOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const inCall = !!call?.channelId;
  // In a call the shared GAME BOT is the source of truth; solo play is local.
  const stageGame = inCall ? bot.activeGame : localGame;
  const stagePaused = inCall ? bot.isPaused : false;

  const play = (game: GameEntry) => {
    setLocalGame(game);
    setStageOpen(true);
    setReloadKey((k) => k + 1);
    if (inCall) {
      gameBot.launch(game);
      toast.success(`${game.name} launched in GAME BOT`, {
        description: `Everyone in ${call?.channelName} can watch and play.`,
      });
    }
  };

  const stop = () => {
    if (inCall) gameBot.stop();
    setLocalGame(null);
    setStageOpen(false);
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
    <div className="mx-auto w-full max-w-3xl px-3 py-3 sm:px-4 md:py-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8A8A8E]">Activities</p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight text-[#f2efe6]">Games</h1>
        {call ? (
          <button
            type="button"
            onClick={openView}
            className="shrink-0 rounded-full border border-[#c8ff3d]/40 bg-[#c8ff3d]/10 px-3 py-1 text-xs font-bold text-[#c8ff3d]"
          >
            In call · {call.channelName}
          </button>
        ) : (
          <span className="shrink-0 rounded-full border border-[#2E2E32] px-3 py-1 text-xs font-semibold text-muted-foreground">
            No call
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {inCall
          ? "Ready-made games — tap one to launch it in GAME BOT for everyone, with Discord-style fullscreen."
          : "Ready-made games — tap one to play it right here in the RIZZ browser with fullscreen."}
      </p>

      {/* Search */}
      <div className="relative mt-3">
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
      <div className="no-scrollbar -mx-3 mt-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:-mx-4 sm:px-4">
        {GAME_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              category === c.id
                ? "bg-[#c8ff3d] text-[#0b0b0c]"
                : "bg-white/5 text-muted-foreground hover:bg-white/10"
            }`}
          >
            <span className="mr-1.5">{c.icon}</span>
            {c.name}
          </button>
        ))}
      </div>

      {/* Grid */}
      <p className="mb-2 mt-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {filtered.length} games · {inCall ? "launch into GAME BOT" : "play in RIZZ browser"}
      </p>
      <div className="grid grid-cols-2 gap-3">
        {filtered.map((g) => {
          const active = stageGame?.id === g.id && stageOpen;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => play(g)}
              className={`relative rounded-2xl border bg-gradient-to-br p-4 text-left transition-all active:scale-[0.98] ${g.borderColor} ${g.color} ${
                active ? "ring-2 ring-[#c8ff3d]/60" : "hover:ring-2 hover:ring-[#c8ff3d]/25"
              }`}
            >
              {active && (
                <span className="absolute right-2 top-2 rounded-full bg-[#c8ff3d] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#0b0b0c]">
                  {stagePaused ? "Paused" : "Live"}
                </span>
              )}
              <span className="text-4xl">{g.icon}</span>
              <p className="mt-2 text-sm font-bold text-[#f2efe6]">{g.name}</p>
              <p className="text-[10px] text-muted-foreground">{g.players} players</p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/80">{g.description}</p>
            </button>
          );
        })}
      </div>
      {filtered.length === 0 && (
        <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center text-sm text-muted-foreground">
          No games match “{query}”.
        </p>
      )}

      <Link
        to="/bots/developer"
        className="mt-3 flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-white/10 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <Gamepad2 className="h-4 w-4" /> Build your own? See developer tools
      </Link>

      {/* Fullscreen stage (Discord-style takeover) */}
      {stageOpen && stageGame && (
        <div className="fixed inset-0 z-[140] flex flex-col bg-[#0b0714]">
          <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-xl">
              {stageGame.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-base font-bold text-[#f2efe6]">
                {stageGame.name}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {inCall
                  ? `GAME BOT · ${stagePaused ? "Paused" : "Playing"} · ${call?.channelName}`
                  : "RIZZ browser · solo"}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={reload}
              aria-label="Reload game"
              className="h-10 w-10 shrink-0 border-white/10 p-0"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
            {inCall ? (
              stagePaused ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => gameBot.resume()}
                  className="h-10 gap-2 bg-primary text-primary-foreground"
                >
                  <Play className="h-4 w-4" /> Resume
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => gameBot.pause()}
                  className="h-10 gap-2 border-white/10"
                >
                  <Pause className="h-4 w-4" /> Pause
                </Button>
              )
            ) : null}
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={stop}
              aria-label="Close game"
              className="h-10 w-10 shrink-0 border-white/10"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div key={reloadKey}>
              <RizzBrowserView
                title={stageGame.name}
                icon={stageGame.icon}
                url={stageGame.url}
                paused={stagePaused}
                onReload={reload}
              />
            </div>
            <div className="mx-auto mt-3 flex max-w-lg gap-2 pb-[max(env(safe-area-inset-bottom),1rem)]">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => window.open(stageGame.url, "_blank", "noopener,noreferrer")}
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
                <X className="h-4 w-4" /> Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
