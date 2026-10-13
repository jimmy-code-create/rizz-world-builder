import { useEffect, useRef } from "react";
import { ChevronDown, MonitorPlay, Mic, MicOff, PhoneOff, RefreshCw, ScreenShare, ScreenShareOff, SwitchCamera, Video, VideoOff, Wifi } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";
import { useVoiceCallContext } from "@/components/voice/VoiceCallProvider";

/** Plays a remote participant's audio. Video tracks are ignored here. */
function RemoteAudio({ stream, onBlocked }: { stream: MediaStream; onBlocked: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const element = audioRef.current;
    if (!element) return;
    element.srcObject = stream;
    void element.play().catch(onBlocked);
  }, [stream, onBlocked]);

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
        <RemoteAudio key={peerId} stream={stream} onBlocked={markPlaybackBlocked} />
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
    // The expanded call is a bottom sheet, not a full-screen takeover: the chat
    // stays readable behind it and the sheet is reachable with one thumb.
    <Sheet open={!!call && viewOpen} onOpenChange={(open) => { if (!open) closeView(); }}>
      <SheetContent
        side="bottom"
        className="glass-strong flex max-h-[92dvh] flex-col gap-0 overflow-hidden rounded-t-3xl border-white/10 p-0 [&>button]:hidden"
      >
        <SheetTitle className="sr-only">Voice call</SheetTitle>
        <header className="flex shrink-0 items-center gap-3 border-b border-white/5 px-4 pb-3 pt-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--rizz-pink)]">Voice channel</p>
            <h1 className="truncate font-display text-lg font-bold leading-tight">{call.channelName}</h1>
            <p role={error ? "alert" : undefined} className={`mt-0.5 flex items-center gap-1.5 text-xs ${error ? "text-destructive" : "text-muted-foreground"}`}>
              {!error && <Wifi className="h-3 w-3" />}
              {error ?? `${status} · ${participants.length} ${participants.length === 1 ? "person" : "people"}`}
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
            <div className="mx-auto mb-4 w-full max-w-4xl overflow-hidden rounded-3xl border border-[var(--rizz-pink)]/40 bg-black shadow-glow">
              <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-black/60 px-3 py-2">
                <span className="flex min-w-0 items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[var(--rizz-pink)]">
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
                      ? "border-[var(--rizz-pink)] bg-[var(--rizz-pink)]/10 shadow-[0_0_0_3px_var(--rizz-pink),0_0_24px_var(--rizz-glow)]"
                      : "border-white/10 glass"
                  }`}
                >
                  {videoStream ? (
                    <VideoTile stream={videoStream} />
                  ) : (
                    <>
                      <Avatar className={`h-16 w-16 ${speaking ? "ring-2 ring-[var(--rizz-pink)]" : ""}`}>
                        <AvatarImage src={participant.user?.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-gradient-primary text-lg font-bold">{initial}</AvatarFallback>
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
                    <span className="absolute left-2 top-2 text-[10px] font-bold uppercase tracking-wider text-[var(--rizz-pink)]">Speaking</span>
                  )}
                  {sharingIds.includes(participant.user_id) && !sharingScreen && (
                    <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full border border-[var(--rizz-pink)]/40 bg-background/85 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--rizz-pink)]">
                      <MonitorPlay className="h-3 w-3" /> Sharing
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div
          className="shrink-0 border-t border-white/5 glass-strong px-4 pt-3"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
        >
          <div className="mx-auto flex max-w-md items-center justify-center gap-3">
            <Button
              variant={muted ? "outline" : "default"}
              size="icon"
              aria-label={muted ? "Unmute microphone" : "Mute microphone"}
              aria-pressed={!muted}
              onClick={toggleMute}
              className={`h-14 w-14 rounded-full ${muted ? "glass border-white/10" : "border-0 bg-gradient-primary shadow-glow"}`}
            >
              {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>

            <Button
              variant={cameraOn ? "default" : "outline"}
              size="icon"
              aria-label={cameraOn ? "Turn camera off" : "Turn camera on"}
              aria-pressed={cameraOn}
              onClick={toggleCamera}
              className={`h-14 w-14 rounded-full ${cameraOn ? "border-0 bg-gradient-primary shadow-glow" : "glass border-white/10"}`}
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
                sharingScreen ? "border-0 bg-gradient-primary shadow-glow" : "glass border-white/10"
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
      </SheetContent>
    </Sheet>
  );
}
