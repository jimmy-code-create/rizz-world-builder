import { cn } from "@/lib/utils";
import { ChubbyDecoration, type ChubbyVariant } from "./ChubbyDecoration";
import { WebProfileEffect, type WebVariant } from "./WebProfileEffect";
import "./effects.css";

/**
 * The single map between a database slug and the art that draws it.
 *
 * The catalogue lives in the database, the drawings live in code, and this table
 * is the contract between them: a slug that isn't listed here simply renders
 * nothing, so a half-seeded catalogue can never paint a broken box on a profile.
 *
 * Two of the pieces are render cut from the member-supplied animation clips:
 *   avatar-image  — a transparent PNG of the ivory frame, sized around the photo.
 *   profile-video — the petal clip, screened over the whole profile at low opacity
 *                   (its black plate disappears in the blend, so nothing needs an
 *                   alpha channel and the effect stays light).
 */
type EffectArt =
  | { kind: "avatar"; variant: ChubbyVariant }
  | { kind: "profile"; variant: WebVariant }
  | { kind: "avatar-image"; src: string; scale: number }
  | { kind: "profile-video"; src: string; poster: string; opacity: number };

export const EFFECT_ART: Record<string, EffectArt> = {
  "fx-chubby-cloud": { kind: "avatar", variant: "cloud" },
  "fx-chubby-paws": { kind: "avatar", variant: "paws" },
  "fx-chubby-bloom": { kind: "avatar", variant: "bloom" },
  "fx-web-slinger": { kind: "profile", variant: "slinger" },
  "fx-web-veil": { kind: "profile", variant: "veil" },
  "fx-ivory-filigree": {
    kind: "avatar-image",
    src: "/effects/fx-ivory-filigree.png",
    // The frame's square opening is ~59% of its width; 1.5 puts the opening
    // just inside the avatar edge, so the filigree hugs the photo.
    scale: 1.5,
  },
  "fx-petal-bloom": {
    kind: "profile-video",
    src: "/effects/fx-petal-bloom.mp4",
    poster: "/effects/fx-petal-bloom-poster.jpg",
    // Screen blend drops the clip's black plate; the opacity keeps it a wash of
    // petals over the page instead of a video laid on top of the text.
    opacity: 0.42,
  },
};

export function hasEffectArt(slug: string | null | undefined): boolean {
  return !!slug && Object.prototype.hasOwnProperty.call(EFFECT_ART, slug);
}

export function artKind(slug: string | null | undefined) {
  return slug ? EFFECT_ART[slug]?.kind : undefined;
}

/** Effects that are drawn across the whole profile page, not just the banner. */
export function isPageProfileEffect(slug: string | null | undefined): boolean {
  return artKind(slug) === "profile-video";
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
  if (!art) return null;

  if (art.kind === "avatar-image") {
    return (
      <span
        aria-hidden="true"
        className={cn("pointer-events-none absolute inset-0 block", className)}
      >
        <img
          src={art.src}
          alt=""
          draggable={false}
          decoding="async"
          className={cn(
            "absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 select-none",
            animated && "fx-frame-drift",
          )}
          style={{
            width: `${art.scale * 100}%`,
            filter: "drop-shadow(0 4px 14px rgba(0,0,0,0.45))",
          }}
        />
      </span>
    );
  }

  if (art.kind !== "avatar") return null;
  return <ChubbyDecoration variant={art.variant} animated={animated} className={className} />;
}

/** The scene laid over a profile, or nothing when the slug has no art. */
export function ProfileEffectArt({
  slug,
  animated = true,
  className,
  intensity = "banner",
}: {
  slug: string | null | undefined;
  animated?: boolean;
  className?: string;
  /** "page" is the quieter wash used across the whole profile page. */
  intensity?: "banner" | "page";
}) {
  const art = slug ? EFFECT_ART[slug] : undefined;
  if (!art) return null;

  if (art.kind === "profile-video") {
    const opacity = intensity === "page" ? art.opacity * 0.72 : art.opacity;
    const style = { mixBlendMode: "screen" as const, opacity };

    // A still is enough when motion is unwelcome, and it keeps the shop cards
    // from decoding a clip per tile.
    if (!animated) {
      return (
        <img
          src={art.poster}
          alt=""
          aria-hidden="true"
          draggable={false}
          className={cn("pointer-events-none absolute inset-0 h-full w-full object-cover", className)}
          style={style}
        />
      );
    }

    return (
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster={art.poster}
        aria-hidden="true"
        disablePictureInPicture
        className={cn("pointer-events-none absolute inset-0 h-full w-full object-cover", className)}
        style={style}
      >
        <source src={art.src} type="video/mp4" />
      </video>
    );
  }

  if (art.kind !== "profile") return null;
  return <WebProfileEffect variant={art.variant} animated={animated} className={className} />;
}
