import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

function reducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/**
 * A number that counts to its new value instead of snapping.
 *
 * A like going 41 → 42 is the whole feedback loop for a tap, so the digit
 * rolls (420ms) and the digit itself gives a small pop. Both are transform or
 * text-only; nothing re-layouts the row. `prefers-reduced-motion` jumps
 * straight to the value, and so does a very large delta (a fresh page load),
 * because counting from 0 to 12.4K is noise, not feedback.
 */
export function AnimatedCount({
  value,
  format = (next: number) => String(next),
  className,
  duration = 420,
}: {
  value: number;
  /** Formats each intermediate frame (e.g. 1.2K while rolling). */
  format?: (value: number) => string;
  className?: string;
  duration?: number;
}) {
  const [shown, setShown] = useState(value);
  const [pop, setPop] = useState(0);
  const fromRef = useRef(value);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;
    // A first render, a jump of thousands, or a reader who asked for stillness
    // gets the final number immediately.
    if (reducedMotion() || Math.abs(value - from) > 999) {
      fromRef.current = value;
      setShown(value);
      return;
    }
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const next = Math.round(from + (value - from) * easeOutCubic(progress));
      setShown(next);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
        setShown(value);
        frameRef.current = null;
      }
    };
    setPop((count) => count + 1);
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [value, duration]);

  // Keep the ref in step when the value settles while the tab is backgrounded.
  useEffect(() => {
    if (document.visibilityState === "hidden") fromRef.current = value;
  }, [value]);

  return (
    <span className={cn("inline-block tabular-nums", className)}>
      <span key={pop} className="count-pop inline-block">
        {format(shown)}
      </span>
    </span>
  );
}

export default AnimatedCount;
