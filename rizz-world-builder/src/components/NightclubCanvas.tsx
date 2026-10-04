import { useEffect, useRef } from "react";

/**
 * Nightclub-style animated background. Pure CSS-driven layers:
 *  - Drifting gradient orbs (pink / violet / cyan)
 *  - Sweeping light beams
 *  - Subtle noise film
 *
 * Fixed behind content (z-index: 0), pointer-events none, zero layout impact.
 * Respects prefers-reduced-motion via [data-reduced-motion="true"] on <html>.
 */
export function NightclubCanvas() {
  const ref = useRef<HTMLDivElement>(null);

  // Very light parallax on pointer move — desktop only, no jank.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    let raf = 0;
    let tx = 0, ty = 0;
    const onMove = (e: PointerEvent) => {
      const nx = (e.clientX / window.innerWidth - 0.5) * 20;
      const ny = (e.clientY / window.innerHeight - 0.5) * 20;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        tx += (nx - tx) * 0.08;
        ty += (ny - ty) * 0.08;
        el.style.setProperty("--px", `${tx.toFixed(2)}px`);
        el.style.setProperty("--py", `${ty.toFixed(2)}px`);
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => { window.removeEventListener("pointermove", onMove); cancelAnimationFrame(raf); };
  }, []);

  return (
    <div ref={ref} aria-hidden className="nightclub-canvas" style={{ ["--px" as any]: "0px", ["--py" as any]: "0px" }}>
      <div className="nc-orb nc-orb-1" />
      <div className="nc-orb nc-orb-2" />
      <div className="nc-orb nc-orb-3" />
      <div className="nc-beam nc-beam-1" />
      <div className="nc-beam nc-beam-2" />
      <div className="nc-grain" />
    </div>
  );
}