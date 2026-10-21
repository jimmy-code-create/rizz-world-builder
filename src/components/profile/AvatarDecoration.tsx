import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { BloodwebDecoration } from "./BloodwebDecoration";

type Props = {
  src?: string | null;
  fallback: string;
  size?: number;
  className?: string;
  /** Equipped avatar decoration slug; unknown slugs render plain. */
  decorationSlug?: string | null;
};

/**
 * A plain avatar plus whatever decoration is equipped in the avatar slot.
 * The decoration is transparent vector art that sits just outside the photo,
 * so ring, presence dot and layout stay exactly where they were.
 */
export function AvatarDecoration({
  src,
  fallback,
  size = 40,
  className,
  decorationSlug,
}: Props) {
  return (
    <div
      className={cn("relative inline-block select-none", className)}
      style={{ width: size, height: size }}
    >
      <Avatar className="relative z-[1] h-full w-full">
        <AvatarImage src={src ?? undefined} />
        <AvatarFallback className="bg-[var(--brand-ink-3,#1c1c1f)] text-[var(--brand-paper,#f4f1e7)] font-semibold">
          {fallback}
        </AvatarFallback>
      </Avatar>
      <BloodwebDecoration
        slug={decorationSlug}
        intensity={size < 44 ? 0.82 : 1}
      />
    </div>
  );
}
