import { type ReactNode, useState } from "react";
import { Plus } from "lucide-react";
import { CatEmoji } from "@/components/emoji/CatEmoji";
import { catNameForShortcode } from "@/components/emoji/cat-emoji-manifest";
import { statusLabel, usePresence, type PublicPresence } from "@/lib/presence";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
          <circle cx="8" cy="8" r="8" fill="#22c55e" />
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
            fill="#facc15"
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
          <circle cx="8" cy="8" r="8" fill="#ef4444" />
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
          <circle cx="8" cy="8" r="6" stroke="#64748b" strokeWidth="2.75" fill="none" />
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
 * A tappable presence dot: tap (or long-press, which resolves to a tap on
 * release) opens a small popover with the status, the custom status and
 * when it clears. Nothing renders broken when no status is set.
 */
export function StatusDotButton({
  userId,
  username,
  status,
  isSelf,
  size = 12,
  className = "",
}: {
  userId: string;
  username?: string | null;
  status: PublicPresence;
  isSelf?: boolean;
  size?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const row = usePresence(userId);
  // Invisible users read as offline to everyone but themselves.
  const hidden = !!row && !isSelf && row.status === "invisible";
  const expired =
    !!row?.custom_status_expires_at && new Date(row.custom_status_expires_at).getTime() <= Date.now();
  const custom =
    !row || hidden || expired
      ? null
      : row.custom_status_emoji || row.custom_status_text
        ? {
            emoji: row.custom_status_emoji,
            text: row.custom_status_text,
            expiresAt: row.custom_status_expires_at,
          }
        : null;

  const who = username ? `@${username}` : "This user";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${who} is ${statusLabel(status)}. Show status`}
          aria-expanded={open}
          onClick={(event) => event.stopPropagation()}
          className={`grid place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d] ${className}`}
        >
          <StatusIcon status={status} size={size} />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="center" className="w-60 rounded-2xl border-[#2a2a2e] bg-[#1c1c1f] p-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-[#f2efe6]">
          <StatusIcon status={status} size={14} />
          {who} · {statusLabel(status)}
        </p>
        {custom ? (
          <>
            <div className="mt-1.5 text-[13px]">
              <CustomStatusLine status={custom} className="text-muted-foreground" />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">{expiryLabel(custom.expiresAt)}</p>
          </>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">No custom status set.</p>
        )}
      </PopoverContent>
    </Popover>
  );
}

function expiryLabel(expiresAt: string | null): string {
  if (!expiresAt) return "Stays on until cleared.";
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Clearing…";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `Clears in ${minutes}m.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Clears in ${hours}h.`;
  return "Clears today.";
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
 * <StatusBubble>: Discord thought bubble for a mood/custom status.
 * Rounded pill (radius 16, surface-2, 1px border), emoji 20px, one-line 13px
 * text with ellipsis (max ~60% of the screen, capped for wide layouts), plus
 * two small trailing circles at the bottom-left leading toward the avatar.
 * Pops in under 250ms with a subtle idle float (both honor reduced-motion).
 * Tap behavior: the owner passes onActivate to open the status sheet (or
 * sees a dashed "Set status" placeholder when empty); everyone else gets a
 * read-only bubble that opens a small popover with the full text.
 * Cat emoji loops (at most one loop on screen via CatEmoji budget);
 * Unicode emoji is static.
 */
export function StatusBubble({
  emoji,
  text,
  className = "",
  onActivate,
  emptyLabel,
}: {
  emoji?: string | null;
  text?: string | null;
  className?: string;
  onActivate?: () => void;
  emptyLabel?: string | null;
}) {
  const [open, setOpen] = useState(false);
  if (!emoji && !text) {
    if (emptyLabel == null || !onActivate) return null;
    return (
      <span className={`relative inline-flex ${className}`}>
        <button
          type="button"
          onClick={onActivate}
          aria-label={emptyLabel}
          className="status-bubble-in inline-flex max-w-[min(60vw,20rem)] items-center gap-1.5 rounded-2xl border border-dashed border-white/25 bg-transparent px-2.5 py-1.5 text-left text-[13px] text-muted-foreground transition-colors hover:border-[#c8ff3d]/60 hover:text-[#f2efe6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d]"
          style={{ borderRadius: 16 }}
        >
          <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">{emptyLabel}</span>
        </button>
      </span>
    );
  }
  const pill = (
    <span className="status-bubble-float inline-flex max-w-[min(60vw,20rem)] items-center gap-1.5 rounded-2xl border border-[#2a2a2e] bg-[#1c1c1f] px-2.5 py-1.5 text-left">
      {emoji && <StatusBubbleEmoji emoji={emoji} />}
      {text && <span className="min-w-0 truncate text-[13px] leading-tight text-[#f2efe6]">{text}</span>}
    </span>
  );
  const dots = (
    <>
      {/* two trailing circles leading to the avatar */}
      <span aria-hidden className="absolute -bottom-1.5 left-4 h-2 w-2 rounded-full border border-[#2a2a2e] bg-[#1c1c1f]" />
      <span aria-hidden className="absolute -bottom-3 left-2.5 h-[5px] w-[5px] rounded-full border border-[#2a2a2e] bg-[#1c1c1f]" />
    </>
  );
  if (onActivate) {
    const label = text ? `Edit status: ${text}` : "Edit status";
    return (
      <span className={`relative inline-flex ${className}`}>
        <button
          type="button"
          onClick={onActivate}
          aria-label={label}
          title={text ?? undefined}
          className="status-bubble-in rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d]"
          style={{ borderRadius: 16 }}
        >
          {pill}
        </button>
        {dots}
      </span>
    );
  }
  return (
    <span className={`relative inline-flex ${className}`}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={text ? `Show full status: ${text}` : "Show full status"}
            aria-expanded={open}
            className="status-bubble-in rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d]"
            style={{ borderRadius: 16 }}
          >
            {pill}
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
          className="w-64 rounded-2xl border-[#2a2a2e] bg-[#1c1c1f] p-3 text-[#f2efe6]"
        >
          <span className="flex items-start gap-2 text-sm">
            {emoji && <StatusBubbleEmoji emoji={emoji} />}
            {text && <span className="min-w-0 flex-1 whitespace-pre-wrap break-words leading-snug">{text}</span>}
          </span>
        </PopoverContent>
      </Popover>
      {dots}
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
  onActivate,
  emptyLabel,
}: {
  emoji?: string | null;
  text?: string | null;
  className?: string;
  onActivate?: () => void;
  emptyLabel?: string | null;
}) {
  return <StatusBubble emoji={emoji} text={text} className={className} onActivate={onActivate} emptyLabel={emptyLabel} />;
}
