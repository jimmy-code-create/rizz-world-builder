import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Copy, LogOut, Radio, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CloseButton } from "@/components/ui/close-button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";
import { toast } from "@/lib/toast";
import { useVoiceCallContext } from "@/components/voice/VoiceCallProvider";

/**
 * The Live entry point on Reels.
 *
 * Going live is a voice room with the camera opt-in, so it reuses the app's
 * existing WebRTC call transport instead of inventing a second streaming stack.
 * The host gets a shareable/joinable room link; viewers who open it land in the
 * same room and can watch the host's camera (and screen share) from the call
 * studio. The room closes when the host leaves, or when the stale-room sweeper
 * notices the host has gone.
 */
export function LiveStudioSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user, profile } = useAuth();
  const { call, busy, startLiveRoom, joinLiveRoom, openView, leaveCall } = useVoiceCallContext();
  const [title, setTitle] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const live = call?.kind === "live" ? call : null;
  const hosting = live?.isHost === true;
  const roomLink = live && origin ? `${origin}/live/${live.roomId}` : "";

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!open) {
      setCopied(false);
      setError(null);
      setJoinInput("");
    }
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copyLink() {
    if (!roomLink) return;
    if (!navigator.clipboard?.writeText) {
      toast.error("Copy isn't available in this browser");
      return;
    }
    try {
      await navigator.clipboard.writeText(roomLink);
      setCopied(true);
      toast.success("Live link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  }

  async function goLive() {
    setError(null);
    const roomId = await startLiveRoom(title);
    if (!roomId) {
      setError("Couldn't start the live room. Check your microphone permission and try again.");
      return;
    }
    setTitle("");
  }

  function parseRoomId(raw: string): string {
    const value = raw.trim();
    if (!value) return "";
    const room = value.includes("/live/") ? (value.split("/live/").pop() ?? "") : value;
    return room.split(/[?#]/)[0].replace(/\/+$/, "");
  }

  async function join() {
    setError(null);
    const roomId = parseRoomId(joinInput);
    if (!roomId) return;
    const joined = await joinLiveRoom(roomId);
    if (!joined) {
      setError("That live room has ended, or the link is wrong.");
      return;
    }
    setJoinInput("");
    onOpenChange(false);
  }

  function endLive() {
    leaveCall();
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        hideClose
        className="glass-strong max-h-[88dvh] overflow-y-auto rounded-t-3xl border-white/10 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
        <div className="flex items-start justify-between gap-3">
          <SheetHeader className="min-w-0 text-left">
            <SheetTitle className="flex items-center gap-2 font-display text-xl text-white">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-destructive text-destructive-foreground">
                <Radio className="h-4.5 w-4.5" />
              </span>
              Live
            </SheetTitle>
            <SheetDescription className="text-sm text-muted-foreground">
              Start a live room on Reels, or join one a friend shared with you.
            </SheetDescription>
          </SheetHeader>
          <SheetClose asChild>
            <CloseButton className="-mr-2 -mt-2 shrink-0" />
          </SheetClose>
        </div>

        {live ? (
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
              <p className="flex items-center gap-2 text-sm font-bold text-destructive">
                <span className="h-2 w-2 animate-pulse rounded-full bg-destructive motion-reduce:animate-none" />
                {hosting ? "You're live" : "You're watching live"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {hosting
                  ? "Your room is open. Share the link so people can join, then open the studio and turn your camera on when you're ready."
                  : "You're in the host's room. Share the link, or open the studio to watch the host's camera and screen share."}
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 p-2.5">
              <Input
                readOnly
                value={roomLink}
                onFocus={(event) => event.currentTarget.select()}
                aria-label="Live invite link"
                className="h-9 min-w-0 flex-1 border-white/10 bg-white/5 font-mono text-[11px] text-white/70"
              />
              <Button
                type="button"
                size="sm"
                onClick={() => void copyLink()}
                className="h-9 shrink-0 border-0 bg-primary text-primary-foreground shadow-md"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                onClick={() => {
                  openView();
                  onOpenChange(false);
                }}
                className="h-11 border-0 bg-primary text-primary-foreground shadow-md"
              >
                <Video className="h-4 w-4" />
                Open studio
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={endLive}
                className="h-11 border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                {hosting ? "End live" : "Leave room"}
              </Button>
            </div>

            <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
              {hosting
                ? "Camera is off by default. In the studio, tap the camera button to show yourself; the screen-share button broadcasts a game or your screen instead."
                : "You join muted. Use the mic button in the studio if you want to talk; the host's camera and screen share appear there."}
            </p>
          </div>
        ) : call ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-sm font-bold text-white">You're already in a call</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Leave the current call before starting or joining a live room.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                type="button"
                onClick={() => {
                  openView();
                  onOpenChange(false);
                }}
                className="h-11 border-0 bg-primary text-primary-foreground shadow-md"
              >
                Open call
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={leaveCall}
                className="h-11 border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"
              >
                Leave call
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-primary/10 via-white/[0.03] to-transparent p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/25">
                  <Radio className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white">Start a live room</p>
                  <p className="text-xs leading-snug text-muted-foreground">
                    A public room for your Reels. Camera is your choice.
                  </p>
                </div>
              </div>

              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={`${profile?.display_name || profile?.username || "You"} is live`}
                maxLength={80}
                aria-label="Live room title"
                className="mt-4 h-11 glass border-white/10"
              />

              <Button
                type="button"
                onClick={() => void goLive()}
                disabled={!user || busy}
                className="mt-2 h-11 w-full border-0 bg-primary text-primary-foreground shadow-[0_10px_30px_-12px_var(--brand-signal)]"
              >
                <Radio className="h-4 w-4" />
                {busy ? "Starting…" : "Go live"}
              </Button>
              {!user && (
                <p className="mt-2 text-center text-[11px] text-muted-foreground">
                  <Link to="/login" className="font-semibold text-primary hover:underline">
                    Sign in
                  </Link>{" "}
                  to go live.
                </p>
              )}
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-background px-3 text-[10px] font-bold uppercase tracking-[0.25em] text-white/35">
                  or join a live room
                </span>
              </div>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void join();
              }}
              className="flex gap-2"
            >
              <Input
                value={joinInput}
                onChange={(event) => setJoinInput(event.target.value)}
                placeholder="Paste a live link or room ID"
                aria-label="Live room link or room ID"
                autoComplete="off"
                spellCheck={false}
                className="glass h-11 border-white/10 text-sm"
              />
              <Button
                type="submit"
                disabled={!joinInput.trim() || busy || !user}
                className="h-11 shrink-0 border-0 bg-white/10 px-5 text-white hover:bg-white/15"
              >
                Join
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
            <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
              The room is live only while the host stays. Nothing is recorded or saved.
            </p>
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}
