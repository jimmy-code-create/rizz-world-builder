import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * The Purify mark: a real water droplet built out of 58 beads.
 *
 * 54 beads are packed inside a teardrop silhouette, 3 drift around its edge and
 * 1 gathers at the bottom pole and drips off on a slow cycle. Everything is drawn on a canvas at
 * device resolution and stepped by requestAnimationFrame, so the surface flows
 * at the display's native 60fps+ instead of stepping through CSS keyframes.
 *
 * The beads are pre-rendered once into a small sprite and blitted each frame
 * (58 radial gradients per frame would be wasteful), sorted back-to-front so the
 * lit beads overlap correctly. Only the body is drawn - the hexagon chassis and
 * the base ripple stay in BadgeGlyph's SVG underneath.
 *
 * Paused when offscreen or when the tab is hidden; under reduced motion a
 * single static frame is drawn and the loop never starts.
 */

const BEADS = 54;
const ORBITERS = 3;
const CENTER_X = 16;
const CIRCLE_Y = 18.8;
const CIRCLE_R = 5.4;
const APEX_Y = 5.8;

type Bead = {
  x: number;
  y: number;
  r: number;
  phase: number;
  alpha: number;
};

/** Half-width of the teardrop at a given y, in the 32-unit viewBox. */
function halfWidth(y: number): number {
  if (y >= CIRCLE_Y - CIRCLE_R) {
    const d = Math.abs(y - CIRCLE_Y);
    return Math.sqrt(Math.max(0, CIRCLE_R * CIRCLE_R - d * d));
  }
  const p = (CIRCLE_Y - CIRCLE_R - y) / (CIRCLE_Y - CIRCLE_R - APEX_Y);
  return CIRCLE_R * Math.pow(1 - Math.min(1, Math.max(0, p)), 0.92);
}

/** Deterministic PRNG so a badge always has the same bead layout. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const BODY: Bead[] = (() => {
  const rand = rng(0x5eed1e);
  const candidates: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < 2600; i++) {
    const y = 5.9 + rand() * 18.4;
    const w = halfWidth(y);
    if (w < 0.9) continue;
    const x = CENTER_X + (rand() * 2 - 1) * w;
    if (Math.abs(x - CENTER_X) > w - 0.32) continue;
    candidates.push({ x, y });
  }

  // Greedy even packing: each bead claims a spot, nothing closer than `spacing`.
  const picked: Array<{ x: number; y: number }> = [];
  for (let pass = 0; pass < 6 && picked.length < BEADS; pass++) {
    const spacing = 1.45 - pass * 0.1;
    for (const c of candidates) {
      if (picked.length >= BEADS) break;
      if (picked.every((p) => (p.x - c.x) ** 2 + (p.y - c.y) ** 2 >= spacing * spacing)) {
        picked.push(c);
      }
    }
  }

  return picked.map((p) => ({
    x: p.x,
    y: p.y,
    // Slightly larger along the bottom pole, where the body is widest. Radii
    // overlap their neighbours so the body reads as one body of water, not foam.
    r: 0.76 + 0.2 * Math.min(1, (p.y - APEX_Y) / 15) + rand() * 0.1,
    phase: rand() * Math.PI * 2,
    alpha: 0.82 + rand() * 0.16,
  }));
})();

const ORBIT: Bead[] = [
  { x: 24.6, y: 12.4, r: 0.85, phase: 0.4, alpha: 0.9 },
  { x: 8.1, y: 19.4, r: 0.78, phase: 2.1, alpha: 0.85 },
  { x: 22.2, y: 22.1, r: 0.7, phase: 4.3, alpha: 0.8 },
] as Bead[];

/** One pre-rendered bead sprite, keyed by accent so themes never share pixels. */
const sprites = new Map<string, HTMLCanvasElement>();

function beadSprite(accent: string): HTMLCanvasElement {
  const cached = sprites.get(accent);
  if (cached) return cached;

  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const c = size / 2;
  const grad = ctx.createRadialGradient(c - 7, c - 9, 2, c, c, c * 0.98);
  grad.addColorStop(0, "rgba(226,252,255,0.98)");
  grad.addColorStop(0.28, "rgba(150,240,255,0.98)");
  grad.addColorStop(0.62, accent);
  grad.addColorStop(0.9, "rgba(10,96,118,0.96)");
  grad.addColorStop(1, "rgba(6,56,72,0.92)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(c, c, c - 1, 0, Math.PI * 2);
  ctx.fill();

  // Rim light bottom-right, shadow top-left: reads as a sphere, not a dot.
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(214,250,255,0.55)";
  ctx.beginPath();
  ctx.arc(c, c, c - 2.5, Math.PI * 0.12, Math.PI * 0.52);
  ctx.stroke();
  ctx.strokeStyle = "rgba(4,42,54,0.45)";
  ctx.beginPath();
  ctx.arc(c, c, c - 2.5, Math.PI * 1.12, Math.PI * 1.52);
  ctx.stroke();

  sprites.set(accent, canvas);
  return canvas;
}

const staticPrefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function WaterDroplet({ accent = "#2ec9e8", className }: { accent?: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const sprite = beadSprite(accent);
    const reduced = staticPrefersReducedMotion();
    let raf = 0;
    let visible = true;
    let last = performance.now();
    let t = 0;

    const resize = () => {
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };

    const wave = (b: Bead, time: number, breath: number) => {
      const sway = Math.sin(time * 1.15 + b.y * 0.62 + b.phase) * 0.17;
      const lift = Math.cos(time * 0.94 + b.x * 0.58 + b.phase * 0.7) * 0.13;
      return {
        x: CENTER_X + (b.x - CENTER_X + sway) * breath,
        y: CIRCLE_Y + (b.y - CIRCLE_Y + lift) * breath,
      };
    };

    const draw = (time: number) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const unit = canvas.width / 32;
      ctx.setTransform(unit, 0, 0, unit, 0, 0);
      ctx.imageSmoothingQuality = "high";

      const breath = 1 + Math.sin(time * 1.05) * 0.012;

      // Water behind the beads: gaps read as depth, never as the ink chassis.
      const body = ctx.createRadialGradient(13.4, 12.6, 1.2, 16, 21, 12.6);
      body.addColorStop(0, "rgba(120,236,255,0.34)");
      body.addColorStop(0.45, "rgba(24,166,198,0.30)");
      body.addColorStop(1, "rgba(4,44,58,0.42)");
      ctx.save();
      ctx.translate(CENTER_X, CIRCLE_Y);
      ctx.scale(breath, breath);
      ctx.translate(-CENTER_X, -CIRCLE_Y);
      ctx.beginPath();
      ctx.moveTo(CENTER_X, APEX_Y + 0.4);
      ctx.quadraticCurveTo(16 + CIRCLE_R * 0.5, 11.4, CENTER_X + CIRCLE_R, CIRCLE_Y);
      ctx.arc(CENTER_X, CIRCLE_Y, CIRCLE_R, 0, Math.PI);
      ctx.quadraticCurveTo(16 - CIRCLE_R * 0.5, 11.4, CENTER_X, APEX_Y + 0.4);
      ctx.closePath();
      ctx.fillStyle = body;
      ctx.fill();
      ctx.restore();

      // Back-to-front so the front beads sit on top of the body's far side.
      const beads = [...BODY, ...ORBIT]
        .map((b) => {
          const p = wave(b, time, breath);
          return { b, x: p.x, y: p.y };
        })
        .sort((a, b) => a.y - b.y);

      for (const { b, x, y } of beads) {
        const r = b.r * (1 + Math.sin(time * 1.6 + b.phase) * 0.03);
        ctx.globalAlpha = b.alpha;
        ctx.drawImage(sprite, x - r, y - r, r * 2, r * 2);
      }

      // A bead gathers at the bottom pole, then lets go on a 4.6s cycle.
      const cycle = ((time % 4.6) + 4.6) % 4.6;
      const tipX = CENTER_X + Math.sin(time * 1.4) * 0.1;
      const pole = CIRCLE_Y + CIRCLE_R * 0.86;
      if (cycle < 1.5) {
        const grow = 0.42 + Math.min(1, cycle / 1.5) * 0.34;
        ctx.globalAlpha = 0.92;
        ctx.drawImage(sprite, tipX - grow, pole - grow + 0.2, grow * 2, grow * 2);
      } else {
        const p = (cycle - 1.5) / 3.1;
        const fall = p * p * 2.9;
        const scale = 0.74 - p * 0.26;
        ctx.globalAlpha = Math.max(0, 0.85 * (1 - p * p));
        ctx.drawImage(sprite, tipX - scale, pole - scale + fall, scale * 2, scale * 2);
      }

      // Surface speculars: fixed to the light, drifting a hair with the body.
      ctx.globalAlpha = 1;
      const spec = 0.55 + Math.sin(time * 1.1) * 0.07;
      ctx.fillStyle = `rgba(255,255,255,${spec})`;
      ctx.beginPath();
      ctx.ellipse(13.3 + Math.sin(time * 1.1) * 0.07, 12.5, 1.05, 1.28, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${spec * 0.55})`;
      ctx.beginPath();
      ctx.ellipse(12.2, 15.1, 0.45, 0.62, -0.35, 0, Math.PI * 2);
      ctx.fill();

      // Refracted rim along the lower-right edge: light bending through water.
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = "rgba(196,247,255,0.85)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(CENTER_X, CIRCLE_Y, CIRCLE_R - 0.55, Math.PI * 0.04, Math.PI * 0.46);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    };

    const loop = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      if (visible && !document.hidden) {
        t += dt / 1000;
        draw(t);
      }
      raf = requestAnimationFrame(loop);
    };

    resize();
    draw(0);
    if (!reduced) raf = requestAnimationFrame(loop);

    const onResize = () => {
      resize();
      draw(t);
    };
    window.addEventListener("resize", onResize);
    // A badge that mounts inside a hidden sheet has no measurable box yet.
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(onResize);
    ro?.observe(canvas);

    const io =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver((entries) => {
            visible = entries.some((e) => e.isIntersecting);
          });
    io?.observe(canvas);

    const onVisibility = () => {
      last = performance.now();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
      ro?.disconnect();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [accent]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={cn("bz-water", className)}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    />
  );
}
