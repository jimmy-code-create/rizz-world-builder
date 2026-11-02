import type { Badge } from "@/lib/badges";
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
/** The same price in button form — one source, so the two can never disagree. */
export const PURIFY_PRICE_SHORT = PURIFY_PRICE_LABEL.replace(/\s*\/\s*month$/, "/mo");

/** Chat uploads: 10 MB on the free tier, 50 MB with Purify. */
export const FREE_CHAT_UPLOAD_BYTES = 10 * 1024 * 1024;
export const PURIFY_CHAT_UPLOAD_BYTES = 50 * 1024 * 1024;
/** Today's cap, kept while Purify is not enforced so nothing shrinks on launch day. */
export const LEGACY_CHAT_UPLOAD_BYTES = 15 * 1024 * 1024;

/**
 * Every perk the upsell sells, in one place so the page, the sheet and the
 * settings copy cannot drift apart. Each one is a real gate in the code:
 * the escrow take in `BountyCard`, the super switch in `PostCard`, the
 * animated RIZZ faces in `CatEmoji`, the injected mark in `withPurifyBadge`,
 * the profile-gradient/banner gates, the GIF picker, the upload cap and the
 * shared-emoji upload in realm settings.
 *
 * The first three are the sheet's set: the ones that make the upgrade felt in
 * the first minute. The page lists all of them.
 */
export type PurifyPerkIcon =
  | "bounty"
  | "super"
  | "animated"
  | "badge"
  | "gradient"
  | "banner"
  | "gif"
  | "upload"
  | "emoji";

export type PurifyPerk = {
  id: string;
  icon: PurifyPerkIcon;
  title: string;
  detail: string;
};

export const PURIFY_PERKS: PurifyPerk[] = [
  {
    id: "escrow",
    icon: "bounty",
    title: "Take escrow bounties",
    detail:
      "Take a drop like a 500-Paws sticker job: the prize is already locked in escrow. Open calls stay free for everyone.",
  },
  {
    id: "super",
    icon: "super",
    title: "Super reactions",
    detail:
      "Send the glowing ✦ version of any reaction — it leads the pill row and sends the RIZZY cat across the post.",
  },
  {
    id: "animated",
    icon: "animated",
    title: "Animated RIZZ emoji",
    detail:
      "All twelve cat faces move — ears twitch, whiskers sway, expressions loop. Without Purify the same faces arrive as still stickers.",
  },
  {
    id: "badge",
    icon: "badge",
    title: "Purify profile badge",
    detail: "The amethyst crest sits beside your name on posts, DMs and every profile surface.",
  },
  {
    id: "gradient",
    icon: "gradient",
    title: "Profile gradients",
    detail:
      "Wear any of the 16 gradients across the whole profile — not just the banner box. Pick one, or mix your own two colours.",
  },
  {
    id: "banner",
    icon: "banner",
    title: "Banner photos",
    detail: "Put a real photo behind your avatar instead of the default frame.",
  },
  {
    id: "gif",
    icon: "gif",
    title: "GIFs everywhere",
    detail: "Drop a GIF into a post, a DM, a group or realm chat — no more still-only replies.",
  },
  {
    id: "upload",
    icon: "upload",
    title: "Bigger uploads",
    detail: "Send photos up to 50 MB in every chat instead of the free 10 MB.",
  },
  {
    id: "emoji",
    icon: "emoji",
    title: "Realm emoji perks",
    detail:
      "Upload shared emoji for your realm — all twelve faces or your own art — so the whole community can use them in any chat.",
  },
];

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

/**
 * The subscriber mark itself. It is not a `badges` row: it exists only while the
 * entitlement does, so it can never be awarded or kept after a subscription
 * ends. The sprite carries its own amethyst halo and inner vignette.
 */
export const PURIFY_BADGE: Badge = {
  id: "badge:purify",
  slug: "purify",
  name: "Purify",
  description: "Purified. The amethyst crest only subscribers carry.",
  icon: "purify",
  color: "#b47cff",
  rarity: "mythic",
};

export type PurifySource = { purify_until?: string | null } | null | undefined;

/**
 * Put Purify in front of the badges a profile shows. Call it with the capped
 * list so the subscriber mark is never the badge that gets sliced off.
 */
export function withPurifyBadge(badges: Badge[], active: boolean): Badge[] {
  if (!active) return badges;
  return [PURIFY_BADGE, ...badges.filter((badge) => badge.slug !== PURIFY_BADGE.slug)];
}

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
