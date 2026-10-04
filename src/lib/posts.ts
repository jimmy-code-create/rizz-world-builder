import { supabase } from "@/integrations/supabase/client";
import { startTrace } from "@/lib/upload-trace";
import { parseExternalReelLink, type ExternalReelPlatform } from "@/lib/external-reels";

export type FeedPost = {
  id: string;
  author_id: string;
  caption: string | null;
  media_url: string | null;
  media_type: "image" | "video" | "none" | null;
  like_count: number;
  comment_count: number;
  reaction_count: number;
  created_at: string;
  is_pinned?: boolean;
  visibility?: "public" | "close_friends";
  quote_post_id?: string | null;
  remix_of?: string | null;
  edited_at?: string | null;
  has_poll?: boolean;
  author: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    accent_color: string | null;
    verified_creator?: boolean;
  } | null;
};

const FEED_COLS =
  "id, author_id, caption, media_url, media_type, like_count, comment_count, reaction_count, created_at, visibility, quote_post_id, remix_of, edited_at, author:profiles!posts_author_id_fkey(username, display_name, avatar_url, accent_color)";
const FEED_COLS_WITHOUT_COUNTS =
  "id, author_id, caption, media_url, media_type, reaction_count, created_at, visibility, quote_post_id, remix_of, edited_at, author:profiles!posts_author_id_fkey(username, display_name, avatar_url, accent_color)";

function isMissingCountColumn(error: { message?: string } | null) {
  const message = (error?.message ?? "").toLowerCase();
  return (message.includes("like_count") || message.includes("comment_count"))
    && (message.includes("does not exist") || message.includes("schema cache") || message.includes("column"));
}

async function countRows(table: "post_likes" | "post_comments", postId: string) {
  const source = (supabase.from as any)(table);
  let query = source.select("post_id", { count: "exact", head: true }).eq("post_id", postId);
  if (table === "post_comments") {
    const active = await query.is("deleted_at", null);
    if (!active.error) return active.count ?? 0;
    const message = String(active.error.message ?? "").toLowerCase();
    if (!message.includes("deleted_at") && !message.includes("schema cache")) throw active.error;
    query = source.select("post_id", { count: "exact", head: true }).eq("post_id", postId);
  }
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

async function hydrateMissingCounts<T extends { id: string; like_count?: number; comment_count?: number }>(rows: T[]) {
  const missing = rows.filter((row) => row.like_count == null || row.comment_count == null);
  if (!missing.length) return rows as (T & Pick<FeedPost, "like_count" | "comment_count">)[];
  const ids = missing.map((row) => row.id);
  const { data, error } = await (supabase.rpc as any)("get_post_counts", { _post_ids: ids });
  const counts = new Map<string, { like_count: number; comment_count: number }>();
  if (!error && Array.isArray(data)) {
    for (const row of data) counts.set(row.post_id, {
      like_count: Number(row.like_count ?? 0),
      comment_count: Number(row.comment_count ?? 0),
    });
  }
  const fallbackIds = ids.filter((id) => !counts.has(id));
  await Promise.all(fallbackIds.map(async (id) => {
    const [like_count, comment_count] = await Promise.all([
      countRows("post_likes", id),
      countRows("post_comments", id),
    ]);
    counts.set(id, { like_count, comment_count });
  }));
  return rows.map((row) => {
    const count = counts.get(row.id);
    return {
      ...row,
      like_count: row.like_count ?? count?.like_count ?? 0,
      comment_count: row.comment_count ?? count?.comment_count ?? 0,
    };
  }) as (T & Pick<FeedPost, "like_count" | "comment_count">)[];
}

async function queryFeedPosts<T extends { id: string; like_count?: number; comment_count?: number }>(
  query: (columns: string) => PromiseLike<{ data: unknown[] | null; error: { message?: string } | null }>,
) {
  let result = await query(FEED_COLS);
  if (isMissingCountColumn(result.error)) result = await query(FEED_COLS_WITHOUT_COUNTS);
  if (result.error) throw result.error;
  return hydrateMissingCounts((result.data ?? []) as T[]);
}

export async function addVerifiedCreatorFlags<T extends { author_id: string; author: FeedPost["author"] }>(posts: T[]): Promise<T[]> {
  const authorIds = [...new Set(posts.map((post) => post.author_id).filter(Boolean))];
  if (!authorIds.length) return posts;

  const { data, error } = await supabase
    .from("user_badges")
    .select("user_id, badges!inner(slug)")
    .in("user_id", authorIds)
    .eq("badges.slug", "verified_creator");
  if (error) throw error;

  const verifiedIds = new Set((data ?? []).map((badge) => badge.user_id));
  return posts.map((post) => ({
    ...post,
    author: post.author
      ? { ...post.author, verified_creator: verifiedIds.has(post.author_id) }
      : null,
  }));
}

export async function fetchFeed(limit = 30): Promise<FeedPost[]> {
  const data = await queryFeedPosts<FeedPost>((columns) => supabase
    .from("posts")
    .select(columns)
    .neq("media_type", "video")
    .order("created_at", { ascending: false })
    .limit(limit));
  return addVerifiedCreatorFlags(data);
}

/** Fetch a single post for quote-embeds. */
export async function fetchPostById(id: string): Promise<FeedPost | null> {
  const rows = await queryFeedPosts<FeedPost>((columns) => supabase.from("posts").select(columns).eq("id", id));
  if (!rows.length) return null;
  const [post] = await addVerifiedCreatorFlags(rows);
  return post;
}

export async function fetchUserPosts(userId: string): Promise<FeedPost[]> {
  const data = await queryFeedPosts<FeedPost>((columns) => supabase
    .from("posts")
    .select(columns.replace("edited_at,", "edited_at, is_pinned, pinned_at,"))
    .eq("author_id", userId)
    .order("is_pinned", { ascending: false })
    .order("pinned_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false }));
  return addVerifiedCreatorFlags(data);
}

export async function createPost(input: {
  authorId: string;
  caption: string;
  file?: File | null;
  externalSourceUrl?: string | null;
  kind?: "post" | "reel" | "story";
  visibility?: "public" | "close_friends";
  quotePostId?: string | null;
  remixOf?: string | null;
  onProgress?: (stage: "uploading" | "saving") => void;
}) {
  const trace = startTrace(input.kind ?? "post");
  let media_url: string | null = null;
  let mediaPath: string | null = null;
  let media_type: "image" | "video" | "none" = "none";
  let sourcePlatform: ExternalReelPlatform | null = null;
  if (input.externalSourceUrl) {
    const parsed = parseExternalReelLink(input.externalSourceUrl);
    if (!parsed.ok) throw new Error(parsed.error);
    if (parsed.value.platform === "instagram") {
      throw new Error("This video link isn't supported here.");
    }
    if (input.file) throw new Error("Choose a video file or an external link, not both.");
    media_url = parsed.value.sourceUrl;
    media_type = "video";
    sourcePlatform = parsed.value.platform;
    trace.step("validate external reel", sourcePlatform);
  }
  if (input.file) {
    trace.step("validate file", `${input.file.name} · ${(input.file.size / 1024 / 1024).toFixed(2)}MB · ${input.file.type || "unknown type"}`);
    // Client-side guards for a friendly error before hitting the wire.
    const MAX = 50 * 1024 * 1024;
    if (input.file.size > MAX) {
      throw new Error(trace.fail("validate file", `That file is ${(input.file.size / 1024 / 1024).toFixed(1)}MB — max is 50MB. Try a smaller/compressed clip.`));
    }
    if (input.file.size === 0) throw new Error(trace.fail("validate file", "That file is empty. Pick another one."));
    const okType = input.file.type.startsWith("image/") || input.file.type.startsWith("video/");
    if (!okType) throw new Error(trace.fail("validate file", "Only image or video files can be uploaded."));
    // Sanitize extension to avoid weird storage paths
    const rawExt = (input.file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6) || "bin";
    mediaPath = `${input.authorId}/${Date.now()}-${crypto.randomUUID()}.${rawExt}`;
    trace.step("storage upload", `post-media/${mediaPath}`);
    input.onProgress?.("uploading");
    const { error: upErr } = await supabase.storage
      .from("post-media")
      .upload(mediaPath, input.file, { contentType: input.file.type, upsert: false });
    if (upErr) {
      const m = upErr.message || "";
      trace.fail("storage upload", m);
      if (/exceeded|too large|payload/i.test(m)) throw new Error("Upload rejected — file is too large. Compress and retry.");
      if (/permission|unauth|forbidden|rls/i.test(m)) throw new Error("You're not signed in. Sign back in and try again.");
      if (/mime|content.type/i.test(m)) throw new Error("That file type isn't allowed. Use JPG/PNG/MP4/MOV.");
      throw new Error(`Upload failed: ${m}`);
    }
    const { data: pub } = supabase.storage.from("post-media").getPublicUrl(mediaPath);
    media_url = pub?.publicUrl ?? null;
    if (!media_url || !/^https?:\/\//i.test(media_url)) {
      await supabase.storage.from("post-media").remove([mediaPath]);
      throw new Error(trace.fail("public url", "The upload finished but no public media URL was returned. Please try again."));
    }
    media_type = input.file.type.startsWith("video/") ? "video" : "image";
    trace.step("public url", media_url);
  }
  const caption = (input.caption ?? "").trim().slice(0, 2000) || null;
  if (!caption && !media_url) throw new Error(trace.fail("validate content", "Add a caption or media before posting"));

  input.onProgress?.("saving");
  trace.step("direct authenticated insert", "posts");
  const { data: row, error } = await supabase
    .from("posts")
    .insert({
      author_id: input.authorId,
      caption: caption || null,
      media_url: media_url || null,
      media_type: media_type || "none",
      ...(sourcePlatform ? { source_platform: sourcePlatform } : {}),
      visibility: input.visibility ?? "public",
      quote_post_id: input.quotePostId ?? null,
      remix_of: input.remixOf ?? null,
    })
    .select()
    .single();
  if (error) {
    trace.fail("direct authenticated insert", error.message);
    if (mediaPath) {
      const { error: cleanupError } = await supabase.storage.from("post-media").remove([mediaPath]);
      if (cleanupError) console.warn("Post upload cleanup failed:", cleanupError.message);
    }
    throw new Error(error.message);
  }
  trace.done();
  return row;
}

/** Remove a post created as part of a failed multi-step publish, plus its uploaded media. */
export async function rollbackCreatedPost(postId: string, mediaUrl?: string | null) {
  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) throw new Error(`The poll failed and its post could not be removed: ${error.message}`);

  if (mediaUrl) {
    const marker = "/post-media/";
    const suffix = mediaUrl.split(marker)[1]?.split(/[?#]/)[0];
    if (suffix) {
      const { error: storageError } = await supabase.storage
        .from("post-media")
        .remove([decodeURIComponent(suffix)]);
      if (storageError) throw new Error(`The post was removed, but uploaded media cleanup failed: ${storageError.message}`);
    }
  }
}

export async function toggleLike(postId: string, userId: string, liked: boolean) {
  void userId;
  void liked;
  const { data, error } = await (supabase.rpc as any)("toggle_like", { _post_id: postId });
  if (error) throw error;
  return data as { liked: boolean; like_count: number };
}

export async function fetchMyLikes(userId: string, postIds: string[]) {
  if (postIds.length === 0) return new Set<string>();
  const { data, error } = await supabase
    .from("post_likes")
    .select("post_id")
    .eq("user_id", userId)
    .in("post_id", postIds);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.post_id));
}

export async function addReaction(postId: string, userId: string, emoji: string) {
  void userId;
  const { data, error } = await (supabase.rpc as any)("toggle_post_reaction", {
    _post_id: postId,
    _emoji: emoji,
  });
  if (error) throw error;
  return data;
}

export async function removeReaction(postId: string, userId: string, emoji: string) {
  return addReaction(postId, userId, emoji);
}

export async function fetchReactions(postId: string) {
  const { data, error } = await supabase
    .from("post_reactions")
    .select("emoji, user_id")
    .eq("post_id", postId);
  if (error) throw error;
  return data ?? [];
}

export async function fetchComments(postId: string) {
  const source = (supabase.from as any)("post_comments");
  const columns =
    "id, body, created_at, author_id, parent_comment_id, deleted_at, author:profiles!post_comments_author_id_fkey(username, display_name, avatar_url)";
  let { data, error } = await source
    .select(columns)
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error && /deleted_at|parent_comment_id|schema cache/i.test(error.message ?? "")) {
    ({ data, error } = await source
      .select("id, body, created_at, author_id, author:profiles!post_comments_author_id_fkey(username, display_name, avatar_url)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
      .limit(100));
  }
  if (error) throw error;
  return (data ?? []).filter((comment: { deleted_at?: string | null }) => !comment.deleted_at);
}

export async function addComment(postId: string, userId: string, body: string, parentCommentId?: string) {
  const payload = {
    post_id: postId,
    author_id: userId,
    body,
    ...(parentCommentId ? { parent_comment_id: parentCommentId } : {}),
  };
  const { error } = await (supabase.from as any)("post_comments")
    .insert(payload);
  if (error && parentCommentId && /parent_comment_id|schema cache/i.test(error.message ?? "")) {
    throw new Error("Replies need the comment-count setup in backend-sql/12_comment_counts.sql.");
  }
  if (error) throw error;
}

export async function toggleCommentLike(commentId: string) {
  const { data, error } = await (supabase.rpc as any)("toggle_comment_like", { _comment_id: commentId });
  if (error) throw error;
  return data as { liked: boolean; like_count: number };
}

export async function toggleCommentReaction(commentId: string, emoji: string) {
  const { data, error } = await (supabase.rpc as any)("toggle_comment_reaction", {
    _comment_id: commentId,
    _emoji: emoji,
  });
  if (error) throw error;
  return data as { emoji: string; count: number; mine: boolean }[];
}

export async function deletePost(postId: string) {
  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) throw error;
}

export async function updatePostCaption(postId: string, caption: string) {
  // Keep an edit-history entry so the card can show "Edited".
  const { data: prev } = await supabase.from("posts").select("caption").eq("id", postId).maybeSingle();
  if (prev) {
    await supabase.from("post_edits").insert({ post_id: postId, previous_caption: prev.caption });
  }
  const { error } = await supabase
    .from("posts")
    .update({ caption: caption.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", postId);
  if (error) throw error;
}

export async function fetchPostEdits(postId: string) {
  const { data, error } = await supabase
    .from("post_edits")
    .select("id, previous_caption, edited_at")
    .eq("post_id", postId)
    .order("edited_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function togglePinPost(postId: string, isPinned: boolean) {
  const { error } = await supabase
    .from("posts")
    .update({ is_pinned: !isPinned, pinned_at: !isPinned ? new Date().toISOString() : null } as any)
    .eq("id", postId);
  if (error) throw error;
}

export async function reportPost(input: {
  postId: string;
  reporterId: string;
  reason: string;
  details?: string;
}) {
  const { error } = await (supabase.from as any)("post_reports").insert({
    post_id: input.postId,
    reporter_id: input.reporterId,
    reason: input.reason,
    details: input.details ?? null,
  });
  if (error && !error.message.includes("duplicate")) throw error;
}

export async function fetchReels(limit = 30): Promise<FeedPost[]> {
  const data = await queryFeedPosts<FeedPost>((columns) => supabase
    .from("posts")
    .select(columns)
    .eq("media_type", "video")
    .order("created_at", { ascending: false })
    .limit(limit));
  return addVerifiedCreatorFlags(data);
}

/** Reels that remix a given reel. */
export async function fetchRemixes(postId: string): Promise<FeedPost[]> {
  const data = await queryFeedPosts<FeedPost>((columns) => supabase
    .from("posts")
    .select(columns)
    .eq("remix_of", postId)
    .order("created_at", { ascending: false }));
  return addVerifiedCreatorFlags(data);
}