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
 * A profile carries five marks at most, in this fixed order. Anything else a
 * member owns lives only on /badges, which keeps the name row readable.
 */
export const PROFILE_BADGE_LINEUP = [
  "verified",
  "streamer",
  "bounty-hunter",
  "purify",
  "main-character",
];

export function profileBadgeLineup(badges: Badge[]): Badge[] {
  const rank = new Map(PROFILE_BADGE_LINEUP.map((slug, index) => [slug, index]));
  return badges
    .filter((badge) => rank.has(badge.slug))
    .sort((a, b) => (rank.get(a.slug) ?? 99) - (rank.get(b.slug) ?? 99))
    .slice(0, PROFILE_BADGE_LINEUP.length);
}

function presentBadge(badge: Badge): Badge {
  const canonical = canonicalFor(badge.slug);
  return canonical
    ? { ...badge, name: canonical.name, icon: canonical.icon, color: canonical.glow }
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
