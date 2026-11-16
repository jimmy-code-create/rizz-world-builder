import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeCatConfig, type CatConfig } from "./config";

/**
 * Every member who uses their cat as their picture, resolved once.
 *
 * Avatars are rendered in feeds, message rows, story strips and call tiles. A
 * per-user query in each `UserAvatar` would be one request per face on screen,
 * so this loads the whole set in a single cached query and `UserAvatar` reads it
 * from the same query key — React Query dedupes, so the first avatar to mount
 * pays for the fetch and every other one is free.
 *
 * Before `pending_catstudio.sql` runs the columns do not exist; the failed
 * select resolves to an empty map so everyone simply keeps their photo.
 */
export function useCatAvatars() {
  return useQuery({
    queryKey: ["cat-avatars"],
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<Map<string, CatConfig>> => {
      const avatars = new Map<string, CatConfig>();
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("id, avatar_type, avatar_config")
        .eq("avatar_type", "cat")
        .not("avatar_config", "is", null)
        .limit(500);
      if (error || !data) return avatars;
      for (const row of data as {
        id?: string;
        avatar_type?: string | null;
        avatar_config?: unknown;
      }[]) {
        if (!row.id || row.avatar_type !== "cat") continue;
        avatars.set(row.id, sanitizeCatConfig(row.avatar_config));
      }
      return avatars;
    },
  });
}

/** The saved cat for one member, from the shared map. */
export function useCatAvatar(userId: string | null | undefined): CatConfig | null {
  const { data } = useCatAvatars();
  if (!userId || !data) return null;
  return data.get(userId) ?? null;
}
