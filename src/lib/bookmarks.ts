import { supabase } from "@/integrations/supabase/client";
import type { FeedPost } from "./posts";

export async function fetchMyBookmarkIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from("bookmarks").select("post_id").eq("user_id", userId);
  if (error) throw error;
  return new Set((data ?? []).map((r: any) => r.post_id as string));
}

export async function toggleBookmark(postId: string, userId: string, currentlySaved: boolean) {
  if (currentlySaved) {
    const { error } = await supabase.from("bookmarks").delete().eq("user_id", userId).eq("post_id", postId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("bookmarks").insert({ user_id: userId, post_id: postId });
    if (error) throw error;
  }
}

export async function fetchMyBookmarks(userId: string): Promise<FeedPost[]> {
  const { data, error } = await supabase
    .from("bookmarks")
    .select("post:posts(id, author_id, caption, media_url, media_type, like_count, comment_count, reaction_count, created_at, author:profiles!posts_author_id_fkey(username, display_name, avatar_url, accent_color))")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => r.post).filter(Boolean) as FeedPost[];
}