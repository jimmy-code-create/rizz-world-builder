import { useEffect, useState } from "react";
import { Gamepad2, Play } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { CloseButton } from "@/components/ui/close-button";
import { Link } from "@tanstack/react-router";
import { GameIcon } from "@/components/GameIcon";
import { getGames, type GameEntry, type RoomActivity } from "@/lib/activities";

/**
 * Best-effort reachability: a no-cors fetch resolves on ANY http response
 * and only rejects on DNS/TLS/network failure, so a dead domain shows an
 * honest "Unreachable" chip instead of a mysteriously blank game.
 */
function useReachable(url: string): boolean | null {
  const [state, setState] = useState<boolean | null>(null);
  useEffect(() => {
    if (!/^https:\/\//.test(url.trim())) {
      setState(false);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8000);
    fetch(url, { mode: "no-cors", signal: controller.signal })
      .then(() => {
        if (!cancelled) setState(true);
      })
      .catch(() => {
        if (!cancelled) setState(false);
      })
      .finally(() => window.clearTimeout(timer));
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [url]);
  return state;
}

function GameRow({
  game,
  live,
  liveCount,
  onPick,
}: {
  game: GameEntry;
  live: boolean;
  liveCount: number;
  onPick: (entry: GameEntry) => void;
}) {
  const reachable = useReachable(game.url);
  return (
    <li
      className={`overflow-hidden rounded-2xl border transition-colors ${
        live ? "border-[#c8ff3d]/40 bg-[#c8ff3d]/[0.06]" : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <button
        type="button"
        onClick={() => onPick(game)}
        aria-label={`Play ${game.name}, ${game.players} players${reachable === false ? ", site unreachable" : ""}${
          live ? `, ${liveCount} playing now` : ""
        }`}
        className="flex min-h-[76px] w-full items-center gap-3 p-3 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#c8ff3d]"
      >
        <span
          aria-hidden
          className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-[#2a2a2e] bg-[#1c1c1f]"
        >
          <GameIcon icon={game.icon} size={32} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-bold text-[#f2efe6]">{game.name}</span>
            {live && liveCount > 0 ? (
              <span className="shrink-0 rounded-full bg-[#c8ff3d]/15 px-2 py-0.5 text-[10px] font-bold text-[#c8ff3d]">
                {liveCount} playing
              </span>
            ) : (
              <span className="shrink-0 rounded-full border border-[#2a2a2e] px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {game.players}
              </span>
            )}
            {reachable === false && (
              <span className="shrink-0 rounded-full border border-[#ff5d5d]/40 px-2 py-0.5 text-[10px] font-bold text-[#ff5d5d]">
                Unreachable
              </span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {game.description}
          </span>
        </span>
        <span
          aria-hidden
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#c8ff3d] text-[#0b0b0c]"
        >
          <Play className="h-4 w-4 fill-current" />
        </span>
      </button>
    </li>
  );
}

/**
 * Discord-style Activities shelf: every game in the registry, one tap to
 * launch. Phone = bottom sheet; desktop = centered card. Voice keeps
 * running — this is just a sibling sheet.
 */
export function ActivityShelf({
  open,
  onOpenChange,
  onPick,
  liveActivity,
  liveCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (entry: GameEntry) => void;
  liveActivity: RoomActivity | null;
  liveCount: number;
}) {
  const games = getGames();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        hideClose
        className="mx-auto flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-3xl border-white/10 glass-strong p-0 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] sm:max-w-sm sm:rounded-3xl sm:mb-4"
      >
        <div className="sticky top-0 z-10 shrink-0 bg-[#141416]/95 backdrop-blur">
          <div className="mx-auto mb-2 mt-2.5 h-1.5 w-10 rounded-full bg-muted-foreground/40" aria-hidden />
          <div className="flex items-center gap-3 px-4 pb-2">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#c8ff3d]/15" aria-hidden>
              <GameIcon icon=":cat_hype:" size={24} />
            </span>
            <div className="min-w-0 flex-1">
              <SheetTitle className="font-display text-lg">Activities</SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                Play together while voice keeps running.
              </SheetDescription>
            </div>
            <SheetClose asChild>
              <CloseButton />
            </SheetClose>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4">
          <Link
            to="/games"
            onClick={() => onOpenChange(false)}
            className="mb-2 flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl border border-[#c8ff3d]/30 bg-[#c8ff3d]/10 text-sm font-bold text-[#c8ff3d] transition-colors hover:bg-[#c8ff3d]/15"
          >
            <Gamepad2 className="h-4 w-4" /> Browse all games
          </Link>
          {games.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center text-sm text-muted-foreground">
              No games yet. Add one entry to <span className="font-mono text-xs">src/data/games.json</span>.
            </p>
          ) : (
            <ul className="space-y-2 pb-1">
              {games.map((game) => {
                const live = liveActivity?.gameId === game.id;
                return (
                  <GameRow
                    key={game.id}
                    game={game}
                    live={live}
                    liveCount={live ? liveCount : 0}
                    onPick={onPick}
                  />
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
