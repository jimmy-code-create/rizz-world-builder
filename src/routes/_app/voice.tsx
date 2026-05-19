import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Mic, Plus, Radio, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";
import { fetchLiveRooms, createRoom } from "@/lib/voice";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/voice")({
  head: () => ({ meta: [{ title: "Voice Rooms · RIZZ" }] }),
  component: VoicePage,
});

function VoicePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const rooms = useQuery({ queryKey: ["voice-rooms"], queryFn: fetchLiveRooms });

  useEffect(() => {
    const ch = supabase.channel("voice-rooms-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "voice_rooms" }, () => qc.invalidateQueries({ queryKey: ["voice-rooms"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight flex items-center gap-2">
            <Mic className="h-7 w-7 text-[var(--rizz-pink)]" /> Voice
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Live rooms. Talk, listen, drop in.</p>
        </div>
        {user && <CreateRoomDialog onCreated={(id) => nav({ to: "/voice/$id", params: { id } })} />}
      </motion.div>

      {rooms.isLoading && <div className="h-32 skeleton-shimmer rounded-3xl" />}

      <div className="grid gap-3 md:grid-cols-2">
        {rooms.data?.map((r: any) => (
          <Link key={r.id} to="/voice/$id" params={{ id: r.id }}>
            <motion.div whileHover={{ y: -3 }} className="glass rounded-3xl p-5 border border-white/5 hover:shadow-glow transition-all relative overflow-hidden">
              <div className="absolute top-3 right-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--rizz-pink)]">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--rizz-pink)] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--rizz-pink)]" />
                </span>
                LIVE
              </div>
              <h3 className="font-display font-bold text-lg leading-tight pr-12">{r.title}</h3>
              {r.topic && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.topic}</p>}
              <div className="flex items-center gap-2 mt-4">
                <Avatar className="h-8 w-8 ring-2 ring-[var(--rizz-pink)]/40">
                  <AvatarImage src={r.host?.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-gradient-primary text-xs font-bold">{(r.host?.username ?? "?").charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate">@{r.host?.username}</p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Users className="h-2.5 w-2.5" /> {r.listener_count} listening</p>
                </div>
                <Radio className="h-4 w-4 text-[var(--rizz-pink)] animate-pulse" />
              </div>
            </motion.div>
          </Link>
        ))}
      </div>

      {rooms.data?.length === 0 && (
        <div className="glass rounded-3xl p-10 text-center">
          <Mic className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <h2 className="font-display text-xl font-bold">No live rooms</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-5">Start one and see who drops in.</p>
          {user && <CreateRoomDialog onCreated={(id) => nav({ to: "/voice/$id", params: { id } })} />}
        </div>
      )}
    </div>
  );
}

function CreateRoomDialog({ onCreated }: { onCreated: (id: string) => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const create = async () => {
    if (!user || !title.trim()) return;
    setBusy(true);
    try {
      const room = await createRoom({ host_id: user.id, title: title.trim(), topic: topic.trim() || undefined });
      toast.success("Room is live 🎙️");
      setOpen(false);
      onCreated(room.id);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-primary border-0 shadow-glow"><Plus className="h-4 w-4 mr-1" /> Go live</Button>
      </DialogTrigger>
      <DialogContent className="glass-strong border-white/10">
        <DialogHeader><DialogTitle className="font-display">Start a voice room</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Room title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className="glass border-white/10" />
          <Input placeholder="Topic (optional)" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={140} className="glass border-white/10" />
          <Button onClick={create} disabled={busy || !title.trim()} className="w-full bg-gradient-primary border-0 shadow-glow">Launch 🎙️</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}