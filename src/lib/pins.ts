import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** A channel keeps at most this many pins; the server refuses the next one. */
export const MAX_PINS_PER_CHANNEL = 50;

export type PinnedMessage = {
  id: string;
  realm_id: string;
  realm_room_id: string | null;
  message_id: string;
  pinned_by: string;
  created_at: string;
};

export type PinnedMessageDetails = PinnedMessage & {
  message: {
    id: string;
    body: string;
    attachment_url: string | null;
    created_at: string;
    sender: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
  } | null;
};

/** A short label for the pinned bar: the text, or "Photo" / "GIF". */
export function pinnedPreview(body: string | null | undefined, attachmentUrl?: string | null) {
  const text = (body ?? "").trim();
  const gif = text.match(/\[\[(?:gif|sticker):[^\]]+\]\]/i) || /giphy|tenor/i.test(text);
  if (gif) return "GIF";
  if (!text && attachmentUrl) return "Photo";
  if (text.length > 120) return `${text.slice(0, 119).trimEnd()}…`;
  return text || (attachmentUrl ? "Photo" : "Message");
}

export function pinnedMessagesKey(realmId: string | null, roomId: string | null) {
  return ["pinned-messages", realmId ?? "", roomId ?? ""] as const;
}

export async function fetchPinnedMessages(
  realmId: string,
  roomId: string | null,
): Promise<PinnedMessageDetails[]> {
  const table = (supabase as unknown as { from: (table: string) => any }).from("pinned_messages");
  let query = table
    .select(
      "id, realm_id, realm_room_id, message_id, pinned_by, created_at, message:messages!pinned_messages_message_id_fkey(id, body, attachment_url, created_at, sender:profiles!messages_author_id_fkey(username, display_name, avatar_url))",
    )
    .eq("realm_id", realmId)
    .order("created_at", { ascending: false })
    .limit(MAX_PINS_PER_CHANNEL);

  // The realm's own channel has no room id, so match the null column instead.
  query = roomId ? query.eq("realm_room_id", roomId) : query.is("realm_room_id", null);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as PinnedMessageDetails[];
}

/** Pins for one channel, refreshed live for everyone in the realm. */
export function usePinnedMessages(realmId: string | null | undefined, roomId: string | null | undefined) {
  const qc = useQueryClient();
  const key = pinnedMessagesKey(realmId ?? null, roomId ?? null);

  const query = useQuery({
    queryKey: key,
    enabled: !!realmId,
    queryFn: () => fetchPinnedMessages(realmId as string, roomId ?? null),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!realmId) return;
    const channel = supabase
      .channel(`pinned-messages-${realmId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pinned_messages", filter: `realm_id=eq.${realmId}` },
        () => { void qc.invalidateQueries({ queryKey: ["pinned-messages"] }); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [realmId, qc]);

  return { pins: query.data ?? [], isLoading: query.isLoading, refetch: query.refetch };
}

/** Pins one message. Throws the server's message if the role or limit blocks it. */
export async function pinMessage(messageId: string) {
  const { error } = await supabase.rpc("pin_message" as never, { _message_id: messageId } as never);
  if (error) throw new Error(error.message || "Couldn't pin that message");
}

export async function unpinMessage(messageId: string) {
  const { error } = await supabase.rpc("unpin_message" as never, { _message_id: messageId } as never);
  if (error) throw new Error(error.message || "Couldn't unpin that message");
}

export async function togglePin(messageId: string, isPinned: boolean) {
  return isPinned ? unpinMessage(messageId) : pinMessage(messageId);
}
