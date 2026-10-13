import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { realmRpc, unwrapRpc, type RpcOutcome } from "@/lib/realm-rpc";

/**
 * Scheduled messages. `send_due_scheduled_messages` has no cron: the realm
 * page calls it opportunistically, so a pending message lands as soon as
 * anybody with the app open looks at the channel.
 */

export type ScheduledMessage = {
  id: string;
  realm_id: string;
  realm_room_id: string | null;
  created_by: string;
  body: string;
  scheduled_for: string;
  status: "pending" | "sent" | "cancelled" | "failed";
  sent_message_id: string | null;
  created_at: string;
};

export const scheduledKey = (realmId: string | null | undefined) => ["realm-scheduled", realmId ?? ""] as const;

export async function fetchScheduledMessages(realmId: string): Promise<ScheduledMessage[]> {
  const { data, error } = await (supabase.from as any)("realm_scheduled_messages")
    .select("*")
    .eq("realm_id", realmId)
    .order("scheduled_for", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ScheduledMessage[];
}

export async function scheduleRealmMessage(input: {
  realmId: string;
  roomId: string | null;
  body: string;
  scheduledFor: Date;
}): Promise<string> {
  const result = unwrapRpc(
    await realmRpc<RpcOutcome & { id?: string }>("schedule_realm_message", {
      _realm_id: input.realmId,
      _realm_room_id: input.roomId,
      _body: input.body,
      _scheduled_for: input.scheduledFor.toISOString(),
    }),
    "Couldn't schedule that message",
  );
  return String(result.id ?? "");
}

export async function cancelRealmMessage(id: string): Promise<void> {
  unwrapRpc(await realmRpc<RpcOutcome>("cancel_realm_message", { _id: id }), "Couldn't cancel that message");
}

/** Sends everything that is due. Safe to call often: it is a no-op when idle. */
export async function flushDueScheduledMessages(limit = 25): Promise<number> {
  const sent = await realmRpc<number>("send_due_scheduled_messages", { _limit: limit });
  return typeof sent === "number" ? sent : 0;
}

export function useScheduledMessages(realmId: string | null | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: scheduledKey(realmId),
    enabled: !!realmId,
    staleTime: 30_000,
    queryFn: () => fetchScheduledMessages(realmId!),
  });

  useEffect(() => {
    if (!realmId) return;
    const channel = supabase
      .channel(`realm-scheduled-${realmId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "realm_scheduled_messages", filter: `realm_id=eq.${realmId}` },
        () => void qc.invalidateQueries({ queryKey: scheduledKey(realmId) }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [realmId, qc]);

  return query;
}
