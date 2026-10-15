import { type ReactNode, useState } from "react";
import { CatEmoji } from "@/components/emoji/CatEmoji";
import { catNameForShortcode } from "@/components/emoji/cat-emoji-manifest";
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
  const catName = status.emoji ? catNameForShortcode(status.emoji) : null;
  return (
    <span className={`flex min-w-0 items-center gap-1.5 ${className}`}>
      {status.emoji &&
        (catName ? (
          <CatEmoji name={catName} size={16} animate={false} />
        ) : (
          <span aria-hidden className="text-sm shrink-0">
            {status.emoji}
          </span>
        ))}
      {status.text && <span className="truncate">{status.text}</span>}
    </span>
  );
}

/**
 * <StatusBubble>: Discord thought bubble replacing the old "Hi" bubble.
 * Rounded pill (radius 16, surface-2, 1px border), emoji 20px, one-line 13px
 * text with ellipsis (max-width ~200px; tap expands to 3 lines), plus two
 * small trailing circles (8px and 5px) leading to the avatar.
 * Cat emoji loops (at most one loop on screen via CatEmoji budget);
 * Unicode emoji is static.
 */
export function StatusBubble({
  emoji,
  text,
  className = "",
}: {
  emoji?: string | null;
  text?: string | null;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!emoji && !text) return null;
  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-label={expanded ? "Collapse status" : "Expand status"}
        aria-expanded={expanded}
        className="status-bubble-in inline-flex max-w-[200px] items-center gap-1.5 rounded-2xl border border-[#2a2a2e] bg-[#1c1c1f] px-2.5 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d]"
        style={{ borderRadius: 16 }}
      >
        {emoji && <StatusBubbleEmoji emoji={emoji} />}
        {text && (
          <span
            className={`min-w-0 text-[13px] leading-tight text-[#f2efe6] ${expanded ? "line-clamp-3 whitespace-pre-wrap" : "truncate"}`}
          >
            {text}
          </span>
        )}
      </button>
      {/* two trailing circles leading to the avatar */}
      <span aria-hidden className="absolute -bottom-1.5 left-5 h-2 w-2 rounded-full border border-[#2a2a2e] bg-[#1c1c1f]" />
      <span aria-hidden className="absolute -bottom-3 left-3.5 h-[5px] w-[5px] rounded-full border border-[#2a2a2e] bg-[#1c1c1f]" />
    </span>
  );
}

function StatusBubbleEmoji({ emoji }: { emoji: string }) {
  const catName = catNameForShortcode(emoji);
  if (catName) return <CatEmoji name={catName} size={20} animate="loop" />;
  return (
    <span aria-hidden className="shrink-0 leading-none" style={{ fontSize: 20 }}>
      {emoji}
    </span>
  );
}

/**
 * Discord-style Thought / Imagination bubble for custom status on profiles and previews.
 * Kept as an alias of StatusBubble so existing call sites keep working.
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
  return <StatusBubble emoji={emoji} text={text} className={className} />;
}
