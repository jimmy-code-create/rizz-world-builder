import { supabase } from "@/integrations/supabase/client";

/**
 * Cosmetics are live. Purchases still happen on the server: the browser asks
 * `purchase_profile_effect` to spend Paws, and only that RPC can write the
 * wallet or an ownership row.
 */
export const COSMETICS_ENABLED = true;

export type ProfileEffectType = "avatar_decoration" | "profile_effect" | "nameplate";

export type ProfileEffect = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  type: ProfileEffectType;
  rarity: "common" | "rare" | "epic" | "legendary" | "mythic";
  /** Legacy column. Kept in sync with paw_price by the migration. */
  unlock_rizz: number;
  paw_price?: number;
  price_cents?: number;
  rights_review?: boolean;
  sort_order?: number;
  preview_color: string;
};

/**
 * The four cinematic pieces. Web Slinger is the full-profile effect; the three
 * original animated loops sit around the avatar as decorations.
 */
export const SHOWCASE_EFFECTS: ProfileEffect[] = [
  {
    id: "fx-web-slinger",
    slug: "fx-web-slinger",
    name: "Web Slinger",
    description:
      "A masked web slinger drops in, lands on a glowing portal, and holds the frame in red-and-blue light.",
    type: "profile_effect",
    rarity: "mythic",
    unlock_rizz: 1800,
    paw_price: 1800,
    price_cents: 499,
    rights_review: true,
    sort_order: 10,
    preview_color: "#e8253f",
  },
  {
    id: "fx-sakura-bloom",
    slug: "fx-sakura-bloom",
    name: "Sakura Bloom",
    description: "A slow drift of cherry blossoms around a delicate rose trail.",
    type: "avatar_decoration",
    rarity: "legendary",
    unlock_rizz: 1200,
    paw_price: 1200,
    price_cents: 299,
    rights_review: false,
    sort_order: 20,
    preview_color: "#fb7185",
  },
  {
    id: "fx-arcane-nexus",
    slug: "fx-arcane-nexus",
    name: "Arcane Nexus",
    description: "Counter-rotating glyph rings, arcane sigils and drifting starlight.",
    type: "avatar_decoration",
    rarity: "mythic",
    unlock_rizz: 1500,
    paw_price: 1500,
    price_cents: 399,
    rights_review: false,
    sort_order: 30,
    preview_color: "#a855f7",
  },
  {
    id: "fx-sakura-storm",
    slug: "fx-sakura-storm",
    name: "Sakura Storm",
    description: "A denser cherry-blossom storm around a brighter rose trail.",
    type: "avatar_decoration",
    rarity: "epic",
    unlock_rizz: 900,
    paw_price: 900,
    price_cents: 349,
    rights_review: false,
    sort_order: 40,
    preview_color: "#f472b6",
  },
];

/** Backwards-compatible alias used by a few profile surfaces. */
export const DISCORD_SHOWCASE_EFFECTS = SHOWCASE_EFFECTS;

export function effectPawPrice(effect: ProfileEffect): number {
  return effect.paw_price ?? effect.unlock_rizz ?? 0;
}

export function effectIsInRightsReview(effect: ProfileEffect): boolean {
  return Boolean(effect.rights_review);
}

function normalizeEffect(row: Partial<ProfileEffect> & Record<string, unknown>): ProfileEffect {
  const unlock = Number(row.unlock_rizz ?? row.paw_price ?? 0);
  return {
    id: String(row.id ?? row.slug ?? ""),
    slug: String(row.slug ?? ""),
    name: String(row.name ?? "Effect"),
    description: typeof row.description === "string" ? row.description : null,
    type: (row.type as ProfileEffectType) ?? "profile_effect",
    rarity: (row.rarity as ProfileEffect["rarity"]) ?? "common",
    unlock_rizz: unlock,
    paw_price: Number(row.paw_price ?? unlock),
    price_cents: Number(row.price_cents ?? 0),
    rights_review: Boolean(row.rights_review ?? false),
    sort_order: Number(row.sort_order ?? 100),
    preview_color: String(row.preview_color ?? "#c8ff3d"),
  };
}

export async function fetchAllEffects(): Promise<ProfileEffect[]> {
  try {
    const { data } = await supabase
      .from("profile_effects")
      .select("*")
      .order("sort_order")
      .order("paw_price");
    const dbList = (data ?? []).map((row) => normalizeEffect(row as never));
    if (!dbList.length) return SHOWCASE_EFFECTS;
    const map = new Map<string, ProfileEffect>();
    for (const item of SHOWCASE_EFFECTS) map.set(item.slug, item);
    for (const item of dbList) map.set(item.slug, item);
    return Array.from(map.values());
  } catch {
    return SHOWCASE_EFFECTS;
  }
}

export type UserEffect = {
  user_id: string;
  effect_id: string;
  equipped: boolean;
  acquired_at?: string;
  effect: ProfileEffect;
};

export async function fetchUserEffects(userId: string): Promise<UserEffect[]> {
  try {
    const { data, error } = await supabase
      .from("user_profile_effects")
      .select("*, effect:profile_effects(*)")
      .eq("user_id", userId)
      .order("acquired_at", { ascending: false });
    if (error) throw error;
    const rows: UserEffect[] = [];
    for (const row of data ?? []) {
      const effect = (row as unknown as { effect?: Record<string, unknown> | null }).effect;
      if (!effect) continue;
      rows.push({
        user_id: (row as { user_id: string }).user_id,
        effect_id: (row as { effect_id: string }).effect_id,
        equipped: Boolean((row as { equipped?: boolean }).equipped),
        acquired_at: (row as { acquired_at?: string }).acquired_at,
        effect: normalizeEffect(effect as never),
      });
    }
    return rows;
  } catch {
    return [];
  }
}

export async function fetchEquippedEffects(
  userId: string,
): Promise<Partial<Record<ProfileEffectType, ProfileEffect>>> {
  const out: Partial<Record<ProfileEffectType, ProfileEffect>> = {};

  try {
    const { data } = await supabase
      .from("user_profile_effects")
      .select("*, effect:profile_effects(*)")
      .eq("user_id", userId)
      .eq("equipped", true);

    for (const row of data ?? []) {
      const raw = (row as unknown as { effect?: Record<string, unknown> | null }).effect;
      if (!raw) continue;
      const effect = normalizeEffect(raw as never);
      out[effect.type] = effect;
    }
  } catch {
    // A missing shop table should hide cosmetics, not break the profile.
  }

  return out;
}

export type PurchaseResult = {
  status: "purchased" | "owned";
  balance: number;
  effect_id?: string;
  equipped?: boolean;
};

export async function purchaseEffectWithPaws(slug: string): Promise<PurchaseResult> {
  const { data, error } = await supabase.rpc("purchase_profile_effect", { _slug: slug });
  if (error) throw new Error(error.message);
  return data as unknown as PurchaseResult;
}

export async function equipProfileEffect(slug: string) {
  const { data, error } = await supabase.rpc("equip_profile_effect", { _slug: slug });
  if (error) throw new Error(error.message);
  return data;
}

export async function unequipProfileEffect(slug: string) {
  const { data, error } = await supabase.rpc("unequip_profile_effect", { _slug: slug });
  if (error) throw new Error(error.message);
  return data;
}

/** Kept for older callers; new code should use purchaseEffectWithPaws(). */
export async function acquireEffect(_userId: string, effectId: string) {
  return purchaseEffectWithPaws(effectId);
}

/** Kept for older callers; new code should use equipProfileEffect(). */
export async function equipEffect(_userId: string, effectId: string, _type: ProfileEffectType) {
  return equipProfileEffect(effectId);
}

/** Kept for older callers; new code should use unequipProfileEffect(). */
export async function unequipEffect(_userId: string, effectId: string) {
  return unequipProfileEffect(effectId);
}

export function isTrialActive(
  profile: { trial_active?: boolean | null; trial_ends_at?: string | null } | null,
) {
  if (!profile) return false;
  if (!profile.trial_active) return false;
  if (!profile.trial_ends_at) return true;
  return new Date(profile.trial_ends_at).getTime() > Date.now();
}

export const RARITY_FLAT: Record<ProfileEffect["rarity"], string> = {
  common: "#94a3b8",
  rare: "#06b6d4",
  epic: "#a855f7",
  legendary: "#facc15",
  mythic: "#ec4899",
};

export const RARITY_GRADIENT: Record<ProfileEffect["rarity"], string> = RARITY_FLAT;
