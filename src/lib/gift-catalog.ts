/**
 * RIZZ Luxury Gift Catalog — "Flex Drops & The Garage"
 *
 * Pure data, no side effects. Every gift carries its Paws price, tier,
 * animation type and sound so the overlay player can render the right flex
 * without knowing anything about the sender or receiver.
 */

export type GiftTier = "drip" | "supercars" | "millionaire" | "god-flex";

export type GiftAnimation =
  | "drive-by"        // vehicle sweeps right -> left across the screen
  | "jet-flyover"     // jet flies across the top with a smoke trail
  | "yacht-fireworks" // water splash + champagne pop + golden confetti
  | "chain-sparkle";  // diamond sparkle beam

export type GiftSound =
  | "engine-rev"     // rising V8 growl
  | "tire-screech"   // high-pitch burnout squeal
  | "jet-engine"     // low rumble + turbine whine
  | "champagne-pop"  // quick cork pop
  | "diamond-ting";  // crisp glass chime

export type Gift = {
  /** Stable key used in URLs and analytics. */
  slug: string;
  /** Display name. */
  name: string;
  /** Paws cost to send. */
  pawsPrice: number;
  /** Tier label for grouping in the picker. */
  tier: GiftTier;
  /** Which full-screen animation plays. */
  animation: GiftAnimation;
  /** Which sound effect plays. */
  sound: GiftSound;
  /** Emoji used as the vehicle visual in the overlay. */
  emoji: string;
  /** Accent tint for the banner and particles. */
  accent: string;
};

/** Every gift that can be dropped, cheapest shelf first. */
export const GIFT_CATALOG: readonly Gift[] = [
  // ------------------------------------------------------------------
  // Tier 1: Drip
  // ------------------------------------------------------------------
  {
    slug: "iced-out-chain",
    name: "Iced Out Chain",
    pawsPrice: 500,
    tier: "drip",
    animation: "chain-sparkle",
    sound: "diamond-ting",
    emoji: "💎",
    accent: "#c9ff3d",
  },
  {
    slug: "matte-cybertruck",
    name: "Matte Cybertruck",
    pawsPrice: 1_500,
    tier: "supercars",
    animation: "drive-by",
    sound: "tire-screech",
    emoji: "🛻",
    accent: "#8b7cf6",
  },
  // ------------------------------------------------------------------
  // Tier 2: Supercars
  // ------------------------------------------------------------------
  {
    slug: "lime-aventador",
    name: "Lime Aventador",
    pawsPrice: 10_000,
    tier: "supercars",
    animation: "drive-by",
    sound: "engine-rev",
    emoji: "🏎️",
    accent: "#a3e635",
  },
  {
    slug: "matte-g-wagon",
    name: "Matte G-Wagon",
    pawsPrice: 15_000,
    tier: "supercars",
    animation: "drive-by",
    sound: "engine-rev",
    emoji: "🚗",
    accent: "#fbbf24",
  },
  // ------------------------------------------------------------------
  // Tier 3: Millionaire
  // ------------------------------------------------------------------
  {
    slug: "rizz-gulfstream-jet",
    name: "RIZZ Gulfstream Jet",
    pawsPrice: 35_000,
    tier: "millionaire",
    animation: "jet-flyover",
    sound: "jet-engine",
    emoji: "✈️",
    accent: "#f472b6",
  },
  {
    slug: "bugatti-chiron",
    name: "Bugatti Chiron",
    pawsPrice: 50_000,
    tier: "millionaire",
    animation: "drive-by",
    sound: "engine-rev",
    emoji: "🏎️",
    accent: "#a78bfa",
  },
  // ------------------------------------------------------------------
  // Tier 4: God Flex
  // ------------------------------------------------------------------
  {
    slug: "super-yacht-fireworks",
    name: "Super Yacht & Fireworks",
    pawsPrice: 100_000,
    tier: "god-flex",
    animation: "yacht-fireworks",
    sound: "champagne-pop",
    emoji: "🛥️",
    accent: "#fde047",
  },
] as const;

/** Lookup by slug. Throws if the slug isn't in the catalog. */
export function findGift(slug: string): Gift {
  const gift = GIFT_CATALOG.find((g) => g.slug === slug);
  if (!gift) throw new Error(`Unknown gift slug: ${slug}`);
  return gift;
}

/** Gifts grouped by tier, for the picker's category tabs. */
export function giftsByTier(): Record<GiftTier, readonly Gift[]> {
  const out: Record<GiftTier, Gift[]> = {
    drip: [],
    supercars: [],
    millionaire: [],
    "god-flex": [],
  };
  for (const gift of GIFT_CATALOG) {
    out[gift.tier].push(gift);
  }
  return out as Record<GiftTier, readonly Gift[]>;
}

/** True when the gift triggers a full-screen takeover (everything except chain). */
export function isFullScreenFlex(gift: Gift): boolean {
  return gift.animation !== "chain-sparkle";
}

/** The garage valuation of a list of owned gifts, in Paws. */
export function garageValuation(gifts: readonly Gift[]): number {
  return gifts.reduce((sum, g) => sum + g.pawsPrice, 0);
}
