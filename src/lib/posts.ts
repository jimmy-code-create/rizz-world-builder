import { supabase } from "@/integrations/supabase/client";
import { startTrace } from "@/lib/upload-trace";

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
    is_creator?: boolean;
    is_verified_creator?: boolean;
  } | null;
};

const FEED_COLS =
  "id, author_id, caption, media_url, media_type, like_count, comment_count, reaction_count, created_at, visibility, quote_post_id, remix_of, edited_at, author:profiles!posts_author_id_fkey(username, display_name, avatar_url, accent_color)";

async function attachAuthorFlags(posts: FeedPost[]): Promise<FeedPost[]> {
  const userIds = [...new Set(posts.map((post) => post.author_id).filter(Boolean))];
  if (userIds.length === 0) return posts;

  try {
    const { data, error } = await supabase.rpc("get_post_author_flags", { _user_ids: userIds });
    // Keep the feed available if the backend migration has not been applied yet.
    if (error || !data) return posts;
    const flagsByUser = new Map(data.map((row) => [row.user_id, row] as const));
    return posts.map((post) => {
      const flags = flagsByUser.get(post.author_id);
      if (!flags || !post.author) return post;
      return {
        ...post,
        author: {
          ...post.author,
          is_creator: flags.is_creator,
          is_verified_creator: flags.is_verified_creator,
        },
      };
    });
  } catch {
    return posts;
  }
}

export async function fetchFeed(limit = 30): Promise<FeedPost[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(FEED_COLS)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return attachAuthorFlags((data ?? []) as unknown as FeedPost[]);
}

/** Fetch a single post for quote-embeds. */
export async function fetchPostById(id: string): Promise<FeedPost | null> {
  const { data, error } = await supabase.from("posts").select(FEED_COLS).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [post] = await attachAuthorFlags([data as unknown as FeedPost]);
  return post;
}

export async function fetchUserPosts(userId: string): Promise<FeedPost[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(
      FEED_COLS + ", is_pinned, pinned_at"
    )
    .eq("author_id", userId)
    .order("is_pinned", { ascending: false })
    .order("pinned_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return attachAuthorFlags((data ?? []) as unknown as FeedPost[]);
}

export async function createPost(input: {
  authorId: string;
  caption: string;
  file?: File | null;
  kind?: "post" | "reel" | "story";
  visibility?: "public" | "close_friends";
  quotePostId?: string | null;
  remixOf?: string | null;
  allowEmpty?: boolean;
  onProgress?: (stage: string) => void;
}) {
  const trace = startTrace(input.kind ?? "post");
  let media_url: string | null = null;
  let media_type: "image" | "video" | "none" = "none";
  let mediaPath: string | null = null;

  if (input.file) {
    trace.step("validate file", input.file.name + " · " + (input.file.size / 1024 / 1024).toFixed(2) + "MB · " + (input.file.type || "unknown type"));
    const MAX = 50 * 1024 * 1024;
    if (input.file.size > MAX) {
      throw new Error(trace.fail("validate file", "That file is " + (input.file.size / 1024 / 1024).toFixed(1) + "MB — max is 50MB. Try a smaller/compressed clip."));
    }
    if (input.file.size === 0) throw new Error(trace.fail("validate file", "That file is empty. Pick another one."));
    const okType = input.file.type.startsWith("image/") || input.file.type.startsWith("video/");
    if (!okType) throw new Error(trace.fail("validate file", "Only image or video files can be uploaded."));
    const rawExt = (input.file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6) || "bin";
    mediaPath = input.authorId + "/" + Date.now() + "-" + crypto.randomUUID() + "." + rawExt;
    input.onProgress?.(input.file.type.startsWith("video/") ? "Uploading video…" : "Uploading image…");
    trace.step("storage upload", "post-media/" + mediaPath);
    const { error: upErr } = await supabase.storage
      .from("post-media")
      .upload(mediaPath, input.file, { contentType: input.file.type, upsert: false });
    if (upErr) {
      const m = upErr.message || "";
      trace.fail("storage upload", m);
      if (/exceeded|too large|payload/i.test(m)) throw new Error("Upload rejected — file is too large. Compress and retry.");
      if (/permission|unauth|forbidden|rls/i.test(m)) throw new Error("You're not signed in. Sign back in and try again.");
      if (/mime|content.type/i.test(m)) throw new Error("That file type isn't allowed. Use JPG/PNG/MP4/MOV.");
      throw new Error("Upload failed: " + m);
    }
    const { data: pub } = supabase.storage.from("post-media").getPublicUrl(mediaPath);
    const publicUrl = pub?.publicUrl ?? "";
    if (!publicUrl.startsWith("https://") && !publicUrl.startsWith("http://")) {
      try { await supabase.storage.from("post-media").remove([mediaPath]); } catch {}
      throw new Error(trace.fail("public url", "Upload finished, but the media URL wasn't available. Please retry."));
    }
    media_url = publicUrl;
    media_type = input.file.type.startsWith("video/") ? "video" : "image";
    trace.step("public url", media_url);
  }

  const caption = (input.caption ?? "").trim().slice(0, 2000) || null;
  if (!caption && !media_url && !input.quotePostId && !input.allowEmpty) {
    throw new Error(trace.fail("validate content", "Add a caption, poll, quote, or media before posting"));
  }

  input.onProgress?.("Publishing post…");
  trace.step("direct insert", "authenticated RLS insert");
  const { data: row, error } = await supabase
    .from("posts")
    .insert({
      author_id: input.authorId,
      caption,
      media_url,
      media_type,
      visibility: input.visibility ?? "public",
      quote_post_id: input.quotePostId ?? null,
      remix_of: input.remixOf ?? null,
    })
    .select()
    .single();
  if (error) {
    if (mediaPath) {
      try { await supabase.storage.from("post-media").remove([mediaPath]); } catch {}
    }
    const m = error.message || "";
    trace.fail("direct insert", m);
    if (/out of range|integer|numeric/i.test(m)) throw new Error("A number was too large. Try a shorter caption.");
    if (/value too long|too long/i.test(m)) throw new Error("Caption or link is too long. Shorten it and try again.");
    if (/row-level|permission|unauth/i.test(m)) throw new Error("Your session expired or your account can't post. Sign in again and retry.");
    throw new Error("Couldn't post: " + m);
  }

  trace.done();
  return row;
}

export async function toggleLike(postId: string, userId: string, liked: boolean) {
  if (liked) {
    const { error } = await supabase
      .from("post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("post_likes")
      .insert({ post_id: postId, user_id: userId });
    if (error) throw error;
  }
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
  const { error } = await supabase
    .from("post_reactions")
    .insert({ post_id: postId, user_id: userId, emoji });
  if (error && !error.message.includes("duplicate")) throw error;
}

export async function removeReaction(postId: string, userId: string, emoji: string) {
  const { error } = await supabase
    .from("post_reactions")
    .delete()
    .eq("post_id", postId)
    .eq("user_id", userId)
    .eq("emoji", emoji);
  if (error) throw error;
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
  const { data, error } = await supabase
    .from("post_comments")
    .select(
      "id, body, created_at, author_id, author:profiles!post_comments_author_id_fkey(username, display_name, avatar_url)"
    )
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function addComment(postId: string, userId: string, body: string) {
  const { error } = await supabase
    .from("post_comments")
    .insert({ post_id: postId, author_id: userId, body });
  if (error) throw error;
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
  const { data, error } = await supabase
    .from("posts")
    .select(FEED_COLS)
    .eq("media_type", "video")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return attachAuthorFlags((data ?? []) as unknown as FeedPost[]);
}

/** Reels that remix a given reel. */
export async function fetchRemixes(postId: string): Promise<FeedPost[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(FEED_COLS)
    .eq("remix_of", postId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return attachAuthorFlags((data ?? []) as unknown as FeedPost[]);
}