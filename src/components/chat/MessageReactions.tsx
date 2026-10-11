import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fetchReactorProfiles, reactorsQueryKey, type ReactionGroup, type ReactionScope } from "@/lib/reactions";

const LONG_PRESS_MS = 420;

/**
 * Reaction chips under a message. Tapping a chip toggles my own reaction;
 * long pressing (or right clicking) shows who reacted.
 */
export function MessageReactions({
  scope,
  messageId,
  groups,
  reactorsFor,
  align = "left",
  onToggle,
}: {
  scope: ReactionScope;
  messageId: string;
  groups: ReactionGroup[];
  reactorsFor: (messageId: string, emoji: string) => string[];
  align?: "left" | "right";
  onToggle: (emoji: string) => void;
}) {
  const [whoOpen, setWhoOpen] = useState<string | null>(null);
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);

  const userIds = whoOpen ? reactorsFor(messageId, whoOpen) : [];
  const reactors = useQuery({
    queryKey: reactorsQueryKey(scope, messageId, whoOpen ?? ""),
    queryFn: () => fetchReactorProfiles(userIds),
    enabled: !!whoOpen && userIds.length > 0,
    staleTime: 60_000,
  });

  useEffect(
    () => () => {
      if (pressTimer.current) window.clearTimeout(pressTimer.current);
    },
    [],
  );

  if (!groups.length) return null;

  return (
    <div className={`mt-1 flex flex-wrap gap-1.5 ${align === "right" ? "justify-end" : "justify-start"}`}>
      {groups.map(({ emoji, count, mine }) => (
        <Popover
          key={emoji}
          open={whoOpen === emoji}
          onOpenChange={(open) => { if (!open) setWhoOpen(null); }}
        >
          <PopoverTrigger asChild>
            <motion.button
              type="button"
              aria-pressed={mine}
              aria-label={`${emoji} reaction, ${count}. Long press to see who reacted.`}
              initial={{ scale: 0.85 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 520, damping: 24 }}
              onPointerDown={() => {
                longPressed.current = false;
                if (pressTimer.current) window.clearTimeout(pressTimer.current);
                pressTimer.current = window.setTimeout(() => {
                  pressTimer.current = null;
                  longPressed.current = true;
                  setWhoOpen(emoji);
                }, LONG_PRESS_MS);
              }}
              onPointerUp={() => {
                if (pressTimer.current) {
                  window.clearTimeout(pressTimer.current);
                  pressTimer.current = null;
                }
              }}
              onPointerLeave={() => {
                if (pressTimer.current) {
                  window.clearTimeout(pressTimer.current);
                  pressTimer.current = null;
                }
              }}
              onPointerCancel={() => {
                if (pressTimer.current) {
                  window.clearTimeout(pressTimer.current);
                  pressTimer.current = null;
                }
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                setWhoOpen(emoji);
              }}
              onClick={(event) => {
                if (longPressed.current) {
                  longPressed.current = false;
                  event.preventDefault();
                  return;
                }
                onToggle(emoji);
              }}
              className={`flex min-h-12 items-center gap-1.5 rounded-full border px-3 text-sm leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rizz-pink)] ${
                mine
                  ? "border-[var(--rizz-pink)]/40 bg-[var(--rizz-pink)]/15 text-foreground"
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              <span className="text-base">{emoji}</span>
              <span className="font-semibold">{count}</span>
            </motion.button>
          </PopoverTrigger>
          <PopoverContent
            align={align === "right" ? "end" : "start"}
            side="top"
            className="glass-strong w-60 rounded-2xl border-white/10 p-2"
          >
            <p className="mb-1 px-1 text-[11px] text-muted-foreground">
              {emoji} · {count} {count === 1 ? "reaction" : "reactions"}
            </p>
            <div className="max-h-56 space-y-0.5 overflow-y-auto">
              {reactors.isLoading && <p className="px-1 py-2 text-xs text-muted-foreground">Loading…</p>}
              {(reactors.data ?? []).map((person: { id: string; username: string | null; display_name: string | null; avatar_url: string | null }) => (
                <div key={person.id} className="flex min-h-12 items-center gap-2 rounded-xl px-1">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={person.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-gradient-primary text-[10px] font-bold">
                      {(person.display_name || person.username || "?").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 truncate text-sm">{person.display_name || person.username || "Someone"}</span>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      ))}
    </div>
  );
}
