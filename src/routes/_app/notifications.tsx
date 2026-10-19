import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Bell,
  Hash,
  Heart,
  MessageCircle,
  MessagesSquare,
  Smile,
  CheckCheck,
  AtSign,
  UserPlus,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/lib/toast";
import { useI18n, formatRelativeTime, formatFullDate } from "@/lib/i18n";
import { RizzCat } from "@/components/RizzCat";
import { ProfilePreviewTrigger } from "@/components/ProfilePreview";
import { fetchCommentTargets, isGenericTitle } from "@/lib/notifications";

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

function NotificationsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"all" | "unread" | "like" | "comment" | "follow" | "mention">(
    "all",
  );
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
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);
    qc.invalidateQueries({ queryKey: ["notifications"] });
    qc.invalidateQueries({ queryKey: ["unread-notifs"] });
    toast.success("All caught up");
  };

  const filtered = useMemo(() => {
    const list = items.data ?? [];
    if (tab === "all") return list;
    if (tab === "unread") return list.filter((n: any) => !n.read);
    return list.filter((n: any) => n.type === tab || (tab === "like" && n.type === "reaction"));
  }, [items.data, tab]);

  const unreadCount = (items.data ?? []).filter((n: any) => !n.read).length;

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
        <TabsList className="glass border border-white/5">
          <TabsTrigger value="all">{t("tab_all")}</TabsTrigger>
          <TabsTrigger value="unread">{t("tab_unread")}</TabsTrigger>
          <TabsTrigger value="like">{t("tab_likes")}</TabsTrigger>
          <TabsTrigger value="comment">{t("tab_comments")}</TabsTrigger>
          <TabsTrigger value="follow">{t("tab_follows")}</TabsTrigger>
          <TabsTrigger value="mention">{t("tab_mentions")}</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-2">
        {filtered.map((n: any) => {
          const Icon = ICON[n.type] ?? Bell;
          const target = forumTarget(n);
          const comment = commentTargets.data?.get(n.id) ?? null;
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
                  {n.type === "like"
                    ? t("notif_liked")
                    : n.type === "comment"
                      ? t("notif_commented")
                      : n.type === "follow"
                        ? t("notif_followed")
                        : n.type === "mention"
                          ? t("notif_mentioned")
                          : n.type === "forum_reply"
                            ? t("notif_forum_reply")
                            : n.type === "forum_tag"
                              ? t("notif_forum_tag")
                              : t("notif_reacted")}
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
            <motion.div key={n.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
              {target ? (
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
              ) : n.post_id ? (
                <Link to="/p/$postId" params={{ postId: n.post_id }} className={shell}>
                  {inner}
                </Link>
              ) : (
                <div className={shell}>{inner}</div>
              )}
            </motion.div>
          );
        })}
      </div>

      {filtered.length === 0 && (
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
