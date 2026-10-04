import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchChannelBySlug, fetchMessages, sendMessage, joinChannel, leaveChannel, isMember } from "@/lib/channels";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Hash, Megaphone, Gift, Send, Users, Sparkles, Copy, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { MessageActionMenu } from "@/components/chat/MessageActionMenu";
import { MessageReactions } from "@/components/DMReactionsBar";

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
  const [openMessageId, setOpenMessageId] = useState<string | null>(null);
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
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, () => {
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
  const messageRows = messages.data ?? [];

  const handleSend = async () => {
    if (!user || !body.trim()) return;
    if (!joined) { toast.error("Join the channel to send messages"); return; }
    setSending(true);
    try {
      await sendMessage(c.id, user.id, body.trim());
      setBody("");
    } catch (e: any) { toast.error(e.message); } finally { setSending(false); }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("messages")
        .delete()
        .eq("id", messageId)
        .eq("author_id", user.id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("You can only delete messages you sent.");
      qc.setQueryData<any[]>(["messages", c.id], (current = []) =>
        current.filter((message) => message.id !== messageId),
      );
      toast.success("Message deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't delete that message");
    }
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
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div
        className="chat-bar relative z-20 flex shrink-0 items-center gap-3 border-b border-white/5 px-4 pb-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.5rem)", boxShadow: `0 0 18px ${c.accent_color}14` }}
      >
        <Link to="/channels" aria-label="Back to channels" className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-white/5"><ArrowLeft className="h-5 w-5" /></Link>
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
        <div className="chat-bar flex shrink-0 items-start gap-2 border-b border-white/5 px-4 py-3 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 mt-0.5 text-[var(--rizz-pink)] shrink-0" />
          {c.topic}
        </div>
      )}

      <div className="chat-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <AnimatePresence initial={false}>
          {messageRows.map((m: any, index: number) => {
            const mine = m.author_id === user?.id;
            const previous = messageRows[index - 1];
            const startsGroup = !previous ||
              previous.author_id !== m.author_id ||
              new Date(m.created_at).getTime() - new Date(previous.created_at).getTime() > 5 * 60 * 1000;
            return (
              <Fragment key={m.id}>
              {startsGroup && (
                <div className="py-1 text-center text-[10px] font-medium text-muted-foreground">
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </div>
              )}
              <motion.div id={`msg-${m.id}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mb-3 flex min-w-0 gap-3">
              {!mine && (startsGroup ? (
                <Avatar className="h-9 w-9 shrink-0 ring-2" style={{ boxShadow: `0 0 10px ${m.author?.accent_color || c.accent_color}66` }}>
                  <AvatarImage src={m.author?.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-gradient-primary text-xs font-bold">{(m.author?.username ?? "?").charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
              ) : <div aria-hidden="true" className="h-9 w-9 shrink-0" />)}
              <div className="flex-1 min-w-0">
                {startsGroup && <div className="flex items-baseline gap-2">
                  <span className="font-bold text-sm" style={{ color: m.author?.accent_color || undefined }}>{m.author?.display_name || m.author?.username}</span>
                </div>}
                <MessageActionMenu
                  open={openMessageId === m.id}
                  onOpenChange={(open) => setOpenMessageId(open ? m.id : null)}
                  align={mine ? "right" : "left"}
                  actions={[
                    {
                      label: "Copy message",
                      icon: Copy,
                      onSelect: () => {
                        void navigator.clipboard.writeText(m.body).then(
                          () => toast.success("Copied"),
                          () => toast.error("Couldn't copy this message"),
                        );
                      },
                    },
                    ...(mine
                      ? [{
                          label: "Delete message",
                          icon: Trash2,
                          destructive: true,
                          onSelect: () => { void handleDeleteMessage(m.id); },
                        }]
                      : []),
                  ]}
                >
                  <p className="chat-bubble min-w-[44px] w-fit max-w-[78%] rounded-2xl border border-white/10 bg-[var(--surface-bubble)] px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] select-none touch-manipulation">
                    {m.body}
                  </p>
                </MessageActionMenu>
                {joined && user && (
                  <MessageReactions messageId={m.id} messageType="channel" align={mine ? "right" : "left"} />
                )}
              </div>
            </motion.div>
            </Fragment>
          )})}
        </AnimatePresence>
        {messages.data?.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-20">No messages yet. Start the convo 🔥</div>
        )}
        <div ref={endRef} />
      </div>

      <div className="chat-bar relative z-20 shrink-0 border-t border-white/5 px-3 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)]">
        <div className="mx-auto flex w-full max-w-3xl gap-2">
          <Input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer: fine)").matches) { e.preventDefault(); handleSend(); } }}
            placeholder={joined ? "Message" : "Join to chat"}
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
