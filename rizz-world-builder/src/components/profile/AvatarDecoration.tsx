import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/**
 * Slug resolution:
 *  - legacy exact slugs ("ring-neon", "ring-aurora", …) still work
 *  - procedural slugs "ring-<style>-<color>" (e.g. "ring-ice-cyan") map by <style>
 *  - unknown → colored glow ring using accent
 */
const STYLE_CLASS: Record<string, string> = {
  neon: "fx-ring-neon",
  aurora: "fx-ring-aurora",
  fire: "fx-ring-fire",
  holo: "fx-ring-holo",
  sakura: "fx-ring-sakura",
  electric: "fx-ring-electric",
  ice: "fx-ring-ice",
  toxic: "fx-ring-toxic",
  sunset: "fx-ring-sunset",
  galaxy: "fx-ring-galaxy",
  chrome: "fx-ring-chrome",
  ember: "fx-ring-ember",
};
function resolveRingClass(slug?: string | null): string | undefined {
  if (!slug) return undefined;
  if (!slug.startsWith("ring-")) return undefined;
  const parts = slug.split("-");
  // ring-<style> OR ring-<style>-<color>
  return STYLE_CLASS[parts[1]] ?? "fx-ring-neon";
}

type Props = {
  src?: string | null;
  fallback: string;
  size?: number;
  effectSlug?: string | null;
  accent?: string | null;
  className?: string;
};

export function AvatarDecoration({ src, fallback, size = 40, effectSlug, accent, className }: Props) {
  const ringClass = resolveRingClass(effectSlug);
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