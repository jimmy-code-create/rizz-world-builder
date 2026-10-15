/**
 * The one canonical badge set. Exactly these 5 exist in the UI — profile
 * rows, hover cards, post name chips and /badges all filter to these slugs
 * and render the app's own cat emojis (never prompt-emoji copies).
 */
export type BadgeTier = "rare" | "epic" | "mythic";

export type CanonicalBadge = {
  slug: string;
  name: string;
  flavor: string;
  /** Cat-emoji shortcode rendered with <CatEmoji/>. */
  icon: string;
  tier: BadgeTier;
  /** Tier glow color (mythic pink-red, epic purple, rare blue). */
  glow: string;
};

export const BADGE_SET: CanonicalBadge[] = [
  {
    slug: "founder",
    name: "Founder",
    flavor: "The originals.",
    icon: ":cat_gg:",
    tier: "mythic",
    glow: "#ff4d6d",
  },
  {
    slug: "main-character",
    name: "Main Character",
    flavor: "Content that moves the room.",
    icon: ":cat_hype:",
    tier: "epic",
    glow: "#a855f7",
  },
  {
    slug: "voice-of-realm",
    name: "Voice of the Realm",
    flavor: "When they talk, rooms fill.",
    icon: ":cat_music:",
    tier: "epic",
    glow: "#a855f7",
  },
  {
    slug: "the-rizz",
    name: "The Rizz",
    flavor: "Not just rizz. The Rizz.",
    icon: ":cat_cool:",
    tier: "mythic",
    glow: "#ff4d6d",
  },
  {
    slug: "no-cap",
    name: "No Cap",
    flavor: "Real one. No cap.",
    icon: ":cat_love:",
    tier: "rare",
    glow: "#3b82f6",
  },
];

const SET_ORDER: Record<string, number> = Object.fromEntries(BADGE_SET.map((b, i) => [b.slug, i]));

export function isBadgeInSet(slug: string | null | undefined): boolean {
  return !!slug && slug in SET_ORDER;
}

export function canonicalFor(slug: string | null | undefined): CanonicalBadge | null {
  if (!slug) return null;
  return BADGE_SET.find((b) => b.slug === slug) ?? null;
}

/** Keep only set badges (dedupe by slug), in canonical order. */
export function canonBadges<T extends { slug: string }>(badges: T[]): T[] {
  const seen = new Set<string>();
  return badges
    .filter((b) => {
      if (!isBadgeInSet(b.slug) || seen.has(b.slug)) return false;
      seen.add(b.slug);
      return true;
    })
    .sort((a, b) => (SET_ORDER[a.slug] ?? 99) - (SET_ORDER[b.slug] ?? 99));
}

export const TIER_LABEL: Record<BadgeTier, string> = {
  rare: "Rare",
  epic: "Epic",
  mythic: "Mythic",
};
