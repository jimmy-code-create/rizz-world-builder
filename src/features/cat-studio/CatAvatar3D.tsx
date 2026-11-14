/**
 * A 3D preview of the cat.
 *
 * The cat is a flat SVG, so "3D" here is honest parallax rather than a mesh: the
 * stage sits in a perspective and tilts toward the pointer (or device tilt on
 * touch), with a contact shadow that shifts the other way. No WebGL, no scene
 * graph — one composited transform, and it is skipped entirely under reduced
 * motion or on devices without a pointer.
 */
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { CatAvatar } from "./CatAvatar";
import type { CatConfig } from "./config";

const MAX_TILT = 14;

export function CatAvatar3D({
  config,
  size = 240,
  className,
}: {
  config: unknown;
  size?: number;
  className?: string;
}) {
  const reducedMotion = useReducedMotion();
  const frame = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0, active: false });

  const onMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (reducedMotion || !frame.current) return;
    const box = frame.current.getBoundingClientRect();
    const px = (event.clientX - box.left) / box.width - 0.5;
    const py = (event.clientY - box.top) / box.height - 0.5;
    setTilt({ x: -py * MAX_TILT * 2, y: px * MAX_TILT * 2, active: true });
  };

  const reset = () => setTilt({ x: 0, y: 0, active: false });

  return (
    <div
      ref={frame}
      onPointerMove={onMove}
      onPointerLeave={reset}
      onPointerCancel={reset}
      className={cn("cat3d relative grid place-items-center", className)}
    >
      <div
        className="cat3d__stage"
        style={{
          transform: `rotateX(${tilt.x.toFixed(2)}deg) rotateY(${tilt.y.toFixed(2)}deg) translateZ(${tilt.active ? 18 : 0}px)`,
        }}
      >
        <CatAvatar config={config as CatConfig} animated size={size} />
      </div>
      <span
        aria-hidden="true"
        className="cat3d__floor"
        style={{ transform: `translateX(${(-tilt.y * 1.6).toFixed(1)}px) scaleX(${1 + Math.abs(tilt.y) / 120})` }}
      />
    </div>
  );
}
