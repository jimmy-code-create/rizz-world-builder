import { Badge } from "@/components/Badge";

/** The identity-verified pill shown beside verified member names. */
export function VerifiedCreatorTag() {
  return (
    <span
      role="img"
      title="Verified"
      aria-label="Verified"
      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-[#39b7ff]/30 bg-[#39b7ff]/12 px-1.5 py-1 text-[10px] font-bold leading-none text-[#dff4ff]"
    >
      <Badge slug="verified" size={16} />
      Verified
    </span>
  );
}
