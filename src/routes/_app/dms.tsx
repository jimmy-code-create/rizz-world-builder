import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_app/dms")({
  head: () => ({ meta: [{ title: "Messages · RIZZ" }] }),
  component: DMsPage,
});

function DMsPage() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
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
      const map = new Map<string, { other: any; last: any; unread: number }>();
      for (const m of data ?? []) {
        const other = m.sender_id === user.id ? m.recipient : m.sender;
        if (!other) continue;
        const e = map.get(other.id);
        const isUnread = m.recipient_id === user.id && !m.read;
        if (!e) map.set(other.id, { other, last: m, unread: isUnread ? 1 : 0 });
        else if (isUnread) e.unread += 1;
      }
      return Array.from(map.values());
    },
    enabled: !!user,
    refetchInterval: 15000,
  });

  const filtered = useMemo(() => {
    const list = threads.data ?? [];
    if (!q.trim()) return list;
    const t = q.toLowerCase();
    return list.filter(({ other }) =>
      other.username?.toLowerCase().includes(t) || other.display_name?.toLowerCase().includes(t),
    );
  }, [threads.data, q]);

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return "now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <div>
      <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="font-display text-3xl font-bold tracking-tight mb-1">Messages</motion.h1>
      <p className="text-sm text-muted-foreground mb-6">Slide in those DMs.</p>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search conversations…" className="pl-9 glass border-white/10" />
      </div>

      <div className="space-y-2">
        {filtered.map(({ other, last, unread }) => (
          <Link key={other.id} to="/dm/$userId" params={{ userId: other.id }}>
            <motion.div whileHover={{ x: 4 }} className={`glass rounded-2xl p-4 border flex items-center gap-3 ${unread > 0 ? "border-[var(--rizz-pink)]/30 shadow-glow" : "border-white/5"}`}>
              <Avatar className="h-12 w-12 ring-2 ring-[var(--rizz-pink)]/40">
                <AvatarImage src={other.avatar_url ?? undefined} />
                <AvatarFallback className="bg-gradient-primary font-bold">{(other.username ?? "?").charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate">{other.display_name || other.username}</p>
                <p className={`text-xs truncate ${unread > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>{last.body}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-[10px] text-muted-foreground">{fmtTime(last.created_at)}</span>
                {unread > 0 && (
                  <span className="text-[10px] font-bold bg-[var(--rizz-pink)] text-white px-1.5 py-0.5 rounded-full min-w-5 text-center">{unread}</span>
                )}
              </div>
            </motion.div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="glass rounded-3xl p-10 text-center">
          <MessageCircle className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{q ? "No matches." : "No conversations yet. Go say hi from someone's profile."}</p>
        </div>
      )}
    </div>
  );
}
