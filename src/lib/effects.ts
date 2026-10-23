import { useQuery, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * The effects shop speaks in two categories, both stored in `profile_effects`:
 *
 *   avatar_decoration — a frame cut around the avatar (worn over the photo,
 *                       drawn on transparency so no plate ever shows).
 *   profile_effect    — a scene laid over the profile header.
 *
 * Buying, equipping and removing all happen server-side. The browser never
 * writes `user_profile_effects` directly; the RPCs own the wallet, the
 * one-per-category rule and the ownership check.
 */
export type EffectType = "avatar_decoration" | "profile_effect";
export type EffectRarity = "common" | "rare" | "epic" | "legendary" | "mythic";

export type Effect = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  type: EffectType;
  rarity: EffectRarity;
  paw_price: number;
  /** Optional card price in cents (e.g. 199 = $1.99). 0 means Paws only. */
  price_cents: number;
  preview_color: string;
  sort_order: number;
};

export type EffectCategory = {
  type: EffectType;
  label: string;
  blurb: string;
};

export const EFFECT_CATEGORIES: readonly EffectCategory[] = [
  {
    type: "avatar_decoration",
    label: "Avatar decorations",
    blurb: "A frame that hugs your photo. Drawn around the picture, never on top of it.",
  },
  {
    type: "profile_effect",
    label: "Profile effects",
    blurb: "A live scene across your banner and name — visible to everyone who opens you.",
  },
] as const;

export const EFFECT_COLUMNS =
  "id, slug, name, description, type, rarity, paw_price, price_cents, preview_color, sort_order";

/** 199 → "$1.99". */
export function formatCardPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export const RARITY_LABEL: Record<EffectRarity, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  mythic: "Mythic",
};

/** Rarity tints, kept inside the ink/paper/lime palette instead of neon. */
export const RARITY_TINT: Record<EffectRarity, string> = {
  common: "#a9a69c",
  rare: "#f4f1e7",
  epic: "#c9ff3d",
  legendary: "#c9ff3d",
  mythic: "#ff2d3f",
};

function presentEffect(row: Record<string, unknown>): Effect {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    description: (row.description as string | null) ?? null,
    type: row.type as EffectType,
    rarity: (row.rarity as EffectRarity) ?? "common",
    paw_price: Number(row.paw_price ?? 0),
    price_cents: Number(row.price_cents ?? 0),
    preview_color: (row.preview_color as string) ?? "#f4f1e7",
    sort_order: Number(row.sort_order ?? 0),
  };
}

/** Every cosmetic on the two shelves, cheapest shelf first. */
export async function fetchEffectCatalogue(): Promise<Effect[]> {
  const { data, error } = await supabase
    .from("profile_effects")
    .select(EFFECT_COLUMNS)
    .in("type", ["avatar_decoration", "profile_effect"])
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(presentEffect);
}

/** What this member owns, keyed by slug, with the equip flag. */
export type EffectOwnership = { effect: Effect; equipped: boolean };

export async function fetchOwnedEffects(userId: string): Promise<EffectOwnership[]> {
  const { data, error } = await supabase
    .from("user_profile_effects")
    .select(`equipped, profile_effects(${EFFECT_COLUMNS})`)
    .eq("user_id", userId);
  if (error) throw error;
  return ((data ?? []) as Array<{ equipped: boolean; profile_effects: Record<string, unknown> | null }>)
    .filter((row) => !!row.profile_effects)
    .map((row) => ({
      effect: presentEffect(row.profile_effects as Record<string, unknown>),
      equipped: Boolean(row.equipped),
    }));
}

export type WornEffects = {
  avatar_decoration: Effect | null;
  profile_effect: Effect | null;
};

/** The one cosmetic of each category this member currently wears. */
export async function fetchWornEffects(userId: string): Promise<WornEffects> {
  const worn: WornEffects = { avatar_decoration: null, profile_effect: null };
  const { data, error } = await supabase
    .from("user_profile_effects")
    .select(`equipped, profile_effects(${EFFECT_COLUMNS})`)
    .eq("user_id", userId)
    .eq("equipped", true);
  if (error) throw error;
  for (const row of (data ?? []) as Array<{
    equipped: boolean;
    profile_effects: Record<string, unknown> | null;
  }>) {
    if (!row.profile_effects) continue;
    const effect = presentEffect(row.profile_effects);
    if (effect.type === "avatar_decoration" || effect.type === "profile_effect") {
      worn[effect.type] = effect;
    }
  }
  return worn;
}

export function useWornEffects(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["worn-effects", userId],
    queryFn: () => fetchWornEffects(userId!),
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function useEffectCatalogue() {
  return useQuery({
    queryKey: ["effect-catalogue"],
    queryFn: fetchEffectCatalogue,
    staleTime: 5 * 60_000,
  });
}

export function useOwnedEffects(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["owned-effects", userId],
    queryFn: () => fetchOwnedEffects(userId!),
    enabled: !!userId,
    staleTime: 30_000,
  });
}

/** Refresh every surface that shows ownership, wear state or the wallet. */
export function invalidateEffects(qc: QueryClient, userId: string | null | undefined) {
  void qc.invalidateQueries({ queryKey: ["effect-catalogue"] });
  void qc.invalidateQueries({ queryKey: ["owned-effects", userId] });
  void qc.invalidateQueries({ queryKey: ["worn-effects", userId] });
}

/** Buy (or re-buy safely) one cosmetic. The server returns the new balance. */
export async function purchaseEffect(slug: string): Promise<{ balance: number; status: string }> {
  const { data, error } = await supabase.rpc("purchase_profile_effect", { _slug: slug });
  if (error) throw error;
  const payload = (data ?? {}) as { balance?: number; status?: string };
  return { balance: Number(payload.balance ?? 0), status: String(payload.status ?? "purchased") };
}

export async function equipEffect(slug: string): Promise<void> {
  const { error } = await supabase.rpc("equip_profile_effect", { _slug: slug });
  if (error) throw error;
}

export async function unequipEffect(slug: string): Promise<void> {
  const { error } = await supabase.rpc("unequip_profile_effect", { _slug: slug });
  if (error) throw error;
}
