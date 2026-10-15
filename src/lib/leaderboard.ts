import { supabase } from "@/integrations/supabase/client";

export type BoardPeriod = "today" | "week" | "all";

export type BoardRow = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  score: number;
  rank: number;
  /** Rank in the previous equivalent period; null when unknown. */
  prevRank: number | null;
};

export const BOARD_PAGE_SIZE = 50;

export function periodLabel(period: BoardPeriod): string {
  return period === "today" ? "Today" : period === "week" ? "This week" : "All time";
}

/**
 * Leaderboard reader. Prefers the get_leaderboard RPC (score + rank +
 * prev_rank per period); when the backend update hasn't landed yet it falls
 * back to profiles.rizz_score for "All time" and reports period boards as
 * untracked instead of guessing.
 */
export async function fetchBoardPage(
  period: BoardPeriod,
  viewerId: string | null,
  followingOnly: boolean,
  page: number,
): Promise<{ rows: BoardRow[]; periodsTracked: boolean }> {
  const limit = BOARD_PAGE_SIZE;
  const offset = page * BOARD_PAGE_SIZE;

  // Following-only needs the viewer's follow ids for the fallback path.
  let followingIds: string[] | null = null;
  if (followingOnly && viewerId) {
    const { data } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", viewerId)
      .limit(1000);
    followingIds = ((data ?? []) as { following_id: string }[]).map((r) => r.following_id);
    if (followingIds.length === 0) return { rows: [], periodsTracked: true };
  }

  try {
    const { data, error } = await (supabase.rpc as never)(
      "get_leaderboard" as never,
      {
        _period: period,
        _following_only: followingOnly,
        _viewer: viewerId,
        _limit: limit,
        _offset: offset,
      } as never,
    );
    if (error) throw error;
    const rows = ((data ?? []) as Array<{
      user_id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
      score: number | string;
      rank: number | string;
      prev_rank: number | string | null;
    }>).map((r) => ({
      id: r.user_id,
      username: r.username,
      display_name: r.display_name,
      avatar_url: r.avatar_url,
      score: Number(r.score),
      rank: Number(r.rank),
      prevRank: r.prev_rank == null ? null : Number(r.prev_rank),
    }));
    return { rows, periodsTracked: true };
  } catch {
    // Backend update pending: All time still works off the cached score.
    if (period !== "all") return { rows: [], periodsTracked: false };
    let req = supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, rizz_score")
      .order("rizz_score", { ascending: false })
      .order("created_at", { ascending: true })
      .not("username", "is", null)
      .gt("rizz_score", 0)
      .range(offset, offset + limit - 1);
    if (followingIds) req = req.in("id", followingIds);
    const { data, error } = await req;
    if (error) throw error;
    const list = ((data ?? []) as Array<{
      id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
      rizz_score: number;
    }>).filter((p) => p.username);
    return {
      rows: list.map((p, i) => ({
        id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        score: p.rizz_score ?? 0,
        rank: offset + i + 1,
        prevRank: null,
      })),
      periodsTracked: true,
    };
  }
}

/** Points the viewer needs to pass the person directly above them. */
export function pointsToPass(rows: BoardRow[], viewerId: string | null): {
  rank: number;
  above: BoardRow | null;
  gap: number;
} | null {
  if (!viewerId) return null;
  const idx = rows.findIndex((r) => r.id === viewerId);
  if (idx < 0) return null;
  const me = rows[idx]!;
  const above = idx > 0 ? rows[idx - 1]! : null;
  return { rank: me.rank, above, gap: above ? Math.max(1, above.score - me.score + 1) : 0 };
}
