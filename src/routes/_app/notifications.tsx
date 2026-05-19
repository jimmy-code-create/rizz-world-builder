import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Bell, Heart, MessageCircle, UserPlus, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/notifications")({
  head: () => ({ meta: [{ title: "Notifications · RIZZ" }] }),
  component: NotificationsPage,
});

const ICON: Record<string, any> = { like: Heart, comment: MessageCircle, follow: UserPlus, reaction: Sparkles };

function NotificationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
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
    // Mark all as read on view
    supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false).then();
    const ch = supabase.channel("notifs-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => qc.invalidateQueries({ queryKey: ["notifications"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  return (
    <div>
      <h1 className="font-display text-3xl font-bold tracking-tight mb-1 flex items-center gap-2">
        <Bell className="h-7 w-7 text-[var(--rizz-pink)]" /> Notifications
      </h1>
      <p className="text-sm text-muted-foreground mb-6">All the buzz, in one place.</p>

      <div className="space-y-2">
        {items.data?.map((n: any) => {
          const Icon = ICON[n.type] ?? Bell;
          return (
            <motion.div key={n.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className={`glass rounded-2xl p-4 border ${n.read ? "border-white/5" : "border-[var(--rizz-pink)]/30 shadow-glow"} flex items-center gap-3`}>
              <div className="h-10 w-10 rounded-xl bg-gradient-primary/20 flex items-center justify-center"><Icon className="h-5 w-5 text-[var(--rizz-pink)]" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm"><span className="font-bold">@{n.actor?.username}</span> {n.type === "like" ? "liked your post" : n.type === "comment" ? "commented on your post" : n.type === "follow" ? "started following you" : "reacted to your post"}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(n.created_at).toLocaleString()}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {items.data?.length === 0 && (
        <div className="glass rounded-3xl p-10 text-center">
          <Bell className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nothing yet. Go drop a vibe.</p>
        </div>
      )}
    </div>
  );
}