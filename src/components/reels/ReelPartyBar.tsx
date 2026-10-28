import { Link2, LogOut, Users } from "lucide-react";
import { reelPartyInviteUrl } from "@/lib/reel-party";

/**
 * The pill that sits under the reels toolbar while a party is live. It answers
 * the three questions a guest has at a glance: who is hosting, how many people
 * are watching, and how to get back out.
 */
export function ReelPartyBar({
  code,
  isHost,
  watching,
  hostPresent,
  onCopyInvite,
  onLeave,
  onOpen,
}: {
  code: string;
  isHost: boolean;
  watching: number;
  hostPresent: boolean;
  onCopyInvite: () => void;
  onLeave: () => void;
  onOpen: () => void;
}) {
  const status = isHost
    ? "You control the playhead"
    : hostPresent
      ? "Following the host"
      : "Waiting for the host";

  return (
    <div
      role="group"
      aria-label="Reel party status"
      className="pointer-events-auto flex max-w-full items-center gap-2 rounded-2xl border border-white/10 bg-black/70 bg-gradient-to-r from-primary/20 via-black/60 to-black/80 py-1.5 pl-2 pr-1.5 shadow-[0_16px_40px_-18px_rgba(0,0,0,0.9)] backdrop-blur-xl"
    >
      <button
        type="button"
        onClick={onOpen}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/20 text-primary ring-1 ring-primary/30 transition-colors hover:bg-primary/30"
        aria-label="Reel party controls"
      >
        <Users className="h-4 w-4" />
      </button>
      <button type="button" onClick={onOpen} className="min-w-0 text-left">
        <p className="flex items-center gap-1.5 text-[11px] font-bold leading-tight text-white">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          Reel party
          <span className="font-medium text-white/55">· {watching} watching</span>
        </p>
        <p className="truncate text-[10px] leading-tight text-white/55">{status}</p>
      </button>
      <span className="ml-0.5 hidden shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-[0.18em] text-white/80 sm:inline">
        {code}
      </span>
      <button
        type="button"
        onClick={onCopyInvite}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        aria-label="Copy reel party invite link"
        title={reelPartyInviteUrl(code)}
      >
        <Link2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onLeave}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/50 transition-colors hover:bg-destructive/20 hover:text-destructive"
        aria-label="Leave reel party"
        title="Leave party"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
