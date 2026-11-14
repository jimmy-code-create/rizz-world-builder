/**
 * Cat Studio catalog.
 *
 * Prices live here (config), never in the drawing code, and the same table is
 * mirrored into the SQL seed so the server never trusts a client price. Every
 * item is drawn from this app's own vocabulary — no uploads, no URLs.
 */
export const CAT_RARITIES = ["common", "rare", "epic", "legendary", "luxe"] as const;
export type CatRarity = (typeof CAT_RARITIES)[number];

export type CatSlotId = "hat" | "eyewear" | "neck" | "face" | "back" | "backdrop";

export type CatItem = {
  id: string;
  slot: CatSlotId;
  name: string;
  rarity: CatRarity;
  price: number;
  requires_purify: boolean;
};

export const RARITY_LABEL: Record<CatRarity, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  luxe: "Luxe",
};

export const CAT_ITEMS: CatItem[] = [
  // Hats
  { id: "hat_crown", slot: "hat", name: "Crown", rarity: "rare", price: 180, requires_purify: false },
  { id: "hat_top_hat", slot: "hat", name: "Top hat", rarity: "rare", price: 240, requires_purify: false },
  { id: "hat_beret", slot: "hat", name: "Beret", rarity: "common", price: 120, requires_purify: false },
  { id: "hat_beanie", slot: "hat", name: "Beanie", rarity: "common", price: 90, requires_purify: false },
  { id: "hat_halo", slot: "hat", name: "Halo", rarity: "legendary", price: 640, requires_purify: false },
  { id: "hat_star_crown", slot: "hat", name: "Star crown", rarity: "luxe", price: 1200, requires_purify: true },

  // Eyewear
  { id: "eyewear_sunglasses", slot: "eyewear", name: "Sunglasses", rarity: "common", price: 90, requires_purify: false },
  { id: "eyewear_monocle", slot: "eyewear", name: "Monocle", rarity: "rare", price: 160, requires_purify: false },
  { id: "eyewear_heart", slot: "eyewear", name: "Heart glasses", rarity: "epic", price: 320, requires_purify: false },
  { id: "eyewear_visor", slot: "eyewear", name: "Visor", rarity: "rare", price: 140, requires_purify: false },
  { id: "eyewear_diamond", slot: "eyewear", name: "Diamond specs", rarity: "luxe", price: 980, requires_purify: true },

  // Neck
  { id: "neck_gold_chain", slot: "neck", name: "Gold chain", rarity: "rare", price: 220, requires_purify: false },
  { id: "neck_pearls", slot: "neck", name: "Pearl necklace", rarity: "epic", price: 300, requires_purify: false },
  { id: "neck_bow_tie", slot: "neck", name: "Bow tie", rarity: "common", price: 110, requires_purify: false },
  { id: "neck_diamond_collar", slot: "neck", name: "Diamond collar", rarity: "luxe", price: 900, requires_purify: true },
  { id: "neck_bandana", slot: "neck", name: "Bandana", rarity: "common", price: 80, requires_purify: false },

  // Face
  { id: "face_blush", slot: "face", name: "Blush", rarity: "common", price: 70, requires_purify: false },
  { id: "face_whisker_gems", slot: "face", name: "Whisker gems", rarity: "epic", price: 450, requires_purify: false },
  { id: "face_star_sticker", slot: "face", name: "Star sticker", rarity: "rare", price: 150, requires_purify: false },
  { id: "face_freckles", slot: "face", name: "Freckles", rarity: "common", price: 60, requires_purify: false },
  { id: "face_tear", slot: "face", name: "Single tear", rarity: "rare", price: 130, requires_purify: false },

  // Back
  { id: "back_velvet_cape", slot: "back", name: "Velvet cape", rarity: "legendary", price: 700, requires_purify: false },
  { id: "back_scarf", slot: "back", name: "Long scarf", rarity: "common", price: 100, requires_purify: false },
  { id: "back_wings", slot: "back", name: "Bat wings", rarity: "epic", price: 520, requires_purify: false },
  { id: "back_backpack", slot: "back", name: "Tiny backpack", rarity: "common", price: 120, requires_purify: false },
  { id: "back_aurora_cloak", slot: "back", name: "Aurora cloak", rarity: "luxe", price: 1100, requires_purify: true },

  // Backdrop
  { id: "backdrop_solid", slot: "backdrop", name: "Solid", rarity: "common", price: 0, requires_purify: false },
  { id: "backdrop_marble", slot: "backdrop", name: "Marble", rarity: "rare", price: 200, requires_purify: false },
  { id: "backdrop_velvet", slot: "backdrop", name: "Velvet curtain", rarity: "epic", price: 340, requires_purify: false },
  { id: "backdrop_city", slot: "backdrop", name: "City night", rarity: "legendary", price: 480, requires_purify: false },
  { id: "backdrop_luxe_night", slot: "backdrop", name: "Luxe night", rarity: "luxe", price: 860, requires_purify: true },
];

const BY_ID = new Map(CAT_ITEMS.map((item) => [item.id, item]));

export const ITEM_IDS_BY_SLOT: Record<CatSlotId, string[]> = {
  hat: [],
  eyewear: [],
  neck: [],
  face: [],
  back: [],
  backdrop: [],
};
for (const item of CAT_ITEMS) ITEM_IDS_BY_SLOT[item.slot].push(item.id);

export function getCatItem(id: string | null | undefined): CatItem | null {
  if (!id) return null;
  return BY_ID.get(id) ?? null;
}

export function slotForItem(id: string | null | undefined): CatSlotId | null {
  return getCatItem(id)?.slot ?? null;
}

export function isCatItemId(value: unknown): value is string {
  return typeof value === "string" && BY_ID.has(value);
}
