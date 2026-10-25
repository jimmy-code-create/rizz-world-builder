import { useEffect, useMemo, useRef, useState } from "react";
import { AudioLines, ChevronDown, Ellipsis, Gamepad2, MicOff, Music, MonitorPlay, Radio, RefreshCw, ScreenShare, ScreenShareOff, SwitchCamera, Volume2, VolumeX, Sliders, MessageSquare, UserPlus, X, Send } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FullScreenLayer } from "@/components/FullScreenLayer";
import { VoiceSettingsSheet } from "@/components/voice/VoiceSettingsSheet";
import { useAuth } from "@/lib/auth";
import { useVoiceCallContext } from "@/components/voice/VoiceCallProvider";
import { useMusicBotInCall } from "@/components/voice/MusicBotInCall";
import { channelVolume, useSoundSettings, formatVolume } from "@/lib/sound-settings";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { RealmMusicHub } from "@/components/realms/RealmMusicHub";
import { RealmGamesHub } from "@/components/realms/RealmGamesHub";
import { useGameBot, useGameOverlayUI } from "@/lib/game-bot";
import { GameSessionsBar } from "@/components/voice/GameSessionsBar";
import { BotCard } from "@/components/bots/BotCard";
import type { GameSession } from "@/lib/game-sessions";
import { useIsMobile } from "@/hooks/use-mobile";
import { publicCustomStatus, publicStatusOf, usePresenceMap } from "@/lib/presence";
import { CustomStatusLine, StatusDotButton } from "@/components/presence/StatusDot";
import { ActivityPanel, JoinGameBanner } from "@/components/voice/ActivityPanel";
import { VoiceActivityOverlay } from "@/components/voice/VoiceActivityOverlay";
import { VideoTile } from "@/components/voice/VideoTile";
import { VoiceControlBar } from "@/components/voice/VoiceControlBar";
import { computeVoiceLayout, voiceParticipantLabel } from "@/lib/voice-layout";
import { useThrottledValue } from "@/hooks/use-throttled-value";
import { useViewportWidth } from "@/hooks/use-viewport";
import { getGame, useRoomActivity, type RoomActivity } from "@/lib/activities";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchRealmRoomMessages, sendRealmRoomMessage } from "@/lib/realms";
import { toast } from "@/lib/toast";
import {
  loadPeerAudio,
  usePeerAudio,
  peerGain,
  peerVolumeOf,
  PEER_AUDIO_EVENT,
  setPeerVolume,
  togglePeerMute,
  type PeerAudioState,
} from "@/lib/peer-audio";

function PeerVolumeControl({ userId, username }: { userId: string; username: string }) {
  const peerAudio = usePeerAudio();
  const muted = peerAudio.muted.includes(userId);
  const committed = peerVolumeOf(peerAudio, userId);
  // Local draft while dragging; the global store (and every subscriber)
  // updates once on release instead of per tick.
  const [draft, setDraft] = useState<number | null>(null);
  const volume = draft ?? committed;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Volume for @${username}`}
          className="absolute bottom-2 right-2 grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-background/80 text-muted-foreground transition hover:text-foreground"
        >
          {muted || volume === 0 ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-60 space-y-3 border-white/10 glass-strong">
        <p className="truncate text-xs font-semibold">@{username}</p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Your volume</span>
            <span>{volume}%</span>
          </div>
          <Slider
            value={[volume]}
            min={0}
            max={100}
            step={5}
            onValueChange={([next]) => setDraft(next ?? 100)}
            onValueCommit={([next]) => {
              const v = next ?? draft ?? committed;
              setDraft(null);
              setPeerVolume(userId, v);
            }}
            aria-label={`Volume for @${username}`}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => togglePeerMute(userId)}
          className="w-full gap-2 border-white/10 bg-white/5"
        >
          {muted ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          {muted ? `Unmute @${username}` : `Mute @${username}`}
        </Button>
        <p className="text-[10px] text-muted-foreground">Only changes what you hear.</p>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Plays a remote participant's audio. Video tracks are ignored here.
 *
 * Volume and output device come from Voice & Sound. `setSinkId` is only present
 * in some browsers, so the picker is best-effort: when it is missing, playback
 * stays on the system default instead of failing.
 */
function RemoteAudio({ stream, onBlocked, peerId, deafened = false }: { stream: MediaStream; onBlocked: () => void; peerId?: string; deafened?: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [settings] = useSoundSettings();
  const peerAudio = usePeerAudio();
  const volume = deafened ? 0 : channelVolume(settings, "voice");

  useEffect(() => {
    const element = audioRef.current;
    if (!element) return;
    element.srcObject = stream;
    void element.play().catch(onBlocked);
  }, [stream, onBlocked]);

  useEffect(() => {
    const element = audioRef.current;
    if (!element) return;
    element.muted = Boolean(deafened);
    // `volume` is capped at 1 by the browser for streamed/live audio, which is
    // why the settings screen says so next to the Voice & TTS slider.
    element.volume = Math.min(1, Math.max(0, volume * peerGain(peerAudio, peerId)));
  }, [volume, peerAudio, peerId, deafened]);

  useEffect(() => {
    const element = audioRef.current;
    if (!element || !settings.outputDeviceId) return;
    const withSink = element as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
    if (!withSink.setSinkId) return;
    void withSink.setSinkId(settings.outputDeviceId).catch((error: unknown) => {
      console.debug("Could not switch the call's output device", error);
    });
  }, [settings.outputDeviceId]);

  return <audio ref={audioRef} autoPlay playsInline className="hidden" />;
}

/**
 * Keeps remote audio playing even when the call view is minimized — this is
 * rendered by the provider, not by the view.
 */
export function VoiceCallAudio() {
  const { call, remoteStreams, markPlaybackBlocked, deafened } = useVoiceCallContext();
  if (!call) return null;
  return (
    <>
      {remoteStreams.map(({ peerId, stream }) => (
        <RemoteAudio key={peerId} stream={stream} peerId={peerId} onBlocked={markPlaybackBlocked} deafened={deafened} />
      ))}
    </>
  );
}

export function VoiceCallView() {
  const { user } = useAuth();
  const {
    call,
    viewOpen,
    closeView,
    participants,
    speakingIds: speakingIdsRaw,
    remoteStreams,
    localCameraStream,
    localScreenStream,
    remoteScreenStreams,
    sharingScreen,
    shareMode,
    shareCropped,
    sharingIds,
    screenSupported,
    screenError,
    muted,
    deafened,
    cameraOn,
    cameraReady,
    facing,
    status,
    error,
    toggleMute,
    toggleDeafen,
    toggleCamera,
    flipCamera,
    toggleScreenShare,
    startGameShare,
    leaveCall,
    retry,
  } = useVoiceCallContext();

  // MUSIC BOT joins the call as a participant (see MusicBotInCall for the audio).
  const musicBot = useMusicBotInCall();
  const selfName =
    participants.find((participant) => participant.user_id === user?.id)?.user?.display_name ||
    participants.find((participant) => participant.user_id === user?.id)?.user?.username ||
    "Someone";
  // Per-user GAME BOT: every person has their own session; the VC shows them
  // all and any card can join that host's game directly.
  const gameBot = useGameBot(call?.channelId, true, selfName);
  const gameOverlay = useGameOverlayUI();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const [gamesOpen, setGamesOpen] = useState(false);
  const [panelMinimized, setPanelMinimized] = useState(false);
  const [selectedSharePeerId, setSelectedSharePeerId] = useState<string | null>(null);
  // Immersive = game as the background with the voice dock floating over it.
  // Toggling it off keeps the game open as a side panel (desktop only).
  const [immersive, setImmersive] = useState(true);
  const [bannerDismissedAt, setBannerDismissedAt] = useState<number | null>(null);
  // One panel layout at a time: mounting both side + overlay iframes loaded
  // the game twice (double audio, double CPU) on every screen size.
  const isMobileView = useIsMobile();
  const [soundSettings, setSoundSettings] = useSoundSettings();
  const [chatBody, setChatBody] = useState("");
  const peerAudio = usePeerAudio();
  const qc = useQueryClient();
  const presenceMap = usePresenceMap(participants.map((participant) => participant.user_id));
  // Real people only: the music/game bots are helpers, not callers.
  const peopleCount = participants.length;
  const viewportWidth = useViewportWidth();
  // Audio levels arrive many times a second. Cap them at 10 Hz before they
  // touch React, then derive the set once per update: a busy room no longer
  // re-renders every tile on every analyser tick.
  const speakingKey = useThrottledValue(speakingIdsRaw.join(","), 100);
  const speakingIds = useMemo(() => (speakingKey ? speakingKey.split(",") : []), [speakingKey]);
  const layout = useMemo(
    () =>
      computeVoiceLayout({
        count: participants.length,
        width: viewportWidth,
        hasVideo: cameraOn || remoteStreams.length > 0,
      }),
    [participants.length, viewportWidth, cameraOn, remoteStreams.length],
  );

  // Desktop shortcuts: M mute, D deafen, V camera. Never while typing.
  useEffect(() => {
    if (!viewOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT"
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "m") {
        event.preventDefault();
        toggleMute();
      } else if (key === "d") {
        event.preventDefault();
        toggleDeafen();
      } else if (key === "v") {
        event.preventDefault();
        toggleCamera();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [viewOpen, toggleMute, toggleDeafen, toggleCamera]);
  const connected = !error && /^connected/i.test(status);
  // A spinner that never stops is worse than no spinner: after this long,
  // say so and offer the same Retry the error state uses.
  const [connectTimedOut, setConnectTimedOut] = useState(false);
  useEffect(() => {
    if (connected || error) {
      setConnectTimedOut(false);
      return;
    }
    setConnectTimedOut(false);
    const timer = window.setTimeout(() => setConnectTimedOut(true), 12_000);
    return () => window.clearTimeout(timer);
  }, [connected, error, status]);

  // The view stays mounted while minimized so games and streams keep running
  // in the background, but its sheets portal to <body> and would stay on top
  // of the app — close them when the call is put away.
  useEffect(() => {
    if (viewOpen) return;
    setChatOpen(false);
    setMoreOpen(false);
    setSettingsOpen(false);
    setMusicOpen(false);
    setGamesOpen(false);
    setConfirmLeaveOpen(false);
  }, [viewOpen]);

  const handleLeaveClick = () => {
    if (call?.isHost && participants.length > 1) {
      setConfirmLeaveOpen(true);
    } else {
      leaveCall();
    }
  };

  const roomMessages = useQuery({
    queryKey: ["realm-room-messages", call?.channelId],
    enabled: chatOpen && !!call?.channelId,
    queryFn: () => fetchRealmRoomMessages(call!.channelId),
    refetchInterval: 3000,
  });

  const sendMut = useMutation({
    mutationFn: () => sendRealmRoomMessage(call!.channelId, user!.id, chatBody.trim()),
    onSuccess: () => {
      setChatBody("");
      qc.invalidateQueries({ queryKey: ["realm-room-messages", call?.channelId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Game Activities: ephemeral per-room state over realtime (broadcast +
  // presence), so late joiners sync the live game with no database table.
  const roomActivity = useRoomActivity(call?.roomId ?? null, user ? { id: user.id, name: selfName } : null, panelOpen);
  const playingCount = Object.keys(roomActivity.players).length;
  const prevActivityRef = useRef<RoomActivity | null>(null);
  useEffect(() => {
    const prev = prevActivityRef.current;
    const next = roomActivity.activity;
    if (next && (!prev || next.startedAt !== prev.startedAt)) {
      setBannerDismissedAt(null);
      setPanelMinimized(false);
      setImmersive(true);
      // Whoever launched it walks straight into the game — they chose it in the
      // hub, so making them tap "Join game" on their own activity is noise.
      if (next.startedBy === user?.id) setPanelOpen(true);
      else
        toast.info(`${next.startedByName} started ${next.gameName}`, {
          description: "Tap Join game to play along.",
        });
    }
    if (prev && !next) {
      setPanelOpen(false);
      setImmersive(true);
      toast.info("Game ended");
    }
    prevActivityRef.current = next;
  }, [roomActivity.activity, user?.id]);

  const handleEndGame = async () => {
    await roomActivity.end();
    setPanelOpen(false);
  };

  const playing = panelOpen && !!roomActivity.activity;
  const gameEntry = roomActivity.activity ? getGame(roomActivity.activity.gameId) : null;
  const liveGame = gameBot.state.activeGame;
  const myGame = gameBot.mySession;
  const isGameStreaming = sharingScreen && shareMode === "game";
  const viewedSession =
    gameBot.sessionsById[gameBot.viewingHostId ?? ""] ?? myGame ?? null;
  // People in the viewed game, host included — the card's status line.
  const gamePlayers = (gameBot.viewersByHost[gameBot.viewingHostId ?? ""] ?? []).length;

  const openGameSession = (session: GameSession) => {
    const joined = gameBot.join(session.hostId);
    if (joined) gameOverlay.expand();
    return joined;
  };
  const joinGameSession = (session: GameSession) => {
    if (!openGameSession(session)) {
      toast.error("That game just ended", { description: "Pick another game from the call." });
      return;
    }
    toast.success(`Joined ${session.hostName}'s ${session.game.name}`, {
      description: "You are in their session — the game opened over the call.",
    });
  };
  const streamGameSession = (session: GameSession) => {
    if (session.hostId !== user?.id) return;
    if (isGameStreaming) toggleScreenShare();
    else startGameShare();
  };

  if (!call) return null;

  const videosByPeer = new Map(
    remoteStreams.map(({ peerId, stream }) => [peerId, stream.getVideoTracks().some((track) => track.readyState === "live") ? stream : null]),
  );

  // The stage shows one shared screen: mine while I am sharing, otherwise the
  // first peer whose roster flag says they are sharing.
  const sharingParticipants = participants.filter((participant) => sharingIds.includes(participant.user_id));
  // A track that exists but is muted is the always-negotiated screen
  // transceiver with nobody sharing on it — never a picture.
  const remoteShares = remoteScreenStreams.filter(({ stream }) =>
    stream.getVideoTracks().some((track) => track.readyState === "live" && !track.muted),
  );
  const selectedRemoteShare =
    remoteShares.find(({ peerId }) => peerId === selectedSharePeerId) ?? null;
  const remoteShare = selectedRemoteShare ?? remoteShares[0] ?? null;
  const stageStream = sharingScreen ? localScreenStream : remoteShare?.stream ?? null;
  const stagePeerId = sharingScreen ? user?.id : remoteShare?.peerId;
  const stageSession = stagePeerId ? gameBot.sessionsById[stagePeerId] ?? null : null;
  const stageHasGame = stagePeerId
    ? !!stageSession ||
      gameBot.sessions.some((session) =>
        gameBot.viewersByHost[session.hostId]?.includes(stagePeerId),
      )
    : false;
  const stageIsGame = sharingScreen ? shareMode === "game" : stageHasGame;
  const stageOwner = sharingScreen
    ? "you"
    : participants.find((participant) => participant.user_id === stagePeerId)?.user?.username ?? "someone";
  // The grid changes shape with the call: one person gets a portrait tile,
  // two stay side by side, five or six use a third column. Fewer people never
  // leave two tiny tiles stranded in a wall of empty space.
  const playerGridClass =
    layout.tier === "solo"
      ? "max-w-sm grid-cols-1"
      : layout.tier === "pair"
        ? "max-w-md grid-cols-1"
        : layout.tier === "quad"
          ? "max-w-2xl grid-cols-2"
          : "max-w-3xl grid-cols-2 sm:grid-cols-3";

  return (
    // A voice call takes over the screen: the tiles, the music bot and the
    // controls get the whole viewport, and the minimize button drops back to the
    // chat without ending the call.
    <FullScreenLayer open lockScroll={viewOpen}>
      {/* Minimized = still mounted (the game, the streams and the grid keep
          their state, and the game keeps running) but out of sight, so
          browsing the feed never stops a round. */}
      <div
        className={`fixed inset-0 z-[130] flex flex-col bg-background text-foreground ${
          viewOpen ? "" : "invisible pointer-events-none"
        }`}
        aria-hidden={!viewOpen}
        style={{ height: "100dvh", paddingTop: "env(safe-area-inset-top)" }}
      >
        <header className="flex h-14 shrink-0 items-center border-b border-border px-3">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[17px] font-semibold leading-tight">
                {call.channelName}
              </h1>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span
                  role={error ? "alert" : "status"}
                  className="inline-flex items-center gap-1.5"
                >
                  <span
                    aria-hidden
                    className={`h-2 w-2 rounded-full ${
                      error
                        ? "bg-destructive"
                        : connected
                          ? "bg-primary"
                          : "bg-[#f5b932] motion-safe:animate-pulse"
                    }`}
                  />
                  {error ? "Failed" : connected ? "Connected" : connectTimedOut ? "Reconnecting" : "Connecting"}
                </span>
                <span aria-hidden>·</span>
                <span>
                  {peopleCount} {peopleCount === 1 ? "person" : "people"}
                </span>
                {speakingIds.length > 0 && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="text-foreground/80">{speakingIds.length} speaking</span>
                  </>
                )}
                {(error || connectTimedOut) && (
                  <button
                    type="button"
                    onClick={retry}
                    className="inline-flex h-8 items-center gap-1 rounded-[var(--radius-button)] px-2 text-xs font-semibold text-primary hover:bg-[var(--overlay-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <RefreshCw className="h-3 w-3" /> Retry
                  </button>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Minimize call"
              className="h-10 w-10 shrink-0 rounded-full"
              onClick={closeView}
            >
              <ChevronDown className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="More call options"
              className="h-10 w-10 shrink-0 rounded-full"
              onClick={() => setMoreOpen(true)}
            >
              <Ellipsis className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <GameSessionsBar
          sessions={gameBot.sessions}
          viewersByHost={gameBot.viewersByHost}
          meId={user?.id}
          viewingHostId={gameBot.viewingHostId}
          streamingIds={sharingIds}
          onOpen={openGameSession}
          onJoin={joinGameSession}
          onLeave={(session) => {
            if (gameBot.viewingHostId !== session.hostId) return;
            if (isGameStreaming) toggleScreenShare();
            gameBot.leave();
          }}
          onStream={streamGameSession}
        />

        {roomActivity.activity && !panelOpen && (!bannerDismissedAt || roomActivity.activity.startedAt > bannerDismissedAt) && (
          <div className="relative shrink-0 px-3 pt-3 sm:px-4">
            <JoinGameBanner
              activity={roomActivity.activity}
              playingCount={playingCount}
              onJoin={() => {
                setPanelMinimized(false);
                setImmersive(true);
                setPanelOpen(true);
              }}
              onDismiss={() => setBannerDismissedAt(roomActivity.activity!.startedAt)}
            />
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2 sm:px-4">
          <div className="mx-auto flex w-full max-w-6xl items-start gap-3">
            <div className="min-w-0 flex-1 space-y-3">
          {!sharingScreen && remoteShares.length > 1 && (
            <div className="mx-auto mb-2 flex w-full max-w-4xl items-center gap-2 overflow-x-auto pb-1">
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Streams
              </span>
              {remoteShares.map(({ peerId }) => {
                const owner = participants.find((participant) => participant.user_id === peerId);
                const session = gameBot.sessionsById[peerId];
                return (
                  <button
                    key={peerId}
                    type="button"
                    onClick={() => setSelectedSharePeerId(peerId)}
                    className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-semibold transition-colors ${
                      remoteShare?.peerId === peerId
                        ? "border-primary/50 bg-primary/15 text-primary"
                        : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <MonitorPlay className="h-3.5 w-3.5" />
                    {session ? `${session.hostName}'s game` : `@${owner?.user?.username ?? "member"}`}
                  </button>
                );
              })}
            </div>
          )}

          {stageStream && (
            <div className="mx-auto mb-4 w-full max-w-4xl overflow-hidden rounded-3xl border border-primary/40 bg-black shadow-md">
              <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-black/60 px-3 py-2">
                <span className="flex min-w-0 items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-primary">
                  <MonitorPlay className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {sharingScreen
                      ? isGameStreaming
                        ? "Your game stream"
                        : "Your screen"
                      : `${stageIsGame ? "Game stream" : "Screen"} shared by @${stageOwner}`}
                  </span>
                </span>
                {sharingScreen && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 border-destructive/40 bg-destructive/15 px-2.5 text-xs text-destructive hover:bg-destructive/25"
                    onClick={toggleScreenShare}
                  >
                    {isGameStreaming ? "Stop game stream" : "Stop sharing"}
                  </Button>
                )}
              </div>
              <VideoTile stream={stageStream} />
              {isGameStreaming && !shareCropped && (
                <p className="border-t border-white/10 bg-black/60 px-3 py-1.5 text-[10px] text-muted-foreground">
                  This browser can&apos;t crop the tab automatically. Pick the game tab or window when
                  the picker opens so only the game is streamed.
                </p>
              )}
            </div>
          )}

          <div className={`mx-auto grid w-full gap-3 ${playerGridClass}`}>
            {participants.map((participant) => {
              const isMe = participant.user_id === user?.id;
              const speaking = speakingIds.includes(participant.user_id) && !participant.muted;
              const videoStream = isMe
                ? cameraOn && cameraReady
                  ? localCameraStream
                  : null
                : videosByPeer.get(participant.user_id) ?? null;
              const username = participant.user?.username ?? "member";
              const initial = (participant.user?.display_name || username).charAt(0).toUpperCase();
              const tileRow = presenceMap.rows[participant.user_id] ?? null;
              const tileStatus = publicStatusOf(tileRow, isMe);
              const tileCustom = publicCustomStatus(tileRow, isMe);
              const participantSession = gameBot.sessionsById[participant.user_id] ?? null;
              const participantViewing =
                participantSession ??
                gameBot.sessions.find((session) =>
                  gameBot.viewersByHost[session.hostId]?.includes(participant.user_id),
                ) ??
                null;
              const joinedThisGame = participantSession?.hostId === gameBot.viewingHostId;
              const playingGame =
                participantViewing?.game.name ??
                roomActivity.players[participant.user_id]?.gameName ??
                null;

              return (
                <div
                  key={participant.user_id}
                  role="group"
                  aria-label={voiceParticipantLabel({
                    name: participant.user?.display_name || username,
                    speaking,
                    muted: participant.muted,
                    video: !!videoStream,
                  })}
                  style={{ maxHeight: layout.tileMaxHeight }}
                  className={`relative flex min-h-[140px] w-full flex-col items-center justify-center overflow-hidden rounded-2xl border bg-surface-2 p-3 pb-10 transition-[border-color] duration-150 ${
                    videoStream ? "aspect-video" : ""
                  } ${speaking ? "border-primary" : "border-border"}`}
                >
                  {videoStream ? (
                    <VideoTile stream={videoStream} />
                  ) : (
                    <>
                      <div className="relative">
                        <Avatar
                          style={{ width: layout.avatarSize, height: layout.avatarSize }}
                          className={`border-2 transition-[box-shadow] duration-150 ${
                            speaking ? "border-transparent ring-[3px] ring-primary" : "border-border"
                          }`}
                        >
                          <AvatarImage src={participant.user?.avatar_url ?? undefined} />
                          <AvatarFallback className="bg-primary text-primary-foreground text-lg font-bold">{initial}</AvatarFallback>
                        </Avatar>
                        <span className="absolute -bottom-1 -right-1 z-10 grid place-items-center rounded-full bg-background p-[2px]">
                          <StatusDotButton
                            userId={participant.user_id}
                            username={username}
                            status={tileStatus}
                            isSelf={isMe}
                            size={16}
                          />
                        </span>
                        {participant.muted && (
                          <span
                            aria-label="Muted"
                            title="Muted"
                            className="absolute -bottom-1 -left-1 z-20 grid h-6 w-6 place-items-center rounded-full border border-border bg-background text-destructive"
                          >
                            <MicOff className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                      {(playingGame || (tileCustom && (tileCustom.emoji || tileCustom.text))) &&
                        !(participantSession && !isMe) && (
                        <span className="pointer-events-none absolute inset-x-4 bottom-[3.5rem] flex justify-center">
                          {playingGame ? (
                            <span className="max-w-full truncate text-[10px] font-semibold text-[#c8ff3d]">
                              Playing {playingGame}
                            </span>
                          ) : (
                            <CustomStatusLine
                              status={tileCustom!}
                              className="max-w-full truncate text-center text-[10px] text-muted-foreground"
                            />
                          )}
                        </span>
                      )}
                      {participantSession && !isMe && (
                        <button
                          type="button"
                          onClick={() =>
                            joinedThisGame ? openGameSession(participantSession) : joinGameSession(participantSession)
                          }
                          className={`absolute inset-x-0 bottom-[3.1rem] z-20 mx-auto flex h-7 w-fit items-center gap-1 rounded-full px-2.5 text-[10px] font-bold shadow-sm transition active:scale-95 ${
                            joinedThisGame
                              ? "border border-primary/40 bg-black/70 text-primary"
                              : "bg-primary text-primary-foreground"
                          }`}
                        >
                          <Gamepad2 className="h-3 w-3" />
                          {joinedThisGame ? "Open game" : "Join game"}
                        </button>
                      )}
                      <span className="pointer-events-none absolute inset-x-2 bottom-2.5 flex justify-center">
                        <span className="max-w-full truncate rounded-full border border-white/10 bg-black/55 px-3 py-1 text-[11px] font-semibold text-white/90 shadow-sm backdrop-blur-sm">
                          @{username}
                          {isMe && <span className="ml-1 text-white/45">(you)</span>}
                        </span>
                      </span>
                    </>
                  )}

                  {videoStream && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-semibold text-white">
                          @{username}
                          {isMe && " (you)"}
                        </span>
                        {playingGame ? (
                          <span className="block truncate text-[10px] font-semibold text-[#c8ff3d]">
                            Playing {playingGame}
                          </span>
                        ) : (
                          tileCustom &&
                          (tileCustom.emoji || tileCustom.text) && (
                            <CustomStatusLine status={tileCustom} className="truncate text-[10px] text-white/70" />
                          )
                        )}
                      </span>
                      {participant.muted && <MicOff className="h-3.5 w-3.5 shrink-0 text-white/80" />}
                    </div>
                  )}

                  {videoStream && participantSession && !isMe && (
                    <button
                      type="button"
                      onClick={() =>
                        joinedThisGame ? openGameSession(participantSession) : joinGameSession(participantSession)
                      }
                      className={`absolute left-2 top-9 z-20 flex h-8 items-center gap-1 rounded-full px-2.5 text-[10px] font-bold shadow-md transition active:scale-95 ${
                        joinedThisGame
                          ? "border border-primary/50 bg-black/70 text-primary"
                          : "bg-primary text-primary-foreground"
                      }`}
                    >
                      <Gamepad2 className="h-3 w-3" />
                      {joinedThisGame ? "Open game" : "Join game"}
                    </button>
                  )}

                  {!videoStream && speaking && (
                    <span className="absolute left-2 top-2 text-[10px] font-bold uppercase tracking-wider text-primary">Speaking</span>
                  )}
                  {sharingIds.includes(participant.user_id) && (
                    <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full border border-primary/40 bg-background/85 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                      <MonitorPlay className="h-3 w-3" />
                      {gameBot.sessionsById[participant.user_id] ? "Game live" : "Sharing"}
                    </span>
                  )}
                  {!isMe && <PeerVolumeControl userId={participant.user_id} username={username} />}
                </div>
              );
            })}

            </div>

            {/* Bot strip: compact entries under the people grid. Music and game
                are helpers, not people, so they never take a people-sized tile
                and never push the grid into empty space. */}
            <div className="mx-auto mt-3 grid w-full max-w-2xl grid-cols-1 gap-3">
              {musicBot.enabled && (
                <BotCard
                  icon={
                    musicBot.track?.artwork_url ? (
                      <img src={musicBot.track.artwork_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Music className="h-5 w-5" aria-hidden="true" />
                    )
                  }
                  title="Music bot"
                  status={
                    musicBot.track
                      ? `${musicBot.track.title}${musicBot.track.artist ? ` · ${musicBot.track.artist}` : ""}`
                      : "Nothing queued"
                  }
                  action={{
                    label: musicBot.track && !musicBot.blocked ? "Open" : "Play",
                    onClick: () => setMusicOpen(true),
                    primary: !musicBot.track || musicBot.blocked,
                  }}
                  trailing={
                    musicBot.singing ? (
                      <AudioLines className="h-4 w-4" role="img" aria-label="Playing" />
                    ) : undefined
                  }
                  expanded={false}
                  onToggle={() => setMusicOpen(true)}
                />
              )}

              {/* GAME BOT: same BotCard as music, with a shared session state. */}
              <BotCard
                icon={
                  liveGame ? (
                    <img src={liveGame.icon} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Gamepad2 className="h-5 w-5" aria-hidden="true" />
                  )
                }
                title={gameBot.isHost ? "Your game" : "Game bot"}
                status={
                  viewedSession
                    ? `${viewedSession.game.name} · ${viewedSession.status}${
                        gamePlayers > 1 ? ` · ${gamePlayers} players` : ""
                      }`
                    : roomActivity.activity
                      ? `${roomActivity.activity.gameName} · live`
                      : "No game picked"
                }
                action={{
                  label: viewedSession
                    ? gameBot.isHost
                      ? viewedSession.status === "lobby"
                        ? "Start"
                        : "Open"
                      : "Join"
                    : "Pick game",
                  onClick: () => {
                    if (viewedSession && gameBot.isHost && viewedSession.status === "lobby") {
                      gameBot.startGame();
                    } else if (viewedSession) {
                      openGameSession(viewedSession);
                    } else {
                      setGamesOpen(true);
                    }
                  },
                  primary: !viewedSession,
                }}
                expanded={false}
                onToggle={() => setGamesOpen(true)}
              />
            </div>
            </div>
            {playing && !isMobileView && !immersive && roomActivity.activity && (
              <ActivityPanel
                activity={roomActivity.activity}
                entry={gameEntry}
                canEnd={roomActivity.activity.startedBy === user?.id || !!call?.isHost}
                playingCount={playingCount}
                players={Math.max(1, participants.length)}
                minimized={panelMinimized}
                onMinimize={() => setPanelMinimized(true)}
                onReopen={() => setPanelMinimized(false)}
                onLeave={() => setPanelOpen(false)}
                onEnd={() => void handleEndGame()}
                onExpand={() => setImmersive(true)}
              />
            )}
          </div>
        </div>

        {/* One row of circles with the labels underneath. The old caption line
            ("Camera off · mic live") lives on as an aria-live announcement. */}
        <VoiceControlBar
          muted={muted}
          deafened={deafened}
          cameraOn={cameraOn}
          cameraReady={cameraReady}
          activityRunning={!!roomActivity.activity}
          announcement={
            screenError
              ? screenError
              : sharingScreen
                ? isGameStreaming
                  ? "Streaming your game only"
                  : "Sharing your screen"
                : sharingParticipants.length > 0
                  ? `Watching @${sharingParticipants[0].user?.username ?? "someone"}'s screen`
                  : cameraOn
                    ? `Camera on, ${facing === "user" ? "front" : "back"} camera`
                    : `Camera off, ${muted || deafened ? "microphone muted" : "microphone live"}`
          }
          onToggleMute={toggleMute}
          onToggleDeafen={toggleDeafen}
          onToggleCamera={toggleCamera}
          onOpenActivities={() => setGamesOpen(true)}
          onOpenMore={() => setMoreOpen(true)}
          onLeave={handleLeaveClick}
        />

        {/* Voice Settings Sheet */}
        <VoiceSettingsSheet
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          muted={muted}
          onToggleMute={toggleMute}
          participants={participants}
          currentUserId={user?.id}
          peerAudio={peerAudio}
        />

        {/* Music menu — the shared MUSIC BOT sheet, same one the realm voice bar opens */}
        <RealmMusicHub
          open={musicOpen}
          onOpenChange={setMusicOpen}
          realmId={call.realmId}
          roomId={call.channelId}
          roomName={call.channelName}
        />

        {/* Games menu — ready-made games launch into the GAME BOT overlay */}
        <RealmGamesHub
          open={gamesOpen}
          onOpenChange={setGamesOpen}
          realmId={call.realmId}
          roomId={call.channelId}
          roomName={call.channelName}
        />

        {/* Host Leave Confirmation Dialog */}        <AlertDialog open={confirmLeaveOpen} onOpenChange={setConfirmLeaveOpen}>
          <AlertDialogContent className="glass-strong border-white/10 max-w-sm">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-display">Leave & End Call?</AlertDialogTitle>
              <AlertDialogDescription>
                You are the host of this voice call. Leaving will end the call for everyone in the room.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="glass border-white/10">Stay</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setConfirmLeaveOpen(false);
                  leaveCall();
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Leave & End Call
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* THE OVERLAY: the game is the background, the voice dock floats on
            top of it. Voice keeps running because the call engine belongs to
            the provider — this is only a sibling layer. */}
        {playing && immersive && roomActivity.activity && (
          <VoiceActivityOverlay
            activity={roomActivity.activity}
            entry={gameEntry}
            canEnd={roomActivity.activity.startedBy === user?.id || !!call?.isHost}
            playingCount={playingCount}
            players={Math.max(1, participants.length)}
            onExit={() => {
              // Phones have no side panel to fall back to, so "back to voice"
              // there means leaving the game view (the activity stays live).
              if (isMobileView) setPanelOpen(false);
              else setImmersive(false);
            }}
            onLeaveGame={() => {
              setPanelOpen(false);
              setImmersive(true);
            }}
            onEnd={() => void handleEndGame()}
          />
        )}

        {/* More — chat, share, invite and voice settings live here so the
            control bar stays five controls wide on a 360px phone. */}
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetContent
            side="bottom"
            className="glass-strong rounded-t-3xl border-white/10 p-4"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
          >
            <SheetHeader className="mb-3 text-left">
              <SheetTitle className="font-display text-sm font-bold">Call options</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                className="h-12 justify-start gap-2 rounded-xl text-[13px]"
                onClick={() => {
                  setMoreOpen(false);
                  setChatOpen(true);
                }}
              >
                <MessageSquare className="h-4 w-4 text-primary" /> Text chat
              </Button>
              <Button
                variant="secondary"
                className="h-12 justify-start gap-2 rounded-xl text-[13px]"
                disabled={!screenSupported}
                onClick={() => {
                  setMoreOpen(false);
                  toggleScreenShare();
                }}
              >
                {sharingScreen ? <ScreenShareOff className="h-4 w-4 text-primary" /> : <ScreenShare className="h-4 w-4 text-primary" />}
                {sharingScreen ? "Stop sharing" : "Share screen"}
              </Button>
              <Button
                variant="secondary"
                className="h-12 justify-start gap-2 rounded-xl text-[13px]"
                disabled={!screenSupported}
                onClick={() => {
                  setMoreOpen(false);
                  if (isGameStreaming) toggleScreenShare();
                  else startGameShare();
                }}
              >
                <Radio className="h-4 w-4 text-primary" />
                {isGameStreaming ? "Stop game stream" : "Stream a game"}
              </Button>
              <Button
                variant="secondary"
                className="h-12 justify-start gap-2 rounded-xl text-[13px]"
                onClick={() => {
                  setMoreOpen(false);
                  void navigator.clipboard
                    ?.writeText(window.location.href)
                    .then(() => toast.success("Call link copied"))
                    .catch(() => toast.error("Couldn't copy the link"));
                }}
              >
                <UserPlus className="h-4 w-4 text-primary" /> Invite
              </Button>
              <Button
                variant="secondary"
                className="col-span-2 h-12 justify-start gap-2 rounded-xl text-[13px]"
                onClick={() => {
                  setMoreOpen(false);
                  setSettingsOpen(true);
                }}
              >
                <Sliders className="h-4 w-4 text-primary" /> Voice settings
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* VC Chat Sheet */}
        <Sheet open={chatOpen} onOpenChange={setChatOpen}>
          <SheetContent side="right" className="glass-strong border-white/10 w-full sm:max-w-md p-0 flex flex-col z-[140]">
            <SheetHeader className="p-4 pr-12 border-b border-white/10 flex flex-row items-center justify-between">
              <SheetTitle className="font-display text-sm font-bold flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" /> VC Text Chat
              </SheetTitle>
            </SheetHeader>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
              {roomMessages.isLoading && (
                <p className="py-6 text-center text-xs text-muted-foreground">Loading chat…</p>
              )}
              {!roomMessages.isLoading && (roomMessages.data ?? []).length === 0 && (
                <p className="py-12 text-center text-xs text-muted-foreground">No messages in VC chat yet. Say hello!</p>
              )}
              {roomMessages.data?.map((msg) => {
                const author = ((msg as any).author ?? (msg as any).sender ?? {}) as any;
                const aName = author.display_name || author.username || "user";
                return (
                  <div key={msg.id} className="flex items-start gap-2 text-xs">
                    <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                      <AvatarImage src={author.avatar_url ?? undefined} />
                      <AvatarFallback className="text-[9px] bg-primary text-primary-foreground font-bold">
                        {aName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-semibold text-foreground truncate">{aName}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-foreground/90 mt-0.5 whitespace-pre-wrap break-words leading-relaxed">
                        {msg.body}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3 border-t border-white/10 bg-black/20 shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (chatBody.trim() && user) sendMut.mutate();
                }}
                className="flex items-center gap-2"
              >
                <input
                  value={chatBody}
                  onChange={(e) => setChatBody(e.target.value)}
                  placeholder="Message voice chat…"
                  maxLength={500}
                  className="flex-1 h-10 px-3.5 rounded-full border border-white/10 bg-black/40 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!chatBody.trim() || sendMut.isPending}
                  className="h-10 w-10 shrink-0 rounded-full bg-primary text-primary-foreground"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </FullScreenLayer>
  );
}
