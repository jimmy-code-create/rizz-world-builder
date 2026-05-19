import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Hand, Mic, MicOff, PhoneOff, Radio } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { fetchRoom, fetchParticipants, joinRoom, leaveRoom, updateParticipant, endRoom } from "@/lib/voice";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/voice/$id")({
  head: () => ({ meta: [{ title: "Live Room · RIZZ" }] }),
  component: RoomPage,
});

function RoomPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const room = useQuery({ queryKey: ["voice-room", id], queryFn: () => fetchRoom(id) });
  const parts = useQuery({ queryKey: ["voice-parts", id], queryFn: () => fetchParticipants(id) });
  const [joined, setJoined] = useState(false);

  const me = parts.data?.find((p: any) => p.user_id === user?.id);
  const isHost = room.data?.host_id === user?.id;

  useEffect(() => {
    if (!user) return;
    if (!joined) {
      joinRoom(id, user.id).then(() => setJoined(true)).catch(() => {});
    }
    return () => {
      if (user) leaveRoom(id, user.id).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id]);

  useEffect(() => {
    const ch = supabase.channel(`voice-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "voice_participants", filter: `room_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["voice-parts", id] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "voice_rooms", filter: `id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["voice-room", id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  if (room.isLoading) return <div className="h-64 skeleton-shimmer rounded-3xl" />;
  if (!room.data) return <div className="text-center py-20"><h1 className="font-display text-2xl font-bold">Room not found</h1></div>;

  const r: any = room.data;
  if (!r.is_live) return (
    <div className="text-center py-20">
      <PhoneOff className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
      <h1 className="font-display text-2xl font-bold">Room ended</h1>
      <p className="text-sm text-muted-foreground mt-2">The host closed this room.</p>
      <Link to="/voice"><Button className="mt-5 bg-gradient-primary border-0 shadow-glow">Browse live rooms</Button></Link>
    </div>
  );

  const speakers = (parts.data ?? []).filter((p: any) => p.role !== "listener");
  const listeners = (parts.data ?? []).filter((p: any) => p.role === "listener");

  const toggleMute = () => me && user && updateParticipant(id, user.id, { muted: !me.muted });
  const toggleHand = () => me && user && updateParticipant(id, user.id, { hand_raised: !me.hand_raised });
  const promote = (uid: string) => updateParticipant(id, uid, { role: "speaker", muted: false, hand_raised: false });
  const leave = async () => {
    if (user) await leaveRoom(id, user.id);
    nav({ to: "/voice" });
  };
  const close = async () => {
    await endRoom(id);
    nav({ to: "/voice" });
  };

  return (
    <div className="-my-6 md:-my-10">
      <div className="sticky top-0 z-20 glass-strong border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <Link to="/voice"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--rizz-pink)] flex items-center gap-1">
              <Radio className="h-3 w-3 animate-pulse" /> LIVE
            </span>
            <h1 className="font-display font-bold text-lg leading-tight truncate">{r.title}</h1>
          </div>
          {r.topic && <p className="text-xs text-muted-foreground truncate">{r.topic}</p>}
        </div>
      </div>

      <div className="px-4 py-6 pb-32">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Speakers · {speakers.length}</h2>
        <div className="grid grid-cols-3 md:grid-cols-4 gap-4 mb-8">
          <AnimatePresence>
            {speakers.map((p: any) => (
              <motion.div key={p.user_id} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="flex flex-col items-center text-center">
                <div className="relative">
                  <Avatar className="h-16 w-16 ring-2" style={{ boxShadow: !p.muted ? `0 0 0 3px var(--rizz-pink), 0 0 20px var(--rizz-glow)` : `0 0 0 2px ${p.user?.accent_color || '#fff'}33` }}>
                    <AvatarImage src={p.user?.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-gradient-primary font-bold">{(p.user?.username ?? "?").charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  {p.muted && <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-destructive flex items-center justify-center border-2 border-background"><MicOff className="h-3 w-3" /></div>}
                  {p.role === "host" && <div className="absolute -top-1 -right-1 text-[10px] bg-[var(--rizz-pink)] text-primary-foreground px-1.5 rounded-full font-bold">HOST</div>}
                </div>
                <p className="text-xs font-bold mt-2 truncate w-full">@{p.user?.username}</p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Listeners · {listeners.length}</h2>
        <div className="grid grid-cols-5 md:grid-cols-8 gap-3">
          {listeners.map((p: any) => (
            <div key={p.user_id} className="flex flex-col items-center text-center">
              <div className="relative">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={p.user?.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-muted text-xs">{(p.user?.username ?? "?").charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                {p.hand_raised && <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-[var(--rizz-pink)] flex items-center justify-center animate-bounce"><Hand className="h-3 w-3" /></div>}
              </div>
              <p className="text-[10px] mt-1 truncate w-full">@{p.user?.username}</p>
              {isHost && p.hand_raised && (
                <button onClick={() => promote(p.user_id)} className="text-[10px] text-[var(--rizz-pink)] font-bold mt-0.5 hover:underline">Bring up</button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom controls */}
      <div className="fixed bottom-20 md:bottom-0 inset-x-0 md:left-64 z-20 p-4 glass-strong border-t border-white/5">
        <div className="max-w-md mx-auto flex items-center justify-center gap-3">
          {me?.role !== "listener" && me && (
            <Button onClick={toggleMute} size="lg" variant={me.muted ? "outline" : "default"} className={me.muted ? "glass border-white/10 rounded-full h-14 w-14 p-0" : "bg-gradient-primary border-0 shadow-glow rounded-full h-14 w-14 p-0"}>
              {me.muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
          )}
          {me?.role === "listener" && (
            <Button onClick={toggleHand} size="lg" variant={me.hand_raised ? "default" : "outline"} className={me.hand_raised ? "bg-gradient-primary border-0 shadow-glow rounded-full" : "glass border-white/10 rounded-full"}>
              <Hand className="h-5 w-5 mr-2" /> {me.hand_raised ? "Hand raised" : "Raise hand"}
            </Button>
          )}
          {isHost ? (
            <Button onClick={close} variant="outline" className="glass border-destructive/30 text-destructive rounded-full">
              <PhoneOff className="h-4 w-4 mr-2" /> End
            </Button>
          ) : (
            <Button onClick={leave} variant="outline" className="glass border-white/10 rounded-full">
              <PhoneOff className="h-4 w-4 mr-2" /> Leave
            </Button>
          )}
        </div>
        <p className="text-center text-[10px] text-muted-foreground mt-2">Audio streaming in beta · Mute state syncs live</p>
      </div>
    </div>
  );
}