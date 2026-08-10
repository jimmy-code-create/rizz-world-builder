import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { BarChart3, Check } from "lucide-react";
import { fetchPoll, votePoll } from "@/lib/polls";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

function closesIn(iso: string | null) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Final results";
  const h = Math.floor(ms / 3600_000);
  if (h >= 24) return `${Math.floor(h / 24)}d left`;
  if (h >= 1) return `${h}h left`;
  return `${Math.max(1, Math.floor(ms / 60_000))}m left`;
}

export function PollBlock({ postId }: { postId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const poll = useQuery({
    queryKey: ["poll", postId, user?.id],
    queryFn: () => fetchPoll(postId, user?.id),
  });

  const vote = useMutation({
    mutationFn: async (optionId: string) => {
      if (!user) throw new Error("Sign in to vote");
      if (!poll.data) return;
      await votePoll(poll.data.id, optionId, user.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["poll", postId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!poll.data) return null;
  const p = poll.data;
  const expired = !!p.closes_at && new Date(p.closes_at).getTime() <= Date.now();
  const revealed = !!p.my_option_id || expired;
  const total = Math.max(1, p.total_votes);

  return (
    <div className="mx-4 mb-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-sm font-semibold mb-2 flex items-center gap-1.5">
        <BarChart3 className="h-4 w-4 text-[var(--rizz-pink)]" /> {p.question}
      </p>
      <div className="space-y-1.5">
        {p.options.map((o) => {
          const pct = revealed ? Math.round((o.vote_count / total) * 100) : 0;
          const mine = p.my_option_id === o.id;
          return (
            <button
              key={o.id}
              type="button"
              disabled={revealed || vote.isPending}
              onClick={() => vote.mutate(o.id)}
              className={`relative w-full overflow-hidden rounded-xl border px-3 py-2 text-left text-sm transition ${
                mine ? "border-[var(--rizz-pink)]/60" : "border-white/10"
              } ${revealed ? "cursor-default" : "hover:bg-white/5 active:scale-[0.99]"}`}
            >
              {revealed && (
                <motion.span
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="absolute inset-y-0 left-0 bg-gradient-primary/30"
                  style={{ background: mine ? "linear-gradient(90deg,var(--rizz-pink),transparent)" : "rgba(255,255,255,0.08)" }}
                />
              )}
              <span className="relative flex items-center gap-2">
                <span className="flex-1 truncate">{o.label}</span>
                {mine && <Check className="h-3.5 w-3.5 text-[var(--rizz-pink)]" />}
                {revealed && <span className="tabular-nums text-xs text-muted-foreground">{pct}%</span>}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {p.total_votes} vote{p.total_votes === 1 ? "" : "s"}
        {closesIn(p.closes_at) ? ` · ${closesIn(p.closes_at)}` : ""}
      </p>
    </div>
  );
}