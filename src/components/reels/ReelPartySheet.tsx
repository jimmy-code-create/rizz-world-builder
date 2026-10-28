import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Check,
  Copy,
  Crown,
  Link2,
  LogOut,
  MonitorPlay,
  Sparkles,
  Users,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CloseButton } from "@/components/ui/close-button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  normalizeReelPartyCode,
  reelPartyInviteUrl,
} from "@/lib/reel-party";
import { cn } from "@/lib/utils";

type ReelPartySheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code: string | null;
  isHost: boolean;
  watching: number;
  hostPresent: boolean;
  signedIn: boolean;
  onStart: () => void;
  onJoin: (code: string) => void;
  onLeave: () => void;
  onCopyInvite: () => void;
};

/**
 * The Reel Party control room. When a party is live this becomes the invite
 * card — code, copyable link, role and a way out — and when there is no party
 * it is the host/join entry point.
 */
export function ReelPartySheet({
  open,
  onOpenChange,
  code,
  isHost,
  watching,
  hostPresent,
  signedIn,
  onStart,
  onJoin,
  onLeave,
  onCopyInvite,
}: ReelPartySheetProps) {
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setJoinCode("");
      setCopied(false);
    }
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const parsedJoinCode = normalizeReelPartyCode(joinCode);

  function handleCopy() {
    onCopyInvite();
    setCopied(true);
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
          <div className="min-w-0">
            <SheetTitle className="font-display text-xl text-white">
              Reel party
            </SheetTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              One screen, one playhead. Watch the reels together.
            </p>
          </div>
          <SheetClose asChild>
            <CloseButton className="-mr-2 -mt-2 shrink-0" />
          </SheetClose>
        </div>

        {code ? (
          <div className="mt-5 space-y-3">
            <div className="overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-b from-primary/15 via-black/30 to-black/40">
              <div className="px-4 pb-4 pt-5 text-center">
                <p className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.3em] text-white/45">
                  <Crown className="h-3 w-3" />
                  {isHost ? "You are hosting" : hostPresent ? "Host is live" : "Host is away"}
                </p>
                <p className="mt-2 font-mono text-3xl font-black tracking-[0.35em] text-white">
                  {code}
                </p>
                <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-white/55">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {watching} watching
                  </span>
                  <span className="text-white/20">·</span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                      isHost
                        ? "bg-primary/20 text-primary"
                        : hostPresent
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-amber-500/15 text-amber-300",
                    )}
                  >
                    <Wifi className="h-3 w-3" />
                    {isHost ? "Host" : hostPresent ? "Guest" : "Waiting"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 border-t border-white/10 bg-black/20 p-2.5">
                <Input
                  readOnly
                  value={reelPartyInviteUrl(code)}
                  onFocus={(event) => event.currentTarget.select()}
                  aria-label="Party invite link"
                  className="h-9 border-white/10 bg-white/5 font-mono text-[11px] text-white/70"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCopy}
                  className="h-9 shrink-0 border-0 bg-primary text-primary-foreground shadow-md"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>

            <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
              {isHost
                ? "Anything you play, pause or swipe happens for everyone in the room."
                : hostPresent
                  ? "The host chooses the reel and the playhead. Your screen follows automatically."
                  : "The host isn't here anymore. You can wait, leave, or open a fresh room."}
            </p>

            {!isHost && !hostPresent && (
              <Button
                type="button"
                onClick={onStart}
                className="h-11 w-full border-0 bg-primary text-primary-foreground shadow-md"
              >
                <Sparkles className="h-4 w-4" />
                Start a new party
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={onLeave}
              className="h-11 w-full border-white/10 bg-white/[0.03] text-destructive hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              Leave party
            </Button>
          </div>
        ) : (
          <div className="mt-5">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-primary/10 via-white/[0.03] to-transparent p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/25">
                  <MonitorPlay className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white">Start the room</p>
                  <p className="text-xs leading-snug text-muted-foreground">
                    You control the feed. Everyone follows.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                onClick={onStart}
                disabled={!signedIn}
                className="mt-4 h-11 w-full border-0 bg-primary text-primary-foreground shadow-[0_10px_30px_-12px_var(--brand-signal)]"
              >
                <Sparkles className="h-4 w-4" />
                Start a reel party
              </Button>
              {!signedIn && (
                <p className="mt-2 text-center text-[11px] text-muted-foreground">
                  <Link to="/login" className="font-semibold text-primary hover:underline">
                    Sign in
                  </Link>{" "}
                  to host or join a room.
                </p>
              )}
            </div>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-background px-3 text-[10px] font-bold uppercase tracking-[0.25em] text-white/35">
                  or join with a code
                </span>
              </div>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!parsedJoinCode) return;
                onJoin(parsedJoinCode);
              }}
              className="flex gap-2"
            >
              <Input
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value)}
                placeholder="ABC123"
                aria-label="Party code or invite link"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                className="glass h-11 border-white/10 font-mono uppercase tracking-[0.24em] placeholder:tracking-[0.3em] placeholder:text-white/25"
              />
              <Button
                type="submit"
                disabled={!parsedJoinCode || !signedIn}
                className="h-11 shrink-0 border-0 bg-white/10 px-5 text-white hover:bg-white/15"
              >
                Join
              </Button>
            </form>
            <p className="mt-2 flex items-start gap-1.5 px-1 text-[11px] leading-relaxed text-muted-foreground">
              <Link2 className="mt-0.5 h-3 w-3 shrink-0" />
              Anyone with the link can join. The room closes when everyone leaves —
              nothing is saved.
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
