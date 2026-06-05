import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

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
      const { data } = await (supabase.from as any)("dm_reactions")
        .select("emoji, user_id")
        .eq("message_id", messageId);
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
    mutationFn: async (emoji: string) => {
      if (!user) return;
      const mine = grouped[emoji]?.mine;
      if (mine) {
        await (supabase.from as any)("dm_reactions")
          .delete()
          .eq("message_id", messageId)
          .eq("user_id", user.id)
          .eq("emoji", emoji);
      } else {
        await (supabase.from as any)("dm_reactions")
          .insert({ message_id: messageId, user_id: user.id, emoji });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dm-reactions", messageId] }),
  });

  const entries = Object.entries(grouped);
  if (entries.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1 mt-0.5 ${align === "right" ? "justify-end" : "justify-start"}`}>
      {entries.map(([emoji, { count, mine }]) => (
        <button
          key={emoji}
          onClick={() => toggle.mutate(emoji)}
          className={`text-[11px] px-1.5 py-0.5 rounded-full border transition-all leading-none ${
            mine
              ? "bg-[var(--rizz-pink)]/15 border-[var(--rizz-pink)]/40"
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