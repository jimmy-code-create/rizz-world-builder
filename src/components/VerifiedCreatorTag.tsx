import { BadgeIcon } from "@/components/BadgeIcon";
import { badgeArtForSlug } from "@/lib/badge-set";

/** The identity-verified pill shown beside verified member names. */
export function VerifiedCreatorTag() {
  return (
    <span
      role="img"
      title="Verified"
      aria-label="Verified"
      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-lime-300/30 bg-gradient-to-r from-lime-300/15 via-emerald-300/10 to-lime-300/15 px-1.5 py-1 text-[10px] font-bold leading-none text-lime-100 shadow-[0_0_12px_rgba(200,255,61,0.16)] backdrop-blur-sm"
    >
      <BadgeIcon icon=":cat_love:" image={badgeArtForSlug("verified")} glow="#c8ff3d" size={14} />
      Verified
    </span>
  );
}
