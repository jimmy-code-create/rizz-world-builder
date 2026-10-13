import { useState } from "react";
import { BarChart3, Check, Clock, Users } from "lucide-react";
import { toast } from "sonner";
import type { PollCard as PollCardPayload } from "@/lib/realm-polls";
import { usePollTallies, voteRealmPoll, fetchRealmPollVoters } from "@/lib/realm-polls";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/**
 * The poll renders from the message's own `card` payload, so it reads
 * instantly; the tallies stream in from `realm_poll_votes` and re-voting is a
 * single RPC call (single-choice replaces, multi toggles).
 */
export function PollCard({ card, canVote }: { card: PollCardPayload; canVote: boolean }) {
  const tallies = usePollTallies(card.pollId);
  const [busy, setBusy] = useState<number | null>(null);
  const [votersOpen, setVotersOpen] = useState(false);

  const voters = useQuery({
    queryKey: ["realm-poll-voters", card.pollId],
    queryFn: () => fetchRealmPollVoters(card.pollId),
    enabled: votersOpen && !!card.pollId,
    staleTime: 15_000,
  });

  const counts = tallies.data?.counts ?? new Array(card.options.length).fill(0);
  const total = tallies.data?.total ?? 0;
  const mine = new Set(tallies.data?.mine ?? []);
  const closed = tallies.data?.closed ?? false;
  const closable = canVote && !closed;

  const vote = async (index: number) => {
    if (!closable || busy !== null) return;
    setBusy(index);
    try {
      await voteRealmPoll(card.pollId, index);
      await tallies.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't record that vote");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-1 w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-sm">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--rizz-pink)]">
        <BarChart3 className="h-3.5 w-3.5" /> Poll{card.multi ? " · pick any" : ""}
      </p>
      <p className="mt-1 text-sm font-semibold leading-snug">{card.question}</p>

      <div className="mt-3 space-y-1.5">
        {card.options.map((option, index) => {
          const count = counts[index] ?? 0;
          const share = total > 0 ? Math.round((count / total) * 100) : 0;
          const chosen = mine.has(index);
          return (
            <button
              key={`${card.pollId}-${index}`}
              type="button"
              disabled={!closable}
              onClick={() => void vote(index)}
              className={`relative block w-full overflow-hidden rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                chosen
                  ? "border-[var(--rizz-pink)]/60 bg-[var(--rizz-pink)]/15"
                  : "border-white/10 bg-black/20 hover:bg-white/5"
              } ${closable ? "cursor-pointer" : "cursor-default"}`}
            >
              <span
                className="absolute inset-y-0 left-0 bg-[var(--rizz-pink)]/25 transition-all"
                style={{ width: `${share}%` }}
                aria-hidden="true"
              />
              <span className="relative flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-1.5">
                  {chosen && <Check className="h-3.5 w-3.5 shrink-0 text-[var(--rizz-pink)]" />}
                  <span className="truncate">{option}</span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                  {share}%
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          {closed ? (
            <>
              <Clock className="h-3 w-3" /> Voting closed · {total} {total === 1 ? "vote" : "votes"}
            </>
          ) : card.closesAt ? (
            <>
              <Clock className="h-3 w-3" /> {total} {total === 1 ? "vote" : "votes"} · closes{" "}
              {new Date(card.closesAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </>
          ) : (
            `${total} ${total === 1 ? "vote" : "votes"}`
          )}
          {tallies.isError && " · live counts unavailable"}
        </span>

        {total > 0 && (
          <button
            type="button"
            onClick={() => setVotersOpen(true)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--rizz-pink)] hover:underline shrink-0"
          >
            <Users className="h-3 w-3" /> Who voted
          </button>
        )}
      </div>

      <Dialog open={votersOpen} onOpenChange={setVotersOpen}>
        <DialogContent className="max-w-md bg-card text-card-foreground border border-border rounded-2xl p-5">
          <DialogTitle className="font-display text-base font-bold flex items-center gap-2">
            <Users className="h-4 w-4 text-[var(--rizz-pink)]" /> Who voted ({total})
          </DialogTitle>
          <div className="mt-3 space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {voters.isLoading && (
              <p className="py-4 text-center text-xs text-muted-foreground animate-pulse">Loading votes…</p>
            )}
            {voters.data && card.options.map((optLabel, optIndex) => {
              const optVoters = (voters.data ?? []).filter((v) => v.option_index === optIndex);
              return (
                <div key={optIndex} className="rounded-xl border border-border/70 bg-muted/30 p-3">
                  <div className="flex items-center justify-between text-xs font-semibold mb-2">
                    <span className="truncate flex-1 font-medium">{optLabel}</span>
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
    </div>
  );
}
