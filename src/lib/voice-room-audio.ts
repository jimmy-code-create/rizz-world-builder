import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getRoomIceConfiguration } from "@/lib/webrtc";

type Participant = {
  user_id: string;
  role: string;
};

type RemoteAudioStream = {
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
};

function microphoneError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Microphone permission denied. Allow microphone access in your browser settings, then tap Retry.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No microphone was found. Connect a microphone and tap Retry.";
  }
  return "Couldn't start your microphone. Check your device settings and tap Retry.";
}

export function useVoiceRoomAudio({
  roomId,
  userId,
  accessToken,
  participants,
  canSpeak,
  muted,
  listenerCount,
}: {
  roomId: string;
  userId: string;
  accessToken: string;
  participants: Participant[];
  canSpeak: boolean;
  muted: boolean;
  listenerCount: number;
}) {
  const [signalingReady, setSignalingReady] = useState(false);
  const [micReady, setMicReady] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectedPeerIds, setConnectedPeerIds] = useState<string[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<RemoteAudioStream[]>([]);
  const peerConnections = useRef(new Map<string, PeerConnection>());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const participantsRef = useRef(participants);
  const canSpeakRef = useRef(canSpeak);
  const mutedRef = useRef(muted);
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceServersRef = useRef<RTCIceServer[]>([]);
  const turnConfiguredRef = useRef(false);
  const syncPeersRef = useRef<() => void>(() => {});
  const startMicRef = useRef<() => Promise<void>>(async () => {});
  const retryRef = useRef<() => Promise<void>>(async () => {});

  participantsRef.current = participants;
  canSpeakRef.current = canSpeak;
  mutedRef.current = muted;

  const activePeerCount = participants.filter(
    (participant) => participant.user_id !== userId && participant.role !== "listener",
  ).length;
  const expectedPeerCount = participants.filter(
    (participant) =>
      participant.user_id !== userId &&
      (participant.role !== "listener" || canSpeak),
  ).length;
  const readyForAudio = signalingReady && (!canSpeak || micReady);
  const status = micError
    ?? connectionError
    ?? (readyForAudio && (expectedPeerCount === 0 || connectedPeerIds.length > 0)
      ? `Connected · ${listenerCount} listening`
      : "Connecting…");

  const markPlaybackBlocked = useCallback(() => {
    setConnectionError("Tap Retry to enable room audio in your browser.");
  }, []);

  useEffect(() => {
    if (!roomId || !userId || !accessToken) return;
    let disposed = false;
    let signalingOpen = false;
    const peers = peerConnections.current;
    const setConnected = (peerId: string, connected: boolean) => {
      setConnectedPeerIds((current) => {
        const next = new Set(current);
        if (connected) next.add(peerId);
        else next.delete(peerId);
        return [...next];
      });
    };

    const sendSignal = async (to: string, kind: string, details: Record<string, unknown> = {}) => {
      const channel = channelRef.current;
      if (!channel || disposed) return;
      const result = await channel.send({
        type: "broadcast",
        event: "signal",
        payload: { from: userId, to, kind, ...details },
      });
      if (result !== "ok") throw new Error("The voice room signal could not be sent.");
    };

    const sendOffer = async (entry: PeerConnection, peerId: string, iceRestart = false) => {
      if (disposed || entry.makingOffer || entry.pc.signalingState !== "stable") return;
      entry.makingOffer = true;
      try {
        const offer = await entry.pc.createOffer(iceRestart ? { iceRestart: true } : undefined);
        await entry.pc.setLocalDescription(offer);
        if (entry.pc.localDescription) {
          await sendSignal(peerId, "description", { description: entry.pc.localDescription });
        }
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
            ? "The room connection failed. Check your network and tap Retry."
            : "The room connection failed. A TURN relay is needed for some mobile networks.",
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

      if (!localStreamRef.current) {
        pc.addTransceiver("audio", { direction: "recvonly" });
      } else {
        for (const track of localStreamRef.current.getAudioTracks()) {
          track.enabled = !mutedRef.current;
          pc.addTrack(track, localStreamRef.current);
        }
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          void sendSignal(peerId, "ice", { candidate: event.candidate.toJSON() }).catch((error) => {
            console.warn("Voice ICE candidate could not be sent", error);
          });
        }
      };
      pc.ontrack = (event) => {
        const stream = event.streams[0] ?? new MediaStream([event.track]);
        setRemoteStreams((currentStreams) => {
          const next = currentStreams.filter((item) => item.peerId !== peerId);
          next.push({ peerId, stream });
          return next;
        });
      };
      pc.onnegotiationneeded = () => {
        void sendOffer(entry, peerId);
      };
      pc.onconnectionstatechange = () => {
        const connected = pc.connectionState === "connected";
        setConnected(peerId, connected);
        if (connected) {
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
        participantsRef.current
          .filter((participant) => participant.user_id !== userId)
          .filter((participant) => participant.role !== "listener" || canSpeakRef.current)
          .map((participant) => [participant.user_id, participant]),
      );
      for (const [peerId, entry] of peers) {
        if (activePeers.has(peerId)) continue;
        if (entry.retryTimer) window.clearTimeout(entry.retryTimer);
        entry.pc.close();
        peers.delete(peerId);
        setConnected(peerId, false);
        setRemoteStreams((current) => current.filter((item) => item.peerId !== peerId));
      }
      for (const peerId of activePeers.keys()) {
        const entry = ensurePeer(peerId);
        if (entry && userId.localeCompare(peerId) < 0 && channelRef.current) {
          void sendOffer(entry, peerId);
        }
      }
    };
    syncPeersRef.current = syncPeers;

    const startMicrophone = async () => {
      if (disposed || !canSpeakRef.current) return;
      if (localStreamRef.current) {
        setMicReady(true);
        setMicError(null);
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
        localStreamRef.current = stream;
        for (const track of stream.getAudioTracks()) track.enabled = !mutedRef.current;
        for (const [peerId, entry] of peers) {
          const audio = entry.pc.getTransceivers().find((transceiver) => transceiver.receiver.track.kind === "audio");
          const track = stream.getAudioTracks()[0];
          if (!track) continue;
          if (audio) {
            await audio.sender.replaceTrack(track);
            audio.direction = "sendrecv";
          } else {
            entry.pc.addTrack(track, stream);
          }
          if (userId.localeCompare(peerId) < 0) void sendOffer(entry, peerId);
        }
        setMicReady(true);
        setMicError(null);
      } catch (error) {
        setMicReady(false);
        setMicError(microphoneError(error));
      }
    };
    startMicRef.current = startMicrophone;

    const stopMicrophone = async () => {
      const stream = localStreamRef.current;
      if (!stream) return;
      for (const [, entry] of peers) {
        const audio = entry.pc.getTransceivers().find((transceiver) => transceiver.receiver.track.kind === "audio");
        if (audio) {
          await audio.sender.replaceTrack(null).catch(() => {});
          audio.direction = "recvonly";
        }
      }
      stream.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setMicReady(false);
    };

    const applyRemoteDescription = async (peerId: string, description: RTCSessionDescriptionInit) => {
      const entry = ensurePeer(peerId);
      if (!entry) return;
      const offerCollision =
        description.type === "offer" &&
        (entry.makingOffer || entry.pc.signalingState !== "stable");
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
        if (entry.pc.localDescription) {
          await sendSignal(peerId, "description", { description: entry.pc.localDescription });
        }
      }
    };

    const retryConnection = async () => {
      setConnectionError(null);
      for (const entry of peers.values()) entry.retryCount = 0;
      if (canSpeakRef.current) await startMicrophone();
      const channel = channelRef.current;
      if (channel) {
        await channel.send({
          type: "broadcast",
          event: "signal",
          payload: { from: userId, to: "*", kind: "ready" },
        });
      }
      for (const [peerId, entry] of peers) {
        if (entry.pc.connectionState !== "connected") {
          try {
            entry.pc.restartIce();
            await sendOffer(entry, peerId, true);
          } catch (error) {
            console.warn("Room connection retry failed", error);
            scheduleIceRestart(peerId, entry);
          }
        }
      }
    };
    retryRef.current = retryConnection;

    const start = async () => {
      const ice = await getRoomIceConfiguration(accessToken);
      if (disposed) return;
      iceServersRef.current = ice.iceServers;
      turnConfiguredRef.current = ice.turnConfigured;
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
            const participant = participantsRef.current.find((item) => item.user_id === peerId);
            if (participant && (participant.role !== "listener" || canSpeakRef.current)) {
              const entry = ensurePeer(peerId);
              if (entry && userId.localeCompare(peerId) < 0) void sendOffer(entry, peerId);
            }
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
            console.warn("Voice room signaling failed", error);
            setConnectionError("The room connection needs to be retried.");
          }
        })
        .subscribe((state) => {
          if (disposed) return;
          if (state === "SUBSCRIBED") {
            signalingOpen = true;
            setSignalingReady(true);
            setConnectionError(null);
            void channel.send({
              type: "broadcast",
              event: "signal",
              payload: { from: userId, to: "*", kind: "ready" },
            });
            syncPeers();
          } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
            signalingOpen = false;
            setSignalingReady(false);
            setConnectionError("The room server is waking up. Retrying the connection…");
          }
        });
    };
    void start().catch((error) => {
      if (!disposed) {
        console.warn("Could not start the room connection", error);
        setConnectionError("Couldn't connect to this room. Check your connection and tap Retry.");
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
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setConnectedPeerIds([]);
      setRemoteStreams([]);
      setSignalingReady(false);
      setMicReady(false);
    };
  }, [roomId, userId, accessToken]);

  const participantKey = participants.map((item) => `${item.user_id}:${item.role}`).join("|");
  useEffect(() => {
    syncPeersRef.current();
  }, [participantKey, canSpeak]);

  useEffect(() => {
    const stream = localStreamRef.current;
    if (stream) stream.getAudioTracks().forEach((track) => { track.enabled = !muted; });
  }, [muted]);

  useEffect(() => {
    if (canSpeak) void startMicRef.current();
    else {
      void (async () => {
        const stream = localStreamRef.current;
        if (!stream) return;
        for (const entry of peerConnections.current.values()) {
          const audio = entry.pc.getTransceivers().find((transceiver) => transceiver.receiver.track.kind === "audio");
          if (audio) {
            await audio.sender.replaceTrack(null).catch(() => {});
            audio.direction = "recvonly";
          }
        }
        stream.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
        setMicReady(false);
      })();
    }
  }, [canSpeak, userId]);

  const retry = useCallback(() => retryRef.current(), []);

  return {
    status,
    error: micError ?? connectionError,
    retry,
    remoteStreams,
    markPlaybackBlocked,
    activePeerCount,
  };
}
