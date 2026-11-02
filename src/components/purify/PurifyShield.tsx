import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * The Purify mark for the upsell surfaces: the same shield silhouette the
 * verified badge is drawn on, in brand lime instead of system blue, with a
 * slow shimmer sweeping across it and a soft halo behind.
 *
 * Everything is inline SVG and CSS — no image request, so it can never render
 * as an empty box, and the shimmer is killed by the same two reduced-motion
 * switches the rest of the app uses (`prefers-reduced-motion` and the
 * `[data-reduced-motion]` flag).
 */
export function PurifyShield({
  size = 72,
  shimmer = true,
  className,
}: {
  /** Rendered square in px. */
  size?: number;
  /** Sweep the highlight across the face; off for small inline uses. */
  shimmer?: boolean;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const bodyId = `ps-body-${uid}`;
  const shineId = `ps-shine-${uid}`;
  const clipId = `ps-clip-${uid}`;
  // The shield silhouette, on the same 24 grid as every other badge.
  const shield = "M12 2.6 L19.5 5.3 V11.6 C19.5 16.1 16.4 19.6 12 21.3 C7.6 19.6 4.5 16.1 4.5 11.6 V5.3 Z";
  const sparkle = "M12 7.2 Q12.6 10.8 16.2 11.4 Q12.6 12 12 15.6 Q11.4 12 7.8 11.4 Q11.4 10.8 12 7.2 Z";

  return (
    <span
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* Halo: one soft lime bloom, sized off the badge. */}
      <span
        className="pointer-events-none absolute inset-[-18%] rounded-full opacity-70 blur-[14px]"
        style={{
          background:
            "radial-gradient(closest-side, rgba(201,255,61,0.5), rgba(201,255,61,0.12) 60%, transparent 78%)",
        }}
      />
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        focusable="false"
        className="relative"
        style={{ filter: "drop-shadow(0 0 12px rgba(201,255,61,0.45))" }}
      >
        <defs>
          <linearGradient id={`f-${bodyId}`} gradientUnits="userSpaceOnUse" x1="0" y1="3" x2="0" y2="21">
            <stop offset="0%" style={{ stopColor: "#f4ffd6" }} />
            <stop offset="48%" style={{ stopColor: "var(--brand-signal, #c9ff3d)" }} />
            <stop offset="100%" style={{ stopColor: "#89c41c" }} />
          </linearGradient>
          <linearGradient id={`h-${shineId}`} gradientUnits="userSpaceOnUse" x1="0" y1="2.5" x2="0" y2="13">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.75" />
            <stop offset="60%" stopColor="#ffffff" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`c-${clipId}`}>{shield}</clipPath>
        </defs>
        <g
          fill={`url(#f-${bodyId})`}
          stroke="rgba(255,255,255,0.55)"
          strokeWidth={1}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d={shield} />
        </g>
        <g clipPath={`url(#c-${clipId})`} fill={`url(#h-${shineId})`} stroke="none">
          <rect x="0" y="0" width="24" height="24" />
        </g>
        <path d={sparkle} fill="#0a0a0b" stroke="none" />
      </svg>
      {shimmer ? (
        <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-[30%]">
          <span className="purify-shimmer absolute inset-y-[-30%] left-0 w-1/3 -skew-x-12 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.75),transparent)]" />
        </span>
      ) : null}
    </span>
  );
}
