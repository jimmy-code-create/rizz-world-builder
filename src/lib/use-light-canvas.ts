import { useEffect } from "react";

let lightCanvasUsers = 0;

/**
 * The welcome and auth screens are deliberately paper-white, even though the
 * product itself defaults to ink. `html` paints ink on overscroll, so without
 * this the white screen gets a black rubber-band edge on a phone. Keep the
 * browser chrome (Android address bar / PWA theme) in step too.
 *
 * A tiny ref count keeps the class alive while two light components overlap
 * during a route transition, and always hands the document back to the app's
 * ink default rather than whichever value happened to be in the meta tag.
 */
export function useLightCanvas() {
  useEffect(() => {
    const root = document.documentElement;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    lightCanvasUsers += 1;
    root.classList.add("rizz-light-canvas");
    if (meta) meta.content = "#ffffff";

    return () => {
      lightCanvasUsers = Math.max(0, lightCanvasUsers - 1);
      if (lightCanvasUsers > 0) return;
      root.classList.remove("rizz-light-canvas");
      if (meta) meta.content = "#0a0a0b";
    };
  }, []);
}
