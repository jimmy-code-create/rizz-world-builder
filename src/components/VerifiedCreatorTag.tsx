import { BadgeCheck } from "lucide-react";

/**
 * The Verified Creator tag shown next to an author's name.
 *
 * One component so the feed and Reels can never drift apart: the tag only says
 * what the backend's verified_creator flag says about that account.
 */
export function VerifiedCreatorTag() {
  return (
    <span
      role="img"
      title="Verified Creator"
      aria-label="Verified creator"
      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-cyan-300/30 bg-gradient-to-r from-cyan-400/15 via-sky-400/10 to-violet-400/15 px-1.5 py-1 text-[10px] font-bold leading-none text-cyan-100 shadow-[0_0_12px_rgba(56,189,248,0.16)] backdrop-blur-sm"
    >
      <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-cyan-300/15 ring-1 ring-cyan-200/20">
        <BadgeCheck className="h-3 w-3 text-cyan-200 drop-shadow-[0_0_4px_rgba(103,232,249,0.65)]" aria-hidden="true" />
      </span>
      Creator
    </span>
  );
}
