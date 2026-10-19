import { supabase } from "@/integrations/supabase/client";

/**
 * Notification helpers.
 *
 * The notifications table has no comment id, and the trigger that fires when
 * somebody comments on your post writes the fixed label "New Comment" into
 * `title`. That label tells you nothing and gives you no way to find the post
 * the comment is about, so the comment is recovered client side and the
 * notification is turned into a real link.
 */

export type NotificationRow = {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: string;
  post_id: string | null;
  title: string | null;
  body: string | null;
  data: unknown;
  read: boolean;
  created_at: string;
};

type CommentRow = {
  id: string;
  body: string | null;
  post_id: string;
  author_id: string;
  created_at: string;
};

type PostRow = {
  id: string;
  caption: string | null;
  author: { username: string | null } | null;
};

export type CommentTarget = {
  commentId: string;
  body: string;
  /** The post the comment was left on, so the notification can name it. */
  postCaption: string | null;
  postAuthorUsername: string | null;
};

/** The placeholder the live trigger writes; it must never be shown as-is. */
const GENERIC_COMMENT_TITLE = "New Comment";

/**
 * The comment behind every "commented on your post" notification.
 *
 * The trigger fires on the comment insert, so the matching comment is the one
 * by that actor on that post at, or just before, the notification's time.
 */
export async function fetchCommentTargets(
  rows: readonly NotificationRow[],
): Promise<Map<string, CommentTarget>> {
  const out = new Map<string, CommentTarget>();
  const wanted = rows.filter((n) => n.type === "comment" && n.post_id && n.actor_id);
  if (!wanted.length) return out;

  const postIds = [...new Set(wanted.map((n) => n.post_id as string))];

  const [commentsResult, postsResult] = await Promise.all([
    supabase
      .from("post_comments")
      .select("id, body, post_id, author_id, created_at")
      .in("post_id", postIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(400),
    supabase
      .from("posts")
      .select("id, caption, author:profiles!posts_author_id_fkey(username)")
      .in("id", postIds),
  ]);

  const comments: CommentRow[] = commentsResult.data ?? [];
  const posts = new Map<string, PostRow>((postsResult.data ?? []).map((p) => [p.id, p]));

  for (const n of wanted) {
    const pool = comments.filter((c) => c.post_id === n.post_id && c.author_id === n.actor_id);
    if (!pool.length) continue;
    const at = new Date(n.created_at).getTime();
    const match = pool.find((c) => new Date(c.created_at).getTime() <= at + 5000) ?? pool[0];
    const post = posts.get(n.post_id as string);
    out.set(n.id, {
      commentId: (n.data as { comment_id?: string } | null)?.comment_id ?? match.id,
      body: match.body ?? "",
      postCaption: post?.caption ?? null,
      postAuthorUsername: post?.author?.username ?? null,
    });
  }

  return out;
}

/** True when the title is the placeholder the trigger writes, not real text. */
export function isGenericTitle(title: string | null | undefined): boolean {
  if (!title) return true;
  const trimmed = title.trim().toLowerCase();
  return trimmed === GENERIC_COMMENT_TITLE.toLowerCase() || trimmed === "";
}
