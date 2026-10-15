import { CatEmoji } from "@/components/emoji/CatEmoji";

/**
 * The Main Character tag shown next to an author's name.
 *
 * One component so the feed and Reels can never drift apart. Badge set v2
 * retired the old "Creator" label: this slot is Main Character now (epic
 * purple, cat_hype icon — never a prompt-emoji copy). The
 * `verified_creator` flag it keys off now means "holds the no-cap badge".
 */
export function VerifiedCreatorTag() {
  return (
    <span
      role="img"
      title="Main Character"
      aria-label="Main character"
      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-purple-400/30 bg-gradient-to-r from-purple-500/15 via-fuchsia-500/10 to-violet-500/15 px-1.5 py-1 text-[10px] font-bold leading-none text-purple-100 shadow-[0_0_12px_rgba(168,85,247,0.16)] backdrop-blur-sm"
    >
      <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-purple-400/15 ring-1 ring-purple-300/20">
        <CatEmoji name="cat_hype" size={12} animate={false} />
      </span>
      Main Character
    </span>
  );
}
