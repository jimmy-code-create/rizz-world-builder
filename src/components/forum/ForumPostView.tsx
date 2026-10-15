import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArrowLeft,
  Bell,
  BellOff,
  Check,
  CheckCircle2,
  Copy,
  CornerDownRight,
  Eye,
  Heart,
  Link2,
  Loader2,
  Lock,
  LockOpen,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { FullScreenLayer } from "@/components/FullScreenLayer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AuthorLine, ReactionBar, StateFlag, StatusChip, TagChip } from "@/components/forum/ForumBits";
import { ForumRichBody } from "@/components/forum/ForumEmbeds";
import { useMediaViewer } from "@/components/media/useMediaViewer";
import { buildForumReplyTree, forumActivityLabel, forumJoinLabel, type ForumReplyNode } from "@/lib/forum-content";
import {
  createForumReply,
  deleteForumPost,
  fetchForumAuthorBadges,
  useForumMemberRoles,
  deleteForumReply,
  forumThreadKey,
  markForumPostRead,
  moderateForumPost,
  setForumBestAnswer,
  toggleForumLike,
  toggleForumReaction,
  toggleForumReplyLike,
  toggleForumReplyReaction,
  useForumThread,
  useForumThreadRealtime,
  type ForumConfig,
  type ForumPost,
  type ForumReactionChip,
  type ForumReply,
  type ForumStatus,
  type ForumTag,
} from "@/lib/forums";
import { realmRoleLabel, type RealmRole } from "@/lib/realm-roles";
import type { Badge } from "@/lib/badges";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

function toggleReactionInChips(chips: ForumReactionChip[], emoji: string): ForumReactionChip[] {
  const existing = chips.find((c) => c.emoji === emoji);
  if (!existing) {
    return [...chips, { emoji, count: 1, mine: true }];
  }
  if (existing.mine) {
    if (existing.count <= 1) {
      return chips.filter((c) => c.emoji !== emoji);
    }
    return chips.map((c) => (c.emoji === emoji ? { ...c, count: c.count - 1, mine: false } : c));
  } else {
    return chips.map((c) => (c.emoji === emoji ? { ...c, count: c.count + 1, mine: true } : c));
  }
}

/**
 * One thread, full screen.
 *
 * The author card carries who they are — role colour, badges, join date — and
 * the replies draw as a thread with thin connector lines, the OP tagged on the
 * original poster's own replies, and the best answer lifted out of the list and
 * pinned under the post with a green edge.
 */

function ReplyComposer({
  placeholder,
  busy,
  value,
  autoFocus,
  compact,
  onChange,
  onSubmit,
  onCancel,
}: {
  placeholder: string;
  busy: boolean;
  value: string;
  autoFocus?: boolean;
  compact?: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const expanded = focused || value.trim().length > 0;
  return (
    <div className={cn("flex items-end gap-2", compact ? "" : "w-full")}>
      <Input
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && window.matchMedia("(pointer: fine)").matches) {
            event.preventDefault();
            onSubmit();
          }
        }}
        placeholder={placeholder}
        maxLength={8000}
        className={cn(
          "border-[var(--forum-border)] bg-[var(--forum-surface-sunken)] transition-[min-height]",
          expanded ? "min-h-11" : "min-h-10",
        )}
      />
      {onCancel && (
        <Button type="button" variant="ghost" onClick={onCancel} className="h-10 shrink-0">
          Cancel
        </Button>
      )}
      <Button
        type="button"
        onClick={onSubmit}
        disabled={busy || !value.trim()}
        size="icon"
        className="h-10 w-10 shrink-0 border-0 bg-primary text-primary-foreground"
        aria-label="Send reply"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
    </div>
  );
}

function ReplyItem({
  node,
  post,
  config,
  userId,
  canModerate,
  onReply,
  onReaction,
  onLike,
  onChanged,
  onOpenImage,
  muted,
  roles,
  badges,
}: {
  node: ForumReplyNode<ForumReply>;
  post: ForumPost;
  config: ForumConfig;
  userId: string | null;
  canModerate: boolean;
  onReply: (reply: ForumReply) => void;
  onReaction: (replyId: string, emoji: string) => void;
  onLike: (replyId: string) => void;
  onChanged: () => void;
  onOpenImage: (url: string) => void;
  muted: boolean;
  roles: Map<string, RealmRole>;
  badges: Map<string, Badge[]>;
}) {
  const qc = useQueryClient();
  const reply = node.reply;
  const author = reply.author;
  const role = roles.get(reply.author_id) ?? author?.role ?? null;
  const name = author?.display_name || author?.username || "member";
  const isOp = reply.author_id === post.author_id;
  const isBest = post.best_reply_id === reply.id;
  const mine = !!userId && reply.author_id === userId;
  const deleted = !!reply.deleted_at || !reply.body.trim();

  const act = (run: () => Promise<unknown>, failure: string) => {
    void run()
      .then(() => {
        void qc.invalidateQueries({ queryKey: forumThreadKey(post.id) });
      })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : failure));
  };

  if (deleted) {
    return (
      <div className="forum-branch forum-branch-elbow py-2 text-[12px] italic text-muted-foreground">
        {isBest ? <div className="mb-1"><StateFlag kind="solved" withLabel /></div> : null}
        This reply was deleted.
      </div>
    );
  }

  return (
    <div
      className={cn("forum-branch forum-branch-elbow", node.depth > 0 && "mt-3")}
      style={{ marginLeft: `${Math.min(node.depth, 3) * 0.5}rem` }}
    >
      <div
        className={cn(
          "rounded-[var(--forum-radius-sm)] border p-3",
          isBest
            ? "border-[var(--forum-solved)] bg-[color-mix(in_oklab,var(--forum-solved)_10%,transparent)]"
            : "border-[var(--forum-border)] bg-[var(--forum-surface-sunken)]",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <AuthorLine
            name={name}
            avatarUrl={author?.avatar_url ?? null}
            role={role}
            badges={badges.get(reply.author_id) ?? []}
            size="sm"
            subtitle={
              <span className="inline-flex items-center gap-1.5">
                <span>{realmRoleLabel(role)}</span>
                <span aria-hidden>·</span>
                <span>{forumActivityLabel(reply.created_at)}</span>
                {reply.edited_at ? (
                  <>
                    <span aria-hidden>·</span>
                    <span>edited</span>
                  </>
                ) : null}
              </span>
            }
          />
          {isOp && (
            <span className="forum-chip border-[var(--forum-role-owner)] text-[var(--forum-role-owner)]">OP</span>
          )}
          {isBest && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--forum-solved)]">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              Best answer
            </span>
          )}
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => onReply(reply)}
              className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-white/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={`Reply to ${name}`}
            >
              <CornerDownRight className="h-3.5 w-3.5" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Reply options for ${name}`}
                  className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-white/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass-strong border-white/10 z-[150]">
                <DropdownMenuItem onSelect={() => onReply(reply)}>
                  <CornerDownRight className="mr-2 h-4 w-4" aria-hidden /> Reply
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    void navigator.clipboard.writeText(reply.body).then(
                      () => toast.success("Reply text copied"),
                      () => toast.error("Couldn't copy reply"),
                    );
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" aria-hidden /> Copy text
                </DropdownMenuItem>
                {(mine || post.author_id === userId || canModerate) && !isBest && (
                  <DropdownMenuItem
                    onSelect={() =>
                      act(() => setForumBestAnswer(post.id, reply.id), "Couldn't mark the best answer")
                    }
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4 text-[var(--forum-solved)]" aria-hidden /> Mark best answer
                  </DropdownMenuItem>
                )}
                {isBest && (mine || post.author_id === userId || canModerate) && (
                  <DropdownMenuItem
                    onSelect={() => act(() => setForumBestAnswer(post.id, null), "Couldn't clear that")}
                  >
                    <Check className="mr-2 h-4 w-4" aria-hidden /> Unmark best answer
                  </DropdownMenuItem>
                )}
                {(mine || canModerate) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={() => act(() => deleteForumReply(reply.id), "Couldn't delete that reply")}
                    >
                      <Trash2 className="mr-2 h-4 w-4" aria-hidden /> Delete reply
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="mt-2 text-[0.94em]">
          <ForumRichBody body={reply.body} onOpenImage={onOpenImage} />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          {!muted && (
            <ReactionBar
              chips={reply.reactions ?? []}
              options={config.reactions}
              compact
              disabled={!userId}
              onPick={(emoji) => onReaction(reply.id, emoji)}
            />
          )}
          <button
            type="button"
            disabled={!userId}
            onClick={() => onLike(reply.id)}
            aria-label={reply.liked ? "Unlike reply" : "Like reply"}
            className={cn(
              "inline-flex items-center gap-1 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md px-1 py-0.5",
              reply.liked ? "text-[var(--forum-accent)]" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Heart className={cn("h-3.5 w-3.5", reply.liked && "fill-current")} aria-hidden />
            {reply.like_count > 0 ? reply.like_count : "Like"}
          </button>
        </div>
      </div>

      {node.children.map((child) => (
        <ReplyItem
          key={child.reply.id}
          node={child}
          post={post}
          config={config}
          userId={userId}
          canModerate={canModerate}
          onReply={onReply}
          onReaction={onReaction}
          onLike={onLike}
          onChanged={onChanged}
          onOpenImage={onOpenImage}
          muted={muted}
          roles={roles}
          badges={badges}
        />
      ))}
    </div>
  );
}

export function ForumPostView({
  open,
  postId,
  config,
  tags,
  statuses,
  userId,
  canModerate,
  realmName,
  muted,
  onClose,
  onEdit,
  onChanged,
  onToggleMute,
}: {
  open: boolean;
  postId: string | null;
  config: ForumConfig;
  tags: ForumTag[];
  statuses: ForumStatus[];
  userId: string | null;
  canModerate: boolean;
  realmName: string;
  muted: boolean;
  onClose: () => void;
  onEdit: (post: ForumPost) => void;
  onChanged: () => void;
  onToggleMute: (muted: boolean) => void;
}) {
  const qc = useQueryClient();
  const media = useMediaViewer();
  const thread = useForumThread(open ? postId : null, userId, open);
  useForumThreadRealtime(open ? postId : null);
  const [replyTo, setReplyTo] = useState<ForumReply | null>(null);
  const [replyValue, setReplyValue] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const markedRef = useRef<string | null>(null);

  const post = thread.data?.post ?? null;

  // Opening a thread is what marks it read — once per thread per visit, and
  // after it has actually loaded, so a failed load never swallows the unread dot.
  useEffect(() => {
    if (!open || !post || !userId) return;
    if (markedRef.current === post.id) return;
    markedRef.current = post.id;
    void markForumPostRead(post.id)
      .then(() => {
        void qc.invalidateQueries({ queryKey: ["forum-posts", post.room_id] });
        void qc.invalidateQueries({ queryKey: ["forum-thread", post.id] });
      })
      .catch(() => {
        // Read state is a nicety; never surface a failure to read it.
      });
  }, [open, post, userId, qc]);

  // Closing the thread clears the draft and the read-mark, so reopening it later
  // visits it fresh — a second visit is a second read.
  useEffect(() => {
    if (open) return;
    setReplyTo(null);
    setReplyValue("");
    markedRef.current = null;
  }, [open]);

  const tree = useMemo(() => buildForumReplyTree(thread.data?.replies ?? []), [thread.data?.replies]);
  const bestReply = useMemo(
    () => (post?.best_reply_id ? (thread.data?.replies ?? []).find((item) => item.id === post.best_reply_id) ?? null : null),
    [post?.best_reply_id, thread.data?.replies],
  );

  // Who wrote what: role colours for the names, badges for the author card.
  const roles = useForumMemberRoles(post?.realm_id ?? null);
  const authorIds = useMemo(() => {
    const ids = new Set<string>();
    if (post?.author_id) ids.add(post.author_id);
    for (const reply of thread.data?.replies ?? []) ids.add(reply.author_id);
    return [...ids];
  }, [post?.author_id, thread.data?.replies]);
  const badges = useQuery({
    queryKey: ["forum-author-badges", authorIds.join(",")],
    enabled: open && authorIds.length > 0,
    staleTime: 5 * 60_000,
    queryFn: () => fetchForumAuthorBadges(authorIds),
  });
  const roleMap = roles.data ?? new Map<string, RealmRole>();
  const badgeMap = badges.data ?? new Map<string, Badge[]>();

  const tagById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags]);
  const status = post?.status_id ? statuses.find((entry) => entry.id === post.status_id) ?? null : null;

  const submitReply = () => {
    if (!post || !replyValue.trim()) return;
    const body = replyValue.trim();
    const parentId = replyTo?.id ?? null;
    setReplyBusy(true);
    void createForumReply({ postId: post.id, body, parentId })
      .then(() => {
        setReplyValue("");
        setReplyTo(null);
        void qc.invalidateQueries({ queryKey: forumThreadKey(post.id) });
        qc.setQueriesData<{ posts: ForumPost[]; hasMore: boolean }>({ queryKey: ["forum-posts"] }, (old) => {
          if (!old?.posts) return old;
          return {
            ...old,
            posts: old.posts.map((p) => (p.id === post.id ? { ...p, reply_count: (p.reply_count || 0) + 1 } : p)),
          };
        });
        onChanged();
      })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Couldn't post that reply"))
      .finally(() => setReplyBusy(false));
  };

  const handlePostReaction = (emoji: string) => {
    if (!post || !userId) return;
    const threadKey = [...forumThreadKey(post.id), userId ?? ""];
    const prev = qc.getQueryData<{ post: ForumPost; replies: ForumReply[] }>(threadKey);

    qc.setQueryData<{ post: ForumPost; replies: ForumReply[] }>(threadKey, (old) => {
      if (!old) return old;
      return {
        ...old,
        post: {
          ...old.post,
          reactions: toggleReactionInChips(old.post.reactions ?? [], emoji),
        },
      };
    });

    void toggleForumReaction(post.id, emoji)
      .then((chip) => {
        qc.setQueryData<{ post: ForumPost; replies: ForumReply[] }>(threadKey, (current) => {
          if (!current) return current;
          const filtered = (current.post.reactions ?? []).filter((c) => c.emoji !== emoji);
          const nextReactions = chip.count > 0 ? [...filtered, chip] : filtered;
          return {
            ...current,
            post: { ...current.post, reactions: nextReactions },
          };
        });
      })
      .catch((error: unknown) => {
        if (prev) qc.setQueryData(threadKey, prev);
        toast.error(error instanceof Error ? error.message : "Couldn't react to that");
      });
  };

  const handlePostLike = () => {
    if (!post || !userId) return;
    const threadKey = [...forumThreadKey(post.id), userId ?? ""];
    const prev = qc.getQueryData<{ post: ForumPost; replies: ForumReply[] }>(threadKey);
    const wasLiked = post.liked === true;
    const nextLiked = !wasLiked;
    const nextCount = Math.max(0, (post.like_count || 0) + (nextLiked ? 1 : -1));

    qc.setQueryData<{ post: ForumPost; replies: ForumReply[] }>(threadKey, (old) => {
      if (!old) return old;
      return {
        ...old,
        post: {
          ...old.post,
          liked: nextLiked,
          like_count: nextCount,
        },
      };
    });

    qc.setQueriesData<{ posts: ForumPost[]; hasMore: boolean }>({ queryKey: ["forum-posts"] }, (old) => {
      if (!old?.posts) return old;
      return {
        ...old,
        posts: old.posts.map((p) => (p.id === post.id ? { ...p, liked: nextLiked, like_count: nextCount } : p)),
      };
    });

    void toggleForumLike(post.id)
      .then((res) => {
        qc.setQueryData<{ post: ForumPost; replies: ForumReply[] }>(threadKey, (current) => {
          if (!current) return current;
          return {
            ...current,
            post: { ...current.post, liked: res.liked, like_count: res.like_count },
          };
        });
        qc.setQueriesData<{ posts: ForumPost[]; hasMore: boolean }>({ queryKey: ["forum-posts"] }, (old) => {
          if (!old?.posts) return old;
          return {
            ...old,
            posts: old.posts.map((p) => (p.id === post.id ? { ...p, liked: res.liked, like_count: res.like_count } : p)),
          };
        });
      })
      .catch((error: unknown) => {
        if (prev) qc.setQueryData(threadKey, prev);
        toast.error(error instanceof Error ? error.message : "Couldn't update that like");
      });
  };

  const handleReplyReaction = (replyId: string, emoji: string) => {
    if (!post || !userId) return;
    const threadKey = [...forumThreadKey(post.id), userId ?? ""];
    const prev = qc.getQueryData<{ post: ForumPost; replies: ForumReply[] }>(threadKey);

    qc.setQueryData<{ post: ForumPost; replies: ForumReply[] }>(threadKey, (old) => {
      if (!old) return old;
      return {
        ...old,
        replies: old.replies.map((reply) =>
          reply.id === replyId
            ? { ...reply, reactions: toggleReactionInChips(reply.reactions ?? [], emoji) }
            : reply,
        ),
      };
    });

    void toggleForumReplyReaction(replyId, emoji)
      .then((chip) => {
        qc.setQueryData<{ post: ForumPost; replies: ForumReply[] }>(threadKey, (current) => {
          if (!current) return current;
          return {
            ...current,
            replies: current.replies.map((reply) => {
              if (reply.id !== replyId) return reply;
              const filtered = (reply.reactions ?? []).filter((c) => c.emoji !== emoji);
              const nextReactions = chip.count > 0 ? [...filtered, chip] : filtered;
              return { ...reply, reactions: nextReactions };
            }),
          };
        });
      })
      .catch((error: unknown) => {
        if (prev) qc.setQueryData(threadKey, prev);
        toast.error(error instanceof Error ? error.message : "Couldn't react to that reply");
      });
  };

  const handleReplyLike = (replyId: string) => {
    if (!post || !userId) return;
    const threadKey = [...forumThreadKey(post.id), userId ?? ""];
    const prev = qc.getQueryData<{ post: ForumPost; replies: ForumReply[] }>(threadKey);
    const target = prev?.replies.find((r) => r.id === replyId);
    const wasLiked = target?.liked === true;
    const nextLiked = !wasLiked;
    const nextCount = Math.max(0, (target?.like_count || 0) + (nextLiked ? 1 : -1));

    qc.setQueryData<{ post: ForumPost; replies: ForumReply[] }>(threadKey, (old) => {
      if (!old) return old;
      return {
        ...old,
        replies: old.replies.map((reply) =>
          reply.id === replyId
            ? { ...reply, liked: nextLiked, like_count: nextCount }
            : reply,
        ),
      };
    });

    void toggleForumReplyLike(replyId)
      .then((res) => {
        qc.setQueryData<{ post: ForumPost; replies: ForumReply[] }>(threadKey, (current) => {
          if (!current) return current;
          return {
            ...current,
            replies: current.replies.map((reply) =>
              reply.id === replyId
                ? { ...reply, liked: res.liked, like_count: res.like_count }
                : reply,
            ),
          };
        });
      })
      .catch((error: unknown) => {
        if (prev) qc.setQueryData(threadKey, prev);
        toast.error(error instanceof Error ? error.message : "Couldn't update that like");
      });
  };

  const moderate = (action: Parameters<typeof moderateForumPost>[1], success: string) => {
    if (!post) return;
    void moderateForumPost(post.id, action)
      .then(() => {
        toast.success(success);
        void qc.invalidateQueries({ queryKey: forumThreadKey(post.id) });
        onChanged();
      })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Couldn't do that"));
  };

  return (
    <FullScreenLayer open={open}>
      <div
        className="forum-shell fixed inset-0 z-[70] flex flex-col"
        style={{ background: "var(--background)" }}
        role="dialog"
        aria-label={post ? `Thread: ${post.title}` : "Thread"}
      >
        {/* Sticky header: back, the forum, and everything you can do here. */}
        <div
          className="flex shrink-0 items-center gap-2 border-b px-3 py-2"
          style={{
            borderColor: "var(--forum-border)",
            background: "var(--surface-bar)",
            backdropFilter: "blur(18px) saturate(130%)",
            WebkitBackdropFilter: "blur(18px) saturate(130%)",
            paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.4rem)",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to the forum"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--forum-radius-sm)] border border-[var(--forum-border)] text-base" aria-hidden>
            {config.icon_emoji || "🗂️"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {realmName}
            </p>
            <p className="truncate font-display text-[13px] font-bold">{post?.title ?? "Loading…"}</p>
          </div>

          {muted ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Unmute this thread"
              onClick={() => onToggleMute(false)}
              className="h-10 w-10 text-[var(--forum-archived)]"
            >
              <BellOff className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Mute this thread"
              onClick={() => onToggleMute(true)}
              className="h-10 w-10 text-muted-foreground"
            >
              <Bell className="h-4 w-4" />
            </Button>
          )}

          {post && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Thread options"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground"
                >
                  <MoreHorizontal className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass-strong border-white/10">
                <DropdownMenuItem
                  onSelect={() => {
                    const url = `${window.location.origin}${window.location.pathname}?room=${post.room_id}&post=${post.id}`;
                    void navigator.clipboard.writeText(url).then(
                      () => toast.success("Link copied"),
                      () => toast.error("Couldn't copy the link"),
                    );
                  }}
                >
                  <Link2 className="mr-2 h-4 w-4" aria-hidden /> Copy link
                </DropdownMenuItem>
                {(post.author_id === userId || canModerate) && (
                  <DropdownMenuItem onSelect={() => onEdit(post)}>
                    <Pencil className="mr-2 h-4 w-4" aria-hidden /> Edit thread
                  </DropdownMenuItem>
                )}
                {(post.author_id === userId || canModerate) && (
                  <DropdownMenuItem
                    onSelect={() =>
                      moderate(post.is_solved ? "unsolve" : "solve", post.is_solved ? "Reopened" : "Marked solved")
                    }
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden />
                    {post.is_solved ? "Unmark solved" : "Mark solved"}
                  </DropdownMenuItem>
                )}
                {canModerate && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => moderate(post.is_pinned ? "unpin" : "pin", post.is_pinned ? "Unpinned" : "Pinned")}
                    >
                      {post.is_pinned ? (
                        <PinOff className="mr-2 h-4 w-4" aria-hidden />
                      ) : (
                        <Pin className="mr-2 h-4 w-4" aria-hidden />
                      )}
                      {post.is_pinned ? "Unpin" : "Pin"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => moderate(post.is_locked ? "unlock" : "lock", post.is_locked ? "Unlocked" : "Locked")}
                    >
                      {post.is_locked ? (
                        <LockOpen className="mr-2 h-4 w-4" aria-hidden />
                      ) : (
                        <Lock className="mr-2 h-4 w-4" aria-hidden />
                      )}
                      {post.is_locked ? "Unlock replies" : "Lock replies"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        moderate(post.archived_at ? "unarchive" : "archive", post.archived_at ? "Unarchived" : "Archived")
                      }
                    >
                      <Archive className="mr-2 h-4 w-4" aria-hidden />
                      {post.archived_at ? "Unarchive" : "Archive"}
                    </DropdownMenuItem>
                  </>
                )}
                {(post.author_id === userId || canModerate) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onSelect={() => {
                        void deleteForumPost(post.id)
                          .then(() => {
                            toast.success("Thread deleted");
                            onChanged();
                            onClose();
                          })
                          .catch((error: unknown) =>
                            toast.error(error instanceof Error ? error.message : "Couldn't delete that thread"),
                          );
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" aria-hidden /> Delete thread
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div ref={scrollRef} className="chat-scroll min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-6">
          {thread.isLoading && (
            <div className="mx-auto flex max-w-3xl flex-col gap-3">
              <div className="forum-card h-10 rounded-[var(--forum-radius)]" />
              <div className="forum-card h-28 rounded-[var(--forum-radius)]" />
              <div className="forum-card h-24 rounded-[var(--forum-radius)]" />
            </div>
          )}

          {thread.isError && (
            <p className="mx-auto max-w-3xl py-10 text-center text-sm text-muted-foreground">
              This thread couldn't be loaded. Close it and try again.
            </p>
          )}

          {post && (
            <article className="mx-auto max-w-3xl space-y-3">
              {post.cover_url && (
                <img
                  src={post.cover_url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="max-h-72 w-full rounded-[var(--forum-radius)] border border-[var(--forum-border)] object-cover"
                />
              )}

              <div className="flex flex-wrap items-center gap-1.5">
                {status && <StatusChip status={status} />}
                {post.is_pinned && <StateFlag kind="pinned" withLabel />}
                {post.is_locked && <StateFlag kind="locked" withLabel />}
                {post.is_solved && <StateFlag kind="solved" withLabel />}
                {post.archived_at && <StateFlag kind="archived" withLabel />}
                {post.tag_ids.map((id) => tagById.get(id)).filter((tag): tag is ForumTag => !!tag).map((tag) => (
                  <TagChip key={tag.id} tag={tag} />
                ))}
              </div>

              <h1 className="font-display text-2xl font-bold leading-tight sm:text-3xl">{post.title}</h1>

              {post.author && (
                <div
                  className="flex flex-wrap items-center gap-3 rounded-[var(--forum-radius)] border p-3"
                  style={{
                    borderColor: "var(--forum-border)",
                    background: "var(--forum-surface)",
                  }}
                >
                  <AuthorLine
                    name={post.author.display_name || post.author.username || "member"}
                    avatarUrl={post.author.avatar_url}
                    role={roleMap.get(post.author_id) ?? null}
                    badges={badgeMap.get(post.author_id) ?? []}
                    size="lg"
                    subtitle={
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        <span>{realmRoleLabel(roleMap.get(post.author_id))}</span>
                        <span aria-hidden>·</span>
                        <span>{forumJoinLabel(post.author.created_at)}</span>
                      </span>
                    }
                  />
                  <div className="ml-auto flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                      {post.reply_count}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5" aria-hidden />
                      {post.view_count}
                    </span>
                    <span>{forumActivityLabel(post.created_at)}</span>
                  </div>
                </div>
              )}

              <div className="forum-card p-4" style={{ padding: "var(--forum-pad)" }}>
                <ForumRichBody body={post.body} attachments={post.attachments} onOpenImage={media.openMedia} />

                {Object.keys(post.fields ?? {}).length > 0 && (
                  <dl className="mt-4 space-y-3 border-t pt-3" style={{ borderColor: "var(--forum-border)" }}>
                    {Object.entries(post.fields).map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</dt>
                        <dd className="mt-0.5 whitespace-pre-wrap text-[0.94em]">{value}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {!muted && (
                    <ReactionBar
                      chips={post.reactions ?? []}
                      options={config.reactions}
                      disabled={!userId}
                      onPick={handlePostReaction}
                    />
                  )}
                  <button
                    type="button"
                    disabled={!userId}
                    onClick={handlePostLike}
                    aria-label={post.liked ? "Unlike thread" : "Like thread"}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      post.liked
                        ? "border-[var(--forum-accent)] bg-[var(--forum-accent-soft)] text-foreground"
                        : "border-[var(--forum-border)] text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Heart className={cn("h-3.5 w-3.5", post.liked && "fill-current")} aria-hidden />
                    {post.like_count}
                  </button>
                </div>
              </div>

              {/* The best answer sits under the post, not buried in the thread. */}
              {bestReply && (
                <div
                  className="rounded-[var(--forum-radius)] border p-3"
                  style={{
                    borderColor: "var(--forum-solved)",
                    background: `color-mix(in oklab, var(--forum-solved) 9%, var(--forum-surface))`,
                  }}
                >
                  <p className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--forum-solved)]">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                    Best answer
                  </p>
                  <AuthorLine
                    name={bestReply.author?.display_name || bestReply.author?.username || "member"}
                    avatarUrl={bestReply.author?.avatar_url ?? null}
                    role={roleMap.get(bestReply.author_id) ?? null}
                    size="sm"
                    subtitle={forumActivityLabel(bestReply.created_at)}
                  />
                  <div className="mt-2">
                    <ForumRichBody body={bestReply.body} onOpenImage={media.openMedia} />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const element = document.getElementById(`forum-reply-${bestReply.id}`);
                      element?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }}
                    className="mt-2 text-[11px] font-semibold text-[var(--forum-accent)] hover:underline"
                  >
                    Jump to the reply
                  </button>
                </div>
              )}

              <section className="space-y-1 pt-2">
                <h2 className="font-display text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  {post.reply_count === 0 ? "No replies yet" : `${post.reply_count} ${post.reply_count === 1 ? "reply" : "replies"}`}
                </h2>
                {tree.map((node) => (
                  <div key={node.reply.id} id={`forum-reply-${node.reply.id}`}>
                    <ReplyItem
                      node={node}
                      post={post}
                      config={config}
                      userId={userId}
                      canModerate={canModerate}
                      onReply={(target) => {
                        setReplyTo(target);
                        document.getElementById("forum-reply-box")?.scrollIntoView({ behavior: "smooth", block: "end" });
                      }}
                      onReaction={handleReplyReaction}
                      onLike={handleReplyLike}
                      onChanged={onChanged}
                      onOpenImage={media.openMedia}
                      muted={muted}
                      roles={roleMap}
                      badges={badgeMap}
                    />
                  </div>
                ))}
              </section>
            </article>
          )}
        </div>

        {/* Sticky reply box: it grows when focused and follows the thread. */}
        <div id="forum-reply-box" className="forum-sticky-reply shrink-0 px-3 pt-2">
          <div className="mx-auto flex max-w-3xl flex-col gap-1.5">
            {replyTo && (
              <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                Replying to {replyTo.author?.display_name || replyTo.author?.username || "a reply"}
              </p>
            )}
            {post?.is_locked && !canModerate ? (
              <p className="py-2 text-center text-[12px] text-[var(--forum-locked)]">
                This thread is locked — no new replies.
              </p>
            ) : post?.archived_at && !canModerate ? (
              <p className="py-2 text-center text-[12px] text-[var(--forum-archived)]">
                This thread is archived. A moderator can reopen it.
              </p>
            ) : (
              <ReplyComposer
                value={replyValue}
                busy={replyBusy}
                placeholder={
                  replyTo
                    ? `Reply to ${replyTo.author?.display_name || replyTo.author?.username || "them"}`
                    : "Write a reply"
                }
                onChange={setReplyValue}
                onSubmit={submitReply}
                onCancel={replyTo ? () => setReplyTo(null) : undefined}
              />
            )}
            {config.slowmode_seconds > 0 && (
              <p className="text-[10px] text-[var(--forum-pinned)]">
                Slowmode: {config.slowmode_seconds}s between posts.
              </p>
            )}
          </div>
        </div>
      </div>
      {media.viewer}
    </FullScreenLayer>
  );
}
