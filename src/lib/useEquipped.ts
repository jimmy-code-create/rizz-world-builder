import { useQuery } from "@tanstack/react-query";
import { fetchEquippedEffects } from "@/lib/effects";

/** Return equipped avatar_decoration / nameplate / profile_effect for a user. */
export function useEquipped(userId?: string | null) {
  return useQuery({
    queryKey: ["equipped", userId],
    queryFn: () => fetchEquippedEffects(userId!),
    enabled: !!userId,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}