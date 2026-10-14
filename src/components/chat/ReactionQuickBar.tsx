import { useState } from "react";
import { Plus } from "lucide-react";
import { MORE_REACTIONS, QUICK_REACTIONS } from "@/lib/reactions";

/**
 * The long-press reaction bar: six quick emojis plus a "+" for the wider grid.
 * Every control is a 48px target and the row scrolls instead of overflowing, so
 * it still fits on a small phone. It is rendered inside the message action
 * popover, which opens above the pressed message.
 */
export function ReactionQuickBar({
  onPick,
  className,
}: {
  onPick: (emoji: string) => void;
  className?: string;
}) {
  const [showMore, setShowMore] = useState(false);

  return (
    <div className={className}>
      <div className="no-scrollbar flex items-center gap-0.5 overflow-x-auto rounded-full border border-white/10 bg-[#08060d] p-1">
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            aria-label={`React with ${emoji}`}
            onClick={() => onPick(emoji)}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-xl transition-transform hover:scale-110 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {emoji}
          </button>
        ))}
        <button
          type="button"
          aria-label={showMore ? "Hide more reactions" : "More reactions"}
          aria-expanded={showMore}
          onClick={() => setShowMore((open) => !open)}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-white/75 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
      {showMore && (
        <div className="mt-2 grid max-h-52 grid-cols-6 gap-1 overflow-y-auto rounded-xl border border-white/10 bg-[#08060d] p-1">
          {MORE_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={`React with ${emoji}`}
              onClick={() => onPick(emoji)}
              className="grid h-12 w-12 place-items-center rounded-lg text-xl transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
