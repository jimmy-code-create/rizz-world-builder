import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Fragment, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Users, Link2, LogOut, Copy, Crown, Trash2, ImagePlus, Palette, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchGroup, fetchMembers, fetchGroupMessages, fetchOlderGroupMessages, sendGroupMessage, createInvite, leaveGroup } from "@/lib/groups";
import { MessageActionMenu } from "@/components/chat/MessageActionMenu";
import { MessageLinkPreviews } from "@/components/chat/LinkPreviews";
import { useHiddenLinkPreviews } from "@/lib/link-preview";
import { AvatarWithStatus } from "@/components/presence/StatusDot";
import { usePresenceMap } from "@/lib/presence";
import { ReactionChips, burstOverMessage } from "@/components/chat/ReactionChips";
import { reactionHaptic } from "@/components/chat/ReactionBurst";
import { useChatReactions } from "@/lib/useChatReactions";
import { useMediaViewer } from "@/components/media/useMediaViewer";
import { DOUBLE_TAP_REACTION } from "@/lib/reactions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { GifPicker } from "@/components/GifPicker";
import { GifContent } from "@/components/GifContent";
import { ChatMessageMedia } from "@/components/chat/ChatMessageMedia";
import { WallpaperSheet } from "@/components/chat/WallpaperSheet";
import { loadWallpaper, wallpaperStyle, type ChatWallpaper } from "@/lib/chat-wallpaper";
import { compressChatImage } from "@/lib/chat-media";
import { MentionAutocomplete, replaceMention } from "@/components/MentionAutocomplete";
import { renderGifSegments } from "@/lib/gif-content";
import { renderCaptionWithTags } from "@/lib/hashtags";
import { MarkdownText } from "@/components/MarkdownText";
import { useMentionLabels } from "@/lib/mention-tokens";
import { nameColorFor } from "@/lib/chat-appearance";

const GROUP_MESSAGE_LIMIT = 10_000;

export const Route = createFileRoute("/_app/g/$id")({
  head: () => ({ meta: [{ title: "Group · RIZZ" }] }),
  component: GroupRoom,
});

function GroupRoom() {
  const { id } = Route.useParams();
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [body, setBody] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [openMessageId, setOpenMessageId] = useState<string | null>(null);
  // Per-group wallpaper: a preset or an uploaded background URL.
  const [wallpaper, setWallpaper] = useState<ChatWallpaper>(null);
  const [wallpaperOpen, setWallpaperOpen] = useState(false);
  // Photo attachments, mirroring DMs: preview locally, upload on send.
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const messagesListRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [caret, setCaret] = useState(0);
  const [olderMessages, setOlderMessages] = useState<Awaited<ReturnType<typeof fetchGroupMessages>>>([]);
  const [hasOlderMessages, setHasOlderMessages] = useState(true);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const draftKey = user?.id ? `rizz:group-draft:${user.id}:${id}` : null;

  const group = useQuery({ queryKey: ["group", id], queryFn: () => fetchGroup(id) });
  const members = useQuery({ queryKey: ["group-members", id], queryFn: () => fetchMembers(id), enabled: !!group.data });
  const msgs = useQuery({ queryKey: ["group-msgs", id], queryFn: () => fetchGroupMessages(id, user?.id), enabled: !!group.data });
  const groupReady = Boolean(group.data);
  // `<@userId>` tokens resolve to a username once, like in realm chat.
  const mentionLabels = useMentionLabels((msgs.data ?? []).map((row) => row.body));
  const messageKey = ["group-msgs", id] as const;
  type GroupMessage = Awaited<ReturnType<typeof fetchGroupMessages>>[number];
  type CachedGroupMessage = GroupMessage & { delivery_status?: "sending" | "failed" };
  const sendMessage = useMutation({
    mutationFn: ({ text, attachmentUrl }: { text: string; retryId?: string; attachmentUrl?: string | null }) => {
      if (!user) throw new Error("Sign in to send a message");
      return sendGroupMessage({ group_id: id, author_id: user.id, body: text, attachment_url: attachmentUrl ?? null });
    },
    onMutate: async ({ text, retryId, attachmentUrl }) => {
      await qc.cancelQueries({ queryKey: messageKey });
      const optimisticId = retryId ?? `pending-${crypto.randomUUID()}`;
      const optimistic = {
        id: optimisticId,
        group_id: id,
        author_id: user!.id,
        body: text,
        created_at: new Date().toISOString(),
        // The uploaded URL is already known before sending, so the optimistic
        // row shows the real photo and a retry keeps it.
        attachment_url: attachmentUrl ?? null,
        audio_url: null,
        duration_ms: null,
        reply_to: null,
        author: {
          username: profile?.username ?? user?.user_metadata?.username ?? "you",
          display_name: profile?.display_name ?? null,
          avatar_url: profile?.avatar_url ?? null,
          accent_color: profile?.accent_color ?? null,
        },
      } as unknown as CachedGroupMessage;
      qc.setQueryData<CachedGroupMessage[]>(messageKey, (current = []) =>
        retryId
          ? current.map((message) => message.id === retryId ? { ...message, delivery_status: "sending" } : message)
          : [...current, optimistic],
      );
      return { optimisticId };
    },
    onSuccess: (saved, _text, context) => {
      qc.setQueryData<CachedGroupMessage[]>(messageKey, (current = []) =>
        current.map((message) => message.id === context?.optimisticId ? saved : message),
      );
    },
      onError: (error: Error, variables, context) => {
        console.error("Group message send failed", error);
      setBody((current) => current.trim() ? current : variables.text);
      qc.setQueryData<CachedGroupMessage[]>(messageKey, (current = []) =>
        current.map((message) => message.id === context?.optimisticId
          ? { ...message, delivery_status: "failed" }
          : message),
      );
        toast.error("Couldn't send this message. Please try again.");
    },
  });

  useEffect(() => {
    if (!groupReady) return;
    const queryKey = ["group-msgs", id] as const;
    const ch = supabase.channel(`group-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${id}` }, ({ new: message }) => {
        const row = message as { id: string; author_id: string; body: string };
        const current = qc.getQueryData<CachedGroupMessage[]>(queryKey) ?? [];
        if (current.some((item) => item.id === row.id)) return;
        if (row.author_id === user?.id && current.some((item) => item.id.startsWith("pending-") && item.body === row.body)) return;
        qc.invalidateQueries({ queryKey });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "group_messages" }, ({ old: message }) => {
        const row = message as { id: string };
        qc.setQueryData<CachedGroupMessage[]>(queryKey, (current = []) => current.filter((item) => item.id !== row.id));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "group_messages", filter: `group_id=eq.${id}` }, ({ new: message }) => {
        const row = message as CachedGroupMessage;
        qc.setQueryData<CachedGroupMessage[]>(queryKey, (current = []) =>
          current.map((item) => item.id === row.id ? { ...item, ...row } : item),
        );
      })
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") toast.error("Group updates disconnected. Check your internet connection.");
      });
    return () => { supabase.removeChannel(ch); };
  }, [groupReady, id, qc, user?.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.data]);
  useEffect(() => {
    setOlderMessages([]);
    setHasOlderMessages(true);
  }, [id]);
  useEffect(() => {
    if (msgs.data) setHasOlderMessages(msgs.data.length >= 30);
  }, [id, msgs.data]);

  useEffect(() => {
    setDraftReady(false);
    let saved = "";
    try {
      saved = draftKey ? window.localStorage.getItem(draftKey) ?? "" : "";
    } catch {
      // Local draft persistence is optional.
    }
    setBody(saved);
    setDraftReady(true);
  }, [draftKey]);

  useEffect(() => {
    if (!draftReady || !draftKey) return;
    const timer = window.setTimeout(() => {
      try {
        if (body) window.localStorage.setItem(draftKey, body);
        else window.localStorage.removeItem(draftKey);
      } catch {
        // The composer remains usable when browser storage is unavailable.
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

  useEffect(() => {
    setWallpaper(loadWallpaper("group", id));
  }, [id]);

  useEffect(() => () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

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
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const send = async () => {
    if (!user) return;
    const text = body.trim();
    if (!text && !imageFile) return;
    if (text.length > GROUP_MESSAGE_LIMIT) {
      toast.error(`Messages can be up to ${GROUP_MESSAGE_LIMIT.toLocaleString()} characters`);
      return;
    }
    if (imageFile) {
      setUploadingImage(true);
      try {
        const blob = await compressChatImage(imageFile);
        const path = `${user.id}/${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage
          .from("chat-media")
          .upload(path, blob, { contentType: "image/jpeg" });
        if (error) {
          throw new Error(/bucket|not found|does not exist|schema cache/i.test(error.message)
            ? "Photo sending needs the chat-media storage setup in BACKEND_REQUIREMENTS.md."
            : error.message);
        }
        const attachmentUrl = supabase.storage.from("chat-media").getPublicUrl(path).data.publicUrl;
        sendMessage.mutate({ text, attachmentUrl });
        setBody("");
        clearImage();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't send that photo");
      } finally {
        setUploadingImage(false);
      }
      return;
    }
    setBody("");
    sendMessage.mutate({ text });
  };

  const deleteMessage = async (messageId: string) => {
    if (!user) return;
    try {
      const { error } = await (supabase.rpc as any)("unsend_group_message", { _message_id: messageId });
      if (error) throw error;
      const update = (current: CachedGroupMessage[] = []) => current.map((message) =>
        message.id === messageId
          ? { ...message, body: "This message was unsent", attachment_url: null, deleted_at: new Date().toISOString() }
          : message,
      );
      qc.setQueryData<CachedGroupMessage[]>(messageKey, update);
      setOlderMessages(update);
      toast.success("Message unsent for everyone");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Couldn't delete that message";
      toast.error(/function|schema cache|does not exist/i.test(message)
        ? "Unsend needs the Lovable backend setup in BACKEND_REQUIREMENTS.md."
        : message);
    }
  };

  const deleteMessageForMe = async (messageId: string) => {
    if (!user) return;
    try {
      const { error } = await (supabase.rpc as any)("hide_group_message_for_me", { _message_id: messageId });
      if (error) throw error;
      const remove = (current: CachedGroupMessage[] = []) => current.filter((message) => message.id !== messageId);
      qc.setQueryData<CachedGroupMessage[]>(messageKey, remove);
      setOlderMessages(remove);
      toast.success("Message deleted for you");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Couldn't delete that message";
      toast.error(/function|schema cache|does not exist/i.test(message)
        ? "Delete for me needs the Lovable backend setup in BACKEND_REQUIREMENTS.md."
        : message);
    }
  };

  const loadOlderMessages = async () => {
    if (!user || loadingOlderMessages || !hasOlderMessages) return;
    const visibleMessages = [...olderMessages, ...(msgs.data ?? [])];
    const oldest = visibleMessages[0];
    if (!oldest) return setHasOlderMessages(false);
    setLoadingOlderMessages(true);
    const previousHeight = messagesListRef.current?.scrollHeight ?? 0;
    try {
      const page = await fetchOlderGroupMessages(id, oldest, user.id);
      setOlderMessages((current) => {
        const known = new Set([...current, ...(msgs.data ?? [])].map((message) => message.id));
        return [...page.messages.filter((message) => !known.has(message.id)), ...current];
      });
      setHasOlderMessages(page.hasMore);
      requestAnimationFrame(() => {
        const list = messagesListRef.current;
        if (list) list.scrollTop += list.scrollHeight - previousHeight;
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't load earlier messages");
    } finally {
      setLoadingOlderMessages(false);
    }
  };

  const makeInvite = async () => {
    if (!user) return;
    try {
      const inv = await createInvite(id, user.id, { expires_in_hours: 24 * 7 });
      const url = `${window.location.origin}/join/${inv.code}`;
      setInviteUrl(url);
      setInviteOpen(true);
    } catch (e: any) { toast.error(e.message); }
  };

  const leave = async () => {
    if (!user) return;
    try { await leaveGroup(id, user.id); toast("Left group"); nav({ to: "/groups" }); }
    catch (e: any) { toast.error(e.message); }
  };

  // Hooks must all run before the guards below, or React throws "Rendered more
  // hooks than during the previous render" once the group query resolves.
  const visibleMessages = [...olderMessages, ...(msgs.data ?? [])];
  const visibleIds = visibleMessages.map((message: { id: string }) => message.id);
  const reactions = useChatReactions("group", visibleIds, {
    myMessageIds: visibleMessages
      .filter((message: { author_id: string }) => message.author_id === user?.id)
      .map((message: { id: string }) => message.id),
  });
  const removedPreviews = useHiddenLinkPreviews("group", visibleIds);
  const presence = usePresenceMap((members.data ?? []).map((member: any) => member.user_id));
  const media = useMediaViewer();

  if (group.isLoading) return <div className="h-40 rounded-2xl skeleton-shimmer" />;
  if (!group.data) return (
    <div className="text-center py-20 glass rounded-3xl border border-white/5">
      <h2 className="font-display text-xl font-bold">Group not found</h2>
      <p className="text-sm text-muted-foreground mt-1">You may need an invite link to join.</p>
      <Link to="/groups" className="inline-block mt-4 text-sm text-primary">← Back to groups</Link>
    </div>
  );

  const g = group.data;
  const isOwner = user?.id === g.owner_id;

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div
        className="chat-bar relative z-20 flex shrink-0 items-center gap-3 border-b border-white/5 px-4 pb-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.5rem)" }}
      >
        <Link to="/groups"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-display font-bold shadow-md shrink-0">
          {g.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold truncate flex items-center gap-1.5">{g.name} {isOwner && <Crown className="h-3.5 w-3.5 text-primary" />}</p>
          <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded-md bg-primary/15 text-[9px] font-bold uppercase tracking-wide text-primary">Private group</span>
            {g.member_count} member{g.member_count === 1 ? "" : "s"} · {g.topic || "No topic"}
          </p>
        </div>
        <Button onClick={makeInvite} variant="ghost" size="icon" aria-label="Invite" className="text-muted-foreground hover:text-foreground">
          <Link2 className="h-5 w-5" />
        </Button>
        <Button onClick={() => setWallpaperOpen(true)} variant="ghost" size="icon" aria-label="Chat wallpaper" className="text-muted-foreground hover:text-foreground">
          <Palette className="h-5 w-5" />
        </Button>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Members" className="text-muted-foreground hover:text-foreground"><Users className="h-5 w-5" /></Button>
          </SheetTrigger>
          <SheetContent className="glass-strong border-white/10">
            <SheetTitle className="font-display">Members</SheetTitle>
            <div className="mt-4 space-y-2">
              {(members.data ?? []).map((m: any) => (
                <Link key={m.user_id} to="/u/$username" params={{ username: m.user?.username ?? "" }} className="flex min-h-12 items-center gap-3 p-2 rounded-xl hover:bg-white/5">
                  <AvatarWithStatus status={presence.statusOf(m.user_id)} dotSize={11}>
                    <Avatar className="h-9 w-9"><AvatarImage src={m.user?.avatar_url ?? undefined} /><AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs">{(m.user?.username ?? "?").charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                  </AvatarWithStatus>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.user?.display_name || m.user?.username}</p>
                    <p className="text-xs text-muted-foreground truncate">@{m.user?.username} · {m.role}</p>
                  </div>
                </Link>
              ))}
              {!isOwner && (
                <Button onClick={leave} variant="outline" className="w-full glass border-white/10 text-destructive mt-4 gap-2"><LogOut className="h-4 w-4" /> Leave group</Button>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>

        <div
          ref={messagesListRef}
          onClick={media.onMediaClick}
          className="chat-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-2"
          style={wallpaperStyle(wallpaper)}
        >
          {media.viewer}
          {hasOlderMessages && (
            <div className="flex justify-center pb-2">
              <Button onClick={() => void loadOlderMessages()} disabled={loadingOlderMessages} variant="ghost" size="sm" className="text-xs text-muted-foreground">
                {loadingOlderMessages ? "Loading earlier messages…" : "Load earlier messages"}
              </Button>
            </div>
          )}
        <AnimatePresence initial={false}>
          {visibleMessages.map((m: any, index) => {
            const mine = m.author_id === user?.id;
            const deletedAt = m.deleted_at as string | null | undefined;
            const hasText = !!(m.body && m.body.trim());
            const previous = visibleMessages[index - 1];
            const startsGroup = !previous ||
              previous.author_id !== m.author_id ||
              new Date(m.created_at).getTime() - new Date(previous.created_at).getTime() > 5 * 60 * 1000;
            return (
              <Fragment key={m.id}>
              {startsGroup && !m.delivery_status && (
                <div className="py-1 text-center text-[10px] font-medium text-muted-foreground">
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </div>
              )}
              <motion.div id={`msg-${m.id}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                {!mine && (startsGroup ? (
                  <Avatar className="h-7 w-7 shrink-0"><AvatarImage src={m.author?.avatar_url ?? undefined} /><AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-bold">{(m.author?.username ?? "?").charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                ) : <div aria-hidden="true" className="h-7 w-7 shrink-0" />)}
                <div className={`w-fit max-w-[88%] min-w-0 ${mine ? "items-end" : "items-start"} flex flex-col`}>
                  {!mine && startsGroup && (
                    <span
                      className="mb-0.5 ml-3 max-w-full truncate text-[11px]"
                      style={{ color: nameColorFor(m.author_id, m.author?.accent_color ?? null) }}
                    >
                      @{m.author?.username}
                    </span>
                  )}
                  <MessageActionMenu
                    open={openMessageId === m.id}
                    onOpenChange={(open) => setOpenMessageId(open ? m.id : null)}
                    align={mine ? "right" : "left"}
                    reactionBar={{ onPick: (emoji) => { void reactions.toggle(m.id, emoji); } }}
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
                      ...(mine && !deletedAt && !String(m.id).startsWith("pending-")
                        ? [{
                            label: "Delete for everyone",
                            icon: Trash2,
                            destructive: true,
                            onSelect: () => { void deleteMessage(m.id); },
                          }]
                        : []),
                      ...(!deletedAt && !String(m.id).startsWith("pending-")
                        ? [{
                            label: "Delete for me",
                            icon: Trash2,
                            destructive: true,
                            onSelect: () => { void deleteMessageForMe(m.id); },
                          }]
                        : []),
                    ]}
                  >
                    <div className={`chat-bubble message-bubble rounded-2xl px-4 py-2 select-none touch-manipulation ${m.delivery_status ? "opacity-55" : ""} ${
                      deletedAt
                        ? "message-bubble--unsent"
                        : hasText
                          ? mine
                            ? "message-bubble--outgoing"
                            : "message-bubble--incoming"
                          : "message-bubble--media"
                    }`}>
                      {m.attachment_url && !deletedAt && (
                        <ChatMessageMedia
                          src={m.attachment_url}
                          alt="Image shared in chat"
                          className={hasText ? "mb-2" : ""}
                        />
                      )}
                      {deletedAt ? "This message was unsent" : !hasText ? null : (
                        <>
                          {renderGifSegments(m.body).map((seg, si) =>
                            seg.isGif || seg.isSticker
                              ? <GifContent key={si}>{seg.marker ?? ""}</GifContent>
                              : (
                                <MarkdownText
                                  key={si}
                                  text={seg.value}
                                  renderPlainText={(plain) =>
                                    renderCaptionWithTags(plain).map((p, pi) =>
                                      p.mentionToken
                                        ? <span key={`${si}-${pi}`} className="mention-highlight font-medium">{mentionLabels(p.mentionToken)}</span>
                                        : p.mention
                                          ? <Link key={`${si}-${pi}`} to="/u/$username" params={{ username: p.mention }} className={`mention-highlight font-medium ${mine ? "underline decoration-white/60" : "hover:underline"}`}>{p.text}</Link>
                                          : p.tag
                                            ? <Link key={`${si}-${pi}`} to="/tag/$tag" params={{ tag: p.tag }} className={`font-medium ${mine ? "underline decoration-white/60" : "text-primary hover:underline"}`}>{p.text}</Link>
                                            : p.url
                                              ? <a key={`${si}-${pi}`} href={p.url} target="_blank" rel="noopener noreferrer" className={mine ? "underline break-words" : "text-sky-400 hover:underline break-words"}>{p.text}</a>
                                              : <span key={`${si}-${pi}`}>{p.text}</span>
                                    )
                                  }
                                />
                              )
                          )}
                        </>
                      )}
                    </div>
                  </MessageActionMenu>
                  <ReactionChips
                    scope="group"
                    messageId={m.id}
                    groups={reactions.groupsFor(m.id)}
                    reactorsFor={reactions.reactorsFor}
                    align={mine ? "right" : "left"}
                    hidden={!!deletedAt || String(m.id).startsWith("pending-")}
                    pulse={reactions.lastPulse}
                    onToggle={(emoji) => reactions.toggle(m.id, emoji)}
                  />
                  <MessageLinkPreviews
                    text={deletedAt ? null : m.body}
                    messageId={m.id}
                    scope="group"
                    canHide={mine}
                    removed={removedPreviews.hidden.has(m.id)}
                  />
                  {m.delivery_status ? (
                    m.delivery_status === "failed" ? (
                      <button
                        onClick={() => sendMessage.mutate({ text: m.body, retryId: m.id, attachmentUrl: m.attachment_url })}
                        disabled={sendMessage.isPending}
                        className="text-[10px] text-amber-200/80 mt-0.5 px-2 hover:text-amber-100"
                      >
                        Not sent · tap to retry
                      </button>
                    ) : (
                      <span className="text-[10px] text-muted-foreground mt-0.5 px-2">Sending…</span>
                    )
                  ) : (
                    null
                  )}
                </div>
              </motion.div>
              </Fragment>
            );
          })}
        </AnimatePresence>
        {(msgs.data ?? []).length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-12">Say hi to start the conversation 👋</p>
        )}
        <div ref={endRef} />
      </div>

      <div className="chat-bar relative z-20 shrink-0 border-t border-white/5 px-3 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)]">
        <div className="mx-auto w-full max-w-3xl">
          {imagePreview && (
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-2">
              <img src={imagePreview} alt="Photo ready to send" className="h-14 w-14 rounded-lg object-cover" />
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">Photo compresses before upload</span>
              <Button type="button" onClick={clearImage} variant="ghost" size="icon" aria-label="Remove photo">
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          <div className="flex gap-2">
          <GifPicker onSelect={(marker) => setBody((current) => `${current}${current ? " " : ""}${marker}`.slice(0, GROUP_MESSAGE_LIMIT))} />
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
            disabled={uploadingImage}
            variant="ghost"
            size="icon"
            aria-label="Attach a photo"
            className="shrink-0 text-muted-foreground"
          >
            <ImagePlus className="h-5 w-5" />
          </Button>
          {/* The mention popup anchors to this wrapper, so it opens above the
              composer instead of the nearest positioned ancestor. */}
          <div className="relative min-w-0 flex-1">
            <Textarea
              ref={composerRef}
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                setCaret(e.target.selectionStart ?? e.target.value.length);
              }}
              onKeyUp={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
              onClick={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer: fine)").matches) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Message"
              maxLength={GROUP_MESSAGE_LIMIT}
              rows={1}
              enterKeyHint="send"
              className="composer-input min-h-11 max-h-40 resize-none overflow-y-hidden border-white/10 bg-black/20 py-3"
            />
            <MentionAutocomplete
              value={body}
              caret={caret}
              memberIds={(members.data ?? []).map((member: any) => member.user_id as string)}
              emptyHint="No group member matches that name."
              onPick={(username) => {
                const next = replaceMention(body, caret, username);
                setBody(next.value);
                setCaret(next.caret);
                const el = composerRef.current;
                if (el) requestAnimationFrame(() => { el.focus(); el.setSelectionRange(next.caret, next.caret); });
              }}
            />
          </div>
          <Button onClick={() => void send()} disabled={(!body.trim() && !imageFile) || sendMessage.isPending || uploadingImage} size="icon" className="bg-primary text-primary-foreground border-0 shadow-md" aria-label={sendMessage.isPending ? "Sending message" : "Send message"}>
            <Send className="h-4 w-4" />
          </Button>
          </div>
        </div>
      </div>

      <WallpaperSheet
        open={wallpaperOpen}
        onOpenChange={setWallpaperOpen}
        kind="group"
        chatId={id}
        userId={user?.id}
        value={wallpaper}
        onChange={setWallpaper}
      />

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="glass-strong border-white/10">
          <DialogTitle className="font-display text-xl">Invite to {g.name}</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">Friends-only · expires in 7 days. Recipients must mutually follow a current member.</p>
          <div className="mt-3 flex gap-2">
            <Input value={inviteUrl} readOnly className="glass border-white/10 font-mono text-xs" />
            <Button onClick={() => { navigator.clipboard.writeText(inviteUrl); toast.success("Copied"); }} size="icon" className="bg-primary text-primary-foreground border-0 shadow-md"><Copy className="h-4 w-4" /></Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}