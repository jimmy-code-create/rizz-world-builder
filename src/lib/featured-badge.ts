import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MAX_SHOWCASE_BADGES } from "@/lib/badge-set";

/**
 * The one badge a member wears beside their name. Stored as `profiles.featured_badge`
 * (a badges.slug). The column ships in the 20261024 migration, so every read here
 * is best-effort: before the migration lands the UI simply behaves as "nothing
 * featured" instead of failing the whole profile load.
 */
export type FeaturedBadge = {
  /** Slug of the featured badge, or null when nothing is featured. */
  slug: string | null;
  /** False when the column isn't deployed yet (or the row couldn't be read). */
  available: boolean;
};

const MISSING_COLUMN = /featured_badge|schema cache|column .* does not exist/i;

export async function fetchFeaturedBadge(userId: string): Promise<FeaturedBadge> {
  const { data, error } = await supabase
    .from("profiles")
    .select("featured_badge")
    .eq("id", userId)
    .maybeSingle();
  if (error) return { slug: null, available: !MISSING_COLUMN.test(error.message) };
  const row = data as { featured_badge?: string | null } | null;
  return { slug: row?.featured_badge ?? null, available: true };
}

/** Set (or clear, with null) the badge worn on the profile. Throws a readable error. */
export async function setFeaturedBadge(userId: string, slug: string | null): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ featured_badge: slug })
    .eq("id", userId);
  if (!error) return;
  if (MISSING_COLUMN.test(error.message)) {
    throw new Error(
      "Featured badges need the latest database migration — try again after it's applied.",
    );
  }
  if (/earned/i.test(error.message)) {
    throw new Error("You can only feature a badge you've earned.");
  }
  throw new Error(error.message);
}

export function useFeaturedBadge(userId?: string | null) {
  return useQuery({
    queryKey: ["featured-badge", userId],
    queryFn: () => fetchFeaturedBadge(userId!),
    enabled: !!userId,
    staleTime: 60_000,
  });
}

/**
 * Showcase badges: the up-to-three badges equipped onto the body of the
 * profile, stored in `profiles.badges` (the "showcase slugs shown on the
 * card" column the profile-card migration introduces). Separate from
 * `featured_badge`, which is the single emblem worn beside the name.
 *
 * Reads of that column happen where the profile row is already loaded; this
 * module owns the write side plus the same best-effort error handling as the
 * featured badge: before the migration lands, the update fails with a
 * readable message instead of a cryptic PostgREST error.
 */
export async function saveShowcaseBadges(userId: string, slugs: string[]): Promise<void> {
  const badges = [...new Set(slugs.filter((slug) => typeof slug === "string" && !!slug))].slice(
    0,
    MAX_SHOWCASE_BADGES,
  );
  const { data, error } = await supabase
    .from("profiles")
    .update({ badges })
    .eq("id", userId)
    .select("id");
  if (error) {
    if (/column profiles\.badges|schema cache|does not exist/i.test(error.message)) {
      throw new Error(
        "Badge showcase needs the latest database migration — try again after it's applied.",
      );
    }
    throw new Error(error.message);
  }
  // RLS blocks report no error and no row; don't toast a save that never happened.
  if (!data?.length) {
    throw new Error("Couldn't save your showcase — the profile didn't accept the update.");
  }
}
