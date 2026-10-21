import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * The verified seal beside a member's name.
 *
 * A scalloped lime seal with a dark check, not a thin circle around a tick: it
 * reads at 18px, keeps a crisp silhouette on both themes and carries a soft
 * brand glow instead of a hard border.
 */
export function VerifiedSeal({
  size = 20,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  return (
    <span
      role="img"
      title="Verified"
      aria-label="Verified"
      className={cn("inline-flex shrink-0", className)}
      style={{
        width: size,
        height: size,
        // A whisper of brand light so the seal sits on dark banners instead of
        // floating as a flat sticker.
        filter: `drop-shadow(0 0 ${Math.max(3, Math.round(size * 0.28))}px rgba(198,255,26,0.38))`,
      }}
    >
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e4ff8a" />
            <stop offset="48%" stopColor="#c8ff3d" />
            <stop offset="100%" stopColor="#93d600" />
          </linearGradient>
        </defs>
        <path
          d="M12 1.4l2.35 1.82 2.94-.42 1.2 2.73 2.73 1.2-.42 2.94L22.62 12l-1.82 2.35.42 2.94-2.73 1.2-1.2 2.73-2.94-.42L12 22.62l-2.35-1.82-2.94.42-1.2-2.73-2.73-1.2.42-2.94L1.38 12l1.82-2.35-.42-2.94 2.73-1.2 1.2-2.73 2.94.42L12 1.4z"
          fill={`url(#${uid}-fill)`}
          stroke="#1a2408"
          strokeWidth="1.05"
          strokeLinejoin="round"
        />
        <path
          d="M6.9 12.35l3.2 3.05 6.9-6.75"
          fill="none"
          stroke="#101706"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
