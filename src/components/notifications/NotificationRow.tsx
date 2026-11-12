"use client";

import { useRouter } from "@tanstack/react-router";
import { useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/i18n";
import type { AggregatedCard } from "@/lib/notifications-aggregation";
import { EmojiText } from "@/components/emoji/EmojiText";

const CTA_LABEL: Record<string, string> = {
  dm: "Reply",
  message: "Reply",
  voice_room: "Join",
  call: "Join",
  mention: "Open",
  group_mention: "Open",
};

type NotificationRowProps = {
  card: AggregatedCard;
  /** Where tapping the row goes (newest event's target). */
  target_url: string | null;
  /** Mark the underlying events read without navigating. */
  onTap?: (card: AggregatedCard) => void;
};

export function NotificationRow({ card, target_url, onTap }: NotificationRowProps) {
  const router = useRouter();

  const handleTap = useCallback(() => {
    onTap?.(card);
    if (target_url && typeof target_url === "string" && target_url.startsWith("/")) {
      // `push` keeps query-string deep links intact (message ids, comments).
      router.history.push(target_url);
    }
    try {
      navigator.vibrate?.([25]);
    } catch {
      // Vibration is best-effort.
    }
  }, [card, target_url, router, onTap]);

  const cta = CTA_LABEL[card.type] ?? "View";
  const showBody =
    card.body &&
    card.body.trim().length > 0 &&
    !["reaction", "story_reaction", "like"].includes(card.type);
  const avatarCount = card.actorAvatars.length;
  const visibleActors = avatarCount > 0 ? card.actors.slice(0, 2) : [null];
  const extraActors = Math.max(0, card.actors.length - 2);

  return (
    <div
      className={cn(
        "group relative flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-all duration-150",
        card.unread
          ? "border-lime-500/20 bg-zinc-900/60"
          : "border-transparent bg-transparent hover:bg-zinc-900/30",
        target_url ? "cursor-pointer" : "",
      )}
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
      {card.unread && (
        <span
          aria-hidden="true"
          className="absolute left-0 inset-y-2 w-0.5 rounded-full bg-lime-400 shadow-[0_0_8px_rgba(163,230,53,0.55)]"
        />
      )}

      <div className="flex shrink-0 items-center -space-x-2">
        {visibleActors.map((actor, index) => {
          const src = card.actorAvatars[index] ?? null;
          const name = card.actorNames[index] || actor || "?";
          return (
            <Avatar
              key={actor ?? `unknown-${index}`}
              className="h-8 w-8 ring-2 ring-[#0e0e11]"
            >
              <AvatarImage src={src ?? undefined} alt="" />
              <AvatarFallback className="bg-zinc-800 text-[10px] font-bold text-zinc-200">
                {name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          );
        })}
        {extraActors > 0 && (
          <span className="relative grid h-8 w-8 place-items-center rounded-full bg-zinc-800 text-[10px] font-bold text-zinc-300 ring-2 ring-[#0e0e11]">
            +{extraActors}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[13px] font-medium leading-snug",
            card.unread ? "text-zinc-100" : "text-zinc-300",
          )}
        >
          {card.summary}
        </p>
        {showBody && card.body && (
          <p className="mt-0.5 truncate text-[11px] leading-snug text-zinc-400">
            <EmojiText text={card.body} className="truncate" />
          </p>
        )}
        <p className="mt-1 font-mono text-[10px] text-zinc-500">
          {formatRelativeTime(card.newestAt)}
        </p>
      </div>

      <span className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold text-zinc-400 transition-colors group-hover:border-lime-400/30 group-hover:text-lime-300">
        {cta}
      </span>
    </div>
  );
}
