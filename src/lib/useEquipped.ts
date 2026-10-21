import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchEquippedEffects, isAvailableEffect } from "@/lib/effects";

/** Return the equipped cosmetics for a user, one per slot. */
export function useEquipped(userId?: string | null) {
  return useQuery({
    queryKey: ["equipped", userId],
    queryFn: () => fetchEquippedEffects(userId!),
    enabled: !!userId,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}

/**
 * Slugs this member owns, equipped or not. The effects gallery uses it to tell
 * "Equip" apart from "Unlock", while the database still decides the real
 * ownership in `equip_profile_effect`.
 */
export function useOwnedEffectSlugs(userId?: string | null) {
  return useQuery({
    queryKey: ["owned-effects", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profile_effects")
        .select("effect:profile_effects(slug)")
        .eq("user_id", userId!);
      if (error) throw error;
      const slugs = new Set<string>();
      for (const row of (data ?? []) as Array<{
        effect: { slug?: string | null } | Array<{ slug?: string | null }> | null;
      }>) {
        const effect = Array.isArray(row.effect) ? row.effect[0] : row.effect;
        if (isAvailableEffect(effect?.slug)) slugs.add(effect!.slug!);
      }
      return slugs;
    },
  });
}
