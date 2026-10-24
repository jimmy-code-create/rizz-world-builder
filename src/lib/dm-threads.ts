import { supabase } from "@/integrations/supabase/client";

export type DmThreadPerson = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export type DmThread = {
  other: DmThreadPerson;
  last: {
    body: string | null;
    attachment_url: string | null;
    created_at: string;
    sender_id: string;
  };
  unread: number;
};

/**
 * One shared query for every "messages" surface: the DM page, the desktop rail
 * and the inbox. Identical React Query keys mean all three read the same cache
 * entry, so a new message can never show a different thread preview in one
 * place than another.
 */
export const dmThreadsKey = (userId: string | null | undefined) => ["dm-threads", userId] as const;

export async function fetchDmThreads(userId: string): Promise<DmThread[]> {
  const { data, error } = await supabase
    .from("direct_messages")
    .select(
      "*, sender:profiles!direct_messages_sender_id_fkey(id,username,display_name,avatar_url), recipient:profiles!direct_messages_recipient_id_fkey(id,username,display_name,avatar_url)",
    )
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;

  const threads = new Map<string, DmThread>();
  for (const message of data ?? []) {
    const other = message.sender_id === userId ? message.recipient : message.sender;
    if (!other) continue;
    const existing = threads.get(other.id);
    const isUnread = message.recipient_id === userId && !message.read;
    if (!existing) {
      threads.set(other.id, {
        other,
        last: {
          body: message.body,
          attachment_url: message.attachment_url,
          created_at: message.created_at,
          sender_id: message.sender_id,
        },
        unread: isUnread ? 1 : 0,
      });
    } else if (isUnread) {
      existing.unread += 1;
    }
  }
  // Newest conversation first; Map preserves the desc order of the rows.
  return Array.from(threads.values());
}

/** Realtime invalidation shared by the DM list rail and the inbox. */
export function watchDmThreads(userId: string, onChange: () => void) {
  const channel = supabase
    .channel(`dm-thread-watch-${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "direct_messages", filter: `sender_id=eq.${userId}` },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "direct_messages", filter: `recipient_id=eq.${userId}` },
      onChange,
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
