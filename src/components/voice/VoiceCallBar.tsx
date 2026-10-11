import { Mic, MicOff, PhoneOff, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVoiceCallContext } from "@/components/voice/VoiceCallProvider";

/**
 * Lives in the app shell's flex column between the page and the mobile bottom
 * nav, so it can never cover the nav or a chat composer. Tapping it reopens
 * the full call view; the call itself keeps running in the root provider.
 */
export function VoiceCallBar() {
  const { call, viewOpen, participants, muted, status, error, toggleMute, leaveCall, openView } = useVoiceCallContext();
  if (!call || viewOpen) return null;

  const count = participants.length;

  return (
    <div className="z-30 shrink-0 px-3 pb-2 md:mx-auto md:w-full md:max-w-3xl md:px-4">
      <div className="flex items-center gap-2 rounded-2xl border border-white/10 glass-strong p-2 shadow-glow">
        <button
          type="button"
          onClick={openView}
          aria-label={`Return to the ${call.channelName} voice call`}
          className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1 text-left transition-colors hover:bg-white/5"
        >
          <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-primary text-white">
            <Volume2 className="h-5 w-5" />
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-emerald-400" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{call.channelName}</span>
            <span className={`block truncate text-[11px] ${error ? "text-destructive" : "text-muted-foreground"}`}>
              {count} in call · {error ?? status}
            </span>
          </span>
        </button>

        <Button
          variant={muted ? "outline" : "default"}
          size="icon"
          aria-label={muted ? "Unmute microphone" : "Mute microphone"}
          aria-pressed={!muted}
          onClick={toggleMute}
          className={`h-12 w-12 shrink-0 rounded-full ${muted ? "glass border-white/10" : "border-0 bg-gradient-primary shadow-glow"}`}
        >
          {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>

        <Button
          variant="outline"
          size="icon"
          aria-label="Leave call"
          onClick={leaveCall}
          className="h-12 w-12 shrink-0 rounded-full border-destructive/40 bg-destructive/15 text-destructive hover:bg-destructive/25"
        >
          <PhoneOff className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
