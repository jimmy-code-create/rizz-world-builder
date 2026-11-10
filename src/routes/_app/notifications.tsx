import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/toast";
import { useI18n } from "@/lib/i18n";
import { RizzCat } from "@/components/RizzCat";
import { fetchCommentTargets, type CommentTarget } from "@/lib/notifications";
import {
  aggregateNotifications,
  type AggregatedCard,
  type NotifEvent,
} from "@/lib/notifications-aggregation";
import { NotificationRow } from "@/components/notifications/NotificationRow";

export const Route = createFileRoute("/_app/notifications")({
  head: () => ({ meta: [{ title: "Notifications · RIZZ" }] }),
  component: NotificationsPage,
});

type HubTab = "all" | "interactions" | "loot";
type DmThread = {
  id: string;
  body: string;
  created_at: string;
  sender: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
  count: number;
};

const TABS: Array<{ id: HubTab; label: string }> = [
  { id: "all", label: "All" },
  { id: "interactions", label: "Mentions & DMs" },
  { id: "loot", label: "Loot & Hype" },
];

const INTERACTION_TYPES = new Set([
  "dm",
  "message",
  "mention",
  "group_mention",
  "voice_room",
  "call",
]);

const LOOT_TYPES = new Set([
  "paws_gift",
  "gift",
  "badge",
  "badge_unlock",
  "follow",
  "reaction",
  "story_reaction",
  "like",
  "comment",
  "super_reaction",
]);

function inTab(type: string, tab: HubTab): boolean {
  if (tab === "all") return true;
  if (tab === "interactions") return INTERACTION_TYPES.has(type);
  if (type.startsWith("bounty")) return true;
  return LOOT_TYPES.has(type);
}

function notificationData(n: Record<string, unknown>): Record<string, unknown> {
  return n.data && typeof n.data === "object" ? (n.data as Record<string, unknown>) : {};
}

function forumTarget(n: Record<string, unknown>): { slug: string; room: string; post: string } | null {
  const data = notificationData(n);
  if (
    typeof data.realm_slug !== "string" ||
    typeof data.room_id !== "string" ||
    typeof data.post_id !== "string"
  ) {
    return null;
  }
  return { slug: data.realm_slug, room: data.room_id, post: data.post_id };
}

function mentionTarget(n: Record<string, unknown>):
  | { kind: "group"; groupId: string; messageId: string }
  | { kind: "realm"; realmId: string; messageId: string }
  | null {
  const data = notificationData(n);
  if (typeof data.message_id !== "string") return null;
  if (data.source === "group" && typeof data.group_id === "string") {
    return { kind: "group", groupId: data.group_id, messageId: data.message_id };
  }
  if (data.source === "realm" && typeof data.realm_id === "string") {
    return { kind: "realm", realmId: data.realm_id, messageId: data.message_id };
  }
  return null;
}

function talkTarget(n: Record<string, unknown>, realmSlugs: Map<string, string>): string | null {
  const data = notificationData(n);
  const direct = typeof data.url === "string" && data.url.startsWith("/") ? data.url : null;
  if (direct) return direct;

  const mention = mentionTarget(n);
  if (mention?.kind === "group") {
    return `/g/${mention.groupId}?message=${mention.messageId}`;
  }
  if (mention?.kind === "realm") {
    const slug = realmSlugs.get(mention.realmId);
    if (slug) return `/r/${slug}?message=${mention.messageId}`;
  }

  const forum = forumTarget(n);
  if (forum) {
    return `/r/${forum.slug}?room=${forum.room}&post=${forum.post}`;
  }

  if (n.type === "dm" || n.type === "message") {
    const sender = data.sender_id ?? n.actor_id;
    if (typeof sender === "string") return `/dm/${sender}`;
  }
  if (n.type === "follow" && typeof (n.actor as { username?: string } | null)?.username === "string") {
    return `/u/${(n.actor as { username: string }).username}`;
  }
  if (typeof n.post_id === "string") return `/p/${n.post_id}`;
  if (typeof n.type === "string" && n.type.startsWith("bounty")) return "/drops";
  return null;
}

function NotificationsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [tab, setTab] = useState<HubTab>("all");
  const itemsKey = ["notifications", user?.id] as const;
  const dmKey = ["notif-unread-dms", user?.id] as const;

  const items = useQuery({
    queryKey: itemsKey,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*, actor:profiles!notifications_actor_id_fkey(username,display_name,avatar_url)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notifs-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["notifications"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  // Unread DMs are not rows in `notifications`; they are their own inbox lane.
  // Collapsing by sender here means one card per conversation, not per message.
  const unreadDms = useQuery({
    queryKey: dmKey,
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("direct_messages")
        .select(
          "id,created_at,body,sender_id,sender:profiles!direct_messages_sender_id_fkey(id,username,display_name,avatar_url)",
        )
        .eq("recipient_id", user!.id)
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(40);
      type UnreadDmRow = {
        id: string;
        body: string;
        created_at: string;
        sender_id: string;
        sender: DmThread["sender"] | null;
      };
      const seen = new Map<string, DmThread>();
      for (const row of (data ?? []) as UnreadDmRow[]) {
        if (!row.sender) continue;
        const existing = seen.get(row.sender_id);
        if (existing) existing.count += 1;
        else
          seen.set(row.sender_id, {
            id: row.id,
            body: row.body,
            created_at: row.created_at,
            sender: row.sender,
            count: 1,
          });
      }
      return [...seen.values()];
    },
  });

  const mentionRealmIds = useMemo(
    () => [
      ...new Set(
        (items.data ?? [])
          .map((n: Record<string, unknown>) => mentionTarget(n))
          .filter(
            (target): target is { kind: "realm"; realmId: string; messageId: string } =>
              target?.kind === "realm",
          )
          .map((target) => target.realmId),
      ),
    ],
    [items.data],
  );

  const realmSlugs = useQuery({
    queryKey: ["notif-realm-slugs", mentionRealmIds],
    enabled: mentionRealmIds.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("realms").select("id,slug").in("id", mentionRealmIds);
      return new Map(
        (data ?? []).map((realm: { id: string; slug: string }) => [realm.id, realm.slug]),
      );
    },
  });

  const commentTargets = useQuery({
    queryKey: ["notification-comment-targets", user?.id, (items.data ?? []).length],
    queryFn: () => fetchCommentTargets((items.data ?? []) as Parameters<typeof fetchCommentTargets>[0]),
    enabled: !!user && (items.data ?? []).some((n: { type?: string }) => n.type === "comment"),
    staleTime: 30_000,
  });

  const notificationEvents = useMemo<NotifEvent[]>(() => {
    const slugMap = realmSlugs.data ?? new Map<string, string>();
    const comments = commentTargets.data ?? new Map<string, CommentTarget>();
    return (items.data ?? []).map((n: Record<string, unknown>) => {
      const data = notificationData(n);
      const actor = n.actor as {
        username?: string | null;
        display_name?: string | null;
        avatar_url?: string | null;
      } | null;
      const comment = typeof n.id === "string" ? comments.get(n.id) : null;
      const target =
        comment && typeof n.post_id === "string"
          ? `/p/${n.post_id}?comment=${comment.commentId}`
          : talkTarget(n, slugMap);
      const resource =
        (typeof n.post_id === "string" ? n.post_id : null) ??
        (typeof data.conversation_id === "string" ? data.conversation_id : null) ??
        (typeof data.group_id === "string" ? data.group_id : null) ??
        (typeof data.realm_channel_id === "string" ? data.realm_channel_id : null) ??
        (typeof data.realm_id === "string" ? data.realm_id : null) ??
        (typeof data.message_id === "string" ? data.message_id : null) ??
        (typeof n.id === "string" ? n.id : null);

      return {
        id: String(n.id),
        resource_id: resource,
        type: String(n.type ?? "notification"),
        actor: actor?.username ?? null,
        actor_name: actor?.display_name ?? null,
        actor_avatar_url: actor?.avatar_url ?? null,
        created_at: String(n.created_at ?? new Date().toISOString()),
        body: comment?.body ?? (typeof n.body === "string" ? n.body : null),
        target_url: target,
        read: n.read === true,
        is_test: n.is_test === true,
      };
    });
  }, [items.data, realmSlugs.data, commentTargets.data]);

  const dmEvents = useMemo<NotifEvent[]>(
    () =>
      (unreadDms.data ?? []).map((dm) => ({
        id: `dm:${dm.sender.id}`,
        resource_id: dm.sender.id,
        type: "dm",
        actor: dm.sender.username,
        actor_name: dm.sender.display_name,
        actor_avatar_url: dm.sender.avatar_url,
        created_at: dm.created_at,
        body: dm.body,
        target_url: `/dm/${dm.sender.id}?message=${dm.id}`,
        read: false,
        weight: dm.count,
      })),
    [unreadDms.data],
  );

  const cards = useMemo<AggregatedCard[]>(() => {
    const events = [...dmEvents, ...notificationEvents]
      .filter((event) => inTab(event.type, tab))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return aggregateNotifications(events);
  }, [dmEvents, notificationEvents, tab]);

  const loading = items.isLoading || unreadDms.isLoading;

  const unreadCount =
    (items.data ?? []).filter((n: { read?: boolean }) => !n.read).length +
    (unreadDms.data ?? []).reduce((total, dm) => total + dm.count, 0);

  const markAll = useCallback(async () => {
    if (!user) return;
    const previousItems = items.data ?? [];
    const previousDms = unreadDms.data ?? [];
    qc.setQueryData(itemsKey, previousItems.map((n: Record<string, unknown>) => ({ ...n, read: true })));
    qc.setQueryData(dmKey, []);
    qc.invalidateQueries({ queryKey: ["unread-notifs"] });
    toast.success("All caught up");
    let results: [
      { error: { message: string } | null },
      { error: { message: string } | null },
    ];
    try {
      results = await Promise.all([
        supabase
          .from("notifications")
          .update({ read: true })
          .eq("user_id", user.id)
          .eq("read", false),
        supabase
          .from("direct_messages")
          .update({ read: true })
          .eq("recipient_id", user.id)
          .eq("read", false),
      ]);
    } catch (error) {
      qc.setQueryData(itemsKey, previousItems);
      qc.setQueryData(dmKey, previousDms);
      toast.error(error instanceof Error ? error.message : "Couldn't mark all as read");
      return;
    }

    const [notifResult, dmResult] = results;
    if (notifResult.error) {
      qc.setQueryData(itemsKey, previousItems);
      toast.error(notifResult.error.message);
    } else {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    }
    if (dmResult.error) {
      qc.setQueryData(dmKey, previousDms);
      toast.error(dmResult.error.message);
    } else {
      void qc.invalidateQueries({ queryKey: dmKey });
    }
  }, [user, items.data, unreadDms.data, qc, itemsKey, dmKey]);

  const markCardRead = useCallback(
    (card: AggregatedCard) => {
      if (!user) return;
      const notificationIds = card.eventIds.filter((id) => !id.startsWith("dm:"));
      if (notificationIds.length) {
        const previous = items.data ?? [];
        qc.setQueryData(
          itemsKey,
          previous.map((n: Record<string, unknown>) =>
            notificationIds.includes(String(n.id)) ? { ...n, read: true } : n,
          ),
        );
        void supabase
          .from("notifications")
          .update({ read: true })
          .eq("user_id", user.id)
          .in("id", notificationIds)
          .then(({ error }) => {
            if (error) qc.setQueryData(itemsKey, previous);
          });
      }
      if (card.type === "dm" && card.resource_id) {
        const previousDms = unreadDms.data ?? [];
        qc.setQueryData(
          dmKey,
          previousDms.filter((dm) => dm.sender.id !== card.resource_id),
        );
        void supabase
          .from("direct_messages")
          .update({ read: true })
          .eq("recipient_id", user.id)
          .eq("sender_id", card.resource_id)
          .eq("read", false)
          .then(({ error }) => {
            if (error) qc.setQueryData(dmKey, previousDms);
          });
      }
      qc.invalidateQueries({ queryKey: ["unread-notifs"] });
    },
    [user, items.data, unreadDms.data, qc, itemsKey, dmKey],
  );

  return (
    <div className="mx-auto w-full max-w-2xl pb-6">
      <header className="mb-3 flex items-start justify-between gap-3 px-1 sm:px-0">
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
            Inbox
          </p>
          <h1 className="mt-1 flex items-center gap-2 font-display text-[24px] font-bold tracking-[-0.03em] text-zinc-100 sm:text-[28px]">
            <Bell className="h-6 w-6 text-[#c9ff3d]" strokeWidth={1.75} />
            {t("notifications")}
            {unreadCount > 0 && (
              <span className="rounded-full bg-[#c9ff3d] px-2 py-0.5 font-mono text-[10px] font-bold text-black">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </h1>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => void markAll()}
            className="mt-1 inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/10 px-2.5 py-1.5 text-[10px] font-semibold text-zinc-400 transition-colors hover:border-[#c9ff3d]/35 hover:text-[#c9ff3d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9ff3d]/60"
          >
            <CheckCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
            {t("mark_all_read")}
          </button>
        )}
      </header>

      <div className="sticky top-0 z-20 -mx-3 border-b border-white/5 bg-black/80 px-3 py-2 backdrop-blur-md sm:-mx-0 sm:px-0">
        <div role="tablist" aria-label="Notification filters" className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {TABS.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(item.id)}
                className={
                  active
                    ? "shrink-0 rounded-full bg-[#c9ff3d] px-3 py-1.5 text-[11px] font-bold text-black"
                    : "shrink-0 rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-zinc-400 transition-colors hover:border-white/20 hover:text-zinc-200"
                }
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        {loading && cards.length === 0
          ? Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="flex items-center gap-3 rounded-xl border border-transparent p-3.5"
              >
                <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-zinc-800" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3 w-3/4 animate-pulse rounded bg-zinc-800" />
                  <div className="h-2.5 w-1/3 animate-pulse rounded bg-zinc-800/70" />
                </div>
              </div>
            ))
          : cards.map((card) => (
              <NotificationRow
                key={card.id}
                card={card}
                target_url={card.target_url}
                onTap={markCardRead}
              />
            ))}
      </div>

      {!loading && cards.length === 0 && (
        <div className="mt-8 rounded-[18px] border border-white/[0.08] bg-[#0e0e11] p-8 text-center">
          <RizzCat mood="sleepy" size={104} className="mx-auto mb-1" />
          <p className="text-sm text-zinc-500">
            {tab === "all" ? t("empty_all") : t("empty_tab")}
          </p>
        </div>
      )}
    </div>
  );
}
