import { supabase } from "@/integrations/supabase/client";

/** Blocking, muting and close-friends helpers (Phase 9). */

export async function blockUser(blockerId: string, blockedId: string) {
  const { error } = await supabase.from("blocks").insert({ blocker_id: blockerId, blocked_id: blockedId });
  if (error && !/duplicate/i.test(error.message)) throw error;
}

export async function unblockUser(blockerId: string, blockedId: string) {
  const { error } = await supabase.from("blocks").delete().eq("blocker_id", blockerId).eq("blocked_id", blockedId);
  if (error) throw error;
}

export async function isBlocked(blockerId: string, blockedId: string) {
  const { data } = await supabase
    .from("blocks")
    .select("blocked_id")
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId)
    .maybeSingle();
  return !!data;
}

export async function fetchBlocked(userId: string) {
  const { data, error } = await supabase
    .from("blocks")
    .select("blocked_id, created_at, blocked:profiles!blocks_blocked_id_fkey(username, display_name, avatar_url)")
    .eq("blocker_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function muteUser(muterId: string, mutedId: string) {
  const { error } = await supabase.from("mutes").insert({ muter_id: muterId, muted_id: mutedId });
  if (error && !/duplicate/i.test(error.message)) throw error;
}

export async function unmuteUser(muterId: string, mutedId: string) {
  const { error } = await supabase.from("mutes").delete().eq("muter_id", muterId).eq("muted_id", mutedId);
  if (error) throw error;
}

export async function fetchMuted(userId: string) {
  const { data, error } = await supabase
    .from("mutes")
    .select("muted_id, muted:profiles!mutes_muted_id_fkey(username, display_name, avatar_url)")
    .eq("muter_id", userId);
  if (error) throw error;
  return data ?? [];
}

export async function fetchCloseFriends(ownerId: string) {
  const { data, error } = await supabase
    .from("close_friends")
    .select("friend_id, friend:profiles!close_friends_friend_id_fkey(username, display_name, avatar_url)")
    .eq("owner_id", ownerId);
  if (error) throw error;
  return data ?? [];
}

export async function toggleCloseFriend(ownerId: string, friendId: string, isClose: boolean) {
  if (isClose) {
    const { error } = await supabase.from("close_friends").delete().eq("owner_id", ownerId).eq("friend_id", friendId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("close_friends").insert({ owner_id: ownerId, friend_id: friendId });
    if (error && !/duplicate/i.test(error.message)) throw error;
  }
}