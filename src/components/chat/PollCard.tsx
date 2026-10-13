import { useState } from "react";
import { BarChart3, Clock } from "lucide-react";
import { toast } from "sonner";
import type { PollCard as PollCardPayload } from "@/lib/realm-polls";
import { usePollTallies, voteRealmPoll } from "@/lib/realm-polls";
import { CheckboxIndicator, RadioIndicator, IconTile } from "@/components/ui/IconTile";

/**
 * The poll renders from the message's own `card` payload, so it reads
 * instantly; the tallies stream in from `realm_poll_votes` and re-voting is a
 * single RPC call (single-choice replaces, multi toggles).
 */
export function PollCard({ card, canVote }: { card: PollCardPayload; canVote: boolean }) {
  const tallies = usePollTallies(card.pollId);
  const [busy, setBusy] = useState<number | null>(null);

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
    <div className="mt-1 w-full max-w-md rounded-xl border border-border bg-card p-3.5">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">
        <IconTile size="xs" shape="square" className="text-primary">
          <BarChart3 className="h-3.5 w-3.5" />
        </IconTile>
        <span>Poll{card.multi ? " · pick any" : ""}</span>
      </div>
      <p className="mt-1 text-sm font-semibold leading-snug text-foreground">{card.question}</p>

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
              className={`relative block w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                chosen
                  ? "border-primary/60 bg-primary/10"
                  : "border-border bg-muted/30 hover:bg-muted/50"
              } ${closable ? "cursor-pointer" : "cursor-default"}`}
            >
              <span
                className="absolute inset-y-0 left-0 bg-primary/15 transition-all"
                style={{ width: `${share}%` }}
                aria-hidden="true"
              />
              <span className="relative flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  {card.multi ? (
                    <CheckboxIndicator checked={chosen} />
                  ) : (
                    <RadioIndicator checked={chosen} />
                  )}
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

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2 text-[10px] font-medium text-muted-foreground">
        <span>{total} {total === 1 ? "vote" : "votes"}</span>
        {card.endsAt && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {closed ? "Closed" : `Ends ${new Date(card.endsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
          </span>
        )}
      </div>
    </div>
  );
}
