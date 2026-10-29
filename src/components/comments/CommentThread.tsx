import { memo, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, CornerDownRight, Plus, SmilePlus, Trash2 } from "lucide-react";
import { MORE_REACTIONS, QUICK_REACTIONS, type ReactionGroup } from "@/lib/reactions";
import { MAX_COMMENT_INDENT_DEPTH, type CommentTree } from "@/lib/comment-tree";
import { timeAgo, type CommentReactionMap, type CommentRow, type CommentVotes } from "@/lib/comment-thread";
import { cn, formatCount } from "@/lib/utils";
import { emojiTextClass } from "@/lib/text-size";
import { AnimatedEmoji } from "@/components/motion/AnimatedEmoji";
import { InteractiveAvatar } from "@/components/ui/avatar";
import { ProfilePreviewTrigger } from "@/components/ProfilePreview";
import { CommentBody } from "./CommentBody";

/**
 * The threaded comment list, shared by the post sheet, the feed card's inline
 * thread, the desktop discussion pane and reel comments.
 *
 * Replies are grouped under the comment they answer, so a conversation reads
 * top-down instead of as one chronological queue. Each row can be voted on,
 * answered, reacted to with the app's own emoji set, and — when it is yours —
 * soft-deleted; a deleted comment that still holds replies stays as a
 * tombstone, because removing it would orphan the whole branch.
 */
export type CommentThreadProps = {
  tree: CommentTree<CommentRow>;
  /** Ids that survived pruning — deleted leaves are not rendered at all. */
  visible: Set<string>;
  votes?: CommentVotes;
  reactions?: CommentReactionMap;
  signedIn: boolean;
  /** The signed-in member's id, so a row knows whether Delete is its own. */
  myId?: string;
  /** The comment the composer is currently answering, for the ring. */
  replyingTo?: string | null;
  compact?: boolean;
  onReply: (comment: CommentRow) => void;
  onVote: (commentId: string) => void;
  onReact: (commentId: string, emoji: string) => void;
  onDelete: (comment: CommentRow) => void;
};

/**
 * Reactions that appeared on this row since the last render.
 *
 * The pill for an emoji you just added mounts with `pop`, so the reaction
 * visibly lands. Whatever was already there only wobbles on hover, which keeps
 * a thread full of reactions calm instead of permanently bouncing.
 */
function useFreshEmoji(emoji: string[]): Set<string> {
  const previous = useRef<Set<string>>(new Set(emoji));
  const [held, setHeld] = useState<Set<string>>(new Set());
  // Joining makes the dependency stable: the array is new every render, its
  // contents usually are not.
  const key = emoji.join("|");
  useEffect(() => {
    const next = new Set(emoji);
    const fresh = [...next].filter((value) => !previous.current.has(value));
    previous.current = next;
    if (!fresh.length) return;
    setHeld(new Set(fresh));
    // Hold the pop long enough to finish even if the thread re-renders.
    const timer = window.setTimeout(() => setHeld(new Set()), 600);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is the content of `emoji`
  }, [key]);
  return held;
}

function ReactionTray({
  onPick,
  compact,
}: {
  onPick: (emoji: string) => void;
  compact: boolean;
}) {
  const [showMore, setShowMore] = useState(false);
  const size = compact ? "h-9 w-9" : "h-11 w-11";
  return (
    <div
      className="mt-1.5 animate-in fade-in-0 zoom-in-95 rounded-xl border border-white/10 bg-black/40 p-1"
      data-comment-reaction-tray
    >
      <div className="flex flex-wrap items-center gap-0.5">
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onPick(emoji)}
            aria-label={`React with ${emoji}`}
            className={cn(
              "grid shrink-0 place-items-center rounded-md transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
              size,
            )}
          >
            <AnimatedEmoji emoji={emoji} size={compact ? 19 : 22} motion="hover" />
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowMore((value) => !value)}
          aria-expanded={showMore}
          aria-label={showMore ? "Fewer reactions" : "More reactions"}
          className={cn(
            "grid shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
            size,
          )}
        >
          <Plus className={cn("motion-icon h-4 w-4", showMore && "rotate-45")} />
        </button>
      </div>
      {showMore && (
        <div className="mt-1 grid grid-cols-8 gap-0.5 border-t border-white/5 pt-1">
          {MORE_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onPick(emoji)}
              aria-label={`React with ${emoji}`}
              className="grid h-8 w-8 place-items-center rounded transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            >
              <AnimatedEmoji emoji={emoji} size={17} motion="hover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const CommentNodeView = memo(function CommentNodeView({
  comment,
  depth,
  tree,
  visible,
  votes,
  reactions,
  signedIn,
  myId,
  replyingTo,
  compact,
  onReply,
  onVote,
  onReact,
  onDelete,
}: { comment: CommentRow; depth: number } & CommentThreadProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const deleted = Boolean(comment.deleted_at);
  const author = comment.author;
  const name = author?.display_name || author?.username || "someone";
  const children = (tree.children.get(comment.id) ?? []).filter((child) => visible.has(child.id));
  const branchSize = children.reduce(
    (total, child) => total + 1 + (tree.descendants.get(child.id) ?? 0),
    0,
  );
  const voted = votes?.mine.has(comment.id) ?? false;
  const voteCount = votes?.counts.get(comment.id) ?? 0;
  const groups: ReactionGroup[] = reactions?.get(comment.id) ?? [];
  const freshEmoji = useFreshEmoji(groups.map((group) => group.emoji));
  const owned = signedIn && !deleted && !!myId && comment.author_id === myId;

  return (
    <div data-comment-id={comment.id}>
      <div
        className={cn(
          "-mx-1 flex gap-2 rounded-xl px-1 transition-colors",
          compact ? "py-1.5" : "py-2",
          replyingTo === comment.id && "bg-primary/[0.07] ring-1 ring-primary/25",
        )}
      >
        {!deleted && (
          <button
            type="button"
            onClick={() => onVote(comment.id)}
            aria-pressed={voted}
            data-comment-vote
            aria-label={voted ? "Remove your vote" : "Upvote this comment"}
            className={cn(
              "flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border font-bold transition",
              compact ? "h-8 w-7 text-[10px]" : "h-9 w-8 text-[11px]",
              voted
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-white/10 bg-white/[0.03] text-muted-foreground hover:border-white/20 hover:text-foreground",
            )}
          >
            <ChevronUp className={cn("motion-icon", compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
            <span className="leading-none tabular-nums">{formatCount(voteCount)}</span>
          </button>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
            {deleted ? (
              <span
                aria-hidden="true"
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-dashed border-white/20 text-[10px] text-muted-foreground"
              >
                ×
              </span>
            ) : (
              <InteractiveAvatar
                src={author?.avatar_url}
                fallback={name.charAt(0).toUpperCase()}
                size={compact ? 22 : 24}
                userId={comment.author_id}
                username={author?.username}
              />
            )}
            {deleted ? (
              <span className="text-xs italic text-muted-foreground">deleted</span>
            ) : (
              <ProfilePreviewTrigger
                username={author?.username ?? null}
                className="min-w-0 max-w-[12rem] truncate text-xs font-semibold"
              >
                {name}
              </ProfilePreviewTrigger>
            )}
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {timeAgo(comment.created_at)}
            </span>
          </div>

          {!deleted && depth > 0 && tree.byId.get(comment.parent_comment_id ?? "")?.deleted_at && (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
              <CornerDownRight className="h-3 w-3 shrink-0" />
              replying to a deleted comment
            </p>
          )}

          {deleted ? (
            <p className="mt-1 text-sm italic text-muted-foreground/80">
              This comment was deleted.
            </p>
          ) : (
            <p
              className={cn(
                "mt-1 whitespace-pre-wrap break-words leading-snug",
                compact ? "text-[13px]" : "text-sm",
                emojiTextClass(comment.body, "comment"),
              )}
            >
              <CommentBody body={comment.body} />
            </p>
          )}

          {groups.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {groups.slice(0, 6).map((group) => (
                <button
                  key={group.emoji}
                  type="button"
                  onClick={() => onReact(comment.id, group.emoji)}
                  aria-pressed={group.mine}
                  aria-label={`${group.emoji} ${group.count}${group.mine ? ", including you" : ""}`}
                  disabled={!signedIn}
                  className={cn(
                    "flex h-6 items-center gap-1 rounded-full border px-1.5 text-[11px] leading-none transition",
                    group.mine
                      ? "border-primary/45 bg-primary/15 text-foreground"
                      : "border-white/10 bg-white/[0.05] text-muted-foreground hover:border-white/20 hover:text-foreground",
                    !signedIn && "cursor-default",
                  )}
                >
                  <AnimatedEmoji
                    emoji={group.emoji}
                    size={14}
                    motion={freshEmoji.has(group.emoji) ? "pop" : "hover"}
                  />
                  <span className="tabular-nums">{group.count}</span>
                </button>
              ))}
              {groups.length > 6 && (
                <span className="text-[10px] text-muted-foreground">+{groups.length - 6}</span>
              )}
            </div>
          )}

          {!deleted && (
            <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
              {signedIn && (
                <button
                  type="button"
                  onClick={() => onReply(comment)}
                  className="flex items-center gap-1 py-0.5 transition-colors hover:text-primary"
                >
                  <CornerDownRight className="motion-icon h-3.5 w-3.5" />
                  Reply
                </button>
              )}
              {signedIn && (
                <button
                  type="button"
                  onClick={() => setPickerOpen((open) => !open)}
                  aria-expanded={pickerOpen}
                  className={cn(
                    "flex items-center gap-1 py-0.5 transition-colors hover:text-primary",
                    pickerOpen && "text-primary",
                  )}
                >
                  <SmilePlus className="motion-icon h-3.5 w-3.5" />
                  React
                </button>
              )}
              {owned && (
                <button
                  type="button"
                  onClick={() => onDelete(comment)}
                  className="flex items-center gap-1 py-0.5 transition-colors hover:text-destructive"
                >
                  <Trash2 className="motion-icon h-3.5 w-3.5" />
                  Delete
                </button>
              )}
              {children.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCollapsed((value) => !value)}
                  className="flex items-center gap-1 py-0.5 transition-colors hover:text-foreground"
                >
                  {collapsed ? (
                    <ChevronDown className="motion-icon h-3 w-3" />
                  ) : (
                    <ChevronUp className="motion-icon h-3 w-3" />
                  )}
                  {collapsed
                    ? `Show ${branchSize} ${branchSize === 1 ? "reply" : "replies"}`
                    : "Hide replies"}
                </button>
              )}
            </div>
          )}

          {pickerOpen && !deleted && (
            <ReactionTray
              compact={Boolean(compact)}
              onPick={(emoji) => {
                onReact(comment.id, emoji);
                setPickerOpen(false);
              }}
            />
          )}
        </div>
      </div>

      {children.length > 0 && !collapsed && (
        <div
          className={cn(
            "border-l border-white/[0.08]",
            depth < MAX_COMMENT_INDENT_DEPTH ? "ml-2 pl-2.5" : "ml-0 pl-0",
          )}
        >
          {children.map((child) => (
            <CommentNodeView
              key={child.id}
              comment={child}
              depth={depth + 1}
              tree={tree}
              visible={visible}
              votes={votes}
              reactions={reactions}
              signedIn={signedIn}
              myId={myId}
              replyingTo={replyingTo}
              compact={compact}
              onReply={onReply}
              onVote={onVote}
              onReact={onReact}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export function CommentThread(props: CommentThreadProps) {
  const { tree, visible } = props;
  return (
    <div className="space-y-0.5" role="list">
      {tree.roots
        .filter((root) => visible.has(root.id))
        .map((root) => (
          <div key={root.id} role="listitem">
            <CommentNodeView comment={root} depth={0} {...props} />
          </div>
        ))}
    </div>
  );
}
