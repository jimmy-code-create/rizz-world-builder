import { useState } from "react";
import {
  AlertTriangle,
  Check,
  CircleCheck,
  ExternalLink,
  Loader2,
  PawPrint,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatNumber } from "@/lib/formatters";
import { toast } from "@/lib/toast";
import {
  BOUNTY_SUBMISSION_BUCKET,
  PROOF_TYPE_LABEL,
  cancelFee,
  isEscrowBounty,
  minutesLeft,
  reviewBountySubmission,
  reviewOverdue,
  submitBountyProof,
  cancelBounty,
  useBountyRules,
  useBountyTrust,
  type BountyRow,
  type BountySubmission,
} from "@/lib/bounties";
import { TrustLine } from "@/components/bounties/SafetyActions";

/** Only ordinary web URLs belong in an href; old rows may predate the check. */
function proofHref(value: string): string | null {
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

/** Shared shell so all three dialogs read as the same surface. */
function ActionDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-white/10 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">{title}</DialogTitle>
        </DialogHeader>
        {subtitle && <p className="-mt-2 text-xs text-muted-foreground">{subtitle}</p>}
        {children}
      </DialogContent>
    </Dialog>
  );
}

/**
 * The worker's half of the deal: a note, up to a handful of links, and files as
 * proof. Submitting hands the decision to the poster and starts the review
 * clock — if the poster never decides, the escrow pays out on its own, so
 * submitting is always worth doing.
 */
export function SubmitProofDialog({
  bounty,
  open,
  onOpenChange,
  onSubmitted,
}: {
  bounty: BountyRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted: () => void;
}) {
  const { user } = useAuth();
  const rules = useBountyRules().data;
  const [note, setNote] = useState("");
  const [links, setLinks] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const linkList = links
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, rules?.maxLinks ?? 5);
  const canSubmit = !!user && (!!note.trim() || linkList.length > 0 || files.length > 0);

  const send = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      const mediaUrls: string[] = [];
      for (const file of files.slice(0, rules?.maxMedia ?? 4)) {
        const path = `${user.id}/proof/${bounty.id}-${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from(BOUNTY_SUBMISSION_BUCKET).upload(path, file);
        if (error) throw error;
        mediaUrls.push(
          supabase.storage.from(BOUNTY_SUBMISSION_BUCKET).getPublicUrl(path).data.publicUrl,
        );
      }
      const result = await submitBountyProof({
        dropId: bounty.id,
        note,
        links: linkList,
        mediaUrls,
      });
      const hours = result.reviewDeadline
        ? Math.max(1, Math.round(minutesLeft(result.reviewDeadline) / 60))
        : (rules?.reviewHours ?? 72);
      toast.success("Work submitted", {
        description: `The poster has ${hours}h to decide — after that it pays out by itself.`,
      });
      setNote("");
      setLinks("");
      setFiles([]);
      onSubmitted();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't submit that");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Submit your work"
      subtitle={bounty.title}
    >
      <div className="space-y-3">
        {bounty.proof_type && bounty.proof_type !== "any" && (
          <p className="rounded-xl border border-primary/20 bg-primary/[0.06] p-2.5 text-[11px] text-muted-foreground">
            The poster asked for{" "}
            <span className="font-bold text-primary">{PROOF_TYPE_LABEL[bounty.proof_type]}</span> as
            proof. Anything else may be rejected.
          </p>
        )}
        <Textarea
          placeholder="What did you do? Where should they look?"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={2000}
          className="glass min-h-24 border-white/10"
        />
        <div>
          <label className="text-xs text-muted-foreground" htmlFor="proof-links">
            Links (one per line, up to {rules?.maxLinks ?? 5})
          </label>
          <Textarea
            id="proof-links"
            placeholder={"https://…\nhttps://…"}
            value={links}
            onChange={(event) => setLinks(event.target.value)}
            className="glass mt-1 min-h-16 border-white/10 font-mono text-xs"
          />
        </div>
        <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] text-xs font-semibold text-foreground transition-colors hover:bg-white/[0.07]">
          <Upload className="h-4 w-4" />
          Attach proof ({files.length}/{rules?.maxMedia ?? 4})
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              const picked = Array.from(event.target.files ?? []);
              setFiles((current) => [...current, ...picked].slice(0, rules?.maxMedia ?? 4));
            }}
          />
        </label>
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {files.map((file) => (
              <span
                key={file.name}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px]"
              >
                {file.name}
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => setFiles((current) => current.filter((f) => f !== file))}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <Button
          onClick={() => void send()}
          disabled={busy || !canSubmit}
          className="w-full bg-primary text-primary-foreground border-0 shadow-md"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
          ) : (
            <>
              <PawPrint className="h-4 w-4" />
              Submit for {formatNumber(bounty.prize_paws ?? 0)} Paws
            </>
          )}
        </Button>
      </div>
    </ActionDialog>
  );
}

/** The poster's half: a yes that pays out, or a no that reopens the bounty. */
export function ReviewSubmissionDialog({
  bounty,
  submission,
  open,
  onOpenChange,
  onReviewed,
}: {
  bounty: BountyRow;
  submission: BountySubmission | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReviewed: () => void;
}) {
  const rules = useBountyRules().data;
  const workerTrust = useBountyTrust(bounty.assigned_to).data;
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<null | "approve" | "reject">(null);
  const overdue = reviewOverdue(bounty);
  const rejectionsLeft = Math.max(
    0,
    (rules?.maxRejections ?? 3) - Number(bounty.reject_count ?? 0),
  );

  const decide = async (approve: boolean) => {
    if (busy) return;
    setBusy(approve ? "approve" : "reject");
    try {
      const result = await reviewBountySubmission({ dropId: bounty.id, approve, note });
      if (approve) {
        toast.success(`${formatNumber(result.payout)} Paws paid to the worker`, {
          description: "The escrow is settled and the bounty is closed.",
        });
      } else {
        toast.info("Sent back with your note", {
          description: "The Paws stay in escrow and the bounty is open again.",
        });
      }
      setNote("");
      onReviewed();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't record that decision");
    } finally {
      setBusy(null);
    }
  };

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Review the work"
      subtitle={bounty.title}
    >
      <div className="space-y-3">
        <div className="space-y-1 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[11px] text-muted-foreground">The taker's record</p>
          <TrustLine stats={workerTrust} />
          {workerTrust && workerTrust.warnings > 0 && (
            <p className="text-[11px] text-amber-200">
              {workerTrust.warnings} active warning
              {workerTrust.warnings === 1 ? "" : "s"}. Warn or block from the bounty card.
            </p>
          )}
        </div>

        <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          {submission?.note ? (
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/90">
              {submission.note}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {bounty.submission_note || "No note — check the proof below."}
            </p>
          )}
          {(submission?.links ?? []).length > 0 && (
            <ul className="space-y-1">
              {(submission?.links ?? []).map((link) => {
                const href = proofHref(link);
                if (!href) return null;
                return (
                  <li key={link}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-center gap-1 truncate text-[12px] font-medium text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="truncate">{link}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
          {(submission?.media_urls ?? []).length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {(submission?.media_urls ?? []).map((url) => {
                const href = proofHref(url);
                if (!href) return null;
                return (
                  <a
                    key={url}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block overflow-hidden rounded-lg border border-white/10"
                  >
                    <img
                      src={href}
                      alt="Submitted proof"
                      loading="lazy"
                      decoding="async"
                      className="aspect-video w-full object-cover"
                    />
                  </a>
                );
              })}
            </div>
          )}
          {overdue && (
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-200">
              <AlertTriangle className="h-3.5 w-3.5" />
              The review window has passed. This pays out on its own very soon.
            </p>
          )}
        </div>

        <Textarea
          placeholder="Optional note for the worker"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={400}
          className="glass border-white/10"
        />

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => void decide(false)}
            disabled={busy !== null || rejectionsLeft === 0}
            className="h-11 flex-1 border-white/10 bg-white/[0.03] text-xs font-bold"
          >
            {busy === "reject" ? (
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
            ) : rejectionsLeft === 0 ? (
              "Review limit reached"
            ) : (
              <>
                <X className="h-4 w-4" /> Ask for more
                <span className="text-muted-foreground">({rejectionsLeft} left)</span>
              </>
            )}
          </Button>
          <Button
            onClick={() => void decide(true)}
            disabled={busy !== null}
            className="h-11 flex-1 gap-1.5 bg-primary text-xs font-bold text-primary-foreground shadow-md"
          >
            {busy === "approve" ? (
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <>
                <CircleCheck className="h-4 w-4" />
                Approve · pay {formatNumber(bounty.prize_paws ?? 0)}
              </>
            )}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Approving releases the escrowed {formatNumber(bounty.prize_paws ?? 0)} Paws to the worker
          and closes the bounty. Asking for more keeps the Paws in escrow and returns the bounty to
          the pool.
        </p>
      </div>
    </ActionDialog>
  );
}

/**
 * Backing out costs money, so the dialog is a receipt: it names the fee, who
 * gets what, and why the fee is bigger once somebody is already working.
 */
export function CancelBountyDialog({
  bounty,
  open,
  onOpenChange,
  onCancelled,
}: {
  bounty: BountyRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelled: () => void;
}) {
  const rules = useBountyRules().data;
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const prize = Number(bounty.prize_paws ?? 0);
  const taken = ["taken", "submitted"].includes(bounty.state ?? "open");
  const fee = cancelFee(prize, taken, rules ?? undefined);
  const refund = Math.max(prize - fee, 0);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await cancelBounty(bounty.id, reason);
      toast.warning(`Cancelled — ${formatNumber(result.fee)} Paws fee`, {
        description: `${formatNumber(result.refund)} Paws came back to your wallet.`,
      });
      setReason("");
      onCancelled();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't cancel that bounty");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ActionDialog open={open} onOpenChange={onOpenChange} title="Cancel this bounty?">
      <div className="space-y-3">
        <div className="space-y-2 rounded-xl border border-destructive/25 bg-destructive/[0.07] p-3">
          <p className="flex items-center gap-1.5 text-xs font-bold text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Cancelling is not free
          </p>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            A {taken ? "taken" : "live"} bounty that gets pulled still costs the network a slot, so{" "}
            <strong className="text-foreground">{formatNumber(fee)} Paws</strong> is kept as the
            fee.{" "}
            {isEscrowBounty(bounty)
              ? `${formatNumber(refund)} Paws returns to your wallet right away.`
              : "The bounty simply ends."}
            {taken &&
              " The fee doubles once somebody is already working, which is what you are paying now."}
          </p>
        </div>

        <Textarea
          placeholder="Why are you pulling it? (optional, the worker sees this)"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={280}
          className="glass border-white/10"
        />

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-11 flex-1 border-white/10 bg-white/[0.03] text-xs font-bold"
          >
            Keep it live
          </Button>
          <Button
            onClick={() => void confirm()}
            disabled={busy}
            className="h-11 flex-1 gap-1.5 border-0 bg-destructive text-xs font-bold text-destructive-foreground hover:bg-destructive/90"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                Pay {formatNumber(fee)} & cancel
              </>
            )}
          </Button>
        </div>
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Check className="h-3 w-3" />
          Letting the deadline pass is free. The Paws come back with no fee.
        </p>
      </div>
    </ActionDialog>
  );
}
