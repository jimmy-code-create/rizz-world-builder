import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Volume2, MonitorUp, Hand, SwitchCamera, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { FullScreenLayer } from "@/components/FullScreenLayer";
import { notifyInApp } from "@/lib/notifications";

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
  const [sendingInvite, setSendingInvite] = useState(false);
  const [remoteHasVideo, setRemoteHasVideo] = useState(false);
  const [level, setLevel] = useState(0); // 0..1 local mic level
  const [peerPresent, setPeerPresent] = useState(false);
  const [connectionHint, setConnectionHint] = useState("Preparing your microphone…");
  const [callProblem, setCallProblem] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

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
    let offerInProgress = false;
    pendingIceCandidatesRef.current = [];
    setPeerPresent(false);
    setCallProblem(null);

    const pc = new RTCPeerConnection({ iceServers: ICE });
    pcRef.current = pc;
    const remote = new MediaStream();
    remoteStreamRef.current = remote;

    pc.ontrack = (e) => {
      const tracks = e.streams[0]?.getTracks() ?? [e.track];
      tracks.forEach((t) => {
        if (!remote.getTracks().some((existing) => existing.id === t.id)) remote.addTrack(t);
      });
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remote;
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remote;
      setRemoteHasVideo(remote.getVideoTracks().some((t) => t.enabled));
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setStatus("connected");
        setConnectionHint("Call connected");
        setCallProblem(null);
      }
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        setConnectionHint(
          pc.connectionState === "failed"
            ? "The network could not connect this call."
            : "The connection dropped. Trying to reconnect…",
        );
        if (pc.connectionState === "failed") {
          setCallProblem("Check both internet connections and allow WebRTC/UDP traffic. This app has no TURN relay, so some Wi-Fi, VPN, and mobile networks cannot connect calls.");
          toast.error("Call connection failed. See the troubleshooting message on screen.");
        }
      }
    };
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        setStatus("connected");
        setConnectionHint("Call connected");
        setCallProblem(null);
      }
      if (pc.iceConnectionState === "failed") {
        setConnectionHint("The two devices could not establish a direct network connection.");
        setCallProblem("This app currently uses STUN only and has no TURN relay. Some routers, VPNs, and mobile networks require TURN. Try switching networks; reliable support on restrictive networks needs a TURN service.");
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
      if (e.candidate) {
        void ch.send({ type: "broadcast", event: "ice", payload: { from: meId, candidate: e.candidate.toJSON() } });
      }
    };

    const applyPendingIceCandidates = async () => {
      const candidates = pendingIceCandidatesRef.current.splice(0);
      for (const candidate of candidates) {
        try {
          await pc.addIceCandidate(candidate);
        } catch (err) {
          console.warn("queued ICE candidate failed", err);
        }
      }
    };

    ch
      .on("broadcast", { event: "offer" }, async ({ payload }) => {
        if (payload.from === meId) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          await applyPendingIceCandidates();
          const ans = await pc.createAnswer();
          await pc.setLocalDescription(ans);
          const result = await ch.send({ type: "broadcast", event: "answer", payload: { from: meId, sdp: ans } });
          if (result !== "ok") setCallProblem("The call reply could not reach the other person. Check your connection and try again.");
        } catch (err) {
          console.warn("offer handling failed", err);
          setCallProblem("The call setup message could not be processed. Try ending the call and calling again.");
        }
      })
      .on("broadcast", { event: "answer" }, async ({ payload }) => {
        if (payload.from === meId) return;
        try {
          if (pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            await applyPendingIceCandidates();
          }
        } catch (err) {
          console.warn("answer handling failed", err);
          setCallProblem("The other person's call reply could not be processed. Try calling again.");
        }
      })
      .on("broadcast", { event: "ice" }, async ({ payload }) => {
        if (payload.from === meId) return;
        if (!pc.remoteDescription) {
          pendingIceCandidatesRef.current.push(payload.candidate);
          return;
        }
        try {
          await pc.addIceCandidate(payload.candidate);
        } catch (err) {
          console.warn("ICE candidate failed", err);
        }
      })
      .on("broadcast", { event: "declined" }, ({ payload }) => {
        if (payload.from === meId) return;
        setStatus("ended");
        setConnectionHint("The other person declined the call.");
        setCallProblem(null);
        cleanup();
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
        setPeerPresent(hasPeer);
        setConnectionHint(hasPeer ? "Other person joined. Setting up the call…" : "Waiting for the other person to join…");
        if (isCaller && hasPeer && !offerInProgress && pc.signalingState === "stable" && !pc.currentLocalDescription) {
          offerInProgress = true;
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            const result = await ch.send({ type: "broadcast", event: "offer", payload: { from: meId, sdp: offer } });
            if (result !== "ok") setCallProblem("The call invitation could not reach the other person. Check your connection and try again.");
          } catch (err) {
            console.warn("offer create failed", err);
            setCallProblem("The call invitation could not be created. Check your browser and try again.");
          } finally {
            offerInProgress = false;
          }
        }
      })
      .on("presence", { event: "join" }, () => setPeerPresent(true))
      .on("presence", { event: "leave" }, () => setPeerPresent(false));

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
          let lastMeterUpdate = 0;
          const tick = () => {
            const now = performance.now();
            if (now - lastMeterUpdate >= 100) {
              lastMeterUpdate = now;
              an.getByteTimeDomainData(buf);
              let sum = 0;
              for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
              setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 3));
            }
            rafRef.current = requestAnimationFrame(tick);
          };
          tick();
        } catch { /* ignore */ }

        await ch.subscribe(async (st) => {
          if (st === "SUBSCRIBED") {
            setConnectionHint("Connected to call service. Waiting for the other person…");
            await ch.track({ id: meId, at: Date.now() });
          } else if (st === "CHANNEL_ERROR" || st === "TIMED_OUT") {
            setConnectionHint("Could not connect to the call service.");
            setCallProblem("Check your internet connection. If the problem continues, the Realtime service may be unavailable.");
          }
        });
      } catch (e: any) {
        const name = e?.name;
        const message = name === "NotAllowedError" || name === "PermissionDeniedError"
          ? "Allow microphone access in your browser settings, then try the call again."
          : name === "NotFoundError" || name === "DevicesNotFoundError"
            ? "No microphone was found. Connect a microphone and try again."
            : name === "NotReadableError" || name === "TrackStartError"
              ? "The microphone or camera is being used by another app. Close it and try again."
              : !navigator.mediaDevices?.getUserMedia
                ? "This browser cannot access calls here. Open the app in a browser with microphone support over HTTPS."
                : e?.message ?? "Could not start the call.";
        setCallProblem(message);
        setConnectionHint("Microphone or camera setup failed.");
        toast.error(message);
      }
    })();

    function cleanup() {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      audioCtxRef.current?.close().catch(() => {});
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      remoteStreamRef.current?.getTracks().forEach((t) => t.stop());
      pc.getSenders().forEach((s) => {
        try {
          pc.removeTrack(s);
        } catch (error) {
          console.debug("Could not remove a call track during cleanup", error);
        }
      });
      pc.close();
      pendingIceCandidatesRef.current = [];
      supabase.removeChannel(ch);
    }

    return () => {
      cancelled = true;
      void ch.send({ type: "broadcast", event: "bye", payload: { from: meId } }).catch((error) => {
        console.debug("Couldn't send the call-end signal during cleanup", error);
      });
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, userId]);

  useEffect(() => {
    if (status !== "ringing" || callProblem) return;
    const timer = window.setTimeout(() => {
      setConnectionHint(peerPresent ? "The other person joined, but the devices are still connecting." : "No one has joined this call yet.");
      setCallProblem(peerPresent
        ? "Check both internet connections and allow WebRTC/UDP traffic. This app has no TURN relay, so some Wi-Fi, VPN, and mobile networks cannot connect calls."
        : "The other person must be online and accept or open this call. Incoming call alerts only reach users with the app open.");
    }, 20_000);
    return () => window.clearTimeout(timer);
  }, [status, peerPresent, callProblem]);

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
    const channel = chRef.current;
    if (channel) {
      void channel.send({ type: "broadcast", event: "bye", payload: { from: user?.id } }).catch((error) => {
        console.debug("Couldn't send the call-end signal", error);
      });
    }
    toast("Call ended");
    nav({ to: "/dm/$userId", params: { userId } });
  };

  const sendCallInviteToDM = async () => {
    if (!user || sendingInvite) return;
    setSendingInvite(true);
    try {
      const callLink = new URL(`/call/${encodeURIComponent(user.id)}?video=${cam ? "1" : "0"}`, window.location.origin).toString();
      const { data: message, error } = await supabase
        .from("direct_messages")
        .insert({
          sender_id: user.id,
          recipient_id: userId,
          body: `📞 Join my ${cam ? "video" : "voice"} call: ${callLink}`,
        })
        .select("id")
        .single();
      if (error) throw error;
      notifyInApp({
        recipientId: userId,
        actorId: user.id,
        type: "call_invite",
        title: "invited you to a call",
        body: "Open your chat to join the call.",
        data: { message_id: message.id, call_url: callLink },
      });
      toast.success("Call invite sent in chat");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't send the call invite");
    } finally {
      setSendingInvite(false);
    }
  };

  const flipCam = async () => setFacing((f) => (f === "user" ? "environment" : "user"));

  return (
    <FullScreenLayer open>
    <div
      className="fixed inset-0 z-[120] bg-gradient-to-br from-[#1a0820] via-[#0b0b15] to-black text-white flex flex-col overscroll-none"
      style={{ height: "100dvh", paddingTop: "env(safe-area-inset-top)" }}
    >
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
          {status === "ringing" ? (cam ? "Video call" : "Voice call") : status === "ended" ? "Call declined" : (
            <>
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 mr-1.5 align-middle animate-pulse" />
              Connected · {time}
            </>
          )}
        </p>
        {status !== "connected" && (
          <p className="mt-2 max-w-sm text-xs text-white/70" role="status">
            {connectionHint}
            {callProblem && <span className="mt-1 block text-amber-200">{callProblem}</span>}
          </p>
        )}
        {status === "ringing" && (
          <button
            type="button"
            onClick={() => void sendCallInviteToDM()}
            disabled={sendingInvite}
            className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold text-white backdrop-blur-md transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rizz-pink)] disabled:cursor-wait disabled:opacity-60"
          >
            <MessageCircle className="h-4 w-4" />
            {sendingInvite ? "Sending invite…" : "Send call invite in chat"}
          </button>
        )}
        {hand && <p className="mt-2 text-xs text-yellow-300">✋ Hand raised</p>}
      </div>

      {/* Local self-view PiP */}
      {cam && (
        <div
          className="absolute right-4 z-20 h-40 w-28 rounded-2xl overflow-hidden border border-white/20 shadow-2xl bg-black"
          style={{ top: "calc(env(safe-area-inset-top) + 1rem)" }}
        >
          <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full object-cover scale-x-[-1]" />
          <button onClick={flipCam} className="absolute bottom-1 right-1 h-7 w-7 rounded-full bg-black/60 grid place-items-center">
            <SwitchCamera className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div
        className="relative z-10 px-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
      >
        <div className="max-w-md mx-auto glass-strong rounded-3xl px-2 py-3 border border-white/10 flex items-center justify-between gap-1">
          <CtrlBtn active={!muted} on={<Mic />} off={<MicOff />} onClick={() => setMuted((m) => !m)} label={muted ? "Unmute" : "Mute"} />
          <CtrlBtn active={cam} on={<Video />} off={<VideoOff />} onClick={() => setCam((c) => !c)} label={cam ? "Video on" : "Video off"} />
          <CtrlBtn active={speaker} on={<Volume2 />} off={<Volume2 className="opacity-50" />} onClick={() => setSpeaker((s) => !s)} label="Speaker" />
          <CtrlBtn active={hand} on={<Hand />} off={<Hand />} onClick={() => setHand((h) => !h)} label="Hand" />
          <CtrlBtn active={false} on={<MonitorUp />} off={<MonitorUp />} onClick={() => toast("Screen share requested")} label="Share" />
          <button
            onClick={end}
            aria-label="End call"
            className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 rounded-full bg-red-500 hover:bg-red-600 grid place-items-center shadow-lg shadow-red-500/40 transition-transform active:scale-95"
          >
            <PhoneOff className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
    </FullScreenLayer>
  );
}

function CtrlBtn({ active, on, off, onClick, label }: { active: boolean; on: React.ReactNode; off: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`h-11 w-11 sm:h-12 sm:w-12 shrink-0 rounded-full grid place-items-center [&_svg]:h-5 [&_svg]:w-5 transition-all active:scale-95 ${
        active ? "bg-white/15 text-white" : "bg-white/5 text-white/60"
      }`}
    >
      {active ? on : off}
    </button>
  );
}