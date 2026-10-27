import { supabase } from "@/integrations/supabase/client";
import { listMyGroups, sendGroupMessage } from "@/lib/groups";

/**
 * Share & forward.
 *
 * One module for every "send this somewhere else" action in Rizz: a post, a
 * reel, a photo or a message can be sent into a DM, a group or a realm. The
 * three chat surfaces already store their own messages in their own table, so
 * this is a thin router over those tables — no new schema, no duplicated
 * message copies in a side table that could drift.
 *
 * Forwarding a message re-uses its text and attachment: the recipient gets the
 * same content in a message of their own, exactly like Discord's Forward.
 */

export type ShareTargetKind = "dm" | "group" | "realm";

export type ShareTarget = {
  kind: ShareTargetKind;
  /** DM: the other person's profile id. Group / realm: the row id. */
  id: string;
  name: string;
  /** @handle for people, member count / slug for groups and realms. */
  subtitle?: string | null;
  avatarUrl?: string | null;
  /** Realm only: the default text channel, so the message lands where it is read. */
  roomId?: string | null;
};

export type ShareDraft = {
  /** Text that travels with the share. A link is enough on its own. */
  body: string;
  attachmentUrl?: string | null;
  /** Shown at the top of the picker, e.g. "Share post". */
  title?: string;
};

export type ShareTargets = {
  dms: ShareTarget[];
  groups: ShareTarget[];
  realms: ShareTarget[];
};

type ProfileBits = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

/**
 * Everything the current user can send into: their recent DM threads, the
 * groups they belong to and the realms they joined. Each query is capped — a
 * picker that takes seconds to open is worse than one that shows the recent
 * hundred conversations.
 */
export async function fetchShareTargets(userId: string): Promise<ShareTargets> {
  const [dmResult, groups, realms] = await Promise.all([
    supabase
      .from("direct_messages")
      .select(
        "sender_id,recipient_id,created_at,sender:profiles!direct_messages_sender_id_fkey(id,username,display_name,avatar_url),recipient:profiles!direct_messages_recipient_id_fkey(id,username,display_name,avatar_url)",
      )
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(100),
    listMyGroups(userId).catch(() => []),
    fetchJoinedRealms(userId).catch(() => []),
  ]);

  const seen = new Set<string>();
  const dms: ShareTarget[] = [];
  for (const row of (dmResult.data ?? []) as Array<{
    sender_id: string;
    recipient_id: string;
    sender: ProfileBits | null;
    recipient: ProfileBits | null;
  }>) {
    const other = row.sender_id === userId ? row.recipient : row.sender;
    if (!other || seen.has(other.id)) continue;
    seen.add(other.id);
    dms.push({
      kind: "dm",
      id: other.id,
      name: other.display_name || other.username || "Someone",
      subtitle: other.username ? `@${other.username}` : null,
      avatarUrl: other.avatar_url,
    });
  }

  return {
    dms,
    groups: (groups ?? []).map((group) => ({
      kind: "group" as const,
      id: group.id,
      name: group.name,
      subtitle: group.topic ?? "Group chat",
      avatarUrl: group.icon_url ?? null,
    })),
    realms,
  };
}

async function fetchJoinedRealms(userId: string): Promise<ShareTarget[]> {
  const { data, error } = await supabase
    .from("realm_members")
    .select("role, realm:realms(id,slug,name,topic,icon_url)")
    .eq("user_id", userId)
    .limit(100);
  if (error) throw error;
  const rows = (data ?? []) as unknown as Array<{
    role: string;
    realm: {
      id: string;
      slug: string;
      name: string;
      topic: string | null;
      icon_url: string | null;
    } | null;
  }>;
  return rows
    .filter((row) => !!row.realm)
    .map((row) => ({
      kind: "realm" as const,
      id: row.realm!.id,
      name: row.realm!.name,
      subtitle: row.realm!.topic ?? `r/${row.realm!.slug}`,
      avatarUrl: row.realm!.icon_url,
    }));
}

/** The default text channel of a realm, where a shared item should land. */
async function defaultRoomOf(realmId: string): Promise<string | null> {
  const { data } = await supabase
    .from("realm_rooms")
    .select("id,kind,is_default,position")
    .eq("realm_id", realmId)
    .neq("kind", "voice")
    .order("is_default", { ascending: false })
    .order("position", { ascending: true })
    .limit(1);
  return data?.[0]?.id ?? null;
}

/**
 * Sends a draft to one target. Returns the conversation path so the caller can
 * offer "Open" in the confirmation toast.
 */
export async function sendToTarget(
  target: ShareTarget,
  draft: ShareDraft,
  senderId: string,
): Promise<string> {
  const body = draft.body.trim();
  if (!body && !draft.attachmentUrl) throw new Error("Nothing to send");

  if (target.kind === "dm") {
    const { error } = await supabase.from("direct_messages").insert({
      sender_id: senderId,
      recipient_id: target.id,
      body,
      attachment_url: draft.attachmentUrl ?? null,
    });
    if (error) throw error;
    return `/dm/${target.id}`;
  }

  if (target.kind === "group") {
    await sendGroupMessage({
      group_id: target.id,
      author_id: senderId,
      body,
      attachment_url: draft.attachmentUrl ?? null,
    });
    return `/g/${target.id}`;
  }

  const roomId = target.roomId ?? (await defaultRoomOf(target.id));
  const { data: realm, error } = await supabase
    .from("messages")
    .insert({
      realm_id: target.id,
      realm_room_id: roomId,
      sender_id: senderId,
      body,
      attachment_url: draft.attachmentUrl ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return realm?.id ? `/r/${target.id}?message=${realm.id}` : `/r/${target.id}`;
}

/**
 * Builds the draft for a post or a reel: the caption (if any) plus a permalink,
 * plus the media itself when it is a single picture that can be forwarded as an
 * attachment.
 */
export function shareDraftForPost(input: {
  caption?: string | null;
  mediaUrl?: string | null;
  mediaKind?: string | null;
  permalink: string;
  title: string;
}): ShareDraft {
  const caption = (input.caption ?? "").trim();
  const isPicture = input.mediaKind === "image";
  const attachment = isPicture && input.mediaUrl ? input.mediaUrl : null;
  const body = [caption, attachment ? "" : input.permalink].filter(Boolean).join("\n\n");
  return { body: body || input.permalink, attachmentUrl: attachment, title: input.title };
}

/** The draft for forwarding an existing message. */
export function shareDraftForMessage(input: {
  body?: string | null;
  attachmentUrl?: string | null;
  author?: string | null;
}): ShareDraft {
  return {
    body: (input.body ?? "").trim(),
    attachmentUrl: input.attachmentUrl ?? null,
    title: input.author ? `Forward message from ${input.author}` : "Forward message",
  };
}
