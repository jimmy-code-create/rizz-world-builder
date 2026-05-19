import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const RING_CLASS: Record<string, string> = {
  "ring-neon": "fx-ring-neon",
  "ring-aurora": "fx-ring-aurora",
  "ring-fire": "fx-ring-fire",
  "ring-holo": "fx-ring-holo",
  "ring-sakura": "fx-ring-sakura",
  "ring-electric": "fx-ring-electric",
};

type Props = {
  src?: string | null;
  fallback: string;
  size?: number;
  effectSlug?: string | null;
  accent?: string | null;
  className?: string;
};

export function AvatarDecoration({ src, fallback, size = 40, effectSlug, accent, className }: Props) {
  const ringClass = effectSlug ? RING_CLASS[effectSlug] : undefined;
  return (
    <div className={cn("relative inline-block", className)} style={{ width: size, height: size }}>
      {ringClass && <div className={cn("absolute inset-0 rounded-full pointer-events-none", ringClass)} style={{ ["--ec" as any]: accent || "#ff2d92" }} />}
      <Avatar className="relative" style={{ width: size, height: size, boxShadow: !ringClass && accent ? `0 0 0 2px ${accent}66, 0 0 12px ${accent}33` : undefined }}>
        <AvatarImage src={src ?? undefined} />
        <AvatarFallback className="bg-gradient-primary text-primary-foreground font-bold">{fallback}</AvatarFallback>
      </Avatar>
    </div>
  );
}