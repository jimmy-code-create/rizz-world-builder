import { useEffect, useRef, useState } from "react";
import { ChevronDown, Music, MonitorPlay, Mic, MicOff, Pause, PhoneOff, Play, RefreshCw, ScreenShare, ScreenShareOff, SwitchCamera, Video, VideoOff, Volume2, VolumeX, Wifi } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FullScreenLayer } from "@/components/FullScreenLayer";
import { useAuth } from "@/lib/auth";
import { useVoiceCallContext } from "@/components/voice/VoiceCallProvider";
import { musicBotControls, useMusicBotInCall } from "@/components/voice/MusicBotInCall";
import { channelVolume, useSoundSettings } from "@/lib/sound-settings";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import {
  loadPeerAudio,
  peerGain,
  peerVolumeOf,
  PEER_AUDIO_EVENT,
  setPeerVolume,
  togglePeerMute,
  type PeerAudioState,
} from "@/lib/peer-audio";

/**
 * Per-person voice settings, live. Every tile can turn one person up, down or
 * off for this device only — the same idea as Discord's per-user volume, and it
 * never touches what they send or what anyone else hears.
 */
function usePeerAudio(): PeerAudioState {
  const [state, setState] = useState(loadPeerAudio);
  useEffect(() => {
    const refresh = () => setState(loadPeerAudio());
    window.addEventListener(PEER_AUDIO_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(PEER_AUDIO_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return state;
}

function PeerVolumeControl({ userId, username }: { userId: string; username: string }) {
  const peerAudio = usePeerAudio();
  const muted = peerAudio.muted.includes(userId);
  const volume = peerVolumeOf(peerAudio, userId);

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
            onValueChange={([next]) => setPeerVolume(userId, next)}
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
function RemoteAudio({ stream, onBlocked, peerId }: { stream: MediaStream; onBlocked: () => void; peerId?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [settings] = useSoundSettings();
  const peerAudio = usePeerAudio();
  const volume = channelVolume(settings, "voice");

  useEffect(() => {
    const element = audioRef.current;
    if (!element) return;
    element.srcObject = stream;
    void element.play().catch(onBlocked);
  }, [stream, onBlocked]);

  useEffect(() => {
    const element = audioRef.current;
    if (!element) return;
    // `volume` is capped at 1 by the browser for streamed/live audio, which is
    // why the settings screen says so next to the Voice & TTS slider.
    element.volume = Math.min(1, Math.max(0, volume * peerGain(peerAudio, peerId)));
  }, [volume, peerAudio, peerId]);

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

function VideoTile({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;
    element.srcObject = stream;
    void element.play().catch(() => {});
  }, [stream]);

  return <video ref={videoRef} autoPlay muted playsInline className="h-full w-full rounded-2xl object-cover" />;
}

/**
 * Keeps remote audio playing even when the call view is minimized — this is
 * rendered by the provider, not by the view.
 */
export function VoiceCallAudio() {
  const { call, remoteStreams, markPlaybackBlocked } = useVoiceCallContext();
  if (!call) return null;
  return (
    <>
      {remoteStreams.map(({ peerId, stream }) => (
        <RemoteAudio key={peerId} stream={stream} peerId={peerId} onBlocked={markPlaybackBlocked} />
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
    cameraOn,
    cameraReady,
    facing,
    status,
    error,
    toggleMute,
    toggleCamera,
    flipCamera,
    toggleScreenShare,
    leaveCall,
    retry,
  } = useVoiceCallContext();

  // MUSIC BOT joins the call as a participant (see MusicBotInCall for the audio).
  const musicBot = useMusicBotInCall();

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
            aria-label="Minimize call"
            className="glass h-12 w-12 shrink-0 border-white/10"
            onClick={closeView}
          >
            <ChevronDown className="h-5 w-5" />
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4">
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

              return (
                <div
                  key={participant.user_id}
                  className={`relative flex aspect-square flex-col items-center justify-center gap-2 overflow-hidden rounded-3xl border p-3 transition-all ${
                    speaking
                      ? "border-primary bg-primary/10 shadow-[0_0_0_3px_var(--brand-signal),0_0_24px_transparent]"
                      : "border-white/10 glass"
                  }`}
                >
                  {videoStream ? (
                    <VideoTile stream={videoStream} />
                  ) : (
                    <>
                      <Avatar className={`h-16 w-16 ${speaking ? "ring-2 ring-primary" : ""}`}>
                        <AvatarImage src={participant.user?.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-lg font-bold">{initial}</AvatarFallback>
                      </Avatar>
                      <p className="max-w-full truncate text-xs font-semibold">
                        @{username}
                        {isMe && <span className="ml-1 text-muted-foreground">(you)</span>}
                      </p>
                    </>
                  )}

                  {videoStream && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
                      <span className="truncate text-[11px] font-semibold text-white">
                        @{username}
                        {isMe && " (you)"}
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
              <div className="relative flex aspect-square flex-col items-center justify-center gap-2 overflow-hidden rounded-3xl border border-emerald-400/40 bg-emerald-400/[0.07] p-3 text-center">
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
                <div className="min-w-0 px-1">
                  <p className="truncate text-xs font-semibold">MUSIC BOT</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {musicBot.track
                      ? `${musicBot.track.title}${musicBot.track.artist ? ` · ${musicBot.track.artist}` : ""}`
                      : "Nothing queued — /play a song in this channel"}
                  </p>
                </div>
                {musicBot.track && (
                  <button
                    type="button"
                    onClick={() => musicBotControls.toggle()}
                    disabled={!musicBot.track.preview_url}
                    aria-label={musicBot.singing ? "Pause MUSIC BOT" : "Play MUSIC BOT"}
                    className="absolute bottom-2 right-2 grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-background/80 transition active:scale-95 disabled:opacity-50"
                  >
                    {musicBot.singing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {musicBot.track && musicBot.blocked && (
          <button
            type="button"
            onClick={() => musicBotControls.retry()}
            className="mx-auto mb-2 flex shrink-0 items-center gap-2 rounded-full bg-emerald-400/15 px-4 py-2 text-xs font-semibold text-emerald-200 transition active:scale-95"
          >
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
            {musicBot.note ?? "Tap to let MUSIC BOT sing"}
          </button>
        )}

        <div
          className="relative shrink-0 border-t border-white/5 glass-strong px-4 pt-3"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
        >
          <div className="mx-auto flex max-w-md items-center justify-center gap-3">
            <Button
              variant={muted ? "outline" : "default"}
              size="icon"
              aria-label={muted ? "Unmute microphone" : "Mute microphone"}
              aria-pressed={!muted}
              onClick={toggleMute}
              className={`h-14 w-14 rounded-full ${muted ? "glass border-white/10" : "border-0 bg-primary text-primary-foreground shadow-md"}`}
            >
              {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>

            <Button
              variant={cameraOn ? "default" : "outline"}
              size="icon"
              aria-label={cameraOn ? "Turn camera off" : "Turn camera on"}
              aria-pressed={cameraOn}
              onClick={toggleCamera}
              className={`h-14 w-14 rounded-full ${cameraOn ? "border-0 bg-primary text-primary-foreground shadow-md" : "glass border-white/10"}`}
            >
              {cameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </Button>

            {cameraOn && (
              <Button
                variant="outline"
                size="icon"
                aria-label="Flip camera"
                onClick={flipCamera}
                className="glass h-14 w-14 rounded-full border-white/10 md:hidden"
              >
                <SwitchCamera className="h-5 w-5" />
              </Button>
            )}

            <Button
              variant={sharingScreen ? "default" : "outline"}
              size="icon"
              aria-label={sharingScreen ? "Stop sharing your screen" : "Share your screen"}
              aria-pressed={sharingScreen}
              disabled={!screenSupported}
              title={screenSupported ? undefined : "Screen sharing isn't available in this browser."}
              onClick={toggleScreenShare}
              className={`h-14 w-14 rounded-full ${
                sharingScreen ? "border-0 bg-primary text-primary-foreground shadow-md" : "glass border-white/10"
              } disabled:opacity-50`}
            >
              {sharingScreen ? <ScreenShareOff className="h-5 w-5" /> : <ScreenShare className="h-5 w-5" />}
            </Button>

            <Button
              variant="outline"
              aria-label="Leave call"
              onClick={leaveCall}
              className="h-14 rounded-full border-destructive/40 bg-destructive/15 px-6 text-destructive hover:bg-destructive/25"
            >
              <PhoneOff className="mr-2 h-5 w-5" /> Leave
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
      </div>
    </FullScreenLayer>
  );
}
