import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  fetchReactionRows,
  groupReactionRows,
  reactionsQueryKey,
  toggleReaction,
  type ReactionGroup,
  type ReactionRow,
  type ReactionScope,
} from "@/lib/reactions";

/**
 * Reactions for every message currently on screen in one chat, with optimistic
 * toggles and a realtime subscription so other people's reactions appear live.
 */
export function useChatReactions(scope: ReactionScope, messageIds: string[]) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const ids = useMemo(() => [...new Set(messageIds.filter(Boolean))], [messageIds.join("|")]);
  const queryKey = reactionsQueryKey(scope, ids);
  // A single chat-wide channel: reactions arrive without one socket per message.
  const channelKey = `${scope}:${ids[0] ?? "none"}`;

  const query = useQuery({
    queryKey,
    queryFn: () => fetchReactionRows(scope, ids),
    enabled: ids.length > 0,
    staleTime: 20_000,
    refetchOnWindowFocus: false,
  });

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
        // Invalidate by prefix: the key contains the message id list, which grows
        // as the chat loads, so an exact key here would go stale.
        () => { void qc.invalidateQueries({ queryKey: ["chat-reactions", scope] }); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [scope, channelKey, qc, ids.length]);

  const toggle = useCallback(
    async (messageId: string, emoji: string) => {
      if (!user) {
        toast.error("Sign in to react");
        return;
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
      qc.setQueryData(key, optimistic);

      try {
        await toggleReaction(scope, messageId, emoji);
      } catch (error) {
        // Roll the chip back so the UI never lies about the saved state.
        qc.setQueryData(key, previous);
        toast.error(error instanceof Error ? error.message : "Couldn't react, try again");
      } finally {
        void qc.invalidateQueries({ queryKey: key });
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

  return { rows, groupsFor, reactorsFor, toggle, isLoading: query.isLoading };
}
