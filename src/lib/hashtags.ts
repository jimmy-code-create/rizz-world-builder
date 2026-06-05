import { supabase } from "@/integrations/supabase/client";
import type { FeedPost } from "./posts";

export type Hashtag = { tag: string; post_count: number };

export async function fetchTrendingTags(limit = 10): Promise<Hashtag[]> {
  const { data, error } = await supabase
    .from("hashtags")
    .select("tag, post_count")
    .order("post_count", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Hashtag[];
}

export async function fetchPostsByTag(tag: string, limit = 50): Promise<FeedPost[]> {
  const { data, error } = await supabase
    .from("post_hashtags")
    .select("post:posts(id, author_id, caption, media_url, media_type, like_count, comment_count, reaction_count, created_at, author:profiles!posts_author_id_fkey(username, display_name, avatar_url, accent_color))")
    .eq("tag", tag.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => r.post).filter(Boolean) as FeedPost[];
}

export function renderCaptionWithTags(
  caption: string
): { text: string; tag?: string; mention?: string; url?: string }[] {
  const parts: { text: string; tag?: string; mention?: string; url?: string }[] = [];
  // Order matters: URLs first, then mentions, then hashtags
  const re = /(https?:\/\/[^\s]+)|@([a-zA-Z0-9_]{2,32})|#([a-zA-Z0-9_]{2,32})/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(caption))) {
    if (m.index > last) parts.push({ text: caption.slice(last, m.index) });
    if (m[1]) parts.push({ text: m[0], url: m[1] });
    else if (m[2]) parts.push({ text: m[0], mention: m[2].toLowerCase() });
    else if (m[3]) parts.push({ text: m[0], tag: m[3].toLowerCase() });
    last = m.index + m[0].length;
  }
  if (last < caption.length) parts.push({ text: caption.slice(last) });
  return parts;
}