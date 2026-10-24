import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { playNotificationPing } from "@/lib/notification-sound";
import { showDesktopAlert } from "@/lib/desktop-notifications";
import { DEFAULT_NOTIFICATION_PREFS, type NotificationPrefs } from "@/lib/push";
import { dmThreadsKey, type DmThreadPerson } from "@/lib/dm-threads";

type DmRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string | null;
  attachment_url: string | null;
  audio_url?: string | null;
  created_at: string;
};

type DmCard = {
  id: string;
  userId: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  preview: string;
  /** Messages from this person folded into this card. */
  count: number;
};

const CARD_LIFETIME_MS = 7000;
const MAX_CARDS = 3;

function previewOf(row: DmRow): string {
  const body = (row.body ?? "").replace(/\s+/g, " ").trim();
  if (body) return body;
  if (row.attachment_url) return "Photo";
  if (row.audio_url) return "Voice message";
  return "New message";
}

/** Quiet hours wrap past midnight (22:00 → 07:00). */
function inQuietHours(prefs: NotificationPrefs): boolean {
  if (!prefs.quiet_start || !prefs.quiet_end) return false;
  const [startHour, startMinute] = prefs.quiet_start.split(":").map(Number);
  const [endHour, endMinute] = prefs.quiet_end.split(":").map(Number);
  if ([startHour, startMinute, endHour, endMinute].some((value) => Number.isNaN(value))) {
    return false;
  }
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  return start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

/**
 * Discord-style DM notifications.
 *
 * One app-wide listener watches incoming direct messages and shows a small
 * card (avatar, name, message preview) with a ping. It never covers the
 * conversation you are already reading, respects the DM/quiet-hour/muted
 * settings, and — when the tab is in the background and alerts are allowed —
 * also raises a system notification that opens the conversation on click.
 */
export function DmNotificationHost() {
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const path = useRouterState({ select: (state) => state.location.pathname });
  const pathRef = useRef(path);
  const peopleRef = useRef(new Map<string, DmThreadPerson>());
  const [cards, setCards] = useState<DmCard[]>([]);

  useEffect(() => {
    pathRef.current = path;
  }, [path]);

  // Same key/shape the notifications settings page uses: one cache entry.
  const prefs = useQuery({
    queryKey: ["notification-prefs", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<NotificationPrefs> => {
      const { data, error } = await (supabase.from as any)("notification_prefs")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return {
        user_id: user!.id,
        ...DEFAULT_NOTIFICATION_PREFS,
        ...(data ?? {}),
      } as NotificationPrefs;
    },
  });
  const prefsRef = useRef(prefs.data);
  useEffect(() => {
    prefsRef.current = prefs.data;
  }, [prefs.data]);

  // A card for the conversation you just opened is noise.
  useEffect(() => {
    setCards((current) => current.filter((card) => path !== `/dm/${card.userId}`));
  }, [path]);

  useEffect(() => {
    if (!cards.length) return;
    const timers = cards.map((card) =>
      window.setTimeout(() => {
        setCards((current) => current.filter((item) => item.id !== card.id));
      }, CARD_LIFETIME_MS),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [cards]);

  const loadPerson = async (userId: string): Promise<DmThreadPerson> => {
    const cached = peopleRef.current.get(userId);
    if (cached) return cached;
    let person: DmThreadPerson = {
      id: userId,
      username: null,
      display_name: null,
      avatar_url: null,
    };
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url")
        .eq("id", userId)
        .maybeSingle();
      if (data) person = data as DmThreadPerson;
    } catch {
      // The card still works with the fallback name.
    }
    peopleRef.current.set(userId, person);
    return person;
  };

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`dm-toaster-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `recipient_id=eq.${user.id}`,
        },
        ({ new: message }) => {
          const row = message as DmRow;
          if (!row?.id || row.sender_id === user.id) return;

          // Badges and the DM list update even when the card is suppressed.
          void qc.invalidateQueries({ queryKey: ["unread-dms", user.id] });
          void qc.invalidateQueries({ queryKey: dmThreadsKey(user.id) });

          const settings = prefsRef.current;
          if (settings && !settings.dms) return;
          if (settings && inQuietHours(settings)) return;
          if (settings?.muted_conversations?.includes(row.sender_id)) return;

          if (
            document.visibilityState === "visible" &&
            pathRef.current === `/dm/${row.sender_id}`
          ) {
            return;
          }

          void (async () => {
            const person = await loadPerson(row.sender_id);
            const name = person.display_name || person.username || "New message";
            const handle = person.username ? `@${person.username}` : "";
            const preview = previewOf(row);

            setCards((current) => {
              if (current.some((card) => card.id === row.id)) return current;
              const card: DmCard = {
                id: row.id,
                userId: row.sender_id,
                name,
                handle,
                avatarUrl: person.avatar_url,
                preview,
                count: 1,
              };
              // Consecutive messages from one person refresh their card instead
              // of stacking a second card for the same conversation.
              const existing = current.findIndex((item) => item.userId === row.sender_id);
              if (existing >= 0) {
                const next = [...current];
                next[existing] = { ...card, count: current[existing].count + 1 };
                return next;
              }
              return [...current, card].slice(-MAX_CARDS);
            });

            if (document.visibilityState === "visible") playNotificationPing();

            if (document.visibilityState !== "visible") {
              void showDesktopAlert({
                title: name,
                body: preview,
                icon: person.avatar_url ?? undefined,
                tag: `dm-${row.sender_id}`,
                url: `/dm/${row.sender_id}`,
              });
            }
          })();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  const open = (card: DmCard) => {
    setCards((current) => current.filter((item) => item.id !== card.id));
    void nav({ to: "/dm/$userId", params: { userId: card.userId } });
  };

  if (!user) return null;

  return (
    <div
      aria-live="polite"
      role="log"
      aria-label="Direct message notifications"
      className="pointer-events-none fixed inset-x-3 top-[calc(env(safe-area-inset-top,0px)+4rem)] z-[210] flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:top-4 sm:w-[22rem]"
    >
      <AnimatePresence initial={false}>
        {cards.map((card) => (
          <motion.div
            key={card.userId}
            layout
            initial={{ opacity: 0, y: -14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="pointer-events-auto"
          >
            <div className="flex items-start gap-3 rounded-2xl border border-border bg-popover/95 p-3 text-popover-foreground shadow-xl backdrop-blur-md">
              <button
                type="button"
                onClick={() => open(card)}
                className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Open conversation with ${card.name}`}
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={card.avatarUrl ?? undefined} />
                  <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">
                    {card.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </button>
              <button
                type="button"
                onClick={() => open(card)}
                className="min-w-0 flex-1 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex items-baseline gap-1.5">
                  <span className="truncate text-sm font-semibold">{card.name}</span>
                  {card.handle && (
                    <span className="shrink-0 truncate text-[10px] text-muted-foreground">
                      {card.handle}
                    </span>
                  )}
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">now</span>
                </span>
                <span className="mt-0.5 line-clamp-2 block break-words text-xs leading-4 text-muted-foreground">
                  {card.preview}
                </span>
                <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-primary">
                  <MessageCircle className="h-3 w-3" /> Open conversation
                  {card.count > 1 && (
                    <span className="ml-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                      {card.count} new
                    </span>
                  )}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setCards((current) => current.filter((item) => item.id !== card.id))}
                aria-label="Dismiss notification"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
