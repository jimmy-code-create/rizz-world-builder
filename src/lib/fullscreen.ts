import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Element fullscreen, with the two hazards this app actually hits:
 *
 * 1. Safari/iOS still ships the `webkit*` spelling, and iPhone Safari has no
 *    element fullscreen at all — `supported` is false there, so the UI hides the
 *    button instead of offering a control that silently does nothing.
 * 2. `requestFullscreen()` rejects without a user gesture, and it rejects with a
 *    plain DOMException, so callers need to catch it rather than let it bubble
 *    into the route error boundary.
 */
type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

function currentFullscreenElement(): Element | null {
  if (typeof document === "undefined") return null;
  const doc = document as FullscreenDocument;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

export function useFullscreen<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const test = document.createElement("div") as FullscreenElement;
    setSupported(
      typeof document.documentElement.requestFullscreen === "function" ||
        typeof test.webkitRequestFullscreen === "function",
    );

    const sync = () => setIsFullscreen(currentFullscreenElement() === ref.current);
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync as EventListener);
    sync();
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync as EventListener);
    };
  }, []);

  const enter = useCallback(async () => {
    const element = ref.current as FullscreenElement | null;
    if (!element) return;
    setError(null);
    try {
      if (typeof element.requestFullscreen === "function") await element.requestFullscreen();
      else if (typeof element.webkitRequestFullscreen === "function")
        await element.webkitRequestFullscreen();
      else setError("Fullscreen isn't available in this browser.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not enter fullscreen.");
    }
  }, []);

  const exit = useCallback(async () => {
    const doc = document as FullscreenDocument;
    try {
      if (typeof doc.exitFullscreen === "function") await doc.exitFullscreen();
      else if (typeof doc.webkitExitFullscreen === "function") await doc.webkitExitFullscreen();
    } catch {
      /* already out */
    }
  }, []);

  const toggle = useCallback(() => {
    if (currentFullscreenElement() === ref.current) void exit();
    else void enter();
  }, [enter, exit]);

  return { ref, isFullscreen, supported, error, enter, exit, toggle };
}
