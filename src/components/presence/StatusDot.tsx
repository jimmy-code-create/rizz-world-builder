import type { ReactNode } from "react";
import { isCatEmoji } from "@/lib/cat-emojis";
import { CatEmoji } from "@/components/CatEmoji";
import { statusColor, statusLabel, type PublicPresence } from "@/lib/presence";

/**
 * Discord-style status icons:
 * - Online: solid vibrant emerald/green dot
 * - Idle: amber crescent moon 🌙 cutout
 * - Do Not Disturb: red circle with horizontal white minus sign (-)
 * - Invisible/Offline: grey ring with hollow centre
 */
export function StatusIcon({
  status,
  size = 12,
  className = "",
}: {
  status: PublicPresence;
  size?: number;
  className?: string;
}) {
  switch (status) {
    case "online":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`shrink-0 ${className}`}
          aria-label="Online"
        >
          <circle cx="8" cy="8" r="8" fill="#23a55a" />
        </svg>
      );
    case "idle":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`shrink-0 ${className}`}
          aria-label="Idle"
        >
          {/* Discord crescent moon cutout */}
          <path
            d="M13.8 10.1A6 6 0 0 1 5.9 2.2a6.5 6.5 0 1 0 7.9 7.9Z"
            fill="#f0b232"
          />
        </svg>
      );
    case "dnd":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`shrink-0 ${className}`}
          aria-label="Do Not Disturb"
        >
          {/* Discord DND: red circle with centered white minus bar */}
          <circle cx="8" cy="8" r="8" fill="#f23f43" />
          <rect x="2.75" y="6.75" width="10.5" height="2.5" rx="1.25" fill="#ffffff" />
        </svg>
      );
    case "invisible":
    case "offline":
    default:
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`shrink-0 ${className}`}
          aria-label="Offline"
        >
          <circle cx="8" cy="8" r="6" stroke="#80848e" strokeWidth="2.75" fill="none" />
        </svg>
      );
  }
}

/**
 * Small presence indicator. Rendered with Discord-standard custom vector icons.
 * `size` and `ring` exist for headers and avatar badges.
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
      className={`inline-grid place-items-center shrink-0 rounded-full ${
        ring ? "ring-2 ring-background" : ""
      } ${className}`}
      style={{ width: size, height: size }}
    >
      <StatusIcon status={status} size={size} />
    </span>
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
  dotSize = 12,
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
        <StatusIcon status={status} size={dotSize} />
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
  if (!status || (!status.emoji && !status.text)) return null;
  return (
    <span className={`flex min-w-0 items-center gap-1.5 ${className}`}>
      {status.emoji && (
        isCatEmoji(status.emoji) ? (
          <CatEmoji name={status.emoji} size={16} className="shrink-0" />
        ) : (
          <span aria-hidden className="text-sm shrink-0">{status.emoji}</span>
        )
      )}
      {status.text && <span className="truncate">{status.text}</span>}
    </span>
  );
}

/**
 * Discord-style Thought / Imagination bubble for custom status on profiles and previews.
 * Features a balloon shape with a cute speech beak pointing towards the user.
 */
export function ThoughtBubble({
  emoji,
  text,
  className = "",
}: {
  emoji?: string | null;
  text?: string | null;
  className?: string;
}) {
  if (!emoji && !text) return null;

  return (
    <div
      className={`relative inline-flex max-w-[280px] items-center gap-1.5 rounded-2xl border border-white/15 bg-black/80 px-3 py-1.5 text-xs font-medium text-foreground shadow-lg backdrop-blur-md animate-in fade-in-0 zoom-in-95 duration-150 ${className}`}
    >
      {emoji && (
        isCatEmoji(emoji) ? (
          <CatEmoji name={emoji} size={18} className="shrink-0" />
        ) : (
          <span className="text-sm shrink-0">{emoji}</span>
        )
      )}
      {text && <span className="truncate leading-tight">{text}</span>}
      {/* Speech bubble pointer tip */}
      <div
        className="absolute -bottom-1.5 left-4 h-2.5 w-2.5 rotate-45 border-b border-r border-white/15 bg-black/80"
        aria-hidden
      />
    </div>
  );
}
