import { useRef, type ReactNode } from "react";
import { motion } from "framer-motion";
import { CornerUpLeft, MoreHorizontal, SmilePlus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SwipeableMessage } from "@/components/chat/SwipeToReply";
import { nameColorFor } from "@/lib/chat-appearance";

export type MessageRowAuthor = {
  /** Author user id — only used to pick a stable, readable name colour. */
  id?: string | null;
  name: string;
  avatarUrl?: string | null;
  accentColor?: string | null;
};

export type MessageRowProps = {
  id: string;
  author: MessageRowAuthor;
  /** Local clock label, e.g. "5:25 PM". */
  time: string;
  /** First message of an author burst: shows the avatar and the name header. */
  startsGroup: boolean;
  /** A drawer/menu is open for this row — raise it above its neighbours. */
  lifted?: boolean;
  /** Notification deep link or jump-to landed here. */
  highlighted?: boolean;
  /** The message mentions the signed-in user (lime wash + lime rail). */
  mentionsMe?: boolean;
  /** Tap on the avatar or name opens the profile card. */
  onAuthorClick?: (event: React.MouseEvent) => void;
  /**
   * Long-press anywhere in the row opens this message's actions — the same
   * whole-row gesture realm chat has, so pressing the avatar, the name, a photo
   * or the empty space beside a short line all work.
   */
  onLongPress?: () => void;
  /** Swipe right on a message to quote it in the composer. */
  onSwipeReply?: () => void;
  /**
   * Mouse-only hover toolbar, like Discord's: a smiley that opens the reaction
   * picker and a “more” button that opens the actions. Both fall back to the
   * long-press sheet on touch, where there is nothing to hover.
   */
  onQuickReact?: () => void;
  onMoreActions?: () => void;
  /** Small badges beside the name (BOT, PINNED…). */
  badges?: ReactNode;
  className?: string;
  children: ReactNode;
};

/**
 * One flat chat row — avatar, name and time in a gutter, then the message body.
 * This is the layout realms use; DMs and group chats render through the same
 * component so no surface shows balloons around text. The body is whatever the
 * caller passes (quote, media, text, reactions, embeds): the row only owns the
 * spacing, the name colour and the long-press selection rules.
 */
export function MessageRow({
  id,
  author,
  time,
  startsGroup,
  lifted = false,
  highlighted = false,
  mentionsMe = false,
  onAuthorClick,
  onLongPress,
  onSwipeReply,
  onQuickReact,
  onMoreActions,
  badges,
  className = "",
  children,
}: MessageRowProps) {
  const initial = (author.name || "?").charAt(0).toUpperCase();
  const color = nameColorFor(author.id ?? null, author.accentColor ?? null);

  // Whole-row long press. A 320ms hold with a 20px movement allowance: finger
  // jitter on a phone is well under that, while a scroll drag always crosses it
  // and cancels — so scrolling a conversation never pops a menu open.
  const pressTimer = useRef<number | null>(null);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  const clearPress = () => {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    pressOrigin.current = null;
  };
  const startPress = (event: React.PointerEvent) => {
    if (!onLongPress) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    // Controls inside the row own their presses (profile links, media, the
    // reaction bar, an embed button…).
    if ((event.target as HTMLElement).closest("button, a, input, textarea, [data-interactive]")) return;
    clearPress();
    const target = event.target as HTMLElement;
    pressOrigin.current = { x: event.clientX, y: event.clientY };
    pressTimer.current = window.setTimeout(() => {
      pressTimer.current = null;
      // A horizontal swipe cancels the hold even when it started slowly.
      if (target.closest('[data-swipe-active="true"]')) return;
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(35);
        } catch {
          // Vibration is a nicety; a device without it must not break the tap.
        }
      }
      onLongPress();
    }, 320);
  };
  const movePress = (event: React.PointerEvent) => {
    const origin = pressOrigin.current;
    if (!origin) return;
    if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 20) clearPress();
  };

  return (
    <SwipeableMessage onReply={onSwipeReply ?? (() => {})} disabled={!onSwipeReply}>
    <motion.div
      id={`msg-${id}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      onPointerDown={startPress}
      onPointerMove={movePress}
      onPointerUp={clearPress}
      onPointerCancel={clearPress}
      onContextMenu={
        onLongPress
          ? (event) => {
              if ((event.target as HTMLElement).closest("a, input, textarea, button")) return;
              event.preventDefault();
              onLongPress();
            }
          : undefined
      }
      className={`realm-message relative ${startsGroup ? "realm-message--group-start" : ""} ${
        lifted ? "z-[41]" : ""
      } ${highlighted ? "chat-jump-highlight" : ""} ${
        mentionsMe ? "realm-message--mentions-me" : ""
      } ${className}`}
    >
        {(onQuickReact || onMoreActions || onSwipeReply) && (
        <div className="chat-hover-actions">
            {onSwipeReply && (
              <button
                type="button"
                data-interactive="true"
                onClick={(event) => {
                  event.stopPropagation();
                  onSwipeReply();
                }}
                aria-label="Reply"
                title="Reply"
              >
                <CornerUpLeft className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          {onQuickReact && (
            <button
              type="button"
              data-interactive="true"
              onClick={(event) => {
                event.stopPropagation();
                onQuickReact();
              }}
              aria-label="Add reaction"
              title="Add reaction"
            >
              <SmilePlus className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          {onMoreActions && (
            <button
              type="button"
              data-interactive="true"
              onClick={(event) => {
                event.stopPropagation();
                onMoreActions();
              }}
              aria-label="More message actions"
              title="More"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
      {startsGroup ? (
        <button
          type="button"
          data-interactive="true"
          onClick={onAuthorClick}
          className="shrink-0 rounded-full transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95"
          aria-label={`View ${author.name}'s profile`}
        >
          <Avatar className="h-9 w-9 shrink-0 cursor-pointer hover:opacity-90">
            <AvatarImage src={author.avatarUrl ?? undefined} />
            <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">
              {initial}
            </AvatarFallback>
          </Avatar>
        </button>
      ) : (
        // Same author: the gutter carries the time on hover instead of an avatar.
        <span aria-hidden="true" className="realm-message__time">
          {time}
        </span>
      )}
      <div className="min-w-0 flex-1">
        {startsGroup && (
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            {onAuthorClick ? (
              <button
                type="button"
                data-interactive="true"
                onClick={onAuthorClick}
                className="cursor-pointer text-left text-sm font-bold hover:underline"
                style={{ color }}
              >
                {author.name}
              </button>
            ) : (
              <span className="text-sm font-bold" style={{ color }}>
                {author.name}
              </span>
            )}
            {badges}
            <span className="text-[10px] text-muted-foreground">{time}</span>
          </div>
        )}
        {children}
      </div>
    </motion.div>
    </SwipeableMessage>
  );
}
