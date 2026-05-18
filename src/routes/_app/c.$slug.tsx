import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchChannelBySlug, fetchMessages, sendMessage, joinChannel, leaveChannel, isMember } from "@/lib/channels";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Hash, Megaphone, Gift, Send, Users, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const TYPE_ICON = { text: Hash, announcement: Megaphone, drops: Gift };

export const Route = createFileRoute("/_app/c/$slug")({
  head: ({ params }) => ({ meta: [{ title: `#${params.slug} · RIZZ` }] }),
  component: ChannelPage,
});

function ChannelPage() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const channel = useQuery({ queryKey: ["channel", slug], queryFn: () => fetchChannelBySlug(slug) });
  const messages = useQuery({
    queryKey: ["messages", channel.data?.id],
    queryFn: () => fetchMessages(channel.data!.id),
    enabled: !!channel.data,
  });
  const [joined, setJoined] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (channel.data && user) {
      isMember(channel.data.id, user.id).then(setJoined);
    }
  }, [channel.data, user]);

  useEffect(() => {
    if (!channel.data) return;
    const ch = supabase
      .channel(`messages-${channel.data.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${channel.data.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["messages", channel.data!.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [channel.data, qc]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data]);

  if (channel.isLoading) return <div className="h-64 animate-pulse rounded-3xl glass" />;
  if (!channel.data) return <div className="text-center py-20"><h1 className="font-display text-2xl font-bold">Channel not found</h1></div>;

  const c: any = channel.data;
  const Icon = TYPE_ICON[c.type as keyof typeof TYPE_ICON] ?? Hash;

  const handleSend = async () => {
    if (!user || !body.trim()) return;
    if (!joined) { toast.error("Join the channel to send messages"); return; }
    setSending(true);
    try {
      await sendMessage(c.id, user.id, body.trim());
      setBody("");
    } catch (e: any) { toast.error(e.message); } finally { setSending(false); }
  };

  const handleJoin = async () => {
    if (!user) return;
    if (joined) {
      await leaveChannel(c.id, user.id);
      setJoined(false);
      toast.success("Left channel");
    } else {
      await joinChannel(c.id, user.id);
      setJoined(true);
      toast.success("Joined!");
    }
    qc.invalidateQueries({ queryKey: ["channel", slug] });
  };

  return (
    <div className="-my-6 md:-my-10">
      <div className="sticky top-0 md:top-0 z-20 glass-strong border-b border-white/5 px-4 py-3 flex items-center gap-3" style={{ boxShadow: `0 0 30px ${c.accent_color}22` }}>
        <Link to="/channels" className="md:hidden"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${c.accent_color}, var(--rizz-violet))` }}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-bold text-lg leading-tight truncate">{c.name}</h1>
          <p className="text-xs text-muted-foreground truncate flex items-center gap-1"><Users className="h-3 w-3" /> {c.member_count}</p>
        </div>
        <Button size="sm" variant={joined ? "outline" : "default"} onClick={handleJoin} className={joined ? "glass border-white/10" : "bg-gradient-primary border-0 shadow-glow"}>
          {joined ? "Joined" : "Join"}
        </Button>
      </div>

      {c.topic && (
        <div className="px-4 py-3 border-b border-white/5 text-sm text-muted-foreground flex items-start gap-2">
          <Sparkles className="h-4 w-4 mt-0.5 text-[var(--rizz-pink)] shrink-0" />
          {c.topic}
        </div>
      )}

      <div className="px-4 py-4 min-h-[60vh] pb-32">
        <AnimatePresence initial={false}>
          {messages.data?.map((m: any) => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 mb-3">
              <Avatar className="h-9 w-9 shrink-0 ring-2" style={{ boxShadow: `0 0 10px ${m.author?.accent_color || c.accent_color}66` }}>
                <AvatarImage src={m.author?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-gradient-primary text-xs font-bold">{(m.author?.username ?? "?").charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-sm" style={{ color: m.author?.accent_color || undefined }}>{m.author?.display_name || m.author?.username}</span>
                  <span className="text-[10px] text-muted-foreground">{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{m.body}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {messages.data?.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-20">No messages yet. Start the convo 🔥</div>
        )}
        <div ref={endRef} />
      </div>

      <div className="fixed bottom-20 md:bottom-0 inset-x-0 md:left-64 z-20 p-3 glass-strong border-t border-white/5">
        <div className="max-w-3xl mx-auto flex gap-2">
          <Input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={joined ? `Message #${c.name}` : "Join to chat"}
            disabled={!joined || sending}
            maxLength={500}
            className="glass border-white/10"
          />
          <Button onClick={handleSend} disabled={!joined || !body.trim() || sending} size="icon" className="bg-gradient-primary border-0 shadow-glow shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
