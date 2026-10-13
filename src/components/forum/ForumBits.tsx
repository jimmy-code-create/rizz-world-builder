import type { ReactNode } from "react";
import { CheckCircle2, Lock, Pin, Archive } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BadgeChip } from "@/components/BadgeChip";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { forumRoleColor, readableInk, withAlpha } from "@/lib/forum-content";
import type { Badge } from "@/lib/badges";
import type { ForumReactionChip, ForumReplier, ForumStatus, ForumTag } from "@/lib/forums";
import type { RealmRole } from "@/lib/realm-roles";
import type { ForumLayout } from "@/lib/forum-prefs";
import { cn } from "@/lib/utils";

/**
 * The small pieces a forum is built from: tag and status chips, the state
 * flags, an author line and the reaction bar.
 *
 * They all read the `--forum-*` tokens, so the accent, radius and shadows a
 * moderator picks flow through every one of them.
 */

export function TagChip({
  tag,
  active = false,
  emoji = true,
  onClick,
  className,
}: {
  tag: ForumTag;
  active?: boolean;
  emoji?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const content = (
    <>
      {emoji && tag.emoji ? <span aria-hidden>{tag.emoji}</span> : null}
      <span className="truncate">{tag.name}</span>
    </>
  );
  const style = {
    borderColor: withAlpha(tag.color, active ? 0.85 : 0.4),
    backgroundColor: withAlpha(tag.color, active ? 0.28 : 0.12),
    color: active ? readableInk(tag.color) : undefined,
  };

  if (!onClick) {
    return (
      <span className={cn("forum-chip", className)} style={style}>
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "forum-chip transition-colors hover:brightness-110 active:scale-[0.97]",
        active ? "text-white" : "text-foreground",
        className,
      )}
      style={style}
    >
      {content}
    </button>
  );
}

export function StatusChip({ status, className }: { status: ForumStatus; className?: string }) {
  return (
    <span
      className={cn("forum-chip", className)}
      style={{
        borderColor: withAlpha(status.color, 0.5),
        backgroundColor: withAlpha(status.color, 0.16),
      }}
      title={status.is_closed ? `${status.name} (no new replies)` : status.name}
    >
      {status.emoji ? <span aria-hidden>{status.emoji}</span> : null}
      <span>{status.name}</span>
    </span>
  );
}

/** Pinned, locked, solved and archived, in one consistent icon set. */
export function StateFlag({
  kind,
  withLabel = false,
}: {
  kind: "pinned" | "locked" | "solved" | "archived";
  withLabel?: boolean;
}) {
  const spec = {
    pinned: { Icon: Pin, label: "Pinned", color: "var(--forum-pinned)" },
    locked: { Icon: Lock, label: "Locked", color: "var(--forum-locked)" },
    solved: { Icon: CheckCircle2, label: "Solved", color: "var(--forum-solved)" },
    archived: { Icon: Archive, label: "Archived", color: "var(--forum-archived)" },
  }[kind];
  const { Icon } = spec;
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-semibold"
      style={{ color: spec.color }}
      title={spec.label}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {withLabel ? <span>{spec.label}</span> : <span className="sr-only">{spec.label}</span>}
    </span>
  );
}

export function AuthorLine({
  name,
  avatarUrl,
  role,
  badges = [],
  size = "sm",
  subtitle,
  trailing,
}: {
  name: string;
  avatarUrl: string | null;
  role?: RealmRole | null;
  badges?: Badge[];
  size?: "sm" | "md" | "lg";
  subtitle?: ReactNode;
  trailing?: ReactNode;
}) {
  const dim = size === "lg" ? "h-11 w-11" : size === "md" ? "h-9 w-9" : "h-6 w-6";
  const text = size === "lg" ? "text-sm" : size === "md" ? "text-sm" : "text-[12px]";
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar className={cn(dim, "shrink-0 ring-1 ring-white/10")}>
        <AvatarImage src={avatarUrl ?? undefined} alt="" loading="lazy" decoding="async" />
        <AvatarFallback className="bg-gradient-primary text-[10px] font-bold">
          {(name || "?").charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className={cn("truncate font-semibold", text)}
            style={{ color: forumRoleColor(role) }}
          >
            {name}
          </span>
          {role === "owner" ? (
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-[var(--forum-role-owner)]">
              OP
            </span>
          ) : null}
        </div>
        {subtitle ? (
          <div className="truncate text-[11px] text-muted-foreground">{subtitle}</div>
        ) : null}
      </div>
      {badges.length > 0 ? (
        <div className="ml-1 flex shrink-0 items-center gap-1">
          {badges.slice(0, 3).map((badge) => (
            <BadgeChip key={badge.id} badge={badge} size="sm" />
          ))}
        </div>
      ) : null}
      {trailing ? <div className="ml-auto shrink-0">{trailing}</div> : null}
    </div>
  );
}

/** The face row on a card: who replied most recently. */
export function ReplierFaces({ people, max = 4 }: { people: ForumReplier[]; max?: number }) {
  if (people.length === 0) return null;
  const shown = people.slice(0, max);
  return (
    <span className="flex shrink-0 -space-x-2">
      {shown.map((person) => {
        const label = person.display_name || person.username || "member";
        return (
          <Avatar key={person.id} className="h-5 w-5 ring-2 ring-background">
            <AvatarImage src={person.avatar_url ?? undefined} alt={label} loading="lazy" decoding="async" />
            <AvatarFallback className="bg-gradient-primary text-[8px] font-bold">
              {label.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        );
      })}
    </span>
  );
}

/** The reaction bar a post or a reply carries, built from the forum's own set. */
export function ReactionBar({
  chips,
  options,
  onPick,
  disabled = false,
  compact = false,
}: {
  chips: ForumReactionChip[];
  options: string[];
  onPick: (emoji: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const counts = new Map(chips.map((chip) => [chip.emoji, chip]));
  // Show every reaction in play, then the forum's own set, capped so the bar
  // never becomes a second toolbar.
  const emojis = [...chips.map((chip) => chip.emoji), ...options.filter((emoji) => !counts.has(emoji))].slice(0, 8);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {emojis.map((emoji) => {
        const chip = counts.get(emoji);
        const mine = chip?.mine === true;
        return (
          <button
            key={emoji}
            type="button"
            disabled={disabled}
            aria-pressed={mine}
            onClick={() => onPick(emoji)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-semibold transition-colors disabled:opacity-50",
              mine
                ? "border-[var(--forum-accent)] bg-[var(--forum-accent-soft)] text-foreground"
                : "border-[var(--forum-border)] bg-[var(--forum-surface-sunken)] hover:border-[var(--forum-accent)]",
              compact ? "text-[11px]" : "",
            )}
          >
            <span aria-hidden>{emoji}</span>
            {chip && chip.count > 0 ? <span>{chip.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** A count with its icon — replies, likes, views. */
export function CountPill({
  icon,
  children,
  tone = "muted",
}: {
  icon: ReactNode;
  children: ReactNode;
  tone?: "muted" | "accent" | "solved" | "pinned";
}) {
  const color =
    tone === "accent"
      ? "var(--forum-accent)"
      : tone === "solved"
        ? "var(--forum-solved)"
        : tone === "pinned"
          ? "var(--forum-pinned)"
          : undefined;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-semibold",
        tone === "muted" ? "text-muted-foreground" : "",
      )}
      style={color ? { color } : undefined}
    >
      {icon}
      <span>{children}</span>
    </span>
  );
}

/** Skeleton placeholders sized like the real thing, so nothing jumps. */
export function ForumSkeleton({ layout, rows = 4 }: { layout: ForumLayout; rows?: number }) {
  if (layout === "gallery") {
    return (
      <div className="forum-masonry">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton
            key={index}
            className="rounded-[var(--forum-radius)]"
            style={{ height: index % 3 === 0 ? 220 : index % 3 === 1 ? 150 : 190 }}
          />
        ))}
      </div>
    );
  }
  const height = layout === "compact" ? "h-16" : "h-[104px]";
  return (
    <div className="flex flex-col" style={{ gap: "var(--forum-gap)" }}>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className={cn("rounded-[var(--forum-radius)]", height)} />
      ))}
    </div>
  );
}

export function ForumEmpty({
  icon,
  title,
  body,
  children,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div
      className="forum-card forum-card-flat flex flex-col items-center gap-2 p-8 text-center"
      style={{ padding: "calc(var(--forum-pad) + 0.75rem)" }}
    >
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--forum-accent-soft)] text-[var(--forum-accent)]">
        {icon}
      </div>
      <h3 className="font-display text-base font-bold">{title}</h3>
      <p className="max-w-sm text-xs text-muted-foreground">{body}</p>
      {children}
    </div>
  );
}

/** One reusable "press to do the thing" button for empty states. */
export function ForumEmptyAction({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <Button type="button" onClick={onClick} className="mt-2 h-10 gap-2 border-0 bg-gradient-primary shadow-glow">
      {children}
    </Button>
  );
}
