import { useQuery } from "@tanstack/react-query";
import { fetchEquippedEffects } from "@/lib/effects";

/** Return the equipped profile effect for a user (only Puppy Love remains). */
export function useEquipped(userId?: string | null) {
  return useQuery({
    queryKey: ["equipped", userId],
    queryFn: () => fetchEquippedEffects(userId!),
    enabled: !!userId,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}