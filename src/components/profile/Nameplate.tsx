import { cn } from "@/lib/utils";
import { COSMETICS_ENABLED } from "@/lib/effects";

// Legacy exact slugs
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

function resolveLegacyOrProcedural(slug?: string | null): string | undefined {
  if (!slug) return undefined;
  if (LEGACY[slug]) return LEGACY[slug];
  if (slug.startsWith("np-p-")) {
    const style = slug.split("-")[2];
    return STYLE_CLASS[style] ?? "np-p-shimmer";
  }
  if (slug.startsWith("np-") && !isDiscordNameplate(slug)) {
    const style = slug.split("-")[1];
    return STYLE_CLASS[style] ?? "np-p-shimmer";
  }
  return undefined;
}

function isDiscordNameplate(slug?: string | null): boolean {
  if (!slug) return false;
  return [
    "np-cyberpunk",
    "np-cosmic",
    "np-sakura",
    "np-inferno",
    "np-vaporwave",
    "np-royal-gold",
    "np-glitch",
    "np-aurora",
  ].includes(slug);
}

export function Nameplate({
  name,
  slug,
  accent,
  variant = "badge",
  className,
}: {
  name: string;
  slug?: string | null;
  accent?: string | null;
  /** "badge" renders a Discord-style framed banner plate; "text" renders compact animated text */
  variant?: "badge" | "text";
  className?: string;
}) {
  // When cosmetics are paused, render all names plain
  if (!COSMETICS_ENABLED) {
    return <span className={className}>{name}</span>;
  }

  const style = accent ? ({ ["--nc" as any]: accent } as React.CSSProperties) : undefined;

  // 1. Full Discord-Style Framed Nameplates
  if (isDiscordNameplate(slug) && variant === "badge") {
    return <DiscordNameplateBadge slug={slug!} name={name} accent={accent} className={className} />;
  }

  // 2. Text-only styling for Discord-style items
  if (isDiscordNameplate(slug) && variant === "text") {
    return <DiscordNameplateText slug={slug!} name={name} className={className} />;
  }

  // 3. Legacy and Procedural nameplates
  const cls = resolveLegacyOrProcedural(slug);
  return (
    <span className={cn(cls, className)} style={style}>
      {name}
    </span>
  );
}

/**
 * Full Discord-Style Framed Nameplate Pill Badge
 */
function DiscordNameplateBadge({
  slug,
  name,
  accent,
  className,
}: {
  slug: string;
  name: string;
  accent?: string | null;
  className?: string;
}) {
  // Cyberpunk HUD
  if (slug === "np-cyberpunk") {
    return (
      <span
        className={cn(
          "relative inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono font-bold tracking-wider",
          "border border-[#06b6d4]/60 bg-[#08121e]/90 text-[#22d3ee] shadow-[0_0_15px_rgba(6,182,212,0.25)]",
          "overflow-hidden select-none",
          className,
        )}
      >
        {/* Animated laser scan sheen */}
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/25 to-transparent animate-[discord-nameplate-sheen_3.5s_infinite]" />
        {/* Tech Corner Brackets */}
        <span className="absolute top-0 left-0 w-1.5 h-1.5 border-t-2 border-l-2 border-[#06b6d4]" />
        <span className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b-2 border-r-2 border-[#ff2d92]" />
        {/* Blinking HUD dot */}
        <span className="h-1.5 w-1.5 rounded-full bg-[#06b6d4] shadow-[0_0_6px_#06b6d4] animate-pulse shrink-0" />
        <span className="relative drop-shadow-[0_0_8px_rgba(6,182,212,0.8)] truncate">{name}</span>
      </span>
    );
  }

  // Cosmic Nebula
  if (slug === "np-cosmic") {
    return (
      <span
        className={cn(
          "relative inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide",
          "border border-indigo-400/50 bg-gradient-to-r from-[#1e1b4b]/95 via-[#312e81]/80 to-[#1e1b4b]/95 text-indigo-100 shadow-[0_0_18px_rgba(99,102,241,0.35)]",
          "overflow-hidden select-none",
          className,
        )}
      >
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-purple-300/20 to-transparent animate-[discord-nameplate-sheen_4s_infinite]" />
        <span className="text-[10px] text-amber-300 animate-[discord-star-twinkle_2s_infinite]">✦</span>
        <span className="relative bg-gradient-to-r from-purple-200 via-pink-200 to-cyan-200 bg-clip-text text-transparent font-bold truncate">
          {name}
        </span>
        <span className="text-[9px] text-cyan-300 animate-[discord-star-twinkle_2.4s_infinite_1s]">★</span>
      </span>
    );
  }

  // Sakura Blossom Garden
  if (slug === "np-sakura") {
    return (
      <span
        className={cn(
          "relative inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium tracking-wide",
          "border border-rose-300/40 bg-gradient-to-r from-[#4c0519]/70 via-[#831843]/50 to-[#4c0519]/70 text-rose-100 shadow-[0_0_15px_rgba(251,113,133,0.3)]",
          "overflow-hidden select-none backdrop-blur-xs",
          className,
        )}
      >
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-rose-300/20 to-transparent animate-[discord-nameplate-sheen_4.5s_infinite]" />
        <span className="text-[11px] drop-shadow-[0_0_4px_#fb7185]">🌸</span>
        <span className="relative text-rose-100 font-semibold truncate">{name}</span>
      </span>
    );
  }

  // Scorched Inferno
  if (slug === "np-inferno") {
    return (
      <span
        className={cn(
          "relative inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold tracking-wide",
          "border border-orange-500/60 bg-gradient-to-r from-[#431407]/90 via-[#7c2d12]/70 to-[#431407]/90 text-amber-200 shadow-[0_0_18px_rgba(234,88,12,0.4)]",
          "overflow-hidden select-none",
          className,
        )}
      >
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-amber-400/20 to-transparent animate-[discord-nameplate-sheen_3s_infinite]" />
        <span className="text-[11px] drop-shadow-[0_0_6px_#f97316] animate-pulse">🔥</span>
        <span className="relative bg-gradient-to-r from-yellow-200 via-amber-300 to-orange-400 bg-clip-text text-transparent truncate font-bold">
          {name}
        </span>
      </span>
    );
  }

  // Retro Synthwave 80s
  if (slug === "np-vaporwave") {
    return (
      <span
        className={cn(
          "relative inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono font-bold tracking-wider",
          "border border-fuchsia-500/60 bg-gradient-to-r from-[#2e1065]/90 via-[#581c87]/70 to-[#083344]/90 text-pink-300 shadow-[0_0_16px_rgba(236,72,153,0.35)]",
          "overflow-hidden select-none",
          className,
        )}
      >
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent animate-[discord-nameplate-sheen_3.5s_infinite]" />
        <span className="relative bg-gradient-to-r from-pink-400 via-purple-300 to-cyan-300 bg-clip-text text-transparent truncate">
          {name}
        </span>
      </span>
    );
  }

  // Gilded VIP Royal Crown
  if (slug === "np-royal-gold") {
    return (
      <span
        className={cn(
          "relative inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wider",
          "border border-amber-400/70 bg-gradient-to-r from-[#451a03]/90 via-[#78350f]/80 to-[#451a03]/90 text-amber-200 shadow-[0_0_20px_rgba(250,204,21,0.4)]",
          "overflow-hidden select-none",
          className,
        )}
      >
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-yellow-200/35 to-transparent animate-[discord-nameplate-sheen_2.8s_infinite]" />
        <span className="text-[11px] drop-shadow-[0_0_6px_#facc15]">👑</span>
        <span className="relative bg-gradient-to-r from-yellow-200 via-amber-100 to-yellow-300 bg-clip-text text-transparent font-bold truncate">
          {name}
        </span>
      </span>
    );
  }

  // Glitch Runner
  if (slug === "np-glitch") {
    return (
      <span
        className={cn(
          "relative inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-mono font-bold tracking-widest",
          "border border-rose-500/70 bg-black/90 text-rose-200 shadow-[0_0_16px_rgba(244,63,94,0.4)]",
          "overflow-hidden select-none animate-[glitch-rgb_1.8s_steps(4)_infinite]",
          className,
        )}
      >
        <span className="text-[10px] text-rose-400 font-bold">//</span>
        <span className="relative truncate">{name}</span>
        <span className="text-[10px] text-cyan-400 font-bold">_</span>
      </span>
    );
  }

  // Boreal Aurora
  if (slug === "np-aurora") {
    return (
      <span
        className={cn(
          "relative inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide",
          "border border-emerald-400/50 bg-gradient-to-r from-[#064e3b]/90 via-[#0f766e]/75 to-[#3b0764]/90 text-emerald-100 shadow-[0_0_18px_rgba(16,185,129,0.35)]",
          "overflow-hidden select-none",
          className,
        )}
      >
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-emerald-300/25 to-transparent animate-[discord-nameplate-sheen_4s_infinite]" />
        <span className="relative bg-gradient-to-r from-emerald-200 via-teal-100 to-violet-200 bg-clip-text text-transparent font-bold truncate">
          {name}
        </span>
      </span>
    );
  }

  return <span className={className}>{name}</span>;
}

/**
 * Inline Text-Only variant for Discord-style nameplates
 */
function DiscordNameplateText({ slug, name, className }: { slug: string; name: string; className?: string }) {
  if (slug === "np-cyberpunk") {
    return (
      <span className={cn("text-[#06b6d4] drop-shadow-[0_0_8px_#06b6d4] font-mono font-bold", className)}>
        {name}
      </span>
    );
  }
  if (slug === "np-cosmic") {
    return (
      <span className={cn("bg-gradient-to-r from-purple-300 via-pink-300 to-cyan-300 bg-clip-text text-transparent font-bold drop-shadow-[0_0_6px_#a855f7]", className)}>
        {name}
      </span>
    );
  }
  if (slug === "np-sakura") {
    return (
      <span className={cn("text-rose-200 font-semibold drop-shadow-[0_0_6px_#fb7185]", className)}>
        {name} 🌸
      </span>
    );
  }
  if (slug === "np-inferno") {
    return (
      <span className={cn("bg-gradient-to-r from-yellow-300 via-orange-400 to-red-500 bg-clip-text text-transparent font-bold drop-shadow-[0_0_6px_#f97316]", className)}>
        {name} 🔥
      </span>
    );
  }
  if (slug === "np-vaporwave") {
    return (
      <span className={cn("bg-gradient-to-r from-pink-400 via-fuchsia-300 to-cyan-400 bg-clip-text text-transparent font-bold", className)}>
        {name}
      </span>
    );
  }
  if (slug === "np-royal-gold") {
    return (
      <span className={cn("bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-300 bg-clip-text text-transparent font-bold drop-shadow-[0_0_6px_#facc15]", className)}>
        👑 {name}
      </span>
    );
  }
  if (slug === "np-glitch") {
    return (
      <span className={cn("text-rose-300 font-mono font-bold animate-[glitch-rgb_1.8s_steps(4)_infinite]", className)}>
        {name}
      </span>
    );
  }
  if (slug === "np-aurora") {
    return (
      <span className={cn("bg-gradient-to-r from-emerald-200 via-teal-200 to-purple-300 bg-clip-text text-transparent font-bold drop-shadow-[0_0_6px_#10b981]", className)}>
        {name}
      </span>
    );
  }
  return <span className={className}>{name}</span>;
}
