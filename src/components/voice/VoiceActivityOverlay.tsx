import { useState, type ReactNode } from "react";
import {
  ChevronDown,
  Copy,
  Expand,
  Headphones,
  LayoutGrid,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  PhoneOff,
  Users,
  VolumeX,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GameIcon } from "@/components/GameIcon";
import { GameStage } from "@/components/games/GameStage";
import { VideoTile } from "@/components/voice/VideoTile";
import { useVoiceCallContext } from "@/components/voice/VoiceCallProvider";
import { useAuth } from "@/lib/auth";
import { useFullscreen } from "@/lib/fullscreen";
import { inviteText, type GameEntry, type RoomActivity } from "@/lib/activities";
import { toast } from "@/lib/toast";

/**
 * THE OVERLAY — a game as the background, voice floating on top of it.
 *
 * This is the part that makes activities feel like Discord's: you do not leave
 * the call to play, and you do not lose the call to watch the game. The surface
 * is screen-sized, and the voice UI becomes a translucent dock over it — who is
 * talking, who is muted, who has a camera on, plus mute/deafen/leave — so a
 * question asked mid-round is answered mid-round.
 *
 * The dock collapses on request, and the whole layer can go true-fullscreen
 * where the browser supports it (iPhone Safari has no element fullscreen, so the
 * button is hidden rather than broken).
 */
export function VoiceActivityOverlay({
  activity,
  entry,
  canEnd,
  playingCount,
  players,
  onExit,
  onLeaveGame,
  onEnd,
}: {
  activity: RoomActivity;
  entry: GameEntry | null;
  canEnd: boolean;
  playingCount: number;
  players: number;
  /** Back to the voice grid, game still running in the call. */
  onExit: () => void;
  /** Leave the game (keeps the call). */
  onLeaveGame: () => void;
  onEnd: () => void;
}) {
  const { user } = useAuth();
  const {
    participants,
    speakingIds,
    remoteStreams,
    localCameraStream,
    cameraOn,
    cameraReady,
    muted,
    deafened,
    toggleMute,
    toggleDeafen,
    leaveCall,
  } = useVoiceCallContext();
  const [dockOpen, setDockOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const stage = useFullscreen<HTMLDivElement>();

  const videosByPeer = new Map(
    remoteStreams.map(({ peerId, stream }) => [
      peerId,
      stream.getVideoTracks().some((track) => track.readyState === "live") ? stream : null,
    ]),
  );
  const speaking = new Set(speakingIds);

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(
        entry ? inviteText(entry, activity.roomCode) : activity.url,
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
      toast.success("Invite copied");
    } catch {
      toast.error("Couldn't copy the invite");
    }
  };

  return (
    <div className="fixed inset-0 z-[135] flex flex-col bg-[#08080a]" style={{ height: "100dvh" }}>
      {/* The game *is* the background; everything else floats over it. */}
      <div ref={stage.ref} className="absolute inset-0">
        <div data-rizz-game-surface className="absolute inset-0">
          <GameStage entry={entry} players={players} fullscreen className="absolute inset-0" />
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/75 via-black/25 to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/85 via-black/35 to-transparent"
        />
      </div>

      {/* ---- top chrome: what is running, and how to leave it ---------------- */}
      <div
        className="relative z-10 flex flex-wrap items-start gap-2 p-2"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.5rem)" }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-white/10 bg-black/55 p-2 backdrop-blur">
          <GameIcon icon={activity.gameIcon} size={24} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-white">{activity.gameName}</p>
            <p className="truncate text-[10px] text-white/60">
              {activity.startedByName} started this · {Math.max(1, playingCount)} playing ·{" "}
              {entry?.source === "builtin" ? "everyone in the call can join" : "voice stays on"}
            </p>
          </div>
          {activity.roomCode && (
            <button
              type="button"
              onClick={() => void copyInvite()}
              title="Copy the room code"
              className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-2 py-1 font-mono text-xs font-bold tracking-widest text-primary sm:flex"
            >
              {copied ? "copied" : activity.roomCode}
              <Copy className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <OverlayButton
            label="Back to the voice grid"
            onClick={onExit}
            icon={<LayoutGrid className="h-4 w-4" />}
          />
          {stage.supported && (
            <OverlayButton
              label={stage.isFullscreen ? "Leave fullscreen" : "Play fullscreen"}
              onClick={stage.toggle}
              icon={
                stage.isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )
              }
            />
          )}
          {canEnd && (
            <OverlayButton
              label="End the game for everyone"
              onClick={onEnd}
              destructive
              icon={<PhoneOff className="h-4 w-4" />}
            />
          )}
          <OverlayButton
            label="Leave the game"
            onClick={onLeaveGame}
            icon={<X className="h-4 w-4" />}
          />
        </div>
      </div>

      {stage.error && (
        <p
          role="alert"
          className="relative z-10 mx-2 rounded-xl bg-destructive/20 px-3 py-1.5 text-[11px] text-destructive-foreground"
        >
          {stage.error}
        </p>
      )}

      {/* ---- the floating voice dock ---------------------------------------- */}
      <div
        className="relative z-10 mt-auto p-2"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)" }}
      >
        {dockOpen ? (
          <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-black/60 p-2 backdrop-blur-lg">
            <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
              {participants.map((participant) => {
                const isMe = participant.user_id === user?.id;
                const initials = (
                  participant.user?.display_name ||
                  participant.user?.username ||
                  "?"
                )
                  .charAt(0)
                  .toUpperCase();
                const talking = speaking.has(participant.user_id) && !participant.muted;
                const video = isMe
                  ? cameraOn && cameraReady
                    ? localCameraStream
                    : null
                  : (videosByPeer.get(participant.user_id) ?? null);
                return (
                  <span
                    key={participant.user_id}
                    className={`relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border transition-all ${
                      talking
                        ? "border-primary shadow-[0_0_0_2px_var(--primary)]"
                        : "border-white/10"
                    }`}
                    title={`@${participant.user?.username ?? "member"}${participant.muted ? " · muted" : ""}`}
                  >
                    {video ? (
                      <VideoTile stream={video} />
                    ) : (
                      <Avatar className="h-full w-full rounded-none">
                        <AvatarImage src={participant.user?.avatar_url ?? undefined} />
                        <AvatarFallback className="rounded-none bg-primary/25 text-xs font-bold text-foreground">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    {participant.muted && (
                      <span className="absolute bottom-0 right-0 grid h-4 w-4 place-items-center rounded-tl-md bg-black/80">
                        <MicOff className="h-2.5 w-2.5 text-destructive" />
                      </span>
                    )}
                  </span>
                );
              })}
              <span className="ml-1 hidden items-center gap-1 text-[11px] text-white/60 sm:flex">
                <Users className="h-3.5 w-3.5" />
                {participants.length} in call
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <DockButton
                onClick={toggleMute}
                active={!muted}
                label={muted ? "Unmute" : "Mute"}
                icon={muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              />
              <DockButton
                onClick={toggleDeafen}
                active={!deafened}
                label={deafened ? "Undeafen" : "Deafen"}
                icon={
                  deafened ? <VolumeX className="h-4 w-4" /> : <Headphones className="h-4 w-4" />
                }
              />
              <button
                type="button"
                onClick={leaveCall}
                className="flex h-10 items-center gap-1.5 rounded-xl border border-destructive/40 bg-destructive/20 px-3 text-xs font-bold text-destructive transition hover:bg-destructive/30"
              >
                <PhoneOff className="h-4 w-4" />
                Leave call
              </button>
              <button
                type="button"
                onClick={() => setDockOpen(false)}
                aria-label="Hide voice controls"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 text-white/60 transition hover:text-white"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setDockOpen(true)}
            className="mx-auto flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-4 py-2 text-xs font-semibold text-white/75 backdrop-blur-lg transition hover:text-white"
          >
            <Expand className="h-3.5 w-3.5" />
            Voice · {participants.length} in call {muted ? "· muted" : ""}
          </button>
        )}
      </div>
    </div>
  );
}

function OverlayButton({
  label,
  icon,
  onClick,
  destructive = false,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border backdrop-blur transition ${
        destructive
          ? "border-destructive/40 bg-destructive/20 text-destructive hover:bg-destructive/30"
          : "border-white/10 bg-black/55 text-white/70 hover:text-white"
      }`}
    >
      {icon}
    </button>
  );
}

function DockButton({
  onClick,
  active,
  label,
  icon,
}: {
  onClick: () => void;
  active: boolean;
  label: string;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition ${
        active
          ? "border-primary/40 bg-primary/15 text-primary"
          : "border-white/10 text-white/60 hover:text-white"
      }`}
    >
      {icon}
    </button>
  );
}
