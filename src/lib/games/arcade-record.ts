import { useEffect, useRef, useState } from "react";

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

/* ============ PLAYTIME ============ */

const PLAYS_KEY = "rizz:arcade:plays";
const PLAY_EVENT = "rizz:arcade-play";
/** One session cannot credit more than this, so a tab left open overnight does
 *  not mint a "legend" badge while nobody was playing. */
const MAX_SESSION_MS = 2 * 60 * 60_000;

export type ArcadePlay = {
  game: string;
  at: number;
  ms: number;
};

function readPlays(): ArcadePlay[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PLAYS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is ArcadePlay =>
        !!entry &&
        typeof entry.game === "string" &&
        Number.isFinite(entry.at) &&
        Number.isFinite(entry.ms) &&
        entry.ms > 0,
    );
  } catch {
    return [];
  }
}

function writePlays(plays: ArcadePlay[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PLAYS_KEY, JSON.stringify(plays.slice(-400)));
  } catch {
    /* private mode — the record is best effort */
  }
}

/** Every recorded session, oldest first. */
export function readArcadePlays(): ArcadePlay[] {
  return readPlays();
}

/** Total time on the arcade, in ms, in total or for one game. */
export function arcadePlayMs(game?: string): number {
  const plays = readPlays();
  return plays
    .filter((play) => !game || play.game === game)
    .reduce((total, play) => total + play.ms, 0);
}

/** Record one finished session. Sub-minute sessions are ignored. */
export function recordArcadePlay(game: string, ms: number) {
  if (typeof window === "undefined" || !game) return;
  const credit = Math.min(Math.round(ms), MAX_SESSION_MS);
  if (credit < 20_000) return;
  const plays = readPlays();
  plays.push({ game, at: Date.now(), ms: credit });
  writePlays(plays);
  try {
    window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: { game, ms: credit } }));
  } catch {
    /* no event support */
  }
}

/** Total playtime in ms, kept live for the badge that reads it. */
export function useArcadePlayMs(): number {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    const update = () => setMs(arcadePlayMs());
    update();
    window.addEventListener(PLAY_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(PLAY_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return ms;
}

/** "3h 20m" / "45m" — the same string in the badge hint and the Games page. */
export function formatPlaytime(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, "0")}m` : `${minutes}m`;
}

/**
 * Counts visible time for the game that is on screen.
 *
 * Games keep their own state on the device, so playtime does too. The session
 * only advances while the tab is visible, flushes when the game closes or the
 * tab is backgrounded, and caps a single sitting at two hours.
 */
export function useArcadeSession(game: string | null | undefined, active = true) {
  useEffect(() => {
    if (!game || !active || typeof window === "undefined") return;
    let startedAt = Date.now();
    let credited = 0;

    const flush = () => {
      if (document.visibilityState === "hidden") return;
      const now = Date.now();
      const elapsed = Math.min(now - startedAt, MAX_SESSION_MS - credited);
      if (elapsed > 0) credited += elapsed;
      startedAt = now;
      if (credited >= 20_000) {
        recordArcadePlay(game, credited);
        credited = 0;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        flush();
      } else {
        startedAt = Date.now();
      }
    };

    const timer = window.setInterval(flush, 30_000);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      if (credited >= 20_000) recordArcadePlay(game, credited);
    };
  }, [game, active]);
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
