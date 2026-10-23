import { ChubbyDecoration, type ChubbyVariant } from "./ChubbyDecoration";
import { WebProfileEffect, type WebVariant } from "./WebProfileEffect";

/**
 * The single map between a database slug and the art that draws it.
 *
 * The catalogue lives in the database, the drawings live in code, and this table
 * is the contract between them: a slug that isn't listed here simply renders
 * nothing, so a half-seeded catalogue can never paint a broken box on a profile.
 */
type EffectArt =
  | { kind: "avatar"; variant: ChubbyVariant }
  | { kind: "profile"; variant: WebVariant };

export const EFFECT_ART: Record<string, EffectArt> = {
  "fx-chubby-cloud": { kind: "avatar", variant: "cloud" },
  "fx-chubby-paws": { kind: "avatar", variant: "paws" },
  "fx-chubby-bloom": { kind: "avatar", variant: "bloom" },
  "fx-web-slinger": { kind: "profile", variant: "slinger" },
  "fx-web-veil": { kind: "profile", variant: "veil" },
};

export function hasEffectArt(slug: string | null | undefined): boolean {
  return !!slug && Object.prototype.hasOwnProperty.call(EFFECT_ART, slug);
}

/** The frame worn around an avatar, or nothing when the slug has no art. */
export function AvatarDecorationArt({
  slug,
  animated = true,
  className,
}: {
  slug: string | null | undefined;
  animated?: boolean;
  className?: string;
}) {
  const art = slug ? EFFECT_ART[slug] : undefined;
  if (!art || art.kind !== "avatar") return null;
  return <ChubbyDecoration variant={art.variant} animated={animated} className={className} />;
}

/** The scene laid over a profile header, or nothing when the slug has no art. */
export function ProfileEffectArt({
  slug,
  animated = true,
  className,
}: {
  slug: string | null | undefined;
  animated?: boolean;
  className?: string;
}) {
  const art = slug ? EFFECT_ART[slug] : undefined;
  if (!art || art.kind !== "profile") return null;
  return <WebProfileEffect variant={art.variant} animated={animated} className={className} />;
}
