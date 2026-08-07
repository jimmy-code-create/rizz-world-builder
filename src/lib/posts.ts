import { supabase } from "@/integrations/supabase/client";
import { createPostValidated } from "@/lib/posts.functions";

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
  author: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    accent_color: string | null;
  } | null;
};

export async function fetchFeed(limit = 30): Promise<FeedPost[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(
      "id, author_id, caption, media_url, media_type, like_count, comment_count, reaction_count, created_at, author:profiles!posts_author_id_fkey(username, display_name, avatar_url, accent_color)"
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as FeedPost[];
}

export async function fetchUserPosts(userId: string): Promise<FeedPost[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(
      "id, author_id, caption, media_url, media_type, like_count, comment_count, reaction_count, created_at, is_pinned, pinned_at, author:profiles!posts_author_id_fkey(username, display_name, avatar_url, accent_color)"
    )
    .eq("author_id", userId)
    .order("is_pinned", { ascending: false })
    .order("pinned_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as FeedPost[];
}

export async function createPost(input: {
  authorId: string;
  caption: string;
  file?: File | null;
}) {
  let media_url: string | null = null;
  let media_type: "image" | "video" | "none" = "none";
  if (input.file) {
    // Client-side guards for a friendly error before hitting the wire.
    const MAX = 50 * 1024 * 1024;
    if (input.file.size > MAX) {
      throw new Error(`That file is ${(input.file.size / 1024 / 1024).toFixed(1)}MB — max is 50MB. Try a smaller/compressed clip.`);
    }
    if (input.file.size === 0) throw new Error("That file is empty. Pick another one.");
    const okType = input.file.type.startsWith("image/") || input.file.type.startsWith("video/");
    if (!okType) throw new Error("Only image or video files can be uploaded.");
    // Sanitize extension to avoid weird storage paths
    const rawExt = (input.file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6) || "bin";
    const path = `${input.authorId}/${Date.now()}-${crypto.randomUUID()}.${rawExt}`;
    const { error: upErr } = await supabase.storage
      .from("post-media")
      .upload(path, input.file, { contentType: input.file.type, upsert: false });
    if (upErr) {
      const m = upErr.message || "";
      if (/exceeded|too large|payload/i.test(m)) throw new Error("Upload rejected — file is too large. Compress and retry.");
      if (/permission|unauth|forbidden|rls/i.test(m)) throw new Error("You're not signed in. Sign back in and try again.");
      if (/mime|content.type/i.test(m)) throw new Error("That file type isn't allowed. Use JPG/PNG/MP4/MOV.");
      throw new Error(`Upload failed: ${m}`);
    }
    const { data: pub } = supabase.storage.from("post-media").getPublicUrl(path);
    media_url = pub.publicUrl;
    media_type = input.file.type.startsWith("video/") ? "video" : "image";
  }
  const caption = (input.caption ?? "").trim().slice(0, 2000) || null;
  if (!caption && !media_url) throw new Error("Add a caption or media before posting");

  // Server-side validation first; fall back to a direct RLS-scoped insert if
  // the server function can't be reached (offline SSR worker, expired bearer).
  try {
    return await createPostValidated({
      data: { caption, media_url, media_type },
    });
  } catch (e: any) {
    const m = (e?.message || "").toString();
    const recoverable = /unauthorized|failed to fetch|network|500|fetch failed|not a function|is not defined/i.test(m);
    if (!recoverable) throw e;
    const { data: row, error } = await supabase
      .from("posts")
      .insert({ author_id: input.authorId, caption, media_url, media_type })
      .select()
      .single();
    if (error) {
      const em = error.message || "";
      if (/out of range|integer|numeric/i.test(em)) throw new Error("A number was too large. Try a shorter caption.");
      if (/value too long|too long/i.test(em)) throw new Error("Caption or link is too long. Shorten it and try again.");
      if (/row-level|permission/i.test(em)) throw new Error("Session expired. Sign back in and try again.");
      throw new Error(`Couldn't post: ${em}`);
    }
    return row;
  }
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
  const { error } = await supabase
    .from("posts")
    .update({ caption: caption.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", postId);
  if (error) throw error;
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
    .select(
      "id, author_id, caption, media_url, media_type, like_count, comment_count, reaction_count, created_at, author:profiles!posts_author_id_fkey(username, display_name, avatar_url, accent_color)"
    )
    .eq("media_type", "video")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as FeedPost[];
}