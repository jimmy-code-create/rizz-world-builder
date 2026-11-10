/**
 * Lightweight bridge for luxury gift drops.
 *
 * No window/document access at module level — safe to import during SSR.
 * Any component can call dispatchGiftDrop() to trigger a full-screen flex;
 * the GiftOverlayPlayer component subscribes on mount and renders the
 * animation. The two modules never import each other.
 */

import type { Gift } from "@/lib/gift-catalog";

export type GiftDrop = {
  gift: Gift;
  sender: string;
  receiver: string;
  message: string | null;
};

const subscribers = new Set<(drop: GiftDrop) => void>();

export function subscribeToGiftDrops(callback: (drop: GiftDrop) => void) {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

export function dispatchGiftDrop(
  slug: string,
  sender: string,
  receiver: string,
  message: string | null,
) {
  // Imported lazily to avoid pulling the catalog into the bridge at module
  // level in contexts that don't need it.
  void import("@/lib/gift-catalog").then(({ findGift }) => {
    try {
      const gift = findGift(slug);
      const drop: GiftDrop = { gift, sender, receiver, message };
      subscribers.forEach((cb) => cb(drop));
    } catch {
      // Unknown slug — drop silently rather than crashing the flex.
    }
  });
}
