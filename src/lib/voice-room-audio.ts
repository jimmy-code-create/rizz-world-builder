import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getRoomIceConfiguration } from "@/lib/webrtc";
import { updateParticipant } from "@/lib/voice";

/**
 * Mesh call engine used by the global VoiceCallProvider.
 *
 * It keeps the original realm-voice transport (Supabase Realtime broadcast
 * signaling + RTCPeerConnection mesh + TURN from /api/turn-credentials) and
 * adds what a Discord-style call needs: audio *and* video transceivers (so
 * toggling the camera never needs a renegotiation), a per-participant
 * speaking level for the glowing ring, and mic/camera permission handling.
 */

export type CallPeer = {
  user_id: string;
  muted?: boolean;
};

type RemoteStream = {
  peerId: string;
  stream: MediaStream;
};

type PeerConnection = {
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  pendingIce: RTCIceCandidateInit[];
  retryCount: number;
  retryTimer?: number;
  audioSender?: RTCRtpSender;
  videoSender?: RTCRtpSender;
  /** The third m-line, reserved for screen sharing. */
  screenSender?: RTCRtpSender;
};

type AnalyserEntry = {
  analyser: AnalyserNode;
  buffer: Uint8Array<ArrayBuffer>;
  source: MediaStreamAudioSourceNode;
};

const SPEAKING_THRESHOLD = 0.045;
const LEVEL_INTERVAL_MS = 180;

function mediaErrorMessage(error: unknown, kind: "mic" | "camera"): string {
  const name = error instanceof DOMException ? error.name : "";
  const device = kind === "mic" ? "microphone" : "camera";
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
    return `${device === "microphone" ? "Microphone" : "Camera"} permission denied. Allow ${device} access in your browser settings, then tap Retry.`;
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return `No ${device} was found on this device.`;
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return `Your ${device} is already in use by another app. Close it and tap Retry.`;
  }
  return `Couldn't start your ${device}. Check your device settings and tap Retry.`;
}

export function useVoiceCall({
  roomId,
  userId,
  accessToken,
  participants,
  muted,
  cameraOn,
  facing,
}: {
  roomId: string;
  userId: string;
  accessToken: string;
  participants: CallPeer[];
  muted: boolean;
  cameraOn: boolean;
  facing: "user" | "environment";
}) {
  const [signalingReady, setSignalingReady] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectedPeerIds, setConnectedPeerIds] = useState<string[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);
  const [speakingIds, setSpeakingIds] = useState<string[]>([]);
  const [micReady, setMicReady] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [localCameraStream, setLocalCameraStream] = useState<MediaStream | null>(null);
  // Screen sharing is opt-in: nothing is captured until the button is pressed.
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const [remoteScreenStreams, setRemoteScreenStreams] = useState<RemoteStream[]>([]);
  const [sharingScreen, setSharingScreen] = useState(false);
  const [screenError, setScreenError] = useState<string | null>(null);

  const peerConnections = useRef(new Map<string, PeerConnection>());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const participantsRef = useRef(participants);
  const mutedRef = useRef(muted);
  const cameraOnRef = useRef(cameraOn);
  const facingRef = useRef(facing);
  const micStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const iceServersRef = useRef<RTCIceServer[]>([]);
  const turnConfiguredRef = useRef(false);
  const syncPeersRef = useRef<() => void>(() => {});
  const startMicRef = useRef<() => Promise<void>>(async () => {});
  const startCameraRef = useRef<(nextFacing?: "user" | "environment") => Promise<void>>(async () => {});
  const stopCameraRef = useRef<() => void>(() => {});
  const startScreenRef = useRef<() => Promise<void>>(async () => {});
  const stopScreenRef = useRef<() => void>(() => {});
  const retryRef = useRef<() => Promise<void>>(async () => {});
  const analysersRef = useRef(new Map<string, AnalyserEntry>());
  const audioContextRef = useRef<AudioContext | null>(null);
  const levelsRef = useRef(new Set<string>());

  participantsRef.current = participants;
  mutedRef.current = muted;
  cameraOnRef.current = cameraOn;
  facingRef.current = facing;

  const expectedPeerCount = participants.filter((participant) => participant.user_id !== userId).length;
  const connected = signalingReady && (expectedPeerCount === 0 || connectedPeerIds.length > 0);
  const status = cameraError ?? micError ?? connectionError ?? (connected ? "Connected" : "Connecting…");

  const markPlaybackBlocked = useCallback(() => {
    setConnectionError("Tap Retry to enable call audio in your browser.");
  }, []);

  const attachAnalyser = useCallback((peerId: string, stream: MediaStream) => {
    if (typeof window === "undefined" || stream.getAudioTracks().length === 0) return;
    if (analysersRef.current.has(peerId)) return;
    try {
      const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;
      const context = (audioContextRef.current ||= new AudioContextCtor());
      if (context.state === "suspended") void context.resume().catch(() => {});
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analysersRef.current.set(peerId, { analyser, buffer: new Uint8Array(analyser.frequencyBinCount), source });
    } catch (error) {
      console.warn("Speaking level detection is unavailable", error);
    }
  }, []);

  const detachAnalyser = useCallback((peerId: string) => {
    const entry = analysersRef.current.get(peerId);
    if (!entry) return;
    try {
      entry.source.disconnect();
    } catch {
      // already disconnected
    }
    analysersRef.current.delete(peerId);
  }, []);

  useEffect(() => {
    analysersRef.current.forEach((entry) => { try { entry.source.disconnect(); } catch { /* noop */ } });
    analysersRef.current.clear();
    const timer = window.setInterval(() => {
      const next = new Set<string>();
      analysersRef.current.forEach((entry, peerId) => {
        entry.analyser.getByteTimeDomainData(entry.buffer);
        let sum = 0;
        for (let index = 0; index < entry.buffer.length; index += 1) {
          const sample = (entry.buffer[index] - 128) / 128;
          sum += sample * sample;
        }
        if (Math.sqrt(sum / entry.buffer.length) > SPEAKING_THRESHOLD) next.add(peerId);
      });
      const current = levelsRef.current;
      if (next.size !== current.size || [...next].some((id) => !current.has(id))) {
        levelsRef.current = next;
        setSpeakingIds([...next]);
      }
    }, LEVEL_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
      analysersRef.current.forEach((entry) => { try { entry.source.disconnect(); } catch { /* noop */ } });
      analysersRef.current.clear();
      const context = audioContextRef.current;
      audioContextRef.current = null;
      if (context && context.state !== "closed") void context.close().catch(() => {});
    };
  }, [roomId, userId]);

  useEffect(() => {
    if (!roomId || !userId || !accessToken) return;
    let disposed = false;
    let signalingOpen = false;
    const peers = peerConnections.current;
    const setConnected = (peerId: string, isConnected: boolean) => {
      setConnectedPeerIds((current) => {
        const next = new Set(current);
        if (isConnected) next.add(peerId);
        else next.delete(peerId);
        return [...next];
      });
    };

    const sendSignal = async (to: string, kind: string, details: Record<string, unknown> = {}) => {
      const channel = channelRef.current;
      if (!channel || disposed) return;
      const result = await channel.send({ type: "broadcast", event: "signal", payload: { from: userId, to, kind, ...details } });
      if (result !== "ok") throw new Error("The voice signal could not be sent.");
    };

    const sendOffer = async (entry: PeerConnection, peerId: string, iceRestart = false) => {
      if (disposed || entry.makingOffer || entry.pc.signalingState !== "stable") return;
      entry.makingOffer = true;
      try {
        const offer = await entry.pc.createOffer(iceRestart ? { iceRestart: true } : undefined);
        await entry.pc.setLocalDescription(offer);
        if (entry.pc.localDescription) await sendSignal(peerId, "description", { description: entry.pc.localDescription });
      } catch (error) {
        console.warn("Voice offer could not be created", error);
      } finally {
        entry.makingOffer = false;
      }
    };

    const scheduleIceRestart = (peerId: string, entry: PeerConnection) => {
      if (disposed || entry.retryTimer) return;
      if (entry.retryCount >= 4) {
        setConnectionError(
          turnConfiguredRef.current
            ? "The call connection failed. Check your network and tap Retry."
            : "The call connection failed. A TURN relay is needed for some mobile networks.",
        );
        return;
      }
      const delay = Math.min(700 * 2 ** entry.retryCount, 5600);
      entry.retryCount += 1;
      entry.retryTimer = window.setTimeout(() => {
        entry.retryTimer = undefined;
        if (disposed || entry.pc.connectionState === "connected") return;
        try {
          entry.pc.restartIce();
          void sendOffer(entry, peerId, true);
        } catch (error) {
          console.warn("ICE restart failed", error);
          scheduleIceRestart(peerId, entry);
        }
      }, delay);
    };

    const ensurePeer = (peerId: string): PeerConnection | undefined => {
      if (disposed || peerId === userId) return undefined;
      const current = peers.get(peerId);
      if (current) return current;

      const entry: PeerConnection = {
        pc: new RTCPeerConnection({ iceServers: iceServersRef.current }),
        polite: userId.localeCompare(peerId) > 0,
        makingOffer: false,
        ignoreOffer: false,
        pendingIce: [],
        retryCount: 0,
      };
      const pc = entry.pc;
      peers.set(peerId, entry);

      // Audio + video m-lines are always negotiated, so mute/camera toggles
      // only swap tracks and never trigger a renegotiation.
      entry.audioSender = pc.addTransceiver("audio", { direction: "sendrecv" }).sender;
      entry.videoSender = pc.addTransceiver("video", { direction: "sendrecv" }).sender;

      const audioTrack = micStreamRef.current?.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !mutedRef.current;
        void entry.audioSender.replaceTrack(audioTrack).catch(() => {});
      }
      const videoTrack = cameraStreamRef.current?.getVideoTracks()[0];
      if (videoTrack) void entry.videoSender.replaceTrack(videoTrack).catch(() => {});

      // The screen transceiver is always negotiated, so starting a share later
      // is a track swap and never a renegotiation of the call.
      entry.screenSender = pc.addTransceiver("video", { direction: "sendrecv" }).sender;
      const screenTrack = screenStreamRef.current?.getVideoTracks()[0];
      if (screenTrack) void entry.screenSender.replaceTrack(screenTrack).catch(() => {});

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          void sendSignal(peerId, "ice", { candidate: event.candidate.toJSON() }).catch((error) => {
            console.warn("Voice ICE candidate could not be sent", error);
          });
        }
      };
      pc.ontrack = (event) => {
        const incoming = event.streams[0];
        const tracks = incoming ? incoming.getTracks() : [event.track];
        // Both sides add the transceivers in the same order (audio, camera,
        // screen), so the second video m-line is always the shared screen.
        const videoTransceivers = pc
          .getTransceivers()
          .filter((transceiver) => transceiver.receiver.track.kind === "video");
        const isScreen =
          event.track.kind === "video" && videoTransceivers.indexOf(event.transceiver) >= 1;
        if (isScreen) {
          const stream = new MediaStream([event.track]);
          setRemoteScreenStreams((current) => [
            ...current.filter((item) => item.peerId !== peerId),
            { peerId, stream },
          ]);
          return;
        }
        setRemoteStreams((currentStreams) => {
          const existing = currentStreams.find((item) => item.peerId === peerId);
          const stream = existing?.stream ?? new MediaStream();
          for (const track of tracks) {
            if (!stream.getTracks().some((item) => item.id === track.id)) stream.addTrack(track);
          }
          attachAnalyser(peerId, stream);
          return [...currentStreams.filter((item) => item.peerId !== peerId), { peerId, stream }];
        });
      };
      pc.onnegotiationneeded = () => {
        void sendOffer(entry, peerId);
      };
      pc.onconnectionstatechange = () => {
        const isConnected = pc.connectionState === "connected";
        setConnected(peerId, isConnected);
        if (isConnected) {
          entry.retryCount = 0;
          setConnectionError(null);
        } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          scheduleIceRestart(peerId, entry);
        }
      };

      return entry;
    };

    const syncPeers = () => {
      if (disposed || !signalingOpen) return;
      const activePeers = new Map(
        participantsRef.current.filter((participant) => participant.user_id !== userId).map((participant) => [participant.user_id, participant]),
      );
      for (const [peerId, entry] of peers) {
        if (activePeers.has(peerId)) continue;
        if (entry.retryTimer) window.clearTimeout(entry.retryTimer);
        entry.pc.close();
        peers.delete(peerId);
        detachAnalyser(peerId);
        setConnected(peerId, false);
        setRemoteStreams((current) => current.filter((item) => item.peerId !== peerId));
        setRemoteScreenStreams((current) => current.filter((item) => item.peerId !== peerId));
      }
      for (const peerId of activePeers.keys()) {
        const entry = ensurePeer(peerId);
        if (entry && userId.localeCompare(peerId) < 0 && channelRef.current) void sendOffer(entry, peerId);
      }
    };
    syncPeersRef.current = syncPeers;

    const startMicrophone = async () => {
      if (disposed) return;
      if (micStreamRef.current) {
        setMicReady(true);
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setMicError("Microphone access isn't available in this browser.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (disposed) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        micStreamRef.current = stream;
        setLocalStream(stream);
        const track = stream.getAudioTracks()[0];
        if (track) track.enabled = !mutedRef.current;
        for (const [, entry] of peers) {
          if (entry.audioSender && track) void entry.audioSender.replaceTrack(track).catch(() => {});
        }
        attachAnalyser(userId, stream);
        setMicReady(true);
        setMicError(null);
      } catch (error) {
        setMicReady(false);
        setMicError(mediaErrorMessage(error, "mic"));
      }
    };
    startMicRef.current = startMicrophone;

    const startCamera = async (nextFacing?: "user" | "environment") => {
      if (disposed) return;
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Camera access isn't available in this browser.");
        return;
      }
      const desiredFacing = nextFacing ?? facingRef.current;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: desiredFacing,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (disposed) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = stream;
        setLocalCameraStream(stream);
        const track = stream.getVideoTracks()[0];
        for (const [, entry] of peers) {
          if (entry.videoSender && track) void entry.videoSender.replaceTrack(track).catch(() => {});
        }
        setCameraReady(true);
        setCameraError(null);
      } catch (error) {
        setCameraReady(false);
        setCameraError(mediaErrorMessage(error, "camera"));
      }
    };
    startCameraRef.current = startCamera;

    const stopCamera = () => {
      const stream = cameraStreamRef.current;
      cameraStreamRef.current = null;
      setLocalCameraStream(null);
      if (stream) stream.getTracks().forEach((track) => track.stop());
      for (const [, entry] of peers) {
        if (entry.videoSender) void entry.videoSender.replaceTrack(null).catch(() => {});
      }
      setCameraReady(false);
    };
    stopCameraRef.current = stopCamera;

    /** Best-effort roster flag so everyone else knows there is something to see. */
    const syncSharingFlag = async (next: boolean) => {
      if (!roomId || !userId) return;
      try {
        await updateParticipant(roomId, userId, { sharing_screen: next });
      } catch (error) {
        console.warn("Couldn't sync the screen-share flag", error);
      }
    };

    const startScreenShare = async () => {
      if (disposed) return;
      if (!navigator.mediaDevices?.getDisplayMedia) {
        setScreenError("Screen sharing isn't available in this browser.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        if (disposed) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const track = stream.getVideoTracks()[0];
        if (!track) throw new Error("That window did not share a video track.");

        screenStreamRef.current?.getTracks().forEach((item) => item.stop());
        screenStreamRef.current = stream;
        setLocalScreenStream(stream);
        for (const [, entry] of peers) {
          if (entry.screenSender) void entry.screenSender.replaceTrack(track).catch(() => {});
        }
        // The browser's own "Stop sharing" bar ends the track.
        track.addEventListener("ended", () => stopScreenRef.current());
        setSharingScreen(true);
        setScreenError(null);
        await syncSharingFlag(true);
      } catch (error) {
        setSharingScreen(false);
        const name = error instanceof DOMException ? error.name : "";
        setScreenError(
          name === "NotAllowedError" || name === "AbortError"
            ? "Screen sharing was cancelled."
            : "Couldn't share that. Pick a window, tab or screen and try again.",
        );
      }
    };
    startScreenRef.current = startScreenShare;

    const stopScreenShare = () => {
      const stream = screenStreamRef.current;
      screenStreamRef.current = null;
      setLocalScreenStream(null);
      if (stream) stream.getTracks().forEach((track) => track.stop());
      for (const [, entry] of peers) {
        if (entry.screenSender) void entry.screenSender.replaceTrack(null).catch(() => {});
      }
      setSharingScreen(false);
      void syncSharingFlag(false);
    };
    stopScreenRef.current = stopScreenShare;

    const applyRemoteDescription = async (peerId: string, description: RTCSessionDescriptionInit) => {
      const entry = ensurePeer(peerId);
      if (!entry) return;
      const offerCollision = description.type === "offer" && (entry.makingOffer || entry.pc.signalingState !== "stable");
      entry.ignoreOffer = !entry.polite && offerCollision;
      if (entry.ignoreOffer) return;

      if (offerCollision) await entry.pc.setLocalDescription({ type: "rollback" });
      await entry.pc.setRemoteDescription(description);
      for (const candidate of entry.pendingIce.splice(0)) {
        await entry.pc.addIceCandidate(candidate).catch((error) => {
          console.warn("Queued voice ICE candidate failed", error);
        });
      }
      if (description.type === "offer") {
        await entry.pc.setLocalDescription(await entry.pc.createAnswer());
        if (entry.pc.localDescription) await sendSignal(peerId, "description", { description: entry.pc.localDescription });
      }
    };

    const retryConnection = async () => {
      setConnectionError(null);
      setMicError(null);
      setCameraError(null);
      for (const entry of peers.values()) entry.retryCount = 0;
      await startMicrophone();
      if (cameraOnRef.current) await startCamera();
      const channel = channelRef.current;
      if (channel) {
        await channel.send({ type: "broadcast", event: "signal", payload: { from: userId, to: "*", kind: "ready" } });
      }
      for (const [peerId, entry] of peers) {
        if (entry.pc.connectionState !== "connected") {
          try {
            entry.pc.restartIce();
            await sendOffer(entry, peerId, true);
          } catch (error) {
            console.warn("Call connection retry failed", error);
            scheduleIceRestart(peerId, entry);
          }
        }
      }
    };
    retryRef.current = retryConnection;

    const start = async () => {
      // Pass the room id so the endpoint can refuse locked "mods only" channels.
      const ice = await getRoomIceConfiguration(accessToken, roomId);
      if (disposed) return;
      iceServersRef.current = ice.iceServers;
      turnConfiguredRef.current = ice.turnConfigured;

      await startMicrophone();
      if (disposed) return;
      if (cameraOnRef.current) await startCamera();

      const channel = supabase.channel(`voice-media-${roomId}`, {
        config: { broadcast: { self: false, ack: true }, presence: { key: userId } },
      });
      channelRef.current = channel;
      channel
        .on("broadcast", { event: "signal" }, async ({ payload }) => {
          if (!payload || payload.from === userId || (payload.to !== userId && payload.to !== "*")) return;
          const peerId = String(payload.from ?? "");
          if (!peerId) return;
          if (payload.kind === "ready") {
            const entry = ensurePeer(peerId);
            if (entry && userId.localeCompare(peerId) < 0) void sendOffer(entry, peerId);
            return;
          }
          try {
            if (payload.kind === "description" && payload.description) {
              await applyRemoteDescription(peerId, payload.description as RTCSessionDescriptionInit);
            } else if (payload.kind === "ice" && payload.candidate) {
              const entry = ensurePeer(peerId);
              if (!entry) return;
              const candidate = payload.candidate as RTCIceCandidateInit;
              if (!entry.pc.remoteDescription) entry.pendingIce.push(candidate);
              else await entry.pc.addIceCandidate(candidate).catch((error) => {
                if (!entry.ignoreOffer) console.warn("Voice ICE candidate failed", error);
              });
            }
          } catch (error) {
            console.warn("Voice signaling failed", error);
            setConnectionError("The call connection needs to be retried.");
          }
        })
        .subscribe((state) => {
          if (disposed) return;
          if (state === "SUBSCRIBED") {
            signalingOpen = true;
            setSignalingReady(true);
            setConnectionError(null);
            void channel.send({ type: "broadcast", event: "signal", payload: { from: userId, to: "*", kind: "ready" } });
            syncPeers();
          } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
            signalingOpen = false;
            setSignalingReady(false);
            setConnectionError("The call server is waking up. Retrying the connection…");
          }
        });
    };
    void start().catch((error) => {
      if (!disposed) {
        console.warn("Could not start the call connection", error);
        setConnectionError("Couldn't connect to this call. Check your connection and tap Retry.");
      }
    });

    return () => {
      disposed = true;
      const channel = channelRef.current;
      channelRef.current = null;
      if (channel) void supabase.removeChannel(channel);
      for (const entry of peers.values()) {
        if (entry.retryTimer) window.clearTimeout(entry.retryTimer);
        entry.pc.close();
      }
      peers.clear();
      micStreamRef.current?.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
      screenStreamRef.current?.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
      setConnectedPeerIds([]);
      setRemoteStreams([]);
      setRemoteScreenStreams([]);
      setLocalScreenStream(null);
      setSharingScreen(false);
      setSpeakingIds([]);
      setSignalingReady(false);
      setMicReady(false);
      setCameraReady(false);
      setLocalStream(null);
      setLocalCameraStream(null);
    };
  }, [roomId, userId, accessToken, attachAnalyser, detachAnalyser]);

  const participantKey = participants.map((item) => item.user_id).join("|");
  useEffect(() => {
    syncPeersRef.current();
  }, [participantKey]);

  // Mute keeps the mic permission and only gates the outgoing track.
  useEffect(() => {
    const track = micStreamRef.current?.getAudioTracks()[0];
    if (track) track.enabled = !muted;
  }, [muted]);

  useEffect(() => {
    if (cameraOn) void startCameraRef.current();
    else stopCameraRef.current();
  }, [cameraOn, roomId]);

  useEffect(() => {
    if (!cameraOn) return;
    void startCameraRef.current(facing);
  }, [facing, cameraOn]);

  const retry = useCallback(() => retryRef.current(), []);
  const startScreenShare = useCallback(() => startScreenRef.current(), []);
  const stopScreenShare = useCallback(() => stopScreenRef.current(), []);
  const screenSupported =
    typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;

  return {
    status,
    error: cameraError ?? micError ?? connectionError,
    micError,
    cameraError,
    screenError,
    micReady,
    cameraReady,
    localStream,
    localCameraStream,
    localScreenStream,
    remoteScreenStreams,
    sharingScreen,
    screenSupported,
    startScreenShare,
    stopScreenShare,
    retry,
    remoteStreams,
    speakingIds,
    markPlaybackBlocked,
  };
}
