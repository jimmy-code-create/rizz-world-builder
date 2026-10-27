import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Bounties with Paws held in escrow.
 *
 * The whole contract lives in `supabase/migrations/20261107000000_bounty_escrow.sql`:
 * posting takes the prize out of the poster's wallet, taking it is exclusive,
 * submitting attaches proof, approval pays the worker, a rejection puts it back
 * in the pool, and cancelling costs a fine. This module is the browser's half —
 * the shapes, the fee arithmetic the warning dialog shows before the database
 * charges it, and one wrapper per RPC so a page never hand-rolls an argument
 * name.
 *
 * Rules are duplicated here only as a fallback for the moment between a deploy
 * and the migration being applied; `useBountyRules()` reads the real numbers
 * from the database whenever it can.
 */

export type BountyState = "open" | "taken" | "submitted" | "paid" | "cancelled" | "expired";
export type EscrowState = "none" | "held" | "paid" | "refunded";
export type SubmissionStatus = "submitted" | "approved" | "rejected" | "withdrawn";

export type BountyRules = {
  minPrize: number;
  maxPrize: number;
  feePercent: number;
  feeMin: number;
  takenFeeMultiplier: number;
  reviewHours: number;
  minHours: number;
  maxHours: number;
  maxRejections: number;
  maxLinks: number;
  maxMedia: number;
};

export const BOUNTY_RULES: BountyRules = {
  minPrize: 25,
  maxPrize: 250_000,
  feePercent: 10,
  feeMin: 5,
  takenFeeMultiplier: 2,
  reviewHours: 72,
  minHours: 1,
  maxHours: 720,
  maxRejections: 3,
  maxLinks: 5,
  maxMedia: 4,
};

export type BountyCreator = {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bounties_completed?: number | null;
  bounties_cancelled?: number | null;
};

export type BountyRow = {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  media_url: string | null;
  claim_limit: number;
  claim_count: number;
  expires_at: string;
  created_at: string;
  requirements?: string | null;
  prize_paws?: number;
  escrow_state?: EscrowState;
  state?: BountyState;
  assigned_to?: string | null;
  assigned_at?: string | null;
  submission_note?: string | null;
  review_deadline?: string | null;
  reject_count?: number;
  released_count?: number;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  creator?: BountyCreator | null;
};

export type BountySubmission = {
  id: string;
  drop_id: string;
  user_id: string;
  note: string | null;
  links: string[];
  media_urls: string[];
  status: SubmissionStatus;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type ViewerRole = "creator" | "worker" | "guest";

export const BOUNTY_SUBMISSION_BUCKET = "drops";

/** A bounty with a prize is escrowed; without one it is still an open call. */
export function isEscrowBounty(row: Pick<BountyRow, "prize_paws">): boolean {
  return Number(row.prize_paws ?? 0) > 0;
}

/**
 * The fine for backing out, mirrored from `public.bounty_fee()` so the warning
 * dialog can name the exact amount the database will charge. Doubles once
 * somebody is already on the bounty, and never exceeds the prize itself.
 */
export function cancelFee(prize: number, taken: boolean, rules: BountyRules = BOUNTY_RULES): number {
  const base = Math.max(rules.feeMin, Math.ceil((prize * rules.feePercent) / 100));
  return Math.min(prize, base * (taken ? rules.takenFeeMultiplier : 1));
}

/** Whose side of the deal a viewer is on. */
export function viewerRole(row: Pick<BountyRow, "creator_id" | "assigned_to">, userId?: string | null): ViewerRole {
  if (!userId) return "guest";
  if (row.creator_id === userId) return "creator";
  if (row.assigned_to && row.assigned_to === userId) return "worker";
  return "guest";
}

/**
 * The bounty's state, derived when the column is missing (migration not applied
 * yet) so old open calls read correctly instead of as "cancelled".
 */
export function bountyState(row: BountyRow): BountyState {
  const prize = Number(row.prize_paws ?? 0);
  if (prize <= 0) return "open";
  return (row.state ?? (row.assigned_to ? "taken" : "open")) as BountyState;
}

export function canTakeBounty(row: BountyRow, userId?: string | null, now: number = Date.now()): boolean {
  if (!userId) return false;
  if (!isEscrowBounty(row)) return false;
  if (row.creator_id === userId) return false;
  if (row.assigned_to) return false;
  if (bountyState(row) !== "open" && bountyState(row) !== "taken") return false;
  if (row.escrow_state && row.escrow_state !== "held") return false;
  return new Date(row.expires_at).getTime() > now;
}

/** Minutes left, for the card's clock and the "ending soon" treatment. */
export function minutesLeft(until: string | null | undefined, now: number = Date.now()): number {
  if (!until) return 0;
  return Math.max(0, Math.round((new Date(until).getTime() - now) / 60_000));
}

export function isEndingSoon(row: BountyRow, now: number = Date.now()): boolean {
  const left = minutesLeft(row.expires_at, now);
  return left > 0 && left <= 180;
}

/** The review window on a submission that is waiting for a decision. */
export function reviewOverdue(row: Pick<BountyRow, "review_deadline">, now: number = Date.now()): boolean {
  if (!row.review_deadline) return false;
  return new Date(row.review_deadline).getTime() <= now;
}

export function canCancelBounty(row: BountyRow, userId?: string | null): boolean {
  if (!userId || row.creator_id !== userId) return false;
  if (!isEscrowBounty(row)) return false;
  if ((row.escrow_state ?? "none") !== "held") return false;
  return ["open", "taken", "submitted"].includes(bountyState(row));
}

export function canReviewBounty(row: BountyRow, userId?: string | null): boolean {
  return canCancelBounty(row, userId) && bountyState(row) === "submitted";
}

export function canSubmitProof(row: BountyRow, userId?: string | null): boolean {
  if (!userId || row.assigned_to !== userId) return false;
  if ((row.escrow_state ?? "none") !== "held") return false;
  const state = bountyState(row);
  return state === "taken" || state === "open";
}

export function canReleaseBounty(row: BountyRow, userId?: string | null): boolean {
  return canSubmitProof(row, userId);
}

/**
 * One line for the state chip. Kept here (not in the card) because three
 * surfaces quote it: the board, the notification deep link and the profile stat.
 */
export function bountyStateLabel(row: BountyRow): string {
  switch (bountyState(row)) {
    case "taken":
      return "In progress";
    case "submitted":
      return "In review";
    case "paid":
      return "Paid";
    case "cancelled":
      return "Cancelled";
    case "expired":
      return "Expired";
    default:
      return isEscrowBounty(row) ? "Open" : "Open call";
  }
}

/** What the reader is being asked to do next, in their own words. */
export function bountyNextStep(row: BountyRow, role: ViewerRole, userId?: string | null): string {
  const state = bountyState(row);
  if (!isEscrowBounty(row)) return "Claim it and the Paws are yours immediately.";
  if (state === "paid") return `Paid out to the member who did the work.`;
  if (state === "cancelled") return row.cancel_reason || "The poster cancelled this bounty.";
  if (state === "expired") return "The deadline passed, so the Paws went back to the poster.";
  if (state === "submitted") {
    if (role === "creator") return "Work is in — approve it, or send it back with a note.";
    if (viewerRole(row, userId) === "worker") return "Waiting on the poster. If they stall, it pays out by itself.";
    return "Submitted and waiting for review.";
  }
  if (state === "taken") {
    if (role === "worker") return "You are on it — submit your work with proof when it is done.";
    if (role === "creator") return "Somebody is on it. You can still cancel, at a higher fee.";
    return "Somebody is already on it.";
  }
  return `Paws are held in escrow. Finish it and they are yours.`;
}

/** Bounties the viewer posted, took, or has to act on — the "your desk" rail. */
export function bountiesNeedingYou(rows: BountyRow[], userId?: string | null): BountyRow[] {
  if (!userId) return [];
  return rows.filter((row) => {
    if (!isEscrowBounty(row)) return false;
    const role = viewerRole(row, userId);
    if (role === "creator") return canReviewBounty(row, userId) || canCancelBounty(row, userId);
    if (role === "worker") return canSubmitProof(row, userId) || bountyState(row) === "submitted";
    return false;
  });
}

// ---------------------------------------------------------------- RPC calls

type RpcResult = Record<string, unknown> | null;

async function callBountyRpc<T = RpcResult>(
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await (supabase.rpc as any)(name, args);
  if (error) throw new Error(error.message);
  return (data ?? null) as T;
}

export async function postPawsBounty(input: {
  title: string;
  description?: string | null;
  requirements?: string | null;
  prize: number;
  hours: number;
  mediaUrl?: string | null;
}): Promise<{ id: string; prize: number; balance: number }> {
  const result = await callBountyRpc<Record<string, unknown>>("post_paws_bounty", {
    _title: input.title.trim(),
    _description: input.description?.trim() || null,
    _requirements: input.requirements?.trim() || null,
    _prize: Math.round(input.prize),
    _hours: Math.round(input.hours),
    _media_url: input.mediaUrl ?? null,
  });
  return {
    id: String(result?.id ?? ""),
    prize: Number(result?.prize ?? input.prize),
    balance: Number(result?.balance ?? 0),
  };
}

export async function takeBounty(dropId: string): Promise<{ status: string; prize: number }> {
  const result = await callBountyRpc<Record<string, unknown>>("take_bounty", { _drop_id: dropId });
  return { status: String(result?.status ?? "taken"), prize: Number(result?.prize ?? 0) };
}

export async function releaseBounty(dropId: string, reason?: string | null): Promise<void> {
  await callBountyRpc("release_bounty", { _drop_id: dropId, _reason: reason?.trim() || null });
}

export async function submitBountyProof(input: {
  dropId: string;
  note?: string | null;
  links?: string[];
  mediaUrls?: string[];
}): Promise<{ reviewDeadline: string | null }> {
  const result = await callBountyRpc<Record<string, unknown>>("submit_bounty_proof", {
    _drop_id: input.dropId,
    _note: input.note?.trim() || null,
    _links: input.links ?? [],
    _media: input.mediaUrls ?? [],
  });
  return { reviewDeadline: (result?.review_deadline as string | null) ?? null };
}

export async function reviewBountySubmission(input: {
  dropId: string;
  approve: boolean;
  note?: string | null;
}): Promise<{ status: string; payout: number }> {
  const result = await callBountyRpc<Record<string, unknown>>("review_bounty_submission", {
    _drop_id: input.dropId,
    _approve: input.approve,
    _note: input.note?.trim() || null,
  });
  return { status: String(result?.status ?? ""), payout: Number(result?.payout ?? 0) };
}

export async function cancelBounty(
  dropId: string,
  reason?: string | null,
): Promise<{ fee: number; refund: number; balance: number }> {
  const result = await callBountyRpc<Record<string, unknown>>("cancel_bounty", {
    _drop_id: dropId,
    _reason: reason?.trim() || null,
  });
  return {
    fee: Number(result?.fee ?? 0),
    refund: Number(result?.refund ?? 0),
    balance: Number(result?.balance ?? 0),
  };
}

export async function releaseOverduePayout(dropId: string): Promise<{ payout: number }> {
  const result = await callBountyRpc<Record<string, unknown>>("release_overdue_bounty_payout", {
    _drop_id: dropId,
  });
  return { payout: Number(result?.payout ?? 0) };
}

/**
 * Housekeeping, run when the board opens: open bounties past their deadline
 * return their Paws to the poster. Returns how many were settled.
 */
export async function settleExpiredBounties(): Promise<number> {
  try {
    const result = await callBountyRpc<number | Record<string, unknown>>("settle_expired_bounties", {});
    return typeof result === "number" ? result : Number((result as Record<string, unknown>) ?? 0);
  } catch {
    // The migration may not be applied yet; housekeeping is never fatal.
    return 0;
  }
}

// ---------------------------------------------------------------- queries

/** The database's copy of the rules, with the local constants as fallback. */
export function useBountyRules() {
  return useQuery({
    queryKey: ["bounty-rules"],
    staleTime: 30 * 60_000,
    queryFn: async (): Promise<BountyRules> => {
      try {
        const raw = await callBountyRpc<Record<string, unknown>>("bounty_escrow_config", {});
        if (!raw) return BOUNTY_RULES;
        return {
          minPrize: Number(raw.min_prize ?? BOUNTY_RULES.minPrize),
          maxPrize: Number(raw.max_prize ?? BOUNTY_RULES.maxPrize),
          feePercent: Number(raw.fee_percent ?? BOUNTY_RULES.feePercent),
          feeMin: Number(raw.fee_min ?? BOUNTY_RULES.feeMin),
          takenFeeMultiplier: Number(raw.taken_fee_multiplier ?? BOUNTY_RULES.takenFeeMultiplier),
          reviewHours: Number(raw.review_hours ?? BOUNTY_RULES.reviewHours),
          minHours: Number(raw.min_hours ?? BOUNTY_RULES.minHours),
          maxHours: Number(raw.max_hours ?? BOUNTY_RULES.maxHours),
          maxRejections: Number(raw.max_rejections ?? BOUNTY_RULES.maxRejections),
          maxLinks: Number(raw.max_links ?? BOUNTY_RULES.maxLinks),
          maxMedia: Number(raw.max_media ?? BOUNTY_RULES.maxMedia),
        };
      } catch {
        return BOUNTY_RULES;
      }
    },
  });
}

/** Proof for the bounties the viewer owns or is working on. */
export function useBountySubmissions(dropIds: string[]) {
  const key = [...dropIds].sort().join(",");
  return useQuery({
    queryKey: ["bounty-submissions", key],
    enabled: dropIds.length > 0,
    queryFn: async (): Promise<BountySubmission[]> => {
      // `bounty_submissions` ships with the escrow migration, so the generated
      // Supabase types predate it — same cast the realm RPC helper uses.
      const { data, error } = await (supabase.from as any)("bounty_submissions")
        .select("*")
        .in("drop_id", dropIds)
        .order("created_at", { ascending: false });
      if (error) return [];
      return (data ?? []) as BountySubmission[];
    },
  });
}

/** The newest submission per bounty, which is the one a reviewer acts on. */
export function latestSubmission(
  submissions: BountySubmission[],
  dropId: string,
): BountySubmission | null {
  return submissions.find((row) => row.drop_id === dropId) ?? null;
}
