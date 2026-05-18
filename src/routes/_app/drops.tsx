import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Gift, Plus, Timer, Loader2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/drops")({
  head: () => ({ meta: [{ title: "Drops · RIZZ" }] }),
  component: DropsPage,
});

function DropsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const drops = useQuery({
    queryKey: ["drops"],
    queryFn: async () => {
      const { data } = await supabase
        .from("drops")
        .select("*, creator:profiles!drops_creator_id_fkey(username,display_name,avatar_url)")
        .gt("expires_at", new Date().toISOString())
        .order("expires_at");
      return data ?? [];
    },
  });
  const myClaims = useQuery({
    queryKey: ["my-claims", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("drop_claims").select("drop_id").eq("user_id", user!.id);
      return new Set((data ?? []).map((r) => r.drop_id));
    },
    enabled: !!user,
  });

  useEffect(() => {
    const ch = supabase.channel("drops-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "drops" }, () => qc.invalidateQueries({ queryKey: ["drops"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "drop_claims" }, () => {
        qc.invalidateQueries({ queryKey: ["drops"] });
        qc.invalidateQueries({ queryKey: ["my-claims"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const claim = async (dropId: string) => {
    if (!user) return;
    const { error } = await supabase.from("drop_claims").insert({ drop_id: dropId, user_id: user.id });
    if (error) toast.error(error.message);
    else toast.success("Claimed! 🎁");
  };

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight flex items-center gap-2">
            <Gift className="h-7 w-7 text-[var(--rizz-pink)]" /> Drops
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Limited. Fast. Don't sleep.</p>
        </div>
        <CreateDropDialog />
      </motion.div>

      {drops.isLoading && <div className="h-40 animate-pulse rounded-3xl glass" />}

      <div className="space-y-3">
        {drops.data?.map((d: any) => {
          const claimed = myClaims.data?.has(d.id);
          const soldOut = d.claim_count >= d.claim_limit;
          const pct = Math.min(100, (d.claim_count / d.claim_limit) * 100);
          return (
            <motion.div key={d.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-3xl overflow-hidden border border-white/5">
              {d.media_url && (
                <div className="aspect-video bg-black overflow-hidden">
                  <img src={d.media_url} alt={d.title} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-5">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-bold text-xl">{d.title}</h3>
                    {d.description && <p className="text-sm text-muted-foreground mt-1">{d.description}</p>}
                    <p className="text-xs text-muted-foreground mt-2">by @{d.creator?.username}</p>
                  </div>
                  <Countdown to={d.expires_at} />
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">{d.claim_count} / {d.claim_limit} claimed</span>
                    <span className="font-bold" style={{ color: pct > 90 ? "var(--rizz-pink)" : undefined }}>{Math.round(pct)}%</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <Button
                  onClick={() => claim(d.id)}
                  disabled={claimed || soldOut || !user}
                  className={`w-full mt-4 ${claimed || soldOut ? "glass border border-white/10" : "bg-gradient-primary border-0 shadow-glow"}`}
                  variant={claimed || soldOut ? "outline" : "default"}
                >
                  {claimed ? "✓ Claimed" : soldOut ? "Sold out" : <><Sparkles className="h-4 w-4 mr-1" /> Claim now</>}
                </Button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {drops.data?.length === 0 && (
        <div className="glass rounded-3xl p-10 text-center">
          <div className="text-5xl mb-3">🎁</div>
          <h2 className="font-display text-xl font-bold">No active drops</h2>
          <p className="text-sm text-muted-foreground mt-1">Create one and watch the rush.</p>
        </div>
      )}
    </div>
  );
}

function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, new Date(to).getTime() - now);
  const h = Math.floor(diff / 3.6e6);
  const m = Math.floor((diff % 3.6e6) / 6e4);
  const s = Math.floor((diff % 6e4) / 1000);
  return (
    <div className="glass border border-[var(--rizz-pink)]/30 rounded-xl px-3 py-1.5 font-mono text-xs font-bold flex items-center gap-1 shrink-0" style={{ boxShadow: "0 0 12px hsl(330 90% 60% / 0.3)" }}>
      <Timer className="h-3 w-3 text-[var(--rizz-pink)]" />
      {h > 0 ? `${h}h ${m}m` : `${m}:${String(s).padStart(2, "0")}`}
    </div>
  );
}

function CreateDropDialog() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [limit, setLimit] = useState(100);
  const [hours, setHours] = useState(24);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const create = async () => {
    if (!user || !title.trim()) return;
    setBusy(true);
    try {
      let media_url: string | null = null;
      if (file) {
        const path = `${user.id}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("drops").upload(path, file);
        if (upErr) throw upErr;
        media_url = supabase.storage.from("drops").getPublicUrl(path).data.publicUrl;
      }
      const expires_at = new Date(Date.now() + hours * 3.6e6).toISOString();
      const { error } = await supabase.from("drops").insert({ creator_id: user.id, title: title.trim(), description: desc.trim() || null, claim_limit: limit, expires_at, media_url });
      if (error) throw error;
      toast.success("Drop is live 🚀");
      qc.invalidateQueries({ queryKey: ["drops"] });
      setOpen(false); setTitle(""); setDesc(""); setFile(null);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-primary border-0 shadow-glow"><Plus className="h-4 w-4 mr-1" />Drop</Button>
      </DialogTrigger>
      <DialogContent className="glass-strong border-white/10">
        <DialogHeader><DialogTitle className="font-display">New drop</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} className="glass border-white/10" />
          <Textarea placeholder="Hype it up" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={280} className="glass border-white/10" />
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <Button variant="outline" onClick={() => fileRef.current?.click()} className="w-full glass border-white/10">
            {file ? `📎 ${file.name}` : "Add image (optional)"}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Claim limit</label>
              <Input type="number" value={limit} onChange={(e) => setLimit(+e.target.value)} min={1} max={10000} className="glass border-white/10" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Duration (hrs)</label>
              <Input type="number" value={hours} onChange={(e) => setHours(+e.target.value)} min={1} max={168} className="glass border-white/10" />
            </div>
          </div>
          <Button onClick={create} disabled={busy || !title.trim()} className="w-full bg-gradient-primary border-0 shadow-glow">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Launch drop"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
