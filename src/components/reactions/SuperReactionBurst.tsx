import { useEffect, useState } from "react";
import { CAT_EMOJI_MANIFEST } from "@/components/emoji/cat-emoji-manifest";

/**
 * The super-reaction celebration.
 *
 * A super reaction is a cat, so the celebration is the cat itself: the sticker
 * pops out of the pill, the ring behind it snaps outward, five sparks scatter,
 * and then the whole thing lifts and fades. It is a one-shot — nothing is left
 * on screen after it lands.
 *
 * The card flash is CSS on the card (PostCard toggles it), so readers who ask
 * for reduced motion still get the acknowledgement without any travel.
 */
export type SuperBurst = {
  key: string;
  seq: number;
  /** Where the pill was when it was tapped, in viewport pixels. */
  at?: { x: number; y: number } | null;
};

const LIFETIME_MS = 1500;
const PARTICLES = [-1, 1, -0.45, 0.6, 0];

function reducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A super pick is always a cat shortcode; anything else still gets a face. */
function catFor(key: string) {
  return CAT_EMOJI_MANIFEST.find((entry) => entry.shortcode === key) ?? null;
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

  const cat = catFor(burst.key);

  return (
    <div className="pointer-events-none fixed inset-0 z-[120] overflow-hidden" aria-hidden="true">
      <div className="absolute" style={{ left: point.x, top: point.y }}>
        <span className="super-ring absolute h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#8b7cf6]" />

        <span className="super-cat-halo absolute h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full" />

        {PARTICLES.map((drift, index) => (
          <span
            key={`${burst.seq}-${index}`}
            className="super-particle absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c9b8ff]"
            style={{
              ["--drift" as string]: `${drift * 42}px`,
              animationDelay: `${index * 55}ms`,
            }}
          />
        ))}

        <span className="super-cat absolute -translate-x-1/2 -translate-y-1/2">
          {cat ? (
            <img
              src={cat.src}
              alt=""
              draggable={false}
              className="h-24 w-24 select-none object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.45)]"
            />
          ) : (
            <span className="grid h-24 w-24 place-items-center rounded-full bg-[#8b7cf6] text-4xl font-black text-white">
              {burst.key.slice(0, 2)}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

export default SuperReactionBurst;
