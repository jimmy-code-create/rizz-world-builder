import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  AlarmClock,
  Ban,
  Check,
  CircleCheck,
  Coins,
  Flag,
  Hand,
  Lock,
  PawPrint,
  ShieldCheck,
  Sparkles,
  Timer,
  Undo2,
  UserCheck,
} from "lucide-react";
import { usePurify } from "@/lib/purify";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatNumber } from "@/lib/formatters";
import { fixCommonTypos } from "@/lib/text-fix";
import { toast } from "@/lib/toast";
import { useAuth } from "@/lib/auth";
import {
  CANCEL_FEE,
  MIN_TRUST_LABEL,
  PROOF_TYPE_LABEL,
  bountyNextStep,
  bountyState,
  bountyStateLabel,
  blockBountyUser,
  canAffordTakerCancelFee,
  canCancelBounty,
  canReviewBounty,
  canSubmitProof,
  cancelFee,
  feeRecipientLabel,
  isEndingSoon,
  isEscrowBounty,
  minutesLeft,
  releaseBounty,
  releaseOverduePayout,
  reviewOverdue,
  unblockBountyUser,
  useBountyRules,
  useMyBountyBlocks,
  viewerRole,
  type BountyRow,
  type BountySubmission,
  type BountyTrust,
} from "@/lib/bounties";
import {
  CancelBountyDialog,
  ReviewSubmissionDialog,
  SubmitProofDialog,
} from "@/components/bounties/BountyActions";
import { TakeBountyDialog } from "@/components/bounties/TakeBountyDialog";
import { TrustLine, WarnTakerDialog } from "@/components/bounties/SafetyActions";

/** "3d 4h", "2h 10m", "48m" — the poster's clock, not a stopwatch. */
function timeText(minutes: number): string {
  if (minutes <= 0) return "ended";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

const STATE_TONE: Record<string, string> = {
  open: "border-primary/35 bg-primary/[0.12] text-primary",
  taken: "border-sky-300/30 bg-sky-300/[0.12] text-sky-200",
  submitted: "border-amber-300/35 bg-amber-300/[0.12] text-amber-100",
  paid: "border-emerald-300/35 bg-emerald-300/[0.12] text-emerald-200",
  cancelled: "border-white/10 bg-white/[0.04] text-muted-foreground",
  expired: "border-white/10 bg-white/[0.04] text-muted-foreground",
};

/**
 * One bounty, with every action the viewer is allowed to take on it.
 *
 * The card owns its three dialogs (submit, review, cancel) so the page stays a
 * list and a fetch, and `onChanged` is the only thing it needs from above: the
 * page invalidates the board, the Paws balance and the ledger.
 *
 * Legacy open calls (no prize) render through the same shell with their claim
 * button, so the board never shows two different card designs.
 */
export function BountyCard({
  bounty,
  submission = null,
  workerName = null,
  workerTrust = null,
  claimed = false,
  onChanged,
  onClaim,
}: {
  bounty: BountyRow;
  /** Newest proof for this bounty, when the viewer is allowed to read it. */
  submission?: BountySubmission | null;
  /** Username of the member on it, resolved by the page. */
  workerName?: string | null;
  /** The taker's trust line, resolved once for the whole board. */
  workerTrust?: BountyTrust | null;
  /** Legacy open calls: whether this viewer already claimed it. */
  claimed?: boolean;
  onChanged: () => void;
  onClaim?: (dropId: string) => Promise<void> | void;
}) {
  const { user, profile } = useAuth();
  const purify = usePurify();
  const rules = useBountyRules().data;
  const qc = useQueryClient();
  const myBlocks = useMyBountyBlocks(user?.id).data ?? [];
  const [busy, setBusy] = useState(false);
  const [proofOpen, setProofOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [takeOpen, setTakeOpen] = useState(false);
  const [warnOpen, setWarnOpen] = useState(false);
  const [blockAsk, setBlockAsk] = useState(false);
  const [releaseAsk, setReleaseAsk] = useState(false);

  const escrow = isEscrowBounty(bounty);
  const state = bountyState(bounty);
  const role = viewerRole(bounty, user?.id);
  const prize = Number(bounty.prize_paws ?? 0);
  const left = minutesLeft(bounty.expires_at);
  const ending = isEndingSoon(bounty);
  const overdue = reviewOverdue(bounty);
  const reviewLeft = minutesLeft(bounty.review_deadline);
  const fee = cancelFee(prize, state === "taken" || state === "submitted", rules ?? undefined);
  const workerLabel = workerName ? `@${workerName}` : "a member";
  const soldOut = bounty.claim_count >= bounty.claim_limit;
  const claimPct = Math.min(100, (bounty.claim_count / Math.max(1, bounty.claim_limit)) * 100);

  /** Make RPC failures on claims readable instead of surfacing the raw DB error. */
  function normalizedTakeError(error: unknown): string {
    const text = error instanceof Error ? error.message : "";
    const lower = text.toLowerCase();
    if (text.includes("Purify perk") || lower.includes("purify")) {
      return "Taking bounties is a Purify perk.";
    }
    if (text.includes("blocked you")) return "This poster has blocked you from their bounties.";
    if (text.includes("blocked from taking bounties")) {
      return "Your account is blocked from taking bounties after 3 warnings.";
    }
    if (text.includes("cancellation fee")) {
      return `Keep at least ${formatNumber(rules?.cancelFee ?? CANCEL_FEE)} Paws to take this one.`;
    }
    return error instanceof Error ? error.message : "Couldn't take that bounty";
  }

  const refresh = () => {
    onChanged();
    void qc.invalidateQueries({ queryKey: ["bounty-submissions"] });
    void qc.invalidateQueries({ queryKey: ["bounty-warnings"] });
    void qc.invalidateQueries({ queryKey: ["bounty-trust"] });
    void qc.invalidateQueries({ queryKey: ["bounty-trust-map"] });
  };

  const affordable = canAffordTakerCancelFee(Number(profile?.paw_balance ?? 0));
  const blockedHere = Boolean(bounty.assigned_to && myBlocks.includes(bounty.assigned_to));

  const toggleBlock = async (block: boolean) => {
    if (!bounty.assigned_to) return;
    try {
      if (block) await blockBountyUser(bounty.assigned_to);
      else await unblockBountyUser(bounty.assigned_to);
      toast.info(block ? "Blocked from your bounties" : "Unblocked");
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't update the block");
    }
  };

  const release = async () => {
    try {
      const result = await releaseBounty(bounty.id, "Released from the bounty board");
      toast.info(`Released — ${formatNumber(result.fee)} Paws fee charged`, {
        description: "The bounty is open for someone else.",
      });
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't release that bounty");
    }
  };

  const forcePayout = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await releaseOverduePayout(bounty.id);
      toast.success(`${formatNumber(result.payout)} Paws released to the worker`, {
        description: "The review window passed without a decision.",
      });
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't release that payout");
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass overflow-hidden rounded-3xl border ${
        ending && state === "open" ? "border-amber-300/30" : "border-white/5"
      }`}
    >
      {bounty.media_url && (
        <div className="aspect-video overflow-hidden bg-black">
          <img
            src={bounty.media_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        </div>
      )}

      <div className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-semibold ${
                  STATE_TONE[state] ?? STATE_TONE.open
                }`}
              >
                {state === "paid" ? <CircleCheck className="h-3 w-3" /> : null}
                {bountyStateLabel(bounty)}
              </span>
              {escrow && (
                <span
                  className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-semibold ${
                    state === "paid"
                      ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
                      : "border-white/10 bg-white/[0.04] text-muted-foreground"
                  }`}
                >
                  {state === "paid" ? (
                    <CircleCheck className="h-3 w-3" />
                  ) : (
                    <Lock className="h-3 w-3" />
                  )}
                  {state === "paid" ? "Settled" : `${formatNumber(prize)} Paws escrowed`}
                </span>
              )}
            </div>

            <h3 className="mt-2 font-display text-xl font-bold">{fixCommonTypos(bounty.title)}</h3>
            {bounty.description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {fixCommonTypos(bounty.description)}
              </p>
            )}
            <p className="mt-1.5 text-xs text-muted-foreground">by @{bounty.creator?.username}</p>
          </div>

          <div
            className={`flex shrink-0 items-center gap-1 rounded-xl border px-3 py-1.5 font-mono text-xs font-bold ${
              ending && state === "open"
                ? "border-amber-300/40 bg-amber-300/10 text-amber-100"
                : "border-border bg-card"
            }`}
          >
            <Timer className="h-3 w-3 text-primary" />
            {timeText(left)}
          </div>
        </div>

        {escrow && bounty.requirements && (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3">
            <p className="text-[11px] font-semibold text-muted-foreground">
              What counts as done
            </p>
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/90">
              {fixCommonTypos(bounty.requirements)}
            </p>
          </div>
        )}

        {escrow ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 font-bold text-primary">
              <PawPrint className="h-3.5 w-3.5" />
              {formatNumber(prize)} Paws
            </span>
            {state === "taken" && (
              <span className="inline-flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5" />
                {role === "worker" ? "You are on it" : `${workerLabel} is on it`}
              </span>
            )}
            {workerTrust && (state === "taken" || state === "submitted" || state === "paid") && (
              <TrustLine stats={workerTrust} />
            )}
            {bounty.proof_type && bounty.proof_type !== "any" && (
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5" />
                Proof: {PROOF_TYPE_LABEL[bounty.proof_type]}
              </span>
            )}
            {bounty.min_trust && bounty.min_trust !== "any" && (
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                {MIN_TRUST_LABEL[bounty.min_trust]}
              </span>
            )}
            {bounty.premium_only && (
              <span className="inline-flex items-center gap-1.5 text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Premium takers
              </span>
            )}
            {state === "submitted" && (
              <span className="inline-flex items-center gap-1.5 font-semibold text-amber-100">
                <AlarmClock className="h-3.5 w-3.5" />
                {overdue ? "Review window passed" : `Auto-pays in ${timeText(reviewLeft)}`}
              </span>
            )}{" "}
            {state === "paid" && (
              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-200">
                <CircleCheck className="h-3.5 w-3.5" />
                Paid {formatNumber(prize)} Paws to {workerLabel}
              </span>
            )}{" "}
            {state === "cancelled" && (
              <span className="inline-flex items-center gap-1.5 font-semibold text-muted-foreground">
                <Undo2 className="h-3.5 w-3.5" />
                Cancelled,{" "}
                {bounty.cancel_reason ? fixCommonTypos(bounty.cancel_reason) : "no reason given"}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Hand className="h-3.5 w-3.5" />
              {bounty.released_count ? `${bounty.released_count} release(s)` : "Escrow protected"}
            </span>
          </div>
        ) : (
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {formatNumber(bounty.claim_count)} / {formatNumber(bounty.claim_limit)} claimed
              </span>
              <span
                className="font-bold"
                style={{ color: claimPct > 90 ? "var(--brand-signal)" : undefined }}
              >
                {Math.round(claimPct)}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/5">
              <div className="h-full w-full origin-left bg-primary transition-transform motion-reduce:transition-none" style={{ transform: `scaleX(${claimPct / 100})` }} />
            </div>
          </div>
        )}

        <p className="text-[12px] leading-relaxed text-muted-foreground">
          {bountyNextStep(bounty, role, user?.id)}
        </p>

        {/* ---- Actions: exactly what this viewer may do, nothing else ---- */}
        <div className="flex flex-wrap items-center gap-2">
          {!escrow && (
            <Button
              onClick={() => onClaim?.(bounty.id)}
              disabled={claimed || soldOut || bounty.creator_id === user?.id || !user}
              className={`min-h-10 flex-1 ${
                claimed || soldOut || bounty.creator_id === user?.id
                  ? "glass border border-white/10"
                  : "border-0 bg-primary text-primary-foreground shadow-md"
              }`}
              variant={claimed || soldOut || bounty.creator_id === user?.id ? "outline" : "default"}
            >
              {claimed ? (
                <>
                  <Check className="h-4 w-4" /> Claimed
                </>
              ) : soldOut ? (
                "Sold out"
              ) : bounty.creator_id === user?.id ? (
                "Your bounty"
              ) : (
                <>
                  <PawPrint className="h-4 w-4" /> Claim and earn 25 Paws
                </>
              )}
            </Button>
          )}

          {escrow && (
            <>
              {state === "open" &&
                role !== "creator" &&
                (!user ? (
                  <Button
                    disabled
                    variant="outline"
                    className="min-h-10 flex-1 border-white/10 bg-white/[0.03] text-xs font-bold"
                  >
                    Sign in to take
                  </Button>
                ) : !purify.active ? (
                  <Button
                    asChild
                    className="min-h-10 flex-1 border-0 bg-primary text-xs font-bold text-primary-foreground shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <Link to="/purify">
                      <Sparkles className="h-4 w-4" />
                      Premium to take
                    </Link>
                  </Button>
                ) : !affordable ? (
                  <Button
                    disabled
                    variant="outline"
                    className="min-h-10 flex-1 border-white/10 bg-white/[0.03] text-xs font-bold"
                  >
                    <PawPrint className="h-4 w-4" />
                    Keep {formatNumber(rules?.cancelFee ?? CANCEL_FEE)} Paws to take
                  </Button>
                ) : (
                  <Button
                    onClick={() => setTakeOpen(true)}
                    disabled={busy || left <= 0}
                    className="min-h-10 flex-1 border-0 bg-primary text-xs font-bold text-primary-foreground shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <PawPrint className="h-4 w-4" />
                    Take it and earn {formatNumber(prize)} Paws
                  </Button>
                ))}


              {state === "open" && role === "creator" && (
                <span className="text-[12px] font-semibold text-muted-foreground">
                  Waiting for someone to take it…
                </span>
              )}

              {canSubmitProof(bounty, user?.id) && (
                <>
                  <Button
                    onClick={() => setProofOpen(true)}
                    className="min-h-10 flex-1 border-0 bg-primary text-xs font-bold text-primary-foreground shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <PawPrint className="h-4 w-4" />
                    Submit work
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setReleaseAsk(true)}
                    className="min-h-10 gap-1.5 border-white/10 bg-white/[0.03] text-xs font-bold"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                    Hand it back
                  </Button>
                </>
              )}

              {role === "worker" && state === "submitted" && (
                <>
                  <span className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 text-xs font-bold text-amber-100">
                    <AlarmClock className="h-3.5 w-3.5" />
                    {overdue ? "They missed the window" : `Waiting · ${timeText(reviewLeft)}`}
                  </span>
                  {overdue && (
                    <Button
                      onClick={() => void forcePayout()}
                      disabled={busy}
                      className="min-h-10 gap-1.5 border-0 bg-primary text-xs font-bold text-primary-foreground shadow-md"
                    >
                      <Coins className="h-4 w-4" />
                      Release my {formatNumber(prize)} Paws
                    </Button>
                  )}
                </>
              )}

              {canReviewBounty(bounty, user?.id) && (
                <Button
                  onClick={() => setReviewOpen(true)}
                  className="min-h-10 flex-1 gap-1.5 border-0 bg-primary text-xs font-bold text-primary-foreground shadow-md"
                >
                  <CircleCheck className="h-4 w-4" />
                  Review the work
                </Button>
              )}

              {canCancelBounty(bounty, user?.id) && (
                <Button
                  variant="outline"
                  onClick={() => setCancelOpen(true)}
                  className="min-h-10 gap-1.5 border-white/10 bg-white/[0.03] text-xs font-bold text-muted-foreground hover:text-foreground"
                >
                  Cancel · {formatNumber(fee)} Paws fee
                </Button>
              )}
            </>
          )}
        </div>

        {role === "creator" && bounty.assigned_to && (
          <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
            <Button
              variant="outline"
              onClick={() => setWarnOpen(true)}
              className="min-h-9 gap-1.5 border-white/10 bg-white/[0.03] text-xs font-bold text-muted-foreground hover:text-foreground"
            >
              <Flag className="h-3.5 w-3.5" />
              Warn taker
            </Button>
            <Button
              variant="outline"
              onClick={() => setBlockAsk(true)}
              className="min-h-9 gap-1.5 border-white/10 bg-white/[0.03] text-xs font-bold text-muted-foreground hover:text-foreground"
            >
              <Ban className="h-3.5 w-3.5" />
              {blockedHere ? "Unblock user" : "Block user"}
            </Button>
          </div>
        )}
      </div>

      <TakeBountyDialog
        bounty={bounty}
        open={takeOpen}
        onOpenChange={setTakeOpen}
        onTaken={() => {
          toast.success(`${formatNumber(prize)} Paws on the line`, {
            description: "Finish it and submit your proof before the deadline.",
          });
          refresh();
        }}
      />
      <WarnTakerDialog
        bounty={bounty}
        workerName={workerName}
        open={warnOpen}
        onOpenChange={setWarnOpen}
        onWarned={refresh}
      />
      <ConfirmDialog
        open={blockAsk}
        onOpenChange={setBlockAsk}
        title={blockedHere ? "Unblock this member?" : "Block this member?"}
        description={
          blockedHere
            ? "They will be able to take your bounties again."
            : "They will not be able to take any of your bounties. This is separate from a warning and does not notify them."
        }
        confirmLabel={blockedHere ? "Unblock" : "Block"}
        cancelLabel="Cancel"
        onConfirm={() => toggleBlock(!blockedHere)}
      />
      <SubmitProofDialog
        bounty={bounty}
        open={proofOpen}
        onOpenChange={setProofOpen}
        onSubmitted={refresh}
      />
      <ReviewSubmissionDialog
        bounty={bounty}
        submission={submission}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        onReviewed={refresh}
      />
      <CancelBountyDialog
        bounty={bounty}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        onCancelled={refresh}
      />
      <ConfirmDialog
        open={releaseAsk}
        onOpenChange={setReleaseAsk}
        title="Hand this bounty back?"
        description={`The Paws stay in escrow and the bounty returns to the pool for anyone else. ${formatNumber(
          rules?.cancelFee ?? CANCEL_FEE,
        )} Paws is charged as the cancellation fee and goes to ${feeRecipientLabel(
          rules?.feeRecipient ?? "creator",
        )}.`}
        confirmLabel={`Hand it back · ${formatNumber(rules?.cancelFee ?? CANCEL_FEE)} Paws`}
        cancelLabel="Keep working"
        onConfirm={release}
      />
    </motion.div>
  );
}

/** Small avatar + name helper used by the board's "on it" rows. */
export function WorkerAvatar({
  username,
  avatarUrl,
}: {
  username: string | null;
  avatarUrl: string | null;
}) {
  const initial = (username ?? "?").charAt(0).toUpperCase();
  return (
    <Avatar className="h-5 w-5">
      <AvatarImage src={avatarUrl ?? undefined} />
      <AvatarFallback className="bg-primary text-[10px] font-bold text-primary-foreground">
        {initial}
      </AvatarFallback>
    </Avatar>
  );
}
