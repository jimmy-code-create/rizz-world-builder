import { cn } from "@/lib/utils";

/**
 * The mascot typing at a tiny keyboard.
 *
 * Snapchat's indicator is a character doing something while the other person
 * types; three dots say the same thing with less life. This draws the app's own
 * cat inline so each part carries its own loop — the whole cat breathes, the
 * paws tap in alternation, the eyes blink, an ear flicks, the tail sways and the
 * keyboard glows with each keystroke — with no sprite sheet and no extra
 * request, and it stays crisp at any size.
 *
 * The loops run on different periods (1.3s body, 0.42s paws, 4.4s blink, 3.6s
 * ear, 1.6s tail) so they drift out of phase; the figure never looks like one
 * repeating GIF.
 *
 * Purely decorative: callers always pair it with real "is typing" copy, so the
 * graphic stays out of the accessibility tree.
 */
export function TypingMascot({
  size = 28,
  className,
}: {
  /** Rendered height, in pixels. Width keeps the 4:3 drawing ratio. */
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 48"
      width={Math.round(size * (64 / 48))}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={cn("typing-mascot shrink-0 select-none", className)}
    >
      {/* The body breathes as one piece, so the paws keep their relation to the
          keyboard instead of sliding off it. */}
      <g className="typing-mascot__bob">
        {/* Tail, swinging behind the head. */}
        <path
          className="typing-mascot__tail"
          d="M45 33c7.5 1.2 9.5-4.2 8.2-9.5"
          fill="none"
          stroke="#141416"
          strokeWidth="4"
          strokeLinecap="round"
        />

        {/* Keyboard the paws tap on, highlighted by a soft glow that tracks the
            paw that is pressing a key. */}
        <rect
          className="typing-mascot__keys"
          x="8"
          y="37"
          width="48"
          height="8"
          rx="4"
          fill="#26262b"
          stroke="#C8FF3D"
          strokeOpacity="0.5"
          strokeWidth="1"
        />
        <g className="typing-mascot__keys" fill="#C8FF3D" fillOpacity="0.45">
          <rect x="13" y="40" width="3" height="2" rx="1" />
          <rect x="19" y="40" width="3" height="2" rx="1" />
          <rect x="25" y="40" width="3" height="2" rx="1" />
          <rect x="31" y="40" width="3" height="2" rx="1" />
          <rect x="37" y="40" width="3" height="2" rx="1" />
          <rect x="43" y="40" width="3" height="2" rx="1" />
        </g>

        {/* Ears, flicking now and then. */}
        <g className="typing-mascot__ear typing-mascot__ear--l">
          <path d="M19 15 20 3 29 11Z" fill="#141416" />
          <path d="M21.5 13 22 7 27 11Z" fill="#C8FF3D" fillOpacity="0.85" />
        </g>
        <g className="typing-mascot__ear typing-mascot__ear--r">
          <path d="M45 15 44 3 35 11Z" fill="#141416" />
          <path d="M42.5 13 42 7 37 11Z" fill="#C8FF3D" fillOpacity="0.85" />
        </g>

        {/* Head. */}
        <ellipse cx="32" cy="23" rx="14.5" ry="13" fill="#141416" />

        {/* Eyes, blink together. */}
        <g className="typing-mascot__eye">
          <ellipse cx="26" cy="22" rx="4.1" ry="4.6" fill="#FFFFFF" />
          <circle cx="26.4" cy="22.7" r="2" fill="#0b0b0c" />
        </g>
        <g className="typing-mascot__eye typing-mascot__eye--r">
          <ellipse cx="38" cy="22" rx="4.1" ry="4.6" fill="#FFFFFF" />
          <circle cx="38.4" cy="22.7" r="2" fill="#0b0b0c" />
        </g>

        {/* Muzzle and whiskers. */}
        <path d="M29.2 28.4h5.6L32 32.2Z" fill="#C8FF3D" />
        <path d="M32 32.4v2.4" stroke="#C8FF3D" strokeWidth="1.4" strokeLinecap="round" />
        <path
          d="M17.5 26h-5M17.5 30l-4.6 1.5M46.5 26h5M46.5 30l4.6 1.5"
          stroke="#C8FF3D"
          strokeOpacity="0.7"
          strokeWidth="1.4"
          strokeLinecap="round"
        />

        {/* Paws, alternating taps on the keyboard. */}
        <ellipse
          className="typing-mascot__paw typing-mascot__paw--l"
          cx="24"
          cy="36"
          rx="5"
          ry="3.2"
          fill="#141416"
        />
        <ellipse
          className="typing-mascot__paw typing-mascot__paw--r"
          cx="40"
          cy="36"
          rx="5"
          ry="3.2"
          fill="#141416"
        />
      </g>
    </svg>
  );
}
