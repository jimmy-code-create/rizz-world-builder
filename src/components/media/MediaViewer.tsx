import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { X } from "lucide-react";
import { FullScreenLayer } from "@/components/FullScreenLayer";

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_WINDOW = 300;
const DISMISS_DRAG = 96;

type Point = { x: number; y: number };

/**
 * Full-screen photo / GIF viewer: black backdrop, pinch to zoom, double tap to
 * zoom in and out, drag to pan, swipe down to dismiss. Everything is plain
 * pointer events, so it behaves the same on touch and with a mouse.
 */
export function MediaViewer({
  open,
  src,
  alt = "",
  onClose,
}: {
  open: boolean;
  src: string;
  alt?: string;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [dragY, setDragY] = useState(0);
  const [interacting, setInteracting] = useState(false);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef({
    mode: "none" as "none" | "pan" | "pinch",
    startPoint: { x: 0, y: 0 },
    startOffset: { x: 0, y: 0 },
    startDistance: 0,
    startScale: 1,
    startMid: { x: 0, y: 0 },
  });
  const lastTap = useRef(0);
  const surfaceRef = useRef<HTMLDivElement>(null);

  const reset = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setDragY(0);
    setInteracting(false);
    pointers.current.clear();
    gesture.current.mode = "none";
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const toggleZoom = useCallback(() => {
    setInteracting(false);
    setScale((current) => (current > 1.05 ? 1 : DOUBLE_TAP_SCALE));
    setOffset((current) => (scale > 1.05 ? { x: 0, y: 0 } : current));
  }, [scale]);

  const midpoint = (points: Point[]): Point => ({
    x: (points[0].x + points[1].x) / 2,
    y: (points[0].y + points[1].y) / 2,
  });

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setInteracting(true);

    const points = [...pointers.current.values()];
    if (points.length === 2) {
      const rect = surfaceRef.current?.getBoundingClientRect();
      const mid = midpoint(points);
      gesture.current = {
        mode: "pinch",
        startPoint: { x: 0, y: 0 },
        startOffset: offset,
        startScale: scale,
        startDistance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y),
        startMid: rect ? { x: mid.x - (rect.left + rect.width / 2), y: mid.y - (rect.top + rect.height / 2) } : { x: 0, y: 0 },
      };
      return;
    }

    // Double tap toggles zoom; a single tap that never moves closes nothing.
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_WINDOW) {
      lastTap.current = 0;
      toggleZoom();
      return;
    }
    lastTap.current = now;

    gesture.current = {
      ...gesture.current,
      mode: "pan",
      startPoint: { x: event.clientX, y: event.clientY },
      startOffset: offset,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointers.current.values()];

    if (gesture.current.mode === "pinch" && points.length === 2) {
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      if (!gesture.current.startDistance) return;
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, gesture.current.startScale * (distance / gesture.current.startDistance)));
      const k = next / gesture.current.startScale;
      const mid = midpoint(points);
      const rect = surfaceRef.current?.getBoundingClientRect();
      const localMid = rect
        ? { x: mid.x - (rect.left + rect.width / 2), y: mid.y - (rect.top + rect.height / 2) }
        : { x: 0, y: 0 };
      setScale(next);
      // Keep the point between the fingers anchored while scaling.
      setOffset({
        x: localMid.x - (gesture.current.startMid.x - gesture.current.startOffset.x) * k,
        y: localMid.y - (gesture.current.startMid.y - gesture.current.startOffset.y) * k,
      });
      return;
    }

    if (gesture.current.mode === "pan") {
      const dx = event.clientX - gesture.current.startPoint.x;
      const dy = event.clientY - gesture.current.startPoint.y;
      if (scale > 1.05) {
        setOffset({ x: gesture.current.startOffset.x + dx, y: gesture.current.startOffset.y + dy });
      } else {
        setDragY(Math.max(0, dy));
      }
    }
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    const remaining = [...pointers.current.values()];
    const wasPan = gesture.current.mode === "pan";
    if (remaining.length === 1 && wasPan) {
      // Continue panning from the remaining finger.
      gesture.current.startPoint = { x: remaining[0].x, y: remaining[0].y };
      gesture.current.startOffset = offset;
    } else if (!remaining.length) {
      gesture.current.mode = "none";
      setInteracting(false);
      if (wasPan && scale <= 1.05 && dragY > DISMISS_DRAG) {
        onClose();
        return;
      }
      setDragY(0);
    } else {
      setInteracting(false);
    }
  };

  if (!open || !src) return null;

  return (
    <FullScreenLayer open={open}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Media viewer"
        className="fixed inset-0 z-[95] flex items-center justify-center bg-black/85 backdrop-blur-md transition-colors"
        style={{ opacity: dragY > 0 ? Math.max(0.4, 1 - dragY / 400) : 1 }}
      >
        <div
          ref={surfaceRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onPointerUp}
          className="absolute inset-0 flex items-center justify-center overflow-hidden"
          style={{ touchAction: "none" }}
        >
          <img
            src={src}
            alt={alt}
            draggable={false}
            className="max-h-full max-w-full select-none object-contain shadow-2xl"
            style={{
              transform: `translate3d(${offset.x}px, ${offset.y + dragY}px, 0) scale(${scale})`,
              transition: interacting ? "none" : "transform 200ms cubic-bezier(0.2, 0.7, 0.2, 1)",
            }}
          />
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close media viewer"
          className="absolute right-3 z-10 grid h-12 w-12 place-items-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          style={{ top: "max(env(safe-area-inset-top, 0px), 0.75rem)" }}
        >
          <X className="h-6 w-6" />
        </button>
      </div>
    </FullScreenLayer>
  );
}
