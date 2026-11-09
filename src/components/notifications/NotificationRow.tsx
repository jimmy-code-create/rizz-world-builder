"use client";

import { useRouter } from "@tanstack/react-router";
import { useCallback } from "react";
import { Bell } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/i18n";
import type { AggregatedCard } from "@/lib/notifications-aggregation";

const TYPE_ICON: Record<string, React.ElementType> = {
  dm: Bell,
  mention: Bell,
  reaction: Bell,
  paws_gift: Bell,
  voice_room: Bell,
  like: Bell,
  comment: Bell,
  follow: Bell,
  default: Bell,
};

type NotificationRowProps = {
  card: AggregatedCard;
  /** Where tapping the row goes (newest event's target). */
  target_url: string | null;
  onTap?: (card: AggregatedCard) => void;
};

export function NotificationRow({ card, target_url, onTap }: NotificationRowProps) {
  const router = useRouter();

  const handleTap = useCallback(() => {
    onTap?.(card);
    if (target_url && typeof target_url === "string" && target_url.startsWith("/")) {
      void router.navigate({ to: target_url }).catch(() => undefined);
    }
    try {
      navigator.vibrate?.([25]);
    } catch {
      // no-op
    }
  }, [card, target_url, router, onTap]);

  const Icon = TYPE_ICON[card.type] ?? TYPE_ICON.default;

  const shell = `glass rounded-2xl p-4 border ${card.is_test ? "border-white/5 bg-card" : "border-primary/40 bg-card"} flex items-center gap-3 w-full text-left`;

  return (
    <div
      className={cn(shell, target_url ? "hover:bg-surface-2 cursor-pointer" : "")}
      onClick={handleTap}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleTap();
        }
      }}
    >
      <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/15 flex items-center justify-center">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-snug">{card.summary}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {formatRelativeTime(card.newestAt)}
        </p>
      </div>
      <div className="shrink-0 flex items-center gap-1.5">
        {card.actors.slice(0, 2).map((actor, index) => (
          <Avatar key={actor} className="h-7 w-7" alt={actor}>
            <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">
              {(actor || "?").charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ))}
        {card.actors.length > 2 && (
          <Badge variant="outline" className="text-[10px] leading-none shrink-0">
            +{card.actors.length - 2}
          </Badge>
        )}
        <button
          type="button"
          aria-label="Mark read"
          onClick={(event) => {
            event.stopPropagation();
            onTap?.(card);
          }}
          className="shrink-0 p-1 text-muted-foreground hover:text-foreground ml-1"
        >
          <Bell className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
