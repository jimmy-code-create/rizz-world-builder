import { useEffect, useRef, type Ref } from "react";
import { cn } from "@/lib/utils";
import { useReactorPeek, type ReactionTarget } from "@/components/reactions/ReactorPeek";
import { AnimatedEmoji } from "@/components/motion/AnimatedEmoji";

const SIZES = {
  sm: "h-6 gap-1 px-2 text-[11px]",
  md: "h-7 gap-1.5 px-2.5 text-xs",
  lg: "h-8 gap-2 px-3 text-sm",
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
  // A chip that just gained a reaction pops; the rest only wobble on hover.
  const previousCount = useRef(count);
  const grew = count > previousCount.current;
  useEffect(() => {
    previousCount.current = count;
  });
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
        "inline-flex shrink-0 select-none items-center rounded-[10px] border bg-clip-padding transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        SIZES[size],
        mine
          ? "border-primary/50 bg-primary/10 text-foreground"
          : "border-white/10 bg-white/[0.05] text-muted-foreground hover:border-white/20 hover:bg-white/[0.08]",
        className,
      )}
    >
      <AnimatedEmoji
        emoji={emoji}
        size={size === "lg" ? 16 : 14}
        motion={grew ? "pop" : "hover"}
      />
      <span className="font-mono font-medium leading-none">{count}</span>
    </button>
  );
}
