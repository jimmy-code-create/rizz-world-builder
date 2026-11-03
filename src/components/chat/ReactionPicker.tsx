import { useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { MAX_REACTIONS_PER_MESSAGE, MORE_REACTIONS, QUICK_REACTIONS } from "@/lib/reactions";
import { AnimatedEmoji } from "@/components/motion/AnimatedEmoji";
import { RizzEmojiPanel } from "@/components/emoji/RizzEmojiPicker";
import { cn } from "@/lib/utils";

/**
 * The reaction picker behind the smiley in the long-press menu.
 *
 * It only mounts after someone taps the emoji button, so opening the action
 * menu stays light: six quick reactions, an optional wider emoji grid and the
 * twelve cat emoji — instead of a permanently expanded tray that pushed the
 * actions off screen.
 */
export function ReactionPicker({
  onPick,
  onBack,
  className,
}: {
  onPick: (emoji: string) => void;
  onBack: () => void;
  className?: string;
}) {
  const [showMore, setShowMore] = useState(false);

  return (
    <div className={cn("animate-in fade-in-0 slide-in-from-bottom-1 duration-150", className)}>
      <div className="flex items-center gap-1.5 px-1 pb-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to message actions"
          className="grid h-8 w-8 shrink-0 place-items-center rounded text-[#b5bac1] transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <p className="text-[13px] font-semibold text-white">React to message</p>
      </div>

      <div className="no-scrollbar flex items-center gap-0.5 overflow-x-auto rounded-lg border border-white/[0.06] bg-[#2b2d31] p-1">
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            aria-label={`React with ${emoji}`}
            onClick={() => onPick(emoji)}
            className="grid h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-md transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          >
            <AnimatedEmoji emoji={emoji} size={22} motion="hover" />
          </button>
        ))}
        <button
          type="button"
          aria-label={showMore ? "Hide more emoji" : "More emoji"}
          aria-expanded={showMore}
          onClick={() => setShowMore((open) => !open)}
          className="grid h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-md text-[#b5bac1] transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
        >
          <Plus
            className={cn("h-5 w-5 transition-transform", showMore && "rotate-45")}
            aria-hidden="true"
          />
        </button>
      </div>

      {showMore && (
        <div className="mt-1.5 grid max-h-40 grid-cols-8 gap-0.5 overflow-y-auto rounded-lg border border-white/[0.06] bg-[#2b2d31] p-1">
          {MORE_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={`React with ${emoji}`}
              onClick={() => onPick(emoji)}
              className="grid h-9 w-9 min-h-[36px] min-w-[36px] place-items-center rounded transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            >
              <AnimatedEmoji emoji={emoji} size={18} motion="hover" />
            </button>
          ))}
        </div>
      )}

      {/* The in-house pack, and the same picker posts, comments and Reels use:
          one search field, one recents list, twelve cat faces that travel as
          shortcodes so they render in every surface. */}
      <div
        className="mt-1.5 rounded-lg border border-white/[0.06] bg-[#2b2d31] p-2"
        aria-label="RIZZ emoji"
      >
        <RizzEmojiPanel compact onPick={onPick} columns={6} />
      </div>

      <p className="mt-1.5 px-1 text-[10px] leading-snug text-[#949ba4]">
        Tap an emoji to react — up to {MAX_REACTIONS_PER_MESSAGE} reactions per message.
      </p>
    </div>
  );
}
