import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { callExtraRpc, reactionErrorMessage } from "@/lib/extra-rpc";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus } from "lucide-react";
import { toast } from "sonner";

type MessageReactionType = "dm" | "group" | "channel";
type ReactionRow = { emoji: string; user_id: string; message_type?: MessageReactionType };
const QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "🔥"];

export function DMReactionsBar({ messageIds }: { messageIds: string[] }) {
  // placeholder — actual usage in message-level component below
  return null;
}

export function MessageReactions({
  messageId,
  messageType = "dm",
  align = "left",
}: {
  messageId: string;
  messageType?: MessageReactionType;
  align?: "left" | "right";
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const queryKey = ["message-reactions", messageType, messageId] as const;

  const { data } = useQuery({
    queryKey,
    enabled: !!user && !!messageId && !messageId.startsWith("pending-"),
    queryFn: async () => {
      const table = messageType === "dm" ? "dm_reactions" : "message_reactions";
      let request = (supabase.from as any)(table)
        .select(messageType === "dm" ? "emoji, user_id" : "emoji, user_id, message_type")
        .eq("message_id", messageId);
      if (messageType !== "dm") request = request.eq("message_type", messageType);
      const { data, error } = await request;
      if (error) throw error;
      return (data ?? []) as ReactionRow[];
    },
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!user || !messageId || messageId.startsWith("pending-")) return;
    const table = messageType === "dm" ? "dm_reactions" : "message_reactions";
    const channel = supabase
      .channel(`message-reactions:${messageType}:${messageId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `message_id=eq.${messageId}` },
        (payload) => {
          const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as ReactionRow & {
            message_id?: string;
          };
          if (!row?.emoji || !row.user_id || row.message_id !== messageId) return;
          if (messageType !== "dm" && row.message_type !== messageType) return;
          qc.setQueryData<ReactionRow[]>(queryKey, (current = []) => {
            const exists = current.some(
              (item) => item.user_id === row.user_id && item.emoji === row.emoji,
            );
            if (payload.eventType === "INSERT") {
              return exists ? current : [...current, row];
            }
            if (payload.eventType === "DELETE") {
              return current.filter(
                (item) => item.user_id !== row.user_id || item.emoji !== row.emoji,
              );
            }
            return current;
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [messageId, messageType, qc, user]);

  const grouped = (data ?? []).reduce<Record<string, { count: number; mine: boolean }>>((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, mine: false };
    acc[r.emoji].count++;
    if (r.user_id === user?.id) acc[r.emoji].mine = true;
    return acc;
  }, {});

  const toggle = useMutation({
    mutationFn: async ({ emoji }: { emoji: string; mine: boolean }) => {
      if (!user) throw new Error("Sign in to react");
      if (messageType === "dm") {
        return callExtraRpc("toggle_dm_reaction", { _message_id: messageId, _emoji: emoji });
      }
      return callExtraRpc("toggle_message_reaction", {
        _message_id: messageId,
        _emoji: emoji,
        _message_type: messageType,
      });
    },
    onMutate: async ({ emoji, mine }) => {
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<ReactionRow[]>(queryKey) ?? data ?? [];
      const next = mine
        ? previous.filter((reaction) => reaction.emoji !== emoji || reaction.user_id !== user?.id)
        : previous.some((reaction) => reaction.emoji === emoji && reaction.user_id === user?.id)
          ? previous
          : [...previous, { emoji, user_id: user?.id ?? "", message_type: messageType }];
      qc.setQueryData(queryKey, next);
      return { queryKey, previous };
    },
    onError: (error: Error, _variables, context) => {
      if (context) qc.setQueryData(context.queryKey, context.previous);
      toast.error(reactionErrorMessage(error));
    },
    onSettled: (_data, _error, _variables, context) => {
      if (context) void qc.invalidateQueries({ queryKey: context.queryKey });
    },
  });

  const entries = Object.entries(grouped);
  if (!messageId || messageId.startsWith("pending-")) return null;

  return (
    <div className={`mt-0.5 flex flex-wrap items-center gap-1 ${align === "right" ? "justify-end" : "justify-start"}`}>
      {entries.map(([emoji, { count, mine }]) => (
        <button
          key={emoji}
          type="button"
          aria-pressed={mine}
          disabled={!user || toggle.isPending}
          onClick={() => toggle.mutate({ emoji, mine })}
          className={`rounded-full border px-1.5 py-1 text-[11px] leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rizz-pink)] disabled:cursor-default ${
            mine
              ? "border-[var(--rizz-pink)]/40 bg-[var(--rizz-pink)]/15 text-foreground"
              : "border-white/10 bg-white/5 hover:bg-white/10"
          }`}
        >
          <span className="mr-0.5">{emoji}</span>
          <span className="font-medium">{count}</span>
        </button>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Add a reaction"
            disabled={!user || toggle.isPending}
            className="grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent align={align === "right" ? "end" : "start"} className="glass-strong w-auto border-white/10 p-1.5">
          <div className="flex gap-1" role="group" aria-label="Quick reactions">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={`React with ${emoji}`}
                disabled={!user || toggle.isPending}
                onClick={() => {
                  toggle.mutate({
                    emoji,
                    mine: grouped[emoji]?.mine ?? false,
                  });
                }}
                className="grid h-9 w-9 place-items-center rounded-lg text-lg hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rizz-pink)]"
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}