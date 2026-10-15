import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  dedupeReactionRows,
  fetchReactionRows,
  groupReactionRows,
  reactionsQueryKey,
  toggleReaction,
  type ReactionGroup,
  type ReactionRow,
  type ReactionScope,
} from "@/lib/reactions";

export type ReactionPulse = {
  messageId: string;
  emoji: string;
  nonce: number;
  kind: "local" | "remote";
};

/**
 * Reactions for every message currently on screen in one chat, for DMs, groups
 * and realm channels alike.
 *
 * - The optimistic write and the realtime echo of the same reaction merge into
 *   one deduped row set, so there is never a flicker or a duplicate chip.
 * - The realtime socket patches the query cache in place instead of
 *   invalidating it, which is what caused the old full-list refetch.
 * - `lastPulse` reports a reaction someone else added to one of my messages, so
 *   the chat can play a small chip pop instead of a full burst.
 */
export function useChatReactions(
  scope: ReactionScope,
  messageIds: string[],
  options?: { myMessageIds?: string[] },
) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const ids = useMemo(() => [...new Set(messageIds.filter(Boolean))], [messageIds.join("|")]);
  const mineKey = (options?.myMessageIds ?? []).join("|");
  const mineIds = useMemo(() => new Set(mineKey ? mineKey.split("|") : []), [mineKey]);
  const queryKey = reactionsQueryKey(scope, ids);
  // A single chat-wide channel: reactions arrive without one socket per message.
  const channelKey = `${scope}:${ids[0] ?? "none"}`;
  const [lastPulse, setLastPulse] = useState<ReactionPulse | null>(null);
  const pulseNonce = useRef(0);

  const query = useQuery({
    queryKey,
    queryFn: () => fetchReactionRows(scope, ids),
    enabled: ids.length > 0,
    staleTime: 20_000,
    refetchOnWindowFocus: false,
  });

  /** Patches every cached reaction list for this chat in place. */
  const patchCaches = useCallback(
    (change: (rows: ReactionRow[]) => ReactionRow[]) => {
      qc.setQueriesData<ReactionRow[]>({ queryKey: ["chat-reactions", scope] }, (existing) =>
        existing ? dedupeReactionRows(change(existing)) : existing,
      );
    },
    [qc, scope],
  );

  useEffect(() => {
    if (!ids.length) return;
    const table = scope === "dm" ? "dm_reactions" : "message_reactions";
    const channel = supabase
      .channel(`chat-reactions-${channelKey}`)
      .on(
        "postgres_changes",
        // message_reactions can be narrowed server-side by scope; dm_reactions
        // has no single-column filter for a conversation, so it listens open.
        {
          event: "*",
          schema: "public",
          table,
          ...(scope === "dm" ? {} : { filter: `message_type=eq.${scope}` }),
        },
        (payload: { eventType?: string; new?: Partial<ReactionRow>; old?: Partial<ReactionRow> }) => {
          const row = (payload.eventType === "DELETE" ? payload.old : payload.new) ?? {};
          // A DELETE without the full row (no replica identity) can't be patched.
          if (!row.message_id || !row.user_id || !row.emoji) {
            void qc.invalidateQueries({ queryKey: ["chat-reactions", scope] });
            return;
          }
          const known = { message_id: row.message_id, user_id: row.user_id, emoji: row.emoji };
          if (payload.eventType === "DELETE") {
            patchCaches((rows) =>
              rows.filter(
                (entry) =>
                  !(
                    entry.message_id === known.message_id &&
                    entry.user_id === known.user_id &&
                    entry.emoji === known.emoji
                  ),
              ),
            );
            return;
          }
          patchCaches((rows) => [...rows, known]);
          // Someone else reacting to my own message: a small pop, never a burst.
          if (known.user_id !== user?.id && mineIds.has(known.message_id)) {
            pulseNonce.current += 1;
            setLastPulse({
              messageId: known.message_id,
              emoji: known.emoji,
              nonce: pulseNonce.current,
              kind: "remote",
            });
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [scope, channelKey, qc, ids.length, patchCaches, mineIds, user?.id]);

  const toggle = useCallback(
    async (messageId: string, emoji: string): Promise<boolean> => {
      if (!user) {
        toast.error("Sign in to react");
        return false;
      }
      const key = reactionsQueryKey(scope, ids);
      const previous = qc.getQueryData<ReactionRow[]>(key) ?? [];
      const mine = previous.some(
        (row) => row.message_id === messageId && row.emoji === emoji && row.user_id === user.id,
      );
      const optimistic: ReactionRow[] = mine
        ? previous.filter(
            (row) => !(row.message_id === messageId && row.emoji === emoji && row.user_id === user.id),
          )
        : [...previous, { message_id: messageId, user_id: user.id, emoji }];
      qc.setQueryData(key, dedupeReactionRows(optimistic));

      try {
        await toggleReaction(scope, messageId, emoji);
        return true;
      } catch (error) {
        // Roll the chip back so the UI never lies about the saved state, and
        // offer one-tap retry. Retrying repeats the intended action: after a
        // failed add the row is gone, after a failed remove it is still there.
        qc.setQueryData(key, previous);
        toast.error(error instanceof Error ? error.message : "Couldn't react", {
          action: { label: "Retry", onClick: () => void toggle(messageId, emoji) },
        });
        return false;
      }
    },
    [scope, ids, qc, user],
  );

  const rows = query.data ?? [];

  const groupsFor = useCallback(
    (messageId: string): ReactionGroup[] => groupReactionRows(rows, messageId, user?.id),
    [rows, user?.id],
  );

  const reactorsFor = useCallback(
    (messageId: string, emoji: string): string[] =>
      rows.filter((row) => row.message_id === messageId && row.emoji === emoji).map((row) => row.user_id),
    [rows],
  );

  return { rows, groupsFor, reactorsFor, toggle, lastPulse, isLoading: query.isLoading };
}
