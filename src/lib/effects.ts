import { supabase } from "@/integrations/supabase/client";

/**
 * Global cosmetics killswitch.
 *
 * Three looks ship, one per slot, so they can be worn together: Bloodweb
 * wraps the avatar, Puppy Love plays across the banner and Dark Moon frames
 * the whole profile. The catalog below is the only source of truth; removed
 * catalogue rows can never reach a profile.
 */
export const COSMETICS_ENABLED = true;

export type ProfileEffectType = "avatar_decoration" | "profile_effect" | "profile_frame";

export type ProfileEffect = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  type: ProfileEffectType;
  rarity: "common" | "rare" | "epic" | "legendary" | "mythic";
  unlock_rizz: number;
  paw_price: number;
  preview_color: string;
};

export const PUPPY_LOVE_SLUG = "fx-puppy-love";
export const BLOODWEB_SLUG = "fx-bloodweb";
export const DARK_MOON_SLUG = "fx-dark-moon";

/**
 * The banner effect.
 *
 * **Biscuit**, RIZZ's own floppy-eared pup: lime hoodie, heart-shaped shades,
 * one paw up and hearts drifting off the banner. It is an original character
 * drawn as transparent inline SVG (see `PuppyLoveEffect.tsx`) — no raster
 * asset, no background and nothing to clip.
 */
export const PUPPY_LOVE_EFFECT: ProfileEffect = {
  id: PUPPY_LOVE_SLUG,
  slug: PUPPY_LOVE_SLUG,
  name: "Puppy Love",
  description:
    "Biscuit, RIZZ's heart-eyed pup, leans into your banner in a lime hoodie and sends hearts floating across your profile.",
  type: "profile_effect",
  rarity: "mythic",
  unlock_rizz: 1800,
  paw_price: 1800,
  preview_color: "#c9ff3d",
};

/**
 * **Bloodweb** — a living collar of red veins and glowing nodes around the
 * avatar. Original transparent vector art (`BloodwebDecoration.tsx`), so it
 * scales from a 24px mention avatar to the 96px profile portrait.
 */
export const BLOODWEB_EFFECT: ProfileEffect = {
  id: BLOODWEB_SLUG,
  slug: BLOODWEB_SLUG,
  name: "Bloodweb",
  description:
    "A pulsing web of red veins and fever-bright nodes wraps your avatar. Give your avatar a new look.",
  type: "avatar_decoration",
  rarity: "mythic",
  unlock_rizz: 1400,
  paw_price: 1400,
  preview_color: "#ff2338",
};

/**
 * **Dark Moon** — a gothic branch-and-raven frame with a bone-white moon and
 * falling light. Original transparent vector art (`DarkMoonFrame.tsx`).
 */
export const DARK_MOON_EFFECT: ProfileEffect = {
  id: DARK_MOON_SLUG,
  slug: DARK_MOON_SLUG,
  name: "Dark Moon",
  description:
    "A bone-white moon behind black branches and red-eyed ravens, with cold light falling across your banner. Elevate and wrap your profile with a frame.",
  type: "profile_frame",
  rarity: "legendary",
  unlock_rizz: 1600,
  paw_price: 1600,
  preview_color: "#cfd6e2",
};

/** Every effect the app knows about, one per wearable slot. */
export const PROFILE_EFFECTS: ProfileEffect[] = [
  BLOODWEB_EFFECT,
  DARK_MOON_EFFECT,
  PUPPY_LOVE_EFFECT,
];

const EFFECTS_BY_SLUG = new Map(PROFILE_EFFECTS.map((effect) => [effect.slug, effect]));

/** True for a slug that still exists after the cleanup. */
export function isAvailableEffect(slug: string | null | undefined): slug is string {
  return Boolean(slug && EFFECTS_BY_SLUG.has(slug));
}

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

/**
 * The catalog, optionally enriched by rows in `profile_effects`.
 *
 * Rows for effects that no longer exist are dropped: a stale database entry
 * can never put a removed effect back on a profile.
 */
export async function fetchAllEffects(): Promise<ProfileEffect[]> {
  try {
    const { data } = await supabase.from("profile_effects").select("*").order("unlock_rizz");
    const merged = new Map(PROFILE_EFFECTS.map((effect) => [effect.slug, effect]));
    for (const row of (data ?? []) as ProfileEffect[]) {
      const known = merged.get(row.slug);
      if (known) merged.set(row.slug, { ...known, ...row, type: "profile_effect" });
    }
    return Array.from(merged.values());
  } catch {
    return PROFILE_EFFECTS;
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
    dbRows = ((data ?? []) as any[]).filter((row) => isAvailableEffect(row.effect?.slug));
  } catch {}

  const localEquipped = getLocalEquipped(userId);
  const byId = new Map(dbRows.map((r) => [r.effect_id, r]));

  // Merge locally acquired effects, but only ones that still exist.
  for (const eff of PROFILE_EFFECTS) {
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

export async function fetchEquippedEffects(
  userId: string,
): Promise<Partial<Record<ProfileEffectType, ProfileEffect>>> {
  const out: Partial<Record<ProfileEffectType, ProfileEffect>> = {};
  const localEquipped = getLocalEquipped(userId);

  try {
    const { data } = await supabase
      .from("user_profile_effects")
      .select("*, effect:profile_effects(*)")
      .eq("user_id", userId)
      .eq("equipped", true);

    for (const row of (data ?? []) as any[]) {
      const effect = row.effect as ProfileEffect | null;
      // Removed effects may still sit in the database; only the current
      // catalog is allowed to reach a profile. Each row fills its own slot.
      if (effect && isAvailableEffect(effect.slug)) {
        out[effect.type] = effect;
      }
    }
  } catch {}

  // Local fallback, filtered the same way.
  for (const [type, effId] of Object.entries(localEquipped) as [ProfileEffectType, string][]) {
    if (!out[type] && isAvailableEffect(effId)) {
      const match = EFFECTS_BY_SLUG.get(effId);
      if (match) out[type] = match;
    }
  }

  return out;
}

/** Whether the choice reached the database, or only this browser. */
export type EquipResult = { persisted: boolean };

export function isTrialActive(profile: { trial_active?: boolean | null; trial_ends_at?: string | null } | null) {
  if (!profile) return false;
  if (!profile.trial_active) return false;
  if (!profile.trial_ends_at) return true;
  return new Date(profile.trial_ends_at).getTime() > Date.now();
}

export async function equipEffect(
  userId: string,
  effectId: string,
  type: ProfileEffectType,
): Promise<EquipResult> {
  if (!COSMETICS_ENABLED) {
    throw new Error("Cosmetics are currently paused.");
  }
  const effect = EFFECTS_BY_SLUG.get(effectId);
  if (!effect || effect.type !== type) {
    throw new Error("That effect is no longer available.");
  }

  // Direct writes to user_profile_effects are revoked, so the secure RPC is
  // the only path that also makes the look visible to visitors.
  const { error } = await supabase.rpc("equip_profile_effect", { _slug: effectId });
  if (error) throw error;

  saveLocalAcquired(userId, effectId);
  saveLocalEquipped(userId, type, effectId);
  return { persisted: true };
}

export async function unequipEffect(
  userId: string,
  effectId: string,
  type?: ProfileEffectType,
): Promise<EquipResult> {
  const effect = EFFECTS_BY_SLUG.get(effectId);
  if (effect) saveLocalEquipped(userId, type ?? effect.type, null);

  const { error } = await supabase.rpc("unequip_profile_effect", { _slug: effectId });
  if (error) throw error;
  return { persisted: true };
}

export const RARITY_FLAT: Record<ProfileEffect["rarity"], string> = {
  common: "#94a3b8",
  rare: "#06b6d4",
  epic: "#a855f7",
  legendary: "#facc15",
  mythic: "#ec4899",
};

export const RARITY_GRADIENT: Record<ProfileEffect["rarity"], string> = RARITY_FLAT;
