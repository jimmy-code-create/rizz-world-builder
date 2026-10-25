import { toast } from "@/lib/toast";
import type { ReactionGroup, ReactionScope } from "@/lib/reactions";
import { ReactionRow } from "@/components/reactions/ReactionRow";
import { reactionHaptic, triggerBurstOnElement, triggerReactionBurst } from "@/components/chat/ReactionBurst";
import type { ReactionPulse } from "@/lib/useChatReactions";

export type { ReactionPulse };

/**
 * Fires a burst over a message, used by double tap. Pass the tap's viewport
 * coordinates when they are known so the burst pops right under the finger.
 */
export function burstOverMessage(messageId: string, emoji: string, at?: { x: number; y: number }) {
  if (at) {
    triggerReactionBurst({ x: at.x, y: at.y, emoji });
    return;
  }
  triggerBurstOnElement(document.getElementById(`msg-${messageId}`), emoji);
}

/**
 * Chat adapter for the shared <ReactionRow>.
 *
 * DMs, group chat and realm channels were the first surfaces to share reaction
 * chips; they now delegate the look and the reactor list to the same component
 * the feed uses, so the two can never drift again. The chat-specific bits stay
 * here: member permissions and the haptic on tap.
 */
export function ReactionChips({
  scope,
  messageId,
  groups,
  align = "left",
  canReact = true,
  hidden = false,
  spacing = "overlap",
  pulse = null,
  onToggle,
}: {
  scope: ReactionScope;
  messageId: string;
  groups: ReactionGroup[];
  /** Kept for call-site compatibility: the row fetches names itself. */
  reactorsFor?: unknown;
  align?: "left" | "right";
  /** The channel's "who can add reactions" setting, enforced server-side too. */
  canReact?: boolean;
  /** Unsent or deleted messages never show or accept reactions. */
  hidden?: boolean;
  /** `overlap` is a tight 4px gap under a bubble; cards use `below` (8px). */
  spacing?: "overlap" | "below";
  pulse?: ReactionPulse | null;
  onToggle: (emoji: string) => Promise<boolean>;
}) {
  return (
    <ReactionRow
      source={{ kind: "message", id: messageId, scope }}
      groups={groups}
      align={align}
      canReact={canReact}
      hidden={hidden}
      spacing={spacing}
      pulse={pulse && pulse.messageId === messageId ? pulse : null}
      onToggle={async (emoji) => {
        if (!canReact) {
          toast.error("Only owners and moderators can add reactions here");
          return false;
        }
        reactionHaptic();
        return onToggle(emoji);
      }}
    />
  );
}

export default ReactionChips;
