import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { fetchChannels, createChannel } from "@/lib/channels";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Hash, Megaphone, Gift, Users, Plus, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/channels")({
  head: () => ({ meta: [{ title: "Channels · RIZZ" }] }),
  component: ChannelsPage,
});

const TYPE_ICON = { text: Hash, announcement: Megaphone, drops: Gift };

function ChannelsPage() {
  const { user, profile } = useAuth();
  const channels = useQuery({ queryKey: ["channels"], queryFn: fetchChannels });
  const qc = useQueryClient();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [type, setType] = useState<"text" | "announcement" | "drops">("text");
  const [accent, setAccent] = useState("#ff2d92");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!user || !name.trim()) return;
    setCreating(true);
    try {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Math.random().toString(36).slice(2, 6);
      const c = await createChannel({ owner_id: user.id, name: name.trim(), slug, topic: topic.trim() || undefined, type, accent_color: accent });
      toast.success("Channel created");
      qc.invalidateQueries({ queryKey: ["channels"] });
      setOpen(false);
      setName(""); setTopic("");
      nav({ to: "/c/$slug", params: { slug: c.slug } });
    } catch (e: any) {
      toast.error(e.message);
    } finally { setCreating(false); }
  };

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Channels</h1>
          <p className="text-sm text-muted-foreground mt-1">Live spaces. Find your people.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary border-0 shadow-glow"><Plus className="h-4 w-4 mr-1" />New</Button>
          </DialogTrigger>
          <DialogContent className="glass-strong border-white/10">
            <DialogHeader><DialogTitle className="font-display">Create a channel</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Channel name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="glass border-white/10" />
              <Textarea placeholder="What's it about?" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={160} className="glass border-white/10 min-h-20" />
              <div className="flex gap-2">
                {(["text", "announcement", "drops"] as const).map((t) => {
                  const Icon = TYPE_ICON[t];
                  return (
                    <button key={t} onClick={() => setType(t)} className={`flex-1 p-3 rounded-xl border transition-all ${type === t ? "border-[var(--rizz-pink)] bg-[var(--rizz-pink)]/10" : "border-white/10 glass"}`}>
                      <Icon className="h-4 w-4 mx-auto mb-1" />
                      <span className="text-xs capitalize">{t}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs text-muted-foreground">Accent</label>
                <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-9 w-14 rounded-md bg-transparent border border-white/10" />
              </div>
              <Button onClick={handleCreate} disabled={creating || !name.trim()} className="w-full bg-gradient-primary border-0 shadow-glow">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create channel"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>

      {channels.isLoading && <div className="h-40 animate-pulse rounded-3xl glass" />}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {channels.data?.map((c: any) => {
          const Icon = TYPE_ICON[c.type as keyof typeof TYPE_ICON] ?? Hash;
          return (
            <Link key={c.id} to="/c/$slug" params={{ slug: c.slug }}>
              <motion.div whileHover={{ y: -2 }} className="glass rounded-3xl p-5 border border-white/5 h-full" style={{ boxShadow: `inset 0 0 0 1px ${c.accent_color}33` }}>
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-2xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${c.accent_color}, var(--rizz-violet))` }}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-bold text-lg leading-tight truncate">{c.name}</h3>
                    <p className="text-xs text-muted-foreground truncate">{c.topic || "—"}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  <span>{c.member_count} members</span>
                  <span className="ml-auto opacity-60">@{c.owner?.username}</span>
                </div>
              </motion.div>
            </Link>
          );
        })}
      </div>

      {channels.data?.length === 0 && (
        <div className="glass rounded-3xl p-10 text-center mt-4">
          <div className="text-5xl mb-3">🎧</div>
          <h2 className="font-display text-xl font-bold">No channels yet</h2>
          <p className="text-sm text-muted-foreground mt-1">Be the first to start one.</p>
        </div>
      )}
    </div>
  );
}
