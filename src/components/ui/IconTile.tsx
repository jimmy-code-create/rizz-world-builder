import * as React from "react";
import { cn } from "@/lib/utils";

export type IconTileSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
export type IconTileShape = "square" | "circle" | "rounded";

const sizeClasses: Record<IconTileSize, string> = {
  xs: "h-4 w-4 min-w-4 max-w-4", // 16px
  sm: "h-5 w-5 min-w-5 max-w-5", // 20px
  md: "h-6 w-6 min-w-6 max-w-6", // 24px
  lg: "h-8 w-8 min-w-8 max-w-8", // 32px
  xl: "h-9 w-9 min-w-9 max-w-9", // 36px
  "2xl": "h-10 w-10 min-w-10 max-w-10", // 40px
};

const shapeClasses: Record<IconTileShape, string> = {
  square: "rounded-none",
  circle: "rounded-full",
  rounded: "rounded-lg",
};

export interface IconTileProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: IconTileSize;
  shape?: IconTileShape;
  children: React.ReactNode;
}

/**
 * Shared IconTile: guarantees pixel-perfect center alignment for any glyph.
 * Uses CSS grid `place-items: center`, fixed square size, and forces child SVGs
 * to block display with flex-shrink: 0 and zero stray margin.
 */
export const IconTile = React.forwardRef<HTMLSpanElement, IconTileProps>(
  ({ size = "md", shape = "rounded", className, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "grid shrink-0 place-items-center overflow-hidden p-0 m-0 leading-none select-none",
          "[&>svg]:block [&>svg]:shrink-0 [&>svg]:m-0 [&>img]:block [&>img]:shrink-0 [&>img]:m-0",
          sizeClasses[size],
          shapeClasses[shape],
          className,
        )}
        {...props}
      >
        {children}
      </span>
    );
  },
);
IconTile.displayName = "IconTile";

/**
 * Single-element radio indicator. The outer border and checked center dot live
 * in ONE SVG viewBox coordinate space (16x16), so they are mathematically incapable
 * of separating or shifting at any browser zoom (100%/125%/150%), font scale, or 2x DPR.
 */
export function RadioIndicator({
  checked,
  className,
  color = "var(--primary)",
}: {
  checked: boolean;
  className?: string;
  color?: string;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
      className={cn("block shrink-0 select-none", className)}
    >
      <circle
        cx="8"
        cy="8"
        r="7"
        fill={checked ? color : "transparent"}
        fillOpacity={checked ? 0.15 : 0}
        stroke={checked ? color : "rgba(244, 244, 246, 0.28)"}
        strokeWidth="1.5"
      />
      {checked && <circle cx="8" cy="8" r="3.5" fill={color} />}
    </svg>
  );
}

/**
 * Single-element checkbox indicator. The outer box and checkmark live in ONE
 * SVG viewBox coordinate space (16x16), preventing subpixel drift.
 */
export function CheckboxIndicator({
  checked,
  className,
  color = "var(--primary)",
}: {
  checked: boolean;
  className?: string;
  color?: string;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
      className={cn("block shrink-0 select-none", className)}
    >
      <rect
        x="1"
        y="1"
        width="14"
        height="14"
        rx="3"
        fill={checked ? color : "transparent"}
        stroke={checked ? color : "rgba(244, 244, 246, 0.28)"}
        strokeWidth="1.5"
      />
      {checked && (
        <path
          d="M4.5 8.2 L6.8 10.5 L11.5 5.5"
          fill="none"
          stroke="#0a0b0e"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
