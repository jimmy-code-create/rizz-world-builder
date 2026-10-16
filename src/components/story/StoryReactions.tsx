/**
 * Story Reactions Component
 * Instagram-style reaction bar for stories
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { 
  STORY_REACTIONS, 
  useStoryReactions, 
  type StoryReactionEmoji 
} from "@/lib/story-reactions";
import { hapticReaction, hapticButton } from "@/lib/haptics";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { toast } from "@/lib/toast";

type StoryReactionsProps = {
  storyId: string;
  storyAuthorId: string;
  onReactionComplete?: () => void;
};

export function StoryReactions({ storyId, storyAuthorId, onReactionComplete }: StoryReactionsProps) {
  const { user } = useAuth();
  const { counts, myReaction, totalCount, addReaction, removeReaction, isAdding } = useStoryReactions(
    storyId,
    user?.id
  );
  const [showBar, setShowBar] = useState(false);

  const handleReact = (emoji: StoryReactionEmoji) => {
    if (!user) {
      toast.error("Sign in to react to stories");
      return;
    }

    hapticReaction();

    if (myReaction === emoji) {
      // Remove if clicking same reaction
      removeReaction();
    } else {
      // Add or change reaction
      addReaction(emoji);
    }

    setShowBar(false);
    onReactionComplete?.();
  };

  const isMyStory = user?.id === storyAuthorId;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      {/* Reaction counts display (for story author) */}
      {isMyStory && totalCount > 0 && (
        <div className="px-4 pb-2">
          <button
            onClick={() => {
              hapticButton();
              setShowBar(!showBar);
            }}
            className="flex items-center gap-2 rounded-full bg-black/60 backdrop-blur-md px-4 py-2 text-sm"
          >
            <Heart className="h-4 w-4 text-red-500" fill="currentColor" />
            <span className="font-semibold">{totalCount}</span>
            {counts.slice(0, 3).map((count) => (
              <span key={count.emoji} className="text-lg">
                {count.emoji}
              </span>
            ))}
          </button>
        </div>
      )}

      {/* Reaction bar */}
      <AnimatePresence>
        {showBar && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="px-4 pb-4"
          >
            <div className="flex items-center justify-center gap-3 rounded-full bg-black/80 backdrop-blur-xl px-6 py-4 shadow-2xl">
              {STORY_REACTIONS.map((emoji) => {
                const isSelected = myReaction === emoji;
                return (
                  <button
                    key={emoji}
                    onClick={() => handleReact(emoji)}
                    disabled={isAdding}
                    className={`relative text-3xl transition-transform active:scale-125 ${
                      isSelected ? "scale-125" : "scale-100"
                    }`}
                  >
                    {emoji}
                    {isSelected && (
                      <motion.div
                        layoutId="reaction-selected"
                        className="absolute -inset-2 rounded-full bg-white/20"
                        initial={false}
                        transition={{ type: "spring", damping: 20, stiffness: 300 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick reaction button (always visible) */}
      {!isMyStory && !showBar && (
        <div className="px-4 pb-4">
          <Button
            onClick={() => {
              hapticButton();
              setShowBar(true);
            }}
            size="lg"
            className="w-full rounded-full bg-black/60 backdrop-blur-md text-white font-semibold"
          >
            <Heart className={`h-5 w-5 mr-2 ${myReaction ? "fill-red-500 text-red-500" : ""}`} />
            {myReaction ? `${myReaction} Reacted` : "React to Story"}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Reaction counts summary for story viewer
 */
export function StoryReactionsSummary({ storyId }: { storyId: string }) {
  const { user } = useAuth();
  const { counts, totalCount } = useStoryReactions(storyId, user?.id);
  const [expanded, setExpanded] = useState(false);

  if (totalCount === 0) return null;

  return (
    <div className="px-4 pb-2">
      <button
        onClick={() => {
          hapticButton();
          setExpanded(!expanded);
        }}
        className="flex items-center gap-2 rounded-full bg-black/40 backdrop-blur-sm px-3 py-1.5 text-xs"
      >
        {counts.slice(0, 3).map((count) => (
          <span key={count.emoji} className="flex items-center gap-1">
            <span className="text-base">{count.emoji}</span>
            <span className="font-semibold">{count.count}</span>
          </span>
        ))}
        {counts.length > 3 && <span className="text-muted-foreground">+{counts.length - 3}</span>}
      </button>

      {/* Expanded view */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-2 rounded-2xl bg-black/80 backdrop-blur-xl p-3 max-h-60 overflow-y-auto"
          >
            {counts.map((count) => (
              <div key={count.emoji} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{count.emoji}</span>
                  <span className="text-sm text-muted-foreground">{count.count} reactions</span>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
