/**
 * The RIZZ live mark.
 *
 * A lens, not a radio glyph: one thin ring, a solid signal core and two short
 * broadcast arcs. It inherits `currentColor`, so the launch orb can tint it
 * lime and the room header can keep it white on a photograph without a second
 * asset. Drawn in-house rather than borrowed from an icon set.
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
      <circle
        cx="12"
        cy="12"
        r="9.1"
        stroke="currentColor"
        strokeWidth="1.1"
        opacity="0.3"
      />
      <rect x="10.4" y="8.1" width="3.2" height="7.8" rx="1.6" fill="currentColor" />
      <path
        d="M7.5 8.5a5 5 0 0 0 0 7M16.5 8.5a5 5 0 0 1 0 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.95"
      />
    </svg>
  );
}

export default RizzLiveIcon;
