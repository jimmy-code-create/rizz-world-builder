import { useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { MORE_REACTIONS, QUICK_REACTIONS } from "@/lib/reactions";
import { CatEmoji } from "@/components/emoji/CatEmoji";
import { CAT_EMOJI_MANIFEST, catNameForShortcode } from "@/components/emoji/cat-emoji-manifest";
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
    <div
      className={cn(
        "animate-in fade-in-0 slide-in-from-bottom-1 duration-150",
        className,
      )}
    >
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
            className="grid h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-md text-xl transition-transform hover:scale-110 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          >
            {emoji}
          </button>
        ))}
        <button
          type="button"
          aria-label={showMore ? "Hide more emoji" : "More emoji"}
          aria-expanded={showMore}
          onClick={() => setShowMore((open) => !open)}
          className="grid h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-md text-[#b5bac1] transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
        >
          <Plus className={cn("h-5 w-5 transition-transform", showMore && "rotate-45")} aria-hidden="true" />
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
              className="grid h-9 w-9 min-h-[36px] min-w-[36px] place-items-center rounded text-lg transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      <div className="mt-1.5 rounded-lg border border-white/[0.06] bg-[#2b2d31] p-1" aria-label="Cat reactions">
        <div className="grid grid-cols-6 gap-0.5">
          {CAT_EMOJI_MANIFEST.map((entry) => (
            <button
              key={entry.shortcode}
              type="button"
              aria-label={`React with ${entry.label}`}
              title={entry.shortcode}
              onClick={() => onPick(entry.shortcode)}
              className="grid h-10 w-10 min-h-[40px] min-w-[40px] place-items-center rounded-md transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            >
              <CatEmoji name={catNameForShortcode(entry.shortcode)!} size={22} animate="hover" />
            </button>
          ))}
        </div>
      </div>

      <p className="mt-1.5 px-1 text-[10px] leading-snug text-[#949ba4]">
        Tap an emoji to react. Cat emoji count here too.
      </p>
    </div>
  );
}
