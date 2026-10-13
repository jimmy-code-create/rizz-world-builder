import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useEffect, useRef, useState } from "react";
import { Shield, UserMinus, UserX, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
import { ArrowLeft, BarChart3, Bot as BotIcon, CalendarClock, Flag, Hash, Lock, Maximize2, Megaphone, Gift, LogOut, MessagesSquare, Mic, MicOff, Pencil, Search, Send, Settings, ShieldCheck, SmilePlus, Sparkles, Trash2, UserCog, UserPlus, Users, Copy, Plus, Volume2 } from "lucide-react";
import { EditRealmSheet } from "@/components/realms/EditRealmSheet";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { MessageActionMenu } from "@/components/chat/MessageActionMenu";
import { ReactionChips, burstOverMessage } from "@/components/chat/ReactionChips";
import { DateSeparator, dayKey } from "@/components/chat/DateSeparator";
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
import { ChatMessageMedia } from "@/components/chat/ChatMessageMedia";
import { nameColorFor } from "@/lib/chat-appearance";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PollCard } from "@/components/chat/PollCard";
import { TrackCard } from "@/components/chat/TrackCard";
import { ThreadSheet } from "@/components/chat/ThreadSheet";
import { MessageSearchSheet } from "@/components/chat/MessageSearchSheet";
import { LevelsSheet } from "@/components/chat/LevelsSheet";
import { VoiceChannelMusic } from "@/components/chat/VoiceChannelMusic";
import { ScheduleDialog } from "@/components/chat/ScheduleDialog";
import { PollDialog } from "@/components/chat/PollDialog";
import { RealmEmojiPicker } from "@/components/chat/RealmEmojiPicker";
import { ReactionRoleDialog } from "@/components/chat/ReactionRoleDialog";
import type { PollCard as PollCardPayload } from "@/lib/realm-polls";
import { threadLabel } from "@/lib/realm-threads";
import { flushDueScheduledMessages } from "@/lib/realm-schedule";
import { isMusicCommand } from "@/lib/music";
import { rolesForMessage, useReactionRoles } from "@/lib/reaction-roles";
import { fetchRealmEmoji, realmEmojiKey, splitEmojiSegments } from "@/lib/realm-emoji";
import { emojiTextClass } from "@/lib/text-size";
import { RealmForum } from "@/components/forum/RealmForum";

const TYPE_ICON = { text: Hash, announcement: Megaphone, voice: Mic, drops: Gift, forum: MessagesSquare };

/** Room kinds a moderator can create from here, forum included. */
const CREATABLE_ROOM_KINDS: RealmRoomKind[] = ["text", "announcement", "voice", "forum"];

/** Member lists paginate instead of mounting every row of a big realm at once. */
const MEMBER_PAGE_SIZE = 25;

type RealmChannelCall = {
  room: { id: string; realm_room_id: string | null; host_id: string; title: string };
  participants: CallParticipantRow[];
};

export const Route = createFileRoute("/_app/r/$slug")({
  // A channel, or a forum thread inside one, is addressable: the room and post
  // live in the URL so a link lands where it was meant to.
  validateSearch: (search: Record<string, unknown>): { room?: string; post?: string } => ({
    room: typeof search.room === "string" && search.room ? search.room : undefined,
    post: typeof search.post === "string" && search.post ? search.post : undefined,
  }),
  head: ({ params }) => ({ meta: [{ title: `#${params.slug} · RIZZ` }] }),
  component: RealmPage,
});

function RealmPage() {
  const { slug } = Route.useParams();
  const search = Route.useSearch();
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
  // The one message opened full size from the long-press menu.
  const [viewingMessage, setViewingMessage] = useState<{
    author: string;
    avatarUrl: string | null;
    time: string;
    body: string;
    attachmentUrl: string | null;
  } | null>(null);
  const [botsOpen, setBotsOpen] = useState(false);
  // Slash-command popup: which row is highlighted, and whether Escape dismissed
  // it for the text currently in the composer.
  const [slashIndex, setSlashIndex] = useState(0);
  const [slashHidden, setSlashHidden] = useState(false);
  // Phase 5: search, levels, threads, scheduling, polls, emoji, reaction roles.
  const [searchOpen, setSearchOpen] = useState(false);
  const [levelsOpen, setLevelsOpen] = useState(false);
  const [threadRoot, setThreadRoot] = useState<{ id: string; body: string; author: string | null } | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [reactionRoleMessageId, setReactionRoleMessageId] = useState<string | null>(null);

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

  // Default to the room the link named, then the realm's default room.
  useEffect(() => {
    if (activeRoomId) return;
    const list = rooms.data ?? [];
    if (list.length === 0) return;
    const linked = search.room ? list.find((r) => r.id === search.room) : undefined;
    const def = linked ?? list.find((r) => r.is_default) ?? list[0];
    setActiveRoomId(def.id);
  }, [rooms.data, activeRoomId, search.room]);

  /**
   * Switching channel writes the choice to the URL, so a channel — and a forum
   * thread inside it — can be shared, reloaded or opened from a notification.
   */
  const selectRoom = (roomId: string) => {
    setActiveRoomId(roomId);
    void nav({ to: "/r/$slug", params: { slug }, search: { room: roomId }, replace: true });
  };

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
  // Phase 5 data: reaction roles and this realm's custom emoji. Both feed the
  // message list (the reaction-role menu and `:name:` expansion).
  const reactionRoles = useReactionRoles(realm.data?.id);
  const emojiList = useQuery({
    queryKey: realmEmojiKey(realm.data?.id),
    enabled: !!realm.data,
    queryFn: () => fetchRealmEmoji(realm.data!.id),
  });
  const emojiByName = new Map((emojiList.data ?? []).map((entry) => [entry.name, entry.url]));
  const emojiNames = new Set(emojiByName.keys());
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
  // arguments after the first space never sit under a popup. It also opens when
  // nothing matches, with a one-line explanation instead of a silent no-op.
  const slashMenuOpen =
    !slashHidden && !sending && !realmCommands.isLoading && !!slashQuery && slashQuery.typingName;
  const slashMatchCount = slashMatches.length;
  const slashActive = Math.min(slashIndex, Math.max(slashMatchCount - 1, 0));
  const slashHint = !slashMenuOpen || slashMatchCount > 0
    ? undefined
    : realmCommands.commands.length === 0
      ? "No bot commands in this channel yet."
      : `No command matches "/${slashQuery?.name ?? ""}".`;

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

  // Scheduled messages have no cron: flush whatever is due whenever this realm
  // is on screen, then let realtime deliver the result to everyone.
  useEffect(() => {
    const realmId = realm.data?.id;
    if (!realmId) return;
    void flushDueScheduledMessages()
      .then((sent) => {
        if (sent > 0) {
          void qc.invalidateQueries({ queryKey: ["realm-messages", realmId] });
          void qc.invalidateQueries({ queryKey: ["realm-room-messages"] });
        }
      })
      .catch(() => {
        // A failed flush only delays a scheduled message until the next visit.
      });
  }, [realm.data?.id, qc]);

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

    // Music commands are a voice-channel feature, so a text channel never
    // offers them. Typing one there used to post "/play …" as a plain message,
    // which read as the bot ignoring the request — intercept it instead.
    if (parsed && isMusicCommand(parsed.name)) {
      toast.error("Music commands work in voice channels — open one and use its music panel.");
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

  /** Flashes a message on screen, whichever list it belongs to. */
  const jumpToMessage = (messageId: string) => {
    window.setTimeout(() => {
      document.getElementById(`msg-${messageId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightId(messageId);
      window.setTimeout(() => setHighlightId((current) => (current === messageId ? null : current)), 1600);
    }, 50);
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

  /**
   * Drops a message from whichever list is on screen.
   *
   * A text channel's rows live under `realm-room-messages`, not
   * `realm-messages`. Deleting only touched the realm cache, so in a channel the
   * message stayed on screen after it had been deleted — it looked like the
   * delete never happened.
   */
  const removeMessageFromCache = (messageId: string) => {
    const drop = (rows: any[] | undefined) =>
      Array.isArray(rows) ? rows.filter((row: { id: string }) => row.id !== messageId) : rows;
    qc.setQueryData<any[]>(["realm-messages", c.id], drop);
    if (activeRoomId) qc.setQueryData<any[]>(["realm-room-messages", activeRoomId], drop);
  };

  /**
   * Deletes one message, mine or (for owners and moderators) someone else's.
   *
   * My own row goes first; if the row is not mine to delete — a bot message, or
   * a moderation-only policy — an owner or moderator falls back to the
   * moderation RPC instead of being told "you can only delete messages you
   * sent".
   */
  const handleDeleteMessage = async (messageId: string, options?: { moderate?: boolean }) => {
    if (!user) return;
    try {
      if (options?.moderate) {
        await moderateDeleteMessage(messageId, "Removed by a moderator");
      } else {
        const { data, error } = await supabase
          .from("messages")
          .delete()
          .eq("id", messageId)
          .eq("sender_id", user.id)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          if (!canModerate) throw new Error("You can only delete messages you sent.");
          await moderateDeleteMessage(messageId, "Removed by the sender");
        }
      }
      removeMessageFromCache(messageId);
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
      selectRoom(room.id);
      setRoomsOpen(false);
      setNewRoomName("");
      toast.success(
        newRoomKind === "voice" ? "Voice room created" : newRoomKind === "forum" ? "Forum created" : "Text room created",
      );
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

  /**
   * Mints a 7-day invite and copies the whole link, not the bare code: the link
   * is what someone can actually paste into a chat, and it works for people who
   * are not signed in yet (they log in and land straight on the join page).
   */
  const copyRealmCode = async () => {
    if (!c.id) return;
    try {
      const inviteCode = await createRealmInvite({ realmId: c.id, expiresInDays: 7 });
      const link = `${window.location.origin}/join-realm/${inviteCode}`;
      try {
        await navigator.clipboard.writeText(link);
        toast.success("7-day invite link copied");
      } catch {
        toast.success(`Invite ready: ${link}`);
      }
      await qc.invalidateQueries({ queryKey: ["realm-invites", c.id] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't create the realm invite");
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
          aria-label="Search messages"
          onClick={() => setSearchOpen(true)}
        >
          <Search className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="glass shrink-0 border-white/10"
          aria-label="Levels"
          onClick={() => setLevelsOpen(true)}
        >
          <Sparkles className="h-4 w-4" />
        </Button>
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
                <Copy className="h-4 w-4" /> Copy invite link
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

      {/* One message, full size: opened from "View message" in the long-press
          menu, for text that the chat row has to wrap tightly. */}
      <Dialog
        open={!!viewingMessage}
        onOpenChange={(open) => { if (!open) setViewingMessage(null); }}
      >
        <DialogContent className="glass-strong max-h-[85dvh] overflow-y-auto border-white/10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-left font-display text-base">
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage src={viewingMessage?.avatarUrl ?? undefined} />
                <AvatarFallback className="bg-gradient-primary text-xs font-bold">
                  {(viewingMessage?.author ?? "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{viewingMessage?.author}</span>
                <span className="text-[11px] font-normal text-muted-foreground">{viewingMessage?.time}</span>
              </span>
            </DialogTitle>
            <DialogDescription className="sr-only">The full message</DialogDescription>
          </DialogHeader>
          {viewingMessage?.attachmentUrl && (
            <ChatMessageMedia src={viewingMessage.attachmentUrl} alt="Image shared in chat" />
          )}
          <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
            {viewingMessage?.body}
          </p>
          {viewingMessage?.body && (
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full gap-2 border-white/10 bg-white/5"
              onClick={() => {
                void navigator.clipboard.writeText(viewingMessage.body).then(
                  () => toast.success("Copied"),
                  () => toast.error("Couldn't copy this message"),
                );
              }}
            >
              <Copy className="h-4 w-4" /> Copy message
            </Button>
          )}
        </DialogContent>
      </Dialog>

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
                onClick={() => selectRoom(room.id)}
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
                  {CREATABLE_ROOM_KINDS.map((k) => (
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

      {activeRoom?.kind !== "voice" && activeRoom?.kind !== "forum" && (
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
        <div className="chat-bar shrink-0 border-b border-white/5 px-4 py-3">
          {/* ONE compact voice bar. The in-call controls (mic, leave) live in the
              single global VoiceCallBar below, so this row never repeats a
              "Return to call" button or a second call bar. */}
          <div className="flex items-center gap-3">
            <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-primary text-white">
              <Mic className="h-5 w-5" />
              {activeChannelPeople.length > 0 && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-background bg-emerald-400" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm font-bold">{activeRoom.name || "Voice channel"}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {activeChannelPeople.length > 0 ? `${activeChannelPeople.length} in call` : "No one is here yet"}
              </p>
            </div>
            {activeChannelPeople.length > 0 && (
              <span className="flex shrink-0 -space-x-2">
                {activeChannelPeople.slice(0, 4).map((person) => (
                  <Avatar key={person.user_id} className="h-7 w-7 ring-2 ring-background">
                    <AvatarImage src={person.user?.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-gradient-primary text-[10px] font-bold">
                      {(person.user?.display_name || person.user?.username || "?").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </span>
            )}
            {activeRoom.mods_only && !canModerate ? (
              <Button type="button" disabled className="min-h-11 shrink-0 gap-2 glass border-white/10">
                <Lock className="h-4 w-4" /> Mods only
              </Button>
            ) : activeCall?.channelId === activeRoom.id ? (
              <Button
                type="button"
                onClick={() => openCallView()}
                className="min-h-11 shrink-0 gap-2 glass border-white/10"
              >
                <Mic className="h-4 w-4" /> Open call
              </Button>
            ) : (
              <Button
                type="button"
                disabled={joiningVoice}
                onClick={() => joinChannel({ id: activeRoom.id, realmId: c.id, name: activeRoom.name })}
                className="min-h-11 shrink-0 gap-2 border-0 bg-gradient-primary shadow-glow"
              >
                <Mic className="h-4 w-4" /> {joiningVoice ? "Joining…" : "Join voice"}
              </Button>
            )}
          </div>

          {/* MUSIC BOT is a voice-channel feature: its queue is keyed to this
              room, and a voice channel has no composer, so `/play` lives here. */}
          <VoiceChannelMusic realmId={c.id} roomId={activeRoom.id} />
        </div>
      )}

      {/* A forum channel swaps the message list for the forum surface: its own
          hero, sticky filters, thread cards and the thread page. */}
      {activeRoom?.kind === "forum" && (
        <RealmForum
          realmId={c.id}
          realmName={c.name}
          room={activeRoom}
          accentColor={c.accent_color ?? null}
          userId={user?.id ?? null}
          canModerate={canModerate}
          joined={joined}
          initialPostId={search.post ?? null}
          onPostChange={(postId) =>
            void nav({
              to: "/r/$slug",
              params: { slug },
              search: { room: activeRoom.id, post: postId ?? undefined },
              replace: true,
            })
          }
        />
      )}

      {activeRoom?.kind !== "forum" && (
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
            // Realm names use the shared palette (or the author's own accent),
            // never the default link-blue on the dark surface.
            const authorColor = nameColorFor(isBot ? m.bot_id : m.sender_id, authorAccent);
            // "View message": the long-press menu shows what was pressed, and this
            // opens it full size when the text is longer than the row.
            const messageTime = new Date(m.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
            const openFullMessage = () =>
              setViewingMessage({
                author: authorName,
                avatarUrl: authorAvatar,
                time: new Date(m.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }),
                body: m.body ?? "",
                attachmentUrl: m.attachment_url ?? null,
              });
            const previous = messageRows[index - 1];
            const startsGroup = !previous ||
              previous.sender_id !== m.sender_id ||
              new Date(m.created_at).getTime() - new Date(previous.created_at).getTime() > 5 * 60 * 1000;
            // A new calendar day always starts a new group and gets its divider,
            // however recently the previous message was sent.
            const newDay = !previous || dayKey(previous.created_at) !== dayKey(m.created_at);
            const messageClock = new Date(m.created_at).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            });
            // "@user pinned a message" reads as a system line, not a bubble.
            if ((m as { system?: boolean }).system) {
              return <SystemLine key={m.id} text={m.body} />;
            }
            return (
              <Fragment key={m.id}>
              {newDay && <DateSeparator date={m.created_at} />}
              {/* Realm chat is Discord-style flat rows, not bubbles. */}
              <motion.div
                id={`msg-${m.id}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`realm-message ${startsGroup || newDay ? "realm-message--group-start" : ""} ${highlightId === m.id ? "bg-[var(--rizz-pink)]/[0.08] ring-2 ring-[var(--rizz-pink)]/50" : ""}`}
              >
              {(startsGroup ? (
                <Avatar className="h-9 w-9 shrink-0 ring-2" style={{ boxShadow: `0 0 10px color-mix(in srgb, ${authorColor} 40%, transparent)` }}>
                  <AvatarImage src={authorAvatar ?? undefined} />
                  <AvatarFallback
                    className={`text-xs font-bold ${isBot ? "bg-[var(--rizz-violet)] text-white" : "bg-gradient-primary"}`}
                  >
                    {authorInitial}
                  </AvatarFallback>
                </Avatar>
              ) : (
                // Same author, same day: the avatar gutter carries the time
                // instead, revealed on hover (and never shown on touch, where
                // the long-press preview has it).
                <span aria-hidden="true" className="realm-message__time">{messageClock}</span>
              ))}
              <div className="flex-1 min-w-0">
                {startsGroup && <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="font-bold text-sm" style={{ color: authorColor }}>{authorName}</span>
                  {isBot && <BotBadge />}
                  {pinnedIds.has(m.id) && <PinBadge />}
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(m.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </span>
                </div>}
                {/* Media renders as its own block — never inside a bubble. */}
                {m.attachment_url && !String(m.id).startsWith("pending-") && (
                  <ChatMessageMedia
                    src={m.attachment_url}
                    alt="Image shared in chat"
                    className="my-1"
                  />
                )}
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
                  preview={{
                    author: authorName,
                    time: messageTime,
                    body: m.body,
                    avatarUrl: authorAvatar,
                    onView: openFullMessage,
                  }}
                  actions={[
                    {
                      label: "View message",
                      icon: Maximize2,
                      onSelect: openFullMessage,
                    },
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
                    {
                      label: "Reply in thread",
                      icon: MessagesSquare,
                      onSelect: () =>
                        setThreadRoot({
                          id: m.id,
                          body: m.body ?? "",
                          author: isBot ? botRow?.name ?? "Bot" : authorName,
                        }),
                    },
                    ...(canModerate
                      ? [{
                          label: "Reaction roles",
                          icon: UserCog,
                          onSelect: () => setReactionRoleMessageId(m.id),
                        }]
                      : []),
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
                                onSelect: () => { void handleDeleteMessage(m.id, { moderate: true }); },
                              }]
                            : []),
                          {
                          label: "Report message",
                          icon: Flag,
                          onSelect: () => {
                            void reportRealmMessage(m.id, "Reported from chat").then(
                              () => toast.success("Thanks — a moderator will take a look"),
                              (error: unknown) => {
                                const message = error instanceof Error ? error.message : "";
                                // A second report is a "nothing to do" state, not a failure:
                                // say it plainly instead of flashing a red alarm.
                                if (/already|duplicate|unique/i.test(message)) {
                                  toast.info("You already reported this message", {
                                    description: "A moderator can still see your first report.",
                                  });
                                  return;
                                }
                                toast.error(message || "Couldn't send that report");
                              },
                            );
                          },
                        },
                        ]),
                  ]}
                >
                  <div className={`realm-message__body select-none touch-manipulation ${emojiTextClass(m.body, "comment") ?? ""} ${String(m.id).startsWith("pending-") ? "opacity-55" : ""}`}>
                    {renderGifSegments(m.body).map((seg, si) =>
                      seg.isGif || seg.isSticker
                        ? <GifContent key={si}>{seg.marker ?? ""}</GifContent>
                        : splitEmojiSegments(seg.value, emojiNames).map((part, xi) =>
                            part.name ? (
                              <img
                                key={`${si}-${xi}`}
                                src={emojiByName.get(part.name)}
                                alt={part.name}
                                title={`:${part.name}:`}
                                className="inline-block h-7 w-7 align-middle mx-0.5 object-contain"
                              />
                            ) : (
                              renderCaptionWithTags(part.text).map((p, pi) =>
                                p.mentionToken
                                  ? <span key={`${si}-${xi}-${pi}`} className="mention-highlight font-medium">{mentionLabels(p.mentionToken)}</span>
                                  : p.mention
                                  ? <Link key={`${si}-${xi}-${pi}`} to="/u/$username" params={{ username: p.mention }} className="mention-highlight font-medium hover:underline">{p.text}</Link>
                                  : p.tag
                                    ? <Link key={`${si}-${xi}-${pi}`} to="/tag/$tag" params={{ tag: p.tag }} className="text-[var(--rizz-pink)] hover:underline font-medium">{p.text}</Link>
                                    : p.url
                                      ? <a key={`${si}-${xi}-${pi}`} href={p.url} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline break-words">{p.text}</a>
                                      : <span key={`${si}-${xi}-${pi}`}>{p.text}</span>
                              )
                            )
                          )
                    )}
                  </div>
                </MessageActionMenu>
                {/* Rich payloads: polls and queued tracks carry their own card. */}
                {m.card?.type === "poll" && (
                  <PollCard card={m.card as PollCardPayload} canVote={joined} />
                )}
                {m.card?.type === "track" && <TrackCard card={m.card} />}
                {!!m.reply_count && (
                  <button
                    type="button"
                    onClick={() =>
                      setThreadRoot({
                        id: m.id,
                        body: m.body ?? "",
                        author: isBot ? botRow?.name ?? "Bot" : authorName,
                      })
                    }
                    className="mt-1 flex w-fit items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
                  >
                    <MessagesSquare className="h-3 w-3" /> {threadLabel(m.reply_count)}
                  </button>
                )}
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
      )}

      <PinnedListSheet
        open={pinsOpen}
        onOpenChange={setPinsOpen}
        pins={pins}
        canModerate={canModerate}
        unpinningId={unpinningId}
        onJump={jumpToPin}
        onUnpin={(pin) => void handlePinToggle(pin.message_id, true)}
      />

      <MessageSearchSheet
        open={searchOpen}
        onOpenChange={setSearchOpen}
        realmId={c.id}
        roomId={slashRoomId}
        onJump={jumpToMessage}
      />
      <LevelsSheet open={levelsOpen} onOpenChange={setLevelsOpen} realmId={c.id} />
      <ThreadSheet
        open={!!threadRoot}
        onOpenChange={(open) => { if (!open) setThreadRoot(null); }}
        root={threadRoot}
        realmId={c.id}
        roomId={slashRoomId}
      />
      <ScheduleDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        realmId={c.id}
        roomId={slashRoomId}
        body={body}
        onScheduled={() => { setBody(""); setCaret(0); }}
      />
      <PollDialog open={pollOpen} onOpenChange={setPollOpen} realmId={c.id} roomId={slashRoomId} />
      <RealmEmojiPicker
        open={emojiOpen}
        onOpenChange={setEmojiOpen}
        realmId={c.id}
        canManage={canModerate}
        onPick={(token) => setBody((current) => `${current}${current && !current.endsWith(" ") ? " " : ""}${token} `)}
      />
      <ReactionRoleDialog
        open={!!reactionRoleMessageId}
        onOpenChange={(open) => { if (!open) setReactionRoleMessageId(null); }}
        messageId={reactionRoleMessageId ?? ""}
        roles={rolesForMessage(reactionRoles.data ?? [], reactionRoleMessageId ?? "")}
        onChanged={() => void reactionRoles.refetch()}
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

      {activeRoom?.kind !== "forum" && (
      <div className="chat-bar relative z-20 shrink-0 border-t border-white/5 px-3 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)]">
        {myWriteBlocked && (
          <p className="mx-auto mb-2 w-full max-w-3xl text-center text-[11px] text-muted-foreground">
            Writing is off in {activeRoom ? `#${activeRoom.name}` : `#${c.name}`} for you. A moderator can switch it back on.
          </p>
        )}
        <div className="mx-auto flex w-full max-w-3xl gap-2">
          <GifPicker onSelect={(marker) => setBody((current) => `${current}${current ? " " : ""}${marker}`)} />
          <button
            type="button"
            aria-label="Custom emoji"
            onClick={() => setEmojiOpen(true)}
            disabled={!joined}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground disabled:opacity-40"
          >
            <SmilePlus className="h-4 w-4" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Add a poll or schedule this message"
                disabled={!!composerBlock}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="glass-strong border-white/10">
              <DropdownMenuItem onSelect={() => setPollOpen(true)}>
                <BarChart3 className="mr-2 h-4 w-4" /> New poll
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setScheduleOpen(true)} disabled={!body.trim()}>
                <CalendarClock className="mr-2 h-4 w-4" /> Schedule message
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* The slider and the mention popup both anchor to the input wrapper, so
              they can never end up on opposite sides of the composer. */}
          <div className="relative min-w-0 flex-1">
            <AnimatePresence>
              {slashMenuOpen && (
                <div className="absolute inset-x-0 bottom-full z-40 mb-2">
                  <SlashCommandMenu
                    commands={slashMatches}
                    activeIndex={slashActive}
                    emptyHint={slashHint}
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
              // Arrow keys and Enter belong to the slash menu while it has rows;
              // the no-match hint does not steal Enter, so the message still sends.
              if (slashMatchCount > 0 && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                e.preventDefault();
                setSlashIndex((current) =>
                  wrapIndex(current + (e.key === "ArrowDown" ? 1 : -1), slashMatches.length),
                );
                return;
              }
              if (slashMatchCount > 0 && (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey))) {
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
            className="composer-input glass border-white/10"
          />
          <MentionAutocomplete
            value={body}
            caret={caret}
            memberIds={(members.data ?? []).map((member) => member.user_id)}
            emptyHint="No realm member matches that name."
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
      )}
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
