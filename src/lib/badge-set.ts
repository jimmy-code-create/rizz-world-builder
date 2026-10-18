/**
 * The 12-badge RIZZ collection shown in the gallery and share cards.
 * Every badge is a hand-coded vector symbol in /badges/badges.svg; `symbol`
 * is the sprite id and `art` is the same reference kept for share cards.
 * Older RIZZ awards remain renderable below (mapped onto the current symbols)
 * so existing profiles do not lose badges during the catalog transition; they
 * are not counted in the 12-badge collection.
 */
export type BadgeTier = "common" | "rare" | "epic" | "legendary" | "mythic";

export type CanonicalBadge = {
  slug: string;
  name: string;
  flavor: string;
  /**
   * Legacy emoji shortcode, kept only as a last-resort fallback for unknown
   * slugs; the 12-badge set always renders its vector symbol instead.
   */
  icon: string;
  /** Sprite symbol id inside /badges/badges.svg. */
  symbol: string;
  /** Stable reference to the vector artwork (sprite + symbol). */
  art: string;
  tier: BadgeTier;
  /**
   * Single tint used by surrounding UI (chips, rarity rows). Part of the
   * badge palette: lime for signal tones, white for quiet tones.
   */
  glow: string;
};

const LIME = "#C6FF1A";
const WHITE = "#F2F2F2";

export const BADGE_SET: CanonicalBadge[] = [
  {
    slug: "rookie",
    name: "Newcomer",
    flavor: "Join RIZZ and claim your first badge.",
    icon: ":cat_gg:",
    symbol: "rookie",
    art: "/badges/badges.svg#rookie",
    tier: "common",
    glow: WHITE,
  },
  {
    slug: "rising-star",
    name: "Rising Star",
    flavor: "Earn 100 likes across your posts and stories.",
    icon: ":cat_hype:",
    symbol: "rising-star",
    art: "/badges/badges.svg#rising-star",
    tier: "rare",
    glow: LIME,
  },
  {
    slug: "smooth-talker",
    name: "Chatterbox",
    flavor: "Send 100 messages across RIZZ chats.",
    icon: ":cat_music:",
    symbol: "smooth-talker",
    art: "/badges/badges.svg#smooth-talker",
    tier: "common",
    glow: WHITE,
  },
  {
    slug: "night-owl",
    name: "Night Owl",
    flavor: "Take part in RIZZ between midnight and 4am.",
    icon: ":cat_cool:",
    symbol: "night-owl",
    art: "/badges/badges.svg#night-owl",
    tier: "rare",
    glow: WHITE,
  },
  {
    slug: "meme-lord",
    name: "Meme Lord",
    flavor: "Make a post that reaches 50 likes.",
    icon: ":cat_hype:",
    symbol: "meme-lord",
    art: "/badges/badges.svg#meme-lord",
    tier: "epic",
    glow: WHITE,
  },
  {
    slug: "top-rizzler",
    name: "Top Rizzler",
    flavor: "Reach the top 10 on the RIZZ leaderboard.",
    icon: ":cat_gg:",
    symbol: "top-rizzler",
    art: "/badges/badges.svg#top-rizzler",
    tier: "legendary",
    glow: LIME,
  },
  {
    slug: "verified",
    name: "Verified",
    flavor: "Verified by a RIZZ admin.",
    icon: ":cat_love:",
    symbol: "verified",
    art: "/badges/badges.svg#verified",
    tier: "rare",
    glow: LIME,
  },
  {
    slug: "streak-7",
    name: "7 Day Streak",
    flavor: "Show up on RIZZ seven days in a row.",
    icon: ":cat_gg:",
    symbol: "streak-7",
    art: "/badges/badges.svg#streak-7",
    tier: "rare",
    glow: LIME,
  },
  {
    slug: "streak-30",
    name: "30 Day Streak",
    flavor: "Show up on RIZZ thirty days in a row.",
    icon: ":cat_hype:",
    symbol: "streak-30",
    art: "/badges/badges.svg#streak-30",
    tier: "epic",
    glow: LIME,
  },
  {
    slug: "bounty-hunter",
    name: "Bounty Hunter",
    flavor: "Complete a RIZZ bounty.",
    icon: ":cat_cool:",
    symbol: "bounty-hunter",
    art: "/badges/badges.svg#bounty-hunter",
    tier: "epic",
    glow: WHITE,
  },
  {
    slug: "game-champ",
    name: "Game Champ",
    flavor: "Win ten RIZZ games.",
    icon: ":cat_gg:",
    symbol: "game-champ",
    art: "/badges/badges.svg#game-champ",
    tier: "legendary",
    glow: WHITE,
  },
  {
    slug: "og",
    name: "Early Supporter",
    flavor: "Your account joined in RIZZ's first 30 days.",
    icon: ":cat_love:",
    symbol: "og",
    art: "/badges/badges.svg#og",
    tier: "mythic",
    glow: LIME,
  },
];

/** Existing awards stay visible by reusing the closest current symbol. */
export const LEGACY_BADGE_SET: CanonicalBadge[] = [
  {
    slug: "founder",
    name: "RIZZ Team",
    flavor: "Built by the people behind RIZZ.",
    icon: ":cat_gg:",
    symbol: "verified",
    art: "/badges/badges.svg#verified",
    tier: "mythic",
    glow: LIME,
  },
  {
    slug: "main-character",
    name: "Main Character",
    flavor: "Content that moves the room.",
    icon: ":cat_hype:",
    symbol: "rising-star",
    art: "/badges/badges.svg#rising-star",
    tier: "epic",
    glow: LIME,
  },
  {
    slug: "voice-of-realm",
    name: "Voice of the Realms",
    flavor: "When they talk, rooms fill.",
    icon: ":cat_music:",
    symbol: "smooth-talker",
    art: "/badges/badges.svg#smooth-talker",
    tier: "epic",
    glow: WHITE,
  },
  {
    slug: "the-rizz",
    name: "The Rizz",
    flavor: "Not just rizz. The Rizz.",
    icon: ":cat_cool:",
    symbol: "top-rizzler",
    art: "/badges/badges.svg#top-rizzler",
    tier: "mythic",
    glow: LIME,
  },
  {
    slug: "no-cap",
    name: "Verified",
    flavor: "Identity verified. A real one, no cap.",
    icon: ":cat_love:",
    symbol: "verified",
    art: "/badges/badges.svg#verified",
    tier: "rare",
    glow: LIME,
  },
];

const ALL_BADGES = [...BADGE_SET, ...LEGACY_BADGE_SET];

export function badgeArtForSlug(slug: string | null | undefined): string | undefined {
  return ALL_BADGES.find((badge) => badge.slug === slug)?.art;
}

export function badgeSymbolForSlug(slug: string | null | undefined): string | undefined {
  return ALL_BADGES.find((badge) => badge.slug === slug)?.symbol;
}

const SET_ORDER: Record<string, number> = Object.fromEntries(ALL_BADGES.map((b, i) => [b.slug, i]));

export function isBadgeInSet(slug: string | null | undefined): boolean {
  return !!slug && slug in SET_ORDER;
}

export function canonicalFor(slug: string | null | undefined): CanonicalBadge | null {
  if (!slug) return null;
  return ALL_BADGES.find((b) => b.slug === slug) ?? null;
}

/** Keep known badges (dedupe by slug) in the 12-badge order, then legacy order. */
export function canonBadges<T extends { slug: string }>(badges: T[]): T[] {
  const seen = new Set<string>();
  const slugs = new Set(badges.map((badge) => badge.slug));
  return badges
    .filter((b) => {
      if (b.slug === "no-cap" && slugs.has("verified")) return false;
      if (!isBadgeInSet(b.slug) || seen.has(b.slug)) return false;
      seen.add(b.slug);
      return true;
    })
    .sort((a, b) => (SET_ORDER[a.slug] ?? 99) - (SET_ORDER[b.slug] ?? 99));
}

export const TIER_LABEL: Record<BadgeTier, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  mythic: "Mythic",
};
