import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  AtSign,
  Ban,
  Bell,
  CheckCheck,
  Clock,
  Coins,
  Hand,
  Hash,
  Heart,
  MessageCircle,
  MessagesSquare,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Smile,
  Undo2,
  Upload,
  UserPlus,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/lib/toast";
import { useI18n, formatRelativeTime, formatFullDate } from "@/lib/i18n";
import { RizzCat } from "@/components/RizzCat";
import { ProfilePreviewTrigger } from "@/components/ProfilePreview";
import { fetchCommentTargets, isGenericTitle } from "@/lib/notifications";
import { aggregateNotifications, type AggregatedCard, type NotifEvent } from "@/lib/notifications-aggregation";
import { NotificationRow } from "@/components/notifications/NotificationRow";

export const Route = createFileRoute("/_app/notifications")({
  head: () => ({ meta: [{ title: "Notifications · RIZZ" }] }),
  component: NotificationsPage,
});

const ICON: Record<string, any> = {
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
  reaction: Smile,
  mention: AtSign,
  // Forum notifications: a reply to your thread, or a new post in a tag you follow.
  forum_reply: MessagesSquare,
  forum_tag: Hash,
  // Bounties: one icon per event, so the inbox reads at a glance.
  bounty_taken: Hand,
  bounty_released: Undo2,
  bounty_submitted: Upload,
  bounty_paid: Coins,
  bounty_rejected: Undo2,
  bounty_cancelled: Ban,
  bounty_warned: AlertTriangle,
  bounty_auto_blocked: ShieldAlert,
  bounty_appeal_filed: ShieldAlert,
  bounty_warning_upheld: ShieldCheck,
  bounty_warning_rejected: ShieldX,
  bounty_fee_charged: Coins,
  bounty_deadline_missed: Clock,
};

/**
 * One sentence per notification type. The map is exhaustive on purpose and is
 * checked against the database's writers by the bounty test suite: a type that
 * is missing here silently renders as "reacted to your post".
 */
const NOTIF_COPY: Record<string, string> = {
  like: "notif_liked",
  comment: "notif_commented",
  follow: "notif_followed",
  mention: "notif_mentioned",
  forum_reply: "notif_forum_reply",
  forum_tag: "notif_forum_tag",
  reaction: "notif_reacted",
  bounty_taken: "notif_bounty_taken",
  bounty_released: "notif_bounty_released",
  bounty_submitted: "notif_bounty_submitted",
  bounty_paid: "notif_bounty_paid",
  bounty_rejected: "notif_bounty_rejected",
  bounty_cancelled: "notif_bounty_cancelled",
  bounty_warned: "notif_bounty_warned",
  bounty_auto_blocked: "notif_bounty_auto_blocked",
  bounty_appeal_filed: "notif_bounty_appeal_filed",
  bounty_warning_upheld: "notif_bounty_warning_upheld",
  bounty_warning_rejected: "notif_bounty_warning_rejected",
  bounty_fee_charged: "notif_bounty_fee_charged",
  bounty_deadline_missed: "notif_bounty_deadline_missed",
};

/**
 * Forum notifications carry where they came from — the realm slug, the channel
 * and the thread — so tapping one opens that thread instead of the forum root.
 */
function forumTarget(n: any): { slug: string; room: string; post: string } | null {
  const data = n?.data as { realm_slug?: string; room_id?: string; post_id?: string } | null;
  if (!data?.realm_slug || !data?.room_id || !data?.post_id) return null;
  return { slug: data.realm_slug, room: data.room_id, post: data.post_id };
}

/**
 * A mention knows exactly which message it came from: the trigger stores
 * `message_id` plus the realm or group it belongs to. Tapping the row opens
 * that conversation on that message, which the chat then highlights.
 */
function mentionTarget(
  n: any,
):
  | { kind: "group"; groupId: string; messageId: string }
  | { kind: "realm"; realmId: string; messageId: string }
  | null {
  const data = n?.data as {
    source?: string;
    message_id?: string;
    group_id?: string;
    realm_id?: string;
  } | null;
  if (!data?.message_id) return null;
  if (data.source === "group" && data.group_id) {
    return { kind: "group", groupId: data.group_id, messageId: data.message_id };
  }
  if (data.source === "realm" && data.realm_id) {
    return { kind: "realm", realmId: data.realm_id, messageId: data.message_id };
  }
  return null;
}

function NotificationsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [tab, setTab] = useState<
    "all" | "unread" | "messages" | "like" | "comment" | "follow" | "mention" | "bounties"
  >("all");
  const items = useQuery({
    queryKey: ["notifications", user?.id],
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
    const ch = supabase
      .channel("notifs-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["notifications"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, qc]);

  const markAll = async () => {
    if (!user) return;
    const previous = items.data ?? [];
    // Optimistic update in the TanStack Query cache.
    const optimistic = previous.map((n) => ({ ...n, read: true }));
    qc.setQueryData(["notifications", user!.id], optimistic);
    qc.invalidateQueries({ queryKey: ["unread-notifs"] });
    toast.success("All caught up");
    try {
      // Batch mark-all-read: a single update touches every unread row at once.
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);
      qc.invalidateQueries({ queryKey: ["notifications"] });
    } catch (error) {
      // Roll back the optimistic cache on error.
      qc.setQueryData(["notifications", user!.id], previous);
      toast.error(
        error instanceof Error ? error.message : "Couldn't mark all as read",
      );
    }
  };

  const filtered = useMemo(() => {
    const list = items.data ?? [];
    if (tab === "all") return list;
    if (tab === "unread") return list.filter((n: any) => !n.read);
    // Bounties are one lifecycle, not seven types: every event belongs here.
    if (tab === "bounties") return list.filter((n: any) => String(n.type).startsWith("bounty"));
    return list.filter((n: any) => n.type === tab || (tab === "like" && n.type === "reaction"));
  }, [items.data, tab]);

  // Convert DB rows into aggregation events and collapse them into cards for
  // the "All" tab. Other tabs keep their existing per-row rendering unchanged.
  const allEvents = useMemo<NotifEvent[]>(() => {
    return (items.data ?? []).map((n: any) => ({
      id: n.id,
      resource_id: n.post_id ?? null,
      type: n.type,
      actor: n.actor?.username ?? null,
      created_at: n.created_at,
      body: n.body ?? null,
      target_url: n.post_id ? `/p/${n.post_id}` : null,
      ...(n.is_test ? { is_test: true } : {}),
    }));
  }, [items.data]);

  const allCards = useMemo<AggregatedCard[]>(() => {
    return aggregateNotifications(allEvents);
  }, [allEvents]);

  const unreadCount = (items.data ?? []).filter((n: any) => !n.read).length;

  // Discord's inbox has messages in it, not just likes: the unread DM threads
  // live here with a direct link to the exact message that is waiting.
  const unreadDms = useQuery({
    queryKey: ["notif-unread-dms", user?.id],
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
        sender: {
          id: string;
          username: string | null;
          display_name: string | null;
          avatar_url: string | null;
        } | null;
      };
      const seen = new Map<
        string,
        {
          id: string;
          body: string;
          created_at: string;
          sender: NonNullable<UnreadDmRow["sender"]>;
          count: number;
        }
      >();
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

  // Mentions only store ids; the realm link needs the slug.
  const mentionRealmIds = useMemo(
    () => [
      ...new Set(
        (items.data ?? [])
          .map((n: any) => mentionTarget(n))
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

  // The trigger behind a "commented on your post" notification only writes the
  // label "New Comment", so the comment itself is recovered here and the row
  // becomes a link to the post it belongs to.
  const commentTargets = useQuery({
    queryKey: ["notification-comment-targets", user?.id, (items.data ?? []).length],
    queryFn: () => fetchCommentTargets(items.data ?? []),
    enabled: !!user && (items.data ?? []).some((n: any) => n.type === "comment"),
    staleTime: 30_000,
  });

  return (
    <div>
      <div className="flex items-end justify-between gap-3 mb-1">
        <h1 className="font-display text-3xl font-bold tracking-tight flex items-center gap-2">
          <Bell className="h-7 w-7 text-primary" /> {t("notifications")}
          {unreadCount > 0 && (
            <span className="text-xs font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </h1>
        {unreadCount > 0 && (
          <Button onClick={markAll} size="sm" variant="ghost" className="text-xs gap-1.5">
            <CheckCheck className="h-3.5 w-3.5" /> {t("mark_all_read")}
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-4">{t("notif_subtitle")}</p>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mb-4">
        <TabsList className="no-scrollbar glass w-full max-w-full justify-start overflow-x-auto border border-white/5">
          <TabsTrigger value="all">{t("tab_all")}</TabsTrigger>
          <TabsTrigger value="unread">{t("tab_unread")}</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="like">{t("tab_likes")}</TabsTrigger>
          <TabsTrigger value="comment">{t("tab_comments")}</TabsTrigger>
          <TabsTrigger value="follow">{t("tab_follows")}</TabsTrigger>
          <TabsTrigger value="mention">{t("tab_mentions")}</TabsTrigger>
          <TabsTrigger value="bounties">Bounties</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-2">
        {tab === "messages" &&
          (unreadDms.data ?? []).map((dm) => (
            <Link
              key={dm.sender.id}
              to="/dm/$userId"
              params={{ userId: dm.sender.id }}
              search={{ message: dm.id }}
              className="glass flex w-full items-center gap-3 rounded-2xl border border-primary/40 bg-card p-4 text-left"
            >
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={dm.sender.avatar_url ?? undefined} alt="" />
                <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">
                  {(dm.sender.display_name || dm.sender.username || "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {dm.sender.display_name || dm.sender.username}
                </p>
                <p className="truncate text-xs text-muted-foreground">{dm.body}</p>
              </div>
              <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                {dm.count}
              </span>
            </Link>
          ))}

        {tab !== "messages" ? (
          tab === "all" ? (
            <>
              {allCards.map((card) => (
                <NotificationRow
                  key={card.id}
                  card={card}
                  target_url={card.target_url}
                />
              ))}
            </>
          ) : (
            filtered.map((n: any) => {
              const Icon = ICON[n.type] ?? Bell;
            const target = forumTarget(n);
            const comment = commentTargets.data?.get(n.id) ?? null;
            const mention = mentionTarget(n);
            const mentionRealmSlug =
              mention?.kind === "realm" ? (realmSlugs.data?.get(mention.realmId) ?? null) : null;
            const shell = `glass rounded-2xl p-4 border ${n.read ? "border-white/5" : "border-primary/40 bg-card"} flex items-center gap-3 w-full text-left`;
            const inner = (
              <>
                <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/15 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm flex-1 min-w-0">
                    {n.actor?.username ? (
                      <ProfilePreviewTrigger
                        username={n.actor.username}
                        className="font-bold hover:underline"
                      >
                        @{n.actor.username}
                      </ProfilePreviewTrigger>
                    ) : (
                      <span className="font-bold">@someone</span>
                    )}{" "}
                    {t(NOTIF_COPY[n.type] ?? "notif_reacted")}
                    {(n.type === "mention" || n.type === "forum_reply" || n.type === "forum_tag") &&
                      n.body && (
                        <span className="block text-xs text-muted-foreground truncate mt-0.5">
                          “{n.body}”
                        </span>
                      )}
                    {comment && (
                      <span className="block text-xs text-foreground/90 truncate mt-0.5">
                        “{comment.body}”
                      </span>
                    )}
                    {comment?.postCaption && (
                      <span className="block text-[11px] text-muted-foreground truncate">
                        on “{comment.postCaption}”
                      </span>
                    )}
                    {!comment && n.type !== "mention" && n.title && !isGenericTitle(n.title) && (
                      <span className="block text-xs text-muted-foreground truncate mt-0.5">
                        {n.title}
                      </span>
                    )}
                  </p>
                  <p
                    className="text-[10px] text-muted-foreground mt-0.5"
                    title={formatFullDate(n.created_at)}
                  >
                    {formatRelativeTime(n.created_at)}
                  </p>
                </div>
              </>
            );
            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
              >
                {mention?.kind === "group" ? (
                  <Link
                    to="/g/$id"
                    params={{ id: mention.groupId }}
                    search={{ message: mention.messageId }}
                    className={shell}
                  >
                    {inner}
                  </Link>
                ) : mention && mentionRealmSlug ? (
                  <Link
                    to="/r/$slug"
                    params={{ slug: mentionRealmSlug }}
                    search={{ message: mention.messageId }}
                    className={shell}
                  >
                    {inner}
                  </Link>
                ) : target ? (
                  <Link
                    to="/r/$slug"
                    params={{ slug: target.slug }}
                    search={{ room: target.room, post: target.post }}
                    className={shell}
                  >
                    {inner}
                  </Link>
                ) : comment ? (
                  <Link
                    to="/p/$postId"
                    params={{ postId: n.post_id }}
                    search={{ comment: comment.commentId }}
                    className={shell}
                  >
                    {inner}
                  </Link>
                ) : typeof n.type === "string" && n.type.startsWith("bounty") ? (
                  // Every bounty event happens on one board, so they all land
                  // there — the card for this bounty is the next move anyway.
                  <Link to="/drops" className={shell}>
                    {inner}
                  </Link>
                ) : n.post_id ? (
                  <Link to="/p/$postId" params={{ postId: n.post_id }} className={shell}>
                    {inner}
                  </Link>
                ) : (
                  <div className={shell}>{inner}</div>
                )}
              </motion.div>
            );
          })
          )
        ) : null}
      </div>

      {tab === "messages" && (unreadDms.data ?? []).length === 0 && (
        <div className="glass rounded-3xl p-8 text-center">
          <RizzCat mood="sleepy" size={112} className="mx-auto mb-1" />
          <p className="text-sm text-muted-foreground">No unread messages</p>
        </div>
      )}

      {tab !== "messages" && filtered.length === 0 && (
        <div className="glass rounded-3xl p-8 text-center">
          <RizzCat mood="sleepy" size={112} className="mx-auto mb-1" />
          <p className="text-sm text-muted-foreground">
            {tab === "all" ? t("empty_all") : t("empty_tab")}
          </p>
        </div>
      )}
    </div>
  );
}
