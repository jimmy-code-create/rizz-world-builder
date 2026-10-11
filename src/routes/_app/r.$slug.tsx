import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useEffect, useRef, useState } from "react";
import { Shield, UserMinus, UserX, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { listRealmMembers, kickRealmMember, banRealmMember, setRealmMemberRole, type RealmMember as RealmMemberRow, type RealmRoom, type RealmRoomKind } from "@/lib/realms";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchRealmBySlug, fetchRealmMessages, sendRealmMessage, joinRealm, leaveRealm, isRealmMember, fetchRealmRooms, fetchRealmRoomMessages, sendRealmRoomMessage, createRealmRoom, createRealmInvite, deleteRealm } from "@/lib/realms";
import { createRoom, fetchRealmLiveRoom } from "@/lib/voice";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Hash, Megaphone, Gift, LogOut, Mic, Send, Settings, Sparkles, Trash2, UserPlus, Users, Copy, Plus, Volume2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { MessageActionMenu } from "@/components/chat/MessageActionMenu";
import { GifPicker } from "@/components/GifPicker";
import { GifContent } from "@/components/GifContent";
import { renderGifSegments } from "@/lib/gif-content";
import { MentionAutocomplete, replaceMention } from "@/components/MentionAutocomplete";
import { renderCaptionWithTags } from "@/lib/hashtags";

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
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomKind, setNewRoomKind] = useState<RealmRoomKind>("text");
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [caret, setCaret] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const members = useQuery({
    queryKey: ["realm-members", realm.data?.id],
    enabled: !!realm.data && membersOpen,
    queryFn: () => listRealmMembers(realm.data!.id),
  });

  const rooms = useQuery({
    queryKey: ["realm-rooms", realm.data?.id],
    enabled: !!realm.data && joined,
    queryFn: () => fetchRealmRooms(realm.data!.id),
  });

  const activeRoom = (rooms.data ?? []).find((r) => r.id === activeRoomId) ?? null;
  const textRooms = (rooms.data ?? []).filter((r) => r.kind !== "voice");
  const voiceRoomsList = (rooms.data ?? []).filter((r) => r.kind === "voice");

  const roomMessages = useQuery({
    queryKey: ["realm-room-messages", activeRoomId],
    enabled: !!activeRoomId && activeRoom?.kind !== "voice",
    queryFn: () => fetchRealmRoomMessages(activeRoomId!),
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
        if (activeRoomId) qc.invalidateQueries({ queryKey: ["realm-room-messages", activeRoomId] });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, () => {
        qc.invalidateQueries({ queryKey: ["realm-messages", realm.data!.id] });
        if (activeRoomId) qc.invalidateQueries({ queryKey: ["realm-room-messages", activeRoomId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [realm.data, activeRoomId, qc]);

  // Default to the realm's default/first room once rooms load.
  useEffect(() => {
    if (activeRoomId) return;
    const list = rooms.data ?? [];
    if (list.length === 0) return;
    const def = list.find((r) => r.is_default) ?? list[0];
    setActiveRoomId(def.id);
  }, [rooms.data, activeRoomId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data]);

  if (realm.isLoading) return <div className="h-64 animate-pulse rounded-3xl glass" />;
  if (!realm.data) return <div className="text-center py-20"><h1 className="font-display text-2xl font-bold">Realm not found</h1></div>;

  const c: any = realm.data;
  const Icon = TYPE_ICON[c.type as keyof typeof TYPE_ICON] ?? Hash;
  const messageRows = activeRoomId && activeRoom?.kind !== "voice" ? (roomMessages.data ?? []) : (messages.data ?? []);

  const handleSend = async () => {
    if (!user || !body.trim()) return;
    if (!joined) { toast.error("Join the realm to send messages"); return; }
    setSending(true);
    try {
      if (activeRoomId && activeRoom?.kind !== "voice") {
        await sendRealmRoomMessage(activeRoomId, user.id, body.trim());
        await qc.invalidateQueries({ queryKey: ["realm-room-messages", activeRoomId] });
      } else {
        await sendRealmMessage(c.id, user.id, body.trim());
      }
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

  const handleCreateRoom = async () => {
    if (!user || !newRoomName.trim()) return;
    setCreatingRoom(true);
    try {
      const room = await createRealmRoom({ realmId: c.id, name: newRoomName.trim(), kind: newRoomKind });
      await qc.invalidateQueries({ queryKey: ["realm-rooms", c.id] });
      setActiveRoomId(room.id);
      setRoomsOpen(false);
      setNewRoomName("");
      toast.success(`${newRoomKind === "voice" ? "Voice" : "Text"} room created`);
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't create the room");
    } finally {
      setCreatingRoom(false);
    }
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

  const handleDeleteRealm = async () => {
    if (!c.id) return;
    setDeleting(true);
    try {
      await deleteRealm(c.id);
      toast.success("Realm deleted");
      setDeleteOpen(false);
      await qc.invalidateQueries({ queryKey: ["realms"] });
      await qc.invalidateQueries({ queryKey: ["realms-rail"] });
      nav({ to: "/realms" });
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't delete this realm");
    } finally {
      setDeleting(false);
    }
  };

  const copyRealmCode = async () => {
    if (!c.id) return;
    try {
      const inviteCode = await createRealmInvite({ realmId: c.id, expiresInDays: 7 });
      await navigator.clipboard.writeText(inviteCode);
      toast.success("7-day realm invite code copied");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't copy the realm code");
    }
  };

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div
        className="chat-bar relative z-20 flex shrink-0 items-center gap-3 border-b border-white/5 px-4 pb-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.5rem)", boxShadow: `0 0 18px ${c.accent_color}14` }}
      >
        <Link to="/realms" aria-label="Back to realms" className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-white/5"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="h-10 w-10 overflow-hidden rounded-xl flex items-center justify-center shrink-0 ring-1 ring-white/15" style={{ background: `linear-gradient(135deg, ${c.accent_color || "#38bdf8"}, #2563eb)` }}>
          {c.icon_url ? <img src={c.icon_url} alt="" className="h-full w-full object-cover" /> : <Icon className="h-5 w-5 text-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-bold text-lg leading-tight break-words">{c.name}</h1>
          <p className="text-xs text-muted-foreground truncate flex items-center gap-1"><Users className="h-3 w-3" /> {c.member_count}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="glass shrink-0 border-white/10"
          aria-label="Realm options"
          onClick={() => setOptionsOpen(true)}
        >
          <Settings className="h-4 w-4" />
        </Button>
        <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
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
      </div>

      <Sheet open={optionsOpen} onOpenChange={setOptionsOpen}>
        <SheetContent
          side="bottom"
          className="glass-strong max-h-[85dvh] overflow-y-auto rounded-t-3xl border-white/10 pb-[max(env(safe-area-inset-bottom),1rem)]"
        >
          <SheetHeader className="text-left">
            <SheetTitle className="font-display text-xl break-words">{c.name}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            {joined && (
              <SheetRowButton onClick={() => void copyRealmCode()}>
                <Copy className="h-4 w-4" /> Copy invite code
              </SheetRowButton>
            )}
            <SheetRowButton onClick={() => { setOptionsOpen(false); setMembersOpen(true); }}>
              <Shield className="h-4 w-4" /> Moderation
            </SheetRowButton>
            {joined ? (
              <SheetRowButton destructive onClick={() => { setOptionsOpen(false); setLeaveOpen(true); }}>
                <LogOut className="h-4 w-4" />
                <span className="flex-1">Leave realm</span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Joined</span>
              </SheetRowButton>
            ) : (
              <SheetRowButton onClick={() => { setOptionsOpen(false); void handleJoin(); }}>
                <UserPlus className="h-4 w-4" /> Join realm
              </SheetRowButton>
            )}
            {(myRole === "owner" || c.owner_id === user?.id) && (
              <SheetRowButton destructive onClick={() => { setOptionsOpen(false); setDeleteOpen(true); }}>
                <Trash2 className="h-4 w-4" /> Delete realm
              </SheetRowButton>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <AlertDialogContent className="glass-strong border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Leave “{c.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll stop seeing this realm's rooms and messages until you join again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); setLeaveOpen(false); void handleJoin(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Leave realm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {c.topic && (
        <div className="chat-bar flex shrink-0 items-start gap-2 border-b border-white/5 px-4 py-3 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 mt-0.5 text-[var(--rizz-pink)] shrink-0" />
          {c.topic}
        </div>
      )}

      {joined && rooms.data && rooms.data.length > 0 && (
        <div
          className="chat-bar flex shrink-0 items-center gap-2 overflow-x-auto border-y border-sky-300/10 bg-sky-500/[0.025] px-3 py-2.5 no-scrollbar"
          style={{ paddingTop: "calc(0.5rem + 0px)" }}
        >
          {(rooms.data as RealmRoom[]).map((room) => {
            const RoomIcon = room.kind === "voice" ? Volume2 : TYPE_ICON[room.kind as keyof typeof TYPE_ICON] ?? Hash;
            const isActive = room.id === activeRoomId;
            return (
              <button
                key={room.id}
                type="button"
                onClick={() => setActiveRoomId(room.id)}
                className={`flex h-9 min-h-[36px] shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition-colors ${
                  isActive
                    ? "border-sky-300/40 bg-sky-400/10 text-sky-200 shadow-[0_0_18px_rgba(56,189,248,.1)]"
                    : "border-white/10 bg-white/[0.035] text-white/70 hover:border-sky-200/25 hover:text-white"
                }`}
              >
                <RoomIcon className="h-3.5 w-3.5" />
                {room.name}
              </button>
            );
          })}
          <Dialog open={roomsOpen} onOpenChange={setRoomsOpen}>
            <DialogTrigger asChild>
              <button
                type="button"
                className="grid h-9 min-h-[36px] w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20 hover:text-white"
                aria-label="New room"
              >
                <Plus className="h-4 w-4" />
              </button>
            </DialogTrigger>
            <DialogContent className="glass-strong border-white/10">
              <DialogHeader>
                <DialogTitle className="font-display">New room</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Input value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} placeholder="Room name" maxLength={40} className="glass border-white/10" />
                <div className="flex gap-2">
                  {(["text", "announcement", "voice"] as RealmRoomKind[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setNewRoomKind(k)}
                      className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold capitalize transition-colors ${
                        newRoomKind === k
                          ? "border-[var(--rizz-pink)]/40 bg-[var(--rizz-pink)]/10 text-[var(--rizz-pink)]"
                          : "border-white/10 bg-white/[0.03] text-white/70"
                      }`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
                <Button onClick={handleCreateRoom} disabled={!newRoomName.trim() || creatingRoom} className="w-full bg-gradient-primary border-0 shadow-glow">
                  {creatingRoom ? "Creating…" : "Create room"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {activeRoom?.kind === "voice" && (
        <div className="mx-4 my-3 flex flex-col items-center justify-between gap-3 rounded-2xl border border-[var(--rizz-pink)]/20 bg-gradient-to-r from-[var(--rizz-pink)]/[0.08] via-[var(--rizz-violet)]/[0.07] to-transparent p-4 shadow-[0_12px_36px_rgba(236,72,153,0.08)] glass-strong sm:flex-row">
          <div className="flex items-center gap-3">
            <div className={`relative flex h-12 w-12 items-center justify-center rounded-2xl text-white ${voiceRoom.data ? "bg-gradient-primary shadow-glow" : "border border-white/10 bg-white/[0.06]"}`}>
              <Mic className={`h-6 w-6 ${voiceRoom.data ? "animate-pulse" : "text-white/70"}`} />
              {voiceRoom.data && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-background bg-emerald-400" />}
            </div>
            <div>
              <h3 className="font-display font-bold text-base flex items-center gap-2">
                {activeRoom.name || "Voice room"}
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

      <div className="chat-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2 sm:px-4 sm:py-3">
        {activeRoom?.kind !== "voice" && activeRoom && (
          <div className="mb-3 flex min-h-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Hash className="h-3 w-3" />{activeRoom.name}
          </div>
        )}
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
              <motion.div id={`msg-${m.id}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mb-2 flex gap-2 sm:gap-3">
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
                  <p className={`chat-bubble message-bubble min-w-[44px] w-fit max-w-[88%] rounded-2xl px-3.5 py-2 select-none touch-manipulation ${mine ? "message-bubble--outgoing" : "message-bubble--incoming"}`}>
                    {renderGifSegments(m.body).map((seg, si) =>
                      seg.isGif || seg.isSticker
                        ? <GifContent key={si}>{seg.marker ?? ""}</GifContent>
                        : renderCaptionWithTags(seg.value).map((p, pi) =>
                            p.mention
                              ? <Link key={`${si}-${pi}`} to="/u/$username" params={{ username: p.mention }} className="mention-highlight font-medium hover:underline">{p.text}</Link>
                              : p.tag
                                ? <Link key={`${si}-${pi}`} to="/tag/$tag" params={{ tag: p.tag }} className="text-[var(--rizz-pink)] hover:underline font-medium">{p.text}</Link>
                                : p.url
                                  ? <a key={`${si}-${pi}`} href={p.url} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline break-all">{p.text}</a>
                                  : <span key={`${si}-${pi}`}>{p.text}</span>
                          )
                    )}
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

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="glass-strong border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" /> Delete “{c.name}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the realm for everyone — including all rooms,
              messages, invites and voice rooms. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => { e.preventDefault(); void handleDeleteRealm(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {deleting ? "Deleting…" : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="chat-bar relative z-20 shrink-0 border-t border-white/5 px-3 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)]">
        <div className="mx-auto flex w-full max-w-3xl gap-2">
          <GifPicker onSelect={(marker) => setBody((current) => `${current}${current ? " " : ""}${marker}`)} />
          <Input
            ref={inputRef}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setCaret(e.target.selectionStart ?? e.target.value.length);
            }}
            onKeyUp={(e) => setCaret((e.target as HTMLInputElement).selectionStart ?? 0)}
            onClick={(e) => setCaret((e.target as HTMLInputElement).selectionStart ?? 0)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer: fine)").matches) { e.preventDefault(); handleSend(); }
            }}
            placeholder={joined ? "Message" : "Join to chat"}
            disabled={!joined || sending}
            maxLength={500}
            className="glass border-white/10"
          />
          <MentionAutocomplete
            value={body}
            caret={caret}
            onPick={(username) => {
              const next = replaceMention(body, caret, username);
              setBody(next.value);
              setCaret(next.caret);
              const el = inputRef.current;
              if (el) requestAnimationFrame(() => { el.focus(); el.setSelectionRange(next.caret, next.caret); });
            }}
          />
          <Button onClick={handleSend} disabled={!joined || !body.trim() || sending} size="icon" className="bg-gradient-primary border-0 shadow-glow shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function SheetRowButton({
  children,
  onClick,
  destructive = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
        destructive
          ? "border-destructive/30 text-destructive hover:bg-destructive/10"
          : "glass border-white/10 hover:bg-white/5"
      }`}
    >
      {children}
    </button>
  );
}
