import { supabase } from "@/integrations/supabase/client";

export async function fetchLiveRooms() {
  const { data, error } = await supabase
    .from("voice_rooms")
    .select("*, host:profiles!voice_rooms_host_id_fkey(username,display_name,avatar_url,accent_color)")
    .eq("is_live", true)
    .order("started_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchRoom(id: string) {
  const { data, error } = await supabase
    .from("voice_rooms")
    .select("*, host:profiles!voice_rooms_host_id_fkey(username,display_name,avatar_url,accent_color)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchParticipants(roomId: string) {
  const { data, error } = await supabase
    .from("voice_participants")
    .select("*, user:profiles!voice_participants_user_id_fkey(username,display_name,avatar_url,accent_color)")
    .eq("room_id", roomId)
    .order("joined_at");
  if (error) throw error;
  return data ?? [];
}

export async function createRoom(input: { host_id: string; title: string; topic?: string }) {
  const { data, error } = await supabase.from("voice_rooms").insert(input).select().single();
  if (error) throw error;
  // Auto-join host
  await supabase.from("voice_participants").insert({ room_id: data.id, user_id: input.host_id, role: "host", muted: false });
  return data;
}

export async function joinRoom(roomId: string, userId: string, role: "speaker" | "listener" = "listener") {
  const { error } = await supabase.from("voice_participants").insert({ room_id: roomId, user_id: userId, role, muted: true });
  if (error && !error.message.includes("duplicate")) throw error;
}

export async function leaveRoom(roomId: string, userId: string) {
  await supabase.from("voice_participants").delete().eq("room_id", roomId).eq("user_id", userId);
}

export async function updateParticipant(roomId: string, userId: string, patch: { muted?: boolean; hand_raised?: boolean; role?: "host" | "speaker" | "listener" }) {
  const { error } = await supabase.from("voice_participants").update(patch).eq("room_id", roomId).eq("user_id", userId);
  if (error) throw error;
}

export async function endRoom(roomId: string) {
  await supabase.from("voice_rooms").update({ is_live: false, ended_at: new Date().toISOString() }).eq("id", roomId);
}