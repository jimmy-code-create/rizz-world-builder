import { supabase } from "@/integrations/supabase/client";
import { arcadeWinCount } from "@/lib/games/arcade-record";

/**
 * Badge progress.
 *
 * Every badge rule in the collection is a number against a number, so the
 * gallery can say how far along you are instead of only repeating the rule.
 * The counts come from the same tables the rest of the app already reads.
 *
 * The map is keyed by badge slug, so the gallery can look a badge up by name.
 */

export type BadgeProgress = {
  current: number;
  target: number;
  /** 0-100, clamped. */
  pct: number;
};

export type BadgeProgressMap = Record<string, BadgeProgress>;

function progress(current: number, target: number): BadgeProgress {
  const safeTarget = target > 0 ? target : 1;
  const clamped = Math.max(0, Math.min(current, safeTarget));
  return {
    current: Math.max(0, Math.round(current)),
    target,
    pct: Math.round((clamped / safeTarget) * 100),
  };
}

/** The UTC day a timestamp falls on, as YYYY-MM-DD. */
function dayKey(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

/**
 * The run of consecutive days ending today (or yesterday) that this member
 * was active on.
 *
 * A streak that ended last week has lapsed, so it counts as zero even though
 * the history still contains a long run.
 */
export function longestDayStreak(days: Iterable<string>): number {
  const unique = [...new Set([...days].filter(Boolean))].sort();
  if (!unique.length) return 0;

  let best = 1;
  let run = 1;
  for (let i = 1; i < unique.length; i += 1) {
    const previous = new Date(`${unique[i - 1]}T00:00:00Z`).getTime();
    const current = new Date(`${unique[i]}T00:00:00Z`).getTime();
    if (current - previous === 86_400_000) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }

  const today = dayKey(new Date());
  const yesterday = dayKey(Date.now() - 86_400_000);
  const last = unique[unique.length - 1];
  const alive = last === today || last === yesterday;
  return alive ? best : 0;
}

/** Everything the collection can measure, for one member. */
export async function fetchBadgeProgress(userId: string): Promise<BadgeProgressMap> {
  const out: BadgeProgressMap = {};

  const [
    badgesResult,
    postLikesResult,
    storyLikesResult,
    dmCountResult,
    realmCountResult,
    groupCountResult,
    topPostResult,
    rizzResult,
    claimsResult,
    postsActivityResult,
    commentsActivityResult,
    dmActivityResult,
    storyActivityResult,
  ] = await Promise.all([
    supabase
      .from("user_badges")
      .select("badge_id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("post_likes")
      .select("post_id,posts!inner(author_id)", { count: "exact", head: true })
      .eq("posts.author_id", userId),
    supabase
      .from("story_likes")
      .select("story_id,stories!inner(author_id)", { count: "exact", head: true })
      .eq("stories.author_id", userId),
    supabase
      .from("direct_messages")
      .select("id", { count: "exact", head: true })
      .eq("sender_id", userId),
    supabase.from("messages").select("id", { count: "exact", head: true }).eq("sender_id", userId),
    supabase
      .from("group_messages")
      .select("id", { count: "exact", head: true })
      .eq("author_id", userId),
    supabase
      .from("posts")
      .select("like_count")
      .eq("author_id", userId)
      .order("like_count", { ascending: false })
      .limit(1),
    supabase.from("profiles").select("rizz_score").eq("id", userId).maybeSingle(),
    supabase
      .from("drop_claims")
      .select("drop_id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase.from("posts").select("created_at").eq("author_id", userId).limit(300),
    supabase.from("post_comments").select("created_at").eq("author_id", userId).limit(300),
    supabase.from("direct_messages").select("created_at").eq("sender_id", userId).limit(300),
    supabase.from("story_likes").select("created_at").eq("user_id", userId).limit(300),
  ]);

  const count = (result: { count?: number | null } | null) => result?.count ?? 0;

  out.rookie = progress(count(badgesResult), 1);
  out["rising-star"] = progress(count(postLikesResult) + count(storyLikesResult), 100);
  out["smooth-talker"] = progress(
    count(dmCountResult) + count(realmCountResult) + count(groupCountResult),
    100,
  );
  out["meme-lord"] = progress(topPostResult.data?.[0]?.like_count ?? 0, 50);
  out["bounty-hunter"] = progress(count(claimsResult), 1);

  // Leaderboard rank: how many members are ahead of this one.
  const myRizz = rizzResult.data?.rizz_score ?? 0;
  const aheadResult = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .gt("rizz_score", myRizz);
  out["top-rizzler"] = progress((aheadResult.count ?? 0) + 1, 10);

  // Day streak: the days this member was active on.
  const activityDays = [
    ...(postsActivityResult.data ?? []).map((row) => dayKey(row.created_at)),
    ...(commentsActivityResult.data ?? []).map((row) => dayKey(row.created_at)),
    ...(dmActivityResult.data ?? []).map((row) => dayKey(row.created_at)),
    ...(storyActivityResult.data ?? []).map((row) => dayKey(row.created_at)),
  ];
  const streak = longestDayStreak(activityDays);
  out["streak-7"] = progress(streak, 7);
  out["streak-30"] = progress(streak, 30);

  // Arcade wins are recorded on the device, like the games' own best scores.
  out["game-champ"] = progress(arcadeWinCount(), 10);

  return out;
}
