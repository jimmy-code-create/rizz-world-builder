import { supabase } from "@/integrations/supabase/client";

export type ProfileEffectType = "avatar_decoration" | "profile_effect" | "nameplate";

export type ProfileEffect = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  type: ProfileEffectType;
  rarity: "common" | "rare" | "epic" | "legendary" | "mythic";
  unlock_rizz: number;
  preview_color: string;
};

export async function fetchAllEffects() {
  const { data, error } = await supabase.from("profile_effects").select("*").order("unlock_rizz");
  if (error) throw error;
  return (data ?? []) as ProfileEffect[];
}

export async function fetchUserEffects(userId: string) {
  const { data, error } = await supabase
    .from("user_profile_effects")
    .select("*, effect:profile_effects(*)")
    .eq("user_id", userId);
  if (error) throw error;
  return data ?? [];
}

export async function fetchEquippedEffects(userId: string) {
  const { data } = await supabase
    .from("user_profile_effects")
    .select("*, effect:profile_effects(*)")
    .eq("user_id", userId)
    .eq("equipped", true);
  const out: Partial<Record<ProfileEffectType, ProfileEffect>> = {};
  for (const row of data ?? []) {
    const e = (row as any).effect as ProfileEffect;
    if (e) out[e.type] = e;
  }
  return out;
}

export async function acquireEffect(userId: string, effectId: string) {
  const { error } = await supabase
    .from("user_profile_effects")
    .insert({ user_id: userId, effect_id: effectId });
  if (error && !error.message.includes("duplicate")) throw error;
}

export async function equipEffect(userId: string, effectId: string, type: ProfileEffectType) {
  // unequip current of this type
  const { data: current } = await supabase
    .from("user_profile_effects")
    .select("effect_id, effect:profile_effects(type)")
    .eq("user_id", userId)
    .eq("equipped", true);
  for (const row of current ?? []) {
    const t = (row as any).effect?.type;
    if (t === type) {
      await supabase.from("user_profile_effects").update({ equipped: false }).eq("user_id", userId).eq("effect_id", (row as any).effect_id);
    }
  }
  await supabase.from("user_profile_effects").update({ equipped: true }).eq("user_id", userId).eq("effect_id", effectId);
}

export async function unequipEffect(userId: string, effectId: string) {
  await supabase.from("user_profile_effects").update({ equipped: false }).eq("user_id", userId).eq("effect_id", effectId);
}

export const RARITY_GRADIENT: Record<ProfileEffect["rarity"], string> = {
  common: "linear-gradient(135deg, #94a3b8, #cbd5e1)",
  rare: "linear-gradient(135deg, #22d3ee, #06b6d4)",
  epic: "linear-gradient(135deg, #a855f7, #ec4899)",
  legendary: "linear-gradient(135deg, #facc15, #f97316)",
  mythic: "linear-gradient(135deg, #ff2d92, #a855f7, #22d3ee)",
};