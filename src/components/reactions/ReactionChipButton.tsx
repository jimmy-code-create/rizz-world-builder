import type { Ref } from "react";
import { cn } from "@/lib/utils";
import { useReactorPeek, type ReactionTarget } from "@/components/reactions/ReactorPeek";

const SIZES = {
  sm: "h-6 gap-1 px-2 text-[11px]",
  md: "gap-1.5 px-2.5 py-1 text-xs",
  lg: "gap-2 px-3 py-1.5 text-sm",
} as const;

/**
 * One reaction chip, used by posts, comments and chat messages.
 *
 * A chip you have reacted with is highlighted in the signal colour; clicking
 * toggles your reaction; hovering, focusing or long-pressing opens the shared
 * reactor peek. Every surface that shows reactions should render this instead
 * of hand-rolling a button, so the peeking behaviour can never be missing on
 * one screen.
 */
export function ReactionChipButton({
  emoji,
  count,
  mine,
  target,
  onToggle,
  size = "md",
  className,
  title,
}: {
  emoji: string;
  count: number;
  mine: boolean;
  /** Where the reactor list comes from. Pass null to disable peeking. */
  target: ReactionTarget | null;
  onToggle: () => void;
  size?: keyof typeof SIZES;
  className?: string;
  title?: string;
}) {
  const peek = useReactorPeek(target && count > 0 ? target : null);
  return (
    <button
      ref={peek.anchorRef as Ref<HTMLButtonElement>}
      type="button"
      aria-pressed={mine}
      aria-describedby={peek.describedBy}
      onClick={peek.guardClick(onToggle)}
      title={title}
      {...peek.triggerProps}
      className={cn(
        "inline-flex shrink-0 select-none items-center rounded-full border transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        SIZES[size],
        mine
          ? "border-[var(--brand-signal)] bg-[color-mix(in_srgb,var(--brand-signal)_22%,transparent)] text-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-secondary",
        className,
      )}
    >
      <span aria-hidden className="leading-none">
        {emoji}
      </span>
      <span className="font-mono font-medium leading-none">{count}</span>
    </button>
  );
}
