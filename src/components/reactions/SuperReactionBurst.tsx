import { useEffect, useState } from "react";
import { PawPrint, Sparkles } from "lucide-react";

/**
 * The super-reaction celebration.
 *
 * It used to be a full-size cat leaping across the card, which read as its own
 * event instead of a louder version of a reaction. Now the applause starts at
 * the pill that was tapped: a violet ring pulses out of it, five paw/sparkle
 * marks drift up about 70px and fade in a second, and the card flashes its
 * border violet. The flash is CSS on the card (PostCard toggles it), so readers
 * who ask for reduced motion still get the acknowledgement without any travel.
 */
export type SuperBurst = {
  key: string;
  seq: number;
  /** Where the pill was when it was tapped, in viewport pixels. */
  at?: { x: number; y: number } | null;
};

const LIFETIME_MS = 1150;
const PARTICLES = [-1, 1, -0.4, 0.6, 0];

function reducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function SuperReactionBurst({
  burst,
  onDone,
}: {
  burst: SuperBurst | null;
  onDone: () => void;
}) {
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!burst) {
      setPoint(null);
      return;
    }
    if (reducedMotion()) {
      // The card flash is the whole acknowledgement under reduced motion.
      onDone();
      return;
    }
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(20);
    }
    setPoint(
      burst.at ?? {
        x: typeof window === "undefined" ? 0 : window.innerWidth / 2,
        y: typeof window === "undefined" ? 0 : window.innerHeight * 0.6,
      },
    );
    const timer = window.setTimeout(onDone, LIFETIME_MS);
    return () => window.clearTimeout(timer);
    // `onDone` is intentionally out of the deps: the burst identity is the seq.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [burst?.seq]);

  if (!burst || !point) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[120] overflow-hidden" aria-hidden="true">
      <div className="absolute" style={{ left: point.x, top: point.y }}>
        <span className="super-ring absolute h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#8b7cf6]" />
        {PARTICLES.map((drift, index) => (
          <span
            key={`${burst.seq}-${index}`}
            className="super-particle absolute -translate-x-1/2 -translate-y-1/2 text-[#a78bfa]"
            style={{
              // A little sideways spread so five marks do not read as a column.
              ["--drift" as string]: `${drift * 26}px`,
              animationDelay: `${index * 70}ms`,
            }}
          >
            {index % 2 === 0 ? (
              <PawPrint className="h-3.5 w-3.5 drop-shadow-[0_1px_6px_rgba(139,124,246,0.55)]" />
            ) : (
              <Sparkles className="h-3 w-3 drop-shadow-[0_1px_6px_rgba(139,124,246,0.55)]" />
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

export default SuperReactionBurst;
