import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TOKENS, type TileSizeRole } from "@/lib/tokens";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: TileSizeRole;
  variant?: "ghost" | "surface" | "accent" | "outline" | "danger";
  "aria-label": string;
  children: ReactNode;
}

const VARIANT_CLASS: Record<NonNullable<IconButtonProps["variant"]>, string> = {
  ghost: "bg-transparent text-[var(--brand-paper,#f4f1e7)] hover:bg-[var(--brand-ink-3,#1c1c1f)] hover:text-white",
  surface: "bg-[var(--brand-ink-2,#131315)] border border-[var(--brand-line,rgba(244,241,231,0.13))] text-[var(--brand-paper,#f4f1e7)] hover:bg-[var(--brand-ink-3,#1c1c1f)]",
  accent: "bg-[var(--brand-signal,#c8ff3d)] text-[var(--brand-signal-ink,#0a0a0b)] font-bold hover:brightness-105 active:scale-95",
  outline: "bg-transparent border border-[var(--brand-line,rgba(244,241,231,0.13))] text-[var(--brand-paper,#f4f1e7)] hover:bg-[var(--brand-ink-3,#1c1c1f)]",
  danger: "bg-[var(--brand-ink-2,#131315)] border border-[#ff6a55]/40 text-[#ff6a55] hover:bg-[#ff6a55]/15",
};

/**
 * Shared IconButton
 * - Fixed square from tokens
 * - display: grid; place-items: center;
 * - icon display: block; no margin
 * - min 44px hit area for touch compliance
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ size = "lg", variant = "ghost", className, children, disabled, type = "button", ...props }, ref) => {
    const sizeConfig = TOKENS.sizes[size] ?? TOKENS.sizes.lg;

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        className={cn(
          "relative grid place-items-center rounded-lg transition-colors select-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-signal,#c8ff3d)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--brand-ink,#0a0a0b)]",
          "disabled:opacity-40 disabled:pointer-events-none",
          "[&>svg]:block [&>svg]:m-0 shrink-0",
          // Ensures 44px minimum tap target even when visual box is smaller
          "before:content-[''] before:absolute before:inset-x-0 before:inset-y-0 before:min-w-[44px] before:min-h-[44px] before:left-1/2 before:top-1/2 before:-translate-x-1/2 before:-translate-y-1/2",
          VARIANT_CLASS[variant],
          className,
        )}
        style={{
          width: sizeConfig.box,
          height: sizeConfig.box,
          fontSize: sizeConfig.glyph,
        }}
        {...props}
      >
        {children}
      </button>
    );
  },
);

IconButton.displayName = "IconButton";
