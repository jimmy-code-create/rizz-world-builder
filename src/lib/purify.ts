import { useAuth } from "@/lib/auth";

/**
 * Purify — the $1/month tier.
 *
 * One rule: a member is Pure while `profiles.purify_until` is in the future.
 * The timestamp is written only by the Stripe webhook (a database trigger
 * rejects client writes), so every surface can share this check without ever
 * asking Stripe.
 *
 * Enforcement is behind `VITE_PURIFY_ENFORCED` on purpose: the gates ship with
 * the code, but the app stays free until billing is connected. Flip the flag
 * after the Stripe keys are set.
 */
export const PURIFY_PRICE_CENTS = 100;
export const PURIFY_PRICE_LABEL = "$1 / month";

/** Chat uploads: 10 MB on the free tier, 50 MB with Purify. */
export const FREE_CHAT_UPLOAD_BYTES = 10 * 1024 * 1024;
export const PURIFY_CHAT_UPLOAD_BYTES = 50 * 1024 * 1024;
/** Today's cap, kept while Purify is not enforced so nothing shrinks on launch day. */
export const LEGACY_CHAT_UPLOAD_BYTES = 15 * 1024 * 1024;

export const PURIFY_BENEFITS: { title: string; detail: string }[] = [
  {
    title: "Gradient profiles",
    detail: "Paint your whole profile with any of the 16 gradients, not just the banner box.",
  },
  {
    title: "Banner photos",
    detail: "Upload a real banner image behind your avatar instead of the default frame.",
  },
  {
    title: "GIFs everywhere",
    detail: "Drop GIFs into posts, DMs, groups and realm chat.",
  },
  {
    title: "Bigger uploads",
    detail: "Send photos up to 50 MB instead of 10 MB in every chat.",
  },
  {
    title: "Purify mark",
    detail: "A quiet badge next to your name on every profile surface.",
  },
];

export type PurifySource = { purify_until?: string | null } | null | undefined;

/** True while the paid period is still running. */
export function isPurifyActive(profile: PurifySource): boolean {
  const until = profile?.purify_until;
  if (!until) return false;
  const time = new Date(until).getTime();
  return Number.isFinite(time) && time > Date.now();
}

/** Billing is connected in production; until then every gate stays open. */
export function isPurifyEnforced(): boolean {
  return import.meta.env.VITE_PURIFY_ENFORCED === "1";
}

/**
 * Whether this member may use a Purify-only feature *right now*. Grandfathering
 * is implicit: nothing is stripped from an existing profile — only new
 * gradient/banner changes ask for Purify.
 */
export function canUsePurify(profile: PurifySource): boolean {
  return !isPurifyEnforced() || isPurifyActive(profile);
}

export function chatUploadLimitBytes(profile: PurifySource): number {
  if (!isPurifyEnforced()) return LEGACY_CHAT_UPLOAD_BYTES;
  return isPurifyActive(profile) ? PURIFY_CHAT_UPLOAD_BYTES : FREE_CHAT_UPLOAD_BYTES;
}

export function formatUploadLimit(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

export function usePurify() {
  const { profile } = useAuth();
  return {
    active: isPurifyActive(profile),
    allowed: canUsePurify(profile),
    enforced: isPurifyEnforced(),
    until: profile?.purify_until ?? null,
  };
}
