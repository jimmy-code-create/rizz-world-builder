import { supabase } from "@/integrations/supabase/client";

export type Realm = {
  id: string;
  slug: string;
  name: string;
  topic: string | null;
  icon_url: string | null;
  accent_color: string | null;
  kind: "text" | "announcement" | "drops" | "voice";
  is_public: boolean;
  member_count: number;
  owner_id: string;
  created_at: string;
  updated_at: string;
  owner?: { username: string; display_name: string | null; avatar_url: string | null };
};

export type RealmMessage = {
  id: string;
  realm_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  reply_to: string | null;
  attachment_url: string | null;
  sender?: { username: string; display_name: string | null; avatar_url: string | null; accent_color: string | null };
};

export type RealmMember = {
  realm_id: string;
  user_id: string;
  role: "owner" | "mod" | "member";
  joined_at: string;
  profile?: { username: string; display_name: string | null; avatar_url: string | null; accent_color: string | null };
};

export type RealmInvitePreview = {
  status: "valid" | "already_member" | "expired" | "limit_reached" | "invalid" | "banned";
  realm_id: string | null;
  realm_name: string | null;
  topic: string | null;
  icon_url: string | null;
  accent_color: string | null;
  member_count: number | null;
};

export type RealmRole = "owner" | "mod" | "member";

const REALM_OWNER_SELECT = "owner:profiles!realms_owner_id_fkey(username,display_name,avatar_url)";
const MESSAGE_SENDER_SELECT =
  "sender:profiles!messages_author_id_fkey(username,display_name,avatar_url,accent_color)";

export async function fetchRealms() {
  const { data, error } = await supabase
    .from("realms")
    .select(`*, ${REALM_OWNER_SELECT}`)
    .order("member_count", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as Realm[];
}

export async function fetchRealmBySlug(slug: string) {
  const { data, error } = await supabase
    .from("realms")
    .select(`*, ${REALM_OWNER_SELECT}`)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as Realm | null;
}

export async function fetchRealmMessages(realmId: string, limit = 100) {
  const { data, error } = await supabase
    .from("messages")
    .select(`*, ${MESSAGE_SENDER_SELECT}`)
    .eq("realm_id", realmId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as RealmMessage[]).reverse();
}

export async function sendRealmMessage(realmId: string, senderId: string, body: string) {
  const { error } = await supabase
    .from("messages")
    .insert({ realm_id: realmId, sender_id: senderId, body });
  if (error) throw error;
}

export async function joinRealm(realmId: string, userId: string) {
  const { error } = await supabase.from("realm_members").insert({ realm_id: realmId, user_id: userId });
  if (error && !error.message.includes("duplicate")) throw error;
}

export async function leaveRealm(realmId: string, userId: string) {
  await supabase.from("realm_members").delete().eq("realm_id", realmId).eq("user_id", userId);
}

export async function isRealmMember(realmId: string, userId: string) {
  const { data } = await supabase
    .from("realm_members")
    .select("user_id")
    .eq("realm_id", realmId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

export async function createRealmSecure(input: {
  name: string;
  topic?: string;
  kind?: "text" | "announcement" | "voice" | "drops";
  accent_color?: string;
  is_public?: boolean;
}) {
  const { data, error } = await supabase.rpc("create_realm_secure", {
    _name: input.name,
    _topic: input.topic ?? null,
    _accent_color: input.accent_color ?? "#ff2d92",
    _kind: input.kind ?? "text",
    _is_public: input.is_public ?? true,
  });
  if (error) throw error;
  const realmId = data as string;
  const { data: created, error: fetchError } = await supabase
    .from("realms")
    .select(`*, ${REALM_OWNER_SELECT}`)
    .eq("id", realmId)
    .single();
  if (fetchError) throw fetchError;
  return created as Realm;
}

// Back-compat wrapper for direct inserts (RLS still limits to the owner).
export async function createRealm(input: {
  owner_id: string;
  name: string;
  slug: string;
  topic?: string;
  kind?: "text" | "announcement" | "voice" | "drops";
  accent_color?: string;
  is_public?: boolean;
}) {
  const { data, error } = await supabase.from("realms").insert(input).select().single();
  if (error) throw error;
  return data as Realm;
}

export async function joinRealmPublic(realmId: string): Promise<"joined" | RealmRole> {
  const { data, error } = await supabase.rpc("join_realm", { _realm_id: realmId });
  if (error) throw error;
  return (data as string) as "joined" | RealmRole;
}

export async function leaveRealmSecure(realmId: string) {
  const { error } = await supabase.rpc("leave_realm", { _realm_id: realmId });
  if (error) throw error;
}

export async function createRealmInvite(input: {
  realmId: string;
  expiresInDays?: number | null;
  maxUses?: number | null;
}) {
  const expiresAt =
    input.expiresInDays && input.expiresInDays > 0
      ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;
  const { data, error } = await supabase.rpc("create_realm_invite", {
    _realm_id: input.realmId,
    _expires_at: expiresAt,
    _max_uses: input.maxUses ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function previewRealmInvite(code: string): Promise<RealmInvitePreview> {
  const { data, error } = await supabase.rpc("preview_realm_invite", { _code: code });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? { status: "invalid", realm_id: null, realm_name: null, topic: null, icon_url: null, accent_color: null, member_count: null }) as RealmInvitePreview;
}

export async function acceptRealmInvite(code: string): Promise<string> {
  const { data, error } = await supabase.rpc("accept_realm_invite", { _code: code });
  if (error) throw error;
  return data as string;
}

export async function revokeRealmInvite(inviteId: string) {
  const { error } = await supabase.rpc("revoke_realm_invite", { _invite_id: inviteId });
  if (error) throw error;
}

export async function updateRealm(input: {
  realmId: string;
  name?: string;
  topic?: string;
  iconUrl?: string;
  accentColor?: string;
  isPublic?: boolean;
}) {
  const { error } = await supabase.rpc("update_realm", {
    _realm_id: input.realmId,
    _name: input.name ?? null,
    _topic: input.topic ?? null,
    _icon_url: input.iconUrl ?? null,
    _accent_color: input.accentColor ?? null,
    _is_public: input.isPublic ?? null,
  });
  if (error) throw error;
}

export async function deleteRealm(realmId: string) {
  const { error } = await supabase.rpc("delete_realm", { _realm_id: realmId });
  if (error) throw error;
}

export async function realmRoleOf(realmId: string, userId: string): Promise<RealmRole | null> {
  const { data, error } = await supabase.rpc("realm_role_of", { _realm: realmId, _user: userId });
  if (error) throw error;
  return (data as string | null) as RealmRole | null;
}

export async function listRealmMembers(realmId: string) {
  const { data, error } = await supabase
    .from("realm_members")
    .select(
      "realm_id, user_id, role, joined_at, profile:profiles!realm_members_user_id_fkey(username,display_name,avatar_url,accent_color)",
    )
    .eq("realm_id", realmId)
    .order("joined_at");
  if (error) throw error;
  return (data ?? []) as RealmMember[];
}

export async function kickRealmMember(realmId: string, userId: string) {
  const { error } = await supabase.rpc("kick_realm_member", { _realm_id: realmId, _user_id: userId });
  if (error) throw error;
}

export async function banRealmMember(realmId: string, userId: string, reason?: string) {
  const { error } = await supabase.rpc("ban_realm_member", {
    _realm_id: realmId,
    _user_id: userId,
    _reason: reason?.trim() || undefined,
  });
  if (error) throw error;
}

export async function unbanRealmMember(realmId: string, userId: string) {
  const { error } = await supabase.rpc("unban_realm_member", { _realm_id: realmId, _user_id: userId });
  if (error) throw error;
}

export async function setRealmMemberRole(realmId: string, userId: string, role: "member" | "mod") {
  const { error } = await supabase.rpc("set_realm_member_role", {
    _realm_id: realmId,
    _user_id: userId,
    _role: role,
  });
  if (error) throw error;
}
