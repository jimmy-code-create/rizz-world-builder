import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { Users, Plus, Link2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { listMyGroups, createGroup, acceptInvite, extractInviteCode } from "@/lib/groups";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/groups")({
  head: () => ({ meta: [{ title: "Groups · RIZZ" }] }),
  component: GroupsPage,
});

function GroupsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [openCreate, setOpenCreate] = useState(false);
  const [openJoin, setOpenJoin] = useState(false);
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [code, setCode] = useState("");

  const groups = useQuery({
    queryKey: ["my-groups", user?.id],
    queryFn: () => listMyGroups(user!.id),
    enabled: !!user,
  });

  const handleCreate = async () => {
    if (!user || !name.trim()) return;
    try {
      const g = await createGroup({ owner_id: user.id, name: name.trim(), topic: topic.trim() || undefined });
      toast.success("Group created");
      setOpenCreate(false); setName(""); setTopic("");
      qc.invalidateQueries({ queryKey: ["my-groups"] });
      nav({ to: "/g/$id", params: { id: g.id } });
    } catch (e: any) { toast.error(e.message); }
  };

  const handleJoin = async () => {
    if (!user || !code.trim()) return;
    try {
      const c = extractInviteCode(code);
      if (!c) throw new Error("Paste a valid group invite code or link.");
      const g = await acceptInvite(c);
      toast.success("Joined the group ✨");
      setOpenJoin(false); setCode("");
      qc.invalidateQueries({ queryKey: ["my-groups"] });
      if (g?.id) nav({ to: "/g/$id", params: { id: g.id } });
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-7 w-7 text-primary" /> Groups
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Private hangouts — invite link only, friends of a member.
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Want public, open rooms instead? Browse <Link to="/realms" className="text-primary font-medium">Realms</Link>.
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:flex sm:shrink-0">
          <Button variant="outline" className="glass min-h-11 rounded-xl border-sky-300/15 gap-2" onClick={() => setOpenJoin(true)}>
            <Link2 className="h-4 w-4" /> Join
          </Button>
          <Button className="min-h-11 rounded-xl border-0 bg-primary text-primary-foreground shadow-md gap-2" onClick={() => setOpenCreate(true)}>
            <Plus className="h-4 w-4" /> Create
          </Button>
        </div>
      </motion.div>

      {groups.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[0,1,2,3].map((i) => <div key={i} className="h-28 rounded-2xl skeleton-shimmer" />)}
        </div>
      ) : (groups.data ?? []).length === 0 ? (
        <div className="text-center py-20 glass rounded-3xl border border-sky-300/10 shadow-[0_16px_48px_rgba(37,99,235,.08)]">
          <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <h2 className="font-display text-xl font-bold">No groups yet</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-5">Create your first group or join one with an invite link.</p>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => setOpenCreate(true)} className="bg-primary text-primary-foreground border-0 shadow-md rounded-xl">Create a group</Button>
            <Button variant="outline" onClick={() => setOpenJoin(true)} className="glass border-white/10 rounded-xl">Join with link</Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {groups.data!.map((g) => (
            <button
              key={g.id}
              onClick={() => nav({ to: "/g/$id", params: { id: g.id } })}
              className="glass min-h-[92px] rounded-3xl border border-sky-300/10 p-4 shadow-[0_12px_36px_rgba(37,99,235,.06)] transition-all hover:-translate-y-0.5 hover:border-sky-300/25 hover:shadow-[0_14px_40px_rgba(37,99,235,.14)] flex items-center gap-3 text-left"
              style={{ ["--ec" as any]: g.accent_color ?? "#c9ff3d" }}
            >
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-700 flex items-center justify-center font-display font-bold text-lg shadow-[0_0_22px_rgba(59,130,246,.28)] ring-1 ring-white/15 shrink-0">
                {g.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-display font-bold truncate">{g.name}</h3>
                <p className="text-xs text-muted-foreground truncate">{g.topic || "No topic"}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{g.member_count} member{g.member_count === 1 ? "" : "s"}</p>
              </div>
              {g.is_voice_live && <span className="text-[10px] font-bold uppercase text-primary animate-pulse">● Live</span>}
            </button>
          ))}
        </div>
      )}

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="glass-strong border-white/10">
          <DialogTitle className="font-display text-xl">Create a group</DialogTitle>
          <div className="space-y-3 mt-2">
            <Input placeholder="Group name" value={name} onChange={(e) => setName(e.target.value)} className="glass border-white/10" />
            <Input placeholder="Topic (optional)" value={topic} onChange={(e) => setTopic(e.target.value)} className="glass border-white/10" />
            <Button onClick={handleCreate} disabled={!name.trim()} className="w-full bg-primary text-primary-foreground border-0 shadow-md">Create</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openJoin} onOpenChange={setOpenJoin}>
        <DialogContent className="glass-strong border-white/10">
          <DialogTitle className="font-display text-xl">Join with invite</DialogTitle>
          <div className="space-y-3 mt-2">
            <Input placeholder="Paste invite code or full link" value={code} onChange={(e) => setCode(e.target.value)} className="glass border-white/10" />
            <p className="text-xs text-muted-foreground">Friends-only: you must mutually follow at least one current member.</p>
            <Button onClick={handleJoin} disabled={!code.trim()} className="w-full bg-primary text-primary-foreground border-0 shadow-md">Join</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}