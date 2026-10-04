import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Fragment, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, Phone, Video, MoreVertical, Smile, ArrowDown, Search, Mic, Clock, X, Trash2, ImagePlus, Users, Plus, Copy, Flag } from "lucide-react";
import { CornerUpLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MessageReactions } from "@/components/DMReactionsBar";
import { callExtraRpc, reactionErrorMessage } from "@/lib/extra-rpc";
import { VoiceNoteBubble } from "@/components/chat/VoiceNoteBubble";
import { MessageActionMenu } from "@/components/chat/MessageActionMenu";
import { startRecording, uploadVoiceNote, formatDuration } from "@/lib/voice-notes";
import { blockUser, isBlocked, muteUser, unblockUser } from "@/lib/social";
import { compressChatImage } from "@/lib/chat-media";
import { extractInviteCode } from "@/lib/groups";
import { GroupInviteMessageCard } from "@/components/chat/GroupInviteMessageCard";

const QUICK_EMOJIS = ["❤️", "🔥", "😂", "😮", "😢", "👏"];
const MORE_REACTIONS = ["😍", "🙌", "💯", "🥹", "🎉", "🤔"];
const CHAT_WALLPAPERS = [
  "radial-gradient(ellipse at top right, rgba(255,62,165,.14), transparent 55%)",
  "radial-gradient(ellipse at bottom left, rgba(124,58,237,.18), transparent 60%)",
  "none",
];
const MESSAGE_PAGE_SIZE = 30;
const MAX_MESSAGE_LENGTH = 10_000;
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
  head: () => ({ meta: [{ title: "DM · RIZZ" }] }),
  component: DMPage,
});

function DMPage() {
  const { userId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [body, setBody] = useState("");
  const [visualViewportHeight, setVisualViewportHeight] = useState<number | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const sendingMessageRef = useRef(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const wasNearBottomRef = useRef(true);
  const previousMessageIdsRef = useRef<string[]>([]);
  const [openMsg, setOpenMsg] = useState<string | null>(null);
  const [moreReactionsOpen, setMoreReactionsOpen] = useState(false);
  const pressTimer = useRef<number | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; body: string; mine: boolean } | null>(null);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [online, setOnline] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const presenceCh = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimer = useRef<number | null>(null);
  const lastTypingBroadcastAtRef = useRef(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [recording, setRecording] = useState(false);
  const recStart = useRef(0);
  const stopRec = useRef<null | (() => Promise<{ blob: Blob; durationMs: number }>)>(null);
  const [recMs, setRecMs] = useState(0);
  const [sendingVoice, setSendingVoice] = useState(false);
  const [wallpaperIndex, setWallpaperIndex] = useState(0);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pendingMediaRef = useRef(new Map<string, File>());
  const pendingReplyRef = useRef(new Map<string, string>());
  const imageObjectUrlsRef = useRef(new Set<string>());
  const draftKey = user?.id ? `rizz:dm-draft:${user.id}:${userId}` : null;

  useEffect(() => {
    setMoreReactionsOpen(false);
  }, [openMsg]);

  useEffect(() => {
    const viewport = window.visualViewport;
    const syncHeight = () => setVisualViewportHeight(viewport?.height ?? window.innerHeight);
    syncHeight();
    viewport?.addEventListener("resize", syncHeight);
    window.addEventListener("resize", syncHeight);
    return () => {
      viewport?.removeEventListener("resize", syncHeight);
      window.removeEventListener("resize", syncHeight);
    };
  }, []);

  useEffect(() => () => {
    imageObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    setDraftReady(false);
    let saved = "";
    try {
      saved = draftKey ? window.localStorage.getItem(draftKey) ?? "" : "";
    } catch {
      // Keep the composer usable when browser storage is disabled.
    }
    setBody(saved);
    setDraftReady(true);
  }, [draftKey]);

  useEffect(() => {
    try {
      const stored = Number(window.localStorage.getItem(`rizz:dm-wallpaper:${userId}`));
      if (Number.isInteger(stored) && stored >= 0 && stored < CHAT_WALLPAPERS.length) setWallpaperIndex(stored);
      else setWallpaperIndex(0);
    } catch {
      setWallpaperIndex(0);
    }
  }, [userId]);

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

  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;
    composer.style.height = "auto";
    composer.style.height = `${Math.min(composer.scrollHeight, 160)}px`;
  }, [body]);

  // Live elapsed timer while recording
  useEffect(() => {
    if (!recording) return;
    const t = window.setInterval(() => setRecMs(Date.now() - recStart.current), 200);
    return () => window.clearInterval(t);
  }, [recording]);

  const startPress = (id: string, point?: { x: number; y: number }) => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressStart.current = point ?? null;
    pressTimer.current = window.setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(15);
      setOpenMsg(id);
      pressTimer.current = null;
    }, 480);
  };
  /** Only cancel on a real drag (scroll), not on tiny finger jitter. */
  const movePress = (point: { x: number; y: number }) => {
    const s = pressStart.current;
    if (!s || !pressTimer.current) return;
    if (Math.hypot(point.x - s.x, point.y - s.y) > 12) cancelPress();
  };
  const cancelPress = () => {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    pressStart.current = null;
  };

  const jumpToMessage = (id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlighted(id);
    window.setTimeout(() => setHighlighted((h) => (h === id ? null : h)), 1600);
  };

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

  const msgs = useQuery({
    queryKey: ["dm", user?.id, userId],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("direct_messages")
        .select("*")
        .or(`and(sender_id.eq.${user.id},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${user.id})`)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(0, MESSAGE_PAGE_SIZE);
      if (error) throw error;
      const rows = data ?? [];
      setHasOlderMessages(rows.length > MESSAGE_PAGE_SIZE);
      const visibleRows = rows.slice(0, MESSAGE_PAGE_SIZE);
      const { data: hiddenRows, error: hiddenError } = await (supabase.from as any)("direct_message_hides")
        .select("message_id")
        .eq("user_id", user.id)
        .in("message_id", visibleRows.map((row) => row.id));
      if (hiddenError) {
        const message = String(hiddenError.message ?? "").toLowerCase();
        if (!message.includes("does not exist") && !message.includes("schema cache")) throw hiddenError;
        return visibleRows.reverse();
      }
      const hidden = new Set((hiddenRows ?? []).map((row: { message_id: string }) => row.message_id));
      return visibleRows.filter((row) => !hidden.has(row.id)).reverse();
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`dm-${user.id}-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, ({ new: message }) => {
        const row = message as any;
        const participants = new Set([user.id, userId]);
        if (!participants.has(row.sender_id) || !participants.has(row.recipient_id) || row.sender_id === row.recipient_id) return;
        qc.setQueryData<any[]>(["dm", user.id, userId], (current) => {
          if (!current || current.some((item) => item.id === row.id)) return current;
          return [...current, row].sort((a, b) => a.created_at.localeCompare(b.created_at));
        });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "direct_messages" }, ({ old: message }) => {
        const row = message as any;
        qc.setQueryData<any[]>(["dm", user.id, userId], (current) =>
          current?.filter((item) => item.id !== row.id),
        );
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "direct_messages" }, ({ new: message }) => {
        const row = message as CachedDirectMessage;
        qc.setQueryData<CachedDirectMessage[]>(["dm", user.id, userId], (current) =>
          current?.map((item) => item.id === row.id ? { ...item, ...row } : item),
        );
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
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
      const { data: hiddenRows, error: hiddenError } = await (supabase.from as any)("direct_message_hides")
        .select("message_id")
        .eq("user_id", user.id)
        .in("message_id", olderRows.map((row) => row.id));
      if (hiddenError) {
        const message = String(hiddenError.message ?? "").toLowerCase();
        if (!message.includes("does not exist") && !message.includes("schema cache")) throw hiddenError;
      }
      const hiddenIds = new Set((hiddenRows ?? []).map((row: { message_id: string }) => row.message_id));
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
    const now = Date.now();
    if (now - lastTypingBroadcastAtRef.current < 1000) return;
    lastTypingBroadcastAtRef.current = now;
    presenceCh.current?.send({ type: "broadcast", event: "typing", payload: { user_id: user?.id } });
  };

  useEffect(() => {
    const currentIds = (msgs.data ?? []).map((message: any) => message.id);
    const previousIds = previousMessageIdsRef.current;
    const initialLoad = previousIds.length === 0 && currentIds.length > 0;
    const appended = previousIds.length > 0 &&
      previousIds.every((id, index) => currentIds[index] === id);
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
    const unread = msgs.data.filter((m: any) => m.recipient_id === user.id && !m.read).map((m: any) => m.id);
    if (unread.length === 0) return;
    supabase.from("direct_messages").update({ read: true }).in("id", unread).then(() => {});
  }, [user, msgs.data]);

  const deliverPendingMessage = async (
    pendingId: string,
    text: string,
    clearComposerText?: string,
    pendingPreview?: string | null,
  ) => {
    if (!user || sendingMessageRef.current) return;
    sendingMessageRef.current = true;
    setSendingMessage(true);
    qc.setQueryData<CachedDirectMessage[]>(["dm", user.id, userId], (current = []) =>
      current.map((message) => message.id === pendingId ? { ...message, delivery_status: "sending" } : message),
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
            throw new Error("Image sending is not enabled yet. Apply the chat-media setup in BACKEND_REQUIREMENTS.md.");
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
        setImagePreview((current) => current === pendingPreview ? null : current);
      }
      if (clearComposerText !== undefined) {
        setBody((current) => current === clearComposerText ? "" : current);
      }
    } catch (error) {
      if (uploadedImagePath) {
        try {
          await supabase.storage.from("chat-media").remove([uploadedImagePath]);
        } catch {
          // Upload cleanup is best-effort; keep the failed message retryable.
        }
      }
      qc.setQueryData<CachedDirectMessage[]>(["dm", user.id, userId], (current = []) =>
        current.map((message) => message.id === pendingId ? { ...message, delivery_status: "failed" } : message),
      );
      toast.error(error instanceof Error ? error.message : "Couldn't send your message. Check your connection and try again.");
    } finally {
      sendingMessageRef.current = false;
      setSendingMessage(false);
    }
  };

  const send = () => {
    if (!user || (!body.trim() && !imageFile) || sendingMessageRef.current) return;
    const composerText = body;
    const quoted = replyTo ? `↪ ${replyTo.body.slice(0, 120)}\n` : "";
    const text = (quoted + body.trim()).trim() || "📷 Image";
    if (text.length > MAX_MESSAGE_LENGTH) {
      toast.error(`Messages can be up to ${MAX_MESSAGE_LENGTH.toLocaleString()} characters`);
      return;
    }
    const pendingId = `pending-${crypto.randomUUID()}`;
    if (replyTo) pendingReplyRef.current.set(pendingId, replyTo.id);
    const optimistic: CachedDirectMessage = {
      id: pendingId,
      sender_id: user.id,
      recipient_id: userId,
      body: text,
      created_at: new Date().toISOString(),
      read: false,
      audio_url: null,
      duration_ms: null,
      reply_to: replyTo?.id ?? null,
      story_id: null,
      delivery_status: "sending",
      attachment_url: imagePreview,
    };
    if (imageFile) pendingMediaRef.current.set(pendingId, imageFile);
    qc.setQueryData<CachedDirectMessage[]>(["dm", user.id, userId], (current = []) => [...current, optimistic]);
    void deliverPendingMessage(pendingId, text, composerText);
  };

  const toggleRecord = async () => {
    if (!user) return;
    if (recording) {
      const stop = stopRec.current;
      stopRec.current = null;
      setRecording(false);
      if (!stop) return;
      setSendingVoice(true);
      try {
        const clip = await stop();
        if (clip.durationMs < 600) { toast.info("Too short — hold a bit longer"); return; }
        const path = await uploadVoiceNote(user.id, clip);
        const { error } = await supabase.from("direct_messages").insert({
          sender_id: user.id,
          recipient_id: userId,
          body: "🎤 Voice note",
          audio_url: path,
          duration_ms: clip.durationMs,
        });
        if (error) throw new Error(error.message);
        qc.invalidateQueries({ queryKey: ["dm", user.id, userId] });
      } catch (e: any) {
        toast.error(e?.message ?? "Couldn't send that voice note");
      } finally {
        setSendingVoice(false);
      }
    } else {
      try {
        stopRec.current = await startRecording();
        recStart.current = Date.now();
        setRecMs(0);
        setRecording(true);
        if (navigator.vibrate) navigator.vibrate(10);
      } catch {
        toast.error("Microphone access denied");
      }
    }
  };

  const chooseImage = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Images must be smaller than 15 MB before compression.");
      return;
    }
    const preview = URL.createObjectURL(file);
    imageObjectUrlsRef.current.add(preview);
    setImageFile(file);
    setImagePreview(preview);
  };

  const scheduleSend = () => {
    if (!body.trim()) return toast.info("Type a message first");
    const text = body; setBody("");
    toast.success("Scheduled in 10s");
    setTimeout(() => {
      if (!user) return;
      supabase.from("direct_messages").insert({ sender_id: user.id, recipient_id: userId, body: text }).then(({ error }) => {
        if (error) toast.error(`Scheduled message failed: ${error.message}`);
      });
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
    if (!user) return;
    // Ring the callee via their personal broadcast channel so they get a
    // system-style incoming-call sheet even if they're not viewing the DM.
    try {
      const ring = supabase.channel(`call:incoming:${userId}`, {
        config: { broadcast: { self: false, ack: false } },
      });
      ring.subscribe((st) => {
        if (st !== "SUBSCRIBED") return;
        ring.send({
          type: "broadcast",
          event: "ring",
          payload: {
            fromId: user.id,
            fromUsername: (user as any)?.user_metadata?.username,
            fromDisplayName: (user as any)?.user_metadata?.display_name,
            fromAvatar: (user as any)?.user_metadata?.avatar_url,
            video,
          },
        }).finally(() => {
          // let the message flush before closing
          setTimeout(() => supabase.removeChannel(ring), 800);
        });
      });
    } catch { /* non-fatal */ }
    nav({ to: "/call/$userId", params: { userId }, search: { video } });
  };

  const deleteMsg = async (id: string) => {
    if (!user) return;
    try {
      const message = msgs.data?.find((row: any) => row.id === id);
      const imagePath = ownChatImagePath(message?.attachment_url ?? null, user.id);
      const { error } = await (supabase.rpc as any)("unsend_direct_message", { _message_id: id });
      if (error) {
        const message = String(error.message ?? "").toLowerCase();
        if (message.includes("does not exist") || message.includes("schema cache") || message.includes("function")) {
          throw new Error("Unsend needs the Lovable backend setup in BACKEND_REQUIREMENTS.md.");
        }
        throw error;
      }
      qc.setQueryData<CachedDirectMessage[]>(["dm", user.id, userId], (current = []) =>
        current.map((message) => message.id === id
          ? { ...message, body: "This message was unsent", attachment_url: null, audio_url: null, deleted_at: new Date().toISOString() }
          : message),
      );
      if (imagePath) {
        try {
          const { error: cleanupError } = await supabase.storage.from("chat-media").remove([imagePath]);
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
      const { error } = await (supabase.rpc as any)("hide_direct_message_for_me", { _message_id: id });
      if (error) {
        const message = String(error.message ?? "").toLowerCase();
        if (message.includes("does not exist") || message.includes("schema cache") || message.includes("function")) {
          throw new Error("Delete for me needs the Lovable backend setup in BACKEND_REQUIREMENTS.md.");
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

  const changeWallpaper = () => {
    const next = (wallpaperIndex + 1) % CHAT_WALLPAPERS.length;
    setWallpaperIndex(next);
    try { window.localStorage.setItem(`rizz:dm-wallpaper:${userId}`, String(next)); } catch { /* optional */ }
    toast.success("Chat wallpaper changed");
  };

  const react = async (messageId: string, emoji: string) => {
    if (!user) return;
    const queryKey = ["message-reactions", "dm", messageId] as const;
    await qc.cancelQueries({ queryKey });
    const previous = qc.getQueryData<{ emoji: string; user_id: string }[]>(queryKey);
    if (previous?.some((reaction) => reaction.emoji === emoji && reaction.user_id === user.id)) return;
    qc.setQueryData(queryKey, [...(previous ?? []), { emoji, user_id: user.id }]);
    try {
      await callExtraRpc("toggle_dm_reaction", { _message_id: messageId, _emoji: emoji });
      void qc.invalidateQueries({ queryKey });
    } catch (error) {
      if (previous) qc.setQueryData(queryKey, previous);
      else qc.removeQueries({ queryKey, exact: true });
      toast.error(reactionErrorMessage(error));
    }
  };

  return (
    <div
      className="relative flex h-full min-h-0 w-full flex-col overflow-hidden"
      style={{
        backgroundImage: CHAT_WALLPAPERS[wallpaperIndex],
        backgroundRepeat: "no-repeat",
        ...(visualViewportHeight ? {
          height: `min(100%, ${Math.round(visualViewportHeight)}px)`,
          maxHeight: `min(100%, ${Math.round(visualViewportHeight)}px)`,
        } : {}),
      }}
    >
      {openMsg && (
        <div
          aria-hidden="true"
          onClick={() => setOpenMsg(null)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[5px]"
        />
      )}
      <div
        className="chat-bar relative z-20 flex shrink-0 items-center gap-2 border-b border-white/5 px-4 pb-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.5rem)" }}
      >
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
          <p className="text-xs text-muted-foreground truncate">{blockStatus.data ? "Blocked by you" : peerTyping ? "typing…" : online ? "Active now" : `@${other.data?.username}`}</p>
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
            <DropdownMenuItem onClick={() => { const all = (msgs.data ?? []).map((m: any) => m.body).join("\n"); navigator.clipboard.writeText(all); toast.success("Loaded messages copied"); }}>Export loaded messages</DropdownMenuItem>
            <DropdownMenuItem onClick={changeWallpaper}>Change wallpaper</DropdownMenuItem>
            <DropdownMenuItem
              onClick={async () => {
                if (!user) return;
                try { await muteUser(user.id, userId); toast.success("Conversation muted"); }
                catch (e: any) { toast.error(e.message); }
              }}
            >
              Mute conversation
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={async () => {
                if (!user) return;
                const currentlyBlocked = !!blockStatus.data;
                if (!currentlyBlocked && !confirm(`Block @${other.data?.username}?`)) return;
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
                } catch (e: any) { toast.error(e.message); }
              }}
              className="text-destructive focus:text-destructive"
            >
              {blockStatus.data ? "Unblock user" : "Block user"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>

      {searchOpen && (
        <div className="chat-bar relative z-20 flex shrink-0 items-center gap-2 border-b border-white/5 px-4 py-2">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input autoFocus value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Search loaded messages…" className="glass border-white/10 h-8" />
          <button onClick={() => { setSearchOpen(false); setSearchQ(""); }} className="text-muted-foreground"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div ref={scrollRef} className="chat-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-3 space-y-2">
        {hasOlderMessages && (
          <div className="flex justify-center pb-2">
            <Button onClick={loadOlderMessages} disabled={loadingOlderMessages} variant="ghost" size="sm" className="text-xs text-muted-foreground">
              {loadingOlderMessages ? "Loading earlier messages…" : "Load earlier messages"}
            </Button>
          </div>
        )}
        <AnimatePresence initial={false}>
          {filteredMsgs.map((m, index) => {
            const mine = m.sender_id === user?.id;
            const deliveryStatus = (m as CachedDirectMessage).delivery_status;
            const audioPath = (m as any).audio_url as string | null;
            const quote = (m.body || "").startsWith("↪ ") ? (m.body as string).split("\n")[0].slice(2) : null;
            const rest = quote ? (m.body as string).split("\n").slice(1).join("\n") : m.body;
            const previous = filteredMsgs[index - 1];
            const startsGroup = !previous ||
              previous.sender_id !== m.sender_id ||
              new Date(m.created_at).getTime() - new Date(previous.created_at).getTime() > 5 * 60 * 1000;
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
                  ? [{
                      label: "Delete for everyone",
                      icon: Trash2,
                      destructive: true,
                      onSelect: () => { void deleteMsg(m.id); },
                    }]
                  : []),
              ];
              return (
                <Fragment key={m.id}>
                  {startsGroup && !deliveryStatus && (
                    <div className="flex w-full justify-center py-1">
                      <span className="rounded-full bg-black/20 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </span>
                    </div>
                  )}
                  <motion.div
                    id={`msg-${m.id}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`group flex items-end gap-1 ${mine ? "justify-end" : "justify-start"}`}
                  >
                    <MessageActionMenu
                      open={openMsg === m.id}
                      onOpenChange={(open) => setOpenMsg(open ? m.id : null)}
                      align={mine ? "right" : "left"}
                      triggerRole="group"
                      actions={audioActions}
                    >
                      <VoiceNoteBubble path={audioPath} durationMs={(m as any).duration_ms ?? null} mine={mine} />
                    </MessageActionMenu>
                    <MessageReactions messageId={m.id} align={mine ? "right" : "left"} />
                  </motion.div>
                </Fragment>
              );
            }
            const deletedAt = (m as CachedDirectMessage).deleted_at;
            return (
              <Fragment key={m.id}>
              {startsGroup && !deliveryStatus && (
                <div className="flex w-full justify-center py-1">
                  <span className="rounded-full bg-black/20 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                    {new Date(m.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </span>
                </div>
              )}
              <motion.div
                id={`msg-${m.id}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`group flex min-w-0 items-end gap-1 rounded-2xl transition-shadow duration-500 ${
                  openMsg === m.id ? "relative z-[41]" : ""
                } ${
                  highlighted === m.id ? "ring-2 ring-[var(--rizz-pink)] shadow-glow" : ""
                } ${mine ? "justify-end" : "justify-start"}`}
              >
                {inviteCode && !deletedAt ? (
                  <GroupInviteMessageCard code={inviteCode} message={inviteText ?? ""} />
                ) : (
                <Popover open={openMsg === m.id} onOpenChange={(o) => setOpenMsg(o ? m.id : null)}>
                  <PopoverTrigger asChild>
                    <button
                      aria-haspopup="dialog"
                      aria-expanded={openMsg === m.id}
                      className={`chat-bubble min-w-[44px] max-w-[78%] [overflow-wrap:anywhere] px-4 py-2.5 rounded-2xl text-[15px] leading-relaxed whitespace-pre-wrap text-left select-none touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rizz-pink)] ${deliveryStatus ? "opacity-60" : ""} ${mine ? "bg-gradient-primary text-primary-foreground shadow-sm" : "border border-white/10 bg-[var(--surface-bubble)]"}`}
                      style={{ WebkitTouchCallout: "none", touchAction: "pan-y" }}
                      onContextMenu={(e) => { e.preventDefault(); setOpenMsg(m.id); }}
                      onTouchStart={(e) => startPress(m.id, { x: e.touches[0].clientX, y: e.touches[0].clientY })}
                      onTouchEnd={cancelPress}
                      onTouchCancel={cancelPress}
                      onTouchMove={(e) => movePress({ x: e.touches[0].clientX, y: e.touches[0].clientY })}
                      onMouseDown={(e) => startPress(m.id, { x: e.clientX, y: e.clientY })}
                      onMouseUp={cancelPress}
                      onMouseLeave={cancelPress}
                    >
                      {quote && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); const t = (msgs.data ?? []).find((x: any) => (x.body || "").includes(quote)); if (t) jumpToMessage((t as any).id); }}
                          className="mb-1 flex items-center gap-1 text-[11px] opacity-80 border-l-2 border-current/40 pl-2 line-clamp-2"
                        >
                          <CornerUpLeft className="h-3 w-3 shrink-0" /> {quote}
                        </span>
                      )}
                      {m.attachment_url && (
                        <img
                          src={m.attachment_url}
                          alt="Image shared in chat"
                          loading="lazy"
                          className="mb-2 max-h-72 max-w-full rounded-xl object-contain"
                        />
                      )}
                      {deletedAt ? "This message was unsent" : rest}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    aria-label="Message actions"
                    className="z-[60] max-h-[min(70dvh,28rem)] w-[min(19rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-white/15 bg-[#100b18] p-2 text-white shadow-[0_22px_70px_-20px_rgba(0,0,0,0.95)] backdrop-blur-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95"
                    side="top"
                    sideOffset={12}
                    collisionPadding={12}
                  >
                    <div className="no-scrollbar mb-2 flex items-center gap-0.5 overflow-x-auto rounded-full border border-white/10 bg-[#08060d] p-1">
                      {QUICK_EMOJIS.map((e) => (
                        <button type="button" key={e} aria-label={`React with ${e}`} onClick={() => { void react(m.id, e); setOpenMsg(null); }} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg transition-transform hover:scale-110 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rizz-pink)]">{e}</button>
                      ))}
                      <button
                        type="button"
                        aria-label={moreReactionsOpen ? "Hide more reactions" : "More reactions"}
                        aria-expanded={moreReactionsOpen}
                        onClick={() => setMoreReactionsOpen((open) => !open)}
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white/75 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rizz-pink)]"
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    </div>
                    {moreReactionsOpen && (
                      <div className="mb-2 grid grid-cols-6 gap-1 rounded-xl border border-white/10 bg-[#08060d] p-1">
                        {MORE_REACTIONS.map((emoji) => (
                          <button
                            type="button"
                            key={emoji}
                            aria-label={`React with ${emoji}`}
                            onClick={() => { void react(m.id, emoji); setOpenMsg(null); setMoreReactionsOpen(false); }}
                            className="grid h-10 w-10 place-items-center rounded-lg text-lg transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rizz-pink)]"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-col gap-0.5 text-xs">
                      <button type="button" onClick={() => { navigator.clipboard.writeText(m.body); toast.success("Copied"); setOpenMsg(null); }} className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-left text-white/90 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rizz-pink)]"><Copy className="h-4 w-4 text-white/60" />Copy text</button>
                      <button type="button" onClick={() => { setReplyTo({ id: m.id, body: rest || m.body, mine }); setOpenMsg(null); }} className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-left text-white/90 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rizz-pink)]"><CornerUpLeft className="h-4 w-4 text-white/60" />Reply</button>
                      <button type="button" onClick={() => { toast("Reported"); setOpenMsg(null); }} className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-left text-white/90 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rizz-pink)]"><Flag className="h-4 w-4 text-white/60" />Report</button>
                      {!deletedAt && (
                        <button
                          type="button"
                          onClick={() => { void deleteMsgForMe(m.id); setOpenMsg(null); }}
                          className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-left text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rizz-pink)]"
                        >
                          <Trash2 className="h-4 w-4" />Delete for me
                        </button>
                      )}
                      {mine && !deletedAt && (
                        <button type="button" onClick={() => { void deleteMsg(m.id); setOpenMsg(null); }} className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-left text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rizz-pink)]"><Trash2 className="h-4 w-4" />Delete for everyone</button>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                )}
                {deliveryStatus === "failed" ? (
                  <button
                    onClick={() => void deliverPendingMessage(m.id, m.body, undefined, m.attachment_url)}
                    disabled={sendingMessage}
                    className="text-[10px] text-amber-200/80 hover:text-amber-100"
                  >
                    Retry
                  </button>
                ) : deliveryStatus === "sending" ? (
                  <span className="text-[10px] text-muted-foreground">Sending…</span>
                ) : null}
                <MessageReactions messageId={m.id} align={mine ? "right" : "left"} />
              </motion.div>
              </Fragment>
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
          className="absolute bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] right-4 z-30 grid h-11 w-11 place-items-center rounded-full chat-bar border border-white/10 shadow-sm active:scale-95"
          aria-label="Scroll to latest"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      )}

      <div className="chat-bar relative z-20 shrink-0 border-t border-white/5 px-3 pt-2.5 pb-[max(env(safe-area-inset-bottom,0px),0.5rem)]">
        <div className="mx-auto w-full max-w-3xl">
          {imagePreview && (
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-2">
              <img src={imagePreview} alt="Image ready to send" className="h-14 w-14 rounded-lg object-cover" />
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">Image compressed before upload</span>
              <Button
                type="button"
                onClick={() => { setImageFile(null); setImagePreview(null); }}
                variant="ghost"
                size="icon"
                aria-label="Remove image"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          {replyTo && (
            <div className="mb-2 flex items-center gap-2 rounded-xl glass border border-white/10 px-3 py-2">
              <CornerUpLeft className="h-3.5 w-3.5 text-[var(--rizz-pink)] shrink-0" />
              <button onClick={() => jumpToMessage(replyTo.id)} className="flex-1 min-w-0 text-left">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Replying to {replyTo.mine ? "yourself" : `@${other.data?.username ?? "them"}`}
                </p>
                <p className="text-xs truncate">{replyTo.body}</p>
              </button>
              <button onClick={() => setReplyTo(null)} aria-label="Cancel reply" className="text-muted-foreground shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <div className="flex gap-2">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => { chooseImage(event.target.files?.[0] ?? null); event.currentTarget.value = ""; }}
          />
          <Button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            variant="ghost"
            size="icon"
            aria-label="Attach an image"
            className="shrink-0 text-muted-foreground"
          >
            <ImagePlus className="h-5 w-5" />
          </Button>
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
          <Textarea
            ref={composerRef}
            value={body}
            disabled={blockStatus.data}
            onChange={(e) => { setBody(e.target.value); broadcastTyping(); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer: fine)").matches) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Message"
            maxLength={MAX_MESSAGE_LENGTH}
            rows={1}
            enterKeyHint="send"
            className="min-h-11 max-h-40 resize-none overflow-y-hidden border-white/10 bg-black/20 py-3"
          />
          {body.trim() || imageFile ? (
            <>
              {body.trim() && (
                <Button onClick={scheduleSend} variant="ghost" size="icon" className="text-muted-foreground" aria-label="Schedule send">
                  <Clock className="h-4 w-4" />
                </Button>
              )}
              <Button onClick={() => void send()} disabled={blockStatus.data || sendingMessage || (!body.trim() && !imageFile)} size="icon" className="bg-gradient-primary border-0 shadow-glow" aria-label={sendingMessage ? "Sending message" : "Send message"}>
                <Send className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button
              onClick={toggleRecord}
              disabled={blockStatus.data || sendingVoice}
              size="icon"
              className={recording ? "min-w-[5.5rem] gap-2 border border-rose-300/30 bg-rose-600 px-3 text-white shadow-[0_6px_22px_-9px_rgba(244,63,94,.8)] hover:bg-rose-500" : "bg-gradient-primary border-0 shadow-glow"}
              aria-label={recording ? "Stop and send voice note" : "Record voice note"}
              aria-pressed={recording}
            >
              {recording ? (
                <span className="flex items-center gap-2 text-xs font-semibold tabular-nums">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                  {formatDuration(recMs)}
                </span>
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
