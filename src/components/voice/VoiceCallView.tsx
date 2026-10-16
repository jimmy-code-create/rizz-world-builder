import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, Gamepad2, Music, MonitorPlay, Mic, MicOff, PhoneOff, RefreshCw, ScreenShare, ScreenShareOff, SwitchCamera, Video, VideoOff, Volume2, VolumeX, Wifi, Sliders, MessageSquare, X, Send, Headphones } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FullScreenLayer } from "@/components/FullScreenLayer";
import { VoiceSettingsSheet } from "@/components/voice/VoiceSettingsSheet";
import { useAuth } from "@/lib/auth";
import { useVoiceCallContext } from "@/components/voice/VoiceCallProvider";
import { musicBotControls, useMusicBotInCall } from "@/components/voice/MusicBotInCall";
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
import { MusicSheet } from "@/components/chat/MusicSheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { publicCustomStatus, publicStatusOf, usePresenceMap } from "@/lib/presence";
import { CustomStatusLine, StatusDotButton } from "@/components/presence/StatusDot";
import { ActivityPanel, JoinGameBanner } from "@/components/voice/ActivityPanel";
import { VoiceActivityOverlay } from "@/components/voice/VoiceActivityOverlay";
import { VideoTile } from "@/components/voice/VideoTile";
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
    speakingIds,
    remoteStreams,
    localCameraStream,
    localScreenStream,
    remoteScreenStreams,
    sharingScreen,
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
    leaveCall,
    retry,
  } = useVoiceCallContext();

  // MUSIC BOT joins the call as a participant (see MusicBotInCall for the audio).
  const musicBot = useMusicBotInCall();

  const nav = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const [panelMinimized, setPanelMinimized] = useState(false);
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
  const selfName =
    participants.find((participant) => participant.user_id === user?.id)?.user?.display_name ||
    participants.find((participant) => participant.user_id === user?.id)?.user?.username ||
    "Someone";
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
  const openGamesHub = () => {
    // The hub is a page, so the call view has to step aside first — the call
    // itself keeps running (it is owned by the provider, not by this view).
    closeView();
    void nav({ to: "/games" });
  };

  if (!call || !viewOpen) return null;

  const videosByPeer = new Map(
    remoteStreams.map(({ peerId, stream }) => [peerId, stream.getVideoTracks().some((track) => track.readyState === "live") ? stream : null]),
  );

  // The stage shows one shared screen: mine while I am sharing, otherwise the
  // first peer whose roster flag says they are sharing.
  const sharingParticipants = participants.filter((participant) => sharingIds.includes(participant.user_id));
  const remoteShare = remoteScreenStreams.find(({ stream }) => stream.getVideoTracks().some((track) => track.readyState === "live")) ?? null;
  const stageStream = sharingScreen ? localScreenStream : remoteShare?.stream ?? null;
  const stageOwner = sharingScreen
    ? "you"
    : participants.find((participant) => participant.user_id === remoteShare?.peerId)?.user?.username ?? "someone";

  return (
    // A voice call takes over the screen: the tiles, the music bot and the
    // controls get the whole viewport, and the minimize button drops back to the
    // chat without ending the call.
    <FullScreenLayer open>
      <div
        className="fixed inset-0 z-[130] flex flex-col bg-[#0b0714] text-foreground"
        style={{ height: "100dvh", paddingTop: "env(safe-area-inset-top)" }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(70% 45% at 50% 0%, rgba(201,255,61,0.14), transparent 65%)" }}
        />
        <header className="relative flex shrink-0 items-center gap-3 border-b border-white/5 px-4 pb-3 pt-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Voice channel</p>
            <h1 className="truncate font-display text-lg font-bold leading-tight">{call.channelName}</h1>
            <p role={error ? "alert" : undefined} className={`mt-0.5 flex items-center gap-1.5 text-xs ${error ? "text-destructive" : "text-muted-foreground"}`}>
              {!error && <Wifi className="h-3 w-3" />}
              {error ??
                `${status} · ${participants.length + (musicBot.enabled ? 1 : 0)} ${
                  participants.length + (musicBot.enabled ? 1 : 0) === 1 ? "person" : "people"
                }`}
            </p>
          </div>
          {error && (
            <Button variant="outline" size="sm" className="glass border-white/10" onClick={retry}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            aria-label="Open VC text chat"
            className={`glass h-11 w-11 shrink-0 border-white/10 ${chatOpen ? "bg-primary/20 text-primary border-primary/50" : ""}`}
            onClick={() => setChatOpen((v) => !v)}
            title="VC Text Chat"
          >
            <MessageSquare className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Games hub"
            className={`glass h-11 w-11 shrink-0 border-white/10 ${panelOpen ? "bg-primary/20 text-primary border-primary/50" : ""}`}
            onClick={openGamesHub}
            title="Games hub"
          >
            <Gamepad2 className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Music"
            className={`glass h-11 w-11 shrink-0 border-white/10 ${musicOpen ? "bg-primary/20 text-primary border-primary/50" : ""}`}
            onClick={() => setMusicOpen(true)}
            title="Music"
          >
            <Music className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Voice settings"
            className={`glass h-11 w-11 shrink-0 border-white/10 ${settingsOpen ? "bg-primary/20 text-primary border-primary/50" : ""}`}
            onClick={() => setSettingsOpen(true)}
            title="Voice Settings"
          >
            <Sliders className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Minimize call"
            className="glass h-11 w-11 shrink-0 border-white/10"
            onClick={closeView}
          >
            <ChevronDown className="h-5 w-5" />
          </Button>
        </header>

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

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4">
          <div className="mx-auto flex w-full max-w-6xl items-start gap-3">
            <div className="min-w-0 flex-1">
          {stageStream && (
            <div className="mx-auto mb-4 w-full max-w-4xl overflow-hidden rounded-3xl border border-primary/40 bg-black shadow-md">
              <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-black/60 px-3 py-2">
                <span className="flex min-w-0 items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-primary">
                  <MonitorPlay className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{sharingScreen ? "Your screen" : `Screen shared by @${stageOwner}`}</span>
                </span>
                {sharingScreen && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 border-destructive/40 bg-destructive/15 px-2.5 text-xs text-destructive hover:bg-destructive/25"
                    onClick={toggleScreenShare}
                  >
                    Stop sharing
                  </Button>
                )}
              </div>
              <VideoTile stream={stageStream} />
            </div>
          )}

          <div className="mx-auto grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3">
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
              const playingGame = roomActivity.players[participant.user_id]?.gameName ?? null;

              return (
                <div
                  key={participant.user_id}
                  className={`relative flex aspect-square flex-col items-center justify-center gap-2 overflow-hidden rounded-3xl border p-3 transition-all duration-200 ${
                    speaking
                      ? "border-primary bg-primary/10 shadow-[0_0_0_2px_hsl(var(--primary)),0_0_24px_rgba(200,255,61,0.35)]"
                      : "border-white/10 glass"
                  }`}
                >
                  {videoStream ? (
                    <VideoTile stream={videoStream} />
                  ) : (
                    <>
                      <div className="relative">
                        <Avatar
                          className={`h-16 w-16 transition-all duration-200 ${
                            speaking
                              ? "ring-4 ring-primary ring-offset-2 ring-offset-[#0b0714] shadow-[0_0_18px_rgba(200,255,61,0.65)]"
                              : ""
                          }`}
                        >
                          <AvatarImage src={participant.user?.avatar_url ?? undefined} />
                          <AvatarFallback className="bg-primary text-primary-foreground text-lg font-bold">{initial}</AvatarFallback>
                        </Avatar>
                        <span className="absolute -bottom-1 -right-1 z-10 grid place-items-center rounded-full bg-[#0b0714] p-[2px]">
                          <StatusDotButton
                            userId={participant.user_id}
                            username={username}
                            status={tileStatus}
                            isSelf={isMe}
                            size={16}
                          />
                        </span>
                        {speaking && (
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute -inset-1 rounded-full animate-ping bg-primary/30"
                          />
                        )}
                      </div>
                      <p className="max-w-full truncate text-xs font-semibold">
                        @{username}
                        {isMe && <span className="ml-1 text-muted-foreground">(you)</span>}
                      </p>
                      {playingGame ? (
                        <span className="max-w-full truncate text-[11px] font-semibold text-[#c8ff3d]">
                          Playing {playingGame}
                        </span>
                      ) : (
                        tileCustom &&
                        (tileCustom.emoji || tileCustom.text) && (
                          <span className="max-w-full">
                            <CustomStatusLine status={tileCustom} className="-mt-1 truncate text-[11px]" />
                          </span>
                        )
                      )}
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

                  {!videoStream && participant.muted && (
                    <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-background/80" aria-label="Muted">
                      <MicOff className="h-3.5 w-3.5 text-destructive" />
                    </span>
                  )}
                  {!videoStream && speaking && (
                    <span className="absolute left-2 top-2 text-[10px] font-bold uppercase tracking-wider text-primary">Speaking</span>
                  )}
                  {sharingIds.includes(participant.user_id) && !sharingScreen && (
                    <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full border border-primary/40 bg-background/85 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                      <MonitorPlay className="h-3 w-3" /> Sharing
                    </span>
                  )}
                  {!isMe && <PeerVolumeControl userId={participant.user_id} username={username} />}
                </div>
              );
            })}

            {musicBot.enabled && (
              <button
                type="button"
                onClick={() => setMusicOpen(true)}
                aria-label="Open music controls"
                className="relative flex aspect-square flex-col items-center justify-center gap-2 overflow-hidden rounded-3xl border border-emerald-400/40 bg-emerald-400/[0.07] p-3 text-center transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d]"
              >
                <span className="absolute left-2 top-2 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-200">
                  {!musicBot.track
                    ? "In call"
                    : musicBot.blocked
                      ? "Tap to play"
                      : musicBot.singing
                        ? "Singing"
                        : "Paused"}
                </span>
                <Avatar className={`h-16 w-16 ${musicBot.singing ? "ring-2 ring-emerald-400" : ""}`}>
                  <AvatarImage src={musicBot.track?.artwork_url ?? undefined} alt="" />
                  <AvatarFallback className="bg-emerald-500/25 text-emerald-100">
                    <Music className="h-6 w-6" aria-hidden="true" />
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 px-1">
                  <span className="block truncate text-xs font-semibold">MUSIC BOT</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {musicBot.track
                      ? `${musicBot.track.title}${musicBot.track.artist ? ` · ${musicBot.track.artist}` : ""}`
                      : "Nothing queued — tap for music"}
                  </span>
                </span>
              </button>
            )}
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

        {/* Music section: full now-playing + queue + transport live in the
            music sheet now; the tile above is just an icon entry point. */}
        <div
          className="relative shrink-0 border-t border-white/5 glass-strong px-2 sm:px-4 pt-3"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
        >
          <div className="mx-auto flex max-w-lg items-center justify-between sm:justify-center gap-1.5 sm:gap-3">
            {/* Mute */}
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? "Unmute microphone" : "Mute microphone"}
              aria-pressed={!muted}
              className={`flex min-h-[50px] min-w-[52px] sm:min-w-[60px] flex-col items-center justify-center rounded-2xl px-2 py-1.5 transition-all active:scale-95 ${
                muted
                  ? "border border-destructive/30 bg-destructive/15 text-destructive hover:bg-destructive/25"
                  : "bg-primary text-primary-foreground shadow-sm hover:brightness-105"
              }`}
            >
              {muted ? <MicOff className="h-5 w-5 mb-0.5" /> : <Mic className="h-5 w-5 mb-0.5" />}
              <span className="text-[10px] font-semibold leading-none">{muted ? "Unmute" : "Mute"}</span>
            </button>

            {/* Deafen */}
            <button
              type="button"
              onClick={toggleDeafen}
              aria-label={deafened ? "Undeafen incoming audio" : "Deafen incoming audio"}
              aria-pressed={deafened}
              className={`flex min-h-[50px] min-w-[52px] sm:min-w-[60px] flex-col items-center justify-center rounded-2xl px-2 py-1.5 transition-all active:scale-95 ${
                deafened
                  ? "border border-destructive/30 bg-destructive/15 text-destructive hover:bg-destructive/25"
                  : "glass border-white/10 text-foreground hover:bg-white/10"
              }`}
            >
              {deafened ? <VolumeX className="h-5 w-5 mb-0.5 text-destructive" /> : <Headphones className="h-5 w-5 mb-0.5" />}
              <span className="text-[10px] font-semibold leading-none">{deafened ? "Undeafen" : "Deafen"}</span>
            </button>

            {/* Share Screen */}
            <button
              type="button"
              onClick={toggleScreenShare}
              disabled={!screenSupported}
              title={screenSupported ? undefined : "Screen sharing isn't available in this browser."}
              aria-label={sharingScreen ? "Stop sharing screen" : "Share screen"}
              aria-pressed={sharingScreen}
              className={`flex min-h-[50px] min-w-[52px] sm:min-w-[60px] flex-col items-center justify-center rounded-2xl px-2 py-1.5 transition-all active:scale-95 disabled:opacity-40 ${
                sharingScreen
                  ? "bg-primary text-primary-foreground shadow-sm hover:brightness-105"
                  : "glass border-white/10 text-foreground hover:bg-white/10"
              }`}
            >
              {sharingScreen ? <ScreenShareOff className="h-5 w-5 mb-0.5" /> : <ScreenShare className="h-5 w-5 mb-0.5" />}
              <span className="text-[10px] font-semibold leading-none">{sharingScreen ? "Stop" : "Share"}</span>
            </button>

            {/* Camera */}
            <button
              type="button"
              onClick={toggleCamera}
              aria-label={cameraOn ? "Turn camera off" : "Turn camera on"}
              aria-pressed={cameraOn}
              className={`flex min-h-[50px] min-w-[52px] sm:min-w-[60px] flex-col items-center justify-center rounded-2xl px-2 py-1.5 transition-all active:scale-95 ${
                cameraOn
                  ? "bg-primary text-primary-foreground shadow-sm hover:brightness-105"
                  : "glass border-white/10 text-foreground hover:bg-white/10"
              }`}
            >
              {cameraOn ? <Video className="h-5 w-5 mb-0.5" /> : <VideoOff className="h-5 w-5 mb-0.5" />}
              <span className="text-[10px] font-semibold leading-none">Camera</span>
            </button>

            {/* Settings */}
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Voice settings"
              className="glass border-white/10 text-foreground hover:bg-white/10 flex min-h-[50px] min-w-[52px] sm:min-w-[60px] flex-col items-center justify-center rounded-2xl px-2 py-1.5 transition-all active:scale-95"
            >
              <Sliders className="h-5 w-5 mb-0.5 text-primary" />
              <span className="text-[10px] font-semibold leading-none">Settings</span>
            </button>

            {/* Leave */}
            <Button
              variant="outline"
              aria-label="Leave call"
              onClick={handleLeaveClick}
              className="min-h-[50px] rounded-2xl border-destructive/40 bg-destructive/15 px-4 sm:px-6 text-destructive hover:bg-destructive/25 font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <PhoneOff className="h-5 w-5" />
              <span>Leave</span>
            </Button>
          </div>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            {sharingScreen
              ? "Sharing your screen"
              : sharingParticipants.length > 0
                ? `Watching @${sharingParticipants[0].user?.username ?? "someone"}'s screen`
                : cameraOn
                  ? `Camera on · ${facing === "user" ? "front" : "back"}`
                  : "Camera off · mic " + (muted ? "muted" : "live")}
          </p>
          {screenError && <p role="alert" className="mt-1 text-center text-[10px] text-destructive">{screenError}</p>}
        </div>

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

        <MusicSheet
          open={musicOpen}
          onOpenChange={setMusicOpen}
          realmId={call.realmId}
          roomId={call.channelId}
          nowPlaying={
            musicBot.enabled
              ? {
                  title: musicBot.track?.title ?? null,
                  artist: musicBot.track?.artist ?? null,
                  artworkUrl: musicBot.track?.artwork_url ?? null,
                  singing: musicBot.singing,
                  blocked: musicBot.blocked,
                  canToggle: !!musicBot.track?.preview_url,
                  note: musicBot.note ?? null,
                }
              : null
          }
          onToggleNowPlaying={() => musicBotControls.toggle()}
          onRetryNowPlaying={() => musicBotControls.retry()}
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
