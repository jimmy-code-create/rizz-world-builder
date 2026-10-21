import { useState } from "react";
import { Plus } from "lucide-react";
import { MORE_REACTIONS, QUICK_REACTIONS } from "@/lib/reactions";
import { CatEmoji } from "@/components/emoji/CatEmoji";
import { CAT_EMOJI_MANIFEST, catNameForShortcode } from "@/components/emoji/cat-emoji-manifest";

/**
 * The long-press reaction bar: six quick emojis plus a "+" for the wider grid,
 * then one extra row with the 12 custom cat emojis. Every control is a 44px+
 * target. Cat reactions render via <CatEmoji> and play once (600ms) when added
 * (handled by the chip layer reading the :shortcode: value).
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
      <div className="no-scrollbar flex items-center gap-0.5 overflow-x-auto rounded-lg border border-white/[0.06] bg-[#2b2d31] p-1">
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            aria-label={`React with ${emoji}`}
            onClick={() => onPick(emoji)}
            className="grid h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-md text-xl transition-transform hover:scale-110 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          >
            {emoji}
          </button>
        ))}
        <button
          type="button"
          aria-label={showMore ? "Hide more reactions" : "More reactions"}
          aria-expanded={showMore}
          onClick={() => setShowMore((open) => !open)}
          className="grid h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-md text-[#b5bac1] transition hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
      {showMore && (
        <div className="mt-2 grid max-h-52 grid-cols-6 gap-1 overflow-y-auto rounded-lg border border-white/[0.06] bg-[#2b2d31] p-1">
          {MORE_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={`React with ${emoji}`}
              onClick={() => onPick(emoji)}
              className="grid h-11 w-11 min-h-[44px] min-w-[44px] place-items-center rounded-md text-xl transition hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      {/* One extra row: the 12 custom cat emojis */}
      <div className="mt-2 rounded-lg border border-white/[0.06] bg-[#2b2d31] p-1" aria-label="Cat reactions">
        <div className="grid grid-cols-6 gap-1">
          {CAT_EMOJI_MANIFEST.map((e) => (
            <button
              key={e.shortcode}
              type="button"
              aria-label={`React with ${e.label}`}
              title={e.shortcode}
              onClick={() => onPick(e.shortcode)}
              className="grid h-11 w-11 min-h-[44px] min-w-[44px] place-items-center rounded-md transition hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            >
              <CatEmoji name={catNameForShortcode(e.shortcode)!} size={24} animate="hover" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
