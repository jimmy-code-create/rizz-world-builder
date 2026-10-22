import { useSyncExternalStore, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { canonicalFor } from "@/lib/badge-set";
import { BadgeGlyph, isBadgeGlyph } from "@/components/profile/BadgeGlyph";

/**
 * Vector badge system.
 *
 * All 12 badges are hand-drawn <symbol>s in a single sprite
 * (public/badges/badges.svg). The sprite is injected into the document once,
 * and every badge on every surface is the same `<use href="#slug">` markup —
 * a 20px name-row chip, a 28px profile chip and a 96px showcase render the
 * identical geometry, just scaled.
 */
const SPRITE_URL = "/badges/badges.svg";
const SPRITE_ID = "rizz-badge-sprite";

let ready = typeof document !== "undefined" && !!document.getElementById(SPRITE_ID);
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emitReady() {
  if (ready) return;
  ready = true;
  for (const listener of listeners) listener();
}

/** Fetch and inline the sprite once; safe to call from anywhere, any time. */
export function ensureBadgeSprite(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (document.getElementById(SPRITE_ID)) {
    emitReady();
    return Promise.resolve();
  }
  if (!loading) {
    loading = fetch(SPRITE_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`badge sprite failed: ${res.status}`);
        return res.text();
      })
      .then((markup) => {
        if (document.getElementById(SPRITE_ID)) return;
        const holder = document.createElement("div");
        holder.id = SPRITE_ID;
        holder.setAttribute("aria-hidden", "true");
        // Zero-size, clipped and absolute: the sprite is definitions only, and
        // never takes layout space or paint order on any surface.
        holder.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
        holder.innerHTML = markup;
        document.body.appendChild(holder);
        emitReady();
      })
      .catch(() => {
        // Keep the sized box so layout never shifts; a later mount retries.
        loading = null;
      });
  }
  return loading;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  void ensureBadgeSprite();
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => ready;
const getServerSnapshot = () => false;

/** True once the sprite is present in the document. */
export function useBadgeSpriteReady(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export type BadgeProps = {
  /** Badge slug (e.g. "rookie", "verified") or any legacy slug with a mapping. */
  slug: string;
  /** Rendered square size in px: 20 beside names, 28 in the profile chip, 96 in showcase. */
  size?: number;
  /** Locked badges render at 35% opacity in greyscale. */
  locked?: boolean;
  /** Accessible name — also gives the badge a native tooltip when hovering. */
  title?: string;
  className?: string;
  style?: CSSProperties;
};

export function Badge({ slug, size = 20, locked = false, title, className, style }: BadgeProps) {
  const spriteReady = useBadgeSpriteReady();
  const symbol = canonicalFor(slug)?.symbol ?? slug;
  const px = Math.max(12, Math.round(size));
  // The five profile marks are inline SVG with their own loops; every legacy
  // slug keeps using the shared sprite.
  if (isBadgeGlyph(slug)) {
    return <BadgeGlyph slug={slug} size={px} locked={locked} title={title} className={className} />;
  }
  return (
    <span
      className={cn("badge", locked && "badge--locked", className)}
      style={{ width: px, height: px, ...style }}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      title={title}
    >
      <svg viewBox="0 0 24 24" width={px} height={px} focusable="false" aria-hidden="true">
        {spriteReady ? <use href={`#${symbol}`} /> : null}
      </svg>
    </span>
  );
}
