/**
 * Cosmetic layout registry.
 *
 * Components never hardcode an effect's bounds. Each live cosmetic declares
 * which layer it owns, how it is anchored and the maximum height it may paint
 * (as a percentage of the banner/card). Adding the next look is a one-line
 * entry here; unknown or retired slugs render nothing.
 */

import { BLOODWEB_SLUG, DARK_MOON_SLUG, PUPPY_LOVE_SLUG } from "@/lib/effects";

export type EffectLayer = "banner" | "frame" | "avatar";
export type EffectAnchor = "top-left" | "top-center" | "center";

export type ProfileEffectSpec = {
  id: string;
  layer: EffectLayer;
  anchor: EffectAnchor;
  /** Effect height ceiling as a percentage of the banner box. */
  maxHeightPct: number;
  opacity: number;
};

const REGISTRY: Record<string, ProfileEffectSpec> = {
  [PUPPY_LOVE_SLUG]: {
    id: PUPPY_LOVE_SLUG,
    layer: "banner",
    anchor: "top-left",
    maxHeightPct: 100,
    opacity: 1,
  },
  [DARK_MOON_SLUG]: {
    id: DARK_MOON_SLUG,
    layer: "frame",
    anchor: "top-left",
    maxHeightPct: 100,
    opacity: 1,
  },
  [BLOODWEB_SLUG]: {
    id: BLOODWEB_SLUG,
    layer: "avatar",
    anchor: "center",
    maxHeightPct: 120,
    opacity: 1,
  },
};

export function getProfileEffectSpec(slug?: string | null): ProfileEffectSpec | null {
  if (!slug) return null;
  return REGISTRY[slug] ?? null;
}

export function getBannerEffectSpec(slug?: string | null): ProfileEffectSpec | null {
  const spec = getProfileEffectSpec(slug);
  return spec?.layer === "banner" ? spec : null;
}

export function getFrameSpec(slug?: string | null): ProfileEffectSpec | null {
  const spec = getProfileEffectSpec(slug);
  return spec?.layer === "frame" ? spec : null;
}
