import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, Search, X, Check, Users, UsersRound, Camera, Loader2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { listMyGroups, type Group } from "@/lib/groups";
import { MAX_GROUP_PICKS, createGroupChat } from "@/lib/groups.functions";
import { squareImageFile } from "@/lib/image-square";
import { AvatarWithStatus, CustomStatusLine } from "@/components/presence/StatusDot";
import { publicCustomStatus, usePresenceMap } from "@/lib/presence";
import { RizzCat } from "@/components/RizzCat";

export const Route = createFileRoute("/_app/dms")({
  head: () => ({ meta: [{ title: "Messages · RIZZ" }] }),
  component: DMsPage,
});

const DOUBLE_TAP_MS = 280;

type Thread = {
  other: { id: string; username: string | null; display_name: string | null; avatar_url: string | null };
  last: { body: string | null; created_at: string };
  unread: number;
};

/** Chats deleted on this device are remembered here. */
const HIDDEN_DMS_KEY = "rizz:hidden-dms";

function fmtTime(iso: string) {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function DMsPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  /** Long-pressed inbox row — opens the profile/delete sheet for that person. */
  const [rowMenu, setRowMenu] = useState<{ id: string; username: string | null; display_name: string | null } | null>(null);
  /** Chats deleted on this device: hidden here, and the messages you sent are removed. */
  const [hiddenDms, setHiddenDms] = useState<string[]>(() => {
    if (typeof localStorage === "undefined") return [];
    try {
      const raw = localStorage.getItem(HIDDEN_DMS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  });
  const longPressTimer = useRef<number | null>(null);
  const suppressRowTap = useRef(false);

  const startLongPress = (other: { id: string; username: string | null; display_name: string | null }) => {
    if (selecting) return;
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      suppressRowTap.current = true;
      setRowMenu(other);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(12);
    }, 520);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
  };

  const deleteThread = async (other: { id: string; username: string | null }) => {
    if (!user) return;
    // Remove the half of the conversation that is yours…
    const { error } = await (supabase.from("direct_messages") as any)
      .update({ deleted_at: new Date().toISOString() })
      .eq("sender_id", user.id)
      .eq("recipient_id", other.id);
    if (error && !/deleted_at|schema cache/i.test(error.message ?? "")) {
      toast.error(error.message);
      return;
    }
    // …then keep the thread out of your inbox on this device.
    const next = [...new Set([...hiddenDms, other.id])];
    setHiddenDms(next);
    try {
      localStorage.setItem(HIDDEN_DMS_KEY, JSON.stringify(next));
    } catch {
      /* storage off — the messages are still deleted */
    }
    setRowMenu(null);
    await qc.invalidateQueries({ queryKey: ["dm-threads", user.id] });
    toast.success("Chat deleted");
  };
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [groupSheetOpen, setGroupSheetOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupPhoto, setGroupPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [creating, setCreating] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const navTimer = useRef<number | null>(null);
  const lastTap = useRef<{ id: string; at: number } | null>(null);

  const threads = useQuery({
    queryKey: ["dm-threads", user?.id],
    queryFn: async (): Promise<Thread[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("direct_messages")
        .select("*, sender:profiles!direct_messages_sender_id_fkey(id,username,display_name,avatar_url), recipient:profiles!direct_messages_recipient_id_fkey(id,username,display_name,avatar_url)")
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      // group by other party
      const map = new Map<string, Thread>();
      for (const m of data ?? []) {
        const other = m.sender_id === user.id ? m.recipient : m.sender;
        if (!other) continue;
        const e = map.get(other.id);
        const isUnread = m.recipient_id === user.id && !m.read;
        if (!e) map.set(other.id, { other, last: m, unread: isUnread ? 1 : 0 });
        else if (isUnread) e.unread += 1;
      }
      return Array.from(map.values());
    },
    enabled: !!user,
    retry: false,
  });

  const groups = useQuery({
    queryKey: ["my-groups", user?.id],
    queryFn: () => listMyGroups(user!.id),
    enabled: !!user,
    retry: false,
  });

  // One presence request for every conversation, kept fresh by realtime.
  const presence = usePresenceMap((threads.data ?? []).map((thread) => thread.other.id));

  // Realtime replaces the old 15s poll: the thread list now refreshes when a
  // message actually lands. Two channels because each only filters one column.
  useEffect(() => {
    if (!user) return;
    const refresh = () => qc.invalidateQueries({ queryKey: ["dm-threads", user.id] });
    const asSender = supabase
      .channel(`dm-threads-sent-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_messages", filter: `sender_id=eq.${user.id}` }, refresh)
      .subscribe();
    const asRecipient = supabase
      .channel(`dm-threads-received-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_messages", filter: `recipient_id=eq.${user.id}` }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(asSender);
      supabase.removeChannel(asRecipient);
    };
  }, [user, qc]);

  // Members see a new group in their DMs list the moment they're added.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`dms-groups-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_members", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["my-groups", user.id] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, qc]);

  // Leaving the page (or pressing back) cancels selection mode.
  useEffect(() => {
    if (!selecting) return;
    const cancel = () => { setSelecting(false); setSelected([]); };
    window.addEventListener("popstate", cancel);
    return () => window.removeEventListener("popstate", cancel);
  }, [selecting]);

  useEffect(() => () => {
    if (navTimer.current) window.clearTimeout(navTimer.current);
  }, []);

  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  const filtered = useMemo(() => {
    const list = threads.data ?? [];
    if (!q.trim()) return list;
    const t = q.toLowerCase();
    return list.filter(({ other }) =>
      other.username?.toLowerCase().includes(t) || other.display_name?.toLowerCase().includes(t),
    );
  }, [threads.data, q]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const exitSelection = () => {
    setSelecting(false);
    setSelected([]);
  };

  const toggleSelected = (userId: string) => {
    if (selected.includes(userId)) {
      const next = selected.filter((id) => id !== userId);
      setSelected(next);
      // Unselecting everyone leaves selection mode.
      if (!next.length) setSelecting(false);
      return;
    }
    if (selected.length >= MAX_GROUP_PICKS) {
      toast.error(`You can add up to ${MAX_GROUP_PICKS} members`);
      return;
    }
    setSelected([...selected, userId]);
  };

  const startSelecting = (userId: string) => {
    setSelecting(true);
    setSelected([userId]);
  };

  /** Double tap toggles selection mode; single tap still opens the conversation. */
  const handleRowTap = (other: Thread["other"]) => {
    if (selecting) {
      toggleSelected(other.id);
      return;
    }
    const now = Date.now();
    const isDoubleTap = lastTap.current?.id === other.id && now - lastTap.current.at < DOUBLE_TAP_MS;
    lastTap.current = { id: other.id, at: now };
    if (isDoubleTap) {
      if (navTimer.current) { window.clearTimeout(navTimer.current); navTimer.current = null; }
      lastTap.current = null;
      startSelecting(other.id);
      return;
    }
    if (navTimer.current) window.clearTimeout(navTimer.current);
    navTimer.current = window.setTimeout(() => {
      navTimer.current = null;
      nav({ to: "/dm/$userId", params: { userId: other.id } });
    }, DOUBLE_TAP_MS);
  };

  const pickGroupPhoto = async (file: File | undefined) => {
    if (!file) return;
    setPreparingPhoto(true);
    try {
      const squared = await squareImageFile(file, { label: "photo" });
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setGroupPhoto(squared);
      setPhotoPreview(URL.createObjectURL(squared));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't use that photo.");
    } finally {
      setPreparingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const createTheGroup = async () => {
    if (!user) return;
    const name = groupName.trim();
    if (!name) { toast.error("Give the group a name."); return; }
    if (selected.length < 2) { toast.error("Pick at least 2 people to start a group."); return; }
    setCreating(true);
    try {
      let iconUrl: string | null = null;
      if (groupPhoto) {
        const path = `${user.id}/group-icons/${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, groupPhoto, { contentType: groupPhoto.type || "image/jpeg", upsert: true, cacheControl: "31536000" });
        if (uploadError) throw uploadError;
        iconUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      }
      const group = await createGroupChat({ name, iconUrl, memberIds: selected });
      toast.success(`${group.name} is ready ✨`);
      qc.invalidateQueries({ queryKey: ["my-groups"] });
      setGroupSheetOpen(false);
      setGroupName("");
      setGroupPhoto(null);
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setPhotoPreview(null);
      exitSelection();
      nav({ to: "/g/$id", params: { id: group.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't create that group.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="pb-2">
      {selecting ? (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 flex items-center gap-2 rounded-2xl glass border border-white/10 p-2"
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={exitSelection}
            aria-label="Cancel selection"
            className="h-12 w-12 shrink-0 rounded-xl"
          >
            <X className="h-5 w-5" />
          </Button>
          <span className="min-w-0 flex-1 text-sm font-semibold">
            {selected.length} selected <span className="font-normal text-muted-foreground">(max {MAX_GROUP_PICKS})</span>
          </span>
          <Button
            onClick={() => setGroupSheetOpen(true)}
            disabled={selected.length < 2}
            className="min-h-12 shrink-0 rounded-xl border-0 bg-gradient-primary shadow-glow px-4"
          >
            <UsersRound className="h-4 w-4" /> Create group
          </Button>
        </motion.div>
      ) : (
        <>
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-3xl font-bold tracking-tight mb-1">Messages</h1>
              <p className="text-sm text-muted-foreground">Slide in those DMs.</p>
            </div>
            <Button
              variant="outline"
              onClick={() => setGroupSheetOpen(true)}
              className="glass border-white/10 min-h-12 rounded-xl gap-2 shrink-0"
            >
              <Plus className="h-4 w-4" /> New group
            </Button>
          </motion.div>
          <p className="mt-2 mb-4 text-xs text-muted-foreground/80">Double tap a conversation to pick people and start a group.</p>
        </>
      )}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search conversations…" className="pl-9 glass border-white/10" />
      </div>

      {!selecting && (groups.data ?? []).length > 0 && (
        <div className="mb-5">
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Groups</h2>
          <div className="space-y-2">
            {(groups.data ?? []).map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => nav({ to: "/g/$id", params: { id: g.id } })}
                className="glass w-full rounded-2xl p-4 border border-white/5 flex items-center gap-3 text-left transition-colors hover:border-white/15"
              >
                <GroupAvatar group={g} />
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{g.name}</p>
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    <Users className="h-3 w-3 shrink-0" /> {g.member_count} member{g.member_count === 1 ? "" : "s"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {threads.isError && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-muted-foreground">
            Messages couldn’t load. Check your connection, then refresh to try again.
          </div>
        )}
        {threads.isPending && !threads.isError && (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
          </div>
        )}
        {filtered.filter(({ other }) => !hiddenDms.includes(other.id)).map(({ other, last, unread }) => {
          const isSelected = selectedSet.has(other.id);
          const peerStatus = publicCustomStatus(presence.rows[other.id], false);
          return (
            <Fragment key={other.id}>
            <button
              type="button"
              onClick={() => {
                if (suppressRowTap.current) {
                  suppressRowTap.current = false;
                  return;
                }
                handleRowTap(other);
              }}
              onPointerDown={() => startLongPress(other)}
              onPointerUp={cancelLongPress}
              onPointerMove={cancelLongPress}
              onPointerLeave={cancelLongPress}
              onContextMenu={(event) => {
                event.preventDefault();
                setRowMenu(other);
              }}
              aria-pressed={selecting ? isSelected : undefined}
              className={`glass w-full min-h-12 rounded-2xl p-4 border flex items-center gap-3 text-left transition-colors ${
                isSelected
                  ? "border-[var(--rizz-pink)]/60 shadow-glow"
                  : unread > 0
                    ? "border-[var(--rizz-pink)]/30 shadow-glow"
                    : "border-white/5 hover:border-white/15"
              }`}
            >
              <div className="relative shrink-0">
                <AvatarWithStatus status={presence.statusOf(other.id)} dotSize={12}>
                  <Avatar className={`h-12 w-12 ring-2 ${isSelected ? "ring-[var(--rizz-pink)]" : "ring-[var(--rizz-pink)]/40"}`}>
                    <AvatarImage src={other.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-gradient-primary font-bold">{(other.username ?? "?").charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </AvatarWithStatus>
                {isSelected && (
                  <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-[var(--rizz-pink)] text-white ring-2 ring-background">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate">{other.display_name || other.username}</p>
                {peerStatus && (
                  <CustomStatusLine status={peerStatus} className="text-[11px] text-[var(--rizz-pink)]/90" />
                )}
                <p className={`text-xs truncate ${unread > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>{last.body}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-[10px] text-muted-foreground">{fmtTime(last.created_at)}</span>
                {unread > 0 && (
                  <span className="text-[10px] font-bold bg-[var(--rizz-pink)] text-white px-1.5 py-0.5 rounded-full min-w-5 text-center">{unread}</span>
                )}
              </div>
            </button>
            <Sheet
              open={rowMenu?.id === other.id}
              onOpenChange={(nextOpen) => {
                if (!nextOpen) setRowMenu(null);
              }}
            >
              <SheetContent
                side="bottom"
                className="glass-strong border-white/10 rounded-t-3xl pb-[max(env(safe-area-inset-bottom),1rem)]"
              >
                <SheetHeader className="text-left">
                  <SheetTitle className="font-display text-lg">
                    {other.display_name || other.username}
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-4 space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      const target = other.username;
                      setRowMenu(null);
                      if (target) nav({ to: "/u/$username", params: { username: target } });
                    }}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-sm font-semibold transition hover:bg-white/[0.08]"
                  >
                    View profile
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteThread(other)}
                    className="w-full rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-left text-sm font-semibold text-destructive transition hover:bg-destructive/20"
                  >
                    Delete chat
                  </button>
                  <p className="px-1 pt-1 text-[11px] text-muted-foreground">
                    Deleting removes the messages you sent and hides this chat from your inbox.
                  </p>
                </div>
              </SheetContent>
            </Sheet>
            </Fragment>
          );
        })}
      </div>

      {!threads.isError && !threads.isPending && filtered.length === 0 && (
        <div className="glass rounded-3xl p-8 text-center">
          <RizzCat mood={q ? "searching" : "peek"} size={112} className="mx-auto mb-1" />
          <p className="text-sm text-muted-foreground">{q ? "No matches." : "No conversations yet. Go say hi from someone's profile."}</p>
        </div>
      )}

      <Sheet open={groupSheetOpen} onOpenChange={setGroupSheetOpen}>
        <SheetContent
          side="bottom"
          className="glass-strong border-white/10 rounded-t-3xl pb-[max(env(safe-area-inset-bottom),1rem)]"
        >
          <SheetHeader className="text-left">
            <SheetTitle className="font-display text-xl">New group</SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-5">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="relative h-16 w-16 shrink-0 rounded-2xl overflow-hidden glass border border-white/10 grid place-items-center"
                aria-label="Add a group photo"
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="Group photo preview" className="h-full w-full object-cover" />
                ) : preparingPhoto ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <Camera className="h-5 w-5 text-muted-foreground" />
                )}
              </button>
              <div className="min-w-0">
                <p className="text-sm font-medium">Group photo <span className="text-muted-foreground">(optional)</span></p>
                <p className="text-xs text-muted-foreground">Square crop, compressed before upload.</p>
                {photoPreview && (
                  <button
                    type="button"
                    onClick={() => { if (photoPreview) URL.revokeObjectURL(photoPreview); setPhotoPreview(null); setGroupPhoto(null); }}
                    className="mt-1 text-xs font-medium text-[var(--rizz-pink)]"
                  >
                    Remove photo
                  </button>
                )}
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void pickGroupPhoto(e.target.files?.[0])}
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground" htmlFor="group-name">Group name</label>
              <Input
                id="group-name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value.slice(0, 40))}
                placeholder="e.g. The Group Chat"
                className="mt-1 glass border-white/10"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">{groupName.trim() ? `${groupName.trim().length}/40` : "Required"}</p>
            </div>

            <div className="rounded-2xl glass border border-white/5 p-3">
              <p className="text-xs text-muted-foreground">
                {selected.length} selected ({selected.length}/{MAX_GROUP_PICKS}) · needs at least 2
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selected.map((id) => {
                  const person = (threads.data ?? []).find((t) => t.other.id === id)?.other;
                  return (
                    <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 pl-1 pr-2 py-1 text-xs">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={person?.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-gradient-primary text-[9px] font-bold">
                          {(person?.username ?? "?").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="max-w-24 truncate">{person?.display_name || person?.username || "Member"}</span>
                    </span>
                  );
                })}
              </div>
            </div>

            <Button
              onClick={() => void createTheGroup()}
              disabled={creating || preparingPhoto || !groupName.trim() || selected.length < 2}
              className="w-full min-h-12 rounded-xl border-0 bg-gradient-primary shadow-glow"
            >
              {creating ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</> : "Create group"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function GroupAvatar({ group }: { group: Group }) {
  return (
    <div className="h-12 w-12 shrink-0 rounded-2xl overflow-hidden bg-gradient-to-br from-sky-400 to-blue-700 grid place-items-center font-display font-bold text-lg ring-1 ring-white/15">
      {group.icon_url ? (
        <img src={group.icon_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : (
        group.name.charAt(0).toUpperCase()
      )}
    </div>
  );
}
