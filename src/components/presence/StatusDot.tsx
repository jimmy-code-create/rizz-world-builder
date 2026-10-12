import type { ReactNode } from "react";
import { statusColor, statusLabel, type PublicPresence } from "@/lib/presence";

/**
 * Small presence dot. Offline (and anyone invisible) reads as a muted grey dot.
 * `size` and `ring` exist for the header pill, which wants a slightly larger dot
 * with no ring because the pill already draws its own border.
 */
export function StatusDot({
  status,
  className = "",
  size = 12,
  ring = true,
}: {
  status: PublicPresence;
  className?: string;
  size?: number;
  ring?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={`block shrink-0 rounded-full ${ring ? "ring-2 ring-background" : ""} ${className}`}
      style={{ width: size, height: size, background: statusColor(status) }}
    />
  );
}

/**
 * An avatar with its presence dot tucked into the corner. Pass the Avatar as
 * children so every call site keeps the sizing and ring it already uses.
 */
export function AvatarWithStatus({
  status,
  children,
  className = "",
  dotSize = 10,
  label,
}: {
  status: PublicPresence;
  children: ReactNode;
  className?: string;
  dotSize?: number;
  label?: string;
}) {
  return (
    <span className={`relative inline-flex shrink-0 ${className}`} title={label ?? statusLabel(status)}>
      {children}
      <span
        className="absolute -bottom-0.5 -right-0.5 grid place-items-center rounded-full bg-background"
        style={{ padding: 1.5 }}
      >
        <span className="block rounded-full" style={{ width: dotSize, height: dotSize, background: statusColor(status) }} />
      </span>
    </span>
  );
}

/** The custom status line: emoji plus short text, clamped to one line. */
export function CustomStatusLine({
  status,
  className = "",
}: {
  status: { emoji: string | null; text: string | null } | null;
  className?: string;
}) {
  if (!status) return null;
  return (
    <span className={`flex min-w-0 items-center gap-1 ${className}`}>
      {status.emoji && <span aria-hidden>{status.emoji}</span>}
      {status.text && <span className="truncate">{status.text}</span>}
    </span>
  );
}
