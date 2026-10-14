import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type IconTileSize = "xs" | "sm" | "md" | "lg" | "xl";

const TILE_SIZE: Record<IconTileSize, string> = {
  xs: "1.25rem",
  sm: "1.75rem",
  md: "2.25rem",
  lg: "2.75rem",
  xl: "3.25rem",
};

const TILE_GLYPH: Record<IconTileSize, string> = {
  xs: "0.7rem",
  sm: "0.95rem",
  md: "1.15rem",
  lg: "1.4rem",
  xl: "1.6rem",
};

/**
 * Any icon that sits inside a circle, square or pill should render through here.
 *
 * The rules live in `.icon-tile` (styles.css): a fixed-size square `grid` with
 * `place-items: center`, a glyph that is `display: block` with no margin, and no
 * transform or absolute position anywhere. That is what stops the "icon is
 * offset from its container" class of bug from coming back on a new screen — the
 * geometry is defined once, in a token, instead of per component.
 */
export function IconTile({
  size = "md",
  radius,
  className,
  style,
  children,
}: {
  size?: IconTileSize;
  /** CSS length for border-radius; defaults to the card radius token. */
  radius?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <span
      className={cn("icon-tile", className)}
      style={
        {
          "--tile-size": TILE_SIZE[size],
          "--tile-glyph": TILE_GLYPH[size],
          ...(radius ? { "--tile-radius": radius } : null),
          ...style,
        } as CSSProperties
      }
    >
      {children}
    </span>
  );
}
