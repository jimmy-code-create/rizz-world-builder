/**
 * The 12-badge RIZZ collection shown in the gallery and share cards.
 * Every badge is a hand-coded vector symbol in /badges/badges.svg; `symbol`
 * is the sprite id and `art` is the same reference kept for share cards.
 * Older RIZZ awards remain renderable below (mapped onto the current symbols)
 * so existing profiles do not lose badges during the catalog transition; they
 * are not counted in the 12-badge collection.
 */
export type BadgeTier = "common" | "rare" | "epic" | "legendary" | "mythic";

/**
 * What a badge measures, in a form the UI can turn into a progress bar.
 *
 * The badge's `flavor` is prose ("Earn 100 likes across your posts and
 * stories."); this is the same rule as data, so the collection can say
 * "42 / 100" instead of only repeating the sentence.
 */
export type BadgeCriteria =
  | { kind: "badges_earned"; target: number }
  | { kind: "likes_received"; target: number }
  | { kind: "messages_sent"; target: number }
  | { kind: "post_likes_max"; target: number }
  | { kind: "leaderboard_rank"; target: number }
  | { kind: "day_streak"; target: number }
  | { kind: "bounties_claimed"; target: number }
  | { kind: "games_won"; target: number }
  | { kind: "posts_published"; target: number };

export type CanonicalBadge = {
  slug: string;
  name: string;
  flavor: string;
  /**
   * The measurable rule behind the badge, when there is one. Badges that only
   * an admin can hand out have no criteria and no progress bar.
   */
  criteria?: BadgeCriteria;
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
    criteria: { kind: "badges_earned", target: 1 },
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
    criteria: { kind: "likes_received", target: 100 },
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
    criteria: { kind: "messages_sent", target: 100 },
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
    criteria: { kind: "post_likes_max", target: 50 },
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
    criteria: { kind: "leaderboard_rank", target: 10 },
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
    criteria: { kind: "day_streak", target: 7 },
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
    criteria: { kind: "day_streak", target: 30 },
    name: "30 Day Streak",
    flavor: "Show up on RIZZ thirty days in a row.",
    icon: ":cat_hype:",
    symbol: "streak-30",
    art: "/badges/badges.svg#streak-30",
    tier: "epic",
    glow: LIME,
  },
  {
    slug: "streamer",
    name: "Streamer",
    flavor: "Live in voice, hosting the room.",
    icon: ":cat_mic:",
    symbol: "streamer",
    art: "/badges/badges.svg#streamer",
    tier: "rare",
    glow: "#a855f7",
  },
  {
    slug: "bounty-hunter",
    criteria: { kind: "bounties_claimed", target: 1 },
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
    criteria: { kind: "games_won", target: 10 },
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
    // No bar on purpose: "early" means joining in RIZZ's first 30 days, which
    // has no per-member counter — account age is a different (and wrong) rule.
    // The server awards it from the first account's join date instead.
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
    slug: "hypesquad-bravery",
    name: "HypeSquad Bravery",
    flavor: "First in, no hesitation. Joined RIZZ in the first wave.",
    icon: ":cat_hype:",
    // A bolt, so it never collides with Early Supporter's shield.
    symbol: "hypesquad-bravery",
    art: "/badges/badges.svg#hypesquad-bravery",
    tier: "legendary",
    glow: LIME,
  },
  {
    slug: "verified_creator",
    name: "Verified Creator",
    flavor: "Official creator on RIZZ.",
    icon: ":cat_love:",
    // Its own mark: a creator seal (play glyph), not the member Verified check.
    symbol: "verified-creator",
    art: "/badges/badges.svg#verified-creator",
    tier: "epic",
    glow: LIME,
  },
  {
    slug: "founder",
    name: "RIZZ Team",
    flavor: "Built by the people behind RIZZ.",
    icon: ":cat_gg:",
    // A crest with rising bars, so the team mark never reads as member Verified.
    symbol: "rizzz-team",
    art: "/badges/badges.svg#rizzz-team",
    tier: "mythic",
    glow: LIME,
  },
  {
    slug: "main-character",
    name: "Main Character",
    flavor: "Content that moves the room.",
    icon: ":cat_hype:",
    // Spotlight star: distinct from Rising Star's plain star.
    symbol: "main-character",
    art: "/badges/badges.svg#main-character",
    tier: "epic",
    glow: LIME,
  },
  {
    slug: "voice-of-realm",
    name: "Voice of the Realms",
    flavor: "When they talk, rooms fill.",
    icon: ":cat_music:",
    // Voice bubble with a waveform, instead of borrowing Smooth Talker.
    symbol: "voice-of-realm",
    art: "/badges/badges.svg#voice-of-realm",
    tier: "epic",
    glow: WHITE,
  },
  {
    slug: "the-rizz",
    name: "The Rizz",
    flavor: "Not just rizz. The Rizz.",
    icon: ":cat_cool:",
    // A crowned gem for the one badge above Top Rizzler.
    symbol: "the-rizz",
    art: "/badges/badges.svg#the-rizz",
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

/**
 * Drop awards that would draw the same emblem twice (Verified + a legacy mark
 * that reused the check). The first badge in order wins, so the row reads as a
 * set of distinct symbols instead of a repeated icon.
 */
export function distinctBadges<T extends { slug: string }>(badges: T[]): T[] {
  const seen = new Set<string>();
  return badges.filter((badge) => {
    const symbol = canonicalFor(badge.slug)?.symbol ?? badge.slug;
    if (seen.has(symbol)) return false;
    seen.add(symbol);
    return true;
  });
}

export const TIER_LABEL: Record<BadgeTier, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  mythic: "Mythic",
};

/**
 * Profile showcase: the badges a member actively equips onto the body of
 * their profile (stored in `profiles.badges`). The cap keeps the row readable
 * — a curated handful beside the bio, not the whole cabinet.
 */
export const MAX_SHOWCASE_BADGES = 3;

/**
 * Equipped slugs cleaned for display: the member's own order is kept,
 * duplicates and unknown entries are dropped, and — the part that matters — a
 * slug survives only when it appears in `earned`. The profile therefore can
 * never show an emblem the member does not hold, whatever the stored column
 * contains. An absent column (migration not applied yet) reads as empty.
 */
export function showcaseBadges(
  stored: readonly string[] | null | undefined,
  earned: readonly { slug: string }[],
): string[] {
  const owned = new Set(earned.map((badge) => badge.slug));
  const seen = new Set<string>();
  const equipped: string[] = [];
  for (const slug of stored ?? []) {
    if (!slug || seen.has(slug) || !owned.has(slug)) continue;
    seen.add(slug);
    equipped.push(slug);
    if (equipped.length >= MAX_SHOWCASE_BADGES) break;
  }
  return equipped;
}
