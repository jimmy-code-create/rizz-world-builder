import { useEffect, useRef } from "react";

/**
 * Local record of arcade wins.
 *
 * The built-in games keep their own state on the device (personal bests live
 * in localStorage), so the win record does too. It is what the "Game Champ"
 * badge measures, and it is honest about being device-local: the count
 * follows the browser, not the account.
 */

const WINS_KEY = "rizz:arcade:wins";

export type ArcadeWin = {
  game: string;
  at: number;
};

function readWins(): ArcadeWin[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(WINS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is ArcadeWin =>
        !!entry && typeof entry.game === "string" && Number.isFinite(entry.at),
    );
  } catch {
    return [];
  }
}

function writeWins(wins: ArcadeWin[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WINS_KEY, JSON.stringify(wins.slice(-500)));
  } catch {
    /* private mode — the record is best effort */
  }
}

/** Every recorded win, oldest first. */
export function readArcadeWins(): ArcadeWin[] {
  return readWins();
}

/** How many wins were recorded, in total or for one game. */
export function arcadeWinCount(game?: string): number {
  const wins = readWins();
  return game ? wins.filter((win) => win.game === game).length : wins.length;
}

/** Record a win. Recording the same game twice in a row is not a new win. */
export function recordArcadeWin(game: string) {
  const wins = readWins();
  const last = wins[wins.length - 1];
  if (last && last.game === game && Date.now() - last.at < 1500) return;
  wins.push({ game, at: Date.now() });
  writeWins(wins);
  try {
    window.dispatchEvent(new CustomEvent("rizz:arcade-win", { detail: { game } }));
  } catch {
    /* no event support */
  }
}

/**
 * Record a win the first time `won` becomes true.
 *
 * `won` is the game's own "you won" condition, so the hook stays dumb: it
 * only has to notice the edge.
 */
export function useArcadeWin(game: string, won: boolean) {
  const recorded = useRef(false);
  useEffect(() => {
    if (!won) {
      recorded.current = false;
      return;
    }
    if (recorded.current) return;
    recorded.current = true;
    recordArcadeWin(game);
  }, [game, won]);
}
