import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type Props = {
  src?: string | null;
  fallback: string;
  size?: number;
  className?: string;
};

/**
 * A plain avatar.
 *
 * Avatar decorations were part of the cosmetics catalogue that was removed
 * when the profile effects were trimmed to the single Web Slinger effect. The
 * component and its call sites stay so every avatar surface keeps its exact
 * size, ring and layout.
 */
export function AvatarDecoration({ src, fallback, size = 40, className }: Props) {
  return (
    <div
      className={cn("relative inline-block select-none", className)}
      style={{ width: size, height: size }}
    >
      <Avatar className="relative h-full w-full">
        <AvatarImage src={src ?? undefined} />
        <AvatarFallback className="bg-[var(--brand-ink-3,#1c1c1f)] text-[var(--brand-paper,#f4f1e7)] font-semibold">
          {fallback}
        </AvatarFallback>
      </Avatar>
    </div>
  );
}
