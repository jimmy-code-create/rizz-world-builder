import { useEffect, useRef, useState } from "react";

/**
 * Caps how often a fast-changing value may re-render the UI.
 *
 * Voice levels arrive many times a second; at 10 Hz the speaking rings still
 * feel instant while the call view stops re-rendering its whole tree on every
 * analyser tick. The latest value always wins.
 */
export function useThrottledValue<T>(value: T, intervalMs = 100): T {
  const [throttled, setThrottled] = useState(value);
  const lastRun = useRef(0);
  const pending = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    pending.current = value;
    const wait = Math.max(0, intervalMs - (Date.now() - lastRun.current));
    if (wait === 0) {
      lastRun.current = Date.now();
      setThrottled(value);
      return;
    }
    if (timer.current) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      lastRun.current = Date.now();
      setThrottled(pending.current);
    }, wait);
  }, [value, intervalMs]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return throttled;
}
