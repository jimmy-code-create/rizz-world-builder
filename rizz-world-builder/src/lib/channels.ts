import { supabase } from "@/integrations/supabase/client";

export async function fetchChannels() {
  const { data, error } = await supabase
    .from("channels")
    .select("*, owner:profiles!channels_owner_id_fkey(username,display_name,avatar_url)")
    .order("member_count", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function fetchChannelBySlug(slug: string) {
  const { data, error } = await supabase
    .from("channels")
    .select("*, owner:profiles!channels_owner_id_fkey(username,display_name,avatar_url)")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchMessages(channelId: string, limit = 100) {
  const { data, error } = await supabase
    .from("messages")
    .select("*, author:profiles!messages_author_id_fkey(username,display_name,avatar_url,accent_color)")
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).reverse();
}

export async function sendMessage(channelId: string, authorId: string, body: string) {
  const { error } = await supabase.from("messages").insert({ channel_id: channelId, author_id: authorId, body });
  if (error) throw error;
}

export async function joinChannel(channelId: string, userId: string) {
  const { error } = await supabase.from("channel_members").insert({ channel_id: channelId, user_id: userId });
  if (error && !error.message.includes("duplicate")) throw error;
}

export async function leaveChannel(channelId: string, userId: string) {
  await supabase.from("channel_members").delete().eq("channel_id", channelId).eq("user_id", userId);
}

export async function isMember(channelId: string, userId: string) {
  const { data } = await supabase.from("channel_members").select("user_id").eq("channel_id", channelId).eq("user_id", userId).maybeSingle();
  return !!data;
}

export async function createChannel(input: { owner_id: string; name: string; slug: string; topic?: string; type?: "text" | "announcement" | "drops"; accent_color?: string }) {
  const { data, error } = await supabase.from("channels").insert(input).select().single();
  if (error) throw error;
  return data;
}
