import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  badges,
  className = "",
  children,
}: MessageRowProps) {
  const initial = (author.name || "?").charAt(0).toUpperCase();
  const color = nameColorFor(author.id ?? null, author.accentColor ?? null);

  return (
    <motion.div
      id={`msg-${id}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`realm-message ${startsGroup ? "realm-message--group-start" : ""} ${
        lifted ? "relative z-[41]" : ""
      } ${highlighted ? "bg-primary/[0.08] ring-2 ring-primary/50" : ""} ${
        mentionsMe ? "realm-message--mentions-me" : ""
      } ${className}`}
    >
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
  );
}
