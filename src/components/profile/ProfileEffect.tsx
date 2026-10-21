import { COSMETICS_ENABLED, WEB_SLINGER_SLUG } from "@/lib/effects";
import { WebSlingerEffect } from "@/components/profile/WebSlingerEffect";

/**
 * The profile-effect layer.
 *
 * Exactly one effect exists: the Web Slinger. A stale slug from an older
 * catalogue renders nothing rather than resurrecting a removed overlay.
 * The scene itself is transparent and `pointer-events: none`, so the banner,
 * avatar, name and every control above it keep working untouched.
 */
export function ProfileEffect({ slug }: { slug?: string | null }) {
  if (!COSMETICS_ENABLED || slug !== WEB_SLINGER_SLUG) return null;
  return <WebSlingerEffect />;
}
