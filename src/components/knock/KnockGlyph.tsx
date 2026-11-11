/**
 * RIZZ's knock mark: a door with a sparkle where the knock lands.
 *
 * The sparkle is the app's own accent language, and it reads at 20–24px where
 * thin motion rays collapsed into noise. `currentColor` lets the header and the
 * knock sheet tint the whole glyph for rest, live, and sent states.
 */
export function KnockGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.95"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M4.2 20.5V5.7A1.8 1.8 0 0 1 6 3.9h5.3a1.8 1.8 0 0 1 1.8 1.8v14.8" />
      <path d="M4.2 20.5h8.9" />
      <circle cx="10.2" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <path
        d="M18.6 3.8 20.2 7 23.4 8.6 20.2 10.2 18.6 13.4 17 10.2 13.8 8.6 17 7Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}
