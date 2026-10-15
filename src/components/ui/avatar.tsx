"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils";
import { normalizeAvatarUrl } from "@/lib/default-avatars";
import { TOKENS, type PresenceState } from "@/lib/tokens";
import { useStoriesStore } from "@/lib/stories-store";
import { MediaViewer } from "@/components/media/MediaViewer";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

export const AVATAR_FALLBACK_PALETTE = [
  { bg: "#2c2d35", text: "#f2efe6" }, // Slate
  { bg: "#363024", text: "#f2efe6" }, // Warm bronze/amber
  { bg: "#223328", text: "#f2efe6" }, // Pine
  { bg: "#362629", text: "#f2efe6" }, // Rust umber
  { bg: "#2d2636", text: "#f2efe6" }, // Heather
  { bg: "#203036", text: "#f2efe6" }, // Spruce
  { bg: "#362c20", text: "#f2efe6" }, // Espresso
  { bg: "#27272b", text: "#f2efe6" }, // Asphalt
];

export function getAvatarPalette(seed: string = "") {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_FALLBACK_PALETTE[hash % AVATAR_FALLBACK_PALETTE.length];
}

const AVATAR_SIZES: Record<AvatarSize, { box: number; font: string; dot: number }> = {
  xs: { box: 24, font: "text-[10px]", dot: 7 },
  sm: { box: 32, font: "text-xs", dot: 8 },
  md: { box: 40, font: "text-sm", dot: 10 },
  lg: { box: 48, font: "text-base", dot: 12 },
  xl: { box: 64, font: "text-xl", dot: 14 },
  "2xl": { box: 96, font: "text-3xl", dot: 18 },
};

export interface UserAvatarProps {
  src?: string | null;
  fallback?: string;
  size?: AvatarSize | number;
  presence?: PresenceState | null;
  className?: string;
  alt?: string;
  hasStory?: boolean | "unseen" | "seen";
  userId?: string | null;
  onStoryClick?: () => void;
}

/**
 * Standard User Avatar
 * - Unified size scale
 * - Initials on surface-2 (bg-[#1c1c1f], text cream #f4f1e7, not lime)
 * - Presence dot positioned from avatar box with 2px cut-out ring, never clipped
 * - Instagram-style story ring when user has an active story
 */
export function UserAvatar({
  src,
  fallback = "?",
  size = "md",
  presence,
  className,
  alt,
  hasStory,
  userId,
  onStoryClick,
}: UserAvatarProps) {
  const isNamedSize = typeof size === "string" && size in AVATAR_SIZES;
  const config = isNamedSize ? AVATAR_SIZES[size as AvatarSize] : null;
  const pixelBox = typeof size === "number" ? size : config ? config.box : 40;
  const fontClass = config ? config.font : pixelBox >= 72 ? "text-2xl" : pixelBox >= 48 ? "text-base" : "text-xs";
  const dotSize = config ? config.dot : Math.max(7, Math.round(pixelBox * 0.22));

  const storiesStore = useStoriesStore();
  const palette = React.useMemo(
    () => getAvatarPalette(fallback || alt || userId || ""),
    [fallback, alt, userId]
  );
  const storyStatus = hasStory !== undefined
    ? (hasStory === true ? "unseen" : hasStory === false ? "none" : hasStory)
    : userId
      ? storiesStore.unseenAuthorIds.has(userId)
        ? "unseen"
        : storiesStore.activeAuthorIds.has(userId)
          ? "seen"
          : "none"
      : "none";

  const avatarElement = (
    <div
      className={cn("relative inline-flex shrink-0 select-none", className)}
      style={{ width: pixelBox, height: pixelBox }}
    >
      <div
        className={cn(
          "relative flex h-full w-full shrink-0 overflow-hidden rounded-full",
          storyStatus === "unseen"
            ? "p-[2.5px] bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] shadow-[0_0_10px_rgba(220,39,67,0.3)]"
            : storyStatus === "seen"
              ? "p-[2px] border border-white/20"
              : ""
        )}
      >
        <AvatarPrimitive.Root
          className={cn(
            "relative flex h-full w-full shrink-0 overflow-hidden rounded-full bg-[var(--brand-ink-3,#1c1c1f)]",
            src ? "border border-[#2a2a2e]" : "border-0 shadow-none ring-0",
            storyStatus !== "none" && "ring-2 ring-background",
          )}
        >
          <AvatarPrimitive.Image
            src={normalizeAvatarUrl(src) ?? undefined}
            alt={alt || fallback}
            className="aspect-square h-full w-full object-cover"
          />
          <AvatarPrimitive.Fallback
            style={{ backgroundColor: palette.bg, color: palette.text }}
            className={cn(
              "flex h-full w-full items-center justify-center font-semibold border-0 shadow-none ring-0",
              fontClass,
            )}
          >
            {fallback.slice(0, 2).toUpperCase()}
          </AvatarPrimitive.Fallback>
        </AvatarPrimitive.Root>
      </div>

      {/* Presence dot: positioned from avatar outer box, 2px cut-out ring, not clipped */}
      {presence && (
        <span
          className="absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-[var(--brand-ink,#0a0a0b)] pointer-events-none"
          style={{
            width: dotSize,
            height: dotSize,
            backgroundColor: TOKENS.presence[presence] || TOKENS.presence.offline,
          }}
          aria-label={`Status: ${presence}`}
        />
      )}
    </div>
  );

  if (onStoryClick) {
    return (
      <button
        type="button"
        onClick={onStoryClick}
        className="shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full transition-transform hover:scale-105 active:scale-95"
        title={storyStatus !== "none" ? "View story" : undefined}
      >
        {avatarElement}
      </button>
    );
  }

  return avatarElement;
}

/**
 * Primitives for custom layouts
 */
const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full border border-[#2a2a2e] bg-[var(--brand-ink-3,#1c1c1f)] shadow-none ring-0", className)}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, src, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    src={normalizeAvatarUrl(src) ?? undefined}
    className={cn("aspect-square h-full w-full object-cover", className)}
    {...props}
  />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback> & { seed?: string }
>(({ className, style, seed, children, ...props }, ref) => {
  const seedString = seed || (typeof children === "string" ? children : "");
  const palette = getAvatarPalette(seedString);
  // Strip legacy lime/gradient classes to guarantee tasteful palette for initials everywhere
  const cleanedClass = className
    ?.replace(/bg-surface-2/g, "")
    ?.replace(/text-primary-foreground/g, "")
    ?.replace(/bg-primary/g, "");

  return (
    <AvatarPrimitive.Fallback
      ref={ref}
      style={{ backgroundColor: palette.bg, color: palette.text, ...style }}
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full font-semibold border-0 shadow-none ring-0",
        cleanedClass,
      )}
      {...props}
    >
      {children}
    </AvatarPrimitive.Fallback>
  );
});
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarImage, AvatarFallback };

export interface InteractiveAvatarProps extends UserAvatarProps {
  onClick?: (event: React.MouseEvent) => void;
  disableLongPressPhoto?: boolean;
}

/**
 * InteractiveAvatar
 * - Short tap: views active story if user has one; otherwise triggers onClick
 * - 450ms long press: triggers full photo viewer with haptic vibration feedback
 * - Prevents native callout popup (-webkit-touch-callout: none, contextmenu prevented)
 */
export function InteractiveAvatar({
  onClick,
  onStoryClick,
  disableLongPressPhoto = false,
  src,
  ...props
}: InteractiveAvatarProps) {
  const [photoOpen, setPhotoOpen] = React.useState(false);
  const timerRef = React.useRef<number | null>(null);
  const startPos = React.useRef<{ x: number; y: number } | null>(null);
  const didLongPress = React.useRef(false);

  const clearTimer = React.useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPos.current = null;
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disableLongPressPhoto || !src) return;
    didLongPress.current = false;
    startPos.current = { x: e.clientX, y: e.clientY };
    timerRef.current = window.setTimeout(() => {
      didLongPress.current = true;
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate(20);
        } catch {}
      }
      setPhotoOpen(true);
    }, 450);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!startPos.current) return;
    const dist = Math.hypot(e.clientX - startPos.current.x, e.clientY - startPos.current.y);
    if (dist > 10) {
      clearTimer();
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (didLongPress.current) {
      e.preventDefault();
      e.stopPropagation();
      didLongPress.current = false;
      return;
    }
    if (onStoryClick) {
      onStoryClick();
    } else if (onClick) {
      onClick(e);
    }
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={clearTimer}
        onPointerCancel={clearTimer}
        onPointerLeave={clearTimer}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick(e as any);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        className="inline-flex shrink-0 cursor-pointer touch-manipulation select-none outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full transition-transform active:scale-95"
        style={{
          WebkitTouchCallout: "none",
          userSelect: "none",
        }}
      >
        <UserAvatar src={src} {...props} />
      </div>

      {src && (
        <MediaViewer
          open={photoOpen}
          src={normalizeAvatarUrl(src) ?? src}
          alt={props.alt || props.fallback || "Avatar"}
          onClose={() => setPhotoOpen(false)}
        />
      )}
    </>
  );
}
