import { useEffect, useRef } from "react";

/**
 * Keeps the screen awake for the duration of a call.
 *
 * The Screen Wake Lock API is only available on secure origins and only while
 * the tab is visible, so the lock is dropped by the browser when the user
 * switches apps and re-acquired when they come back. Every call is best-effort:
 * unsupported browsers simply sleep as usual instead of throwing.
 */
type WakeLockSentinel = { released: boolean; release: () => Promise<void> };

export async function requestScreenWakeLock(): Promise<WakeLockSentinel | null> {
  if (typeof navigator === "undefined") return null;
  const wakeLock = (navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> } }).wakeLock;
  if (!wakeLock?.request) return null;
  try {
    return await wakeLock.request("screen");
  } catch (error) {
    console.debug("Screen wake lock unavailable", error);
    return null;
  }
}

/** Holds a screen wake lock while `active` is true (an ongoing call). */
export function useCallWakeLock(active: boolean) {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active) return;
    let disposed = false;

    const acquire = async () => {
      if (disposed || sentinelRef.current) return;
      const sentinel = await requestScreenWakeLock();
      if (disposed) {
        void sentinel?.release().catch(() => {});
        return;
      }
      sentinelRef.current = sentinel;
    };

    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      // The browser releases the lock when the tab is hidden, so re-request it.
      sentinelRef.current = null;
      void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      void sentinel?.release().catch(() => {});
    };
  }, [active]);
}
