import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export function DMReactionsBar({ messageIds }: { messageIds: string[] }) {
  // placeholder — actual usage in message-level component below
  return null;
}

export function MessageReactions({ messageId, align = "left" }: { messageId: string; align?: "left" | "right" }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["dm-reactions", messageId],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("dm_reactions")
        .select("emoji, user_id")
        .eq("message_id", messageId);
      if (error) throw error;
      return (data ?? []) as { emoji: string; user_id: string }[];
    },
    staleTime: 10_000,
  });

  const grouped = (data ?? []).reduce<Record<string, { count: number; mine: boolean }>>((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, mine: false };
    acc[r.emoji].count++;
    if (r.user_id === user?.id) acc[r.emoji].mine = true;
    return acc;
  }, {});

  const toggle = useMutation({
    mutationFn: async ({ emoji, mine }: { emoji: string; mine: boolean }) => {
      if (!user) throw new Error("Sign in to react");
      void mine;
      const { error } = await (supabase.rpc as any)("toggle_dm_reaction", {
        _message_id: messageId,
        _emoji: emoji,
      });
      if (error) throw error;
    },
    onMutate: async ({ emoji, mine }) => {
      const queryKey = ["dm-reactions", messageId] as const;
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<{ emoji: string; user_id: string }[]>(queryKey) ?? [];
      const next = mine
        ? previous.filter((reaction) => reaction.emoji !== emoji || reaction.user_id !== user?.id)
        : [...previous, { emoji, user_id: user?.id ?? "" }];
      qc.setQueryData(queryKey, next);
      return { queryKey, previous };
    },
    onError: (error: Error, _variables, context) => {
      if (context) qc.setQueryData(context.queryKey, context.previous);
      toast.error(error.message);
    },
    onSettled: (_data, _error, _variables, context) => {
      if (context) void qc.invalidateQueries({ queryKey: context.queryKey });
    },
  });

  const entries = Object.entries(grouped);
  if (entries.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1 mt-0.5 ${align === "right" ? "justify-end" : "justify-start"}`}>
      {entries.map(([emoji, { count, mine }]) => (
        <button
          key={emoji}
          type="button"
          aria-pressed={mine}
          disabled={!user || toggle.isPending}
          onClick={() => toggle.mutate({ emoji, mine })}
          className={`text-[11px] px-1.5 py-1 rounded-full border transition-colors leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rizz-pink)] disabled:cursor-default ${
            mine
              ? "bg-[var(--rizz-pink)]/15 border-[var(--rizz-pink)]/40 text-foreground"
              : "bg-white/5 border-white/10 hover:bg-white/10"
          }`}
        >
          <span className="mr-0.5">{emoji}</span>
          <span className="font-medium">{count}</span>
        </button>
      ))}
    </div>
  );
}