/**
 * A door with three impact marks: a literal knock on a door, rather than the
 * broadcast icon the header used to show. `currentColor` lets the caller tint
 * the whole glyph for rest, live, and knocked states.
 */
export function KnockGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M5.5 20.5V5.25A1.75 1.75 0 0 1 7.25 3.5h6.5a1.75 1.75 0 0 1 1.75 1.75v15.25" />
      <path d="M5.5 20.5h10" />
      <circle cx="12.7" cy="11.9" r="1.05" fill="currentColor" stroke="none" />
      <path d="M17.8 7.2 20 5" />
      <path d="M18.4 12H21.5" />
      <path d="M17.8 16.8 20 19" />
    </svg>
  );
}
