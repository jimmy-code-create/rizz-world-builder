import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Volume2, MonitorUp, Hand } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/call/$userId")({
  head: () => ({ meta: [{ title: "Call · RIZZ" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ video: s.video === "1" || s.video === true }),
  component: CallPage,
});

function CallPage() {
  const { userId } = Route.useParams();
  const { video } = Route.useSearch();
  const nav = useNavigate();
  const [muted, setMuted] = useState(false);
  const [cam, setCam] = useState(video);
  const [speaker, setSpeaker] = useState(true);
  const [hand, setHand] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [status, setStatus] = useState<"ringing" | "connected">("ringing");

  const other = useQuery({
    queryKey: ["profile-id", userId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    const t1 = setTimeout(() => setStatus("connected"), 1800);
    return () => clearTimeout(t1);
  }, []);

  useEffect(() => {
    if (status !== "connected") return;
    const i = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(i);
  }, [status]);

  const hh = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const time = seconds >= 3600 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;

  const end = () => {
    toast("Call ended");
    nav({ to: "/dm/$userId", params: { userId } });
  };

  return (
    <div className="fixed inset-0 z-40 bg-gradient-to-br from-[#1a0820] via-[#0b0b15] to-black text-white flex flex-col">
      <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(60% 50% at 50% 30%, rgba(255,45,146,0.35), transparent 60%)" }} />

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center">
        <motion.div
          animate={status === "ringing" ? { scale: [1, 1.06, 1] } : { scale: 1 }}
          transition={{ duration: 1.4, repeat: status === "ringing" ? Infinity : 0 }}
          className="relative"
        >
          {status === "ringing" && (
            <>
              <span className="absolute inset-0 rounded-full bg-[var(--rizz-pink)]/30 animate-ping" />
              <span className="absolute inset-0 rounded-full bg-[var(--rizz-pink)]/20 animate-ping [animation-delay:300ms]" />
            </>
          )}
          <Avatar className="h-36 w-36 ring-4 ring-white/20 shadow-2xl relative">
            <AvatarImage src={other.data?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-gradient-primary text-4xl font-bold">
              {(other.data?.username ?? "?").charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </motion.div>
        <h1 className="mt-6 text-3xl font-black">{other.data?.display_name || other.data?.username}</h1>
        <p className="text-sm text-white/60 mt-1">@{other.data?.username}</p>
        <p className="mt-4 text-sm text-white/80">
          {status === "ringing" ? (cam ? "Ringing video call…" : "Ringing voice call…") : (
            <>
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 mr-1.5 align-middle animate-pulse" />
              Connected · {time}
            </>
          )}
        </p>
        {hand && <p className="mt-2 text-xs text-yellow-300">✋ Hand raised</p>}
      </div>

      <div className="relative z-10 pb-10 px-4">
        <div className="max-w-md mx-auto glass-strong rounded-3xl p-3 border border-white/10 flex items-center justify-around">
          <CtrlBtn active={!muted} on={<Mic />} off={<MicOff />} onClick={() => setMuted((m) => !m)} label={muted ? "Unmute" : "Mute"} />
          <CtrlBtn active={cam} on={<Video />} off={<VideoOff />} onClick={() => setCam((c) => !c)} label={cam ? "Video on" : "Video off"} />
          <CtrlBtn active={speaker} on={<Volume2 />} off={<Volume2 className="opacity-50" />} onClick={() => setSpeaker((s) => !s)} label="Speaker" />
          <CtrlBtn active={hand} on={<Hand />} off={<Hand />} onClick={() => setHand((h) => !h)} label="Hand" />
          <CtrlBtn active={false} on={<MonitorUp />} off={<MonitorUp />} onClick={() => toast("Screen share requested")} label="Share" />
          <button
            onClick={end}
            aria-label="End call"
            className="h-14 w-14 rounded-full bg-red-500 hover:bg-red-600 grid place-items-center shadow-lg shadow-red-500/40 transition-transform active:scale-95"
          >
            <PhoneOff className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  );
}

function CtrlBtn({ active, on, off, onClick, label }: { active: boolean; on: React.ReactNode; off: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`h-12 w-12 rounded-full grid place-items-center transition-all active:scale-95 ${
        active ? "bg-white/15 text-white" : "bg-white/5 text-white/60"
      }`}
    >
      {active ? on : off}
    </button>
  );
}