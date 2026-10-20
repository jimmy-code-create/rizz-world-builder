import { supabase } from "@/integrations/supabase/client";

/**
 * Global cosmetics killswitch.
 *
 * Only one cosmetic ships today: the Web Slinger profile effect. Every other
 * decoration, nameplate and profile overlay has been removed, and the catalog
 * below is the only source of truth for what can be equipped. The flag stays
 * so the whole surface can still be paused in one line.
 */
export const COSMETICS_ENABLED = true;

export type ProfileEffectType = "profile_effect";

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

export const WEB_SLINGER_SLUG = "fx-web-slinger";

/**
 * The one effect.
 *
 * An original masked web-slinger — red-and-blue suit, black web lattice,
 * white lenses — crouched on a web strand with both hands slinging. It is
 * drawn as transparent inline SVG (see `WebSlingerEffect.tsx`), so there is no
 * raster asset, no background and nothing to clip.
 */
export const WEB_SLINGER_EFFECT: ProfileEffect = {
  id: WEB_SLINGER_SLUG,
  slug: WEB_SLINGER_SLUG,
  name: "Web Slinger",
  description:
    "A masked web-slinger crouches on a strand, lenses lit, webbing thrown across your profile.",
  type: "profile_effect",
  rarity: "mythic",
  unlock_rizz: 1800,
  preview_color: "#e8253f",
};

/** Every effect the app knows about. */
export const PROFILE_EFFECTS: ProfileEffect[] = [WEB_SLINGER_EFFECT];

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
      // catalog is allowed to reach a profile.
      if (effect && effect.type === "profile_effect" && isAvailableEffect(effect.slug)) {
        out.profile_effect = effect;
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

/**
 * The database keys effects by uuid; the catalogue keys them by slug. Resolve
 * the row once so equipping works whatever uuid a deployment seeded.
 */
async function resolveEffectRowId(slug: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("profile_effects")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    return (data as { id?: string } | null)?.id ?? null;
  } catch {
    return null;
  }
}

/** Whether the choice reached the database, or only this browser. */
export type EquipResult = { persisted: boolean };

export async function acquireEffect(userId: string, effectId: string): Promise<EquipResult> {
  if (!COSMETICS_ENABLED) {
    throw new Error("Cosmetics are currently paused.");
  }
  if (!isAvailableEffect(effectId)) {
    throw new Error("That effect is no longer available.");
  }
  saveLocalAcquired(userId, effectId);
  const rowId = await resolveEffectRowId(effectId);
  if (!rowId) return { persisted: false };
  const { error } = await supabase
    .from("user_profile_effects")
    .upsert(
      { user_id: userId, effect_id: rowId, equipped: false },
      { onConflict: "user_id,effect_id" },
    );
  return { persisted: !error };
}

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
  // The local copy is instant and is what the owner sees even before the
  // request settles; the database row is what visitors read.
  saveLocalAcquired(userId, effectId);
  saveLocalEquipped(userId, type, effectId);

  const rowId = await resolveEffectRowId(effectId);
  if (!rowId) return { persisted: false };
  const { error } = await supabase
    .from("user_profile_effects")
    .upsert(
      { user_id: userId, effect_id: rowId, equipped: true },
      { onConflict: "user_id,effect_id" },
    );
  return { persisted: !error };
}

export async function unequipEffect(
  userId: string,
  effectId: string,
  type?: ProfileEffectType,
): Promise<EquipResult> {
  if (type) saveLocalEquipped(userId, type, null);
  else if (EFFECTS_BY_SLUG.has(effectId)) saveLocalEquipped(userId, "profile_effect", null);

  const rowId = await resolveEffectRowId(effectId);
  if (!rowId) return { persisted: true };
  const { error } = await supabase
    .from("user_profile_effects")
    .update({ equipped: false })
    .eq("user_id", userId)
    .eq("effect_id", rowId);
  return { persisted: !error };
}

export const RARITY_FLAT: Record<ProfileEffect["rarity"], string> = {
  common: "#94a3b8",
  rare: "#06b6d4",
  epic: "#a855f7",
  legendary: "#facc15",
  mythic: "#ec4899",
};

export const RARITY_GRADIENT: Record<ProfileEffect["rarity"], string> = RARITY_FLAT;
