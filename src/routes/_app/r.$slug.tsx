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
import { fetchRealmBySlug, fetchRealmMessages, sendRealmMessage, joinRealm, leaveRealm, isRealmMember, fetchRealmRooms, fetchRealmRoomMessages, sendRealmRoomMessage, createRealmRoom, createRealmInvite, deleteRealm, setRealmRoomLock } from "@/lib/realms";
import { Switch } from "@/components/ui/switch";
import { useRealmVoiceChannels, useVoiceCallContext, type CallParticipantRow } from "@/components/voice/VoiceCallProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Bot as BotIcon, Flag, Hash, Lock, Megaphone, Gift, LogOut, Mic, MicOff, Pencil, Send, Settings, ShieldCheck, Sparkles, Trash2, UserPlus, Users, Copy, Plus, Volume2 } from "lucide-react";
import { EditRealmSheet } from "@/components/realms/EditRealmSheet";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { MessageActionMenu } from "@/components/chat/MessageActionMenu";
import { ReactionChips, burstOverMessage } from "@/components/chat/ReactionChips";
import { reactionHaptic } from "@/components/chat/ReactionBurst";
import { MessageLinkPreviews } from "@/components/chat/LinkPreviews";
import { useHiddenLinkPreviews } from "@/lib/link-preview";
import { AvatarWithStatus, CustomStatusLine } from "@/components/presence/StatusDot";
import { publicCustomStatus, statusLabel, usePresenceMap } from "@/lib/presence";
import { ChannelPermissionsSheet } from "@/components/realms/ChannelPermissionsSheet";
import { deniedChannelsOf, useChannelPermissions, useMyRealmRole } from "@/lib/realm-permissions";
import { canModerateRealm } from "@/lib/realm-roles";
import { Pin, PinOff } from "lucide-react";
import { PinnedBar, PinnedListSheet, PinBadge, SystemLine } from "@/components/chat/PinnedMessages";
import { togglePin, usePinnedMessages, type PinnedMessageDetails } from "@/lib/pins";
import { useChatReactions } from "@/lib/useChatReactions";
import { useMediaViewer } from "@/components/media/useMediaViewer";
import { DOUBLE_TAP_REACTION } from "@/lib/reactions";
import { GifPicker } from "@/components/GifPicker";
import { GifContent } from "@/components/GifContent";
import { renderGifSegments } from "@/lib/gif-content";
import { MentionAutocomplete, replaceMention } from "@/components/MentionAutocomplete";
import { renderCaptionWithTags } from "@/lib/hashtags";
import { BotBadge } from "@/components/bots/BotBadge";
import { SlashCommandMenu, wrapIndex } from "@/components/bots/SlashCommandMenu";
import { RealmBotsSheet } from "@/components/bots/RealmBotsSheet";
import { filterSlashCommands, insertSlashCommand, parseSlashCommand } from "@/lib/bot-commands";
import { runBotCommand, useRealmSlashCommands } from "@/lib/bots";
import { moderateDeleteMessage, reportRealmMessage } from "@/lib/realm-settings";
import { useMentionLabels } from "@/lib/mention-tokens";

const TYPE_ICON = { text: Hash, announcement: Megaphone, voice: Mic, drops: Gift };

/** Member lists paginate instead of mounting every row of a big realm at once. */
const MEMBER_PAGE_SIZE = 25;

type RealmChannelCall = {
  room: { id: string; realm_room_id: string | null; host_id: string; title: string };
  participants: CallParticipantRow[];
};

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
  const messages = useQuery({
    queryKey: ["realm-messages", realm.data?.id],
    queryFn: () => fetchRealmMessages(realm.data!.id),
    enabled: !!realm.data,
  });
  const [joined, setJoined] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
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
  const [editOpen, setEditOpen] = useState(false);
  const [visibleMembers, setVisibleMembers] = useState(MEMBER_PAGE_SIZE);
  const [pinsOpen, setPinsOpen] = useState(false);
  const [pinIndex, setPinIndex] = useState(0);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [unpinningId, setUnpinningId] = useState<string | null>(null);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [botsOpen, setBotsOpen] = useState(false);
  // Slash-command popup: which row is highlighted, and whether Escape dismissed
  // it for the text currently in the composer.
  const [slashIndex, setSlashIndex] = useState(0);
  const [slashHidden, setSlashHidden] = useState(false);

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

  // Voice calls live in the root provider so they keep running across pages.
  const {
    call: activeCall,
    joinChannel,
    busy: joiningVoice,
    openView: openCallView,
  } = useVoiceCallContext();
  const channelCalls = useRealmVoiceChannels(realm.data?.id);
  const channelCallsByRoom = new Map<string, RealmChannelCall>(
    ((channelCalls.data ?? []) as RealmChannelCall[]).map((entry) => [entry.room.realm_room_id ?? "", entry]),
  );
  const activeChannelPeople = activeRoom?.kind === "voice" ? channelCallsByRoom.get(activeRoom.id)?.participants ?? [] : [];

  const roomMessages = useQuery({
    queryKey: ["realm-room-messages", activeRoomId],
    enabled: !!activeRoomId && activeRoom?.kind !== "voice",
    queryFn: () => fetchRealmRoomMessages(activeRoomId!),
  });

  // The role comes from realm_role_of(), which answers even while the member
  // list is still loading — that list is what used to hide moderation for the
  // owner and make the permissions page look like a dead tap. Ownership is also
  // readable straight off the realm row.
  const roleQuery = useMyRealmRole(realm.data?.id);
  const myRole = roleQuery.role ??
    (members.data ?? []).find((m) => m.user_id === user?.id)?.role ??
    (realm.data?.owner_id && realm.data.owner_id === user?.id ? "owner" : null);
  const canModerate = canModerateRealm(myRole, realm.data?.owner_id, user?.id);
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

  // Every hook must run before the guards below. Calling them after an early
  // return makes React throw "Rendered more hooks than during the previous
  // render" as soon as the realm query resolves, which blanked this page.
  const messageRows = activeRoomId && activeRoom?.kind !== "voice" ? (roomMessages.data ?? []) : (messages.data ?? []);
  const messageIds = messageRows.map((message: { id: string }) => message.id);
  const reactions = useChatReactions("realm", messageIds, {
    myMessageIds: messageRows.filter((message: { sender_id: string | null }) => message.sender_id === user?.id).map((message: { id: string }) => message.id),
  });
  // Members and voice participants share one presence request.
  const presence = usePresenceMap([
    ...(members.data ?? []).map((member) => member.user_id),
    ...activeChannelPeople.map((person) => person.user_id),
  ]);
  // Pins for the channel on screen, live for everyone in the realm.
  const pinned = usePinnedMessages(realm.data?.id, activeRoomId ?? null);
  const pins = pinned.pins;
  const pinnedIds = new Set(pins.map((pin) => pin.message_id));
  const removedPreviews = useHiddenLinkPreviews("realm", messageIds);
  const media = useMediaViewer();
  const [lockingRoomId, setLockingRoomId] = useState<string | null>(null);
  // Who may type where, shared by the moderation sheet and the composer.
  const channelPermissions = useChannelPermissions(realm.data?.id);
  // Slash commands offered in the channel on screen. Bots live in realms only:
  // the room id is null for the realm's own channel, and the API re-checks the
  // realm before running anything.
  const slashRoomId = activeRoomId && activeRoom?.kind !== "voice" ? activeRoomId : null;
  const realmCommands = useRealmSlashCommands(realm.data?.id, slashRoomId);
  // `<@userId>` tokens in any visible message resolve to a username once.
  const mentionLabels = useMentionLabels((messageRows as { body?: string }[]).map((row) => row.body));
  const slashQuery = parseSlashCommand(body);
  const slashMatches = slashQuery ? filterSlashCommands(realmCommands.commands, slashQuery.name) : [];
  // The menu only shows while the command word itself is being typed, so the
  // arguments after the first space never sit under a popup.
  const slashMenuOpen =
    !slashHidden && !sending && !!slashQuery && slashQuery.typingName && slashMatches.length > 0;
  const slashActive = Math.min(slashIndex, Math.max(slashMatches.length - 1, 0));

  // The lock reaches everybody live: realm_rooms is in the realtime publication.
  useEffect(() => {
    if (!realm.data) return;
    const realmId = realm.data.id;
    const channel = supabase
      .channel(`realm-rooms-${realmId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "realm_rooms", filter: `realm_id=eq.${realmId}` },
        () => { void qc.invalidateQueries({ queryKey: ["realm-rooms", realmId] }); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [realm.data, qc]);

  if (realm.isLoading) return <div className="h-64 animate-pulse rounded-3xl glass" />;
  if (!realm.data) return <div className="text-center py-20"><h1 className="font-display text-2xl font-bold">Realm not found</h1></div>;

  const c: any = realm.data;
  const Icon = TYPE_ICON[c.type as keyof typeof TYPE_ICON] ?? Hash;
  // "Mods only" applies per channel: readers keep reading, non-mods can't send
  // or join. The real rule is enforced in Postgres (see the migration).
  const roomLockedForMe = !!activeRoom?.mods_only && !canModerate;
  // The channel the composer would post to: the room on screen, or the realm's
  // own channel when a realm or voice channel is open.
  const sendChannelKey = activeRoomId && activeRoom?.kind !== "voice" ? activeRoomId : c.id;
  // The channel's "who can add reactions" setting, enforced again inside
  // toggle_message_reaction so the browser can't grant itself the permission.
  const reactionsMode = ((activeRoomId && activeRoom?.kind !== "voice"
    ? (activeRoom as { reactions_mode?: "everyone" | "mods" }).reactions_mode
    : (c.reactions_mode as "everyone" | "mods" | undefined)) ?? "everyone");
  const canAddReactions = reactionsMode !== "mods" || canModerate;
  const myWriteBlocked = !canModerate && deniedChannelsOf(channelPermissions.permissions, c.id, user?.id).has(sendChannelKey);
  // Why the composer is closed, in the order the rules apply.
  const composerBlock = !joined
    ? "Join to chat"
    : roomLockedForMe
      ? "Only mods can send messages here"
      : myWriteBlocked
        ? "A moderator turned off writing here for you"
        : null;

  const toggleRoomLock = async (room: RealmRoom, locked: boolean) => {
    setLockingRoomId(room.id);
    try {
      await setRealmRoomLock(room.id, locked);
      await qc.invalidateQueries({ queryKey: ["realm-rooms", c.id] });
      toast.success(locked ? `${room.name} is mods only now` : `${room.name} is open to everyone`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't change that channel");
    } finally {
      setLockingRoomId(null);
    }
  };

  /** Puts the chosen command in the composer with exactly one trailing space. */
  const pickSlashCommand = (command: { name: string }) => {
    const next = insertSlashCommand(body, command.name);
    setBody(next);
    setCaret(next.length);
    setSlashIndex(0);
    setSlashHidden(false);
    const el = inputRef.current;
    if (el) requestAnimationFrame(() => { el.focus(); el.setSelectionRange(next.length, next.length); });
  };

  const handleSend = async () => {
    if (!user || !body.trim()) return;
    if (!joined) { toast.error("Join the realm to send messages"); return; }
    if (roomLockedForMe) { toast.error("Only mods can send messages here"); return; }
    if (myWriteBlocked) { toast.error("A moderator turned off writing here for you"); return; }

    // "/name args" that matches an installed command runs the bot. Any other
    // text that happens to start with "/" is still just a message.
    const parsed = parseSlashCommand(body);
    const command = parsed ? slashMatches.find((entry) => entry.name === parsed.name) : undefined;
    if (parsed && command) {
      setSending(true);
      try {
        const result = await runBotCommand({
          command: parsed.name,
          args: parsed.args.trim(),
          realmId: c.id,
          roomId: slashRoomId,
        });
        if (result.ok) {
          toast.success(`/${command.name} · ${command.bot_name}`);
          setBody("");
          setCaret(0);
          setSlashIndex(0);
          setSlashHidden(false);
        } else {
          toast.error(result.error ?? `/${command.name} didn't work`);
        }
        // The bot's answer arrives over realtime too; this just makes it instant.
        await qc.invalidateQueries({ queryKey: ["realm-messages", c.id] });
        if (slashRoomId) await qc.invalidateQueries({ queryKey: ["realm-room-messages", slashRoomId] });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "That command didn't work");
      } finally {
        setSending(false);
      }
      return;
    }

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

  /** Jumps to a pinned message and flashes it briefly. */
  const jumpToPin = (pin: PinnedMessageDetails) => {
    setPinsOpen(false);
    window.setTimeout(() => {
      document.getElementById(`msg-${pin.message_id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightId(pin.message_id);
      window.setTimeout(() => setHighlightId((current) => (current === pin.message_id ? null : current)), 1600);
    }, 0);
  };

  const handlePinToggle = async (messageId: string, isPinned: boolean) => {
    setUnpinningId(messageId);
    try {
      await togglePin(messageId, isPinned);
      toast.success(isPinned ? "Unpinned" : "Pinned for everyone in the realm");
    } catch (error) {
      // Nothing was changed locally, so the pin simply stays as it was.
      toast.error(error instanceof Error ? error.message : "Couldn't update that pin");
    } finally {
      setUnpinningId(null);
    }
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
          {c.icon_url ? <img src={c.icon_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <Icon className="h-5 w-5 text-white" />}
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
              {!members.isLoading && (members.data ?? []).length > MEMBER_PAGE_SIZE && (
                <p className="text-[11px] text-muted-foreground">
                  Showing {visibleMembers} of {(members.data ?? []).length} members
                </p>
              )}
              {(members.data ?? []).slice(0, visibleMembers).map((m: RealmMemberRow) => (
                <div key={m.user_id} className="flex items-center gap-3 rounded-2xl border border-white/10 glass p-3">
                  <AvatarWithStatus status={presence.statusOf(m.user_id)} dotSize={11}>
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={m.profile?.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-gradient-primary text-xs font-bold">
                        {(m.profile?.display_name || m.profile?.username || "?").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </AvatarWithStatus>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{m.profile?.display_name || m.profile?.username || "Member"}</p>
                    {publicCustomStatus(presence.rows[m.user_id], false) ? (
                      <CustomStatusLine
                        status={publicCustomStatus(presence.rows[m.user_id], false)}
                        className="text-[11px] text-[var(--rizz-pink)]/90"
                      />
                    ) : (
                      <p className="text-[11px] text-muted-foreground">{m.role}</p>
                    )}
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
              {(members.data ?? []).length > visibleMembers && (
                <button
                  type="button"
                  onClick={() => setVisibleMembers((v) => v + MEMBER_PAGE_SIZE)}
                  className="w-full min-h-12 rounded-2xl glass border border-white/10 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-white/20 transition-colors"
                >
                  Show more members
                </button>
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
            {/* The channel permission page opens from here, as its own sheet:
                opening it from inside the members dialog left it mounted behind
                that dialog, where every switch was inert. */}
            <SheetRowButton
              onClick={() => { setOptionsOpen(false); setPermissionsOpen(true); }}
            >
              <ShieldCheck className="h-4 w-4" /> Channels &amp; permissions
            </SheetRowButton>
            {/* Bots are a realm-only feature, so this lives on the realm, not in
                the global app settings. */}
            <SheetRowButton onClick={() => { setOptionsOpen(false); setBotsOpen(true); }}>
              <BotIcon className="h-4 w-4" /> Bots
            </SheetRowButton>
            {joined && (
              <SheetRowButton
                onClick={() => { setOptionsOpen(false); nav({ to: "/r/$slug/settings", params: { slug } }); }}
              >
                <Settings className="h-4 w-4" /> Realm settings
              </SheetRowButton>
            )}
            {canModerate && (
              <SheetRowButton onClick={() => { setOptionsOpen(false); setEditOpen(true); }}>
                <Pencil className="h-4 w-4" /> Edit realm
              </SheetRowButton>
            )}
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

      {c && (
        <EditRealmSheet
          open={editOpen}
          onOpenChange={setEditOpen}
          realm={{ id: c.id, slug: c.slug ?? slug, name: c.name, topic: c.topic ?? null, icon_url: c.icon_url ?? null }}
        />
      )}

      {/* Moderation → Channels → permissions: who may send and who may react. */}
      <ChannelPermissionsSheet
        open={permissionsOpen}
        onOpenChange={setPermissionsOpen}
        realmId={c.id}
        realmName={c.name}
        rooms={rooms.data ?? []}
        canModerate={canModerate}
        realmReactionsMode={(c.reactions_mode ?? "everyone") as "everyone" | "mods"}
      />

      <RealmBotsSheet
        open={botsOpen}
        onOpenChange={setBotsOpen}
        realmId={c.id}
        realmName={c.name}
        rooms={(rooms.data ?? []) as RealmRoom[]}
        isOwner={myRole === "owner" || c.owner_id === user?.id}
      />

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
            const channelCall = room.kind === "voice" ? channelCallsByRoom.get(room.id) : undefined;
            const people: CallParticipantRow[] = channelCall?.participants ?? [];
            const inThisCall = activeCall?.channelId === room.id;
            return (
              <button
                key={room.id}
                type="button"
                onClick={() => setActiveRoomId(room.id)}
                className={`flex h-9 min-h-[36px] shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition-colors ${
                  inThisCall
                    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                    : isActive
                      ? "border-sky-300/40 bg-sky-400/10 text-sky-200 shadow-[0_0_18px_rgba(56,189,248,.1)]"
                      : "border-white/10 bg-white/[0.035] text-white/70 hover:border-sky-200/25 hover:text-white"
                }`}
              >
                {room.kind === "voice" && people.length > 0 ? (
                  <span className="flex -space-x-1.5">
                    {people.slice(0, 3).map((person) => (
                      <Avatar key={person.user_id} className="h-4 w-4 ring-1 ring-background">
                        <AvatarImage src={person.user?.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-gradient-primary text-[8px] font-bold">
                          {(person.user?.username ?? "?").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  </span>
                ) : (
                  <RoomIcon className="h-3.5 w-3.5" />
                )}
                {room.name}
                {room.mods_only && <Lock className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-label="Mods only" />}
                {room.kind === "voice" && people.length > 0 && (
                  <span className="text-[10px] font-bold text-emerald-300">{people.length}</span>
                )}
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
            <DialogContent className="glass-strong max-h-[85dvh] overflow-y-auto border-white/10">
              <DialogHeader>
                <DialogTitle className="font-display">Rooms & channels</DialogTitle>
              </DialogHeader>

              {/* Channel settings — the lock switch is only rendered for the
                  owner and admins, and re-checked server-side either way. */}
              {canModerate && (rooms.data ?? []).length > 0 && (
                <div className="space-y-2">
                  {(rooms.data as RealmRoom[]).map((room) => (
                    <div key={room.id} className="flex min-h-14 items-center gap-3 rounded-xl border border-white/10 glass px-3 py-2">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/5">
                        {room.kind === "voice" ? <Volume2 className="h-4 w-4" /> : <Hash className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{room.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {room.mods_only ? "Mods only" : "Everyone can post"}
                        </p>
                      </div>
                      <Switch
                        checked={room.mods_only}
                        disabled={lockingRoomId === room.id}
                        aria-label={`Mods only for ${room.name}`}
                        onCheckedChange={(checked) => void toggleRoomLock(room, checked)} 
                      />
                    </div>
                  ))}
                </div>
              )}

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

      {activeRoom?.kind !== "voice" && (
        <PinnedBar
          pins={pins}
          index={pinIndex}
          onJump={(pin) => {
            jumpToPin(pin);
            setPinIndex((current) => (pins.length ? (current + 1) % pins.length : 0));
          }}
          onOpenList={() => setPinsOpen(true)}
        />
      )}

      {activeRoom?.kind === "voice" && (
        <div className="mx-4 my-3 rounded-2xl border border-[var(--rizz-pink)]/20 bg-gradient-to-r from-[var(--rizz-pink)]/[0.08] via-[var(--rizz-violet)]/[0.07] to-transparent p-4 shadow-[0_12px_36px_rgba(236,72,153,0.08)] glass-strong">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-primary text-white shadow-glow">
                <Mic className="h-6 w-6" />
                {activeChannelPeople.length > 0 && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-background bg-emerald-400" />}
              </div>
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 font-display text-base font-bold">
                  <span className="truncate">{activeRoom.name || "Voice channel"}</span>
                  {activeChannelPeople.length > 0 && (
                    <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                      {activeChannelPeople.length} in call
                    </span>
                  )}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {activeChannelPeople.length > 0 ? "Jump in — everyone can talk." : "No one is here yet. Be the first voice."}
                </p>
              </div>
            </div>
            {activeRoom.mods_only && !canModerate ? (
              <Button
                type="button"
                disabled
                className="min-h-12 w-full shrink-0 gap-2 glass border-white/10 sm:w-auto"
              >
                <Lock className="h-4 w-4" /> Mods only
              </Button>
            ) : (
              <Button
                type="button"
                disabled={joiningVoice}
                onClick={() => {
                  if (activeCall?.channelId === activeRoom.id) openCallView();
                  else joinChannel({ id: activeRoom.id, realmId: c.id, name: activeRoom.name });
                }}
                className="min-h-12 w-full shrink-0 gap-2 border-0 bg-gradient-primary shadow-glow sm:w-auto"
              >
                <Mic className="h-4 w-4" />
                {activeCall?.channelId === activeRoom.id ? "Return to call" : joiningVoice ? "Joining…" : "Join voice"}
              </Button>
            )}
          </div>

          {activeChannelPeople.length > 0 && (
            <ul className="mt-4 space-y-2">
              {activeChannelPeople.map((person) => {
                const username = person.user?.username ?? "member";
                return (
                  <li key={person.user_id} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-2.5">
                    <AvatarWithStatus status={presence.statusOf(person.user_id)} dotSize={11}>
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={person.user?.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-gradient-primary text-xs font-bold">
                          {(person.user?.display_name || username).charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </AvatarWithStatus>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{person.user?.display_name || `@${username}`}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{username === "member" ? statusLabel(presence.statusOf(person.user_id)) : `@${username}`}</p>
                    </div>
                    {person.muted ? (
                      <MicOff className="h-4 w-4 shrink-0 text-destructive" aria-label="Muted" />
                    ) : (
                      <span className="flex shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> live
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <div
        onClick={media.onMediaClick}
        className="chat-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2 sm:px-4 sm:py-3"
      >
        {media.viewer}
        {activeRoom?.kind !== "voice" && activeRoom && (
          <div className="mb-3 flex min-h-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Hash className="h-3 w-3" />{activeRoom.name}
          </div>
        )}
        <AnimatePresence initial={false}>
          {messageRows.map((m: any, index: number) => {
            const mine = m.sender_id === user?.id;
            // A bot message has no sender at all: it carries bot_id and the joined
            // bot row instead. Human authors may arrive as `author` or `sender`
            // depending on which query loaded them, so both are accepted.
            const botRow = (m.bot ?? null) as { name: string; avatar_url: string | null } | null;
            const isBot = !!m.bot_id;
            const authorProfile = (m.author ?? m.sender ?? null) as {
              username: string | null;
              display_name: string | null;
              avatar_url: string | null;
              accent_color?: string | null;
            } | null;
            const authorName = isBot
              ? botRow?.name ?? "Bot"
              : authorProfile?.display_name || authorProfile?.username || "Member";
            const authorAvatar = isBot ? botRow?.avatar_url ?? null : authorProfile?.avatar_url ?? null;
            const authorAccent = isBot ? null : authorProfile?.accent_color ?? null;
            const authorInitial = (isBot ? botRow?.name ?? "B" : authorProfile?.username ?? "?")
              .charAt(0)
              .toUpperCase();
            const previous = messageRows[index - 1];
            const startsGroup = !previous ||
              previous.sender_id !== m.sender_id ||
              new Date(m.created_at).getTime() - new Date(previous.created_at).getTime() > 5 * 60 * 1000;
            // "@user pinned a message" reads as a system line, not a bubble.
            if ((m as { system?: boolean }).system) {
              return <SystemLine key={m.id} text={m.body} />;
            }
            return (
              <Fragment key={m.id}>
              {startsGroup && (
                <div className="py-1 text-center text-[10px] font-medium text-muted-foreground">
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </div>
              )}
              <motion.div
                id={`msg-${m.id}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mb-2 flex gap-2 rounded-2xl sm:gap-3 ${
                  highlightId === m.id ? "bg-[var(--rizz-pink)]/[0.08] ring-2 ring-[var(--rizz-pink)]/50" : ""
                }`}
              >
              {!mine && (startsGroup ? (
                <Avatar className="h-9 w-9 shrink-0 ring-2" style={{ boxShadow: `0 0 10px ${authorAccent || c.accent_color}66` }}>
                  <AvatarImage src={authorAvatar ?? undefined} />
                  <AvatarFallback
                    className={`text-xs font-bold ${isBot ? "bg-[var(--rizz-violet)] text-white" : "bg-gradient-primary"}`}
                  >
                    {authorInitial}
                  </AvatarFallback>
                </Avatar>
              ) : <div aria-hidden="true" className="h-9 w-9 shrink-0" />)}
              <div className="flex-1 min-w-0">
                {startsGroup && <div className="flex items-center gap-2">
                  <span className="font-bold text-sm" style={{ color: authorAccent || undefined }}>{authorName}</span>
                  {isBot && <BotBadge />}
                  {pinnedIds.has(m.id) && <PinBadge />}
                </div>}
                <MessageActionMenu
                  open={openMessageId === m.id}
                  onOpenChange={(open) => setOpenMessageId(open ? m.id : null)}
                  align={mine ? "right" : "left"}
                  // The quick bar mirrors the channel's reaction policy; the RPC
                  // and its trigger enforce it again server-side.
                  reactionBar={canAddReactions ? { onPick: (emoji) => { void reactions.toggle(m.id, emoji); } } : undefined}
                  onDoubleTap={() => {
                    burstOverMessage(m.id, DOUBLE_TAP_REACTION);
                    reactionHaptic();
                    void reactions.toggle(m.id, DOUBLE_TAP_REACTION);
                  }}
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
                    ...(canModerate
                      ? [{
                          label: pinnedIds.has(m.id) ? "Unpin message" : "Pin message",
                          icon: pinnedIds.has(m.id) ? PinOff : Pin,
                          onSelect: () => { void handlePinToggle(m.id, pinnedIds.has(m.id)); },
                        }]
                      : []),
                    ...(mine
                      ? [{
                          label: "Delete message",
                          icon: Trash2,
                          destructive: true,
                          onSelect: () => { void handleDeleteMessage(m.id); },
                        }]
                      : [
                          ...(canModerate
                            ? [{
                                label: "Delete for everyone",
                                icon: Trash2,
                                destructive: true,
                                onSelect: () => {
                                  void moderateDeleteMessage(m.id, "Removed by a moderator").then(
                                    () => toast.success("Message removed"),
                                    (error: unknown) =>
                                      toast.error(error instanceof Error ? error.message : "Couldn't remove that message"),
                                  );
                                },
                              }]
                            : []),
                          {
                          label: "Report message",
                          icon: Flag,
                          onSelect: () => {
                            void reportRealmMessage(m.id, "Reported from chat").then(
                              () => toast.success("Thanks — a moderator will take a look"),
                              (error: unknown) =>
                                toast.error(error instanceof Error ? error.message : "Couldn't send that report"),
                            );
                          },
                        },
                        ]),
                  ]}
                >
                  <p className={`chat-bubble message-bubble min-w-[44px] w-fit max-w-[88%] rounded-2xl px-3.5 py-2 select-none touch-manipulation ${mine ? "message-bubble--outgoing" : "message-bubble--incoming"}`}>
                    {renderGifSegments(m.body).map((seg, si) =>
                      seg.isGif || seg.isSticker
                        ? <GifContent key={si}>{seg.marker ?? ""}</GifContent>
                        : renderCaptionWithTags(seg.value).map((p, pi) =>
                            p.mentionToken
                              ? <span key={`${si}-${pi}`} className="mention-highlight font-medium">{mentionLabels(p.mentionToken)}</span>
                              : p.mention
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
                <ReactionChips
                  scope="realm"
                  messageId={m.id}
                  groups={reactions.groupsFor(m.id)}
                  reactorsFor={reactions.reactorsFor}
                  // Realm messages all sit on the left of an avatar-padded column,
                  // so the chips follow the bubble's own left edge.
                  align="left"
                  canReact={canAddReactions}
                  hidden={String(m.id).startsWith("pending-")}
                  pulse={reactions.lastPulse}
                  onToggle={(emoji) => reactions.toggle(m.id, emoji)}
                />
                <MessageLinkPreviews
                  text={m.body}
                  messageId={m.id}
                  scope="realm"
                  canHide={mine || canModerate}
                  removed={removedPreviews.hidden.has(m.id)}
                />
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

      <PinnedListSheet
        open={pinsOpen}
        onOpenChange={setPinsOpen}
        pins={pins}
        canModerate={canModerate}
        unpinningId={unpinningId}
        onJump={jumpToPin}
        onUnpin={(pin) => void handlePinToggle(pin.message_id, true)}
      />

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
        {myWriteBlocked && (
          <p className="mx-auto mb-2 w-full max-w-3xl text-center text-[11px] text-muted-foreground">
            Writing is off in {activeRoom ? `#${activeRoom.name}` : `#${c.name}`} for you. A moderator can switch it back on.
          </p>
        )}
        <div className="mx-auto flex w-full max-w-3xl gap-2">
          <GifPicker onSelect={(marker) => setBody((current) => `${current}${current ? " " : ""}${marker}`)} />
          {/* The slider and the mention popup both anchor to the input wrapper, so
              they can never end up on opposite sides of the composer. */}
          <div className="relative min-w-0 flex-1">
            <AnimatePresence>
              {slashMenuOpen && (
                <div className="absolute inset-x-0 bottom-full z-40 mb-2">
                  <SlashCommandMenu
                    commands={slashMatches}
                    activeIndex={slashActive}
                    onHover={setSlashIndex}
                    onSelect={pickSlashCommand}
                  />
                </div>
              )}
            </AnimatePresence>
          <Input
            ref={inputRef}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setSlashHidden(false);
              setSlashIndex(0);
              setCaret(e.target.selectionStart ?? e.target.value.length);
            }}
            onKeyUp={(e) => setCaret((e.target as HTMLInputElement).selectionStart ?? 0)}
            onClick={(e) => setCaret((e.target as HTMLInputElement).selectionStart ?? 0)}
            onKeyDown={(e) => {
              // Arrow keys and Enter belong to the slash menu while it is open.
              if (slashMenuOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                e.preventDefault();
                setSlashIndex((current) =>
                  wrapIndex(current + (e.key === "ArrowDown" ? 1 : -1), slashMatches.length),
                );
                return;
              }
              if (slashMenuOpen && (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey))) {
                e.preventDefault();
                const chosen = slashMatches[slashActive] ?? slashMatches[0];
                if (chosen) pickSlashCommand(chosen);
                return;
              }
              if (slashMenuOpen && e.key === "Escape") { e.preventDefault(); setSlashHidden(true); return; }
              if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer: fine)").matches) { e.preventDefault(); void handleSend(); }
            }}
            placeholder={composerBlock ?? "Message"}
            disabled={!joined || sending || roomLockedForMe || myWriteBlocked}
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
          </div>
          <Button onClick={handleSend} disabled={!joined || !body.trim() || sending || roomLockedForMe || myWriteBlocked} size="icon" className="bg-gradient-primary border-0 shadow-glow shrink-0">
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
