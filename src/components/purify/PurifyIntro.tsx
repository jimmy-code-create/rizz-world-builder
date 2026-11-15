/**
 * The Purify introduction: one short animation, played once per visit.
 *
 * It is a film, not a gate — tapping anywhere closes it, it never blocks the
 * page underneath for more than a few seconds, and never plays at all for a
 * member who asked their system for reduced motion.
 */
import { useCallback, useEffect, useRef } from "react";

export const PURIFY_INTRO_SRC = "/purify/purify-intro.mp4";
const INTRO_SEEN_KEY = "rizz:purify-intro:v1";

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function markIntroSeen() {
  try {
    window.sessionStorage.setItem(INTRO_SEEN_KEY, "1");
  } catch {
    // Private mode can refuse storage; the film then simply plays again.
  }
}

/** True only when this visit has not seen the film and motion is welcome. */
export function shouldAutoPlayPurifyIntro(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.sessionStorage.getItem(INTRO_SEEN_KEY) === "1") return false;
  } catch {
    return false;
  }
  return !prefersReducedMotion();
}

export function PurifyIntro({ open, onClose }: { open: boolean; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);

  const finish = useCallback(() => {
    markIntroSeen();
    onClose();
  }, [onClose]);

  // Autoplay is allowed only while muted; a rejected play() just leaves the
  // first frame on screen, which is still a skip-able card.
  useEffect(() => {
    if (!open) return;
    void video.current?.play().catch(() => undefined);
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Purify introduction"
      onClick={finish}
      className="fixed inset-0 z-[120] flex flex-col bg-background"
    >
      <video
        ref={video}
        src={PURIFY_INTRO_SRC}
        playsInline
        autoPlay
        muted
        loop={false}
        onEnded={finish}
        aria-hidden="true"
        className="h-full w-full flex-1 object-cover"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background to-transparent px-5 pb-8 pt-16 text-center">
        <p className="text-[13px] font-semibold text-foreground">Purify</p>
        <p className="mt-1 text-[11.5px] text-muted-foreground">Tap anywhere to skip</p>
      </div>
    </div>
  );
}
