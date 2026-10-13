import { motion } from "framer-motion";
import { BellOff, Heart, MessageSquare, Pin, Sparkles } from "lucide-react";
import { AuthorLine, CountPill, ReplierFaces, StateFlag, StatusChip, TagChip } from "@/components/forum/ForumBits";
import { ForumThumb } from "@/components/forum/ForumEmbeds";
import { forumActivityLabel, forumExcerpt, forumThumbnail } from "@/lib/forum-content";
import type { ForumPost, ForumStatus, ForumTag } from "@/lib/forums";
import type { ForumDensity, ForumLayout } from "@/lib/forum-prefs";
import { cn } from "@/lib/utils";

/**
 * One thread, in whichever layout the reader picked.
 *
 * The three layouts share every atom — chips, state flags, counts, faces — and
 * differ only in how much room they take: a card with a thumbnail, a single
 * dense row, or a gallery tile whose picture is the point.
 *
 * The whole card is clickable through an overlay button rather than a wrapping
 * <button>, so the tag chips inside stay real buttons instead of nested ones.
 */

export type ForumPostCardProps = {
  post: ForumPost;
  layout: ForumLayout;
  density: ForumDensity;
  tags: ForumTag[];
  status: ForumStatus | null;
  unread?: boolean;
  muted?: boolean;
  index?: number;
  onOpen: () => void;
  onToggleTag?: (tagId: string) => void;
};

function MetaRow({
  post,
  unread,
  muted,
  className,
}: {
  post: ForumPost;
  unread?: boolean;
  muted?: boolean;
  className?: string;
}) {
  const author = post.author;
  const name = author?.display_name || author?.username || "member";
  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px]", className)}>
      <AuthorLine name={name} avatarUrl={author?.avatar_url ?? null} size="sm" />
      <span className="text-muted-foreground">{forumActivityLabel(post.last_activity_at)}</span>
      <ReplierFaces people={post.recent_repliers ?? []} />
      <CountPill icon={<MessageSquare className="h-3 w-3" aria-hidden />}>
        {post.reply_count}
        <span className="sr-only"> replies</span>
      </CountPill>
      <CountPill icon={<Heart className="h-3 w-3" aria-hidden />}>{post.like_count}</CountPill>
      {unread && (
        <span className="inline-flex items-center gap-1 font-bold text-[var(--forum-accent)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--forum-accent)]" aria-hidden />
          New
        </span>
      )}
      {muted && <BellOff className="h-3 w-3 text-[var(--forum-archived)]" aria-label="Muted" />}
    </div>
  );
}

function StateRow({ post, tags, status, onToggleTag }: {
  post: ForumPost;
  tags: ForumTag[];
  status: ForumStatus | null;
  onToggleTag?: (tagId: string) => void;
}) {
  const shownTags = tags.slice(0, 3);
  const extra = tags.length - shownTags.length;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {status && <StatusChip status={status} />}
      {post.is_pinned && <StateFlag kind="pinned" withLabel />}
      {post.is_locked && <StateFlag kind="locked" />}
      {post.is_solved && <StateFlag kind="solved" withLabel />}
      {post.archived_at && <StateFlag kind="archived" />}
      {shownTags.map((tag) => (
        <TagChip
          key={tag.id}
          tag={tag}
          onClick={onToggleTag ? () => onToggleTag(tag.id) : undefined}
          // The card body lets clicks fall through to the overlay button; a chip
          // is the one thing inside it that takes its own click back.
          className={onToggleTag ? "pointer-events-auto" : undefined}
        />
      ))}
      {extra > 0 && <span className="text-[11px] text-muted-foreground">+{extra}</span>}
    </div>
  );
}

export function ForumPostCard({
  post,
  layout,
  density,
  tags,
  status,
  unread,
  muted,
  index = 0,
  onOpen,
  onToggleTag,
}: ForumPostCardProps) {
  const thumbnail = forumThumbnail(post);
  const excerpt = forumExcerpt(post.body, layout === "compact" ? 90 : 160);
  const stateClass = post.is_pinned
    ? "forum-card-pinned"
    : post.is_solved
      ? "forum-card-solved"
      : "";
  const author = post.author;
  const name = author?.display_name || author?.username || "member";

  const overlay = (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open thread: ${post.title}`}
      className="absolute inset-0 z-0 cursor-pointer rounded-[var(--forum-radius)]"
    />
  );

  if (layout === "compact") {
    return (
      <motion.article
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index * 0.03, 0.2), duration: 0.22, ease: "easeOut" }}
        className={cn("forum-card relative flex items-center gap-3 px-3 py-2.5", stateClass)}
      >
        {overlay}
        {thumbnail ? (
          <img
            src={thumbnail}
            alt=""
            loading="lazy"
            decoding="async"
            className="pointer-events-none relative z-10 h-12 w-12 shrink-0 rounded-[var(--forum-radius-sm)] object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="pointer-events-none relative z-10 grid h-12 w-12 shrink-0 place-items-center rounded-[var(--forum-radius-sm)] bg-[var(--forum-surface-sunken)] text-muted-foreground"
          >
            <MessageSquare className="h-4 w-4" />
          </span>
        )}
        <div className="pointer-events-none relative z-10 min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            {post.is_pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-[var(--forum-pinned)]" aria-hidden />}
            <h3 className="truncate font-display text-[14px] font-semibold">{post.title}</h3>
          </div>
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="truncate">{name}</span>
            <span>{forumActivityLabel(post.last_activity_at)}</span>
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="h-3 w-3" aria-hidden />
              {post.reply_count}
            </span>
            <span className="inline-flex items-center gap-1">
              <Heart className="h-3 w-3" aria-hidden />
              {post.like_count}
            </span>
            {post.is_solved && <StateFlag kind="solved" />}
            {post.is_locked && <StateFlag kind="locked" />}
            {unread && <span className="font-bold text-[var(--forum-accent)]">New</span>}
          </div>
        </div>
        <div className="relative z-10 shrink-0">
          <ReplierFaces people={post.recent_repliers ?? []} max={3} />
        </div>
      </motion.article>
    );
  }

  if (layout === "gallery") {
    return (
      <motion.article
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index * 0.035, 0.24), duration: 0.24, ease: "easeOut" }}
        className={cn("forum-card relative overflow-hidden", stateClass)}
      >
        {overlay}
        {thumbnail ? (
          <ForumThumb url={thumbnail} alt={post.title} className="rounded-b-none border-0" />
        ) : (
          <div className="grid h-28 place-items-center bg-[var(--forum-surface-sunken)] text-muted-foreground">
            <MessageSquare className="h-5 w-5" aria-hidden />
          </div>
        )}
        <div className="space-y-1.5 p-3" style={{ padding: "calc(var(--forum-pad) * 0.7)" }}>
          <h3 className="line-clamp-2 font-display text-[14px] font-semibold leading-snug">{post.title}</h3>
          {excerpt && <p className="line-clamp-2 text-[12px] text-muted-foreground">{excerpt}</p>}
          <div className="relative z-10">
            <StateRow post={post} tags={tags} status={status} onToggleTag={onToggleTag} />
          </div>
          <MetaRow post={post} unread={unread} muted={muted} />
        </div>
      </motion.article>
    );
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.035, 0.24), duration: 0.26, ease: "easeOut" }}
      className={cn(
        "forum-card relative flex gap-3",
        density === "compact" ? "p-3" : "p-4",
        stateClass,
      )}
      style={{ padding: density === "compact" ? "calc(var(--forum-pad) * 0.7)" : "var(--forum-pad)" }}
    >
      {overlay}
      <div className="pointer-events-none relative z-10 min-w-0 flex-1 space-y-2">
        <div className="relative z-10">
          <StateRow post={post} tags={tags} status={status} onToggleTag={onToggleTag} />
        </div>
        <h3 className="line-clamp-2 font-display text-[15px] font-bold leading-snug">{post.title}</h3>
        {excerpt && <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{excerpt}</p>}
        <MetaRow post={post} unread={unread} muted={muted} className="pt-0.5" />
        {post.is_solved && (
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--forum-solved)]">
            <Sparkles className="h-3 w-3" aria-hidden />
            Best answer marked
          </p>
        )}
      </div>
      {thumbnail && (
        <div className="pointer-events-none relative z-10 h-24 w-24 shrink-0 overflow-hidden rounded-[var(--forum-radius-sm)] sm:h-28 sm:w-32">
          <img
            src={thumbnail}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        </div>
      )}
    </motion.article>
  );
}
