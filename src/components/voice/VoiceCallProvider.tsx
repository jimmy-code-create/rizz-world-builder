import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  endRoom,
  ensureChannelVoiceCall,
  fetchParticipants,
  fetchRealmChannelCalls,
  joinRoom,
  leaveRoom,
  leaveRoomBeacon,
  updateParticipant,
} from "@/lib/voice";
import { useVoiceCall } from "@/lib/voice-room-audio";
import { useCallWakeLock } from "@/lib/wake-lock";
import { VoiceCallAudio, VoiceCallView } from "@/components/voice/VoiceCallView";
import { MusicBotAudio, MusicBotBoundary } from "@/components/voice/MusicBotInCall";

export type VoiceChannelRef = {
  id: string;
  realmId: string;
  name: string;
  topic?: string | null;
};

export type ActiveCall = {
  roomId: string;
  realmId: string;
  channelId: string;
  channelName: string;
  isHost: boolean;
};

export type CallParticipantRow = {
  user_id: string;
  role: string;
  muted: boolean;
  sharing_screen?: boolean;
  joined_at: string;
  user?: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    accent_color: string | null;
  } | null;
};

type VoiceCallContextValue = {
  call: ActiveCall | null;
  viewOpen: boolean;
  busy: boolean;
  muted: boolean;
  deafened: boolean;
  cameraOn: boolean;
  facing: "user" | "environment";
  participants: CallParticipantRow[];
  speakingIds: string[];
  remoteStreams: { peerId: string; stream: MediaStream }[];
  localStream: MediaStream | null;
  localCameraStream: MediaStream | null;
  /** Screen sharing (opt-in): who is sharing, and the streams to render. */
  localScreenStream: MediaStream | null;
  remoteScreenStreams: { peerId: string; stream: MediaStream }[];
  sharingScreen: boolean;
  sharingIds: string[];
  screenSupported: boolean;
  screenError: string | null;
  status: string;
  error: string | null;
  micReady: boolean;
  cameraReady: boolean;
  joinChannel: (channel: VoiceChannelRef) => void;
  leaveCall: () => void;
  openView: () => void;
  closeView: () => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
  toggleCamera: () => void;
  flipCamera: () => void;
  toggleScreenShare: () => void;
  retry: () => void;
  markPlaybackBlocked: () => void;
};

const VoiceCallContext = createContext<VoiceCallContextValue | null>(null);

export function useVoiceCallContext() {
  const value = useContext(VoiceCallContext);
  if (!value) throw new Error("useVoiceCallContext must be used inside VoiceCallProvider");
  return value;
}

/** Live calls for every voice channel of a realm, with who is in them. */
export function useRealmVoiceChannels(realmId?: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["realm-channel-calls", realmId],
    queryFn: () => fetchRealmChannelCalls(realmId!),
    enabled: !!realmId,
    refetchInterval: 20000,
  });

  useEffect(() => {
    if (!realmId) return;
    const channel = supabase
      .channel(`realm-voice-channels-${realmId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "voice_participants" }, () => {
        void qc.invalidateQueries({ queryKey: ["realm-channel-calls", realmId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "voice_rooms", filter: `realm_id=eq.${realmId}` }, () => {
        void qc.invalidateQueries({ queryKey: ["realm-channel-calls", realmId] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [realmId, qc]);

  return query;
}

export function VoiceCallProvider({ children }: { children: React.ReactNode }) {
  const { user, session } = useAuth();
  const qc = useQueryClient();
  const [call, setCall] = useState<ActiveCall | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [busy, setBusy] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState<VoiceChannelRef | null>(null);

  useCallWakeLock(Boolean(call));

  const callRef = useRef<ActiveCall | null>(null);
  const pendingSwitchRef = useRef<VoiceChannelRef | null>(null);
  const userIdRef = useRef<string | null>(null);
  const tokenRef = useRef("");
  callRef.current = call;
  pendingSwitchRef.current = pendingSwitch;
  if (user?.id) userIdRef.current = user.id;
  tokenRef.current = session?.access_token ?? tokenRef.current;

  const participantsQuery = useQuery({
    queryKey: ["voice-call-participants", call?.roomId],
    queryFn: () => fetchParticipants(call!.roomId),
    enabled: !!call?.roomId,
    refetchInterval: call ? 20000 : false,
  });

  const participants = useMemo(
    () => ((participantsQuery.data ?? []) as unknown as CallParticipantRow[]),
    [participantsQuery.data],
  );

  const engine = useVoiceCall({
    roomId: call?.roomId ?? "",
    userId: user?.id ?? "",
    accessToken: session?.access_token ?? "",
    participants: participants.map((participant) => ({ user_id: participant.user_id, muted: participant.muted })),
    muted,
    cameraOn,
    facing,
  });
  const engineRef = useRef(engine);
  engineRef.current = engine;

  // Who is sharing right now: the roster flag for everyone else, the engine's
  // own state for me (the flag round-trips through the database).
  const sharingIds = useMemo(() => {
    const ids = new Set<string>();
    for (const participant of participants) {
      if (participant.user_id === userIdRef.current) {
        if (engine.sharingScreen) ids.add(participant.user_id);
      } else if (participant.sharing_screen) {
        ids.add(participant.user_id);
      }
    }
    return [...ids];
  }, [participants, engine.sharingScreen]);

  // Live roster: realtime keeps the count in the bar honest.
  useEffect(() => {
    const roomId = call?.roomId;
    if (!roomId) return;
    const channel = supabase
      .channel(`voice-call-roster-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "voice_participants", filter: `room_id=eq.${roomId}` }, () => {
        void qc.invalidateQueries({ queryKey: ["voice-call-participants", roomId] });
        if (callRef.current) void qc.invalidateQueries({ queryKey: ["realm-channel-calls", callRef.current.realmId] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "voice_rooms", filter: `id=eq.${roomId}` }, (payload) => {
        if ((payload.new as { is_live?: boolean })?.is_live === false && callRef.current?.roomId === roomId) {
          toast("Voice call ended");
          setCall(null);
          setViewOpen(false);
        }
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [call?.roomId, qc]);

  const joinChannel = useCallback(
    async (channel: VoiceChannelRef, options?: { replacing?: boolean }) => {
      if (!user) {
        toast.error("Sign in to join voice");
        return;
      }
      const current = callRef.current;
      if (!options?.replacing && current) {
        if (current.channelId === channel.id) {
          setViewOpen(true);
          return;
        }
        setPendingSwitch(channel);
        return;
      }
      setBusy(true);
      try {
        const room = await ensureChannelVoiceCall({
          realmId: channel.realmId,
          realmRoomId: channel.id,
          channelName: channel.name,
          userId: user.id,
        });
        await joinRoom(room.id, user.id, "speaker");
        await updateParticipant(room.id, user.id, { muted: false, hand_raised: false });
        setMuted(false);
        setCameraOn(false);
        setFacing("user");
        setCall({
          roomId: room.id,
          realmId: channel.realmId,
          channelId: channel.id,
          channelName: channel.name,
          isHost: room.host_id === user.id,
        });
        setViewOpen(true);
        await qc.invalidateQueries({ queryKey: ["voice-call-participants", room.id] });
        await qc.invalidateQueries({ queryKey: ["realm-channel-calls", channel.realmId] });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't join this voice channel");
      } finally {
        setBusy(false);
      }
    },
    [user, qc],
  );

  const leaveCall = useCallback(async () => {
    const current = callRef.current;
    const others = participants.filter((participant) => participant.user_id !== userIdRef.current);
    setCall(null);
    setViewOpen(false);
    setMuted(false);
    setDeafened(false);
    setCameraOn(false);
    setFacing("user");
    if (!current || !userIdRef.current) return;
    try {
      await leaveRoom(current.roomId, userIdRef.current);
      if (current.isHost && others.length === 0) await endRoom(current.roomId);
    } catch (error) {
      console.warn("Leaving the voice call failed", error);
    }
    void qc.invalidateQueries({ queryKey: ["realm-channel-calls", current.realmId] });
    void qc.invalidateQueries({ queryKey: ["voice-call-participants", current.roomId] });
  }, [participants, qc]);

  const confirmSwitch = useCallback(async () => {
    const target = pendingSwitchRef.current;
    setPendingSwitch(null);
    if (!target) return;
    await leaveCall();
    await joinChannel(target, { replacing: true });
  }, [joinChannel, leaveCall]);

  const toggleMute = useCallback(() => {
    const current = callRef.current;
    setMuted((previous) => {
      const next = !previous;
      if (current && userIdRef.current) {
        void updateParticipant(current.roomId, userIdRef.current, { muted: next }).catch((error) => {
          console.warn("Couldn't sync the mute state", error);
        });
      }
      return next;
    });
  }, []);

  const toggleDeafen = useCallback(() => {
    setDeafened((wasDeafened) => {
      const next = !wasDeafened;
      if (next && !muted) {
        toggleMute();
      }
      return next;
    });
  }, [muted, toggleMute]);

  const toggleCamera = useCallback(() => setCameraOn((previous) => !previous), []);
  const flipCamera = useCallback(() => setFacing((previous) => (previous === "user" ? "environment" : "user")), []);
  const toggleScreenShare = useCallback(() => {
    if (engineRef.current.sharingScreen) engineRef.current.stopScreenShare();
    else void engineRef.current.startScreenShare();
  }, []);

  // Signing out must not leave a ghost participant behind. The keepalive
  // request uses the token captured while the call was live.
  useEffect(() => {
    if (user) return;
    const current = callRef.current;
    if (!current) return;
    leaveRoomBeacon(current.roomId, userIdRef.current ?? "", tokenRef.current);
    setCall(null);
    setViewOpen(false);
    void qc.invalidateQueries({ queryKey: ["realm-channel-calls", current.realmId] });
  }, [user, qc]);

  // Closing the tab or backgrounding the app (mobile) ends the participant row.
  useEffect(() => {
    const flush = () => {
      const current = callRef.current;
      if (!current || !userIdRef.current) return;
      leaveRoomBeacon(current.roomId, userIdRef.current, tokenRef.current);
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, []);

  const value = useMemo<VoiceCallContextValue>(
    () => ({
      call,
      viewOpen,
      busy,
      muted,
      deafened,
      cameraOn,
      facing,
      participants,
      speakingIds: engine.speakingIds,
      remoteStreams: engine.remoteStreams,
      localStream: engine.localStream,
      localCameraStream: engine.localCameraStream,
      localScreenStream: engine.localScreenStream,
      remoteScreenStreams: engine.remoteScreenStreams,
      sharingScreen: engine.sharingScreen,
      sharingIds,
      screenSupported: engine.screenSupported,
      screenError: engine.screenError,
      status: engine.status,
      error: engine.error,
      micReady: engine.micReady,
      cameraReady: engine.cameraReady,
      joinChannel: (channel) => {
        void joinChannel(channel);
      },
      leaveCall: () => {
        void leaveCall();
      },
      openView: () => setViewOpen(true),
      closeView: () => setViewOpen(false),
      toggleMute,
      toggleDeafen,
      toggleCamera,
      flipCamera,
      toggleScreenShare,
      retry: () => {
        void engine.retry();
      },
      markPlaybackBlocked: engine.markPlaybackBlocked,
    }),
    [
      call,
      viewOpen,
      busy,
      muted,
      deafened,
      cameraOn,
      facing,
      participants,
      sharingIds,
      engine.speakingIds,
      engine.remoteStreams,
      engine.localStream,
      engine.localCameraStream,
      engine.localScreenStream,
      engine.remoteScreenStreams,
      engine.sharingScreen,
      engine.screenSupported,
      engine.screenError,
      engine.status,
      engine.error,
      engine.micReady,
      engine.cameraReady,
      engine.retry,
      engine.markPlaybackBlocked,
      joinChannel,
      leaveCall,
      toggleMute,
      toggleDeafen,
      toggleCamera,
      flipCamera,
      toggleScreenShare,
    ],
  );

  return (
    <VoiceCallContext.Provider value={value}>
      {children}
      {/* Audio keeps playing while the view is minimized. */}
      <VoiceCallAudio />
      {/* MUSIC BOT rides in the call: its audio element lives here too, inside a
          boundary so a bot failure can never take the page down with it. */}
      <MusicBotBoundary>
        <MusicBotAudio call={call} />
      </MusicBotBoundary>
      <VoiceCallView />
      <AlertDialog open={!!pendingSwitch} onOpenChange={(open) => { if (!open) setPendingSwitch(null); }}>
        <AlertDialogContent className="glass-strong border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Switch voice channel?</AlertDialogTitle>
            <AlertDialogDescription>
              You're in {call?.channelName}. Joining {pendingSwitch?.name} leaves the current call.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmSwitch()} className="bg-primary text-primary-foreground border-0">
              Switch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </VoiceCallContext.Provider>
  );
}
