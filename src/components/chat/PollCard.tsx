import { useState } from "react";
import { BarChart3, Clock } from "lucide-react";
import { toast } from "sonner";
import { IconTile } from "@/components/ui/icon-tile";
import { ChoiceMark } from "@/components/ui/choice-mark";
import type { PollCard as PollCardPayload } from "@/lib/realm-polls";
import { usePollTallies, voteRealmPoll } from "@/lib/realm-polls";

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
    <div className="mt-1 w-full max-w-md rounded-[10px] border border-border bg-card p-3.5">
      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[var(--rizz-pink)]">
        <IconTile
          size="xs"
          radius="9999px"
          className="bg-[color-mix(in_srgb,var(--brand-signal)_18%,transparent)]"
        >
          <BarChart3 />
        </IconTile>
        Poll{card.multi ? " · pick any" : ""}
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
              className={`relative block w-full overflow-hidden rounded-[8px] border px-3 py-2 text-left text-sm transition-colors ${
                chosen
                  ? "border-[var(--rizz-pink)]/60 bg-[var(--rizz-pink)]/15"
                  : "border-border bg-[var(--brand-ink-3)] hover:bg-secondary"
              } ${closable ? "cursor-pointer" : "cursor-default"}`}
            >
              <span
                className="absolute inset-y-0 left-0 bg-[var(--rizz-pink)]/25 transition-all"
                style={{ width: `${share}%` }}
                aria-hidden="true"
              />
              {/* One box per option, carrying both the choice and its tick. */}
              <span className="relative flex items-center gap-2.5">
                <ChoiceMark shape={card.multi ? "checkbox" : "radio"} checked={chosen} />
                <span className="min-w-0 flex-1 truncate">{option}</span>
                <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                  {share}%
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
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
      </p>
    </div>
  );
}
