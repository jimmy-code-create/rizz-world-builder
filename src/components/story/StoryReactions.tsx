/**
 * Story footer — the Instagram-style bar at the bottom of the full-screen
 * story viewer.
 *
 * Layout, top to bottom:
 *   1. the quick-reaction row (❤️ 😂 😮 😢 🔥 👏), one tap to send/take back
 *   2. the round "Send message" pill, with the like heart and the paper plane
 *      on its right
 *
 * The author never sees this bar on their own story (they get the Viewers
 * button + the reactions list in Story insights instead), matching IG.
 *
 * All reaction state comes from `@/lib/story-reactions` so the feed, the
 * viewer and anything else share one query, one realtime channel and one
 * optimistic/rollback path.
 */

import { useState, type FormEvent } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { Heart, Loader2, Send } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { STORY_REACTIONS, useStoryReactions, type StoryReactionEmoji } from "@/lib/story-reactions";
import { hapticButton, hapticReaction, hapticSend } from "@/lib/haptics";
import { toast } from "@/lib/toast";

type StoryFooterProps = {
  storyId: string;
  storyAuthorId: string;
  isLiked: boolean;
  likeCount: number;
  onToggleLike: () => void | Promise<unknown>;
  /** Returns true when the DM went through, so the pill can clear. */
  onSendReply: (text: string) => Promise<boolean>;
  /** Pauses the story timer while the reply field has focus. */
  onComposerFocusChange?: (focused: boolean) => void;
};

export function StoryFooter({
  storyId,
  storyAuthorId,
  isLiked,
  likeCount,
  onToggleLike,
  onSendReply,
  onComposerFocusChange,
}: StoryFooterProps) {
  const { user } = useAuth();
  const isMine = !!user && user.id === storyAuthorId;
  const { myReactions, addReaction, removeReaction } = useStoryReactions(storyId, user?.id, {
    enabled: !!user && !isMine,
  });

  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [burst, setBurst] = useState<{ key: number; emoji: string } | null>(null);

  // Signed-out visitors and the author's own story have no footer.
  if (!user || isMine) return null;

  const react = (emoji: StoryReactionEmoji) => {
    hapticReaction();
    setBurst({ key: Date.now(), emoji });
    const options = {
      onError: () => toast.error("Couldn't save that reaction. Try again."),
    };
    if (myReactions.includes(emoji)) removeReaction(emoji, options);
    else addReaction(emoji, options);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    const sent = await onSendReply(text);
    setSending(false);
    if (sent) {
      setBody("");
      hapticSend();
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative shrink-0 border-t border-white/10 bg-[#090710]/95 px-3 pb-2 pt-1.5">
        {/* Quick reactions */}
        <div
          role="group"
          aria-label="React to this story"
          className="no-scrollbar -mx-1 flex items-center gap-0.5 overflow-x-auto px-1"
        >
          {STORY_REACTIONS.map((emoji) => {
            const selected = myReactions.includes(emoji);
            return (
              <button
                key={emoji}
                type="button"
                aria-label={selected ? `Remove ${emoji} reaction` : `React with ${emoji}`}
                aria-pressed={selected}
                onClick={() => react(emoji)}
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-[24px] leading-none transition-[transform,background-color] duration-150 active:scale-[0.88] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  selected ? "bg-primary/15 ring-1 ring-primary/50" : "hover:bg-white/10"
                }`}
              >
                {emoji}
              </button>
            );
          })}
        </div>

        {/* Reply pill + like + send */}
        <form onSubmit={submit} className="mt-1 flex items-center gap-2">
          <input
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onFocus={() => onComposerFocusChange?.(true)}
            onBlur={() => onComposerFocusChange?.(false)}
            maxLength={2000}
            enterKeyHint="send"
            aria-label="Reply to this story"
            placeholder="Send message"
            className="h-11 min-w-0 flex-1 rounded-full border border-white/[0.18] bg-white/[0.06] px-4 text-[16px] text-white placeholder:text-white/45 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          />

          <button
            type="button"
            aria-label={isLiked ? "Remove like" : "Like story"}
            aria-pressed={isLiked}
            onClick={() => {
              hapticButton();
              void onToggleLike();
            }}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white/85 transition-[transform,background-color,color] duration-150 hover:bg-white/10 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <motion.span
              animate={isLiked ? { scale: [1, 1.35, 1] } : { scale: 1 }}
              transition={{ duration: 0.24 }}
            >
              <Heart className={`h-6 w-6 ${isLiked ? "fill-primary text-primary" : ""}`} />
            </motion.span>
            <span className="sr-only">{likeCount} likes</span>
          </button>

          <button
            type="submit"
            aria-label="Send reply"
            disabled={!body.trim() || sending}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-[#0b0b0c] transition-[transform,opacity] duration-150 active:scale-95 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </form>

        {/* The emoji itself floats up on tap, IG style. */}
        <AnimatePresence>
          {burst && (
            <motion.span
              key={burst.key}
              aria-hidden="true"
              initial={{ opacity: 0, y: 0, scale: 0.6 }}
              animate={{ opacity: 1, y: -68, scale: 1.15 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              onAnimationComplete={() => setBurst(null)}
              className="pointer-events-none absolute bottom-[calc(100%-8px)] left-1/2 z-10 -translate-x-1/2 text-[32px] leading-none"
            >
              {burst.emoji}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
