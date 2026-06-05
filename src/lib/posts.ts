import { supabase } from "@/integrations/supabase/client";

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
      "id, author_id, caption, media_url, media_type, like_count, comment_count, reaction_count, created_at, author:profiles!posts_author_id_fkey(username, display_name, avatar_url, accent_color)"
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
    const ext = input.file.name.split(".").pop() ?? "bin";
    const path = `${input.authorId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("post-media")
      .upload(path, input.file, { contentType: input.file.type, upsert: false });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from("post-media").getPublicUrl(path);
    media_url = pub.publicUrl;
    media_type = input.file.type.startsWith("video/") ? "video" : "image";
  }
  const { data, error } = await supabase
    .from("posts")
    .insert({
      author_id: input.authorId,
      caption: input.caption.trim() || null,
      media_url,
      media_type,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
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