import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Users, Link2, LogOut, Copy, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchGroup, fetchMembers, fetchGroupMessages, sendGroupMessage, createInvite, leaveGroup } from "@/lib/groups";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/g/$id")({
  head: () => ({ meta: [{ title: "Group · RIZZ" }] }),
  component: GroupRoom,
});

function GroupRoom() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [body, setBody] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const group = useQuery({ queryKey: ["group", id], queryFn: () => fetchGroup(id) });
  const members = useQuery({ queryKey: ["group-members", id], queryFn: () => fetchMembers(id), enabled: !!group.data });
  const msgs = useQuery({ queryKey: ["group-msgs", id], queryFn: () => fetchGroupMessages(id), enabled: !!group.data });

  useEffect(() => {
    if (!group.data) return;
    const ch = supabase.channel(`group-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["group-msgs", id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, group.data, qc]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.data]);

  const send = async () => {
    if (!user || !body.trim()) return;
    const text = body.trim();
    setBody("");
    try { await sendGroupMessage({ group_id: id, author_id: user.id, body: text }); }
    catch (e: any) { toast.error(e.message); }
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

  return (
    <div className="-my-6 md:-my-10">
      <div className="sticky top-0 z-20 glass-strong border-b border-white/5 px-4 py-3 flex items-center gap-3">
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

      <div className="px-4 py-4 min-h-[60vh] pb-32 space-y-2">
        <AnimatePresence initial={false}>
          {(msgs.data ?? []).map((m: any) => {
            const mine = m.author_id === user?.id;
            return (
              <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                {!mine && (
                  <Avatar className="h-7 w-7 shrink-0"><AvatarImage src={m.author?.avatar_url ?? undefined} /><AvatarFallback className="bg-gradient-primary text-[10px] font-bold">{(m.author?.username ?? "?").charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                )}
                <div className={`max-w-[85%] sm:max-w-[70%] min-w-0 ${mine ? "items-end" : "items-start"} flex flex-col`}>
                  {!mine && <span className="text-[11px] text-muted-foreground ml-3 mb-0.5">@{m.author?.username}</span>}
                  <div className={`px-4 py-2.5 rounded-2xl text-[15px] leading-relaxed whitespace-pre-wrap break-words ${mine ? "bg-gradient-primary text-primary-foreground shadow-glow" : "glass border border-white/10"}`}>{m.body}</div>
                  <span className="text-[10px] text-muted-foreground mt-0.5 px-2">
                    {new Date(m.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {(msgs.data ?? []).length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-12">Say hi to start the conversation 👋</p>
        )}
        <div ref={endRef} />
      </div>

      <div className="fixed bottom-20 md:bottom-0 inset-x-0 md:left-64 z-20 p-3 glass-strong border-t border-white/5">
        <div className="max-w-3xl mx-auto flex gap-2">
          <Input value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={`Message ${g.name}…`} maxLength={2000} className="glass border-white/10" />
          <Button onClick={send} disabled={!body.trim()} size="icon" className="bg-gradient-primary border-0 shadow-glow"><Send className="h-4 w-4" /></Button>
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