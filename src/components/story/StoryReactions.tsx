/**
 * Story Reactions Component
 * Instagram-style inline reaction row for stories.
 *
 * Inline (not `fixed`) so it embeds in a viewer footer without covering
 * the reply composer. Multi-emoji model: one user may leave several
 * different emoji, matching the (story_id, user_id, emoji) primary key.
 */

import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import {
  STORY_REACTIONS,
  useStoryReactions,
  type StoryReactionEmoji,
} from "@/lib/story-reactions";
import { hapticReaction } from "@/lib/haptics";
import { Heart } from "lucide-react";
import { toast } from "@/lib/toast";

type StoryReactionsProps = {
  storyId: string;
  storyAuthorId: string;
  onReactionComplete?: () => void;
};

export function StoryReactions({ storyId, storyAuthorId, onReactionComplete }: StoryReactionsProps) {
  const { user } = useAuth();
  const { counts, myReactions, totalCount, addReaction, removeReaction, isAdding } =
    useStoryReactions(storyId, user?.id);

  const handleReact = (emoji: StoryReactionEmoji) => {
    if (!user) {
      toast.error("Sign in to react to stories");
      return;
    }

    hapticReaction();

    if (myReactions.includes(emoji)) {
      removeReaction(emoji);
    } else {
      addReaction(emoji);
    }

    onReactionComplete?.();
  };

  const isMyStory = user?.id === storyAuthorId;

  return (
    <div className="w-full border-t border-white/10 bg-white/[0.025] px-3 py-2">
      {/* Reaction counts display (for story author) */}
      {isMyStory && totalCount > 0 && (
        <div className="flex items-center gap-2 px-1 pb-2 text-xs text-white/80">
          <Heart className="h-4 w-4 fill-red-500 text-red-500" aria-hidden />
          <span className="font-semibold tabular-nums">{totalCount}</span>
          <span className="flex items-center gap-1" aria-hidden>
            {counts.slice(0, 3).map((count) => (
              <span key={count.emoji} className="text-base leading-none">
                {count.emoji}
              </span>
            ))}
          </span>
          <span className="sr-only">
            {counts.map((c) => `${c.count} ${c.emoji}`).join(", ")}
          </span>
        </div>
      )}

      {/* Reaction bar */}
      <div
        role="group"
        aria-label="React to story"
        className="no-scrollbar flex min-w-0 flex-1 items-center justify-between gap-0.5 overflow-x-auto rounded-full border border-white/[0.08] bg-white/[0.03] p-1"
      >
        {STORY_REACTIONS.map((emoji) => {
          const isSelected = myReactions.includes(emoji);
          return (
            <motion.button
              key={emoji}
              type="button"
              aria-label={`React with ${emoji}`}
              aria-pressed={isSelected}
              disabled={!user || isAdding}
              onClick={() => handleReact(emoji)}
              whileTap={{ scale: 1.25 }}
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                isSelected ? "bg-primary/20 ring-1 ring-primary/45" : "hover:bg-white/10"
              }`}
            >
              {emoji}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Reaction counts summary for story viewer
 */
export function StoryReactionsSummary({ storyId }: { storyId: string }) {
  const { user } = useAuth();
  const { counts, totalCount } = useStoryReactions(storyId, user?.id);

  if (totalCount === 0) return null;

  return (
    <div className="flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 text-xs backdrop-blur-sm">
      {counts.slice(0, 3).map((count) => (
        <span key={count.emoji} className="flex items-center gap-1">
          <span className="text-base" aria-hidden>
            {count.emoji}
          </span>
          <span className="font-semibold tabular-nums">{count.count}</span>
        </span>
      ))}
      {counts.length > 3 && (
        <span className="text-muted-foreground">+{counts.length - 3}</span>
      )}
      <span className="sr-only">{totalCount} reactions</span>
    </div>
  );
}
