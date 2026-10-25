import { memo, type ReactNode } from "react";
import {
  Grid3x3,
  Headphones,
  Mic,
  MicOff,
  MoreHorizontal,
  PhoneOff,
  Video,
  VideoOff,
  VolumeX,
} from "lucide-react";

type ControlProps = {
  label: string;
  ariaLabel: string;
  pressed?: boolean;
  tone?: "neutral" | "danger" | "lime";
  hint?: string;
  disabled?: boolean;
  disabledReason?: string;
  dot?: boolean;
  onClick: () => void;
  children: ReactNode;
};

function Control({
  label,
  ariaLabel,
  pressed,
  tone = "neutral",
  hint,
  disabled,
  disabledReason,
  dot,
  onClick,
  children,
}: ControlProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={pressed}
      title={disabled ? disabledReason : hint ? `${label} (${hint})` : label}
      className="voice-control-item focus-visible:outline-none"
    >
      <span className="voice-control" data-tone={tone} aria-hidden>
        {children}
        {dot && <span className="voice-control-dot" aria-hidden />}
      </span>
      <span className="voice-control-label">{label}</span>
    </button>
  );
}

/**
 * The one call-control row: 56px circles (52/48 on narrow phones) with 12px
 * labels underneath, never inside the shape.
 *
 * Mute is neutral while your mic is live and red only when muted — never lime.
 * Deafen implies muted, like Discord: deafening shows "Unmute" on the mic.
 * Camera and a running activity are the only lime-tinted toggles.
 */
export const VoiceControlBar = memo(function VoiceControlBar({
  muted,
  deafened,
  cameraOn,
  cameraReady = true,
  activityRunning,
  announcement,
  onToggleMute,
  onToggleDeafen,
  onToggleCamera,
  onOpenActivities,
  onOpenMore,
  onLeave,
}: {
  muted: boolean;
  deafened: boolean;
  cameraOn: boolean;
  cameraReady?: boolean;
  activityRunning: boolean;
  announcement?: string;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onToggleCamera: () => void;
  onOpenActivities: () => void;
  onOpenMore: () => void;
  onLeave: () => void;
}) {
  const micOff = muted || deafened;

  return (
    <div
      className="voice-controls shrink-0 border-t border-border px-2 pt-2.5"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.625rem)" }}
    >
      <div
        className="mx-auto flex w-full max-w-lg items-start justify-center gap-2.5 sm:gap-3"
        role="toolbar"
        aria-label="Call controls"
      >
        <Control
          label={micOff ? "Unmute" : "Mute"}
          ariaLabel={micOff ? "Unmute microphone" : "Mute microphone"}
          pressed={!micOff}
          tone={micOff ? "danger" : "neutral"}
          hint="M"
          onClick={onToggleMute}
        >
          {micOff ? <MicOff /> : <Mic />}
        </Control>

        <Control
          label={deafened ? "Undeafen" : "Deafen"}
          ariaLabel={deafened ? "Undeafen incoming audio" : "Deafen incoming audio"}
          pressed={deafened}
          tone={deafened ? "danger" : "neutral"}
          hint="D"
          onClick={onToggleDeafen}
        >
          {deafened ? <VolumeX /> : <Headphones />}
        </Control>

        <Control
          label="Camera"
          ariaLabel={cameraOn ? "Turn camera off" : "Turn camera on"}
          pressed={cameraOn}
          tone={cameraOn ? "lime" : "neutral"}
          hint="V"
          disabled={!cameraReady}
          disabledReason="No camera available — check the browser permission."
          onClick={onToggleCamera}
        >
          {cameraOn ? <Video /> : <VideoOff />}
        </Control>

        <Control
          label="Activities"
          ariaLabel="Open activities and games"
          pressed={activityRunning}
          tone={activityRunning ? "lime" : "neutral"}
          dot={activityRunning}
          onClick={onOpenActivities}
        >
          <Grid3x3 />
        </Control>

        <Control label="More" ariaLabel="More call options" onClick={onOpenMore}>
          <MoreHorizontal />
        </Control>

        <span className="w-4 shrink-0" aria-hidden />

        <Control
          label="Leave"
          ariaLabel="Leave call"
          tone="danger"
          onClick={onLeave}
        >
          <PhoneOff />
        </Control>
      </div>
      {announcement ? (
        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>
      ) : null}
    </div>
  );
});

export default VoiceControlBar;
