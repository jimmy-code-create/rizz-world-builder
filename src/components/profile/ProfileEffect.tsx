import { COSMETICS_ENABLED, PUPPY_LOVE_SLUG } from "@/lib/effects";
import { PuppyLoveEffect } from "@/components/profile/PuppyLoveEffect";

/**
 * The profile-effect layer.
 *
 * Exactly one effect exists: Puppy Love. A stale slug from an older catalogue
 * (including the retired Web Slinger) renders nothing rather than resurrecting
 * a removed overlay. The scene itself is transparent and `pointer-events:
 * none`, so the banner, avatar, name and every control above it keep working
 * untouched.
 */
export function ProfileEffect({ slug }: { slug?: string | null }) {
  if (!COSMETICS_ENABLED || slug !== PUPPY_LOVE_SLUG) return null;
  return <PuppyLoveEffect />;
}
