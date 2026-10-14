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

export const DISCORD_SHOWCASE_EFFECTS: ProfileEffect[] = [
  // 1. Avatar Decorations
  {
    id: "deco-cyber-horns",
    slug: "deco-cyber-horns",
    name: "Cyber Oni Horns",
    description: "Holographic demon horns pulsing with high-tech cyan & magenta plasma sparks.",
    type: "avatar_decoration",
    rarity: "mythic",
    unlock_rizz: 1200,
    preview_color: "#06b6d4",
  },
  {
    id: "deco-celestial-halo",
    slug: "deco-celestial-halo",
    name: "Angelic Celestial Halo",
    description: "Floating radiant golden halo with orbiting starlight sparkle motes.",
    type: "avatar_decoration",
    rarity: "legendary",
    unlock_rizz: 800,
    preview_color: "#facc15",
  },
  {
    id: "deco-phoenix-flame",
    slug: "deco-phoenix-flame",
    name: "Phoenix Flame Aura",
    description: "Dancing fire plumes and rising embers flickering in blazing orange & crimson.",
    type: "avatar_decoration",
    rarity: "epic",
    unlock_rizz: 500,
    preview_color: "#f97316",
  },
  {
    id: "deco-sakura-bloom",
    slug: "deco-sakura-bloom",
    name: "Sakura Petal Orbit",
    description: "Delicate cherry blossom petals swirling in a gentle breeze around your avatar.",
    type: "avatar_decoration",
    rarity: "rare",
    unlock_rizz: 250,
    preview_color: "#fb7185",
  },
  {
    id: "deco-arcane-runes",
    slug: "deco-arcane-runes",
    name: "Arcane Spellcircle",
    description: "Dual counter-rotating concentric magic circles inscribed with glowing glyphs.",
    type: "avatar_decoration",
    rarity: "mythic",
    unlock_rizz: 1500,
    preview_color: "#a855f7",
  },
  {
    id: "deco-electric-storm",
    slug: "deco-electric-storm",
    name: "Plasma Surge Storm",
    description: "Crackling high-voltage lightning bolts and electric sparks snapping around you.",
    type: "avatar_decoration",
    rarity: "epic",
    unlock_rizz: 600,
    preview_color: "#38bdf8",
  },
  {
    id: "deco-neko-ears",
    slug: "deco-neko-ears",
    name: "Cyber Neko Ears",
    description: "Holographic cybernetic cat ears with ear-twitch animation and neon glow.",
    type: "avatar_decoration",
    rarity: "rare",
    unlock_rizz: 300,
    preview_color: "#ff2d92",
  },
  {
    id: "deco-glitch-matrix",
    slug: "deco-glitch-matrix",
    name: "Matrix Glitch Frame",
    description: "Cyberpunk chromatic aberration glitch frame with digital stream pulses.",
    type: "avatar_decoration",
    rarity: "legendary",
    unlock_rizz: 900,
    preview_color: "#22c55e",
  },
  {
    id: "deco-cosmic-vortex",
    slug: "deco-cosmic-vortex",
    name: "Cosmic Galaxy Vortex",
    description: "Swirling deep-space vortex with stardust trails and orbiting celestial bodies.",
    type: "avatar_decoration",
    rarity: "mythic",
    unlock_rizz: 1400,
    preview_color: "#818cf8",
  },

  // 2. Animated Nameplates
  {
    id: "np-cyberpunk",
    slug: "np-cyberpunk",
    name: "Cyberpunk HUD",
    description: "Futuristic tactical badge with angled corner brackets, status dot & cyan scan beam.",
    type: "nameplate",
    rarity: "mythic",
    unlock_rizz: 1200,
    preview_color: "#06b6d4",
  },
  {
    id: "np-cosmic",
    slug: "np-cosmic",
    name: "Cosmic Nebula",
    description: "Deep space galaxy banner with moving stardust particles and violet aura.",
    type: "nameplate",
    rarity: "legendary",
    unlock_rizz: 850,
    preview_color: "#a855f7",
  },
  {
    id: "np-sakura",
    slug: "np-sakura",
    name: "Sakura Blossom Garden",
    description: "Pastel rose frosted glass pill with blooming cherry petals and rose gold accents.",
    type: "nameplate",
    rarity: "rare",
    unlock_rizz: 300,
    preview_color: "#fb7185",
  },
  {
    id: "np-inferno",
    slug: "np-inferno",
    name: "Scorched Inferno",
    description: "Volcanic stone plate with burning lava fissures and floating fire sparks.",
    type: "nameplate",
    rarity: "epic",
    unlock_rizz: 600,
    preview_color: "#ea580c",
  },
  {
    id: "np-vaporwave",
    slug: "np-vaporwave",
    name: "Retro Synthwave 80s",
    description: "Outrun neon wireframe grid with sunset gradient scanlines and chrome sheen.",
    type: "nameplate",
    rarity: "rare",
    unlock_rizz: 350,
    preview_color: "#ec4899",
  },
  {
    id: "np-royal-gold",
    slug: "np-royal-gold",
    name: "Gilded VIP Crown",
    description: "Luxurious royal gold banner with crown emblem, diamond sparkle and metallic shine.",
    type: "nameplate",
    rarity: "legendary",
    unlock_rizz: 1000,
    preview_color: "#facc15",
  },
  {
    id: "np-glitch",
    slug: "np-glitch",
    name: "Glitch Runner",
    description: "Digital cyberpunk cyber-glitch frame with RGB channel twitch and slice distortion.",
    type: "nameplate",
    rarity: "epic",
    unlock_rizz: 650,
    preview_color: "#f43f5e",
  },
  {
    id: "np-aurora",
    slug: "np-aurora",
    name: "Boreal Aurora",
    description: "Flowing ethereal green & violet northern lights wave shimmering behind username.",
    type: "nameplate",
    rarity: "epic",
    unlock_rizz: 550,
    preview_color: "#10b981",
  },

  // 3. Full Profile Effects
  {
    id: "fx-cosmic-nebula",
    slug: "fx-cosmic-nebula",
    name: "Galaxy Supernova",
    description: "Starry galaxy overlay with twinkling stars, rotating nebula gas and shooting stars.",
    type: "profile_effect",
    rarity: "mythic",
    unlock_rizz: 2000,
    preview_color: "#818cf8",
  },
  {
    id: "fx-cyber-matrix",
    slug: "fx-cyber-matrix",
    name: "Cyberpunk Laser Grid",
    description: "Holographic descending laser scan line, digital perspective grid and data stream.",
    type: "profile_effect",
    rarity: "legendary",
    unlock_rizz: 1400,
    preview_color: "#06b6d4",
  },
  {
    id: "fx-cherry-petals",
    slug: "fx-cherry-petals",
    name: "Sakura Blossom Drift",
    description: "Silky cherry blossom petals floating gently across your profile banner.",
    type: "profile_effect",
    rarity: "rare",
    unlock_rizz: 400,
    preview_color: "#fb7185",
  },
  {
    id: "fx-dragon-inferno",
    slug: "fx-dragon-inferno",
    name: "Dragon's Inferno",
    description: "Rising volcanic embers, fiery heat haze and glowing flame sparks.",
    type: "profile_effect",
    rarity: "epic",
    unlock_rizz: 900,
    preview_color: "#f97316",
  },
  {
    id: "fx-thunder-storm",
    slug: "fx-thunder-storm",
    name: "Thunder Tempest",
    description: "Dramatic electric lightning bolts crackling across the banner with flash illumination.",
    type: "profile_effect",
    rarity: "epic",
    unlock_rizz: 950,
    preview_color: "#38bdf8",
  },
  {
    id: "fx-kawaii-hearts",
    slug: "fx-kawaii-hearts",
    name: "Pastel Fairy Hearts",
    description: "Floating soft pastel hearts with gentle pulse and twinkling fairy sparkles.",
    type: "profile_effect",
    rarity: "common",
    unlock_rizz: 100,
    preview_color: "#ff2d92",
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

export const RARITY_GRADIENT: Record<ProfileEffect["rarity"], string> = {
  common: "linear-gradient(135deg, #94a3b8, #cbd5e1)",
  rare: "linear-gradient(135deg, #22d3ee, #06b6d4)",
  epic: "linear-gradient(135deg, #a855f7, #ec4899)",
  legendary: "linear-gradient(135deg, #facc15, #f97316)",
  mythic: "linear-gradient(135deg, #ff2d92, #a855f7, #22d3ee)",
};
