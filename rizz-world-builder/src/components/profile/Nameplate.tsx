import { cn } from "@/lib/utils";

// Legacy slugs
const LEGACY: Record<string, string> = {
  "np-gold": "np-gold",
  "np-vapor": "np-vapor",
  "np-mythic": "np-mythic",
  "np-glitch": "np-glitch",
};

// Procedural style → class map (used for np-<style>-<color>)
const STYLE_CLASS: Record<string, string> = {
  shimmer: "np-p-shimmer",
  gradient: "np-p-gradient",
  glow: "np-p-glow",
  glitch: "np-p-glitch",
  rainbow: "np-p-rainbow",
  chrome: "np-p-chrome",
  sparkle: "np-p-sparkle",
  wave: "np-p-wave",
  neon: "np-p-neon",
  ember: "np-p-ember",
  ice: "np-p-ice",
  mythic: "np-p-mythic",
};

function resolve(slug?: string | null): string | undefined {
  if (!slug) return undefined;
  if (LEGACY[slug]) return LEGACY[slug];
  if (slug.startsWith("np-")) {
    const style = slug.split("-")[1];
    return STYLE_CLASS[style] ?? "np-p-shimmer";
  }
  return undefined;
}

export function Nameplate({
  name,
  slug,
  accent,
  className,
}: {
  name: string;
  slug?: string | null;
  accent?: string | null;
  className?: string;
}) {
  const cls = resolve(slug);
  const style = accent ? ({ ["--nc" as any]: accent } as React.CSSProperties) : undefined;
  return <span className={cn(cls, className)} style={style}>{name}</span>;
}