import { supabase } from "@/integrations/supabase/client";

export type Group = {
  id: string;
  owner_id: string;
  slug: string;
  name: string;
  topic: string | null;
  icon_url: string | null;
  accent_color: string | null;
  member_count: number;
  is_voice_live: boolean;
  created_at: string;
};

export type GroupInvitePreview = {
  status: "valid" | "already_member" | "expired" | "limit_reached" | "revoked_or_invalid";
  group_id: string | null;
  group_name: string | null;
  topic: string | null;
  icon_url: string | null;
  accent_color: string | null;
  member_count: number | null;
};

function randCode(len = 8) {
  const a = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

export function extractInviteCode(value: string) {
  const input = value.trim();
  if (!input) return "";
  const withoutQuery = input.split(/[?#]/, 1)[0];
  const lastSegment = withoutQuery.split("/").filter(Boolean).at(-1) ?? input;
  try {
    return decodeURIComponent(lastSegment).replace(/[^a-z0-9]/gi, "").toLowerCase();
  } catch {
    return lastSegment.replace(/[^a-z0-9]/gi, "").toLowerCase();
  }
}

export async function listMyGroups(userId: string) {
  const { data, error } = await supabase
    .from("group_members")
    .select("group:groups(*)")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((r: any) => r.group as Group).filter(Boolean);
}

export async function fetchGroup(id: string) {
  const { data, error } = await supabase.from("groups").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Group | null;
}

export async function fetchGroupBySlug(slug: string) {
  const { data, error } = await supabase.from("groups").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data as Group | null;
}

export async function createGroup(input: { owner_id: string; name: string; topic?: string; accent_color?: string }) {
  const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + randCode(4);
  const { data, error } = await supabase.from("groups").insert({
    owner_id: input.owner_id, slug, name: input.name, topic: input.topic, accent_color: input.accent_color ?? "#ff2d92",
  }).select().single();
  if (error) throw error;
  return data as Group;
}

export async function fetchMembers(groupId: string) {
  const { data, error } = await supabase
    .from("group_members")
    .select("user_id, role, joined_at, user:profiles!group_members_user_id_fkey(username,display_name,avatar_url,accent_color)")
    .eq("group_id", groupId);
  if (error) throw error;
  return data ?? [];
}

export async function leaveGroup(groupId: string, userId: string) {
  const { error } = await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", userId);
  if (error) throw error;
}

export async function createInvite(groupId: string, createdBy: string, opts?: { max_uses?: number; expires_in_hours?: number }) {
  const code = randCode(10);
  const expires_at = opts?.expires_in_hours ? new Date(Date.now() + opts.expires_in_hours * 3600 * 1000).toISOString() : null;
  const { data, error } = await supabase.from("group_invites").insert({
    group_id: groupId, created_by: createdBy, code, max_uses: opts?.max_uses ?? null, expires_at,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function acceptInvite(code: string) {
  const { data, error } = await supabase.rpc("accept_group_invite", { _code: extractInviteCode(code) });
  if (error) {
    const message = String(error.message ?? "").toLowerCase();
    if (message.includes("expired")) throw new Error("This invite has expired. Ask a group member for a new link.");
    if (message.includes("max_uses") || message.includes("use limit")) throw new Error("This invite has reached its use limit.");
    if (message.includes("blocked")) throw new Error("You can’t join this group because it includes someone you’ve blocked.");
    if (message.includes("invalid") || message.includes("revoked") || message.includes("not found")) {
      throw new Error("This invite is invalid or has been revoked. Ask for a new link.");
    }
    if (message.includes("already")) throw new Error("You are already a member of this group.");
    if (message.includes("function") || message.includes("schema cache") || message.includes("does not exist")) {
      throw new Error("Group invites are temporarily unavailable. The Lovable backend needs the invite setup before this can work.");
    }
    throw new Error("Couldn't join this group right now. Please try again.");
  }
  if (typeof data === "string") {
    const joinedGroup = await fetchGroup(data);
    if (!joinedGroup) throw new Error("You joined, but this group is temporarily unavailable. Open your groups and try again.");
    return joinedGroup;
  }
  if (data && typeof data === "object" && "id" in data) return data as unknown as Group;
  throw new Error("You joined, but this group is temporarily unavailable. Open your groups and try again.");
}

export async function previewGroupInvite(code: string): Promise<GroupInvitePreview> {
  // Keep preview lookup in the existing helper so the join route and chat cards share the same backend call.
  const { data, error } = await (supabase.rpc as any)("get_group_invite_preview", {
    _code: extractInviteCode(code),
  }).abortSignal(AbortSignal.timeout(8000));
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("This invite is invalid or has been revoked.");
  return row as GroupInvitePreview;
}

type GroupMessageAuthor = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  accent_color: string | null;
};

async function fetchMessageAuthors(authorIds: string[]): Promise<Map<string, GroupMessageAuthor>> {
  if (!authorIds.length) return new Map<string, GroupMessageAuthor>();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, accent_color")
    .in("id", authorIds);
  if (error) throw error;
  return new Map<string, GroupMessageAuthor>((data ?? []).map((profile) => [profile.id, profile]));
}

const GROUP_MESSAGE_PAGE_SIZE = 30;

async function removeHiddenGroupMessages(
  messages: any[],
  groupId: string,
  userId?: string,
) {
  if (!userId || !messages.length) return messages;
  const { data, error } = await (supabase.from as any)("group_message_hides")
    .select("message_id")
    .eq("user_id", userId)
    .eq("group_id", groupId)
    .in("message_id", messages.map((message) => message.id));
  if (error) {
    const message = String(error.message ?? "").toLowerCase();
    if (message.includes("does not exist") || message.includes("schema cache")) return messages;
    throw error;
  }
  const hiddenIds = new Set((data ?? []).map((row: { message_id: string }) => row.message_id));
  return messages.filter((message) => !hiddenIds.has(message.id));
}

async function attachGroupMessageAuthors(messages: any[]) {
  const authors = await fetchMessageAuthors([...new Set(messages.map((message) => message.author_id))]);
  return messages.map((message) => ({ ...message, author: authors.get(message.author_id) ?? null }));
}

export async function fetchGroupMessages(groupId: string, userId?: string) {
  const { data, error } = await supabase
    .from("group_messages")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(GROUP_MESSAGE_PAGE_SIZE + 1);
  if (error) throw error;
  const messages = await removeHiddenGroupMessages((data ?? []).slice(0, GROUP_MESSAGE_PAGE_SIZE), groupId, userId);
  return attachGroupMessageAuthors(messages.reverse());
}

export async function fetchOlderGroupMessages(
  groupId: string,
  before: { created_at: string; id: string },
  userId?: string,
) {
  const { data, error } = await supabase
    .from("group_messages")
    .select("*")
    .eq("group_id", groupId)
    .or(`created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},id.lt.${before.id})`)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(GROUP_MESSAGE_PAGE_SIZE + 1);
  if (error) throw error;
  const rows = data ?? [];
  const messages = await removeHiddenGroupMessages(rows.slice(0, GROUP_MESSAGE_PAGE_SIZE), groupId, userId);
  return {
    messages: await attachGroupMessageAuthors(messages.reverse()),
    hasMore: rows.length > GROUP_MESSAGE_PAGE_SIZE,
  };
}

export async function sendGroupMessage(input: { group_id: string; author_id: string; body: string; attachment_url?: string | null; reply_to?: string | null }) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const currentUser = authData.user;
  if (!currentUser || currentUser.id !== input.author_id) {
    throw new Error("Your session expired. Sign in again before sending a message.");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", input.group_id)
    .eq("user_id", currentUser.id)
    .maybeSingle();
  if (membershipError) throw membershipError;

  if (!membership) {
    const { data: group, error: groupError } = await supabase
      .from("groups")
      .select("owner_id")
      .eq("id", input.group_id)
      .maybeSingle();
    if (groupError) throw groupError;
    if (group?.owner_id !== currentUser.id) {
      throw new Error("Join this group before sending messages.");
    }

    const { error: joinError } = await supabase.from("group_members").insert({
      group_id: input.group_id,
      user_id: currentUser.id,
      role: "owner",
    });
    if (joinError && !/duplicate|unique/i.test(joinError.message)) throw joinError;
  }

  const { data, error } = await supabase
    .from("group_messages")
    .insert({ ...input, body: input.body.trim() })
    .select("*")
    .single();
  if (error) throw error;
  const authors = await fetchMessageAuthors([data.author_id]);
  return { ...data, author: authors.get(data.author_id) ?? null };
}