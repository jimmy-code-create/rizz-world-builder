"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils";
import { normalizeAvatarUrl } from "@/lib/default-avatars";
import { TOKENS, type PresenceState } from "@/lib/tokens";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

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
}

/**
 * Standard User Avatar
 * - Unified size scale
 * - Initials on surface-2 (bg-[#1c1c1f], text cream #f4f1e7, not lime)
 * - Presence dot positioned from avatar box with 2px cut-out ring, never clipped
 */
export function UserAvatar({
  src,
  fallback = "?",
  size = "md",
  presence,
  className,
  alt,
}: UserAvatarProps) {
  const isNamedSize = typeof size === "string" && size in AVATAR_SIZES;
  const config = isNamedSize ? AVATAR_SIZES[size as AvatarSize] : null;
  const pixelBox = typeof size === "number" ? size : config ? config.box : 40;
  const fontClass = config ? config.font : pixelBox >= 72 ? "text-2xl" : pixelBox >= 48 ? "text-base" : "text-xs";
  const dotSize = config ? config.dot : Math.max(7, Math.round(pixelBox * 0.22));

  return (
    <div
      className={cn("relative inline-flex shrink-0 select-none", className)}
      style={{ width: pixelBox, height: pixelBox }}
    >
      <AvatarPrimitive.Root className="relative flex h-full w-full shrink-0 overflow-hidden rounded-full border border-white/10 bg-[var(--brand-ink-3,#1c1c1f)]">
        <AvatarPrimitive.Image
          src={normalizeAvatarUrl(src) ?? undefined}
          alt={alt || fallback}
          className="aspect-square h-full w-full object-cover"
        />
        <AvatarPrimitive.Fallback
          className={cn(
            "flex h-full w-full items-center justify-center font-semibold bg-[var(--brand-ink-3,#1c1c1f)] text-[var(--brand-paper,#f4f1e7)]",
            fontClass,
          )}
        >
          {fallback.slice(0, 2).toUpperCase()}
        </AvatarPrimitive.Fallback>
      </AvatarPrimitive.Root>

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
    className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-[var(--brand-ink-3,#1c1c1f)]", className)}
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
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => {
  // Strip legacy lime/gradient classes to guarantee dark surface-2 for initials everywhere
  const cleanedClass = className
    ?.replace(/bg-gradient-primary/g, "")
    ?.replace(/text-primary-foreground/g, "")
    ?.replace(/bg-primary/g, "");

  return (
    <AvatarPrimitive.Fallback
      ref={ref}
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full bg-[var(--brand-ink-3,#1c1c1f)] text-[var(--brand-paper,#f4f1e7)] font-semibold",
        cleanedClass,
      )}
      {...props}
    />
  );
});
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarImage, AvatarFallback };
