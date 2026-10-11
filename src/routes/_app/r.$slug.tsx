import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useEffect, useRef, useState } from "react";
import { MoreVertical, Shield, UserMinus, UserX } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { listRealmMembers, kickRealmMember, banRealmMember, setRealmMemberRole, type RealmMember as RealmMemberRow } from "@/lib/realms";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchRealmBySlug, fetchRealmMessages, sendRealmMessage, joinRealm, leaveRealm, isRealmMember } from "@/lib/realms";
import { createRoom, fetchRealmLiveRoom } from "@/lib/voice";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Hash, Megaphone, Gift, Mic, Send, Users, Sparkles, Copy, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { MessageActionMenu } from "@/components/chat/MessageActionMenu";
import { GifPicker } from "@/components/GifPicker";
import { GifContent } from "@/components/GifContent";

const TYPE_ICON = { text: Hash, announcement: Megaphone, voice: Mic, drops: Gift };

export const Route = createFileRoute("/_app/r/$slug")({
  head: ({ params }) => ({ meta: [{ title: `#${params.slug} · RIZZ` }] }),
  component: RealmPage,
});

function RealmPage() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const realm = useQuery({ queryKey: ["realm", slug], queryFn: () => fetchRealmBySlug(slug) });
  const voiceRoom = useQuery({
    queryKey: ["realm-voice-room", realm.data?.id],
    queryFn: () => fetchRealmLiveRoom(realm.data!.id),
    enabled: realm.data?.kind === "voice",
    refetchInterval: 15_000,
  });
  const messages = useQuery({
    queryKey: ["realm-messages", realm.data?.id],
    queryFn: () => fetchRealmMessages(realm.data!.id),
    enabled: !!realm.data,
  });
  const [joined, setJoined] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [startingVoice, setStartingVoice] = useState(false);
  const [openMessageId, setOpenMessageId] = useState<string | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);

  const members = useQuery({
    queryKey: ["realm-members", realm.data?.id],
    enabled: !!realm.data && membersOpen,
    queryFn: () => listRealmMembers(realm.data!.id),
  });

  const myRole = (members.data ?? []).find((m) => m.user_id === user?.id)?.role ?? null;
  const canModerate = myRole === "owner" || myRole === "mod";
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (realm.data && user) {
      isRealmMember(realm.data.id, user.id).then(setJoined);
    }
  }, [realm.data, user]);

  useEffect(() => {
    if (!realm.data) return;
    const ch = supabase
      .channel(`realm-messages-${realm.data.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `realm_id=eq.${realm.data.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["realm-messages", realm.data!.id] });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, () => {
        qc.invalidateQueries({ queryKey: ["realm-messages", realm.data!.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [realm.data, qc]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data]);

  if (realm.isLoading) return <div className="h-64 animate-pulse rounded-3xl glass" />;
  if (!realm.data) return <div className="text-center py-20"><h1 className="font-display text-2xl font-bold">Realm not found</h1></div>;

  const c: any = realm.data;
  const Icon = TYPE_ICON[c.type as keyof typeof TYPE_ICON] ?? Hash;
  const messageRows = messages.data ?? [];

  const handleSend = async () => {
    if (!user || !body.trim()) return;
    if (!joined) { toast.error("Join the realm to send messages"); return; }
    setSending(true);
    try {
      await sendRealmMessage(c.id, user.id, body.trim());
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
        .eq("sender_id", user.id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("You can only delete messages you sent.");
      qc.setQueryData<any[]>(["realm-messages", c.id], (current = []) =>
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
      await leaveRealm(c.id, user.id);
      setJoined(false);
      toast.success("Left realm");
    } else {
      await joinRealm(c.id, user.id);
      setJoined(true);
      toast.success("Joined!");
    }
    qc.invalidateQueries({ queryKey: ["realm", slug] });
  };

  const handleVoiceStage = async () => {
    if (!user) {
      toast.error("Sign in to join this voice room");
      return;
    }
    if (voiceRoom.isLoading || startingVoice) return;
    setStartingVoice(true);
    try {
      let roomId = voiceRoom.data?.id;
      if (voiceRoom.isError) {
        const refreshed = await voiceRoom.refetch();
        if (refreshed.error) throw refreshed.error;
        roomId = refreshed.data?.id;
      }
      if (!roomId) {
        const created = await createRoom({
          host_id: user.id,
          title: c.name,
          topic: c.topic || undefined,
          realm_id: c.id,
        });
        roomId = created.id;
        await qc.invalidateQueries({ queryKey: ["realm-voice-room", c.id] });
      }
      await nav({ to: "/voice/$id", params: { id: roomId } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't open this voice room");
    } finally {
      setStartingVoice(false);
    }
  };

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div
        className="chat-bar relative z-20 flex shrink-0 items-center gap-3 border-b border-white/5 px-4 pb-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.5rem)", boxShadow: `0 0 18px ${c.accent_color}14` }}
      >
        <Link to="/realms" aria-label="Back to realms" className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-white/5"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${c.accent_color}, var(--rizz-violet))` }}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-bold text-lg leading-tight truncate">{c.name}</h1>
          <p className="text-xs text-muted-foreground truncate flex items-center gap-1"><Users className="h-3 w-3" /> {c.member_count}</p>
        </div>
        <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="glass border-white/10" aria-label="Realm members">
              <Shield className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-strong border-white/10">
            <DialogHeader>
              <DialogTitle className="font-display">Realm members</DialogTitle>
            </DialogHeader>
            <div className="max-h-[60dvh] space-y-2 overflow-y-auto">
              {members.isLoading && <div className="h-24 animate-pulse rounded-2xl glass" />}
              {(members.data ?? []).map((m: RealmMemberRow) => (
                <div key={m.user_id} className="flex items-center gap-3 rounded-2xl border border-white/10 glass p-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={m.profile?.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-gradient-primary text-xs font-bold">
                      {(m.profile?.display_name || m.profile?.username || "?").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{m.profile?.display_name || m.profile?.username || "Member"}</p>
                    <p className="text-[11px] text-muted-foreground">{m.role}</p>
                  </div>
                  {canModerate && m.user_id !== user?.id && m.role !== "owner" && (
                    <div className="flex shrink-0 items-center gap-1">
                      {myRole === "owner" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-[11px]"
                          onClick={async () => {
                            try {
                              await setRealmMemberRole(c.id, m.user_id, m.role === "mod" ? "member" : "mod");
                              await members.refetch();
                            } catch (e: any) {
                              toast.error(e?.message ?? "Couldn't change the role");
                            }
                          }}
                        >
                          {m.role === "mod" ? "Demote" : "Promote"}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-[11px]"
                        onClick={async () => {
                          try {
                            await kickRealmMember(c.id, m.user_id);
                            await members.refetch();
                            await qc.invalidateQueries({ queryKey: ["realm", slug] });
                            toast.success("Member kicked");
                          } catch (e: any) {
                            toast.error(e?.message ?? "Couldn't kick this member");
                          }
                        }}
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-rose-300"
                        onClick={async () => {
                          try {
                            await banRealmMember(c.id, m.user_id);
                            await members.refetch();
                            await qc.invalidateQueries({ queryKey: ["realm", slug] });
                            toast.success("Member banned");
                          } catch (e: any) {
                            toast.error(e?.message ?? "Couldn't ban this member");
                          }
                        }}
                      >
                        <UserX className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {!members.isLoading && (members.data ?? []).length === 0 && (
                <p className="text-center text-sm text-muted-foreground">No members found.</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
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

      {c.type === "voice" && (
        <div className="mx-4 my-3 flex flex-col items-center justify-between gap-3 rounded-2xl border border-[var(--rizz-pink)]/20 bg-gradient-to-r from-[var(--rizz-pink)]/[0.08] via-[var(--rizz-violet)]/[0.07] to-transparent p-4 shadow-[0_12px_36px_rgba(236,72,153,0.08)] glass-strong sm:flex-row">
          <div className="flex items-center gap-3">
            <div className={`relative flex h-12 w-12 items-center justify-center rounded-2xl text-white ${voiceRoom.data ? "bg-gradient-primary shadow-glow" : "border border-white/10 bg-white/[0.06]"}`}>
              <Mic className={`h-6 w-6 ${voiceRoom.data ? "animate-pulse" : "text-white/70"}`} />
              {voiceRoom.data && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-background bg-emerald-400" />}
            </div>
            <div>
              <h3 className="font-display font-bold text-base flex items-center gap-2">
                Voice room
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${voiceRoom.data ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300" : "border-white/10 bg-white/[0.04] text-white/55"}`}>
                  {voiceRoom.data ? "Live" : "Ready"}
                </span>
              </h3>
              <p className="text-xs text-muted-foreground">
                {voiceRoom.data ? "Join the live room for this realm." : "Start a room for members to talk or listen."}
              </p>
              {voiceRoom.isError && <p role="alert" className="mt-1 text-xs text-destructive">Couldn't check for a live room. Try again.</p>}
            </div>
          </div>
          <Button
            type="button"
            disabled={voiceRoom.isLoading || startingVoice}
            onClick={() => void handleVoiceStage()}
            className="w-full gap-2 border-0 bg-gradient-primary shadow-glow sm:w-auto"
          >
            <Mic className="h-4 w-4" />
            {startingVoice ? "Opening…" : voiceRoom.isLoading ? "Checking…" : voiceRoom.data ? "Join live room" : voiceRoom.isError ? "Retry" : "Start voice room"}
          </Button>
        </div>
      )}

      <div className="chat-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <AnimatePresence initial={false}>
          {messageRows.map((m: any, index: number) => {
            const mine = m.sender_id === user?.id;
            const previous = messageRows[index - 1];
            const startsGroup = !previous ||
              previous.sender_id !== m.sender_id ||
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
                    <GifContent>{m.body}</GifContent>
                  </p>
                </MessageActionMenu>
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
          <GifPicker onSelect={(marker) => setBody((current) => `${current}${current ? " " : ""}${marker}`)} />
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
