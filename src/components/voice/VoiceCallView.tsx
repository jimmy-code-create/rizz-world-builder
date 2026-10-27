import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ChevronDown,
  Gamepad2,
  Music,
  MonitorPlay,
  Mic,
  MicOff,
  PhoneOff,
  Radio,
  RefreshCw,
  ScreenShare,
  ScreenShareOff,
  SwitchCamera,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  Wifi,
  Sliders,
  MessageSquare,
  X,
  Send,
  Headphones,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FullScreenLayer } from "@/components/FullScreenLayer";
import { VoiceSettingsSheet } from "@/components/voice/VoiceSettingsSheet";
import { useAuth } from "@/lib/auth";
import { useVoiceCallContext, useVoiceSpeaking } from "@/components/voice/VoiceCallProvider";
import { setMusicBotDismissed, useMusicBotInCall } from "@/components/voice/MusicBotInCall";
import { channelVolume, useSoundSettings, formatVolume } from "@/lib/sound-settings";
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
import type { GameSession } from "@/lib/game-sessions";
import { useIsMobile } from "@/hooks/use-mobile";
import { publicCustomStatus, publicStatusOf, usePresenceMap } from "@/lib/presence";
import { CustomStatusLine, StatusDotButton } from "@/components/presence/StatusDot";
import { ActivityPanel, JoinGameBanner } from "@/components/voice/ActivityPanel";
import { VoiceActivityOverlay } from "@/components/voice/VoiceActivityOverlay";
import { VideoTile } from "@/components/voice/VideoTile";
import { getGame, useRoomActivity, type RoomActivity } from "@/lib/activities";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ResponsiveOverlay } from "@/components/ui/responsive-overlay";
import { SlashCommandMenu, wrapIndex } from "@/components/bots/SlashCommandMenu";
import { filterSlashCommands, insertSlashCommand, parseSlashCommand } from "@/lib/bot-commands";
import { VOICE_BOT_COMMANDS, voiceBotCommand } from "@/lib/voice-bot-commands";
import { setGameBotHidden, useGameBotHidden } from "@/lib/call-bots";
import { isMusicCommand, runMusicCommand } from "@/lib/music";
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

/**
 * One person's settings in the call: what you hear from them, and — for the
 * host — the way to take them out of it.
 *
 * This used to be a popover pinned to a 28px volume dot in the corner of the
 * tile, so "manage" was hidden behind a small target. Now the whole tile answers
 * a long press (or a right-click) and opens this as a bottom sheet, the same way
 * the bot cards are managed.
 */
function ParticipantSheet({
  userId,
  username,
  canKick,
  open,
  onOpenChange,
  onKick,
}: {
  userId: string;
  username: string;
  canKick: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onKick: () => void;
}) {
  const peerAudio = usePeerAudio();
  const muted = peerAudio.muted.includes(userId);
  const committed = peerVolumeOf(peerAudio, userId);
  // Local draft while dragging; the global store (and every subscriber)
  // updates once on release instead of per tick.
  const [draft, setDraft] = useState<number | null>(null);
  const volume = draft ?? committed;

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title={`@${username}`}
      description="Volume and mute only change what you hear."
      // Above the call layer (z-130), otherwise the sheet opens behind it.
      zIndex={150}
    >
      <div className="space-y-4">
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
              const value = next ?? draft ?? committed;
              setDraft(null);
              setPeerVolume(userId, value);
            }}
            aria-label={`Volume for @${username}`}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => togglePeerMute(userId)}
          className="h-11 w-full gap-2 border-white/10 bg-white/5"
        >
          {muted ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          {muted ? `Unmute @${username}` : `Mute @${username}`}
        </Button>
        {canKick && (
          <>
            <div aria-hidden className="h-px bg-white/10" />
            <Button
              type="button"
              variant="outline"
              onClick={onKick}
              className="h-11 w-full justify-center gap-2 border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
            >
              <PhoneOff className="h-4 w-4" />
              Remove from call
            </Button>
            <p className="text-[11px] text-muted-foreground">
              They leave this call right away and can join again unless you ban them in the realm.
            </p>
          </>
        )}
      </div>
    </ResponsiveOverlay>
  );
}

/**
 * The bottom control bar, memoized.
 *
 * Every button here is a plain, unblurred surface with a colour transition: the
 * backdrop blur each one used to carry forced a full-screen re-sample on every
 * press (and while the tiles animated), which is what made the bar feel sticky
 * on a phone. Nothing in this component re-renders unless a call state it
 * actually draws changes.
 */
const CallControls = memo(function CallControls({
  muted,
  deafened,
  cameraOn,
  sharingScreen,
  isGameStreaming,
  screenSupported,
  onToggleMute,
  onToggleDeafen,
  onToggleScreenShare,
  onToggleGameShare,
  onToggleCamera,
  onOpenSettings,
  onLeave,
}: {
  muted: boolean;
  deafened: boolean;
  cameraOn: boolean;
  sharingScreen: boolean;
  isGameStreaming: boolean;
  screenSupported: boolean;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onToggleScreenShare: () => void;
  onToggleGameShare: () => void;
  onToggleCamera: () => void;
  onOpenSettings: () => void;
  onLeave: () => void;
}) {
  const base =
    "flex min-h-[50px] min-w-[52px] sm:min-w-[60px] flex-col items-center justify-center rounded-2xl px-2 py-1.5 transition-colors";
  const idle = "border border-white/10 bg-[#1a1530] text-foreground hover:bg-[#241d40]";
  const on = "border border-primary/40 bg-primary text-primary-foreground hover:brightness-105";
  const danger =
    "border border-destructive/30 bg-destructive/15 text-destructive hover:bg-destructive/25";

  return (
    <div className="mx-auto flex max-w-lg items-center justify-between gap-1.5 sm:justify-center sm:gap-3">
      <button
        type="button"
        onClick={onToggleMute}
        aria-label={muted ? "Unmute microphone" : "Mute microphone"}
        aria-pressed={!muted}
        className={`${base} ${muted ? danger : on}`}
      >
        {muted ? <MicOff className="mb-0.5 h-5 w-5" /> : <Mic className="mb-0.5 h-5 w-5" />}
        <span className="text-[10px] font-semibold leading-none">{muted ? "Unmute" : "Mute"}</span>
      </button>

      <button
        type="button"
        onClick={onToggleDeafen}
        aria-label={deafened ? "Undeafen incoming audio" : "Deafen incoming audio"}
        aria-pressed={deafened}
        className={`${base} ${deafened ? danger : idle}`}
      >
        {deafened ? (
          <VolumeX className="mb-0.5 h-5 w-5 text-destructive" />
        ) : (
          <Headphones className="mb-0.5 h-5 w-5" />
        )}
        <span className="text-[10px] font-semibold leading-none">
          {deafened ? "Undeafen" : "Deafen"}
        </span>
      </button>

      <button
        type="button"
        // Never disabled: a dead-looking button was the complaint. When the
        // browser cannot capture, the tap explains why instead of doing nothing.
        onClick={onToggleScreenShare}
        aria-label={sharingScreen ? "Stop sharing screen" : "Share screen"}
        aria-pressed={sharingScreen}
        className={`${base} ${sharingScreen ? on : idle}`}
      >
        {sharingScreen ? (
          <ScreenShareOff className="mb-0.5 h-5 w-5" />
        ) : (
          <ScreenShare className="mb-0.5 h-5 w-5" />
        )}
        <span className="text-[10px] font-semibold leading-none">
          {sharingScreen ? "Stop" : "Share"}
        </span>
      </button>

      <button
        type="button"
        onClick={onToggleGameShare}
        aria-label={isGameStreaming ? "Stop game stream" : "Stream only your game"}
        aria-pressed={isGameStreaming}
        className={`${base} ${isGameStreaming ? on : idle}`}
      >
        <Radio className="mb-0.5 h-5 w-5" />
        <span className="text-[10px] font-semibold leading-none">
          {isGameStreaming ? "Stop" : "Game"}
        </span>
      </button>

      <button
        type="button"
        onClick={onToggleCamera}
        aria-label={cameraOn ? "Turn camera off" : "Turn camera on"}
        aria-pressed={cameraOn}
        className={`${base} ${cameraOn ? on : idle}`}
      >
        {cameraOn ? (
          <Video className="mb-0.5 h-5 w-5" />
        ) : (
          <VideoOff className="mb-0.5 h-5 w-5" />
        )}
        <span className="text-[10px] font-semibold leading-none">Camera</span>
      </button>

      <button
        type="button"
        onClick={onOpenSettings}
        aria-label="Voice settings"
        className={`${base} ${idle}`}
      >
        <Sliders className="mb-0.5 h-5 w-5 text-primary" />
        <span className="text-[10px] font-semibold leading-none">Settings</span>
      </button>

      <Button
        variant="outline"
        aria-label="Leave call"
        onClick={onLeave}
        className="flex min-h-[50px] items-center gap-1.5 rounded-2xl border-destructive/40 bg-destructive/15 px-4 text-xs font-bold text-destructive transition-colors hover:bg-destructive/25 active:scale-95 sm:px-6"
      >
        <PhoneOff className="h-4 w-4" />
        Leave
      </Button>
    </div>
  );
});

/**
 * Plays a remote participant's audio. Video tracks are ignored here.
 *
 * Volume and output device come from Voice & Sound. `setSinkId` is only present
 * in some browsers, so the picker is best-effort: when it is missing, playback
 * stays on the system default instead of failing.
 */
function RemoteAudio({
  stream,
  onBlocked,
  peerId,
  deafened = false,
}: {
  stream: MediaStream;
  onBlocked: () => void;
  peerId?: string;
  deafened?: boolean;
}) {
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
        <RemoteAudio
          key={peerId}
          stream={stream}
          peerId={peerId}
          onBlocked={markPlaybackBlocked}
          deafened={deafened}
        />
      ))}
    </>
  );
}

/**
 * Memoised on purpose. The provider holds the engine, so it re-renders whenever
 * speaking levels change (up to ~5x a second in a live conversation). Without
 * this boundary the whole call surface — grid, chat sheet, bot panels, stage —
 * went through a render on every one of those ticks, which is what made taps on
 * the control bar feel late. Now only <SpeakingTiles> reacts to the audio.
 */
export const VoiceCallView = memo(function VoiceCallView() {
  const { user } = useAuth();
  const {
    call,
    viewOpen,
    closeView,
    participants,
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
    kickFromCall,
    retry,
  } = useVoiceCallContext();

  // Sharing is a Set so the per-tile check stays O(1). Speaking levels are
  // read inside <SpeakingTiles> only, so an audio tick never re-renders the
  // sheet, the panels, the stage or the control bar.
  const sharingSet = useMemo(() => new Set(sharingIds), [sharingIds]);
  const videosByPeer = useMemo(
    () =>
      new Map(
        remoteStreams.map(({ peerId, stream }) => [
          peerId,
          stream.getVideoTracks().some((track) => track.readyState === "live") ? stream : null,
        ]),
      ),
    [remoteStreams],
  );
  // The stage shows one shared screen: mine while I am sharing, otherwise the
  // first peer whose roster flag says they are sharing.
  const sharingParticipants = useMemo(
    () => participants.filter((participant) => sharingSet.has(participant.user_id)),
    [participants, sharingSet],
  );

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
  const [chatOpen, setChatOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const [gamesOpen, setGamesOpen] = useState(false);
  const [panelMinimized, setPanelMinimized] = useState(false);
  const [selectedSharePeerId, setSelectedSharePeerId] = useState<string | null>(null);
  // Which participant's settings sheet is open (long-press on their tile).
  const [participantSheet, setParticipantSheet] = useState<string | null>(null);
  // GAME BOT visibility lives in a shared store: the tile, the in-call chat and a
  // /game command typed anywhere all have to be able to bring it back.
  const gameHidden = useGameBotHidden();
  // Immersive = game as the background with the voice dock floating over it.
  // Toggling it off keeps the game open as a side panel (desktop only).
  const [immersive, setImmersive] = useState(true);
  const [bannerDismissedAt, setBannerDismissedAt] = useState<number | null>(null);
  // One panel layout at a time: mounting both side + overlay iframes loaded
  // the game twice (double audio, double CPU) on every screen size.
  const isMobileView = useIsMobile();
  const [soundSettings, setSoundSettings] = useSoundSettings();
  const [chatBody, setChatBody] = useState("");
  const [chatSlashIndex, setChatSlashIndex] = useState(0);
  const [chatSlashHidden, setChatSlashHidden] = useState(false);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const peerAudio = usePeerAudio();
  const qc = useQueryClient();
  const presenceMap = usePresenceMap(participants.map((participant) => participant.user_id));

  // The view stays mounted while minimized so games and streams keep running
  // in the background, but its sheets portal to <body> and would stay on top
  // of the app — close them when the call is put away.
  useEffect(() => {
    if (viewOpen) return;
    setChatOpen(false);
    setSettingsOpen(false);
    setMusicOpen(false);
    setGamesOpen(false);
    setConfirmLeaveOpen(false);
  }, [viewOpen]);

  // Stable handlers: the memoized control bar and the participant sheet must
  // not re-render (or re-create their own children) just because the view did.
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  // Whole-tile long press: 320ms with a 20px movement allowance, so dragging the
  // list to scroll never opens a sheet, and small finger jitter still counts.
  const tilePressTimer = useRef<number | null>(null);
  const tilePressOrigin = useRef<{ x: number; y: number } | null>(null);
  const clearTilePress = useCallback(() => {
    if (tilePressTimer.current !== null) {
      window.clearTimeout(tilePressTimer.current);
      tilePressTimer.current = null;
    }
    tilePressOrigin.current = null;
  }, []);
  const beginTilePress = useCallback(
    (event: React.PointerEvent, userId: string) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if ((event.target as HTMLElement).closest("button, a, input, textarea, [data-interactive]"))
        return;
      clearTilePress();
      tilePressOrigin.current = { x: event.clientX, y: event.clientY };
      tilePressTimer.current = window.setTimeout(() => {
        tilePressTimer.current = null;
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          try {
            navigator.vibrate(35);
          } catch {
            // A device without vibration must not break the gesture.
          }
        }
        setParticipantSheet(userId);
      }, 320);
    },
    [clearTilePress],
  );
  const moveTilePress = useCallback(
    (event: React.PointerEvent) => {
      const origin = tilePressOrigin.current;
      if (!origin || tilePressTimer.current === null) return;
      if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 20) clearTilePress();
    },
    [clearTilePress],
  );
  const endTilePress = useCallback(() => clearTilePress(), [clearTilePress]);
  const handleLeaveClick = useCallback(() => {
    if (call?.isHost && participants.length > 1) {
      setConfirmLeaveOpen(true);
    } else {
      leaveCall();
    }
  }, [call?.isHost, participants.length, leaveCall]);


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

  // ---- slash commands in the call chat -------------------------------------
  // Typing "/" here offers the two voice bots and MUSIC BOT's own commands, so
  // a bot can be invited into the call (or made to play something) from the
  // chat, exactly like a chat bot is invoked. Anything that is not a command is
  // posted as a message.
  const chatSlash = parseSlashCommand(chatBody);
  const chatSlashMatches = chatSlash
    ? filterSlashCommands(VOICE_BOT_COMMANDS, chatSlash.name)
    : [];
  const chatSlashOpen = !!chatSlash && chatSlash.typingName && !chatSlashHidden;
  const chatSlashActive = Math.min(chatSlashIndex, Math.max(chatSlashMatches.length - 1, 0));

  const bringBotIn = (bot: "music" | "game", args: string) => {
    if (!call) return;
    if (bot === "music") {
      setMusicBotDismissed(false);
      if (!musicBot.enabled) {
        toast.error("MUSIC BOT isn't enabled in this realm", {
          description: "A mod can add it under realm settings → Bots.",
        });
        return;
      }
      const query = args.trim();
      if (!query) {
        toast.success("MUSIC BOT joined the call", { description: "Type /play <song> or open its card." });
        return;
      }
      void runMusicCommand("play", { args: query, realmId: call.realmId, roomId: call.channelId })
        .then((result) => {
          if (result.ok) toast.success("MUSIC BOT is on it", { description: query });
          else toast.error(result.error ?? "MUSIC BOT couldn't play that");
        })
        .catch((error: unknown) =>
          toast.error(error instanceof Error ? error.message : "MUSIC BOT didn't answer"),
        );
      return;
    }
    setGameBotHidden(false);
    toast.success("GAME BOT is back in the call", { description: "Tap its card to pick a game." });
  };

  /** Submits the call chat: commands run, everything else posts. */
  const submitChat = () => {
    const text = chatBody.trim();
    if (!text || !user || !call || sendMut.isPending) return;
    const parsed = parseSlashCommand(text);
    if (parsed) {
      const bot = voiceBotCommand(parsed.name);
      if (bot) {
        bringBotIn(bot, parsed.args);
        setChatBody("");
        setChatSlashIndex(0);
        setChatSlashHidden(false);
        return;
      }
      if (isMusicCommand(parsed.name)) {
        if (!musicBot.enabled) {
          toast.error("MUSIC BOT isn't enabled in this realm", {
            description: "A mod can add it under realm settings → Bots.",
          });
          return;
        }
        setMusicBotDismissed(false);
        void runMusicCommand(parsed.name, {
          args: parsed.args.trim(),
          realmId: call.realmId,
          roomId: call.channelId,
        })
          .then((result) => {
            if (result.ok) {
              toast.success(`/${parsed.name}`, { description: "MUSIC BOT handled that in the call." });
              setChatBody("");
            } else {
              toast.error(result.error ?? `/${parsed.name} didn't work`);
            }
          })
          .catch((error: unknown) =>
            toast.error(error instanceof Error ? error.message : "That command didn't work"),
          );
        return;
      }
    }
    sendMut.mutate();
  };

  // Game Activities: ephemeral per-room state over realtime (broadcast +
  // presence), so late joiners sync the live game with no database table.
  const roomActivity = useRoomActivity(
    call?.roomId ?? null,
    user ? { id: user.id, name: selfName } : null,
    panelOpen,
  );
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

  const sheetParticipant =
    participants.find((participant) => participant.user_id === participantSheet) ?? null;
  const playing = panelOpen && !!roomActivity.activity;
  const gameEntry = roomActivity.activity ? getGame(roomActivity.activity.gameId) : null;
  const liveGame = gameBot.state.activeGame;
  const myGame = gameBot.mySession;
  const isGameStreaming = sharingScreen && shareMode === "game";
  // Stable identity, declared after the flag it reads: the memoized control bar
  // must not see a new callback on every render of this huge view.
  /** Screen capture that explains itself when the browser can't do it. */
  const blockedCaptureHint = useCallback(() => {
    toast.info("This browser can't capture a screen", {
      description:
        "Chrome on Android can't share your screen. Open Rizz on a laptop, or start a game from the Games hub — that streams inside the app.",
    });
  }, []);
  const toggleScreenShareSafe = useCallback(() => {
    if (!screenSupported && !sharingScreen) {
      blockedCaptureHint();
      return;
    }
    toggleScreenShare();
  }, [screenSupported, sharingScreen, toggleScreenShare, blockedCaptureHint]);
  const toggleGameShare = useCallback(() => {
    if (isGameStreaming) {
      toggleScreenShare();
      return;
    }
    if (!screenSupported) {
      blockedCaptureHint();
      return;
    }
    startGameShare();
  }, [isGameStreaming, screenSupported, toggleScreenShare, startGameShare, blockedCaptureHint]);
  const viewedSession = gameBot.sessionsById[gameBot.viewingHostId ?? ""] ?? myGame ?? null;

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

  // A track that exists but is muted is the always-negotiated screen
  // transceiver with nobody sharing on it — never a picture.
  const remoteShares = remoteScreenStreams.filter(({ stream }) =>
    stream.getVideoTracks().some((track) => track.readyState === "live" && !track.muted),
  );
  const selectedRemoteShare =
    remoteShares.find(({ peerId }) => peerId === selectedSharePeerId) ?? null;
  const remoteShare = selectedRemoteShare ?? remoteShares[0] ?? null;
  const stageStream = sharingScreen ? localScreenStream : (remoteShare?.stream ?? null);
  const stagePeerId = sharingScreen ? user?.id : remoteShare?.peerId;
  const stageSession = stagePeerId ? (gameBot.sessionsById[stagePeerId] ?? null) : null;
  const stageHasGame = stagePeerId
    ? !!stageSession ||
      gameBot.sessions.some((session) =>
        gameBot.viewersByHost[session.hostId]?.includes(stagePeerId),
      )
    : false;
  const stageIsGame = sharingScreen ? shareMode === "game" : stageHasGame;
  const stageOwner = sharingScreen
    ? "you"
    : (participants.find((participant) => participant.user_id === stagePeerId)?.user?.username ??
      "someone");

  return (
    // A voice call takes over the screen: the tiles, the music bot and the
    // controls get the whole viewport, and the minimize button drops back to the
    // chat without ending the call.
    <FullScreenLayer open lockScroll={viewOpen}>
      {/* Minimized = still mounted (the game, the streams and the grid keep
          their state, and the game keeps running) but out of sight, so
          browsing the feed never stops a round. */}
      <div
        className={`fixed inset-0 z-[130] flex flex-col bg-[#0b0714] text-foreground ${
          viewOpen ? "" : "invisible pointer-events-none"
        }`}
        aria-hidden={!viewOpen}
        style={{ height: "100dvh", paddingTop: "env(safe-area-inset-top)" }}
      >
        <header className="relative flex shrink-0 items-center gap-2 border-b border-white/5 px-3 pb-2.5 pt-3 sm:gap-3 sm:px-4 sm:pb-3 sm:pt-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Voice
            </p>
            <h1 className="truncate font-display text-[17px] font-bold leading-tight">
              {call.channelName}
            </h1>
            <p
              role={error ? "alert" : undefined}
              className={`mt-0.5 flex items-center gap-1.5 text-xs ${error ? "text-destructive" : "text-muted-foreground"}`}
            >
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
          {[
            {
              label: "Open text chat",
              active: chatOpen,
              onClick: () => setChatOpen((v) => !v),
              icon: MessageSquare,
            },
            {
              label: "Games",
              active: gamesOpen,
              onClick: () => setGamesOpen(true),
              icon: Gamepad2,
            },
            { label: "Music", active: musicOpen, onClick: () => setMusicOpen(true), icon: Music },
            {
              label: "Voice settings",
              active: settingsOpen,
              onClick: () => setSettingsOpen(true),
              icon: Sliders,
            },
          ].map(({ label, active, onClick, icon: Icon }) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              title={label}
              onClick={onClick}
              className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition-colors after:absolute after:-inset-1 after:content-[''] sm:h-10 sm:w-10 ${
                active
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-white/10 bg-white/[0.04] text-foreground hover:bg-white/[0.08]"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" />
            </button>
          ))}
          <button
            type="button"
            aria-label="Minimize call"
            title="Minimize"
            onClick={closeView}
            className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-foreground transition-colors after:absolute after:-inset-1 after:content-[''] hover:bg-white/[0.08] sm:h-10 sm:w-10"
          >
            <ChevronDown className="h-[18px] w-[18px]" />
          </button>
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
        {roomActivity.activity &&
          !panelOpen &&
          (!bannerDismissedAt || roomActivity.activity.startedAt > bannerDismissedAt) && (
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
              {!sharingScreen && remoteShares.length > 1 && (
                <div className="mx-auto mb-2 flex w-full max-w-4xl items-center gap-2 overflow-x-auto pb-1">
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Streams
                  </span>
                  {remoteShares.map(({ peerId }) => {
                    const owner = participants.find(
                      (participant) => participant.user_id === peerId,
                    );
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
                        {session
                          ? `${session.hostName}'s game`
                          : `@${owner?.user?.username ?? "member"}`}
                      </button>
                    );
                  })}
                </div>
              )}

              {stageStream && (
                <div className="mx-auto mb-4 w-full max-w-4xl overflow-hidden rounded-3xl border border-primary/40 bg-black">
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
                      This browser can&apos;t crop the tab automatically. Pick the game tab or
                      window when the picker opens so only the game is streamed.
                    </p>
                  )}
                </div>
              )}

              <div className="mx-auto grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3">
                <SpeakingTiles>
                  {(speakingSet) =>
                    participants.map((participant) => {
                      const isMe = participant.user_id === user?.id;
                      const speaking = speakingSet.has(participant.user_id) && !participant.muted;
                      const videoStream = isMe
                        ? cameraOn && cameraReady
                          ? localCameraStream
                          : null
                        : (videosByPeer.get(participant.user_id) ?? null);
                      const username = participant.user?.username ?? "member";
                      const initial = (participant.user?.display_name || username)
                        .charAt(0)
                        .toUpperCase();
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
                          // Long-press (or right-click) anywhere on the tile opens
                          // that person's settings — volume, mute for me, and the
                          // host's Remove from call. Tap still opens the profile.
                          onPointerDown={(event) => beginTilePress(event, participant.user_id)}
                          onPointerMove={moveTilePress}
                          onPointerUp={endTilePress}
                          onPointerCancel={endTilePress}
                          onContextMenu={(event) => {
                            if ((event.target as HTMLElement).closest("a, input, textarea")) return;
                            event.preventDefault();
                            clearTilePress();
                            setParticipantSheet(participant.user_id);
                          }}
                          // A solid surface instead of `glass`: a blur behind
                          // every tile (and behind the speaking ring animating on
                          // top of it) was the expensive part of this screen.
                          // `select-none` matters on Android: without it a hold
                          // starts a text selection, the browser takes the touch
                          // away from us and the sheet never opens.
                          className={`relative flex aspect-square touch-manipulation select-none flex-col items-center justify-center gap-2 overflow-hidden rounded-3xl border p-3 transition-colors duration-200 ${
                            speaking
                              ? "border-primary/70 bg-[#181233] ring-1 ring-primary/45"
                              : "border-white/10 bg-[#150f2b]"
                          }`}
                        >
                          {videoStream ? (
                            <VideoTile stream={videoStream} />
                          ) : (
                            <>
                              <div className="relative">
                                <Avatar
                                  className={`h-16 w-16 transition-colors duration-200 ${
                                    speaking
                                      ? "ring-2 ring-primary ring-offset-2 ring-offset-[#0b0714]"
                                      : ""
                                  }`}
                                >
                                  <AvatarImage src={participant.user?.avatar_url ?? undefined} />
                                  <AvatarFallback className="bg-primary text-primary-foreground text-lg font-bold">
                                    {initial}
                                  </AvatarFallback>
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
                                    <CustomStatusLine
                                      status={tileCustom}
                                      className="-mt-1 truncate text-[11px]"
                                    />
                                  </span>
                                )
                              )}
                              {participantSession && !isMe && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    joinedThisGame
                                      ? openGameSession(participantSession)
                                      : joinGameSession(participantSession)
                                  }
                                  className={`mt-0.5 flex h-8 items-center gap-1 rounded-full px-3 text-[10px] font-bold transition active:scale-95 ${
                                    joinedThisGame
                                      ? "border border-primary/40 bg-primary/15 text-primary"
                                      : "bg-primary text-primary-foreground"
                                  }`}
                                >
                                  <Gamepad2 className="h-3 w-3" />
                                  {joinedThisGame ? "Open game" : "Join game"}
                                </button>
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
                                    <CustomStatusLine
                                      status={tileCustom}
                                      className="truncate text-[10px] text-white/70"
                                    />
                                  )
                                )}
                              </span>
                              {participant.muted && (
                                <MicOff className="h-3.5 w-3.5 shrink-0 text-white/80" />
                              )}
                            </div>
                          )}

                          {videoStream && participantSession && !isMe && (
                            <button
                              type="button"
                              onClick={() =>
                                joinedThisGame
                                  ? openGameSession(participantSession)
                                  : joinGameSession(participantSession)
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

                          {!videoStream && participant.muted && (
                            <span
                              className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-background/80"
                              aria-label="Muted"
                            >
                              <MicOff className="h-3.5 w-3.5 text-destructive" />
                            </span>
                          )}
                          {!videoStream && speaking && (
                            <span className="absolute left-2 top-2 text-[10px] font-bold uppercase tracking-wider text-primary">
                              Speaking
                            </span>
                          )}
                          {sharingSet.has(participant.user_id) && (
                            <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full border border-primary/40 bg-background/85 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                              <MonitorPlay className="h-3 w-3" />
                              {gameBot.sessionsById[participant.user_id] ? "Game live" : "Sharing"}
                            </span>
                          )}
                          {!isMe && (
                            // The small volume dot stays as a discoverable entry
                            // point; the tile itself answers a long press.
                            <button
                              type="button"
                              aria-label={`Settings for @${username}`}
                              onClick={() => setParticipantSheet(participant.user_id)}
                              className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-[#0f0b1f] text-muted-foreground transition-colors hover:text-foreground"
                            >
                              <Volume2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })
                  }
                </SpeakingTiles>

                {musicBot.enabled && !musicBot.dismissed && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setMusicOpen(true)}
                      aria-label="Open music controls"
                      className="relative flex aspect-square w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-3xl border border-emerald-400/40 bg-emerald-400/[0.07] p-3 text-center transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d]"
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
                      <Avatar
                        className={`h-16 w-16 ${musicBot.singing ? "ring-2 ring-emerald-400" : ""}`}
                      >
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
                    {/* A bot is removable per call; the chip below the grid always
                    offers it back (no dead end after an accidental tap). */}
                    <button
                      type="button"
                      aria-label="Remove MUSIC BOT from this call"
                      title="Remove bot"
                      onClick={() => setMusicBotDismissed(true)}
                      className="absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-lg bg-black/40 text-white/70 transition-colors hover:bg-black/60 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {/* GAME BOT: ready-made games that play as an overlay over the call. */}
                {!gameHidden && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        if (viewedSession) openGameSession(viewedSession);
                        else setGamesOpen(true);
                      }}
                      aria-label={viewedSession ? "Open your game" : "Open the Games menu"}
                      className="relative flex aspect-square w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-3xl border border-primary/40 bg-primary/[0.07] p-3 text-center transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d]"
                    >
                      <span className="absolute left-2 top-2 rounded-full bg-primary/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                        {liveGame
                          ? gameBot.state.isPaused
                            ? "Paused"
                            : gameBot.isHost
                              ? "Your game"
                              : "Live"
                          : roomActivity.activity
                            ? "Live"
                            : "In call"}
                      </span>
                      <Avatar className="h-16 w-16">
                        <AvatarFallback className="bg-primary/25 text-primary">
                          {liveGame ? (
                            <img
                              src={liveGame.icon}
                              alt=""
                              className="h-16 w-16 rounded-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <Gamepad2 className="h-6 w-6" aria-hidden="true" />
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 px-1">
                        <span className="block truncate text-xs font-semibold">
                          {gameBot.isHost ? "YOUR GAME" : "GAME BOT"}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {liveGame
                            ? gameBot.isHost
                              ? `${liveGame.name} — tap to play`
                              : `${gameBot.state.hostName ?? "Someone"}'s ${liveGame.name}`
                            : roomActivity.activity
                              ? `${roomActivity.activity.gameName} — tap to join`
                              : "Tap to pick a game"}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label="Remove GAME BOT from this call"
                      title="Remove bot"
                      onClick={() => {
                        gameBot.leave();
                        setGameBotHidden(true);
                      }}
                      className="absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-lg bg-black/40 text-white/70 transition-colors hover:bg-black/60 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {(musicBot.dismissed || gameHidden) && (
                  <div className="col-span-full flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
                    <p className="min-w-0 flex-1 text-[11px] text-muted-foreground">
                      {musicBot.dismissed && gameHidden
                        ? "MUSIC BOT and GAME BOT were removed from this call."
                        : musicBot.dismissed
                          ? "MUSIC BOT was removed. Type /music in chat or add it back."
                          : "GAME BOT was removed. Type /game in chat or pick one here."}
                    </p>
                    {musicBot.dismissed && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 rounded-lg px-2 text-[11px] text-primary hover:bg-primary/10"
                        onClick={() => setMusicBotDismissed(false)}
                      >
                        <Music className="h-3.5 w-3.5" /> Add MUSIC BOT
                      </Button>
                    )}
                    {gameHidden && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 rounded-lg px-2 text-[11px] text-primary hover:bg-primary/10"
                        onClick={() => setGameBotHidden(false)}
                      >
                        <Gamepad2 className="h-3.5 w-3.5" /> Add GAME BOT
                      </Button>
                    )}
                  </div>
                )}
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
        </div>
        {/* Music section: full now-playing + queue + transport live in the
            music sheet now; the tile above is just an icon entry point. */}
        <div
          className="relative shrink-0 border-t border-white/5 glass-strong px-2 sm:px-4 pt-3"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
        >
          <CallControls
            muted={muted}
            deafened={deafened}
            cameraOn={cameraOn}
            sharingScreen={sharingScreen}
            isGameStreaming={isGameStreaming}
            screenSupported={screenSupported}
            onToggleMute={toggleMute}
            onToggleDeafen={toggleDeafen}
            onToggleScreenShare={toggleScreenShareSafe}
            onToggleGameShare={toggleGameShare}
            onToggleCamera={toggleCamera}
            onOpenSettings={openSettings}
            onLeave={handleLeaveClick}
          />
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            {sharingScreen
              ? isGameStreaming
                ? "Streaming your game only"
                : "Sharing your screen"
              : sharingParticipants.length > 0
                ? `Watching @${sharingParticipants[0].user?.username ?? "someone"}'s screen`
                : cameraOn
                  ? `Camera on · ${facing === "user" ? "front" : "back"}`
                  : "Camera off · mic " + (muted ? "muted" : "live")}
          </p>
          {screenError && (
            <p role="alert" className="mt-1 text-center text-[10px] text-destructive">
              {screenError}
            </p>
          )}
        </div>
        {/* Participant settings — long-press a tile (or tap its volume dot). */}
        {participantSheet && sheetParticipant && (
          <ParticipantSheet
            userId={sheetParticipant.user_id}
            username={sheetParticipant.user?.username ?? "member"}
            canKick={!!call?.isHost}
            open
            onOpenChange={(next) => {
              if (!next) setParticipantSheet(null);
            }}
            onKick={() => {
              kickFromCall(sheetParticipant.user_id);
              setParticipantSheet(null);
            }}
          />
        )}
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
        {/* Host Leave Confirmation Dialog */}{" "}
        <AlertDialog open={confirmLeaveOpen} onOpenChange={setConfirmLeaveOpen}>
          <AlertDialogContent className="glass-strong border-white/10 max-w-sm">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-display">Leave & End Call?</AlertDialogTitle>
              <AlertDialogDescription>
                You are the host of this voice call. Leaving will end the call for everyone in the
                room.
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
          <SheetContent
            side="right"
            className="glass-strong border-white/10 w-full sm:max-w-md p-0 flex flex-col z-[140]"
          >
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
                <p className="py-12 text-center text-xs text-muted-foreground">
                  No messages in VC chat yet. Say hello!
                </p>
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
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
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
                  submitChat();
                }}
                className="relative flex items-center gap-2"
              >
                {/* "/" opens the command list: invite the bots into this call
                    or run MUSIC BOT straight from the chat. */}
                {chatSlashOpen && (
                  <div className="absolute inset-x-0 bottom-full z-[150] mb-2">
                    <SlashCommandMenu
                      commands={chatSlashMatches}
                      activeIndex={chatSlashActive}
                      onHover={setChatSlashIndex}
                      onSelect={(command) => {
                        setChatBody(insertSlashCommand(chatBody, command.name));
                        setChatSlashHidden(true);
                        setChatSlashIndex(0);
                        chatInputRef.current?.focus();
                      }}
                      emptyHint="Try /music to bring MUSIC BOT in, or /game for GAME BOT."
                    />
                  </div>
                )}
                <input
                  ref={chatInputRef}
                  value={chatBody}
                  onChange={(e) => {
                    setChatBody(e.target.value);
                    setChatSlashIndex(0);
                    setChatSlashHidden(false);
                  }}
                  onKeyDown={(e) => {
                    if (!chatSlashOpen || chatSlashMatches.length === 0) return;
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setChatSlashIndex((current) => wrapIndex(current + 1, chatSlashMatches.length));
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setChatSlashIndex((current) => wrapIndex(current - 1, chatSlashMatches.length));
                    } else if (e.key === "Tab" || e.key === "Enter") {
                      e.preventDefault();
                      const picked = chatSlashMatches[chatSlashActive];
                      if (picked) {
                        setChatBody(insertSlashCommand(chatBody, picked.name));
                        setChatSlashHidden(true);
                        setChatSlashIndex(0);
                      }
                    } else if (e.key === "Escape") {
                      setChatSlashHidden(true);
                    }
                  }}
                  placeholder="Message voice chat… or / for commands"
                  maxLength={500}
                  enterKeyHint="send"
                  className="h-10 flex-1 rounded-full border border-white/10 bg-black/40 px-3.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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
});

/**
 * The only subscriber to speaking levels: an audio tick re-renders just the
 * participant tiles, never the sheets, the activity panel, the stage or the
 * control bar underneath them.
 */
function SpeakingTiles({ children }: { children: (speaking: Set<string>) => ReactNode }) {
  const speakingIds = useVoiceSpeaking();
  const speaking = useMemo(() => new Set(speakingIds), [speakingIds]);
  return <>{children(speaking)}</>;
}
