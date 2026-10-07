import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Fragment, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Users, Link2, LogOut, Copy, Crown, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchGroup, fetchMembers, fetchGroupMessages, fetchOlderGroupMessages, sendGroupMessage, createInvite, leaveGroup } from "@/lib/groups";
import { MessageActionMenu } from "@/components/chat/MessageActionMenu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { GifPicker } from "@/components/GifPicker";
import { GifContent } from "@/components/GifContent";

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
  const endRef = useRef<HTMLDivElement>(null);
  const messagesListRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [olderMessages, setOlderMessages] = useState<Awaited<ReturnType<typeof fetchGroupMessages>>>([]);
  const [hasOlderMessages, setHasOlderMessages] = useState(true);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const draftKey = user?.id ? `rizz:group-draft:${user.id}:${id}` : null;

  const group = useQuery({ queryKey: ["group", id], queryFn: () => fetchGroup(id) });
  const members = useQuery({ queryKey: ["group-members", id], queryFn: () => fetchMembers(id), enabled: !!group.data });
  const msgs = useQuery({ queryKey: ["group-msgs", id], queryFn: () => fetchGroupMessages(id, user?.id), enabled: !!group.data });
  const groupReady = Boolean(group.data);
  const messageKey = ["group-msgs", id] as const;
  type GroupMessage = Awaited<ReturnType<typeof fetchGroupMessages>>[number];
  type CachedGroupMessage = GroupMessage & { delivery_status?: "sending" | "failed" };
  const sendMessage = useMutation({
    mutationFn: ({ text }: { text: string; retryId?: string }) => {
      if (!user) throw new Error("Sign in to send a message");
      return sendGroupMessage({ group_id: id, author_id: user.id, body: text });
    },
    onMutate: async ({ text, retryId }) => {
      await qc.cancelQueries({ queryKey: messageKey });
      const optimisticId = retryId ?? `pending-${crypto.randomUUID()}`;
      const optimistic = {
        id: optimisticId,
        group_id: id,
        author_id: user!.id,
        body: text,
        created_at: new Date().toISOString(),
        attachment_url: null,
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

  const send = async () => {
    if (!user || !body.trim()) return;
    const text = body.trim();
    if (text.length > GROUP_MESSAGE_LIMIT) {
      toast.error(`Messages can be up to ${GROUP_MESSAGE_LIMIT.toLocaleString()} characters`);
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

  if (group.isLoading) return <div className="h-40 rounded-2xl skeleton-shimmer" />;
  if (!group.data) return (
    <div className="text-center py-20 glass rounded-3xl border border-white/5">
      <h2 className="font-display text-xl font-bold">Group not found</h2>
      <p className="text-sm text-muted-foreground mt-1">You may need an invite link to join.</p>
      <Link to="/groups" className="inline-block mt-4 text-sm text-[var(--rizz-pink)]">← Back to groups</Link>
    </div>
  );

  const g = group.data;
  const isOwner = user?.id === g.owner_id;
  const visibleMessages = [...olderMessages, ...(msgs.data ?? [])];

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div
        className="chat-bar relative z-20 flex shrink-0 items-center gap-3 border-b border-white/5 px-4 pb-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.5rem)" }}
      >
        <Link to="/groups"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="h-9 w-9 rounded-xl bg-gradient-primary flex items-center justify-center font-display font-bold shadow-glow shrink-0">
          {g.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold truncate flex items-center gap-1.5">{g.name} {isOwner && <Crown className="h-3.5 w-3.5 text-[var(--rizz-pink)]" />}</p>
          <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded-md bg-[var(--rizz-pink)]/15 text-[9px] font-bold uppercase tracking-wide text-[var(--rizz-pink)]">Private group</span>
            {g.member_count} member{g.member_count === 1 ? "" : "s"} · {g.topic || "No topic"}
          </p>
        </div>
        <Button onClick={makeInvite} variant="ghost" size="icon" aria-label="Invite" className="text-muted-foreground hover:text-foreground">
          <Link2 className="h-5 w-5" />
        </Button>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Members" className="text-muted-foreground hover:text-foreground"><Users className="h-5 w-5" /></Button>
          </SheetTrigger>
          <SheetContent className="glass-strong border-white/10">
            <SheetTitle className="font-display">Members</SheetTitle>
            <div className="mt-4 space-y-2">
              {(members.data ?? []).map((m: any) => (
                <Link key={m.user_id} to="/u/$username" params={{ username: m.user?.username ?? "" }} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5">
                  <Avatar className="h-9 w-9"><AvatarImage src={m.user?.avatar_url ?? undefined} /><AvatarFallback className="bg-gradient-primary font-bold text-xs">{(m.user?.username ?? "?").charAt(0).toUpperCase()}</AvatarFallback></Avatar>
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

        <div ref={messagesListRef} className="chat-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-2">
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
              <motion.div id={`msg-${m.id}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`flex min-w-0 items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                {!mine && (startsGroup ? (
                  <Avatar className="h-7 w-7 shrink-0"><AvatarImage src={m.author?.avatar_url ?? undefined} /><AvatarFallback className="bg-gradient-primary text-[10px] font-bold">{(m.author?.username ?? "?").charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                ) : <div aria-hidden="true" className="h-7 w-7 shrink-0" />)}
                <div className={`max-w-[78%] min-w-0 ${mine ? "items-end" : "items-start"} flex flex-col`}>
                  {!mine && startsGroup && <span className="mb-0.5 ml-3 max-w-full truncate text-[11px] text-muted-foreground">@{m.author?.username}</span>}
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
                    <div className={`chat-bubble w-fit max-w-[78%] [overflow-wrap:anywhere] px-4 py-2.5 rounded-2xl text-[15px] leading-relaxed whitespace-pre-wrap select-none touch-manipulation ${m.delivery_status ? "opacity-55" : ""} ${mine ? "bg-gradient-primary text-primary-foreground shadow-sm" : "border border-white/10 bg-[var(--surface-bubble)]"}`}>
                      {deletedAt ? "This message was unsent" : <GifContent>{m.body}</GifContent>}
                    </div>
                  </MessageActionMenu>
                  {m.delivery_status ? (
                    m.delivery_status === "failed" ? (
                      <button
                        onClick={() => sendMessage.mutate({ text: m.body, retryId: m.id })}
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
        <div className="mx-auto flex w-full max-w-3xl gap-2">
          <GifPicker onSelect={(marker) => setBody((current) => `${current}${current ? " " : ""}${marker}`.slice(0, GROUP_MESSAGE_LIMIT))} />
          <Textarea
            ref={composerRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
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
            className="min-h-11 max-h-40 resize-none overflow-y-hidden border-white/10 bg-black/20 py-3"
          />
          <Button onClick={() => void send()} disabled={!body.trim() || sendMessage.isPending} size="icon" className="bg-gradient-primary border-0 shadow-glow" aria-label={sendMessage.isPending ? "Sending message" : "Send message"}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="glass-strong border-white/10">
          <DialogTitle className="font-display text-xl">Invite to {g.name}</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">Friends-only · expires in 7 days. Recipients must mutually follow a current member.</p>
          <div className="mt-3 flex gap-2">
            <Input value={inviteUrl} readOnly className="glass border-white/10 font-mono text-xs" />
            <Button onClick={() => { navigator.clipboard.writeText(inviteUrl); toast.success("Copied"); }} size="icon" className="bg-gradient-primary border-0 shadow-glow"><Copy className="h-4 w-4" /></Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}