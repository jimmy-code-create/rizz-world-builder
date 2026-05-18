import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle } from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_app/dms")({
  head: () => ({ meta: [{ title: "Messages · RIZZ" }] }),
  component: DMsPage,
});

function DMsPage() {
  const { user } = useAuth();
  const threads = useQuery({
    queryKey: ["dm-threads", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("direct_messages")
        .select("*, sender:profiles!direct_messages_sender_id_fkey(id,username,display_name,avatar_url), recipient:profiles!direct_messages_recipient_id_fkey(id,username,display_name,avatar_url)")
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(100);
      // group by other party
      const map = new Map<string, any>();
      for (const m of data ?? []) {
        const other = m.sender_id === user.id ? m.recipient : m.sender;
        if (!other) continue;
        if (!map.has(other.id)) map.set(other.id, { other, last: m });
      }
      return Array.from(map.values());
    },
    enabled: !!user,
  });

  return (
    <div>
      <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="font-display text-3xl font-bold tracking-tight mb-1">Messages</motion.h1>
      <p className="text-sm text-muted-foreground mb-6">Slide in those DMs.</p>

      <div className="space-y-2">
        {threads.data?.map(({ other, last }) => (
          <Link key={other.id} to="/dm/$userId" params={{ userId: other.id }}>
            <motion.div whileHover={{ x: 4 }} className="glass rounded-2xl p-4 border border-white/5 flex items-center gap-3">
              <Avatar className="h-12 w-12 ring-2 ring-[var(--rizz-pink)]/40">
                <AvatarImage src={other.avatar_url ?? undefined} />
                <AvatarFallback className="bg-gradient-primary font-bold">{(other.username ?? "?").charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate">{other.display_name || other.username}</p>
                <p className="text-xs text-muted-foreground truncate">{last.body}</p>
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">{new Date(last.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
            </motion.div>
          </Link>
        ))}
      </div>

      {threads.data?.length === 0 && (
        <div className="glass rounded-3xl p-10 text-center">
          <MessageCircle className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No conversations yet. Go say hi from someone's profile.</p>
        </div>
      )}
    </div>
  );
}
