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

function randCode(len = 8) {
  const a = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
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

export async function fetchInvite(code: string) {
  const { data, error } = await supabase
    .from("group_invites")
    .select("*, group:groups(*)")
    .eq("code", code)
    .maybeSingle();
  if (error) throw error;
  return data as (any & { group: Group }) | null;
}

export async function acceptInvite(code: string, userId: string) {
  const inv = await fetchInvite(code);
  if (!inv) throw new Error("Invalid invite link");
  if (inv.expires_at && new Date(inv.expires_at).getTime() < Date.now()) throw new Error("Invite expired");
  if (inv.max_uses && inv.uses >= inv.max_uses) throw new Error("Invite has reached its limit");
  const { error } = await supabase.from("group_members").insert({ group_id: inv.group_id, user_id: userId });
  if (error) {
    if (error.message.includes("friends_only")) throw new Error("Friends-only group: you must mutually follow at least one member to join.");
    if (error.message.includes("duplicate")) return inv.group;
    throw error;
  }
  await supabase.from("group_invites").update({ uses: (inv.uses ?? 0) + 1 }).eq("id", inv.id);
  return inv.group;
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

export async function fetchGroupMessages(groupId: string, limit = 100) {
  const { data, error } = await supabase
    .from("group_messages")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  const messages = data ?? [];
  const authors = await fetchMessageAuthors([...new Set(messages.map((message) => message.author_id))]);
  return messages.map((message) => ({
    ...message,
    author: authors.get(message.author_id) ?? null,
  }));
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