import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ONE bot card for every helper in a voice channel.
 *
 * Music Bot and Game Bot used to be two hand-built rows with different sizes,
 * colours and expansion behaviour. This is the shared shape: a 36px icon, a
 * title, exactly one status line, one action button and a chevron that reveals
 * the bot's own controls. It is deliberately quiet — 1px border, surface bg,
 * no glow — so it reads as a docked tool, not a participant.
 */
export function BotCard({
  icon,
  title,
  status,
  action,
  expanded,
  onToggle,
  children,
  tone = "accent",
  className,
}: {
  icon: ReactNode;
  title: string;
  /** One line only; it wraps to two at most and never truncates mid-word. */
  status: string;
  action?: { label: string; onClick: () => void; disabled?: boolean; primary?: boolean };
  expanded: boolean;
  onToggle: () => void;
  children?: ReactNode;
  tone?: "accent" | "music";
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border bg-card", className)}>
      <div className="flex min-w-0 items-center gap-2.5 px-3 py-2.5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
              tone === "music" ? "bg-emerald-400/15 text-emerald-300" : "bg-primary/15 text-primary",
            )}
            aria-hidden="true"
          >
            {icon}
          </span>
          <span className="min-w-0 flex-1">
            <span
              className={cn(
                "block truncate text-[10.5px] font-bold uppercase tracking-[0.12em]",
                tone === "music" ? "text-emerald-300" : "text-primary",
              )}
            >
              {title}
            </span>
            <span className="mt-0.5 line-clamp-2 break-words text-[11px] leading-snug text-muted-foreground">
              {status}
            </span>
          </span>
        </button>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            disabled={action.disabled}
            className={cn(
              "h-9 shrink-0 rounded-lg px-3 text-[11px] font-semibold transition-colors disabled:opacity-40",
              action.primary
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80",
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
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
        </button>
      </div>
      {expanded && children ? <div className="border-t border-border px-3 py-3">{children}</div> : null}
    </div>
  );
}
