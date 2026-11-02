import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AlertTriangle, Gavel, Loader2, ShieldCheck, ShieldX } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/formatters";
import { toast } from "@/lib/toast";
import {
  WARNING_REASON_LABEL,
  resolveBountyWarning,
  trustLine,
  useBountyAppeals,
  type BountyAppeal,
} from "@/lib/bounties";

export const Route = createFileRoute("/_app/moderation")({
  head: () => ({ meta: [{ title: "Moderation · RIZZ" }] }),
  component: ModerationPage,
});

/**
 * The warning appeal queue.
 *
 * One warning per bounty per creator, one appeal per warning, one decision per
 * appeal. Upholding removes the warning (and can lift an automatic block);
 * rejecting is final. The page is read-only until a decision is made, and the
 * RPC re-checks the admin role on every call.
 */
function ModerationPage() {
  const qc = useQueryClient();
  const appeals = useBountyAppeals(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const decide = async (appeal: BountyAppeal, remove: boolean) => {
    if (busyId) return;
    setBusyId(appeal.id);
    try {
      const result = await resolveBountyWarning({
        warningId: appeal.id,
        remove,
        note: notes[appeal.id] ?? null,
      });
      toast.success(remove ? "Appeal upheld" : "Appeal rejected", {
        description: remove
          ? `The warning was removed. @${appeal.taker_username ?? "the taker"} now has ${result.warnings} active warning${result.warnings === 1 ? "" : "s"}${result.blocked ? " and is still blocked." : "."}`
          : `The warning stays. @${appeal.taker_username ?? "the taker"} cannot appeal it again.`,
      });
      setNotes((current) => {
        const next = { ...current };
        delete next[appeal.id];
        return next;
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["bounty-appeals"] }),
        qc.invalidateQueries({ queryKey: ["bounty-warnings"] }),
        qc.invalidateQueries({ queryKey: ["bounty-trust"] }),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't decide that appeal");
    } finally {
      setBusyId(null);
    }
  };

  const rows = appeals.data ?? [];

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 flex items-center justify-between gap-3"
      >
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-foreground">
            <Gavel className="h-6 w-6 text-primary" /> Moderation
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Warning appeals waiting on a decision. Pending appeals do not lift an automatic block.
          </p>
        </div>
        <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-bold text-muted-foreground">
          {rows.length} waiting
        </span>
      </motion.div>

      {appeals.isError && (
        <div className="glass rounded-3xl p-8 text-center">
          <ShieldX className="mx-auto h-6 w-6 text-destructive" />
          <h2 className="mt-2 font-display text-lg font-bold">Admins only</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This queue is only readable by an admin.
          </p>
        </div>
      )}

      {appeals.isLoading && <div className="h-40 animate-pulse rounded-3xl glass" />}

      <div className="space-y-3">
        {rows.map((appeal) => {
          const stats = {
            completed: Number(appeal.trust?.completed ?? 0),
            warnings: Number(appeal.trust?.warnings ?? 0),
            level:
              appeal.trust?.level === "top"
                ? "top"
                : appeal.trust?.level === "trusted"
                  ? "trusted"
                  : "new",
          } as const;
          const busy = busyId === appeal.id;
          return (
            <article
              key={appeal.id}
              className="glass space-y-3 rounded-3xl border border-white/10 p-4"
            >
              <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={appeal.taker_avatar_url ?? undefined} alt="" />
                  <AvatarFallback>
                    {(appeal.taker_username ?? "?").slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">
                    @{appeal.taker_username ?? "unknown"}{" "}
                    <span className="font-normal text-muted-foreground">
                      appealed a warning from @{appeal.creator_username ?? "unknown"}
                    </span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {appeal.bounty_title} · {formatNumber(appeal.prize_paws)} Paws
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-primary">
                    {trustLine(stats)} ·{" "}
                    {stats.level === "top" ? "Top" : stats.level === "trusted" ? "Trusted" : "New"}
                  </p>
                </div>
                <span className="rounded-md border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-amber-100">
                  Pending
                </span>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                  <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    <AlertTriangle className="h-3 w-3" /> The warning
                  </p>
                  <p className="mt-1 text-xs font-semibold">
                    {WARNING_REASON_LABEL[appeal.reason]}
                  </p>
                  {appeal.note && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{appeal.note}</p>
                  )}
                </div>
                <div className="rounded-xl border border-primary/20 bg-primary/[0.05] p-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
                    The appeal
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-foreground/90">
                    {appeal.appeal_message}
                  </p>
                </div>
              </div>

              <Input
                value={notes[appeal.id] ?? ""}
                onChange={(event) =>
                  setNotes((current) => ({ ...current, [appeal.id]: event.target.value }))
                }
                maxLength={500}
                placeholder="Optional note the taker will see with the decision"
                className="glass border-white/10 text-xs"
              />

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => void decide(appeal, true)}
                  disabled={busy}
                  className="min-h-10 flex-1 border-0 bg-primary text-xs font-bold text-primary-foreground"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4" /> Uphold — remove the warning
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => void decide(appeal, false)}
                  disabled={busy}
                  variant="outline"
                  className="min-h-10 flex-1 border-white/15 bg-white/[0.04] text-xs font-bold"
                >
                  <ShieldX className="h-4 w-4" /> Reject — warning stays
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      {!appeals.isLoading && !appeals.isError && rows.length === 0 && (
        <div className="glass flex flex-col items-center rounded-3xl p-10 text-center">
          <ShieldCheck className="h-7 w-7 text-primary" />
          <h2 className="mt-2 font-display text-xl font-bold">The queue is clear</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            No warning appeals are waiting on a decision.
          </p>
        </div>
      )}
    </div>
  );
}
