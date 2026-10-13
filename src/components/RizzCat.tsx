import { CAT_POSES, SPRITE_COLUMNS, SPRITE_ROWS, SPRITE_SHEET, type CatMood } from "@/lib/rizz-cats";
import { cn } from "@/lib/utils";

/**
 * One mascot pose.
 *
 * Renders the per-pose art that ships in /public, or — once SPRITE_SHEET is set
 * in the catalogue — the matching square of the 4x4 mascot sheet. The caller
 * only ever names a mood, so the artwork can be swapped in one place.
 *
 * Mood illustrations are decoration: they always sit next to real copy, so they
 * are hidden from screen readers unless a caller passes `alt`.
 */
export function RizzCat({
  mood = "peek",
  size = 96,
  className,
  alt,
  decorative = true,
}: {
  mood?: CatMood;
  /** Rendered square, in pixels. */
  size?: number;
  className?: string;
  /** Overrides the pose's default label; also un-hides the image. */
  alt?: string;
  decorative?: boolean;
}) {
  const pose = CAT_POSES[mood];
  const label = alt ?? pose.label;
  const hidden = decorative && !alt;

  if (!SPRITE_SHEET) {
    return (
      <img
        src={pose.src}
        alt={hidden ? "" : label}
        aria-hidden={hidden || undefined}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        draggable={false}
        className={cn("select-none object-contain", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  const [column, row] = pose.cell;
  return (
    <span
      role={hidden ? undefined : "img"}
      aria-label={hidden ? undefined : label}
      aria-hidden={hidden || undefined}
      className={cn("inline-block shrink-0 bg-no-repeat", className)}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${SPRITE_SHEET})`,
        backgroundSize: `${SPRITE_COLUMNS * 100}% ${SPRITE_ROWS * 100}%`,
        backgroundPosition: `${(column / (SPRITE_COLUMNS - 1)) * 100}% ${(row / (SPRITE_ROWS - 1)) * 100}%`,
      }}
    />
  );
}
