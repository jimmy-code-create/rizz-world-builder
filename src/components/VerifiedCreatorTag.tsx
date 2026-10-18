import { Badge } from "@/components/Badge";

/** The identity-verified pill shown beside verified member names. */
export function VerifiedCreatorTag() {
  return (
    <span
      role="img"
      title="Verified"
      aria-label="Verified"
      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-lime-300/25 bg-lime-300/10 px-1.5 py-1 text-[10px] font-bold leading-none text-lime-100"
    >
      <Badge slug="verified" size={16} />
      Verified
    </span>
  );
}
