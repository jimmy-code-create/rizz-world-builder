import { memo, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ONE bot card for every helper in a voice channel.
 *
 * Music Bot and Game Bot used to be two hand-built rows with different sizes,
 * colours and expansion behaviour. This is the shared shape: a 40px tile, a
 * 15px title, a status line that may wrap to two lines, one action button and a
 * chevron that reveals the bot's own controls. It is deliberately quiet — 1px
 * border, surface bg, no glow — so it reads as a docked tool, not a person.
 */
export const BotCard = memo(function BotCard({
  icon,
  title,
  status,
  action,
  expanded,
  onToggle,
  children,
  trailing,
  className,
}: {
  icon: ReactNode;
  title: string;
  /** Two lines at most, never truncated mid-word. */
  status: string;
  action?: { label: string; onClick: () => void; disabled?: boolean; primary?: boolean };
  expanded: boolean;
  onToggle: () => void;
  children?: ReactNode;
  /** Small state glyph before the chevron (e.g. the music equalizer). */
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border bg-card", className)}>
      <div className="flex min-h-16 min-w-0 items-center gap-2.5 px-3 py-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span
            className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-secondary text-foreground"
            aria-hidden="true"
          >
            {icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold leading-tight text-foreground">
              {title}
            </span>
            <span className="mt-0.5 line-clamp-2 break-words text-[13px] leading-snug text-muted-foreground">
              {status}
            </span>
          </span>
        </button>
        {trailing ? <span className="shrink-0 text-primary">{trailing}</span> : null}
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            disabled={action.disabled}
            className={cn(
              "h-9 shrink-0 whitespace-nowrap rounded-[var(--radius-button)] px-3 text-[13px] font-semibold transition-colors disabled:opacity-40",
              action.primary
                ? "bg-[var(--overlay-selected)] text-primary hover:bg-[var(--overlay-active)]"
                : "bg-[var(--overlay-hover)] text-foreground hover:bg-[var(--overlay-active)]",
            )}
          >
            {action.label}
          </button>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-label={expanded ? `Collapse ${title}` : `Expand ${title}`}
          aria-expanded={expanded}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-[var(--overlay-hover)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
        </button>
      </div>
      {expanded && children ? <div className="border-t border-border px-3 py-3">{children}</div> : null}
    </div>
  );
});

export default BotCard;
