/**
 * Trust scores, the taker cancellation fee, and the small rules the two halves
 * of a bounty have to agree on.
 *
 * Kept free of imports on purpose: `tests/bounty-trust.test.mjs` loads this
 * module directly with Node's type stripping, so the arithmetic the UI shows is
 * the arithmetic that gets tested. The numbers are mirrored in
 * `supabase/migrations/20261108000000_bounty_trust.sql`; change both together.
 */

export type TrustLevel = "new" | "trusted" | "top";
export type MinTrustLevel = "any" | TrustLevel;

/**
 * Three active warnings and taking bounties is closed until an appeal lands.
 * Pending appeals do not lower the count, so a block only lifts on a decision.
 */
export const AUTO_BLOCK_WARNINGS = 3;

export const TRUST_THRESHOLDS = {
  trustedCompleted: 3,
  trustedMaxWarnings: 1,
  topCompleted: 10,
  topMaxWarnings: 0,
} as const;

export const TRUST_LEVEL_LABEL: Record<TrustLevel, string> = {
  new: "New",
  trusted: "Trusted",
  top: "Top",
};

/** Higher is better; used for "at least this level" checks. */
export const TRUST_LEVEL_ORDER: Record<TrustLevel, number> = {
  new: 0,
  trusted: 1,
  top: 2,
};

export const MIN_TRUST_LABEL: Record<MinTrustLevel, string> = {
  any: "Anyone can take it",
  trusted: "Trusted or Top",
  top: "Top only",
};

export const MIN_TRUST_OPTIONS: readonly MinTrustLevel[] = ["any", "trusted", "top"] as const;

export type BountyTrust = {
  completed: number;
  warnings: number;
  level: TrustLevel;
};

function wholeNumber(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.floor(number);
}

/** Approved bounty payouts minus nothing — warnings are a separate axis. */
export function trustLevel(completed: unknown, warnings: unknown): TrustLevel {
  const finished = wholeNumber(completed);
  const flagged = wholeNumber(warnings);
  if (finished >= TRUST_THRESHOLDS.topCompleted && flagged <= TRUST_THRESHOLDS.topMaxWarnings) {
    return "top";
  }
  if (
    finished >= TRUST_THRESHOLDS.trustedCompleted &&
    flagged <= TRUST_THRESHOLDS.trustedMaxWarnings
  ) {
    return "trusted";
  }
  return "new";
}

export function trustStats(completed: unknown, warnings: unknown): BountyTrust {
  const finished = wholeNumber(completed);
  const flagged = wholeNumber(warnings);
  return { completed: finished, warnings: flagged, level: trustLevel(finished, flagged) };
}

export function warningWord(count: unknown): string {
  return wholeNumber(count) === 1 ? "warning" : "warnings";
}

/** "3 completed · 0 warnings" — the line every surface shows. */
export function trustLine(completed: unknown, warnings?: unknown): string {
  const stats =
    warnings === undefined
      ? (completed as BountyTrust)
      : trustStats(completed as number, warnings as number);
  return `${stats.completed} completed · ${stats.warnings} ${warningWord(stats.warnings)}`;
}

/** Does a taker at `level` clear the poster's minimum? */
export function meetsMinTrust(level: TrustLevel, min: MinTrustLevel): boolean {
  if (min === "any") return true;
  return TRUST_LEVEL_ORDER[level] >= TRUST_LEVEL_ORDER[min];
}

export function isAutoBlocked(warnings: unknown): boolean {
  return wholeNumber(warnings) >= AUTO_BLOCK_WARNINGS;
}

/** How many more active warnings would close the account. */
export function warningsUntilBlock(warnings: unknown): number {
  return Math.max(0, AUTO_BLOCK_WARNINGS - wholeNumber(warnings));
}

// ------------------------------------------------------------ cancellation fee

export type FeeRecipient = "creator" | "platform";

/** Charged to a taker who hands the bounty back or misses the deadline. */
export const CANCEL_FEE = 1000;

/** Where the fee goes. "creator" compensates the poster; "platform" keeps it. */
export const FEE_RECIPIENT: FeeRecipient = "creator";

export const FEE_RECIPIENTS: readonly FeeRecipient[] = ["creator", "platform"] as const;

export type TakerCancelFee = {
  amount: number;
  recipient: FeeRecipient;
};

export function takerCancelFee(recipient: FeeRecipient = FEE_RECIPIENT): TakerCancelFee {
  return { amount: CANCEL_FEE, recipient };
}

/** Taking is blocked below the fee, so a hand-back can always be charged. */
export function canAffordTakerCancelFee(balance: unknown): boolean {
  return wholeNumber(balance) >= CANCEL_FEE;
}

export function feeRecipientLabel(recipient: FeeRecipient): string {
  return recipient === "platform" ? "RIZZ" : "the creator";
}

export function feeRecipientSentence(recipient: FeeRecipient): string {
  return recipient === "platform"
    ? "The fee goes to RIZZ."
    : "The fee goes to the poster as compensation.";
}
