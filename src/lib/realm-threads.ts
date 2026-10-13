import { supabase } from "@/integrations/supabase/client";

/**
 * Threads reuse the messages table: `thread_root` points every reply at the
 * root message, `parent_id` at the message directly above it, and a trigger on
 * messages keeps `reply_count` honest.
 */

export type ThreadMessage = {
  id: string;
  realm_id: string;
  realm_room_id: string | null;
  sender_id: string | null;
  bot_id?: string | null;
  body: string;
  card?: unknown;
  thread_root: string | null;
  parent_id: string | null;
  reply_count: number;
  created_at: string;
  sender?: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
  bot?: { name: string; avatar_url: string | null } | null;
};

export const threadKey = (rootId: string | null | undefined) => ["realm-thread", rootId ?? ""] as const;

export async function fetchThread(rootId: string): Promise<ThreadMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select(
      `*,
      sender:profiles!messages_author_id_fkey(username,display_name,avatar_url),
      bot:bots!messages_bot_id_fkey(name,avatar_url)`,
    )
    .eq("thread_root" as any, rootId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ThreadMessage[];
}

export async function sendThreadReply(input: {
  realmId: string;
  roomId: string | null;
  senderId: string;
  rootId: string;
  parentId: string;
  body: string;
}): Promise<void> {
  const { error } = await supabase.from("messages").insert({
    realm_id: input.realmId,
    realm_room_id: input.roomId,
    sender_id: input.senderId,
    body: input.body,
    thread_root: input.rootId,
    parent_id: input.parentId,
  } as any);
  if (error) throw error;
}

/** How the message list labels a message that has replies. */
export function threadLabel(replyCount: number): string {
  if (replyCount <= 0) return "Reply in thread";
  return `${replyCount} ${replyCount === 1 ? "reply" : "replies"} · open thread`;
}
