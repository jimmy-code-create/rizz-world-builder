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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { InteractiveAvatar } from "@/components/ui/avatar";
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
  type ReelPartyMember,
} from "@/lib/reel-party";

type ReelPartySheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code: string | null;
  isHost: boolean;
  watching: number;
  hostPresent: boolean;
  /** Everyone in the room, straight from presence. */
  members: ReelPartyMember[];
  signedIn: boolean;
  onStart: () => void;
  onJoin: (code: string) => void;
  onLeave: () => void;
  onCopyInvite: () => void;
};

/**
 * What the reel-party icon opens: the roster of who is watching right now,
 * plus the invite a host needs to get someone else in. With no party live it
 * is the host/join entry point instead.
 */
export function ReelPartySheet({
  open,
  onOpenChange,
  code,
  isHost,
  watching,
  hostPresent,
  members,
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
            {/* The roster is the point of this sheet: who is watching now. */}
            <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
              <header className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  Watching now
                </p>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary">
                  {watching}
                </span>
              </header>
              <div className="max-h-[42dvh] overflow-y-auto p-1.5">
                {members.length === 0 ? (
                  <p className="px-2.5 py-3 text-xs text-muted-foreground">
                    Waiting for everyone to join…
                  </p>
                ) : (
                  <ul className="space-y-0.5">
                    {members.map((member) => (
                      <li
                        key={member.key}
                        className="flex items-center gap-2.5 rounded-xl px-2 py-1.5"
                      >
                        <InteractiveAvatar
                          src={member.avatar}
                          fallback={(member.name || "?").charAt(0).toUpperCase()}
                          size={32}
                          userId={member.userId}
                          username={member.username}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-white">
                            <span className="truncate">{member.name}</span>
                            {member.self && (
                              <span className="shrink-0 text-[11px] font-normal text-muted-foreground">
                                you
                              </span>
                            )}
                          </p>
                          {member.username && (
                            <p className="truncate text-[11px] text-muted-foreground">
                              @{member.username}
                            </p>
                          )}
                        </div>
                        {member.host && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                            <Crown className="h-3 w-3" />
                            Host
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {/* Invite: a code to read out, a link to paste. */}
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 p-2.5">
              <span className="shrink-0 rounded-md bg-white/10 px-2 py-1 font-mono text-xs font-bold tracking-[0.24em] text-white">
                {code}
              </span>
              <Input
                readOnly
                value={reelPartyInviteUrl(code)}
                onFocus={(event) => event.currentTarget.select()}
                aria-label="Party invite link"
                className="h-8 min-w-0 flex-1 border-white/10 bg-white/5 font-mono text-[11px] text-white/70"
              />
              <Button
                type="button"
                size="sm"
                onClick={handleCopy}
                className="h-8 shrink-0 border-0 bg-primary text-primary-foreground shadow-md"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>

            <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
              {isHost
                ? "You control the reels. Whatever you swipe to, watch, pause or resume happens for everyone."
                : hostPresent
                  ? "The host drives the reels. Your feed follows — swiping, play and pause are theirs."
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
