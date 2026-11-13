import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CloseButton } from "@/components/ui/close-button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Phone,
  Video,
  MoreVertical,
  ArrowDown,
  Search,
  Clock,
  X,
  Trash2,
  ImagePlus,
  Camera,
  Folder,
  Users,
  Copy,
  Flag,
  Forward,
  Pencil,
  Check,
  Bell,
  BellOff,
  Download,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { ChatAttachButton } from "@/components/chat/ChatAttachSheet";
import { MessageComposer } from "@/components/chat/MessageComposer";
import type { ComposerInputHandle } from "@/components/chat/ComposerInput";
import { useAvailableEmojis } from "@/lib/emoji-available";
import { CatStickerSheet } from "@/components/chat/CatStickerSheet";
import { ChatPollCard } from "@/components/chat/PollCard";
import { asChatPollCard } from "@/lib/chat-polls";
import { CornerUpLeft } from "lucide-react";
import { ShareToChatSheet } from "@/components/share/ShareToChatSheet";
import { shareDraftForMessage, type ShareDraft } from "@/lib/share-to-chat";
import { isMediaPlaceholderText, isOnlyMediaMarker } from "@/lib/gif-content";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "@/lib/toast";
import { hapticSend } from "@/lib/haptics";
import { chatUploadLimitBytes, formatUploadLimit } from "@/lib/purify";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MessageActionMenu } from "@/components/chat/MessageActionMenu";
import { DateSeparator, dayKey } from "@/components/chat/DateSeparator";
import { ReactionChips, burstOverMessage } from "@/components/chat/ReactionChips";
import { reactionHaptic } from "@/components/chat/ReactionBurst";
import { MessageLinkPreviews } from "@/components/chat/LinkPreviews";
import { useHiddenLinkPreviews } from "@/lib/link-preview";
import { CustomStatusLine } from "@/components/presence/StatusDot";
import { publicCustomStatus, publicStatusOf, usePresence } from "@/lib/presence";
import {
  markKnocksSeen,
  relativeLastSeen,
  sendKnock,
  useKnockMood,
  useKnockThread,
  type Knock,
} from "@/lib/knock";
import { KnockThreadCard } from "@/components/knock/KnockThreadCard";
import { DmKnockStrip } from "@/components/knock/DmKnockStrip";
import { ResponsiveOverlay } from "@/components/ui/responsive-overlay";
import { useChatReactions } from "@/lib/useChatReactions";
import { useMediaViewer } from "@/components/media/useMediaViewer";
import { DOUBLE_TAP_REACTION } from "@/lib/reactions";
import { VoiceNoteBubble } from "@/components/chat/VoiceNoteBubble";
import { startRecording, uploadVoiceNote } from "@/lib/voice-notes";
import { blockUser, isBlocked, muteUser, unblockUser, unmuteUser } from "@/lib/social";
import { compressChatImage } from "@/lib/chat-media";
import { ChatMessageMedia } from "@/components/chat/ChatMessageMedia";
import { MessageRow } from "@/components/chat/MessageRow";
import { ReplyQuote } from "@/components/chat/ReplyQuote";
import { replyPreviewText } from "@/lib/chat-reply";
import { SharedPostCards } from "@/components/chat/SharedPostCards";
import { withoutShareLinks } from "@/lib/share-links";
import { extractInviteCode } from "@/lib/groups";
import { GroupInviteMessageCard } from "@/components/chat/GroupInviteMessageCard";
import { GifPicker } from "@/components/GifPicker";
import { GifContent } from "@/components/GifContent";
import { WallpaperSheet } from "@/components/chat/WallpaperSheet";
import { loadWallpaper, wallpaperStyle, type ChatWallpaper } from "@/lib/chat-wallpaper";
import { DmThreadRail } from "@/components/chat/DmThreadRail";
import { callTopic, findJoinedChannel, subscribeSafely } from "@/lib/realtime";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { MentionAutocomplete, replaceMention } from "@/components/MentionAutocomplete";
import { renderCaptionWithTags } from "@/lib/hashtags";
import { renderGifSegments } from "@/lib/gif-content";
import { MarkdownText } from "@/components/MarkdownText";
import { EmojiText } from "@/components/emoji/EmojiText";
import { useMentionLabels } from "@/lib/mention-tokens";
import { scrollChatToLatest } from "@/lib/chat-scroll";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

// Quick and extended reaction sets live in @/lib/reactions so DMs, realm chat
// and group chat stay in sync.
const MESSAGE_PAGE_SIZE = 30;
const MAX_MESSAGE_LENGTH = 10_000;

/** Mute lengths offered in the DM menu; `null` means until it is turned off. */
const MUTE_PRESETS: Array<{ label: string; minutes: number }> = [
  { label: "1 hour", minutes: 60 },
  { label: "8 hours", minutes: 480 },
  { label: "24 hours", minutes: 1_440 },
  { label: "1 week", minutes: 10_080 },
];
type CachedDirectMessage = Database["public"]["Tables"]["direct_messages"]["Row"] & {
  delivery_status?: "sending" | "failed";
  deleted_at?: string | null;
};

function ownChatImagePath(url: string | null, userId: string) {
  const marker = "/storage/v1/object/public/chat-media/";
  const markerIndex = url?.indexOf(marker) ?? -1;
  if (!url || markerIndex < 0) return null;
  try {
    const path = decodeURIComponent(url.slice(markerIndex + marker.length));
    return path.startsWith(`${userId}/`) ? path : null;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/_app/dm/$userId")({
  // `?message=` deep-links a notification to one message in the thread.
  validateSearch: (search: Record<string, unknown>): { message?: string } => ({
    message: typeof search.message === "string" && search.message ? search.message : undefined,
  }),
  head: () => ({ meta: [{ title: "DM · RIZZ" }] }),
  component: DMPage,
});

function DMPage() {
  const { userId } = Route.useParams();
  const search = Route.useSearch();
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [body, setBody] = useState("");
  // Where the caret sits in the composer, so the `@` mention popup knows which
  // username is being typed.
  const [caret, setCaret] = useState(0);
  const [draftReady, setDraftReady] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [sendingCount, setSendingCount] = useState(0);
  const sendingMessage = sendingCount > 0;
  const [gifOpen, setGifOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  // The field is a contenteditable div (ComposerInput), so a custom emoji draws
  // as a picture inline instead of pasting its `<:name:id>` token as text.
  const composerRef = useRef<ComposerInputHandle>(null);
  // Inline emoji images: the same cached list the picker reads.
  const availableEmoji = useAvailableEmojis();
  const emojiUrlById = useMemo(() => {
    const map = new Map<string, string>();
    for (const emoji of availableEmoji.data?.private ?? []) map.set(emoji.id, emoji.url);
    for (const realm of availableEmoji.data?.realms ?? []) {
      for (const emoji of realm.emojis) map.set(emoji.id, emoji.url);
    }
    return map;
  }, [availableEmoji.data]);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const wasNearBottomRef = useRef(true);
  const previousMessageIdsRef = useRef<string[]>([]);
  const isMobile = useIsMobile();
  const reduceMotion = useReducedMotion();
  const [openMsg, setOpenMsg] = useState<string | null>(null);
  // The desktop hover toolbar's smiley opens the menu straight into reactions;
  // every other entry point (long press, right click, keyboard) opens actions.
  const [openMsgView, setOpenMsgView] = useState<"actions" | "reactions">("actions");
  const [replyTo, setReplyTo] = useState<{
    id: string;
    body: string;
    mine: boolean;
    attachmentUrl?: string | null;
  } | null>(null);
  const [missingReplies, setMissingReplies] = useState<Set<string>>(() => new Set());
  const [editing, setEditing] = useState<{
    id: string;
    previousBody: string;
    prefix: string;
    text: string;
    mine: boolean;
  } | null>(null);
  const preEditDraftRef = useRef("");

  // Replying opens the keyboard and keeps the composer above it: the list is
  // re-pinned to the newest message while the viewport settles, so the reply
  // bar never ends up behind the keyboard on a phone.
  useEffect(() => {
    if (!replyTo) return;
    composerRef.current?.focus();
    scrollChatToLatest(scrollRef.current);
  }, [replyTo]);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [online, setOnline] = useState(false);
  const [peerVisible, setPeerVisible] = useState(true);
  const [peerTyping, setPeerTyping] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const presenceCh = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimer = useRef<number | null>(null);
  const lastTypingBroadcastAtRef = useRef(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchIndex, setSearchIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [callPrompt, setCallPrompt] = useState<null | "offline" | "choose">(null);
  const [pendingCallVideo, setPendingCallVideo] = useState(false);
  const [callKnockSending, setCallKnockSending] = useState(false);
  const [callKnockSent, setCallKnockSent] = useState(false);
  const [callKnockError, setCallKnockError] = useState<string | null>(null);
  const [narrowHeader, setNarrowHeader] = useState(false);
  const [dismissedStripKey, setDismissedStripKey] = useState<string | null>(null);
  const avatarPressTimer = useRef<number | null>(null);
  const avatarPressStart = useRef<{ x: number; y: number } | null>(null);
  const avatarLongPressed = useRef(false);
  const [recording, setRecording] = useState(false);
  const recStart = useRef(0);
  const stopRec = useRef<null | (() => Promise<{ blob: Blob; durationMs: number }>)>(null);
  const [recMs, setRecMs] = useState(0);
  const [sendingVoice, setSendingVoice] = useState(false);
  // The chat's own wallpaper: a preset or an uploaded background URL.
  const [wallpaper, setWallpaper] = useState<ChatWallpaper>(null);
  const [wallpaperOpen, setWallpaperOpen] = useState(false);
  const [muteOpen, setMuteOpen] = useState(false);
  const [muteBusy, setMuteBusy] = useState(false);
  const [muteError, setMuteError] = useState<string | null>(null);
  const [mutedUntil, setMutedUntil] = useState<number | null>(null);
  const lastMuteMinutesRef = useRef<number | null>(null);
  const [confirmBlockOpen, setConfirmBlockOpen] = useState(false);
  // Forward opens the same "send to" picker posts, reels and realms use.
  const [forwardDraft, setForwardDraft] = useState<ShareDraft | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const pendingMediaRef = useRef(new Map<string, File>());
  const pendingReplyRef = useRef(new Map<string, string>());
  const imageObjectUrlsRef = useRef(new Set<string>());
  const draftKey = user?.id ? `rizz:dm-draft:${user.id}:${userId}` : null;
  const muteUntilKey = user?.id ? `rizz:dm-mute-until:${user.id}:${userId}` : null;

  useEffect(
    () => () => {
      imageObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  useEffect(() => {
    setDraftReady(false);
    let saved = "";
    try {
      saved = draftKey ? (window.localStorage.getItem(draftKey) ?? "") : "";
    } catch {
      // Keep the composer usable when browser storage is disabled.
    }
    setBody(saved);
    setDraftReady(true);
  }, [draftKey]);

  useEffect(() => {
    setWallpaper(loadWallpaper("dm", userId));
  }, [userId]);

  // A timed mute survives a reload: the expiry lives beside the draft, and a
  // lapsed one removes the server row as soon as the chat opens.
  useEffect(() => {
    if (!muteUntilKey) {
      setMutedUntil(null);
      return;
    }
    try {
      const raw = window.localStorage.getItem(muteUntilKey);
      setMutedUntil(raw ? Number(raw) || null : null);
    } catch {
      setMutedUntil(null);
    }
  }, [muteUntilKey]);

  useEffect(() => {
    if (!mutedUntil) return;
    const remaining = mutedUntil - Date.now();
    if (remaining > 0) {
      const timer = window.setTimeout(() => setMutedUntil(Date.now()), remaining);
      return () => window.clearTimeout(timer);
    }
    setMutedUntil(null);
    try {
      if (muteUntilKey) window.localStorage.removeItem(muteUntilKey);
    } catch {
      // Storage may be disabled; the mute still ends for this tab.
    }
    if (!user?.id) return;
    void unmuteUser(user.id, userId)
      .then(() => qc.setQueryData(["mute-status", user.id, userId], false))
      .catch(() => undefined);
  }, [mutedUntil, muteUntilKey, qc, user?.id, userId]);

  // The single Call button is only for genuinely narrow phones; 340px is the
  // last width where Voice and Video can stay separate without squeezing the
  // name to a couple of characters.
  useEffect(() => {
    const query = window.matchMedia("(max-width: 339px)");
    const update = () => setNarrowHeader(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (callPrompt) return;
    setCallKnockSending(false);
    setCallKnockSent(false);
    setCallKnockError(null);
  }, [callPrompt]);

  useEffect(
    () => () => {
      if (avatarPressTimer.current !== null) window.clearTimeout(avatarPressTimer.current);
    },
    [],
  );

  // Escape closes search first, closes the conversation second. Without it the
  // only way out of a DM was the browser's own back button.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (searchOpen) {
        setSearchOpen(false);
        setSearchQ("");
        return;
      }
      if (openMsg || replyTo || wallpaperOpen) return;
      // Never steal the key from a field the user is typing in.
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName)))
        return;
      nav({ to: "/dms" });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [nav, openMsg, searchOpen, replyTo, wallpaperOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const frame = window.requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [searchOpen]);

  useEffect(() => {
    if (!draftReady || !draftKey) return;
    const timer = window.setTimeout(() => {
      try {
        if (body) window.localStorage.setItem(draftKey, body);
        else window.localStorage.removeItem(draftKey);
      } catch {
        // Draft storage is best-effort; typing and sending do not depend on it.
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [body, draftKey, draftReady]);

  // Live elapsed timer while recording
  useEffect(() => {
    if (!recording) return;
    const t = window.setInterval(() => setRecMs(Date.now() - recStart.current), 200);
    return () => window.clearInterval(t);
  }, [recording]);

  const openMessageMenu = (id: string, view: "actions" | "reactions" = "actions") => {
    setOpenMsgView(view);
    setOpenMsg(id);
  };

  const cancelEdit = () => {
    if (!editing) return;
    setEditing(null);
    setBody(preEditDraftRef.current);
    setCaret(preEditDraftRef.current.length);
    requestAnimationFrame(() => {
      const el = composerRef.current;
      el?.focus();
      el?.setSelection(preEditDraftRef.current.length);
    });
  };

  const beginEdit = (message: { id: string; body: string; prefix: string; text: string }) => {
    if (!user || !message.text.trim()) {
      toast.info("Only text messages can be edited");
      return;
    }
    preEditDraftRef.current = body;
    setReplyTo(null);
    setEditing({
      id: message.id,
      previousBody: message.body,
      prefix: message.prefix,
      text: message.text,
      mine: true,
    });
    setBody(message.text);
    setCaret(message.text.length);
    setOpenMsg(null);
    requestAnimationFrame(() => {
      const el = composerRef.current;
      el?.focus();
      el?.setSelection(message.text.length);
    });
  };

  // Reply is the other composer mode: they cannot both own the strip.
  useEffect(() => {
    if (!replyTo || !editing) return;
    setEditing(null);
    setBody(preEditDraftRef.current);
    setCaret(preEditDraftRef.current.length);
  }, [replyTo, editing]);

  // Starting a reply opens the keyboard, like every other chat surface.
  useEffect(() => {
    if (!replyTo) return;
    composerRef.current?.focus();
  }, [replyTo]);

  // A DM is its own conversation: switching peers must drop a pending quote,
  // an open search, and any knock/call sheet left over from the last one.
  useEffect(() => {
    setReplyTo(null);
    setSearchOpen(false);
    setSearchQ("");
    setDismissedStripKey(null);
    setCallPrompt(null);
    setPendingCallVideo(false);
    setCallKnockSent(false);
    setCallKnockError(null);
  }, [userId]);

  const jumpToMessage = (id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlighted(id);
    window.setTimeout(() => setHighlighted((h) => (h === id ? null : h)), 2400);
  };

  // Deep link from the inbox: wait for the row to render, then jump to it and
  // keep the lime ring for long enough to find it mid-conversation.
  const deepLinkRef = useRef<string | null>(null);
  useEffect(() => {
    const target = search.message;
    if (!target || deepLinkRef.current === target) return;
    const timer = window.setInterval(() => {
      if (!document.getElementById(`msg-${target}`)) return;
      window.clearInterval(timer);
      deepLinkRef.current = target;
      jumpToMessage(target);
    }, 150);
    const stop = window.setTimeout(() => window.clearInterval(timer), 5000);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(stop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.message]);

  const other = useQuery({
    queryKey: ["profile-id", userId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      return data;
    },
  });
  const blockStatus = useQuery({
    queryKey: ["block-status", user?.id, userId],
    queryFn: () => isBlocked(user!.id, userId),
    enabled: !!user,
  });

  const muteStatus = useQuery({
    queryKey: ["mute-status", user?.id, userId],
    enabled: !!user && user.id !== userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mutes")
        .select("muted_id")
        .eq("muter_id", user!.id)
        .eq("muted_id", userId)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  const msgs = useQuery({
    queryKey: ["dm", user?.id, userId],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("direct_messages")
        .select("*")
        .or(
          `and(sender_id.eq.${user.id},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${user.id})`,
        )
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(0, MESSAGE_PAGE_SIZE);
      if (error) throw error;
      const rows = data ?? [];
      setHasOlderMessages(rows.length > MESSAGE_PAGE_SIZE);
      const visibleRows = rows.slice(0, MESSAGE_PAGE_SIZE);
      const { data: hiddenRows, error: hiddenError } = await (supabase.from as any)(
        "direct_message_hides",
      )
        .select("message_id")
        .eq("user_id", user.id)
        .in(
          "message_id",
          visibleRows.map((row) => row.id),
        );
      if (hiddenError) {
        const message = String(hiddenError.message ?? "").toLowerCase();
        if (!message.includes("does not exist") && !message.includes("schema cache"))
          throw hiddenError;
        return visibleRows.reverse();
      }
      const hidden = new Set(
        (hiddenRows ?? []).map((row: { message_id: string }) => row.message_id),
      );
      return visibleRows.filter((row) => !hidden.has(row.id)).reverse();
    },
    enabled: !!user,
  });

  // `<@userId>` tokens in any visible message resolve to a username once, so a
  // body written by a bot or another client reads as a mention instead of raw
  // angle brackets.
  const mentionLabels = useMentionLabels((msgs.data ?? []).map((row) => row.body));

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`dm-${user.id}-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        ({ new: message }) => {
          const row = message as any;
          const participants = new Set([user.id, userId]);
          if (
            !participants.has(row.sender_id) ||
            !participants.has(row.recipient_id) ||
            row.sender_id === row.recipient_id
          )
            return;
          qc.setQueryData<any[]>(["dm", user.id, userId], (current) => {
            if (!current || current.some((item) => item.id === row.id)) return current;
            return [...current, row].sort((a, b) => a.created_at.localeCompare(b.created_at));
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "direct_messages" },
        ({ old: message }) => {
          const row = message as any;
          qc.setQueryData<any[]>(["dm", user.id, userId], (current) =>
            current?.filter((item) => item.id !== row.id),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "direct_messages" },
        ({ new: message }) => {
          const row = message as CachedDirectMessage;
          qc.setQueryData<CachedDirectMessage[]>(["dm", user.id, userId], (current) =>
            current?.map((item) => (item.id === row.id ? { ...item, ...row } : item)),
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, userId, qc]);

  const loadOlderMessages = async () => {
    if (!user || loadingOlderMessages || !hasOlderMessages) return;
    const oldest = msgs.data?.[0] as any;
    if (!oldest) return;
    setLoadingOlderMessages(true);
    try {
      const { data, error } = await supabase
        .from("direct_messages")
        .select("*")
        .or(
          `and(sender_id.eq.${user.id},recipient_id.eq.${userId},or(created_at.lt.${oldest.created_at},and(created_at.eq.${oldest.created_at},id.lt.${oldest.id}))),and(sender_id.eq.${userId},recipient_id.eq.${user.id},or(created_at.lt.${oldest.created_at},and(created_at.eq.${oldest.created_at},id.lt.${oldest.id})))`,
        )
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(MESSAGE_PAGE_SIZE + 1);
      if (error) throw error;
      const rows = data ?? [];
      setHasOlderMessages(rows.length > MESSAGE_PAGE_SIZE);
      const olderRows = rows.slice(0, MESSAGE_PAGE_SIZE);
      const { data: hiddenRows, error: hiddenError } = await (supabase.from as any)(
        "direct_message_hides",
      )
        .select("message_id")
        .eq("user_id", user.id)
        .in(
          "message_id",
          olderRows.map((row) => row.id),
        );
      if (hiddenError) {
        const message = String(hiddenError.message ?? "").toLowerCase();
        if (!message.includes("does not exist") && !message.includes("schema cache"))
          throw hiddenError;
      }
      const hiddenIds = new Set(
        (hiddenRows ?? []).map((row: { message_id: string }) => row.message_id),
      );
      const older = olderRows.filter((row) => !hiddenIds.has(row.id)).reverse();
      if (older.length) {
        const previousHeight = scrollRef.current?.scrollHeight ?? 0;
        qc.setQueryData<any[]>(["dm", user.id, userId], (current = []) => {
          const knownIds = new Set(current.map((item) => item.id));
          return [...older.filter((item) => !knownIds.has(item.id)), ...current];
        });
        requestAnimationFrame(() => {
          const list = scrollRef.current;
          if (list) list.scrollTop += list.scrollHeight - previousHeight;
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't load earlier messages");
    } finally {
      setLoadingOlderMessages(false);
    }
  };

  // Presence + typing channel (deterministic key: sorted pair)
  useEffect(() => {
    if (!user) return;
    const key = [user.id, userId].sort().join(":");
    const ch = supabase.channel(`dm-presence-${key}`, { config: { presence: { key: user.id } } });
    presenceCh.current = ch;
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState() as Record<string, Array<{ visible?: boolean }>>;
      const peer = state[userId] ?? [];
      setOnline(peer.length > 0);
      // A tab that is open but in the background is "around", not "online".
      setPeerVisible(peer.length === 0 || peer.some((meta) => meta.visible !== false));
    });
    ch.on("broadcast", { event: "typing" }, ({ payload }: any) => {
      if (payload?.user_id !== userId) return;
      setPeerTyping(true);
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
      typingTimer.current = window.setTimeout(() => setPeerTyping(false), 2500);
    });
    const track = () => {
      void ch.track({ at: Date.now(), visible: document.visibilityState === "visible" });
    };
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") track();
    });
    document.addEventListener("visibilitychange", track);
    return () => {
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
      document.removeEventListener("visibilitychange", track);
      supabase.removeChannel(ch);
      presenceCh.current = null;
    };
  }, [user, userId]);

  // One typing broadcast every three seconds, not one per keystroke: the peer's
  // indicator only needs a keep-alive, and each send is a websocket frame.
  const broadcastTyping = () => {
    const now = Date.now();
    if (now - lastTypingBroadcastAtRef.current < 3000) return;
    lastTypingBroadcastAtRef.current = now;
    presenceCh.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: user?.id },
    });
  };

  useEffect(() => {
    const currentIds = (msgs.data ?? []).map((message: any) => message.id);
    const previousIds = previousMessageIdsRef.current;
    const initialLoad = previousIds.length === 0 && currentIds.length > 0;
    const appended =
      previousIds.length > 0 && previousIds.every((id, index) => currentIds[index] === id);
    if (initialLoad || (appended && wasNearBottomRef.current)) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    previousMessageIdsRef.current = currentIds;
  }, [msgs.data]);

  // Show jump button when not at the bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const near = el.scrollTop + el.clientHeight >= el.scrollHeight - 200;
      wasNearBottomRef.current = near;
      setShowJump(!near);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Mark incoming messages as read when viewed
  useEffect(() => {
    if (!user || !msgs.data) return;
    const unread = msgs.data
      .filter((m: any) => m.recipient_id === user.id && !m.read)
      .map((m: any) => m.id);
    if (unread.length === 0) return;
    supabase
      .from("direct_messages")
      .update({ read: true })
      .in("id", unread)
      .then(() => {});
  }, [user, msgs.data]);

  const deliverPendingMessage = async (
    pendingId: string,
    text: string,
    clearComposerText?: string,
    pendingPreview?: string | null,
  ) => {
    if (!user) return;
    setSendingCount((count) => count + 1);
    qc.setQueryData<CachedDirectMessage[]>(["dm", user.id, userId], (current = []) =>
      current.map((message) =>
        message.id === pendingId ? { ...message, delivery_status: "sending" } : message,
      ),
    );
    let uploadedImagePath: string | null = null;
    try {
      let attachmentUrl: string | null = null;
      const pendingImage = pendingMediaRef.current.get(pendingId);
      if (pendingImage) {
        const compressed = await compressChatImage(pendingImage);
        const path = `${user.id}/${crypto.randomUUID()}.jpg`;
        uploadedImagePath = path;
        const { error: uploadError } = await supabase.storage
          .from("chat-media")
          .upload(path, compressed, { contentType: "image/jpeg", upsert: false });
        if (uploadError) {
          if (/bucket.*not found|not found.*bucket/i.test(uploadError.message)) {
            throw new Error(
              "Image sending is not enabled yet. Apply the chat-media setup in BACKEND_REQUIREMENTS.md.",
            );
          }
          throw uploadError;
        }
        attachmentUrl = supabase.storage.from("chat-media").getPublicUrl(path).data.publicUrl;
      }
      const { data, error } = await supabase
        .from("direct_messages")
        .insert({
          sender_id: user.id,
          recipient_id: userId,
          body: text,
          attachment_url: attachmentUrl,
          reply_to: pendingReplyRef.current.get(pendingId) ?? null,
        })
        .select("*")
        .single();
      if (error) throw error;
      qc.setQueryData<CachedDirectMessage[]>(["dm", user.id, userId], (current = []) => {
        const withoutPending = current.filter((message) => message.id !== pendingId);
        if (withoutPending.some((message) => message.id === data.id)) return withoutPending;
        return [...withoutPending, data].sort((a, b) => a.created_at.localeCompare(b.created_at));
      });
      setReplyTo(null);
      pendingMediaRef.current.delete(pendingId);
      pendingReplyRef.current.delete(pendingId);
      if (pendingImage && imageFile === pendingImage) {
        setImageFile(null);
        setImagePreview((current) => (current === pendingPreview ? null : current));
      }
      if (clearComposerText !== undefined) {
        setBody((current) => (current === clearComposerText ? "" : current));
      }
    } catch (error) {
      if (uploadedImagePath) {
        try {
          await supabase.storage.from("chat-media").remove([uploadedImagePath]);
        } catch {
          // Upload cleanup is best-effort; keep the failed message retryable.
        }
      }
      // The composer was cleared optimistically. If it is still empty, put the
      // text back so a failed send never eats what the person typed.
      if (clearComposerText) {
        setBody((current) => (current ? current : clearComposerText));
      }
      qc.setQueryData<CachedDirectMessage[]>(["dm", user.id, userId], (current = []) =>
        current.map((message) =>
          message.id === pendingId ? { ...message, delivery_status: "failed" } : message,
        ),
      );
      toast.error(
        error instanceof Error
          ? error.message
          : "Couldn't send your message. Check your connection and try again.",
      );
    } finally {
      setSendingCount((count) => Math.max(0, count - 1));
    }
  };

  const send = () => {
    if (!user) return;

    if (editing) {
      const nextText = body.trim();
      if (!nextText) {
        toast.error("Message can't be empty");
        return;
      }
      const nextBody = editing.prefix ? `${editing.prefix}${nextText}` : nextText;
      if (nextBody.length > MAX_MESSAGE_LENGTH) {
        toast.error(`Messages can be up to ${MAX_MESSAGE_LENGTH.toLocaleString()} characters`);
        return;
      }
      const editingNow = editing;
      qc.setQueryData<CachedDirectMessage[]>(["dm", user.id, userId], (current = []) =>
        current.map((message) =>
          message.id === editingNow.id ? { ...message, body: nextBody } : message,
        ),
      );
      setEditing(null);
      setBody("");
      setCaret(0);
      requestAnimationFrame(() => composerRef.current?.focus());
      void supabase
        .from("direct_messages")
        .update({ body: nextBody })
        .eq("id", editingNow.id)
        .eq("sender_id", user.id)
        .then(({ error }) => {
          if (!error) return;
          qc.setQueryData<CachedDirectMessage[]>(["dm", user.id, userId], (current = []) =>
            current.map((message) =>
              message.id === editingNow.id
                ? { ...message, body: editingNow.previousBody }
                : message,
            ),
          );
          setEditing(editingNow);
          setBody(nextText);
          setCaret(nextText.length);
          toast.error(error.message || "Couldn't update that message");
        });
      return;
    }

    if (!body.trim() && !imageFile) return;
    const composerText = body;
    const reply = replyTo;
    const pendingPreview = imagePreview;
    // The quote is a reply_to pointer, not text pasted into the body.
    const text = body.trim();
    if (text.length > MAX_MESSAGE_LENGTH) {
      toast.error(`Messages can be up to ${MAX_MESSAGE_LENGTH.toLocaleString()} characters`);
      return;
    }
    hapticSend();
    const pendingId = `pending-${crypto.randomUUID()}`;
    if (reply) pendingReplyRef.current.set(pendingId, reply.id);
    const optimistic: CachedDirectMessage = {
      id: pendingId,
      sender_id: user.id,
      recipient_id: userId,
      body: text,
      created_at: new Date().toISOString(),
      read: false,
      audio_url: null,
      duration_ms: null,
      reply_to: reply?.id ?? null,
      story_id: null,
      deleted_at: null,
      delivery_status: "sending",
      attachment_url: pendingPreview,
      // No rich card on an optimistic row; the server row replaces it.
      card: null,
    };
    if (imageFile) pendingMediaRef.current.set(pendingId, imageFile);
    qc.setQueryData<CachedDirectMessage[]>(["dm", user.id, userId], (current = []) => [
      ...current,
      optimistic,
    ]);

    // Clear the box immediately; the optimistic row is already on screen. The
    // network insert and image upload continue in the background, so a slow
    // connection never makes the composer feel stuck.
    setBody("");
    setCaret(0);
    setReplyTo(null);
    if (imageFile) {
      setImageFile(null);
      setImagePreview(null);
    }
    void deliverPendingMessage(pendingId, text, composerText, pendingPreview);
  };

  const beginVoiceNote = async () => {
    if (!user || recording) return;
    try {
      stopRec.current = await startRecording();
      recStart.current = Date.now();
      setRecMs(0);
      setRecording(true);
      if (navigator.vibrate) navigator.vibrate(10);
    } catch {
      toast.error("Microphone access denied");
    }
  };

  const finishVoiceNote = async (cancel: boolean) => {
    const stop = stopRec.current;
    stopRec.current = null;
    setRecording(false);
    if (!stop || cancel) {
      setRecMs(0);
      return;
    }
    setSendingVoice(true);
    try {
      const clip = await stop();
      if (clip.durationMs < 600) {
        toast.info("Too short — hold a bit longer");
        return;
      }
      const path = await uploadVoiceNote(user!.id, clip);
      const { error } = await supabase.from("direct_messages").insert({
        sender_id: user!.id,
        recipient_id: userId,
        body: "🎤 Voice note",
        audio_url: path,
        duration_ms: clip.durationMs,
      });
      if (error) throw new Error(error.message);
      qc.invalidateQueries({ queryKey: ["dm", user!.id, userId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't send that voice note");
    } finally {
      setSendingVoice(false);
      setRecMs(0);
    }
  };

  const chooseImage = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file.");
      return;
    }
    const uploadLimit = chatUploadLimitBytes(profile);
    if (file.size > uploadLimit) {
      toast.error(
        `Images must be smaller than ${formatUploadLimit(uploadLimit)} before compression.`,
      );
      return;
    }
    const preview = URL.createObjectURL(file);
    imageObjectUrlsRef.current.add(preview);
    setImageFile(file);
    setImagePreview(preview);
  };

  const scheduleSend = () => {
    if (!body.trim()) return toast.info("Type a message first");
    const text = body;
    setBody("");
    toast.success("Scheduled in 10s");
    setTimeout(() => {
      if (!user) return;
      supabase
        .from("direct_messages")
        .insert({ sender_id: user.id, recipient_id: userId, body: text })
        .then(({ error }) => {
          if (error) toast.error(`Scheduled message failed: ${error.message}`);
        });
    }, 10000);
  };

  const markUnread = async () => {
    if (!user || !msgs.data) return;
    try {
      const latest = [...msgs.data].reverse().find((m: any) => m.recipient_id === user.id);
      if (!latest) return toast.info("Nothing to mark");
      await supabase
        .from("direct_messages")
        .update({ read: false })
        .eq("id", (latest as any).id);
      qc.invalidateQueries({ queryKey: ["unread-notifs"] });
      toast.success("Marked unread");
    } catch (e: any) {
      toast.error(e.message || "Couldn't mark unread");
    }
  };

  const exportMessages = async () => {
    if (!msgs.data || !msgs.data.length) {
      toast.info("No messages to export");
      return;
    }
    try {
      const lines = (msgs.data as any[]).map((m) => {
        const time = new Date(m.created_at).toLocaleString();
        const sender = m.sender_id === user?.id ? "You" : other.data?.username || "Them";
        return `[${time}] ${sender}: ${m.body || "(media)"}`;
      });
      const text = lines.join("\n");
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dm-${other.data?.username || userId}-${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${msgs.data.length} messages`);
    } catch (e: any) {
      toast.error(e.message || "Export failed");
    }
  };

  const handleBlock = async () => {
    if (!user) return;
    const currentlyBlocked = !!blockStatus.data;
    try {
      if (currentlyBlocked) {
        await unblockUser(user.id, userId);
        toast.success("User unblocked");
      } else {
        await blockUser(user.id, userId);
        toast.success("User blocked");
      }
      qc.setQueryData(["block-status", user.id, userId], !currentlyBlocked);
      void qc.invalidateQueries({ queryKey: ["blocked-users", user.id] });
    } catch (e: any) {
      toast.error(e.message || "Action failed");
      // Keep the dialog open so the same button is an honest retry.
      throw e;
    }
  };

  const handleMute = async (minutes: number | null) => {
    if (!user || muteBusy) return;
    lastMuteMinutesRef.current = minutes;
    setMuteBusy(true);
    setMuteError(null);
    try {
      await muteUser(user.id, userId);
      const until = minutes ? Date.now() + minutes * 60_000 : null;
      setMutedUntil(until);
      try {
        if (muteUntilKey) {
          if (until) window.localStorage.setItem(muteUntilKey, String(until));
          else window.localStorage.removeItem(muteUntilKey);
        }
      } catch {
        // Storage is best-effort; the mute row still exists.
      }
      qc.setQueryData(["mute-status", user.id, userId], true);
      toast.success(
        minutes
          ? `Muted for ${MUTE_PRESETS.find((m) => m.minutes === minutes)?.label ?? "a while"}`
          : "Conversation muted",
      );
      setMuteOpen(false);
    } catch (e: any) {
      const message = e?.message || "Couldn't mute this conversation";
      setMuteError(message);
      toast.error(message);
    } finally {
      setMuteBusy(false);
    }
  };

  const handleUnmute = async () => {
    if (!user || muteBusy) return;
    setMuteBusy(true);
    setMuteError(null);
    try {
      await unmuteUser(user.id, userId);
      setMutedUntil(null);
      try {
        if (muteUntilKey) window.localStorage.removeItem(muteUntilKey);
      } catch {
        // Ignore storage failures; the server row is gone.
      }
      qc.setQueryData(["mute-status", user.id, userId], false);
      toast.success("Conversation unmuted");
      setMuteOpen(false);
    } catch (e: any) {
      const message = e?.message || "Couldn't unmute this conversation";
      setMuteError(message);
      toast.error(message);
    } finally {
      setMuteBusy(false);
    }
  };

  const shareProfile = async () => {
    const url = `${location.origin}/u/${other.data?.username || userId}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${other.data?.display_name || other.data?.username}'s profile`,
          url,
        });
        return;
      } catch {
        // fallback to copy
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Profile link copied");
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  // Reactions for every loaded message: one request, one realtime channel.
  const reactions = useChatReactions(
    "dm",
    (msgs.data ?? []).map((message: { id: string }) => message.id),
    {
      // Reactions someone else adds to my messages get a small pop, not a burst.
      myMessageIds: (msgs.data ?? [])
        .filter((message: { sender_id: string }) => message.sender_id === user?.id)
        .map((message: { id: string }) => message.id),
    },
  );
  const removedPreviews = useHiddenLinkPreviews(
    "dm",
    (msgs.data ?? []).map((message: { id: string }) => message.id),
  );
  const peerPresence = usePresence(other.data?.id);
  const peerCustom = publicCustomStatus(peerPresence, false);
  const media = useMediaViewer();

  // Knock Knock: is their app actually open, and what has already been knocked
  // between the two of us. Knocks ride in the timeline so one that arrived while
  // the tab was closed is still waiting here.
  const knockMood = useKnockMood(other.data?.id);
  const knocks = useKnockThread(userId);
  const peerName = other.data?.display_name || other.data?.username || "They";

  const isSelfChat = userId === user?.id;
  const isDeleted = other.isFetched && !other.data;
  const peerBlocked = !!blockStatus.data;
  const headerName = isSelfChat ? "Notes to self (You)" : isDeleted ? "Deleted user" : peerName;

  // One state for the dot AND the subline. The DM presence channel and the
  // heartbeat are both live-presence signals; the saved status only decides
  // which live state it is. No live signal means offline, whatever the saved
  // status says, and invisibility always reads as offline.
  const savedStatus = publicStatusOf(peerPresence);
  const invisible = peerPresence?.status === "invisible";
  const livePresence = !invisible && (online || knockMood.verdict !== "offline");
  const doorState: "online" | "around" | "dnd" | "offline" =
    isSelfChat || isDeleted || peerBlocked || !livePresence
      ? "offline"
      : savedStatus === "dnd" || knockMood.verdict === "dnd"
        ? "dnd"
        : savedStatus === "idle" || knockMood.verdict === "away" || (online && !peerVisible)
          ? "around"
          : "online";
  const canShowLastSeen =
    !isSelfChat && !isDeleted && !peerBlocked && !invisible && !!peerPresence?.last_seen_at;
  const lastSeenLabel = canShowLastSeen
    ? `Last seen ${relativeLastSeen(peerPresence!.last_seen_at)}`
    : null;
  const lastSeenFull = canShowLastSeen
    ? new Date(peerPresence!.last_seen_at!).toLocaleString()
    : null;
  const showKnocks = !searchQ;

  const knockTimeline = useMemo(() => {
    const byMessage = new Map<string, Knock[]>();
    const data = msgs.data ?? [];
    if (!showKnocks || !knocks.length || !data.length) {
      return { byMessage, trailing: showKnocks ? knocks : [] };
    }
    let cursor = 0;
    for (const message of data) {
      const at = new Date(message.created_at).getTime();
      const bucket: Knock[] = [];
      while (cursor < knocks.length && new Date(knocks[cursor].created_at).getTime() <= at) {
        bucket.push(knocks[cursor]);
        cursor += 1;
      }
      if (bucket.length) byMessage.set(String(message.id), bucket);
    }
    // Anything left is newer than the newest message — a knock that just landed.
    return { byMessage, trailing: knocks.slice(cursor) };
  }, [knocks, msgs.data, showKnocks]);

  // Reading the thread is seeing the door: their knock stops showing as unseen.
  useEffect(() => {
    if (!userId || !knocks.some((knock) => knock.to_user === user?.id && !knock.seen)) return;
    void markKnocksSeen(userId);
  }, [userId, knocks, user?.id]);

  // Search keeps the whole thread on screen and marks the matches: filtering
  // to only hits loses the context that makes a search useful, and left the
  // bar with no count or way to step through what it found.
  const searchMatches = useMemo(() => {
    const term = searchQ.trim().toLowerCase();
    if (!term) return [] as string[];
    return (msgs.data ?? [])
      .filter((m: any) => (m.body || "").toLowerCase().includes(term))
      .map((m: any) => String(m.id));
  }, [msgs.data, searchQ]);
  const activeSearchIndex = searchMatches.length
    ? Math.min(searchIndex, searchMatches.length - 1)
    : 0;

  useEffect(() => {
    setSearchIndex(0);
  }, [searchQ]);

  const jumpToMatch = (direction: 1 | -1) => {
    if (!searchMatches.length) return;
    const next = (activeSearchIndex + direction + searchMatches.length) % searchMatches.length;
    setSearchIndex(next);
    jumpToMessage(searchMatches[next]);
  };

  const filteredMsgs = msgs.data ?? [];

  // The pictures already in this conversation, newest first. The attach sheet
  // opens on them, so sending a photo you have both already seen is one tap.
  const recentPhotos = useMemo(() => {
    const seen = new Set<string>();
    const out: { id: string; url: string }[] = [];
    for (let i = filteredMsgs.length - 1; i >= 0 && out.length < 12; i -= 1) {
      const message = filteredMsgs[i] as { id?: string; attachment_url?: string | null };
      const url = message.attachment_url;
      if (!url || seen.has(url) || String(message.id ?? "").startsWith("pending-")) continue;
      seen.add(url);
      out.push({ id: String(message.id ?? url), url });
    }
    return out;
  }, [filteredMsgs]);

  /** Re-attach a photo from the library: it becomes the same pending image the
   *  picker would have handed to the composer. */
  const pickRecentPhoto = async (url: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("missing");
      const blob = await response.blob();
      if (!blob.type.startsWith("image/")) throw new Error("not an image");
      const extension = (blob.type.split("/")[1] ?? "jpg").split("+")[0];
      chooseImage(new File([blob], `photo.${extension}`, { type: blob.type }));
    } catch {
      toast.error("Couldn't open that photo.");
    }
  };

  /** A quoted original may be outside the loaded window; load it, then jump. */
  const jumpToReply = async (messageId: string) => {
    if (!(msgs.data ?? []).some((m: any) => m.id === messageId)) {
      try {
        const { data, error } = await supabase
          .from("direct_messages")
          .select("*")
          .eq("id", messageId)
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          setMissingReplies((current) => new Set(current).add(messageId));
          return;
        }
        if (!user) return;
        qc.setQueryData<CachedDirectMessage[]>(["dm", user.id, userId], (current = []) =>
          [...current, data as CachedDirectMessage].sort((a, b) =>
            String(a.created_at).localeCompare(String(b.created_at)),
          ),
        );
      } catch {
        setMissingReplies((current) => new Set(current).add(messageId));
        return;
      }
    }
    window.setTimeout(() => jumpToMessage(messageId), 60);
  };

  const startCall = (video: boolean) => {
    if (!user) return;
    // Ring the callee via their personal broadcast channel so they get a
    // system-style incoming-call sheet even if they're not viewing the DM.
    try {
      const ring = supabase.channel(`call:incoming:${userId}`, {
        config: { broadcast: { self: false, ack: false } },
      });
      ring.subscribe((st) => {
        if (st !== "SUBSCRIBED") return;
        ring
          .send({
            type: "broadcast",
            event: "ring",
            payload: {
              fromId: user.id,
              fromUsername: (user as any)?.user_metadata?.username,
              fromDisplayName: (user as any)?.user_metadata?.display_name,
              fromAvatar: (user as any)?.user_metadata?.avatar_url,
              video,
            },
          })
          .finally(() => {
            // let the message flush before closing
            setTimeout(() => supabase.removeChannel(ring), 800);
          });
      });
    } catch {
      /* non-fatal */
    }
    nav({ to: "/call/$userId", params: { userId }, search: { video } });
  };

  const placeCall = (video: boolean) => {
    if (peerBlocked) return;
    if (doorState === "offline") {
      setPendingCallVideo(video);
      setCallPrompt("offline");
      return;
    }
    startCall(video);
  };

  const requestCall = (video: boolean) => {
    if (peerBlocked) return;
    if (narrowHeader) {
      setCallPrompt("choose");
      return;
    }
    placeCall(video);
  };

  const knockFromCallPrompt = async () => {
    if (!user || callKnockSending || callKnockSent) return;
    setCallKnockSending(true);
    setCallKnockError(null);
    try {
      await sendKnock(userId, null);
      setCallKnockSent(true);
      void qc.invalidateQueries({ queryKey: ["knocks"] });
      void qc.invalidateQueries({ queryKey: ["knock-doorbell"] });
    } catch (reason) {
      setCallKnockError(reason instanceof Error ? reason.message : "Couldn't knock right now");
    } finally {
      setCallKnockSending(false);
    }
  };

  const beginAvatarPress = (event: ReactPointerEvent<HTMLAnchorElement>) => {
    const photo = other.data?.avatar_url;
    if (!photo) return;
    avatarLongPressed.current = false;
    avatarPressStart.current = { x: event.clientX, y: event.clientY };
    avatarPressTimer.current = window.setTimeout(() => {
      avatarLongPressed.current = true;
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate(20);
        } catch {
          /* vibration is a nicety, not a requirement */
        }
      }
      media.openMedia(photo);
    }, 450);
  };

  const moveAvatarPress = (event: ReactPointerEvent<HTMLAnchorElement>) => {
    if (!avatarPressStart.current || avatarPressTimer.current === null) return;
    const moved = Math.hypot(
      event.clientX - avatarPressStart.current.x,
      event.clientY - avatarPressStart.current.y,
    );
    if (moved <= 10) return;
    window.clearTimeout(avatarPressTimer.current);
    avatarPressTimer.current = null;
  };

  const endAvatarPress = () => {
    if (avatarPressTimer.current !== null) window.clearTimeout(avatarPressTimer.current);
    avatarPressTimer.current = null;
    avatarPressStart.current = null;
  };

  const deleteMsg = async (id: string) => {
    if (!user) return;
    try {
      const message = msgs.data?.find((row: any) => row.id === id);
      const imagePath = ownChatImagePath(message?.attachment_url ?? null, user.id);
      const { error } = await (supabase.rpc as any)("unsend_direct_message", { _message_id: id });
      if (error) {
        const message = String(error.message ?? "").toLowerCase();
        if (
          message.includes("does not exist") ||
          message.includes("schema cache") ||
          message.includes("function")
        ) {
          throw new Error("Unsend needs the Lovable backend setup in BACKEND_REQUIREMENTS.md.");
        }
        throw error;
      }
      qc.setQueryData<CachedDirectMessage[]>(["dm", user.id, userId], (current = []) =>
        current.map((message) =>
          message.id === id
            ? {
                ...message,
                body: "This message was unsent",
                attachment_url: null,
                audio_url: null,
                deleted_at: new Date().toISOString(),
              }
            : message,
        ),
      );
      if (imagePath) {
        try {
          const { error: cleanupError } = await supabase.storage
            .from("chat-media")
            .remove([imagePath]);
          if (cleanupError) console.warn("Unsent image cleanup failed", cleanupError.message);
        } catch {
          console.warn("Unsent image cleanup failed");
        }
      }
      toast.success("Message unsent for everyone");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't delete that message");
    }
  };

  const deleteMsgForMe = async (id: string) => {
    if (!user) return;
    try {
      const { error } = await (supabase.rpc as any)("hide_direct_message_for_me", {
        _message_id: id,
      });
      if (error) {
        const message = String(error.message ?? "").toLowerCase();
        if (
          message.includes("does not exist") ||
          message.includes("schema cache") ||
          message.includes("function")
        ) {
          throw new Error(
            "Delete for me needs the Lovable backend setup in BACKEND_REQUIREMENTS.md.",
          );
        }
        throw error;
      }
      qc.setQueryData<CachedDirectMessage[]>(["dm", user.id, userId], (current = []) =>
        current.filter((message) => message.id !== id),
      );
      toast.success("Message deleted for you");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't delete that message");
    }
  };

  // Every reaction write goes through toggle_dm_reaction (see the reactions
  // migration) with an optimistic chip and a friendly failure toast.
  const react = async (messageId: string, emoji: string) => {
    await reactions.toggle(messageId, emoji);
  };

  const doubleTapHeart = async (messageId: string, at?: { x: number; y: number }) => {
    // A big heart pops at the tap position.
    burstOverMessage(messageId, DOUBLE_TAP_REACTION, at);
    reactionHaptic();
    await reactions.toggle(messageId, DOUBLE_TAP_REACTION);
  };

  // Live "Call in progress · Join" state for this conversation.
  const peerInCall = usePeerInCall(userId);

  const stripState =
    !isSelfChat && !isDeleted && !peerBlocked && doorState !== "online" ? doorState : null;
  const showStrip = stripState !== null && dismissedStripKey !== stripState;

  // Dismissal lasts until the door state itself changes, not until the next
  // heartbeat bumps last_seen.
  useEffect(() => {
    setDismissedStripKey(null);
  }, [stripState]);

  return (
    // Two-pane on desktop: the conversation list sits beside the open chat, the
    // phone layout keeps the single column and uses /dms for the list.
    <div className="flex h-full min-h-0 w-full overflow-hidden">
      <DmThreadRail activeId={userId} />
      {/* The column is exactly as tall as the app shell's space above the
          keyboard. Pinning it to a JS-measured visualViewport height (the
          earlier workaround) fought Android's own scroll-into-view and left a
          black void under the composer, so the shell's `h-dvh` plus the
          `interactive-widget=resizes-content` viewport do the job instead. */}
      <div
        className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden"
        style={wallpaperStyle(wallpaper)}
      >
        {/* The dimmer exists for the phone's bottom sheet. On a desktop the menu
          is a popover beside the message, exactly like Discord's — dimming the
          whole conversation for it made the hover toolbar feel like a modal. */}
        {openMsg && isMobile && (
          <div
            aria-hidden="true"
            onClick={() => setOpenMsg(null)}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[5px]"
          />
        )}
        <header className="chat-header chat-header--dm">
          <div className="chat-header__row">
            <Link
              to="/dms"
              aria-label="Back to messages"
              title="Back to messages"
              className="chat-header__action"
            >
              <ArrowLeft aria-hidden="true" />
            </Link>

            <div className="chat-header__identity">
              <Link
                to="/u/$username"
                params={{ username: other.data?.username ?? "" }}
                aria-label={`View ${headerName}'s profile`}
                title={other.data?.avatar_url ? "Hold to view photo" : undefined}
                onPointerDown={beginAvatarPress}
                onPointerMove={moveAvatarPress}
                onPointerUp={endAvatarPress}
                onPointerCancel={endAvatarPress}
                onPointerLeave={endAvatarPress}
                onClick={(event) => {
                  if (!avatarLongPressed.current) return;
                  event.preventDefault();
                  event.stopPropagation();
                  avatarLongPressed.current = false;
                }}
                onContextMenu={(event) => event.preventDefault()}
                className="dm-header__avatar shrink-0 touch-manipulation rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="relative inline-flex h-[34px] w-[34px] shrink-0">
                  <Avatar className="h-[34px] w-[34px] border-0 shadow-none ring-0">
                    <AvatarImage src={other.data?.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-[#2c2d35] text-[#f2efe6] font-semibold text-xs">
                      {(other.data?.username ?? "?").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {doorState !== "offline" && (
                    <span
                      aria-hidden="true"
                      className={`dm-presence-dot dm-presence-dot--${doorState}`}
                    />
                  )}
                </span>
              </Link>

              <div className="chat-header__text min-w-0 flex-1">
                <Link
                  to="/u/$username"
                  params={{ username: other.data?.username ?? "" }}
                  className="block min-w-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <p className="dm-header__name truncate font-semibold">{headerName}</p>
                </Link>
                {!peerBlocked && !isDeleted && (
                  <div
                    className="dm-header__status chat-header__status"
                    aria-live={peerTyping ? "polite" : undefined}
                  >
                    {peerTyping ? (
                      <span className="chat-header__typing">
                        typing
                        <span className="chat-header__typing-dots" aria-hidden="true">
                          <span>.</span>
                          <span>.</span>
                          <span>.</span>
                        </span>
                      </span>
                    ) : peerCustom ? (
                      <CustomStatusLine
                        status={peerCustom}
                        className="chat-header__custom min-w-0"
                      />
                    ) : isSelfChat ? (
                      <span className="truncate text-muted-foreground">Only you can see this</span>
                    ) : doorState === "online" ? (
                      <span className="truncate font-medium text-primary">Online</span>
                    ) : doorState === "around" ? (
                      <span className="truncate text-muted-foreground">Active recently</span>
                    ) : doorState === "dnd" ? (
                      <span className="truncate text-muted-foreground">Do not disturb</span>
                    ) : lastSeenLabel ? (
                      <span
                        className="truncate text-muted-foreground"
                        title={lastSeenFull ?? undefined}
                        aria-label={
                          lastSeenFull ? `${lastSeenLabel}. ${lastSeenFull}` : lastSeenLabel
                        }
                      >
                        {lastSeenLabel}
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
            </div>

            <div className="chat-header__actions" role="group" aria-label="Conversation actions">
              {!isDeleted && !isSelfChat && (
                <>
                  <button
                    type="button"
                    onClick={() => requestCall(false)}
                    aria-label="Voice call"
                    title={
                      peerBlocked
                        ? "Calls are unavailable while this person is blocked"
                        : "Voice call"
                    }
                    disabled={peerBlocked}
                    className="chat-header__action"
                  >
                    <Phone aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => requestCall(true)}
                    aria-label="Video call"
                    title={
                      peerBlocked
                        ? "Calls are unavailable while this person is blocked"
                        : "Video call"
                    }
                    disabled={peerBlocked}
                    className="chat-header__action"
                  >
                    <Video aria-hidden="true" />
                  </button>
                </>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="More options"
                    title="More"
                    className="chat-header__action"
                  >
                    <MoreVertical aria-hidden="true" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={8}
                  className="glass-strong min-w-[14rem] rounded-2xl border-white/10 p-2"
                >
                  <DropdownMenuItem
                    onSelect={() => setSearchOpen(true)}
                    className="gap-3 rounded-xl px-4 py-3"
                  >
                    <Search className="h-5 w-5" aria-hidden="true" />
                    <span>Search in chat</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="my-1" />
                  {peerInCall && (
                    <>
                      <DropdownMenuItem
                        onSelect={() =>
                          nav({ to: "/call/$userId", params: { userId }, search: { video: false } })
                        }
                        className="gap-3 rounded-xl px-4 py-3"
                      >
                        <Phone className="h-5 w-5 text-emerald-300" aria-hidden="true" />
                        <span>Join call in progress</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="my-1" />
                    </>
                  )}
                  <DropdownMenuItem asChild>
                    <Link
                      to="/u/$username"
                      params={{ username: other.data?.username ?? "" }}
                      className="gap-3 rounded-xl px-4 py-3"
                    >
                      <Users className="h-5 w-5" aria-hidden="true" />
                      <span>View profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={shareProfile} className="gap-3 rounded-xl px-4 py-3">
                    <Copy className="h-5 w-5" aria-hidden="true" />
                    <span>Share profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="my-1" />
                  <DropdownMenuItem onSelect={markUnread} className="gap-3 rounded-xl px-4 py-3">
                    <Bell className="h-5 w-5" aria-hidden="true" />
                    <span>Mark as unread</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={exportMessages}
                    className="gap-3 rounded-xl px-4 py-3"
                  >
                    <Download className="h-5 w-5" aria-hidden="true" />
                    <span>Export loaded messages</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => setWallpaperOpen(true)}
                    className="gap-3 rounded-xl px-4 py-3"
                  >
                    <ImagePlus className="h-5 w-5" aria-hidden="true" />
                    <span>Chat wallpaper</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => setMuteOpen(true)}
                    className="gap-3 rounded-xl px-4 py-3"
                  >
                    <BellOff className="h-5 w-5" aria-hidden="true" />
                    <span>Mute conversation</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="my-1" />
                  <DropdownMenuItem
                    onSelect={() => setConfirmBlockOpen(true)}
                    className="gap-3 rounded-xl px-4 py-3 text-destructive focus:text-destructive"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                    <span>{blockStatus.data ? "Unblock user" : "Block user"}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {showStrip && stripState && (
              <motion.div
                key="dm-knock-strip"
                initial={reduceMotion ? false : { y: -44, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={reduceMotion ? undefined : { y: -44, opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.16, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-x-0 top-full z-10"
              >
                <DmKnockStrip
                  peerId={userId}
                  name={other.data?.display_name || other.data?.username || "them"}
                  mood={knockMood}
                  state={stripState}
                  lastSeenLabel={lastSeenLabel}
                  lastSeenFull={lastSeenFull}
                  knocks={knocks}
                  onDismiss={() => setDismissedStripKey(stripState)}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {searchOpen && (
              <motion.div
                key="dm-search"
                initial={reduceMotion ? false : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                transition={{
                  duration: reduceMotion ? 0 : 0.18,
                  ease: [0.22, 1, 0.36, 1],
                }}
                role="search"
                aria-label="Search this conversation"
                className="chat-header__search absolute inset-x-0 top-full z-30"
              >
                <div className="flex items-center gap-2 px-3 py-2">
                  <Search
                    className="h-[18px] w-[18px] shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    ref={searchInputRef}
                    autoFocus
                    value={searchQ}
                    onChange={(event) => setSearchQ(event.target.value)}
                    placeholder="Search loaded messages…"
                    aria-label="Search messages"
                    autoComplete="off"
                    className="glass h-10 border-white/10"
                  />
                  <CloseButton
                    onClick={() => {
                      setSearchOpen(false);
                      setSearchQ("");
                    }}
                    aria-label="Close search and clear"
                    className="shrink-0"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        <ResponsiveOverlay
          open={callPrompt === "offline"}
          onOpenChange={(open) => {
            if (!open) setCallPrompt(null);
          }}
          title={`${headerName} is offline.`}
        >
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              A call will ring an app that isn't open. A knock waits in their chat and reaches them
              the moment they come back.
            </p>
            {callKnockError && (
              <p role="alert" className="text-[13px] text-destructive">
                {callKnockError}
              </p>
            )}
            <div className="grid gap-2">
              <Button
                type="button"
                onClick={() => void knockFromCallPrompt()}
                disabled={callKnockSending || callKnockSent}
                className="h-11 gap-2 rounded-xl font-semibold"
              >
                {callKnockSent ? (
                  <>
                    <Check className="h-4 w-4" aria-hidden="true" />
                    Knocked
                  </>
                ) : callKnockSending ? (
                  "Knocking…"
                ) : (
                  "Knock"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCallPrompt(null);
                  startCall(pendingCallVideo);
                }}
                className="h-11 rounded-xl"
              >
                Call anyway
              </Button>
            </div>
          </div>
        </ResponsiveOverlay>

        <ResponsiveOverlay
          open={callPrompt === "choose"}
          onOpenChange={(open) => {
            if (!open) setCallPrompt(null);
          }}
          title="Call"
        >
          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => {
                setCallPrompt(null);
                placeCall(false);
              }}
              className="flex h-14 items-center gap-3 rounded-xl border border-border/70 px-4 text-left transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Phone className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm font-semibold">Voice call</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCallPrompt(null);
                placeCall(true);
              }}
              className="flex h-14 items-center gap-3 rounded-xl border border-border/70 px-4 text-left transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Video className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm font-semibold">Video call</span>
            </button>
          </div>
        </ResponsiveOverlay>

        <div
          ref={scrollRef}
          onClick={media.onMediaClick}
          className="chat-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain py-4 pb-3"
        >
          {media.viewer}
          {/* The conversation column is capped and centred so the messages line
            up with the composer. Rows carry their own side padding (the same
            variable realm chat uses) so all three surfaces align identically. */}
          <div className="mx-auto w-full max-w-3xl">
            {hasOlderMessages && (
              <div className="flex justify-center px-4 pb-2">
                <Button
                  onClick={loadOlderMessages}
                  disabled={loadingOlderMessages}
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                >
                  {loadingOlderMessages ? "Loading earlier messages…" : "Load earlier messages"}
                </Button>
              </div>
            )}
            <AnimatePresence initial={false}>
              {filteredMsgs.map((m, index) => {
                const mine = m.sender_id === user?.id;
                // Knocks that happened right before this message, so the doorbell
                // reads as part of the conversation instead of a floating toast.
                const knockCards = knockTimeline.byMessage.get(String(m.id));
                const deliveryStatus = (m as CachedDirectMessage).delivery_status;
                const audioPath = (m as any).audio_url as string | null;
                const replyId = (m as any).reply_to as string | null;
                const replySource = replyId
                  ? (msgs.data ?? []).find((row: any) => row.id === replyId)
                  : null;
                const replyDeleted = Boolean(
                  replyId &&
                  (missingReplies.has(replyId) ||
                    (replySource as { deleted_at?: string | null } | null)?.deleted_at),
                );
                const quote = (m.body || "").startsWith("↪ ")
                  ? (m.body as string).split("\n")[0].slice(2)
                  : null;
                const rest = quote ? (m.body as string).split("\n").slice(1).join("\n") : m.body;
                // Prefer the authoritative column. The old fallback searched the
                // whole body with `includes`, so a common phrase could jump to the
                // wrong message; matching the quoted prefix is at least directional.
                const quotedMessageId = quote
                  ? ((m as CachedDirectMessage).reply_to ??
                    (msgs.data ?? []).find(
                      (candidate) =>
                        String(candidate.id) !== String(m.id) &&
                        (candidate.body || "").startsWith(quote),
                    )?.id ??
                    null)
                  : null;
                // A shared post/reel travels as its permalink: the raw URL is swapped
                // for a real card (SharedPostCards) right under the message.
                const restText = withoutShareLinks(rest);
                // A poll message carries its question in the body as a fallback for
                // older clients; the card is the real message, so the text is not
                // repeated above it.
                const pollCard = asChatPollCard((m as { card?: unknown }).card);
                // Old image-only messages stored the literal words “📷 Image” as
                // their body. A photo should stand on its own, not repeat itself in
                // a caption, so that placeholder is not text.
                const messageText = pollCard || isMediaPlaceholderText(restText) ? "" : restText;
                const hasText = !!messageText.trim();
                const mediaOnly = isOnlyMediaMarker(messageText);
                const previous = filteredMsgs[index - 1];
                // A new calendar day always opens a group (and a divider) — the
                // five-minute burst rule must not swallow midnight.
                const newDay = !previous || dayKey(previous.created_at) !== dayKey(m.created_at);
                const startsGroup =
                  newDay ||
                  previous.sender_id !== m.sender_id ||
                  new Date(m.created_at).getTime() - new Date(previous.created_at).getTime() >
                    5 * 60 * 1000;
                const inviteUrl = rest?.match(/(?:https?:\/\/[^\s]+)?\/join\/[a-z0-9_-]+/i)?.[0];
                const inviteCode = inviteUrl ? extractInviteCode(inviteUrl) : "";
                const inviteText = inviteUrl ? rest?.replace(inviteUrl, "").trim() : "";
                if (audioPath) {
                  const audioActions = [
                    {
                      label: "Reply",
                      icon: CornerUpLeft,
                      onSelect: () => setReplyTo({ id: m.id, body: "Voice note", mine }),
                    },
                    ...(mine
                      ? [
                          {
                            label: "Delete for everyone",
                            icon: Trash2,
                            destructive: true,
                            onSelect: () => {
                              void deleteMsg(m.id);
                            },
                          },
                        ]
                      : []),
                  ];
                  return (
                    <div key={m.id} className="chat-message-slot space-y-1">
                      {newDay && <DateSeparator date={m.created_at} />}
                      {knockCards?.map((knock) => (
                        <KnockThreadCard
                          key={knock.id}
                          knock={knock}
                          mine={knock.from_user === user?.id}
                          peerName={peerName}
                        />
                      ))}
                      {startsGroup && !deliveryStatus && (
                        <div className="flex w-full justify-center py-0.5">
                          <span className="rounded-full bg-black/20 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {new Date(m.created_at).toLocaleTimeString([], {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      )}
                      <motion.div
                        id={`msg-${m.id}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`group flex min-w-0 flex-col ${mine ? "items-end" : "items-start"}`}
                      >
                        <MessageActionMenu
                          open={openMsg === m.id}
                          onOpenChange={(open) => setOpenMsg(open ? m.id : null)}
                          align={mine ? "right" : "left"}
                          triggerRole="group"
                          actions={audioActions}
                        >
                          <VoiceNoteBubble
                            path={audioPath}
                            durationMs={(m as any).duration_ms ?? null}
                            mine={mine}
                          />
                        </MessageActionMenu>
                        <ReactionChips
                          scope="dm"
                          messageId={m.id}
                          groups={reactions.groupsFor(m.id)}
                          reactorsFor={reactions.reactorsFor}
                          align={mine ? "right" : "left"}
                          hidden={
                            String(m.id).startsWith("pending-") ||
                            !!(m as CachedDirectMessage).deleted_at
                          }
                          pulse={reactions.lastPulse}
                          onToggle={(emoji) => reactions.toggle(m.id, emoji)}
                        />
                      </motion.div>
                    </div>
                  );
                }
                const deletedAt = (m as CachedDirectMessage).deleted_at;
                return (
                  <div key={m.id} className="chat-message-slot space-y-1">
                    {newDay && <DateSeparator date={m.created_at} />}
                    {knockCards?.map((knock) => (
                      <KnockThreadCard
                        key={knock.id}
                        knock={knock}
                        mine={knock.from_user === user?.id}
                        peerName={peerName}
                      />
                    ))}
                    <MessageRow
                      id={String(m.id)}
                      author={{
                        id: m.sender_id,
                        name: mine
                          ? profile?.display_name || profile?.username || "You"
                          : other.data?.display_name || other.data?.username || "User",
                        avatarUrl: mine ? profile?.avatar_url : other.data?.avatar_url,
                      }}
                      time={new Date(m.created_at).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      startsGroup={startsGroup}
                      lifted={openMsg === m.id}
                      highlighted={highlighted === m.id}
                      // Long-press anywhere in the row (avatar, name, photo, empty
                      // space) opens this message's actions — the realm gesture.
                      onLongPress={() => openMessageMenu(m.id)}
                      onSwipeReply={
                        deletedAt || deliveryStatus
                          ? undefined
                          : () => {
                              setReplyTo({
                                id: m.id,
                                body: rest || m.body,
                                mine,
                                attachmentUrl: m.attachment_url ?? null,
                              });
                              // Stay inside the pointer-up gesture so iOS raises the
                              // keyboard; the composer's effect is only a fallback.
                              composerRef.current?.focus();
                            }
                      }
                      // On a desktop the same two actions live on a hover toolbar,
                      // Discord-style, so a mouse never has to hold a message down.
                      onQuickReact={() => openMessageMenu(m.id, "reactions")}
                      onMoreActions={() => openMessageMenu(m.id)}
                      onAuthorClick={
                        (mine ? profile?.username : other.data?.username)
                          ? () =>
                              void nav({
                                to: "/u/$username",
                                params: {
                                  username: (mine
                                    ? profile?.username
                                    : other.data?.username) as string,
                                },
                              })
                          : undefined
                      }
                    >
                      {inviteCode && !deletedAt ? (
                        <GroupInviteMessageCard code={inviteCode} message={inviteText ?? ""} />
                      ) : (
                        <MessageActionMenu
                          open={openMsg === m.id}
                          onOpenChange={(o) => (o ? openMessageMenu(m.id) : setOpenMsg(null))}
                          initialView={openMsgView}
                          align={mine ? "right" : "left"}
                          // The row owns long-press; the menu keeps double-tap, keyboard
                          // and right-click. Two racing timers double-vibrated.
                          detectPress={false}
                          reactionBar={{
                            onPick: (emoji) => {
                              void react(m.id, emoji);
                              setOpenMsg(null);
                            },
                          }}
                          onDoubleTap={() => void doubleTapHeart(m.id)}
                          preview={{
                            author: mine
                              ? "You"
                              : other.data?.display_name || other.data?.username || "User",
                            time: new Date(m.created_at).toLocaleTimeString([], {
                              hour: "numeric",
                              minute: "2-digit",
                            }),
                            body: m.body,
                            avatarUrl: mine ? profile?.avatar_url : other.data?.avatar_url,
                          }}
                          actions={[
                            {
                              label: "Copy text",
                              icon: Copy,
                              onSelect: () => {
                                navigator.clipboard.writeText(m.body);
                                toast.success("Copied");
                              },
                            },
                            {
                              label: "Reply",
                              icon: CornerUpLeft,
                              onSelect: () => {
                                setReplyTo({ id: m.id, body: rest || m.body, mine });
                              },
                            },
                            ...(mine && !deletedAt && !deliveryStatus && (rest ?? "").trim()
                              ? [
                                  {
                                    label: "Edit message",
                                    icon: Pencil,
                                    onSelect: () => {
                                      beginEdit({
                                        id: m.id,
                                        body: m.body,
                                        prefix: quote ? `↪ ${quote}\n` : "",
                                        text: rest ?? "",
                                      });
                                    },
                                  },
                                ]
                              : []),
                            {
                              label: "Forward",
                              icon: Forward,
                              onSelect: () => {
                                setForwardDraft(
                                  shareDraftForMessage({
                                    body: rest || m.body,
                                    attachmentUrl: m.attachment_url,
                                    author: mine ? profile?.username : other.data?.username,
                                  }),
                                );
                              },
                            },
                            {
                              label: "Report",
                              icon: Flag,
                              onSelect: () => {
                                toast("Reported");
                              },
                            },
                            ...(!deletedAt
                              ? [
                                  {
                                    label: "Delete for me",
                                    icon: Trash2,
                                    destructive: true,
                                    onSelect: () => {
                                      void deleteMsgForMe(m.id);
                                    },
                                  },
                                ]
                              : []),
                            ...(mine && !deletedAt
                              ? [
                                  {
                                    label: "Delete for everyone",
                                    icon: Trash2,
                                    destructive: true,
                                    onSelect: () => {
                                      void deleteMsg(m.id);
                                    },
                                  },
                                ]
                              : []),
                          ]}
                        >
                          <div
                            className={`realm-message__body select-none touch-manipulation ${
                              deliveryStatus ? "opacity-60" : ""
                            }`}
                            style={{ WebkitTouchCallout: "none", touchAction: "pan-y" }}
                          >
                            {replyId ? (
                              <ReplyQuote
                                author={
                                  replySource
                                    ? replySource.sender_id === user?.id
                                      ? "You"
                                      : peerName
                                    : null
                                }
                                body={replySource?.body ?? null}
                                attachmentUrl={replySource?.attachment_url ?? null}
                                audioUrl={(replySource as any)?.audio_url ?? null}
                                deleted={replyDeleted}
                                onJump={
                                  missingReplies.has(replyId)
                                    ? undefined
                                    : () => void jumpToReply(replyId)
                                }
                              />
                            ) : null}
                            {!replyId && quote && (
                              <span
                                role="button"
                                tabIndex={quotedMessageId ? 0 : -1}
                                data-swipe-ignore="true"
                                aria-label={
                                  quotedMessageId ? "Jump to the replied message" : undefined
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (quotedMessageId) jumpToMessage(String(quotedMessageId));
                                }}
                                onKeyDown={(e) => {
                                  if (!quotedMessageId || (e.key !== "Enter" && e.key !== " "))
                                    return;
                                  e.preventDefault();
                                  e.stopPropagation();
                                  jumpToMessage(String(quotedMessageId));
                                }}
                                className="mb-1 flex w-fit max-w-full items-center gap-1 self-start border-l-2 border-white/25 pl-2 text-[11px] text-muted-foreground line-clamp-2"
                              >
                                <CornerUpLeft className="h-3 w-3 shrink-0" /> {quote}
                              </span>
                            )}
                            {m.attachment_url && !deletedAt && (
                              <ChatMessageMedia
                                src={m.attachment_url}
                                alt="Image shared in chat"
                                className={hasText ? "mb-1" : ""}
                              />
                            )}
                            {deletedAt ? (
                              <span className="text-[13px] italic text-muted-foreground">
                                This message was unsent
                              </span>
                            ) : !hasText ? null : (
                              <div
                                className={
                                  m.attachment_url || mediaOnly ? "chat-media-caption" : ""
                                }
                              >
                                {renderGifSegments(messageText).map((seg, si) =>
                                  seg.isGif || seg.isSticker ? (
                                    <GifContent key={si}>{seg.marker ?? ""}</GifContent>
                                  ) : (
                                    <MarkdownText
                                      key={si}
                                      text={seg.value}
                                      renderPlainText={(plain) =>
                                        renderCaptionWithTags(plain).map((p, pi) =>
                                          p.mentionToken ? (
                                            <span
                                              key={`${si}-${pi}`}
                                              className="mention-highlight font-medium"
                                            >
                                              {mentionLabels(p.mentionToken)}
                                            </span>
                                          ) : p.mention ? (
                                            <Link
                                              key={`${si}-${pi}`}
                                              to="/u/$username"
                                              params={{ username: p.mention }}
                                              onClick={(e) => e.stopPropagation()}
                                              className={`mention-highlight font-medium ${mine ? "underline decoration-white/60" : "hover:underline"}`}
                                            >
                                              {p.text}
                                            </Link>
                                          ) : p.tag ? (
                                            <Link
                                              key={`${si}-${pi}`}
                                              to="/tag/$tag"
                                              params={{ tag: p.tag }}
                                              onClick={(e) => e.stopPropagation()}
                                              className="font-medium text-primary hover:underline"
                                            >
                                              {p.text}
                                            </Link>
                                          ) : p.url ? (
                                            <a
                                              key={`${si}-${pi}`}
                                              href={p.url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              onClick={(e) => e.stopPropagation()}
                                              className="break-words text-primary hover:underline"
                                            >
                                              {p.text}
                                            </a>
                                          ) : (
                                            <EmojiText key={`${si}-${pi}`} text={p.text} />
                                          ),
                                        )
                                      }
                                    />
                                  ),
                                )}
                              </div>
                            )}
                            {pollCard && !deletedAt && (
                              <ChatPollCard card={pollCard} canVote={!blockStatus.data} />
                            )}
                          </div>
                        </MessageActionMenu>
                      )}
                      {deliveryStatus === "failed" ? (
                        <button
                          onClick={() =>
                            void deliverPendingMessage(m.id, m.body, undefined, m.attachment_url)
                          }
                          disabled={sendingMessage}
                          className="text-[10px] text-amber-200/80 hover:text-amber-100"
                        >
                          Retry
                        </button>
                      ) : deliveryStatus === "sending" ? (
                        <span className="text-[10px] text-muted-foreground">Sending…</span>
                      ) : null}
                      <ReactionChips
                        scope="dm"
                        messageId={m.id}
                        groups={reactions.groupsFor(m.id)}
                        reactorsFor={reactions.reactorsFor}
                        align="left"
                        hidden={!!deletedAt || String(m.id).startsWith("pending-")}
                        pulse={reactions.lastPulse}
                        onToggle={(emoji) => reactions.toggle(m.id, emoji)}
                      />
                      <SharedPostCards text={deletedAt ? null : m.body} />
                      <MessageLinkPreviews
                        // Internal permalinks are cards now; previews stay for the
                        // outside web, so the same URL never renders twice.
                        text={deletedAt ? null : messageText}
                        messageId={m.id}
                        scope="dm"
                        canHide={mine}
                        removed={removedPreviews.hidden.has(m.id)}
                      />
                    </MessageRow>
                  </div>
                );
              })}
            </AnimatePresence>
            {knockTimeline.trailing.map((knock) => (
              <KnockThreadCard
                key={knock.id}
                knock={knock}
                mine={knock.from_user === user?.id}
                peerName={peerName}
              />
            ))}
            <div ref={endRef} />
            {peerTyping && (
              // Typing is a quiet line, not a bubble: it sits in the message flow at
              // the same left edge as the rows above it.
              <div className="flex items-center gap-2 px-4 py-1.5 text-[11px] text-muted-foreground">
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:120ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:240ms]" />
                </span>
                {other.data?.display_name || other.data?.username || "They"} is typing…
              </div>
            )}
          </div>
        </div>

        {showJump && (
          <button
            onClick={() => endRef.current?.scrollIntoView({ behavior: "smooth" })}
            className="absolute bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] right-4 z-30 grid h-11 w-11 place-items-center rounded-full chat-bar border border-white/10 shadow-sm active:scale-95"
            aria-label="Scroll to latest"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        )}

        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            chooseImage(event.target.files?.[0] ?? null);
            event.currentTarget.value = "";
          }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(event) => {
            chooseImage(event.target.files?.[0] ?? null);
            event.currentTarget.value = "";
          }}
        />
        {/* The same picker reached through the device's file browser: on a
            phone the photo library and the Files app are different places. */}
        <input
          ref={filesInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            chooseImage(event.target.files?.[0] ?? null);
            event.currentTarget.value = "";
          }}
        />

        <MessageComposer
          value={body}
          onChange={(next, nextCaret) => {
            setBody(next);
            setCaret(nextCaret);
            broadcastTyping();
          }}
          onSend={send}
          onEmoji={() => setGifOpen(true)}
          onStickers={() => setCatOpen(true)}
          placeholder={other.data?.username ? `Message ${other.data.username}` : "Message"}
          maxLength={MAX_MESSAGE_LENGTH}
          inputRef={composerRef}
          resolveEmoji={(parts) => emojiUrlById.get(parts.id) ?? null}
          disabled={Boolean(blockStatus.data)}
          disabledHint="You can't message this person"
          sending={sendingVoice}
          canSend={Boolean(body.trim() || imageFile)}
          recording={recording}
          recordMs={recMs}
          onRecordStart={() => void beginVoiceNote()}
          onRecordEnd={() => void finishVoiceNote(false)}
          onRecordCancel={() => void finishVoiceNote(true)}
          onKeyUp={() => setCaret(composerRef.current?.getCaret() ?? 0)}
          onTextareaClick={() => {
            setCaret(composerRef.current?.getCaret() ?? 0);
            scrollChatToLatest(scrollRef.current);
          }}
          onFocus={() => scrollChatToLatest(scrollRef.current)}
          attach={
            <ChatAttachButton
              appearance="circle"
              label="Attach"
              disabled={Boolean(blockStatus.data)}
              actions={[
                {
                  id: "photo",
                  label: "Photos",
                  hint: "Your library",
                  icon: ImagePlus,
                  onSelect: () => imageInputRef.current?.click(),
                },
                {
                  id: "camera",
                  label: "Camera",
                  hint: "Take a shot",
                  icon: Camera,
                  onSelect: () => cameraInputRef.current?.click(),
                },
                {
                  id: "files",
                  label: "Files",
                  hint: "Browse device",
                  icon: Folder,
                  onSelect: () => filesInputRef.current?.click(),
                },
                {
                  id: "schedule",
                  label: "Schedule",
                  hint: "Send in 10 seconds",
                  icon: Clock,
                  onSelect: scheduleSend,
                  disabled: !body.trim(),
                },
              ]}
              photos={recentPhotos}
              onPickPhoto={(url) => void pickRecentPhoto(url)}
            />
          }
          above={
            imagePreview ? (
              <div className="mb-2 flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-2">
                <img
                  src={imagePreview}
                  alt="Image ready to send"
                  className="h-14 w-14 rounded-lg object-cover"
                />
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  Image compressed before upload
                </span>
                <Button
                  type="button"
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview(null);
                  }}
                  variant="ghost"
                  size="icon"
                  aria-label="Remove image"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : null
          }
          reply={
            editing
              ? {
                  mode: "edit",
                  label: "Editing message",
                  preview: editing.text || "Message",
                  onCancel: cancelEdit,
                  onJump: () => jumpToMessage(editing.id),
                }
              : replyTo
                ? {
                    label: `Replying to ${replyTo.mine ? "yourself" : `@${other.data?.username ?? "them"}`}`,
                    preview: replyPreviewText({
                      body: replyTo.body,
                      attachmentUrl: replyTo.attachmentUrl,
                    }),
                    onCancel: () => setReplyTo(null),
                    onJump: () => void jumpToReply(replyTo.id),
                  }
                : null
          }
          mentions={
            <MentionAutocomplete
              value={body}
              caret={caret}
              memberIds={userId ? ([user?.id, userId].filter(Boolean) as string[]) : undefined}
              emptyHint="Only the two of you are in this chat."
              onPick={(username) => {
                const next = replaceMention(body, caret, username);
                setBody(next.value);
                setCaret(next.caret);
                const el = composerRef.current;
                if (el)
                  requestAnimationFrame(() => {
                    el.focus();
                    el.setSelection(next.caret);
                  });
              }}
            />
          }
        />

        <GifPicker
          open={gifOpen}
          onOpenChange={setGifOpen}
          hideTrigger
          onSelect={(marker) =>
            setBody((current) =>
              `${current}${current ? " " : ""}${marker}`.slice(0, MAX_MESSAGE_LENGTH),
            )
          }
        />
        <CatStickerSheet
          open={catOpen}
          onOpenChange={setCatOpen}
          onPick={(shortcode) =>
            setBody((current) => `${current}${shortcode}`.slice(0, MAX_MESSAGE_LENGTH))
          }
        />

        <ShareToChatSheet
          open={!!forwardDraft}
          onOpenChange={(next) => {
            if (!next) setForwardDraft(null);
          }}
          draft={forwardDraft}
        />

        <WallpaperSheet
          open={wallpaperOpen}
          onOpenChange={setWallpaperOpen}
          kind="dm"
          chatId={userId}
          userId={user?.id}
          value={wallpaper}
          onChange={setWallpaper}
        />

        <ResponsiveOverlay
          open={muteOpen}
          onOpenChange={(next) => {
            if (!muteBusy) setMuteOpen(next);
          }}
          title="Mute conversation"
        >
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You won&apos;t receive notifications from this conversation.
            </p>
            {muteError && (
              <p role="alert" className="text-sm text-destructive">
                {muteError}
              </p>
            )}
            {muteStatus.data || mutedUntil ? (
              <Button onClick={handleUnmute} disabled={muteBusy} className="h-11 w-full rounded-xl">
                {muteBusy ? "Unmuting…" : "Unmute"}
              </Button>
            ) : (
              <div className="grid gap-2">
                {MUTE_PRESETS.map((preset) => (
                  <Button
                    key={preset.minutes}
                    onClick={() => void handleMute(preset.minutes)}
                    disabled={muteBusy}
                    className="h-11 rounded-xl"
                  >
                    {muteBusy && lastMuteMinutesRef.current === preset.minutes
                      ? "Muting…"
                      : `Mute for ${preset.label}`}
                  </Button>
                ))}
                <Button
                  onClick={() => void handleMute(null)}
                  disabled={muteBusy}
                  variant="outline"
                  className="h-11 rounded-xl"
                >
                  {muteBusy && lastMuteMinutesRef.current === null
                    ? "Muting…"
                    : "Mute until I turn it back on"}
                </Button>
              </div>
            )}
          </div>
        </ResponsiveOverlay>

        <ConfirmDialog
          open={confirmBlockOpen}
          onOpenChange={setConfirmBlockOpen}
          title={blockStatus.data ? "Unblock user?" : `Block ${headerName}?`}
          description={
            blockStatus.data
              ? "They'll be able to message and call you again."
              : "They won't be able to message or call you. You can unblock anytime in Settings."
          }
          confirmLabel={blockStatus.data ? "Unblock" : "Block"}
          tone={blockStatus.data ? "default" : "danger"}
          onConfirm={async () => {
            await handleBlock();
            setConfirmBlockOpen(false);
          }}
        />
      </div>
    </div>
  );
}

/**
 * Watches this conversation's call channel for the other participant, so the
 * header can offer "Call in progress · Join".
 *
 * The call screen keeps presence on `call:<sortedUserIds>`, so this needs no new
 * database state. The watcher joins with its own presence key and never calls
 * track(), so it can never be mistaken for a participant in the call.
 */
function usePeerInCall(peerId: string | undefined) {
  const { user } = useAuth();
  const selfId = user?.id;
  const [peerInCall, setPeerInCall] = useState(false);

  useEffect(() => {
    if (!selfId || !peerId || selfId === peerId) {
      setPeerInCall(false);
      return;
    }
    const roomId = [selfId, peerId].sort().join("_");
    const topic = callTopic(roomId);
    // The other participant's presence key is their user id; our own key is
    // suffixed so it never counts as a peer.
    const readPresence = (channel: RealtimeChannel) => {
      const state = channel.presenceState() as Record<string, unknown>;
      return Object.keys(state).some((key) => key !== selfId && !key.startsWith(selfId));
    };

    // The call screen and the incoming-call ringer use this same topic. Reading
    // the live channel beats subscribing again: supabase-js would hand back that
    // instance and throw on a second subscribe(), which used to take the whole
    // page down. Presence handlers can be added to a joined channel, so this
    // still works — and cleanup must NOT remove a channel we do not own.
    const existing = findJoinedChannel(supabase, topic);
    if (existing) {
      const sync = () => setPeerInCall(readPresence(existing));
      sync();
      existing.on("presence", { event: "sync" }, sync);
      existing.on("presence", { event: "join" }, sync);
      existing.on("presence", { event: "leave" }, sync);
      return;
    }

    const channel = supabase.channel(topic, {
      config: { broadcast: { self: false, ack: false }, presence: { key: `${selfId}:watcher` } },
    });

    channel
      .on("presence", { event: "sync" }, () => setPeerInCall(readPresence(channel)))
      .on("presence", { event: "join" }, () => setPeerInCall(readPresence(channel)))
      .on("presence", { event: "leave" }, () => setPeerInCall(readPresence(channel)));
    subscribeSafely(channel, (status) => {
      if (status === "SUBSCRIBED") setPeerInCall(readPresence(channel));
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [selfId, peerId]);

  return peerInCall;
}
