import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Volume2, MonitorUp, Hand, SwitchCamera, Sparkles, WifiOff } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { FullScreenLayer } from "@/components/FullScreenLayer";
import { getRoomIceConfiguration } from "@/lib/webrtc";
import { createVoiceProcessor, type VoiceProcessor } from "@/lib/audio-denoise";
import { useCallWakeLock } from "@/lib/wake-lock";
import { subscribeSafely } from "@/lib/realtime";

export const Route = createFileRoute("/_app/call/$userId")({
  head: () => ({ meta: [{ title: "Call · RIZZ" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ video: s.video === "1" || s.video === true }),
  component: CallPage,
});

/** ICE restart budget and spacing — enough to survive a Wi-Fi blip, not a loop. */
const MAX_ICE_RESTARTS = 3;
const ICE_RESTART_COOLDOWN_MS = 6_000;

/** Fallback when the credential endpoint has no TURN relay configured. */
const STUN_ONLY: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

/** Prefers VP8 with H264 next, as the brief requires, and pushes the rest back. */
function preferVideoCodecs(pc: RTCPeerConnection) {
  if (typeof RTCRtpSender === "undefined" || typeof RTCRtpSender.getCapabilities !== "function") return;
  const capabilities = RTCRtpSender.getCapabilities("video");
  if (!capabilities?.codecs?.length) return;
  const preference = ["video/VP8", "video/H264"];
  const sorted = [...capabilities.codecs].sort((a, b) => {
    const ai = preference.indexOf(a.mimeType);
    const bi = preference.indexOf(b.mimeType);
    return (ai === -1 ? preference.length : ai) - (bi === -1 ? preference.length : bi);
  });
  pc.getTransceivers().forEach((transceiver) => {
    if (typeof transceiver.setCodecPreferences !== "function") return;
    try {
      transceiver.setCodecPreferences(sorted);
    } catch (error) {
      console.debug("Could not apply the video codec preference", error);
    }
  });
}

/** Caps the video encoder: 540p-scale budget on phones, 720p on desktop. */
async function tuneVideoBitrates(pc: RTCPeerConnection, compact: boolean) {
  const maxBitrate = compact ? 800_000 : 1_500_000;
  for (const sender of pc.getSenders()) {
    if (sender.track?.kind !== "video") continue;
    try {
      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
      params.encodings.forEach((encoding) => {
        encoding.maxBitrate = maxBitrate;
        encoding.maxFramerate = 30;
      });
      params.degradationPreference = "balanced";
      await sender.setParameters(params);
    } catch (error) {
      console.debug("Could not cap the video bitrate", error);
    }
  }
}

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
  const [peerPresent, setPeerPresent] = useState(false);
  const [connectionHint, setConnectionHint] = useState("Preparing your microphone…");
  const [callProblem, setCallProblem] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [poorConnection, setPoorConnection] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [enhancedNC, setEnhancedNC] = useState(true);
  const [turnConfigured, setTurnConfigured] = useState<boolean | null>(null);

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
  const voiceProcessorRef = useRef<VoiceProcessor | null>(null);
  const enhancedRef = useRef(true);
  const peerPresentRef = useRef(false);
  // The callbacks below outlive the render that created them, so the relay flag
  // is mirrored in a ref for the troubleshooting messages.
  const turnConfiguredRef = useRef(false);

  const other = useQuery({
    queryKey: ["profile-id", userId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      return data;
    },
  });

  // Keep the screen awake for the length of the call.
  useCallWakeLock(status !== "ended");

  /**
   * Remote audio needs a user gesture on some mobile browsers. Autoplay is tried
   * as soon as a track arrives; when it is blocked we show a tap-to-listen
   * button instead of leaving the call silent with no explanation.
   */
  const playRemoteAudio = async () => {
    const element = remoteAudioRef.current;
    if (!element) return;
    try {
      await element.play();
      setAudioBlocked(false);
    } catch {
      setAudioBlocked(true);
    }
  };

  // Local media + peer connection + signaling
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const meId = user.id;
    // Deterministic roles: the lower id opens the negotiation. Perfect
    // negotiation also needs one "polite" peer that yields on a collision.
    const isCaller = meId < userId;
    const polite = meId > userId;
    const roomId = [meId, userId].sort().join("_");
    // Device class picks video quality (540p phone / 720p desktop) only. It is
    // never a connection gate: every PC/mobile combination is attempted.
    const compactVideo = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
    let offerInProgress = false;
    let makingOffer = false;
    let iceRestarts = 0;
    let lastIceRestartAt = 0;
    let statsTimer: number | null = null;
    pendingIceCandidatesRef.current = [];
    peerPresentRef.current = false;
    setPeerPresent(false);
    setCallProblem(null);
    setReconnecting(false);
    setPoorConnection(false);

    const pc = new RTCPeerConnection({ iceServers: STUN_ONLY, bundlePolicy: "max-bundle", iceCandidatePoolSize: 4 });
    pcRef.current = pc;
    const remote = new MediaStream();
    remoteStreamRef.current = remote;

    // Add the TURN relay as soon as the credential endpoint answers. Networks
    // that need it get it; when it is missing the call still tries STUN and the
    // UI says so plainly instead of pretending a relay exists.
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token || cancelled) return;
        const ice = await getRoomIceConfiguration(token);
        if (cancelled || pc.signalingState === "closed") return;
        setTurnConfigured(ice.turnConfigured);
        turnConfiguredRef.current = ice.turnConfigured;
        if (!ice.iceServers?.length) return;
        pc.setConfiguration({ iceServers: ice.iceServers, bundlePolicy: "max-bundle", iceCandidatePoolSize: 4 });
        if (isCaller && !pc.remoteDescription) {
          try {
            pc.restartIce();
          } catch (error) {
            console.debug("ICE restart after adding TURN is unsupported here", error);
          }
        }
      } catch (error) {
        console.debug("TURN credentials unavailable; continuing with STUN only", error);
        if (!cancelled) setTurnConfigured(false);
      }
    })();

    pc.ontrack = (e) => {
      const tracks = e.streams[0]?.getTracks() ?? [e.track];
      tracks.forEach((t) => {
        if (!remote.getTracks().some((existing) => existing.id === t.id)) remote.addTrack(t);
      });
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remote;
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remote;
        // Autoplay may be blocked until a gesture; playRemoteAudio() surfaces a
        // "Tap to enable sound" button when that happens.
        void playRemoteAudio();
      }
      setRemoteHasVideo(remote.getVideoTracks().some((t) => t.enabled));
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setStatus("connected");
        setConnectionHint("Call connected");
        setCallProblem(null);
        setReconnecting(false);
        return;
      }
      if (pc.connectionState === "disconnected") {
        setReconnecting(true);
        setConnectionHint("Connection dropped. Reconnecting…");
        restartIce();
        return;
      }
      if (pc.connectionState === "failed") {
        setReconnecting(true);
        setConnectionHint("The network could not connect this call.");
        restartIce();
        if (iceRestarts >= MAX_ICE_RESTARTS) {
          setCallProblem(
            turnConfiguredRef.current
              ? "Both networks may be blocking WebRTC/UDP traffic. Try switching networks, then call again."
              : "No TURN relay is configured, so calls on some Wi-Fi, VPN, and mobile networks cannot connect. Try switching networks.",
          );
          toast.error("Call connection failed. See the on-screen message.");
        }
      }
    };
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        setStatus("connected");
        setConnectionHint("Call connected");
        setCallProblem(null);
        setReconnecting(false);
        return;
      }
      if (pc.iceConnectionState === "disconnected") {
        setReconnecting(true);
        restartIce();
        return;
      }
      if (pc.iceConnectionState === "failed") {
        setReconnecting(true);
        restartIce();
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

    /** Single place that creates and broadcasts an offer (initial, media, ICE restart). */
    const sendOffer = async (iceRestart = false) => {
      if (makingOffer || pc.signalingState !== "stable" || pc.connectionState === "closed") return;
      makingOffer = true;
      try {
        const offer = await pc.createOffer(iceRestart ? { iceRestart: true } : undefined);
        await pc.setLocalDescription(offer);
        const result = await ch.send({
          type: "broadcast",
          event: "offer",
          payload: { from: meId, sdp: pc.localDescription ?? offer },
        });
        if (result !== "ok") setCallProblem("The call invitation could not reach the other person. Check your connection and try again.");
      } catch (err) {
        console.warn("offer create failed", err);
        setCallProblem("The call invitation could not be created. Check your browser and try again.");
      } finally {
        makingOffer = false;
      }
    };

    /**
     * ICE restart on a dropped/failed connection. Only the caller restarts, and at
     * most MAX_ICE_RESTARTS times, so both sides never renegotiate at once.
     */
    const restartIce = () => {
      if (!isCaller || iceRestarts >= MAX_ICE_RESTARTS) return;
      if (Date.now() - lastIceRestartAt < ICE_RESTART_COOLDOWN_MS) return;
      lastIceRestartAt = Date.now();
      iceRestarts += 1;
      setReconnecting(true);
      setConnectionHint("Reconnecting…");
      void sendOffer(true);
    };

    // Renegotiation (camera on/off, restart) goes through the standard
    // negotiationneeded hook instead of hand-rolled offers.
    pc.onnegotiationneeded = () => {
      if (!peerPresentRef.current) return;
      void sendOffer();
    };

    // Lightweight quality probe for the "poor connection" badge.
    statsTimer = window.setInterval(() => {
      void (async () => {
        if (pc.connectionState !== "connected") return;
        try {
          const stats = await pc.getStats();
          let lossRate = 0;
          let roundTrip = 0;
          stats.forEach((report) => {
            if (report.type !== "remote-inbound-rtp") return;
            const lost = Number((report as { packetsLost?: number }).packetsLost ?? 0);
            const received = Number((report as { packetsReceived?: number }).packetsReceived ?? 0);
            const total = lost + received;
            if (total > 0) lossRate = lost / total;
            const rtt = (report as { roundTripTime?: number }).roundTripTime;
            if (typeof rtt === "number") roundTrip = rtt;
          });
          setPoorConnection(lossRate > 0.05 || roundTrip > 0.4);
        } catch (error) {
          console.debug("Call quality stats unavailable", error);
        }
      })();
    }, 6_000);

    ch
      .on("broadcast", { event: "offer" }, async ({ payload }) => {
        if (payload.from === meId) return;
        try {
          // Perfect negotiation: on a glare the impolite peer keeps its offer and
          // the polite peer rolls back, which is what breaks the deadlock.
          const collision = makingOffer || pc.signalingState !== "stable";
          if (collision && !polite) {
            console.debug("Ignoring a colliding offer because this peer is impolite");
            return;
          }
          if (collision) {
            try {
              await pc.setLocalDescription({ type: "rollback" } as RTCSessionDescriptionInit);
            } catch (rollbackError) {
              console.debug("Rollback is unsupported by this browser", rollbackError);
            }
          }
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          await applyPendingIceCandidates();
          const ans = await pc.createAnswer();
          await pc.setLocalDescription(ans);
          const result = await ch.send({ type: "broadcast", event: "answer", payload: { from: meId, sdp: pc.localDescription ?? ans } });
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
        peerPresentRef.current = hasPeer;
        setPeerPresent(hasPeer);
        setConnectionHint(hasPeer ? "Other person joined. Setting up the call…" : "Waiting for the other person to join…");
        if (isCaller && hasPeer && !offerInProgress && pc.signalingState === "stable" && !pc.currentLocalDescription) {
          offerInProgress = true;
          try {
            await sendOffer();
          } finally {
            offerInProgress = false;
          }
        }
      })
      .on("presence", { event: "join" }, () => { peerPresentRef.current = true; setPeerPresent(true); })
      .on("presence", { event: "leave" }, () => { peerPresentRef.current = false; setPeerPresent(false); });

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          },
          video: video
            ? {
                facingMode: facing,
                width: { ideal: compactVideo ? 960 : 1280 },
                height: { ideal: compactVideo ? 540 : 720 },
                frameRate: { ideal: 30, max: 30 },
              }
            : false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        // Voice cleanup: publish the processed track when Web Audio is available,
        // otherwise the raw microphone, so a failure never silences the call.
        let publishTrack: MediaStreamTrack | null = stream.getAudioTracks()[0] ?? null;
        try {
          const processor = await createVoiceProcessor(stream);
          voiceProcessorRef.current = processor;
          const mode = await processor.setEnhanced(enhancedRef.current);
          publishTrack = processor.track;
          console.debug(mode === "worklet" ? "Voice cleanup: worklet gate + filters" : "Voice cleanup: filters only");
        } catch (error) {
          console.debug("Voice cleanup unavailable; publishing the raw microphone", error);
        }
        if (publishTrack) pc.addTrack(publishTrack, stream);
        stream.getVideoTracks().forEach((t) => pc.addTrack(t, stream));
        if (stream.getVideoTracks().length > 0) {
          preferVideoCodecs(pc);
          void tuneVideoBitrates(pc, compactVideo);
        }

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

        // Tolerates the topic already being live on this client (the DM header's
        // watcher or the ringer can hold it). In that case the channel is already
        // joined, so the handlers above still receive offers, answers and ICE —
        // only the fresh subscribe() call would throw.
        subscribeSafely(ch, (st) => {
          if (st === "SUBSCRIBED") {
            setConnectionHint("Connected to call service. Waiting for the other person…");
            void ch.track({ id: meId, at: Date.now() });
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
      if (statsTimer) window.clearInterval(statsTimer);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      audioCtxRef.current?.close().catch(() => {});
      voiceProcessorRef.current?.dispose();
      voiceProcessorRef.current = null;
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

  // Enhanced noise cancellation applies to the live sender, no renegotiation.
  useEffect(() => {
    enhancedRef.current = enhancedNC;
    const processor = voiceProcessorRef.current;
    if (!processor) return;
    void processor
      .setEnhanced(enhancedNC)
      .catch((error) => console.debug("Could not change the voice cleanup mode", error));
  }, [enhancedNC]);

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
          // Prefer VP8/H264, cap the bitrate, then let onnegotiationneeded send
          // the renegotiation offer for the new video track.
          preferVideoCodecs(pc);
          await tuneVideoBitrates(pc, window.matchMedia("(max-width: 767px)").matches);
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

  const flipCam = async () => setFacing((f) => (f === "user" ? "environment" : "user"));

  return (
    <FullScreenLayer open>
    <div
      className="fixed inset-0 z-[120] flex flex-col overscroll-none bg-background text-foreground"
      style={{ height: "100dvh", paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(60% 50% at 50% 30%, rgba(201,255,61,0.22), transparent 60%)" }} />

      {/* Remote video fills when available */}
      {cam || remoteHasVideo ? (
        <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 h-full w-full object-cover opacity-90" />
      ) : null}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center">
        {!remoteHasVideo && (
          <motion.div
            animate={status === "ringing" ? { scale: [1, 1.06, 1] } : { scale: 1 }}
            transition={{ duration: 1.4, repeat: status === "ringing" ? Infinity : 0 }}
            className="relative"
          >
            {status === "ringing" && (
              <>
                <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
                <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping [animation-delay:300ms]" />
              </>
            )}
            <span
              className="absolute -inset-3 rounded-full pointer-events-none transition-opacity"
              style={{ boxShadow: `0 0 ${20 + level * 60}px ${4 + level * 10}px rgba(201,255,61,${0.15 + level * 0.4})`, opacity: muted ? 0 : 1 }}
            />
            <Avatar className="h-36 w-36 ring-4 ring-white/20 shadow-2xl relative">
              <AvatarImage src={other.data?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-4xl font-bold">
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
        {status === "connected" && (reconnecting || poorConnection) && (
          <span
            role="status"
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1 text-[11px] font-semibold text-amber-200"
          >
            <WifiOff className="h-3.5 w-3.5" />
            {reconnecting ? "Reconnecting…" : "Poor connection — audio may drop out"}
          </span>
        )}
        {turnConfigured === false && status !== "connected" && (
          <p className="mt-1 max-w-xs text-[10px] text-white/45">
            No TURN relay configured: some Wi-Fi, VPN and mobile networks cannot connect calls.
          </p>
        )}
        {audioBlocked && (
          <button
            onClick={() => void playRemoteAudio()}
            className="mt-3 rounded-full bg-white/15 px-4 py-2 text-xs font-semibold text-white backdrop-blur transition-transform active:scale-95"
          >
            Tap to enable sound
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
        <div className="max-w-md mx-auto mb-2 flex justify-center">
          <button
            type="button"
            onClick={() => setEnhancedNC((value) => !value)}
            aria-pressed={enhancedNC}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
              enhancedNC ? "bg-white/15 text-white" : "bg-white/5 text-white/60"
            }`}
          >
            <Volume2 className="h-3.5 w-3.5" />
            Enhanced noise cancellation {enhancedNC ? "on" : "off"}
          </button>
        </div>

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