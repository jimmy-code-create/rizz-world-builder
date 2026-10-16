import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

/**
 * The one loop every built-in game shares.
 *
 * It owns the canvas (sizing, device pixel ratio, resize observer), the frame
 * clock, keyboard/pointer input and the *throttled* bridge back to React. Games
 * only implement `draw(frame, stats)`: they mutate the stats object as much as
 * they like, and React re-renders at most five times a second, only when a
 * value actually changed. A game that called setState per frame would drop the
 * whole call's video; a game that mutates a snapshot cannot.
 */

export type ArcadeFrame = {
  ctx: CanvasRenderingContext2D;
  /** CSS pixels — the context is already scaled for the device pixel ratio. */
  width: number;
  height: number;
  /** Seconds since the previous frame, clamped so a tab switch cannot teleport anything. */
  dt: number;
  /** requestAnimationFrame timestamp, in ms. */
  now: number;
  pointer: { x: number; y: number; down: boolean; inside: boolean };
  /** Keys currently held, lower-case ("arrowleft", "w", " "). */
  keys: Set<string>;
  /** Keys pressed since the previous frame — consumed by the frame. */
  pressed: Set<string>;
};

export type ArcadeStats = Record<string, string | number | boolean | null>;

export type UseArcadeOptions = {
  /** A finger drag, in grid-friendly directions. Used by the swipe games. */
  onSwipe?: (direction: "up" | "down" | "left" | "right") => void;
  /** Keys the game owns; they stop scrolling and stop the app's g-then-x shortcuts. */
  keys?: string[];
  /** Set false to freeze the world (e.g. while a menu is open over the game). */
  running?: boolean;
};

const DEFAULT_KEYS = [
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
  "w",
  "a",
  "s",
  "d",
  " ",
  "enter",
  "r",
];

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element || !element.tagName) return false;
  return (
    element.tagName === "INPUT" ||
    element.tagName === "TEXTAREA" ||
    element.tagName === "SELECT" ||
    element.isContentEditable === true
  );
}

function sameStats(a: ArcadeStats, b: ArcadeStats): boolean {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  return aKeys.every((key) => a[key] === b[key]);
}

export function useArcade(
  draw: (frame: ArcadeFrame, stats: ArcadeStats) => void,
  options: UseArcadeOptions = {},
) {
  const { onSwipe, keys: ownedKeys, running = true } = options;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const swipeRef = useRef(onSwipe);
  swipeRef.current = onSwipe;
  const runningRef = useRef(running);
  runningRef.current = running;

  const statsRef = useRef<ArcadeStats>({});
  const [stats, setStats] = useState<ArcadeStats>({});
  const pointerRef = useRef({ x: 0, y: 0, down: false, inside: false });
  const keysRef = useRef<Set<string>>(new Set());
  const pressedRef = useRef<Set<string>>(new Set());
  const ownKeyList = ownedKeys && ownedKeys.length ? ownedKeys : DEFAULT_KEYS;
  const ownKeyListRef = useRef(ownKeyList);
  ownKeyListRef.current = ownKeyList;

  // While a game is on screen the app's single-letter shortcuts (g then d, ?, .)
  // must stay out of the way; AppOverlays checks this flag.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.dataset.gameActive = "1";
    return () => {
      delete document.body.dataset.gameActive;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 1;
    let height = 1;
    const resize = () => {
      const host = canvas.parentElement;
      const rect = (host ?? canvas).getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width || canvas.clientWidth || 320));
      height = Math.max(1, Math.round(rect.height || canvas.clientHeight || 320));
      const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    let disconnect: () => void;
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(resize);
      observer.observe(canvas.parentElement ?? canvas);
      disconnect = () => observer.disconnect();
    } else {
      window.addEventListener("resize", resize);
      disconnect = () => window.removeEventListener("resize", resize);
    }

    const keys = keysRef.current;
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (!ownKeyListRef.current.includes(key) || isTypingTarget(event.target)) return;
      // Arrows and space would scroll the page under the game.
      event.preventDefault();
      pressedRef.current.add(key);
      keys.add(key);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      keys.delete(event.key.toLowerCase());
    };
    const dropKeys = () => keys.clear();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", dropKeys);

    let frameId = 0;
    let last = typeof performance === "undefined" ? 0 : performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      if (runningRef.current) {
        try {
          drawRef.current(
            {
              ctx,
              width,
              height,
              dt,
              now,
              pointer: pointerRef.current,
              keys,
              pressed: pressedRef.current,
            },
            statsRef.current,
          );
        } catch (error) {
          console.error("[arcade] frame failed", error);
        }
      }
      pressedRef.current.clear();
      frameId = window.requestAnimationFrame(frame);
    };
    frameId = window.requestAnimationFrame(frame);

    // React sees at most 5 updates a second, and none at all when nothing moved.
    const statsTimer = window.setInterval(() => {
      const next = statsRef.current;
      setStats((previous) => (sameStats(previous, next) ? previous : { ...next }));
    }, 200);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearInterval(statsTimer);
      disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", dropKeys);
      keys.clear();
    };
  }, []);

  const swipe = useRef<{ x: number; y: number; time: number } | null>(null);

  const toLocal = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    const point = toLocal(event);
    pointerRef.current = { ...point, down: true, inside: true };
    swipe.current = { ...point, time: Date.now() };
    try {
      (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    } catch {
      /* capture is a nicety */
    }
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    const point = toLocal(event);
    pointerRef.current = {
      x: point.x,
      y: point.y,
      down: pointerRef.current.down,
      inside: true,
    };
  }, []);

  const finishPointer = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    const point = toLocal(event);
    const start = swipe.current;
    if (start && swipeRef.current) {
      const dx = point.x - start.x;
      const dy = point.y - start.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 28 && Date.now() - start.time < 700) {
        swipeRef.current(
          Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up",
        );
      }
    }
    swipe.current = null;
    pointerRef.current = { ...point, down: false, inside: true };
  }, []);

  const onPointerLeave = useCallback(() => {
    pointerRef.current = { ...pointerRef.current, inside: false, down: false };
  }, []);

  return {
    canvasRef,
    stats,
    pointerHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finishPointer,
      onPointerCancel: finishPointer,
      onPointerLeave,
    },
  };
}

/**
 * The small HUD chip row above a game canvas. Same shape for every game, so the
 * overlay reads as one product instead of three experiments.
 */
export function ArcadeChip({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number | ReactNode;
  accent?: string;
}) {
  return (
    <span className="flex items-baseline gap-1.5 rounded-lg border border-white/10 bg-black/45 px-2 py-1 backdrop-blur">
      <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/50">
        {label}
      </span>
      <span
        className="font-mono text-xs font-bold tabular-nums"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </span>
    </span>
  );
}
