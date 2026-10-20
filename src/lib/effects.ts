import { supabase } from "@/integrations/supabase/client";

/**
 * Global cosmetics killswitch.
 * While false: avatar decorations, nameplates, glowing/colored names, and profile
 * effects are paused and hidden across all surfaces. Server-side equip/unlock is blocked.
 */
export const COSMETICS_ENABLED = false;

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

export const DISCORD_SHOWCASE_EFFECTS: ProfileEffect[] = [
  // The cinematic collection. Every entry is a full-width profile effect
  // rendered from the supplied reel; see lib/cinematic-effects.ts for the
  // video, poster, price and rights metadata.
  {
    id: "fx-web-slinger",
    slug: "fx-web-slinger",
    name: "Web Slinger",
    description: "A masked web slinger drops in, lands on a glowing portal, and holds the frame in red-and-blue light.",
    type: "profile_effect",
    rarity: "mythic",
    unlock_rizz: 1800,
    preview_color: "#e8253f",
  },
  {
    id: "fx-sakura-bloom",
    slug: "fx-sakura-bloom",
    name: "Sakura Bloom",
    description: "A slow drift of cherry blossoms around a delicate rose trail.",
    type: "profile_effect",
    rarity: "legendary",
    unlock_rizz: 1200,
    preview_color: "#fb7185",
  },
  {
    id: "fx-arcane-nexus",
    slug: "fx-arcane-nexus",
    name: "Arcane Nexus",
    description: "Counter-rotating glyph rings, arcane sigils and drifting starlight.",
    type: "profile_effect",
    rarity: "mythic",
    unlock_rizz: 1500,
    preview_color: "#a855f7",
  },
  {
    id: "fx-sakura-storm",
    slug: "fx-sakura-storm",
    name: "Sakura Storm",
    description: "A denser cherry-blossom storm around a brighter rose trail.",
    type: "profile_effect",
    rarity: "epic",
    unlock_rizz: 900,
    preview_color: "#f472b6",
  },
];

function getLocalAcquired(userId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(`rizz_acquired_effects_${userId}`);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveLocalAcquired(userId: string, effectId: string) {
  if (typeof window === "undefined") return;
  try {
    const set = getLocalAcquired(userId);
    set.add(effectId);
    localStorage.setItem(`rizz_acquired_effects_${userId}`, JSON.stringify([...set]));
  } catch {}
}

function getLocalEquipped(userId: string): Partial<Record<ProfileEffectType, string>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(`rizz_equipped_effects_${userId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalEquipped(userId: string, type: ProfileEffectType, effectId: string | null) {
  if (typeof window === "undefined") return;
  try {
    const eq = getLocalEquipped(userId);
    if (effectId) eq[type] = effectId;
    else delete eq[type];
    localStorage.setItem(`rizz_equipped_effects_${userId}`, JSON.stringify(eq));
  } catch {}
}

export async function fetchAllEffects(): Promise<ProfileEffect[]> {
  try {
    const { data } = await supabase.from("profile_effects").select("*").order("unlock_rizz");
    const dbList = (data ?? []) as ProfileEffect[];
    const map = new Map<string, ProfileEffect>();
    for (const item of DISCORD_SHOWCASE_EFFECTS) map.set(item.slug, item);
    for (const item of dbList) map.set(item.slug, item);
    return Array.from(map.values());
  } catch {
    return DISCORD_SHOWCASE_EFFECTS;
  }
}

export async function fetchUserEffects(userId: string) {
  const localSet = getLocalAcquired(userId);
  let dbRows: any[] = [];
  try {
    const { data } = await supabase
      .from("user_profile_effects")
      .select("*, effect:profile_effects(*)")
      .eq("user_id", userId);
    dbRows = data ?? [];
  } catch {}

  const localEquipped = getLocalEquipped(userId);
  const byId = new Map(dbRows.map((r) => [r.effect_id, r]));

  // Merge locally acquired Discord effects
  for (const eff of DISCORD_SHOWCASE_EFFECTS) {
    if (localSet.has(eff.id) || localEquipped[eff.type] === eff.id) {
      if (!byId.has(eff.id)) {
        byId.set(eff.id, {
          user_id: userId,
          effect_id: eff.id,
          equipped: localEquipped[eff.type] === eff.id,
          effect: eff,
        });
      }
    }
  }

  return Array.from(byId.values());
}

export async function fetchEquippedEffects(userId: string): Promise<Partial<Record<ProfileEffectType, ProfileEffect>>> {
  const out: Partial<Record<ProfileEffectType, ProfileEffect>> = {};
  const localEquipped = getLocalEquipped(userId);

  try {
    const { data } = await supabase
      .from("user_profile_effects")
      .select("*, effect:profile_effects(*)")
      .eq("user_id", userId)
      .eq("equipped", true);

    for (const row of data ?? []) {
      const e = (row as any).effect as ProfileEffect;
      if (e) out[e.type] = e;
    }
  } catch {}

  // Check local fallback
  for (const [type, effId] of Object.entries(localEquipped) as [ProfileEffectType, string][]) {
    if (!out[type] && effId) {
      const match = DISCORD_SHOWCASE_EFFECTS.find((e) => e.id === effId || e.slug === effId);
      if (match) out[type] = match;
    }
  }

  return out;
}

export async function acquireEffect(userId: string, effectId: string) {
  if (!COSMETICS_ENABLED) {
    throw new Error("Cosmetics are currently paused.");
  }
  saveLocalAcquired(userId, effectId);
  try {
    await supabase.from("user_profile_effects").insert({ user_id: userId, effect_id: effectId });
  } catch {}
}

export function isTrialActive(profile: { trial_active?: boolean | null; trial_ends_at?: string | null } | null) {
  if (!profile) return false;
  if (!profile.trial_active) return false;
  if (!profile.trial_ends_at) return true;
  return new Date(profile.trial_ends_at).getTime() > Date.now();
}

export async function equipEffect(userId: string, effectId: string, type: ProfileEffectType) {
  if (!COSMETICS_ENABLED) {
    throw new Error("Cosmetics are currently paused.");
  }
  saveLocalAcquired(userId, effectId);
  saveLocalEquipped(userId, type, effectId);

  try {
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
  } catch {}
}

export async function unequipEffect(userId: string, effectId: string, type?: ProfileEffectType) {
  if (type) saveLocalEquipped(userId, type, null);
  else {
    const eff = DISCORD_SHOWCASE_EFFECTS.find((e) => e.id === effectId);
    if (eff) saveLocalEquipped(userId, eff.type, null);
  }
  try {
    await supabase.from("user_profile_effects").update({ equipped: false }).eq("user_id", userId).eq("effect_id", effectId);
  } catch {}
}

export const RARITY_FLAT: Record<ProfileEffect["rarity"], string> = {
  common: "#94a3b8",
  rare: "#06b6d4",
  epic: "#a855f7",
  legendary: "#facc15",
  mythic: "#ec4899",
};

export const RARITY_GRADIENT: Record<ProfileEffect["rarity"], string> = RARITY_FLAT;
