import { CINEMATIC_BY_SLUG } from "@/lib/cinematic-effects";
import { CinematicEffect } from "@/components/profile/CinematicEffect";

/**
 * A cinematic loop used as an avatar decoration.
 *
 * The source clips are 1600x480 with the decorative ring in the central
 * 480x480 square. Sizing the wide stage from the avatar keeps that ring at
 * roughly 1.65x the avatar diameter and centred on it, so the transparent
 * middle stays over the member's actual picture.
 */
export function CinematicAvatarDecoration({
  slug,
  avatarSize,
  reducedMotion = false,
}: {
  slug?: string | null;
  avatarSize: number;
  reducedMotion?: boolean;
}) {
  const asset = slug ? CINEMATIC_BY_SLUG[slug] : undefined;
  if (!asset) return null;

  const width = avatarSize * 5.55;
  const height = width * 0.3;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-10"
      style={{
        width,
        height,
        left: (avatarSize - width) / 2,
        top: (avatarSize - height) / 2,
      }}
    >
      <CinematicEffect
        slug={asset.slug}
        accent={asset.accent}
        fit="contain"
        posterOnly={avatarSize < 80}
        reducedMotion={reducedMotion}
      />
    </div>
  );
}
