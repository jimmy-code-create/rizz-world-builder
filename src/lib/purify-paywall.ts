/**
 * The paywall sheet, opened by an event so any gate in the app can ask for it
 * without importing a component (the same pattern as `rizz:open-side-discussion`).
 *
 * Two rules keep it from becoming an interstitial:
 *
 *  - a *deliberate* tap on a locked action always opens it — the member asked
 *    for the thing, so they get the explanation;
 *  - anything *proactive* (an offer nobody asked for) is capped at once every
 *    seven days after the member says "Maybe later".
 *
 * The cap lives in localStorage because it is a preference about nagging, not
 * entitlement — entitlement is `profiles.purify_until` and stays server-side.
 */
export const PURIFY_PAYWALL_EVENT = "rizz:open-purify-paywall";

/** After "Maybe later", a proactive offer waits a week. */
export const PURIFY_PAYWALL_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

const LAST_SEEN_KEY = "rizz.purify.paywall.seen";

export type PurifyPaywallDetail = {
  /** What was tapped, e.g. "escrow bounty". Absent means a proactive offer. */
  reason?: string;
};

/** Ask for the sheet. A reason makes the open deliberate and bypasses the cap. */
export function openPurifyPaywall(reason?: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<PurifyPaywallDetail>(PURIFY_PAYWALL_EVENT, { detail: { reason } }),
  );
}

function readLastSeen(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(LAST_SEEN_KEY);
    const value = raw ? Number(raw) : 0;
    return Number.isFinite(value) ? value : 0;
  } catch {
    // Private mode: no storage, so the cap simply never blocks anything.
    return 0;
  }
}

/** The sheet was shown (and dismissed): restart the seven-day window. */
export function markPaywallSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_SEEN_KEY, String(Date.now()));
  } catch {
    /* nothing to remember with */
  }
}

/** True when an unasked-for offer is allowed right now. */
export function paywallCapAllows(now: number = Date.now()): boolean {
  const last = readLastSeen();
  if (!last) return true;
  return now - last >= PURIFY_PAYWALL_COOLDOWN_MS;
}
