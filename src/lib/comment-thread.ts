import { supabase } from "@/integrations/supabase/client";
import type { ReactionGroup } from "@/lib/reactions";

/**
 * Post and reel comments share one thread.
 *
 * Before this the four comment surfaces each carried their own copy of the same
 * queries and mutations, and they had drifted: only the full-screen post sheet
 * knew about votes, the feed card fetched reactions one comment at a time, and
 * reel comments could not be answered or deleted at all. One module owns the
 * reads, the writes and the cache keys now, so a fix lands everywhere.
 *
 * Comments are soft-deleted (`deleted_at`), and a deleted comment that still
 * holds replies comes back as a tombstone — see `pruneDeletedComments`.
 */

/** The page size every surface reads. A full page is reported as "100+". */
export const COMMENT_PAGE = 100;

/** Post comments are long-form; reels keep the old 500 character limit. */
export const COMMENT_MAX_LENGTH = 2000;
export const REEL_COMMENT_MAX_LENGTH = 500;

export type CommentAuthor = {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type CommentRow = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  parent_comment_id?: string | null;
  deleted_at?: string | null;
  author?: CommentAuthor | null;
};

export type CommentVotes = { counts: Map<string, number>; mine: Set<string> };
export type CommentReactionMap = Map<string, ReactionGroup[]>;

/**
 * Cache keys. `list` keeps the `["comments", postId]` key the app already
 * invalidated, so the feed's comment counters and the thread stay in step.
 */
export const commentKeys = {
  list: (postId: string) => ["comments", postId] as const,
  votes: (postId: string, ids: readonly string[]) =>
    ["comment-votes", postId, ids.length, ids[0] ?? ""] as const,
  reactions: (postId: string, ids: readonly string[]) =>
    ["comment-reactions", postId, ids.length, ids[0] ?? ""] as const,
};

/** Compact relative time: 12s, 4m, 3h, 2d, 5mo, 1y. */
export function timeAgo(iso: string): string {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(months / 12)}y`;
}

/** A missing function means the votes SQL was never applied to this project. */
export function commentVoteError(error: Error): string {
  if (/toggle_comment_like|schema cache|does not exist|not found|404/i.test(error.message ?? "")) {
    return "Comment votes aren't enabled on this database yet (backend-sql/11_reactions_likes.sql).";
  }
  return error.message;
}

/** A missing reaction function is the same story, said in one line. */
export function commentReactionError(error: Error): string {
  if (/toggle_comment_reaction|schema cache|does not exist|not found|404/i.test(error.message ?? "")) {
    return "Comment reactions aren't enabled on this database yet (backend-sql/11_reactions_likes.sql).";
  }
  return "Couldn't react to that comment.";
}

const COMMENT_COLUMNS =
  "id, body, created_at, author_id, parent_comment_id, deleted_at, author:profiles!post_comments_author_id_fkey(username, display_name, avatar_url)";
const LEGACY_COMMENT_COLUMNS =
  "id, body, created_at, author_id, author:profiles!post_comments_author_id_fkey(username, display_name, avatar_url)";

/**
 * The newest `COMMENT_PAGE` comments, returned oldest first.
 *
 * The query has to read newest-first: asking for the first hundred rows of a
 * busy post used to hand back the *oldest* hundred, so new comments never
 * appeared and the header counted a page that had nothing to do with the
 * thread on screen. The rows are reversed afterwards because the tree builder
 * and every renderer expect chronological input. Deleted rows stay in the page
 * so a surviving reply keeps its parent tombstone; the header count excludes
 * them. Older projects without `parent_comment_id`/`deleted_at` fall back to
 * the plain column list, which reads as a flat, undeletable thread.
 */
export async function fetchCommentPage(postId: string): Promise<CommentRow[]> {
  const source = (supabase.from as any)("post_comments");
  const read = (columns: string) =>
    source
      .select(columns)
      .eq("post_id", postId)
      .order("created_at", { ascending: false })
      .limit(COMMENT_PAGE);
  let { data, error } = await read(COMMENT_COLUMNS);
  if (error && /deleted_at|parent_comment_id|schema cache/i.test(error.message ?? "")) {
    ({ data, error } = await read(LEGACY_COMMENT_COLUMNS));
  }
  if (error) throw error;
  return ((data ?? []) as CommentRow[]).slice().reverse();
}

/** Vote counts for a page of comments, in one indexed read. */
export async function fetchCommentVotes(
  commentIds: readonly string[],
  myId: string | undefined,
): Promise<CommentVotes> {
  const counts = new Map<string, number>();
  const mine = new Set<string>();
  if (!commentIds.length) return { counts, mine };
  for (let i = 0; i < commentIds.length; i += 100) {
    const slice = commentIds.slice(i, i + 100);
    const { data, error } = await (supabase.from as any)("comment_likes")
      .select("comment_id, user_id")
      .in("comment_id", slice);
    if (error) break; // older projects simply show no vote numbers yet
    for (const row of data ?? []) {
      counts.set(row.comment_id, (counts.get(row.comment_id) ?? 0) + 1);
      if (myId && row.user_id === myId) mine.add(row.comment_id);
    }
  }
  return { counts, mine };
}

/**
 * Every reaction on the visible page, grouped per comment. One read for the
 * whole thread instead of the per-row query the feed card used to issue.
 */
export async function fetchCommentReactions(
  commentIds: readonly string[],
  myId: string | undefined,
): Promise<CommentReactionMap> {
  const grouped: CommentReactionMap = new Map();
  if (!commentIds.length) return grouped;
  for (let i = 0; i < commentIds.length; i += 100) {
    const slice = commentIds.slice(i, i + 100);
    const { data, error } = await (supabase.from as any)("comment_reactions")
      .select("comment_id, user_id, emoji")
      .in("comment_id", slice);
    if (error) break; // no reactions table / no read policy: show none
    for (const row of data ?? []) {
      const bucket = grouped.get(row.comment_id) ?? [];
      let entry = bucket.find((reaction) => reaction.emoji === row.emoji);
      if (!entry) {
        entry = { emoji: row.emoji, count: 0, mine: false };
        bucket.push(entry);
      }
      entry.count += 1;
      if (myId && row.user_id === myId) entry.mine = true;
      grouped.set(row.comment_id, bucket);
    }
  }
  for (const [commentId, bucket] of grouped) {
    grouped.set(
      commentId,
      [...bucket].sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji)),
    );
  }
  return grouped;
}

function sortReactions(rows: readonly { emoji: string; count: number; mine: boolean }[]): ReactionGroup[] {
  return rows
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
}

export async function addComment(
  postId: string,
  authorId: string,
  body: string,
  parentCommentId?: string,
): Promise<void> {
  const { error } = await (supabase.from as any)("post_comments").insert({
    post_id: postId,
    author_id: authorId,
    body,
    ...(parentCommentId ? { parent_comment_id: parentCommentId } : {}),
  });
  if (error && parentCommentId && /parent_comment_id|schema cache/i.test(error.message ?? "")) {
    throw new Error("Replies need the comment setup in backend-sql/12_comment_counts.sql.");
  }
  if (error) throw error;
}

/**
 * Soft delete: the row stays so a reply keeps its branch, and the author filter
 * means the update can only ever touch the caller's own comment.
 */
export async function softDeleteComment(commentId: string, authorId: string): Promise<void> {
  const { error } = await (supabase.from as any)("post_comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commentId)
    .eq("author_id", authorId);
  if (error) throw error;
}

export async function toggleCommentLike(
  commentId: string,
): Promise<{ liked: boolean; like_count: number }> {
  const { data, error } = await (supabase.rpc as any)("toggle_comment_like", {
    _comment_id: commentId,
  });
  if (error) throw error;
  return data as { liked: boolean; like_count: number };
}

/** Toggles one emoji and returns that comment's whole reaction list. */
export async function toggleCommentReaction(
  commentId: string,
  emoji: string,
): Promise<ReactionGroup[]> {
  const { data, error } = await (supabase.rpc as any)("toggle_comment_reaction", {
    _comment_id: commentId,
    _emoji: emoji,
  });
  if (error) {
    throw new Error(
      commentReactionError(new Error(error.message ?? "toggle_comment_reaction failed")),
    );
  }
  const rows = Array.isArray(data) ? data : [];
  return sortReactions(
    rows.map((row: { emoji: string; count: number; mine: boolean }) => ({
      emoji: row.emoji,
      count: Number(row.count ?? 0),
      mine: Boolean(row.mine),
    })),
  );
}
