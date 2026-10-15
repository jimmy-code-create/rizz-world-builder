import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { BarChart3, Check, Clock, Users } from "lucide-react";
import { fetchPoll, fetchPollVoters, votePoll } from "@/lib/polls";
import { useAuth } from "@/lib/auth";
import { toast } from "@/lib/toast";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
  const [votersOpen, setVotersOpen] = useState(false);

  const poll = useQuery({
    queryKey: ["poll", postId, user?.id],
    queryFn: () => fetchPoll(postId, user?.id),
  });

  const voters = useQuery({
    queryKey: ["poll-voters", poll.data?.id],
    queryFn: () => fetchPollVoters(poll.data!.id),
    enabled: votersOpen && !!poll.data?.id,
    staleTime: 15_000,
  });

  const vote = useMutation({
    mutationFn: async (optionId: string) => {
      if (!user) throw new Error("Sign in to vote");
      if (!poll.data) return;
      await votePoll(poll.data.id, optionId, user.id);
    },
    onMutate: async (optionId) => {
      const queryKey = ["poll", postId, user?.id] as const;
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<typeof poll.data>(queryKey);
      if (previous && !previous.my_option_id) {
        qc.setQueryData(queryKey, {
          ...previous,
          my_option_id: optionId,
          total_votes: previous.total_votes + 1,
          options: previous.options.map((option) =>
            option.id === optionId ? { ...option, vote_count: option.vote_count + 1 } : option,
          ),
        });
      }
      return { queryKey, previous };
    },
    onError: (e: Error, _optionId, context) => {
      if (context) qc.setQueryData(context.queryKey, context.previous);
      toast.error(e.message);
    },
    onSettled: (_data, _error, _optionId, context) => {
      if (context) void qc.invalidateQueries({ queryKey: context.queryKey });
    },
  });

  if (poll.isLoading) {
    return (
      <div aria-label="Loading poll" className="mx-4 mb-3 space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="skeleton-shimmer h-4 w-2/3 rounded-md" />
        <div className="skeleton-shimmer h-9 rounded-xl" />
        <div className="skeleton-shimmer h-9 rounded-xl" />
      </div>
    );
  }
  if (poll.isError) {
    return (
      <div className="mx-4 mb-3 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <p className="text-xs text-muted-foreground">Poll results couldn’t load.</p>
        <button type="button" onClick={() => void poll.refetch()} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Retry</button>
      </div>
    );
  }
  if (!poll.data) return null;
  const p = poll.data;
  const expired = !!p.closes_at && new Date(p.closes_at).getTime() <= Date.now();
  const revealed = !!p.my_option_id || expired;
  const total = Math.max(1, p.total_votes);
  const timeLabel = closesIn(p.closes_at);

  return (
    <section aria-label="Poll" className="relative mx-4 mb-3 overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.018))] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] sm:p-4">
      <div className="mb-3 flex items-start gap-2.5">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10">
          <BarChart3 aria-hidden="true" className="h-4 w-4 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Community poll</p>
          <h3 className="mt-0.5 text-sm font-semibold leading-snug">{p.question}</h3>
        </div>
      </div>
      <div className="space-y-2">
        {p.options.map((o) => {
          const pct = revealed ? Math.round((o.vote_count / total) * 100) : 0;
          const mine = p.my_option_id === o.id;
          return (
            <button
              key={o.id}
              type="button"
              disabled={revealed || vote.isPending || expired}
              aria-pressed={mine}
              onClick={() => vote.mutate(o.id)}
              className={`group relative min-h-11 w-full overflow-hidden rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                mine ? "border-primary/50 bg-primary/[0.07]" : "border-white/[0.09] bg-black/10"
              } ${revealed ? "cursor-default" : "hover:border-white/20 hover:bg-white/[0.045] active:bg-white/[0.08]"}`}
            >
              {revealed && (
                <motion.span
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: pct / 100 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="absolute inset-0 origin-left"
                  style={{ background: mine ? "linear-gradient(90deg,color-mix(in oklab,var(--brand-signal) 24%,transparent),transparent)" : "rgba(255,255,255,0.07)" }}
                />
              )}
              <span className="relative flex items-center gap-2.5">
                <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${mine ? "border-primary bg-primary text-primary-foreground" : "border-white/25 group-hover:border-white/45"}`}>
                  {mine && <Check aria-hidden="true" className="h-3 w-3" strokeWidth={3} />}
                </span>
                <span className="flex-1 truncate font-medium">{o.label}</span>
                {revealed && <span className="tabular-nums text-xs font-semibold text-foreground/75">{pct}%</span>}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5 text-[10px] font-medium text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="tabular-nums">{p.total_votes.toLocaleString()} {p.total_votes === 1 ? "vote" : "votes"}</span>
          {p.total_votes > 0 && (
            <button
              type="button"
              onClick={() => setVotersOpen(true)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
            >
              <Users className="h-3 w-3" /> See who voted
            </button>
          )}
        </div>
        {timeLabel && (
          <span className="inline-flex items-center gap-1.5">
            <Clock aria-hidden="true" className="h-3 w-3" />
            {timeLabel}
          </span>
        )}
      </div>

      <Dialog open={votersOpen} onOpenChange={setVotersOpen}>
        <DialogContent className="max-w-md bg-card text-card-foreground border border-border rounded-2xl p-5">
          <DialogTitle className="font-display text-base font-bold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Who voted ({p.total_votes})
          </DialogTitle>
          <div className="mt-3 space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {voters.isLoading && (
              <p className="py-4 text-center text-xs text-muted-foreground animate-pulse">Loading votes…</p>
            )}
            {voters.data && p.options.map((opt) => {
              const optVoters = (voters.data ?? []).filter((v) => v.option_id === opt.id);
              return (
                <div key={opt.id} className="rounded-xl border border-border/70 bg-muted/30 p-3">
                  <div className="flex items-center justify-between text-xs font-semibold mb-2">
                    <span className="truncate flex-1 font-medium">{opt.label}</span>
                    <span className="text-muted-foreground ml-2 text-[11px] font-bold tabular-nums">
                      {optVoters.length} {optVoters.length === 1 ? "vote" : "votes"}
                    </span>
                  </div>
                  {optVoters.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground italic">No votes yet</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {optVoters.map((v) => (
                        <div key={v.user_id} className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card py-1 px-2 text-xs">
                          <Avatar className="h-4 w-4">
                            <AvatarImage src={v.user?.avatar_url ?? undefined} />
                            <AvatarFallback className="text-[8px] font-bold">
                              {(v.user?.username ?? "?").charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate max-w-[110px] text-[11px] font-medium">
                            {v.user?.display_name || v.user?.username || "Someone"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}