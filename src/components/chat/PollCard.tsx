import { useState } from "react";
import { BarChart3, Clock, Users } from "lucide-react";
import { toast } from "@/lib/toast";
import { IconTile } from "@/components/ui/icon-tile";
import { ChoiceMark } from "@/components/ui/choice-mark";
import type { PollCard as PollCardPayload } from "@/lib/realm-polls";
import { usePollTallies, voteRealmPoll, fetchRealmPollVoters } from "@/lib/realm-polls";
import type { ChatPollCardPayload, ChatPollVoter } from "@/lib/chat-polls";
import { useChatPollTallies, voteChatPoll, fetchChatPollVoters } from "@/lib/chat-polls";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type TallyView = {
  data?: { counts: number[]; total: number; mine: number[]; closed: boolean };
  isError: boolean;
  refetch: () => unknown;
};

type VoterView = {
  data?: ChatPollVoter[];
  isLoading: boolean;
};

type PollViewProps = {
  pollId: string;
  question: string;
  options: string[];
  multi: boolean;
  closesAt: string | null;
  canVote: boolean;
  tallies: TallyView;
  voters: VoterView;
  onVote: (index: number) => Promise<void>;
  /** "Who voted" state lives with the query that fetches them. */
  votersOpen: boolean;
  onVotersOpenChange: (open: boolean) => void;
  /** DM/group chats own the full row; realm chat keeps its compact card. */
  fullWidth?: boolean;
};

/**
 * One poll, whichever chat it came from. The poll renders from the message's
 * own `card` payload so it reads instantly; the tallies stream in from the
 * votes table and re-voting is a single RPC (single-choice replaces,
 * multi toggles).
 */
function PollCardView({
  pollId,
  question,
  options,
  multi,
  closesAt,
  canVote,
  tallies,
  voters,
  onVote,
  votersOpen,
  onVotersOpenChange,
  fullWidth = false,
}: PollViewProps) {
  const [busy, setBusy] = useState<number | null>(null);

  const counts = tallies.data?.counts ?? new Array(options.length).fill(0);
  const total = tallies.data?.total ?? 0;
  const mine = new Set(tallies.data?.mine ?? []);
  const closed = tallies.data?.closed ?? false;
  const closable = canVote && !closed;

  const vote = async (index: number) => {
    if (!closable || busy !== null) return;
    setBusy(index);
    try {
      await onVote(index);
      await tallies.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't record that vote");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={`mt-1 w-full rounded-[10px] border border-border bg-card p-3.5 ${fullWidth ? "" : "max-w-md"}`}>
      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-primary">
        <IconTile
          size="xs"
          radius="9999px"
          className="bg-[color-mix(in_srgb,var(--brand-signal)_18%,transparent)]"
        >
          <BarChart3 />
        </IconTile>
        Poll{multi ? " · pick any" : ""}
      </p>
      <p className="mt-1 break-words text-sm font-semibold leading-snug">{question}</p>

      <div className="mt-3 space-y-1.5">
        {options.map((option, index) => {
          const count = counts[index] ?? 0;
          const share = total > 0 ? Math.round((count / total) * 100) : 0;
          const chosen = mine.has(index);
          return (
            <button
              key={`${pollId}-${index}`}
              type="button"
              disabled={!closable}
              onClick={() => void vote(index)}
              className={`relative block w-full overflow-hidden rounded-[8px] border px-3 py-2 text-left text-sm transition-colors ${
                chosen
                  ? "border-primary/60 bg-primary/15"
                  : "border-border bg-[var(--brand-ink-3)] hover:bg-secondary"
              } ${closable ? "cursor-pointer" : "cursor-default"}`}
            >
              <span
                className="absolute inset-y-0 left-0 bg-primary/25 transition-all"
                style={{ width: `${share}%` }}
                aria-hidden="true"
              />
              {/* One box per option, carrying both the choice and its tick. */}
              <span className="relative flex items-center gap-2.5">
                <ChoiceMark shape={multi ? "checkbox" : "radio"} checked={chosen} />
                <span className="min-w-0 flex-1 break-words">{option}</span>
                <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                  {share}%
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1.5">
          {closed ? (
            <>
              <Clock className="h-3 w-3" /> Voting closed · {total} {total === 1 ? "vote" : "votes"}
            </>
          ) : closesAt ? (
            <>
              <Clock className="h-3 w-3" /> {total} {total === 1 ? "vote" : "votes"} · closes{" "}
              {new Date(closesAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </>
          ) : (
            `${total} ${total === 1 ? "vote" : "votes"}`
          )}
          {tallies.isError && " · live counts unavailable"}
        </span>

        {total > 0 && (
          <button
            type="button"
            onClick={() => onVotersOpenChange(true)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline shrink-0"
          >
            <Users className="h-3 w-3" /> Who voted
          </button>
        )}
      </div>

      <Dialog open={votersOpen} onOpenChange={onVotersOpenChange}>
        <DialogContent className="max-w-md bg-card text-card-foreground border border-border rounded-2xl p-5">
          <DialogTitle className="font-display text-base font-bold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Who voted ({total})
          </DialogTitle>
          <div className="mt-3 space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {voters.isLoading && (
              <p className="py-4 text-center text-xs text-muted-foreground animate-pulse">Loading votes…</p>
            )}
            {voters.data && options.map((optLabel, optIndex) => {
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

/** Realm chat's poll: tallies come from `realm_poll_votes`. */
export function PollCard({ card, canVote }: { card: PollCardPayload; canVote: boolean }) {
  const tallies = usePollTallies(card.pollId);
  const [votersOpen, setVotersOpen] = useState(false);
  const voters = useQuery({
    queryKey: ["realm-poll-voters", card.pollId],
    queryFn: () => fetchRealmPollVoters(card.pollId),
    enabled: votersOpen && !!card.pollId,
    staleTime: 15_000,
  });

  return (
    <PollCardView
      pollId={card.pollId}
      question={card.question}
      options={card.options}
      multi={card.multi}
      closesAt={card.closesAt}
      canVote={canVote}
      tallies={tallies}
      voters={voters}
      onVote={(index) => voteRealmPoll(card.pollId, index)}
      votersOpen={votersOpen}
      onVotersOpenChange={setVotersOpen}
    />
  );
}

/** DM and group polls: the same card over `chat_polls` / `chat_poll_votes`. */
export function ChatPollCard({ card, canVote = true }: { card: ChatPollCardPayload; canVote?: boolean }) {
  const tallies = useChatPollTallies(card.pollId);
  const [votersOpen, setVotersOpen] = useState(false);
  const voters = useQuery({
    queryKey: ["chat-poll-voters", card.pollId],
    queryFn: () => fetchChatPollVoters(card.pollId),
    enabled: votersOpen && !!card.pollId,
    staleTime: 15_000,
  });

  return (
    <PollCardView
      pollId={card.pollId}
      question={card.question}
      options={card.options}
      multi={card.multi}
      closesAt={card.closesAt}
      canVote={canVote}
      tallies={tallies}
      voters={voters}
      onVote={(index) => voteChatPoll(card.pollId, index)}
      votersOpen={votersOpen}
      onVotersOpenChange={setVotersOpen}
      fullWidth
    />
  );
}
