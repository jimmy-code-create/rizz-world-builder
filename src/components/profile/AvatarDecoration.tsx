import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

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
  const isDiscordDeco = effectSlug?.startsWith("deco-");

  return (
    <div
      className={cn("relative inline-block select-none", className)}
      style={{ width: size, height: size }}
    >
      {/* 1. Discord-Style Animated SVG Decorations */}
      {isDiscordDeco && <DiscordAvatarDecoration slug={effectSlug!} size={size} accent={accent} />}

      {/* 2. Legacy / Procedural Rings */}
      {ringClass && (
        <div
          className={cn("absolute inset-0 rounded-full pointer-events-none", ringClass)}
          style={{ ["--ec" as any]: accent || "#ff2d92" }}
        />
      )}

      {/* Avatar Content */}
      <Avatar
        className="relative h-full w-full"
        style={{
          boxShadow: !ringClass && !isDiscordDeco && accent ? `0 0 0 2px ${accent}66, 0 0 12px ${accent}33` : undefined,
        }}
      >
        <AvatarImage src={src ?? undefined} />
        <AvatarFallback className="bg-gradient-primary text-primary-foreground font-bold">{fallback}</AvatarFallback>
      </Avatar>
    </div>
  );
}

/**
 * High-fidelity Discord-style avatar decorations rendered with layered SVG & CSS animations
 */
function DiscordAvatarDecoration({ slug, size, accent }: { slug: string; size: number; accent?: string | null }) {
  // Cyber Oni Horns
  if (slug === "deco-cyber-horns") {
    return (
      <div
        className="pointer-events-none absolute -inset-[22%] z-10 flex items-center justify-center animate-[discord-horn-pulse_3s_ease-in-out_infinite]"
        style={{ ["--ec" as any]: accent || "#06b6d4" }}
      >
        <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
          <defs>
            <linearGradient id="cyber-horn-l" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ff2d92" />
              <stop offset="60%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
            <linearGradient id="cyber-horn-r" x1="100%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#ff2d92" />
              <stop offset="60%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
            <filter id="horn-glow">
              <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Left Horn */}
          <path
            d="M 28 32 C 22 22 14 10 6 2 C 14 14 22 24 24 38 Z"
            fill="url(#cyber-horn-l)"
            filter="url(#horn-glow)"
          />
          <path d="M 12 10 L 22 25" stroke="#ffffff" strokeWidth="0.8" opacity="0.9" />
          <circle cx="6" cy="2" r="2" fill="#06b6d4" className="animate-ping" />
          <circle cx="6" cy="2" r="1.5" fill="#ffffff" />

          {/* Right Horn */}
          <path
            d="M 72 32 C 78 22 86 10 94 2 C 86 14 78 24 76 38 Z"
            fill="url(#cyber-horn-r)"
            filter="url(#horn-glow)"
          />
          <path d="M 88 10 L 78 25" stroke="#ffffff" strokeWidth="0.8" opacity="0.9" />
          <circle cx="94" cy="2" r="2" fill="#06b6d4" className="animate-ping" />
          <circle cx="94" cy="2" r="1.5" fill="#ffffff" />

          {/* Glowing Cyber Rim Frame */}
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="url(#cyber-horn-l)"
            strokeWidth="2"
            strokeDasharray="6 4 12 4"
            className="animate-[discord-orbit-cw_12s_linear_infinite]"
          />
        </svg>
      </div>
    );
  }

  // Angelic Celestial Halo
  if (slug === "deco-celestial-halo") {
    return (
      <div className="pointer-events-none absolute -inset-[25%] z-10">
        {/* Floating Halo above the avatar */}
        <div className="absolute top-[2%] left-1/2 -translate-x-1/2 w-[65%] h-[24%] animate-[discord-halo-float_3.2s_ease-in-out_infinite]">
          <div className="w-full h-full rounded-full border-[3px] border-[#facc15] shadow-[0_0_15px_#facc15,inset_0_0_10px_#fef08a] bg-gradient-to-r from-[#facc15]/30 via-[#fef08a]/60 to-[#facc15]/30" />
          <span className="absolute -top-1 left-[20%] text-[8px] animate-[discord-star-twinkle_2s_infinite]">✨</span>
          <span className="absolute -top-1 right-[20%] text-[9px] animate-[discord-star-twinkle_2.5s_infinite_0.7s]">✦</span>
        </div>

        {/* Orbiting Starlight Sparkles */}
        <div className="absolute inset-0 animate-[discord-orbit-cw_8s_linear_infinite]">
          <span className="absolute top-[10%] left-[15%] text-[#facc15] text-[10px] drop-shadow-[0_0_6px_#facc15]">★</span>
          <span className="absolute bottom-[10%] right-[15%] text-[#fde047] text-[8px] drop-shadow-[0_0_6px_#fde047]">✦</span>
        </div>

        {/* Subtle Golden Ray Ring */}
        <div className="absolute inset-[8%] rounded-full border border-[#facc15]/40 shadow-[0_0_12px_rgba(250,204,21,0.3)] animate-pulse" />
      </div>
    );
  }

  // Phoenix Flame Aura
  if (slug === "deco-phoenix-flame") {
    return (
      <div className="pointer-events-none absolute -inset-[22%] z-10 flex items-center justify-center animate-[discord-flame-flicker_1.8s_ease-in-out_infinite]">
        <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
          <defs>
            <linearGradient id="flame-grad" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="50%" stopColor="#f97316" />
              <stop offset="90%" stopColor="#facc15" />
              <stop offset="100%" stopColor="#ffffff" />
            </linearGradient>
            <filter id="flame-blur">
              <feGaussianBlur stdDeviation="1.5" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Fire Corona around avatar */}
          <path
            d="M 50 4 C 40 18 36 28 30 38 C 24 30 18 34 16 48 C 14 62 26 86 50 94 C 74 86 86 62 84 48 C 82 34 76 30 70 38 C 64 28 60 18 50 4 Z"
            fill="none"
            stroke="url(#flame-grad)"
            strokeWidth="3.5"
            strokeLinecap="round"
            filter="url(#flame-blur)"
          />

          {/* Rising flame tongue tips */}
          <path d="M 50 2 Q 47 12 50 20 Q 53 12 50 2 Z" fill="#fef08a" />
          <path d="M 28 14 Q 24 24 30 30 Q 32 22 28 14 Z" fill="#facc15" />
          <path d="M 72 14 Q 76 24 70 30 Q 68 22 72 14 Z" fill="#facc15" />

          {/* Rising Sparks */}
          <circle cx="34" cy="18" r="1.5" fill="#fef08a" className="animate-ping" />
          <circle cx="66" cy="16" r="1.5" fill="#fef08a" className="animate-ping" />
        </svg>
      </div>
    );
  }

  // Sakura Petal Orbit
  if (slug === "deco-sakura-bloom") {
    return (
      <div className="pointer-events-none absolute -inset-[22%] z-10">
        {/* Blossom corner ornaments */}
        <div className="absolute top-0 right-1 text-base drop-shadow-[0_0_8px_#fb7185] animate-bounce">🌸</div>
        <div className="absolute bottom-1 left-0 text-sm drop-shadow-[0_0_6px_#fb7185]">🌸</div>

        {/* Orbiting clockwise petals */}
        <div className="absolute inset-0 animate-[discord-orbit-cw_7s_linear_infinite]">
          <span className="absolute top-[8%] left-[45%] text-[10px] drop-shadow-[0_0_6px_#fda4af]">🌸</span>
          <span className="absolute bottom-[12%] right-[20%] text-[9px] drop-shadow-[0_0_6px_#fda4af]">🌸</span>
        </div>

        {/* Orbiting counter-clockwise petals */}
        <div className="absolute inset-0 animate-[discord-orbit-ccw_10s_linear_infinite]">
          <span className="absolute top-[60%] left-[6%] text-[11px] drop-shadow-[0_0_6px_#fb7185]">🌸</span>
          <span className="absolute top-[25%] right-[10%] text-[8px] drop-shadow-[0_0_6px_#fb7185]">🌸</span>
        </div>

        {/* Soft Pink Glowing Ring */}
        <div className="absolute inset-[8%] rounded-full border-2 border-[#fb7185]/70 shadow-[0_0_14px_#fb7185]" />
      </div>
    );
  }

  // Arcane Spellcircle
  if (slug === "deco-arcane-runes") {
    return (
      <div className="pointer-events-none absolute -inset-[25%] z-10 animate-[discord-rune-glow_2.5s_ease-in-out_infinite]">
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <defs>
            <linearGradient id="arcane-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="50%" stopColor="#ec4899" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
          </defs>

          {/* Outer Rune Ring (rotating CW) */}
          <g className="origin-center animate-[discord-orbit-cw_16s_linear_infinite]">
            <circle cx="50" cy="50" r="46" fill="none" stroke="url(#arcane-grad)" strokeWidth="1.2" strokeDasharray="3 4 8 4" />
            <circle cx="50" cy="50" r="43" fill="none" stroke="#a855f7" strokeWidth="0.8" opacity="0.6" />
            <text x="50" y="8" fill="#ec4899" fontSize="5" textAnchor="middle" fontWeight="bold">᚛</text>
            <text x="92" y="52" fill="#06b6d4" fontSize="5" textAnchor="middle" fontWeight="bold">ᚱ</text>
            <text x="50" y="96" fill="#a855f7" fontSize="5" textAnchor="middle" fontWeight="bold">ᛁ</text>
            <text x="8" y="52" fill="#ec4899" fontSize="5" textAnchor="middle" fontWeight="bold">ᛉ</text>
          </g>

          {/* Inner Magic Hexagram (rotating CCW) */}
          <g className="origin-center animate-[discord-orbit-ccw_12s_linear_infinite]">
            <circle cx="50" cy="50" r="40" fill="none" stroke="url(#arcane-grad)" strokeWidth="1" strokeDasharray="6 3" />
            <polygon points="50,15 76,68 24,68" fill="none" stroke="#a855f7" strokeWidth="0.6" opacity="0.5" />
            <polygon points="50,75 76,22 24,22" fill="none" stroke="#ec4899" strokeWidth="0.6" opacity="0.5" />
          </g>
        </svg>
      </div>
    );
  }

  // Plasma Surge Storm
  if (slug === "deco-electric-storm") {
    return (
      <div className="pointer-events-none absolute -inset-[22%] z-10 animate-[discord-electric-spark_1.6s_steps(8)_infinite]">
        <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
          <defs>
            <linearGradient id="elec-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="50%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
            <filter id="elec-glow">
              <feGaussianBlur stdDeviation="2" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Jagged Lightning Ring */}
          <path
            d="M 50 4 L 56 16 L 68 8 L 64 22 L 80 20 L 72 34 L 88 40 L 76 52 L 90 62 L 74 70 L 82 84 L 66 82 L 68 96 L 52 86 L 46 98 L 40 84 L 26 92 L 32 76 L 16 78 L 26 64 L 10 54 L 24 44 L 14 30 L 30 32 L 28 16 L 42 24 Z"
            fill="none"
            stroke="url(#elec-grad)"
            strokeWidth="2.5"
            strokeLinejoin="miter"
            filter="url(#elec-glow)"
          />

          {/* Electric Spark Center Flash */}
          <circle cx="50" cy="50" r="42" fill="none" stroke="#38bdf8" strokeWidth="1" strokeDasharray="4 6" className="animate-[discord-orbit-cw_2s_linear_infinite]" />
        </svg>
      </div>
    );
  }

  // Cyber Neko Ears
  if (slug === "deco-neko-ears") {
    return (
      <div className="pointer-events-none absolute -inset-[22%] z-10">
        <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible animate-[discord-neko-twitch_4s_ease-in-out_infinite]">
          <defs>
            <linearGradient id="neko-grad" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#ff2d92" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
          </defs>

          {/* Left Cat Ear */}
          <path
            d="M 20 32 C 16 16 14 4 6 0 C 14 8 28 16 34 26 Z"
            fill="url(#neko-grad)"
            filter="drop-shadow(0 0 6px #ff2d92)"
          />
          <path d="M 18 26 C 16 14 14 8 10 4 C 14 10 22 16 26 22 Z" fill="#ffffff" opacity="0.75" />

          {/* Right Cat Ear */}
          <path
            d="M 80 32 C 84 16 86 4 94 0 C 86 8 72 16 66 26 Z"
            fill="url(#neko-grad)"
            filter="drop-shadow(0 0 6px #06b6d4)"
          />
          <path d="M 82 26 C 84 14 86 8 90 4 C 86 10 78 16 74 22 Z" fill="#ffffff" opacity="0.75" />

          {/* Glowing Headset Band */}
          <circle cx="50" cy="50" r="43" fill="none" stroke="url(#neko-grad)" strokeWidth="2.5" />
        </svg>
      </div>
    );
  }

  // Matrix Glitch Frame
  if (slug === "deco-glitch-matrix") {
    return (
      <div className="pointer-events-none absolute -inset-[18%] z-10 animate-[glitch-rgb_1.8s_steps(5)_infinite]">
        <svg viewBox="0 0 100 100" className="h-full w-full">
          {/* Tech HUD Corner Brackets */}
          <path d="M 12 28 L 12 12 L 28 12" fill="none" stroke="#22c55e" strokeWidth="2.5" />
          <path d="M 88 28 L 88 12 L 72 12" fill="none" stroke="#22c55e" strokeWidth="2.5" />
          <path d="M 12 72 L 12 88 L 28 88" fill="none" stroke="#22c55e" strokeWidth="2.5" />
          <path d="M 88 72 L 88 88 L 72 88" fill="none" stroke="#22c55e" strokeWidth="2.5" />

          {/* Glitch Frame Ring */}
          <circle cx="50" cy="50" r="42" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeDasharray="14 8 4 6" className="animate-[discord-orbit-cw_6s_linear_infinite]" />
          <circle cx="50" cy="50" r="45" fill="none" stroke="#ff2d92" strokeWidth="0.8" opacity="0.8" strokeDasharray="6 12" />
        </svg>
      </div>
    );
  }

  // Cosmic Galaxy Vortex
  if (slug === "deco-cosmic-vortex") {
    return (
      <div className="pointer-events-none absolute -inset-[24%] z-10">
        <svg viewBox="0 0 100 100" className="h-full w-full animate-[discord-orbit-cw_14s_linear_infinite]">
          <defs>
            <radialGradient id="vortex-grad">
              <stop offset="0%" stopColor="#312e81" stopOpacity="0" />
              <stop offset="60%" stopColor="#818cf8" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="1" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="44" fill="none" stroke="url(#vortex-grad)" strokeWidth="3" strokeDasharray="20 10 40 8" />
          <circle cx="50" cy="50" r="41" fill="none" stroke="#c084fc" strokeWidth="1.5" strokeDasharray="8 16" />
          <circle cx="20" cy="24" r="2" fill="#ffffff" className="animate-ping" />
          <circle cx="82" cy="74" r="2.5" fill="#38bdf8" />
          <circle cx="78" cy="22" r="1.5" fill="#f472b6" />
        </svg>
      </div>
    );
  }

  // Fallback glowing ring
  return (
    <div
      className="pointer-events-none absolute -inset-1 rounded-full border-2 border-[var(--ec)] shadow-[0_0_15px_var(--ec)] animate-pulse"
      style={{ ["--ec" as any]: accent || "#ff2d92" }}
    />
  );
}
