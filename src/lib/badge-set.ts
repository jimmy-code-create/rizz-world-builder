/**
 * The 12-badge RIZZ collection shown in the gallery and share cards.
 * Older RIZZ awards remain renderable below so existing profiles do not lose
 * badges during the catalog transition; they are not counted in the 12-badge
 * collection.
 */
export type BadgeTier = "common" | "rare" | "epic" | "legendary" | "mythic";

export type CanonicalBadge = {
  slug: string;
  name: string;
  flavor: string;
  /** Legacy emoji fallback for badges without custom artwork. */
  icon: string;
  /** Stable, transparent 256px artwork for cards, profiles, and sharing. */
  art: string;
  /** Crisp 48px artwork for compact name-row chips. */
  miniArt?: string;
  tier: BadgeTier;
  glow: string;
};

export const BADGE_SET: CanonicalBadge[] = [
  {
    slug: "rookie",
    name: "Newcomer",
    flavor: "Join RIZZ and claim your first badge.",
    icon: ":cat_gg:",
    art: "/badges/rookie.png",
    miniArt: "/badges/mini/rookie.png",
    tier: "common",
    glow: "#62e6c6",
  },
  {
    slug: "rising-star",
    name: "Rising Star",
    flavor: "Earn 100 likes across your posts and stories.",
    icon: ":cat_hype:",
    art: "/badges/rising-star.png",
    miniArt: "/badges/mini/rising-star.png",
    tier: "rare",
    glow: "#84e3ff",
  },
  {
    slug: "smooth-talker",
    name: "Chatterbox",
    flavor: "Send 100 messages across RIZZ chats.",
    icon: ":cat_music:",
    art: "/badges/smooth-talker.png",
    miniArt: "/badges/mini/smooth-talker.png",
    tier: "common",
    glow: "#ffcb69",
  },
  {
    slug: "night-owl",
    name: "Night Owl",
    flavor: "Take part in RIZZ between midnight and 4am.",
    icon: ":cat_cool:",
    art: "/badges/night-owl.png",
    miniArt: "/badges/mini/night-owl.png",
    tier: "rare",
    glow: "#c3a6ff",
  },
  {
    slug: "meme-lord",
    name: "Meme Lord",
    flavor: "Make a post that reaches 50 likes.",
    icon: ":cat_hype:",
    art: "/badges/meme-lord.png",
    miniArt: "/badges/mini/meme-lord.png",
    tier: "epic",
    glow: "#ff8fb4",
  },
  {
    slug: "top-rizzler",
    name: "Top Rizzler",
    flavor: "Reach the top 10 on the RIZZ leaderboard.",
    icon: ":cat_gg:",
    art: "/badges/top-rizzler.png",
    miniArt: "/badges/mini/top-rizzler.png",
    tier: "legendary",
    glow: "#ffe27d",
  },
  {
    slug: "verified",
    name: "Verified",
    flavor: "Verified by a RIZZ admin.",
    icon: ":cat_love:",
    art: "/badges/verified.png",
    miniArt: "/badges/mini/verified.png",
    tier: "rare",
    glow: "#77c7ff",
  },
  {
    slug: "streak-7",
    name: "7 Day Streak",
    flavor: "Show up on RIZZ seven days in a row.",
    icon: ":cat_gg:",
    art: "/badges/streak-7.png",
    miniArt: "/badges/mini/streak-7.png",
    tier: "rare",
    glow: "#ffae68",
  },
  {
    slug: "streak-30",
    name: "30 Day Streak",
    flavor: "Show up on RIZZ thirty days in a row.",
    icon: ":cat_hype:",
    art: "/badges/streak-30.png",
    miniArt: "/badges/mini/streak-30.png",
    tier: "epic",
    glow: "#ff7194",
  },
  {
    slug: "bounty-hunter",
    name: "Bounty Hunter",
    flavor: "Complete a RIZZ bounty.",
    icon: ":cat_cool:",
    art: "/badges/bounty-hunter.png",
    miniArt: "/badges/mini/bounty-hunter.png",
    tier: "epic",
    glow: "#9be178",
  },
  {
    slug: "game-champ",
    name: "Game Champ",
    flavor: "Win ten RIZZ games.",
    icon: ":cat_gg:",
    art: "/badges/game-champ.png",
    miniArt: "/badges/mini/game-champ.png",
    tier: "legendary",
    glow: "#9b9bff",
  },
  {
    slug: "og",
    name: "Early Supporter",
    flavor: "Your account joined in RIZZ's first 30 days.",
    icon: ":cat_love:",
    art: "/badges/og.png",
    miniArt: "/badges/mini/og.png",
    tier: "mythic",
    glow: "#f4d882",
  },
];

/** Existing awards stay visible while accounts migrate to the 12-badge set. */
export const LEGACY_BADGE_SET: CanonicalBadge[] = [
  {
    slug: "founder",
    name: "RIZZ Team",
    flavor: "Built by the people behind RIZZ.",
    icon: ":cat_gg:",
    art: "/badges/rizz-team.png",
    tier: "mythic",
    glow: "#c8ff3d",
  },
  {
    slug: "main-character",
    name: "Main Character",
    flavor: "Content that moves the room.",
    icon: ":cat_hype:",
    art: "/badges/main-character.png",
    tier: "epic",
    glow: "#a855f7",
  },
  {
    slug: "voice-of-realm",
    name: "Voice of the Realms",
    flavor: "When they talk, rooms fill.",
    icon: ":cat_music:",
    art: "/badges/voice-of-the-realms.png",
    tier: "epic",
    glow: "#a855f7",
  },
  {
    slug: "the-rizz",
    name: "The Rizz",
    flavor: "Not just rizz. The Rizz.",
    icon: ":cat_cool:",
    art: "/badges/the-rizz.png",
    tier: "mythic",
    glow: "#ff4d6d",
  },
  {
    slug: "no-cap",
    name: "Verified",
    flavor: "Identity verified. A real one, no cap.",
    icon: ":cat_love:",
    art: "/badges/verified.png",
    tier: "rare",
    glow: "#3b82f6",
  },
];

const ALL_BADGES = [...BADGE_SET, ...LEGACY_BADGE_SET];

export function badgeArtForSlug(slug: string | null | undefined): string | undefined {
  return ALL_BADGES.find((badge) => badge.slug === slug)?.art;
}

export function badgeMiniArtForSlug(slug: string | null | undefined): string | undefined {
  return BADGE_SET.find((badge) => badge.slug === slug)?.miniArt ?? badgeArtForSlug(slug);
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
