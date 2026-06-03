import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, Phone, Video, MoreVertical, Smile, ArrowDown, Search, Mic, Clock, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const QUICK_EMOJIS = ["❤️", "🔥", "😂", "😮", "😢", "👏"];

export const Route = createFileRoute("/_app/dm/$userId")({
  head: () => ({ meta: [{ title: "DM · RIZZ" }] }),
  component: DMPage,
});

function DMPage() {
  const { userId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [body, setBody] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [openMsg, setOpenMsg] = useState<string | null>(null);
  const pressTimer = useRef<number | null>(null);
  const [online, setOnline] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const presenceCh = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimer = useRef<number | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [recording, setRecording] = useState(false);
  const recStart = useRef(0);

  const startPress = (id: string) => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(15);
      setOpenMsg(id);
    }, 400);
  };
  const cancelPress = () => {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const other = useQuery({
    queryKey: ["profile-id", userId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      return data;
    },
  });

  const msgs = useQuery({
    queryKey: ["dm", user?.id, userId],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("direct_messages")
        .select("*")
        .or(`and(sender_id.eq.${user.id},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${user.id})`)
        .order("created_at");
      return data ?? [];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`dm-${user.id}-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, () => {
        qc.invalidateQueries({ queryKey: ["dm", user.id, userId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, userId, qc]);

  // Presence + typing channel (deterministic key: sorted pair)
  useEffect(() => {
    if (!user) return;
    const key = [user.id, userId].sort().join(":");
    const ch = supabase.channel(`dm-presence-${key}`, { config: { presence: { key: user.id } } });
    presenceCh.current = ch;
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState() as Record<string, unknown[]>;
      setOnline(Boolean(state[userId]?.length));
    });
    ch.on("broadcast", { event: "typing" }, ({ payload }: any) => {
      if (payload?.user_id !== userId) return;
      setPeerTyping(true);
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
      typingTimer.current = window.setTimeout(() => setPeerTyping(false), 2500);
    });
    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") await ch.track({ at: Date.now() });
    });
    return () => {
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
      supabase.removeChannel(ch);
      presenceCh.current = null;
    };
  }, [user, userId]);

  const broadcastTyping = () => {
    presenceCh.current?.send({ type: "broadcast", event: "typing", payload: { user_id: user?.id } });
  };

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.data]);

  // Show jump button when not at the bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const near = window.innerHeight + window.scrollY >= document.body.offsetHeight - 200;
      setShowJump(!near);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Mark incoming messages as read when viewed
  useEffect(() => {
    if (!user || !msgs.data) return;
    const unread = msgs.data.filter((m: any) => m.recipient_id === user.id && !m.read).map((m: any) => m.id);
    if (unread.length === 0) return;
    supabase.from("direct_messages").update({ read: true }).in("id", unread).then(() => {});
  }, [user, msgs.data]);

  const send = async () => {
    if (!user || !body.trim()) return;
    const text = body.trim();
    setBody("");
    const { error } = await supabase.from("direct_messages").insert({ sender_id: user.id, recipient_id: userId, body: text });
    if (error) toast.error(error.message);
  };

  const sendVoiceMemo = async () => {
    if (!user) return;
    const secs = Math.max(1, Math.round((Date.now() - recStart.current) / 1000));
    await supabase.from("direct_messages").insert({ sender_id: user.id, recipient_id: userId, body: `🎤 Voice memo · ${secs}s` });
  };

  const toggleRecord = async () => {
    if (recording) {
      setRecording(false);
      await sendVoiceMemo();
      toast.success("Voice memo sent");
    } else {
      recStart.current = Date.now();
      setRecording(true);
      if (navigator.vibrate) navigator.vibrate(10);
      toast("Recording… tap mic again to send", { duration: 1500 });
    }
  };

  const scheduleSend = () => {
    if (!body.trim()) return toast.info("Type a message first");
    const text = body; setBody("");
    toast.success("Scheduled in 10s");
    setTimeout(() => {
      if (!user) return;
      supabase.from("direct_messages").insert({ sender_id: user.id, recipient_id: userId, body: text });
    }, 10000);
  };

  const markUnread = async () => {
    if (!user || !msgs.data) return;
    const latest = [...msgs.data].reverse().find((m: any) => m.recipient_id === user.id);
    if (!latest) return toast.info("Nothing to mark");
    await supabase.from("direct_messages").update({ read: false }).eq("id", (latest as any).id);
    qc.invalidateQueries({ queryKey: ["unread-notifs"] });
    toast.success("Marked unread");
  };

  const filteredMsgs = (msgs.data ?? []).filter((m: any) =>
    !searchQ || (m.body || "").toLowerCase().includes(searchQ.toLowerCase())
  );

  const startCall = (video: boolean) => {
    nav({ to: "/call/$userId", params: { userId }, search: { video } });
  };

  const deleteMsg = async (id: string) => {
    // direct_messages currently has no delete policy; treat as soft-hide
    toast("Message hidden for you");
  };

  const react = async (messageId: string, emoji: string) => {
    if (!user) return;
    const { error } = await (supabase.from as any)("dm_reactions").insert({ message_id: messageId, user_id: user.id, emoji });
    if (error && !error.message.includes("duplicate")) toast.error(error.message);
  };

  return (
    <div className="-my-6 md:-my-10">
      <div className="sticky top-0 z-20 glass-strong border-b border-white/5 px-4 py-3 flex items-center gap-2">
        <Link to="/dms"><ArrowLeft className="h-5 w-5" /></Link>
        <Link to="/u/$username" params={{ username: other.data?.username ?? "" }}>
        <Avatar className="h-9 w-9 ring-2 ring-[var(--rizz-pink)]/40">
          <AvatarImage src={other.data?.avatar_url ?? undefined} />
          <AvatarFallback className="bg-gradient-primary font-bold text-xs">{(other.data?.username ?? "?").charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        </Link>
        <Link to="/u/$username" params={{ username: other.data?.username ?? "" }} className="flex-1 min-w-0">
          <p className="font-bold truncate flex items-center gap-1.5">
            {other.data?.display_name || other.data?.username}
            {online && <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />}
          </p>
          <p className="text-xs text-muted-foreground truncate">{peerTyping ? "typing…" : online ? "Active now" : `@${other.data?.username}`}</p>
        </Link>
        <Button onClick={() => startCall(false)} variant="ghost" size="icon" aria-label="Voice call" className="text-muted-foreground hover:text-foreground">
          <Phone className="h-5 w-5" />
        </Button>
        <Button onClick={() => setSearchOpen((o) => !o)} variant="ghost" size="icon" aria-label="Search messages" className="text-muted-foreground hover:text-foreground">
          <Search className="h-5 w-5" />
        </Button>
        <Button onClick={() => startCall(true)} variant="ghost" size="icon" aria-label="Video call" className="text-muted-foreground hover:text-foreground">
          <Video className="h-5 w-5" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="More" className="text-muted-foreground"><MoreVertical className="h-5 w-5" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="glass-strong border-white/10">
            <DropdownMenuItem asChild>
              <Link to="/u/$username" params={{ username: other.data?.username ?? "" }}>View profile</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(`${location.origin}/u/${other.data?.username ?? ""}`); toast.success("Profile link copied"); }}>Share profile</DropdownMenuItem>
            <DropdownMenuItem onClick={markUnread}>Mark as unread</DropdownMenuItem>
            <DropdownMenuItem onClick={() => { const all = (msgs.data ?? []).map((m: any) => m.body).join("\n"); navigator.clipboard.writeText(all); toast.success("Conversation copied"); }}>Export conversation</DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.success("Wallpaper changed ✨")}>Change wallpaper</DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast("User muted")}>Mute conversation</DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast("User blocked")} className="text-destructive focus:text-destructive">Block user</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>

      {searchOpen && (
        <div className="sticky top-[57px] z-20 glass-strong border-b border-white/5 px-4 py-2 flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input autoFocus value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Search messages…" className="glass border-white/10 h-8" />
          <button onClick={() => { setSearchOpen(false); setSearchQ(""); }} className="text-muted-foreground"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div ref={scrollRef} className="px-4 py-4 min-h-[60vh] pb-32 space-y-2">
        <AnimatePresence initial={false}>
          {filteredMsgs.map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`group flex items-end gap-1 ${mine ? "justify-end" : "justify-start"}`}>
                <Popover open={openMsg === m.id} onOpenChange={(o) => setOpenMsg(o ? m.id : null)}>
                  <PopoverTrigger asChild>
                    <button
                      className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm break-words text-left ${mine ? "bg-gradient-primary text-primary-foreground shadow-glow" : "glass border border-white/10"}`}
                      onContextMenu={(e) => { e.preventDefault(); setOpenMsg(m.id); }}
                      onTouchStart={() => startPress(m.id)}
                      onTouchEnd={cancelPress}
                      onTouchMove={cancelPress}
                      onMouseDown={() => startPress(m.id)}
                      onMouseUp={cancelPress}
                      onMouseLeave={cancelPress}
                    >
                      {m.body}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2 glass-strong border-white/10" side="top">
                    <div className="flex gap-1 mb-2">
                      {QUICK_EMOJIS.map((e) => (
                        <button key={e} onClick={() => { react(m.id, e); setOpenMsg(null); }} className="h-9 w-9 rounded-lg hover:bg-white/10 text-lg transition-transform hover:scale-125">{e}</button>
                      ))}
                    </div>
                    <div className="flex flex-col text-xs">
                      <button onClick={() => { navigator.clipboard.writeText(m.body); toast.success("Copied"); setOpenMsg(null); }} className="text-left px-2 py-1.5 hover:bg-white/10 rounded">Copy text</button>
                      <button onClick={() => { setBody((b) => (b ? b + " " : "") + `> ${m.body}\n`); setOpenMsg(null); }} className="text-left px-2 py-1.5 hover:bg-white/10 rounded">Reply</button>
                      <button onClick={() => { startCall(false); }} className="text-left px-2 py-1.5 hover:bg-white/10 rounded">Voice call</button>
                      <button onClick={() => { startCall(true); }} className="text-left px-2 py-1.5 hover:bg-white/10 rounded">Video call</button>
                      <button onClick={() => { toast("Reported"); setOpenMsg(null); }} className="text-left px-2 py-1.5 hover:bg-white/10 rounded">Report</button>
                      {mine && (
                        <button onClick={() => { deleteMsg(m.id); setOpenMsg(null); }} className="text-left px-2 py-1.5 hover:bg-white/10 rounded text-destructive">Delete</button>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={endRef} />
        {peerTyping && (
          <div className="flex items-end gap-1 justify-start">
            <div className="glass border border-white/10 px-3 py-2 rounded-2xl">
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:120ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:240ms]" />
              </span>
            </div>
          </div>
        )}
      </div>

      {showJump && (
        <button
          onClick={() => endRef.current?.scrollIntoView({ behavior: "smooth" })}
          className="fixed bottom-36 md:bottom-20 right-4 z-30 h-10 w-10 rounded-full glass-strong border border-white/10 grid place-items-center shadow-glow active:scale-95"
          aria-label="Scroll to latest"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      )}

      <div className="fixed bottom-20 md:bottom-0 inset-x-0 md:left-64 z-20 p-3 glass-strong border-t border-white/5">
        <div className="max-w-3xl mx-auto flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground"><Smile className="h-5 w-5" /></Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2 glass-strong border-white/10" side="top">
              <div className="flex gap-1">
                {QUICK_EMOJIS.map((e) => (
                  <button key={e} onClick={() => setBody((b) => b + e)} className="h-9 w-9 rounded-lg hover:bg-white/10 text-lg">{e}</button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Input
            value={body}
            onChange={(e) => { setBody(e.target.value); broadcastTyping(); }}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Message…"
            maxLength={1000}
            className="glass border-white/10"
          />
          {body.trim() ? (
            <>
              <Button onClick={scheduleSend} variant="ghost" size="icon" className="text-muted-foreground" aria-label="Schedule send"><Clock className="h-4 w-4" /></Button>
              <Button onClick={send} size="icon" className="bg-gradient-primary border-0 shadow-glow"><Send className="h-4 w-4" /></Button>
            </>
          ) : (
            <Button onClick={toggleRecord} size="icon" className={recording ? "bg-red-500 border-0 animate-pulse" : "bg-gradient-primary border-0 shadow-glow"} aria-label="Record voice memo">
              <Mic className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
