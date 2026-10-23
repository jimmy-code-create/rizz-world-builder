import { supabase } from "@/integrations/supabase/client";
import { canonicalFor } from "@/lib/badge-set";

export type Badge = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  rarity: "common" | "rare" | "epic" | "legendary" | "mythic";
};

/**
 * A name row carries four marks at most, in this fixed order. Anything else a
 * member owns lives only on /badges, which keeps the row readable.
 *
 * These four are the only marks the product shows beside a name: the badge
 * shelf, feed rows, forum rows and the profile preview all read this list, so
 * a retired mark (Main Character, Voice of the Realms, RIZZ Team) can never
 * reappear just because an old `user_badges` row still exists.
 */
export const PROFILE_BADGE_LINEUP = ["verified", "streamer", "bounty-hunter", "purify"];

export function profileBadgeLineup<T extends { slug: string }>(badges: T[]): T[] {
  const rank = new Map(PROFILE_BADGE_LINEUP.map((slug, index) => [slug, index]));
  return badges
    .filter((badge) => rank.has(badge.slug))
    .sort((a, b) => (rank.get(a.slug) ?? 99) - (rank.get(b.slug) ?? 99))
    .slice(0, PROFILE_BADGE_LINEUP.length);
}

/**
 * Legacy awards that draw the same mark as a current slug. `no-cap` was the
 * old Verified, and the name row only recognises `verified`, so the alias has
 * to be normalised before display or an old holder silently loses the check.
 */
const BADGE_ALIAS: Record<string, string> = { "no-cap": "verified" };

function presentBadge(badge: Badge): Badge {
  const slug = BADGE_ALIAS[badge.slug] ?? badge.slug;
  const canonical = canonicalFor(slug);
  return canonical
    ? { ...badge, slug, name: canonical.name, icon: canonical.icon, color: canonical.glow }
    : badge;
}

export async function fetchAllBadges() {
  const { data, error } = await supabase.from("badges").select("*").order("rarity");
  if (error) throw error;
  return ((data ?? []) as Badge[]).map(presentBadge);
}

export async function fetchUserBadges(userId: string) {
  const { data, error } = await supabase
    .from("user_badges")
    .select("badge_id, awarded_at, badges(*)")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? [])
    .map((r: any) => r.badges as Badge)
    .filter(Boolean)
    .map(presentBadge);
}

/** Earned badges with their award dates (for the inspector + share card). */
export async function fetchUserBadgesWithDates(userId: string) {
  const { data, error } = await supabase
    .from("user_badges")
    .select("badge_id, awarded_at, badges(*)")
    .eq("user_id", userId);
  if (error) throw error;
  return ((data ?? []) as any[])
    .map((r) => ({
      badge: r.badges as Badge | null,
      awardedAt: (r.awarded_at ?? null) as string | null,
    }))
    .filter((r): r is { badge: Badge; awardedAt: string | null } => !!r.badge)
    .map((r) => ({ ...r, badge: presentBadge(r.badge) }));
}
