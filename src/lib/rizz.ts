import { supabase } from "@/integrations/supabase/client";

/**
 * Rizz: the score behind the leaderboard.
 *
 * Rizz is *earned*, not shared. There is no common pool and no fixed supply:
 * a shared pool would make the board zero-sum, so every gain would be
 * somebody else's loss, and the number would stop meaning anything. Instead
 * every event is worth a fixed number of points, and the leaderboard is a
 * straight ranking of how much people have contributed.
 *
 * Two ways a point can land:
 *
 *  1. The server pipeline. `award_rizz` writes an event row and bumps
 *     `profiles.rizz_score`; database triggers call it when a post is made,
 *     when a post is liked, commented on or reacted to, and when a badge is
 *     awarded. This is the authoritative path and it is the one that can
 *     credit *other* people, because only the server may write their row.
 *
 *  2. The client fallback, used only while the server pipeline is not
 *     deployed yet. The browser can only update its own profile row (the
 *     row-level security policy allows exactly that), so the fallback can
 *     only credit you, and only for things that happen on your own device:
 *     the posts you make and the badges you earn. It is capped per day so a
 *     fallback score cannot be farmed, and it stops the moment the server
 *     pipeline answers.
 *
 * `serverScoringLive()` decides which of the two is in charge, so nothing is
 * ever counted twice.
 */

export const RIZZ_RULES = {
  post: 5,
  like_received: 2,
  comment_received: 3,
  reaction_received: 1,
  badge_earned: 25,
} as const;

export type RizzReason = keyof typeof RIZZ_RULES;

/** The untyped-RPC escape hatch the leaderboard reader also uses. */
type RpcCaller = (
  fn: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

/** How much the client fallback may hand out in one day. */
export const DAILY_CLIENT_CAP = 250;

const LEDGER_KEY = "rizz:ledger";
const PROBE_KEY = "rizz:server-scoring";
const PROBE_TTL_MS = 10 * 60 * 1000;

export type RizzLedgerEntry = {
  points: number;
  reason: string;
  at: number;
};

function readLedger(): RizzLedgerEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LEDGER_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is RizzLedgerEntry =>
        !!entry && Number.isFinite(entry.points) && Number.isFinite(entry.at),
    );
  } catch {
    return [];
  }
}

function pushLedger(entry: RizzLedgerEntry) {
  if (typeof window === "undefined") return;
  try {
    const next = [...readLedger(), entry].slice(-500);
    window.localStorage.setItem(LEDGER_KEY, JSON.stringify(next));
  } catch {
    /* private mode — the ledger is best effort */
  }
}

/** Every point the fallback has handed out, oldest first. */
export function readRizzLedger(): RizzLedgerEntry[] {
  return readLedger();
}

/** What the fallback has given out today (UTC day). */
export function rizzSpentToday(): number {
  const today = new Date().toISOString().slice(0, 10);
  return readLedger()
    .filter((entry) => new Date(entry.at).toISOString().slice(0, 10) === today)
    .reduce((total, entry) => total + entry.points, 0);
}

/** How much of today's fallback allowance is left. */
export function rizzCapRemaining(): number {
  return Math.max(0, DAILY_CLIENT_CAP - rizzSpentToday());
}

/**
 * Is the server-side scoring pipeline deployed?
 *
 * `get_leaderboard` only exists once the rizz migration has been applied, so
 * it is the cheapest possible probe. The answer is cached for a few minutes
 * because it can only change when the app is redeployed.
 */
export async function serverScoringLive(): Promise<boolean> {
  if (typeof window !== "undefined") {
    try {
      const cached = window.localStorage.getItem(PROBE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as { at: number; live: boolean };
        if (Number.isFinite(parsed?.at) && Date.now() - parsed.at < PROBE_TTL_MS) {
          return parsed.live;
        }
      }
    } catch {
      /* ignore a corrupt cache */
    }
  }
  let live = false;
  try {
    const { error } = await (supabase.rpc as unknown as RpcCaller)("get_leaderboard", {
      _period: "all",
      _limit: 1,
    });
    live = !error;
  } catch {
    live = false;
  }
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(PROBE_KEY, JSON.stringify({ at: Date.now(), live }));
    } catch {
      /* ignore */
    }
  }
  return live;
}

/** The signed-in member's id, or null. */
async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Award rizz.
 *
 * Returns true when points were actually added. When the server pipeline is
 * live the server does the awarding, so this returns false and the caller
 * does not need to do anything else.
 */
export async function awardRizz(
  targetUserId: string | null | undefined,
  points: number,
  reason: RizzReason | string,
): Promise<boolean> {
  if (!targetUserId || points <= 0) return false;
  if (await serverScoringLive()) return false;

  // The browser may only write its own row, so the fallback can only credit
  // the person using it.
  const me = await currentUserId();
  if (!me || me !== targetUserId) return false;

  if (rizzCapRemaining() < points) return false;

  const { data: profile, error: readError } = await supabase
    .from("profiles")
    .select("rizz_score")
    .eq("id", me)
    .maybeSingle();
  if (readError) return false;

  const next = Math.max(0, (profile?.rizz_score ?? 0) + points);
  const { error } = await supabase.from("profiles").update({ rizz_score: next }).eq("id", me);
  if (error) return false;

  pushLedger({ points, reason: String(reason), at: Date.now() });
  // Tell the app the score moved: the leaderboard and the profile card read
  // the same number and refresh straight away.
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(
        new CustomEvent("rizz:awarded", { detail: { points, reason, userId: me } }),
      );
    } catch {
      /* no event support */
    }
  }
  return true;
}

/**
 * The leaderboard rows, with the score every row is ranked by.
 *
 * The board is `profiles.rizz_score` — the same number the profile card and
 * the "Top creators" rail show — so a member sees one score everywhere.
 */
export async function fetchRizzBoard(limit = 30): Promise<
  Array<{
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    rizz: number;
  }>
> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, rizz_score")
    .order("rizz_score", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    username: row.username,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    rizz: row.rizz_score ?? 0,
  }));
}
