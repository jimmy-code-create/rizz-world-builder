import { Mic, MicOff, PhoneOff, Volume2, Maximize2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useVoiceCallContext } from "@/components/voice/VoiceCallProvider";
import { motion } from "framer-motion";

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
      <div className="flex items-center gap-2 rounded-2xl border border-white/10 glass-strong p-2 shadow-2xl backdrop-blur-xl">
        <button
          type="button"
          onClick={openView}
          aria-label={`Return to the ${call.channelName} voice call`}
          className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1 text-left transition-colors hover:bg-white/5 group"
        >
          <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Volume2 className="h-5 w-5" />
            <motion.span
              animate={muted ? {} : { scale: [1, 1.35, 1], opacity: [0.8, 1, 0.8] }}
              transition={{ repeat: Infinity, duration: 1.6 }}
              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${muted ? "bg-amber-400" : "bg-emerald-400"}`}
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold group-hover:text-primary transition-colors">
              {call.channelName}
            </span>
            <span className={`block truncate text-[11px] flex items-center gap-1.5 ${error ? "text-destructive" : "text-muted-foreground"}`}>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
              {count} connected · {error ?? (muted ? "Muted" : "Live")}
            </span>
          </span>
        </button>

        {/* Who is in the call, at a glance — the bar stays a single compact row. */}
        {count > 0 && (
          <span className="hidden shrink-0 -space-x-2 min-[420px]:flex" aria-hidden="true">
            {participants.slice(0, 3).map((participant) => (
              <Avatar key={participant.user_id} className="h-7 w-7 ring-2 ring-background">
                <AvatarImage src={participant.user?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-surface-2 text-foreground text-[10px] font-bold">
                  {(participant.user?.display_name || participant.user?.username || "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
          </span>
        )}

        <Button
          variant={muted ? "outline" : "default"}
          size="icon"
          aria-label={muted ? "Unmute microphone" : "Mute microphone"}
          aria-pressed={!muted}
          onClick={toggleMute}
          className={`h-11 w-11 shrink-0 rounded-xl transition-all ${
            muted ? "glass border-white/10 text-muted-foreground hover:text-foreground" : "border-0 bg-primary text-primary-foreground shadow-md hover:brightness-105"
          }`}
        >
          {muted ? <MicOff className="h-4.5 w-4.5" /> : <Mic className="h-4.5 w-4.5" />}
        </Button>

        <Button
          variant="outline"
          size="icon"
          aria-label="Expand voice call"
          onClick={openView}
          className="h-11 w-11 shrink-0 rounded-xl glass border-white/10 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Maximize2 className="h-4.5 w-4.5" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          aria-label="Leave call"
          onClick={leaveCall}
          className="h-11 w-11 shrink-0 rounded-xl border-destructive/40 bg-destructive/15 text-destructive hover:bg-destructive/25 transition-colors"
        >
          <PhoneOff className="h-4.5 w-4.5" />
        </Button>
      </div>
    </div>
  );
}
