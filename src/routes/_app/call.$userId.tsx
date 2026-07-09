import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Volume2, MonitorUp, Hand, SwitchCamera } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/call/$userId")({
  head: () => ({ meta: [{ title: "Call · RIZZ" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ video: s.video === "1" || s.video === true }),
  component: CallPage,
});

const ICE: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

function CallPage() {
  const { userId } = Route.useParams();
  const { video } = Route.useSearch();
  const { user } = useAuth();
  const nav = useNavigate();

  const [muted, setMuted] = useState(false);
  const [cam, setCam] = useState<boolean>(!!video);
  const [speaker, setSpeaker] = useState(true);
  const [hand, setHand] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [seconds, setSeconds] = useState(0);
  const [status, setStatus] = useState<"ringing" | "connected" | "ended">("ringing");
  const [remoteHasVideo, setRemoteHasVideo] = useState(false);
  const [level, setLevel] = useState(0); // 0..1 local mic level

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const other = useQuery({
    queryKey: ["profile-id", userId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      return data;
    },
  });

  // Local media + peer connection + signaling
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const meId = user.id;
    const isCaller = meId < userId; // deterministic role
    const roomId = [meId, userId].sort().join("_");

    const pc = new RTCPeerConnection({ iceServers: ICE });
    pcRef.current = pc;
    const remote = new MediaStream();
    remoteStreamRef.current = remote;

    pc.ontrack = (e) => {
      e.streams[0]?.getTracks().forEach((t) => remote.addTrack(t));
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remote;
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remote;
      setRemoteHasVideo(remote.getVideoTracks().some((t) => t.enabled));
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") setStatus("connected");
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        toast("Connection lost");
      }
    };

    const ch = supabase.channel(`call:${roomId}`, {
      config: {
        broadcast: { self: false, ack: false },
        presence: { key: meId },
      },
    });
    chRef.current = ch;

    pc.onicecandidate = (e) => {
      if (e.candidate) ch.send({ type: "broadcast", event: "ice", payload: { from: meId, candidate: e.candidate.toJSON() } });
    };

    ch
      .on("broadcast", { event: "offer" }, async ({ payload }) => {
        if (payload.from === meId) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          const ans = await pc.createAnswer();
          await pc.setLocalDescription(ans);
          ch.send({ type: "broadcast", event: "answer", payload: { from: meId, sdp: ans } });
        } catch (err) { console.warn("offer handling failed", err); }
      })
      .on("broadcast", { event: "answer" }, async ({ payload }) => {
        if (payload.from === meId) return;
        try {
          if (pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          }
        } catch (err) { console.warn("answer handling failed", err); }
      })
      .on("broadcast", { event: "ice" }, async ({ payload }) => {
        if (payload.from === meId) return;
        try { await pc.addIceCandidate(payload.candidate); } catch { /* ignore */ }
      })
      .on("broadcast", { event: "bye" }, () => {
        toast("Call ended by peer");
        cleanup();
        nav({ to: "/dm/$userId", params: { userId } });
      })
      .on("presence", { event: "sync" }, async () => {
        // Both peers present → caller sends offer once
        const state = ch.presenceState() as Record<string, unknown>;
        const hasPeer = Object.keys(state).some((k) => k !== meId);
        if (isCaller && hasPeer && pc.signalingState === "stable" && !pc.currentLocalDescription) {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            ch.send({ type: "broadcast", event: "offer", payload: { from: meId, sdp: offer } });
          } catch (err) { console.warn("offer create failed", err); }
        }
      });

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
          video: video ? { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } } : false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        // Mic level meter
        try {
          const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
          const ac: AudioContext = new AC();
          audioCtxRef.current = ac;
          const src = ac.createMediaStreamSource(stream);
          const an = ac.createAnalyser(); an.fftSize = 256;
          src.connect(an);
          const buf = new Uint8Array(an.frequencyBinCount);
          const tick = () => {
            an.getByteTimeDomainData(buf);
            let sum = 0;
            for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
            setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 3));
            rafRef.current = requestAnimationFrame(tick);
          };
          tick();
        } catch { /* ignore */ }

        await ch.subscribe(async (st) => {
          if (st === "SUBSCRIBED") {
            await ch.track({ id: meId, at: Date.now() });
          }
        });
      } catch (e: any) {
        toast.error(e?.message?.includes("Permission") ? "Mic/camera permission denied" : (e?.message ?? "Could not start call"));
      }
    })();

    function cleanup() {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      audioCtxRef.current?.close().catch(() => {});
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      remoteStreamRef.current?.getTracks().forEach((t) => t.stop());
      pc.getSenders().forEach((s) => { try { pc.removeTrack(s); } catch {} });
      pc.close();
      supabase.removeChannel(ch);
    }

    return () => {
      cancelled = true;
      try { ch.send({ type: "broadcast", event: "bye", payload: { from: meId } }); } catch {}
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, userId]);

  // Toggle mic
  useEffect(() => {
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !muted));
  }, [muted]);

  // Toggle camera (enable/disable existing video tracks; add if none)
  useEffect(() => {
    (async () => {
      const s = localStreamRef.current; const pc = pcRef.current;
      if (!s || !pc) return;
      const vids = s.getVideoTracks();
      if (cam && vids.length === 0) {
        try {
          const extra = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } });
          const track = extra.getVideoTracks()[0];
          s.addTrack(track);
          pc.addTrack(track, s);
          if (localVideoRef.current) localVideoRef.current.srcObject = s;
          // renegotiate
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          chRef.current?.send({ type: "broadcast", event: "offer", payload: { from: user?.id, sdp: offer } });
        } catch (e: any) { toast.error("Couldn't turn on camera"); }
      } else {
        vids.forEach((t) => (t.enabled = cam));
      }
    })();
  }, [cam, facing, user?.id]);

  // Speaker
  useEffect(() => {
    if (remoteAudioRef.current) remoteAudioRef.current.muted = !speaker;
    if (remoteVideoRef.current) remoteVideoRef.current.muted = !speaker;
  }, [speaker]);

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
    try { chRef.current?.send({ type: "broadcast", event: "bye", payload: { from: user?.id } }); } catch {}
    toast("Call ended");
    nav({ to: "/dm/$userId", params: { userId } });
  };

  const flipCam = async () => setFacing((f) => (f === "user" ? "environment" : "user"));

  return (
    <div className="fixed inset-0 z-40 bg-gradient-to-br from-[#1a0820] via-[#0b0b15] to-black text-white flex flex-col">
      <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(60% 50% at 50% 30%, rgba(255,45,146,0.35), transparent 60%)" }} />

      {/* Remote video fills when available */}
      {cam || remoteHasVideo ? (
        <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 h-full w-full object-cover opacity-90" />
      ) : null}
      <audio ref={remoteAudioRef} autoPlay />

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center">
        {!remoteHasVideo && (
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
            <span
              className="absolute -inset-3 rounded-full pointer-events-none transition-opacity"
              style={{ boxShadow: `0 0 ${20 + level * 60}px ${4 + level * 10}px rgba(255,45,146,${0.15 + level * 0.4})`, opacity: muted ? 0 : 1 }}
            />
            <Avatar className="h-36 w-36 ring-4 ring-white/20 shadow-2xl relative">
              <AvatarImage src={other.data?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-gradient-primary text-4xl font-bold">
                {(other.data?.username ?? "?").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </motion.div>
        )}
        <h1 className={`mt-6 text-3xl font-black ${remoteHasVideo ? "drop-shadow-lg" : ""}`}>{other.data?.display_name || other.data?.username}</h1>
        <p className="text-sm text-white/70 mt-1">@{other.data?.username}</p>
        <p className="mt-4 text-sm text-white/90">
          {status === "ringing" ? (cam ? "Ringing video call…" : "Ringing voice call…") : (
            <>
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 mr-1.5 align-middle animate-pulse" />
              Connected · {time}
            </>
          )}
        </p>
        {hand && <p className="mt-2 text-xs text-yellow-300">✋ Hand raised</p>}
      </div>

      {/* Local self-view PiP */}
      {cam && (
        <div className="absolute top-4 right-4 z-20 h-40 w-28 rounded-2xl overflow-hidden border border-white/20 shadow-2xl bg-black">
          <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full object-cover scale-x-[-1]" />
          <button onClick={flipCam} className="absolute bottom-1 right-1 h-7 w-7 rounded-full bg-black/60 grid place-items-center">
            <SwitchCamera className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

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