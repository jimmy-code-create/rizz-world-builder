/**
 * The RIZZ live mark.
 *
 * A filled signal core with two broadcast arcs on each side — the same idea as
 * the old generic radio glyph, drawn for this app instead of borrowed from an
 * icon set. It inherits `currentColor`, so the launch button can tint it lime
 * in the shell and white on a photograph without a second asset.
 */
export function RizzLiveIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
      <path
        d="M8.35 8.35a5.16 5.16 0 0 0 0 7.3M15.65 8.35a5.16 5.16 0 0 1 0 7.3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        opacity="0.9"
      />
      <path
        d="M5.55 5.55a9.12 9.12 0 0 0 0 12.9M18.45 5.55a9.12 9.12 0 0 1 0 12.9"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
        opacity="0.4"
      />
    </svg>
  );
}

export default RizzLiveIcon;
