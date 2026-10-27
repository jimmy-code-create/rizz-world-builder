import { cn } from "@/lib/utils";

/**
 * The one mark that means "badges" in RIZZ.
 *
 * Four icons used to point at the collection — a lucide `Trophy` (which is also
 * the Leaderboard icon, so the two rows looked identical), a `Medal` in the
 * account menu and an `Award` on the shelf itself. This replaces all of them
 * with a single drawn mark: a medal face with a five-point star punched out of
 * it, hanging from two notched ribbons.
 *
 * Why drawn this way:
 *  - The silhouette is solid, like the badge emblems themselves, so the section
 *    icon belongs to the art it opens instead of borrowing a stock glyph.
 *  - The star is a *hole* in one path (`fillRule="evenodd"`), so the mark stays
 *    a single colour and inherits `currentColor` on every surface — muted in the
 *    nav, lime in the shelf header, white on a profile card.
 *  - Geometry is tuned for the 20px name-row size: a 6.6r disc with a 4r star
 *    keeps a 2.6r band of ink around the hole and ribbons ~7 units tall, so it
 *    never collapses into a blob at the smallest size it is asked to render.
 *  - It cannot be mistaken for the neighbouring icons: no cup (Leaderboard), no
 *    scalloped tick (Verified), no sparkle (Effects).
 */
export function BadgesMark({
  size = 24,
  className,
  title,
}: {
  /** Rendered pixel size; `className` wins when both are given. */
  size?: number;
  className?: string;
  /** Accessible name — omit when the mark sits beside a visible "Badges" label. */
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn("h-5 w-5 shrink-0", className)}
      fill="currentColor"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {/* Ribbons first: their tops tuck under the medal face drawn below. */}
      <path d="M8 13.4 10.6 15 8.4 21.5 7.1 20 5.8 21.5Z" />
      <path d="M16 13.4 13.4 15 15.6 21.5 16.9 20 18.2 21.5Z" />
      {/* Medal face: one path, the star subpath punched out by even-odd. */}
      <path
        fillRule="evenodd"
        d="M12 3.15A6.6 6.6 0 1 0 12 16.35A6.6 6.6 0 1 0 12 3.15ZM12 5.75 12.94 8.46 15.8 8.51 13.52 10.24 14.35 12.99 12 11.35 9.65 12.99 10.48 10.24 8.2 8.51 11.06 8.46Z"
      />
    </svg>
  );
}
