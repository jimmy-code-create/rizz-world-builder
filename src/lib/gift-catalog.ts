/**
 * RIZZ Luxury Gift Catalog — "Flex Drops & The Garage"
 *
 * Pure data, no side effects. Every gift carries its Paws price, tier,
 * animation type and sound so the overlay player can render the right flex
 * without knowing anything about the sender or receiver.
 */

export type GiftTier = "drip" | "supercars" | "millionaire" | "god-flex";

/** One takeover now carries every gift: the RIZZ cat rocket. */
export type GiftAnimation = "rocket-launch";

export type GiftSound = "rocket-launch";

export type Gift = {
  /** Stable key used in URLs and analytics. */
  slug: string;
  /** Display name. */
  name: string;
  /** Paws cost to send. */
  pawsPrice: number;
  /** Tier label for grouping in the picker. */
  tier: GiftTier;
  /** The one full-screen animation every gift launches. */
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
    animation: "rocket-launch",
    sound: "rocket-launch",
    emoji: "💎",
    accent: "#c9ff3d",
  },
  {
    slug: "matte-cybertruck",
    name: "Matte Cybertruck",
    pawsPrice: 1_500,
    tier: "supercars",
    animation: "rocket-launch",
    sound: "rocket-launch",
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
    animation: "rocket-launch",
    sound: "rocket-launch",
    emoji: "🏎️",
    accent: "#a3e635",
  },
  {
    slug: "matte-g-wagon",
    name: "Matte G-Wagon",
    pawsPrice: 15_000,
    tier: "supercars",
    animation: "rocket-launch",
    sound: "rocket-launch",
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
    animation: "rocket-launch",
    sound: "rocket-launch",
    emoji: "✈️",
    accent: "#f472b6",
  },
  {
    slug: "bugatti-chiron",
    name: "Bugatti Chiron",
    pawsPrice: 50_000,
    tier: "millionaire",
    animation: "rocket-launch",
    sound: "rocket-launch",
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
    animation: "rocket-launch",
    sound: "rocket-launch",
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

/** Every gift is now a full-screen rocket takeover. */
export function isFullScreenFlex(_gift: Gift): boolean {
  return true;
}

/** The garage valuation of a list of owned gifts, in Paws. */
export function garageValuation(gifts: readonly Gift[]): number {
  return gifts.reduce((sum, g) => sum + g.pawsPrice, 0);
}
