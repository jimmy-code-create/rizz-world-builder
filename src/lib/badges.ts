import { supabase } from "@/integrations/supabase/client";

export type Badge = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  rarity: "common" | "rare" | "epic" | "legendary" | "mythic";
};

export async function fetchAllBadges() {
  const { data, error } = await supabase.from("badges").select("*").order("rarity");
  if (error) throw error;
  return (data ?? []) as Badge[];
}

export async function fetchUserBadges(userId: string) {
  const { data, error } = await supabase
    .from("user_badges")
    .select("badge_id, awarded_at, badges(*)")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((r: any) => r.badges as Badge).filter(Boolean);
}

export const RARITY_GLOW: Record<Badge["rarity"], string> = {
  common: "0 0 8px",
  rare: "0 0 12px",
  epic: "0 0 16px",
  legendary: "0 0 22px",
  mythic: "0 0 30px",
};
