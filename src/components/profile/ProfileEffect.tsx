import { useMemo } from "react";

const STYLE_CLASS: Record<string, string> = {
  sparkles: "pfx-sparkles",
  hearts: "pfx-hearts",
  snow: "pfx-snow",
  confetti: "pfx-confetti",
  embers: "pfx-embers",
  bubbles: "pfx-bubbles",
  stars: "pfx-stars",
  lightning: "pfx-lightning",
  petals: "pfx-petals",
  meteors: "pfx-meteors",
};

/** Full-coverage overlay effect (banner/profile card background). */
export function ProfileEffect({ slug, accent }: { slug?: string | null; accent?: string | null }) {
  if (!slug) return null;

  // Discord-style effects
  if (slug === "fx-cosmic-nebula") return <CosmicNebulaOverlay />;
  if (slug === "fx-cyber-matrix") return <CyberMatrixOverlay />;
  if (slug === "fx-cherry-petals") return <CherryPetalsOverlay />;
  if (slug === "fx-dragon-inferno") return <DragonInfernoOverlay />;
  if (slug === "fx-thunder-storm") return <ThunderStormOverlay />;
  if (slug === "fx-kawaii-hearts") return <KawaiiHeartsOverlay />;

  // Legacy exact overlays
  if (slug === "fx-confetti") return <ConfettiOverlay />;
  if (slug === "fx-snow") return <SnowOverlay />;
  if (slug === "fx-sparkles") return <SparklesOverlay />;
  if (slug === "fx-glitch") return <GlitchOverlay />;

  // Procedural: fx-<style>-<color>
  if (slug.startsWith("fx-")) {
    const style = slug.split("-")[1];
    const cls = STYLE_CLASS[style];
    if (cls) return <div className={`pfx ${cls}`} style={accent ? ({ ["--ec" as any]: accent } as React.CSSProperties) : undefined} />;
  }
  return null;
}

/** 1. Discord Cosmic Galaxy Nebula with shooting stars & twinkling stardust */
function CosmicNebulaOverlay() {
  const stars = useMemo(() => Array.from({ length: 32 }, (_, i) => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 1 + Math.random() * 3,
    delay: Math.random() * 4,
    color: ["#ffffff", "#fef08a", "#93c5fd", "#c084fc"][i % 4],
  })), []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Rotating Nebula Gas Cloud */}
      <div className="absolute -inset-1/2 opacity-35 animate-[discord-orbit-cw_30s_linear_infinite] bg-[radial-gradient(circle_at_30%_40%,rgba(168,85,247,0.4),transparent_50%),radial-gradient(circle_at_70%_60%,rgba(6,182,212,0.35),transparent_50%)]" />

      {/* Twinkling Stars */}
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute block rounded-full"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            backgroundColor: s.color,
            boxShadow: `0 0 6px ${s.color}`,
            animation: `discord-star-twinkle 2.4s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}

      {/* Diagonal Shooting Stars */}
      <div className="absolute top-[10%] left-[20%] w-24 h-0.5 bg-gradient-to-r from-transparent via-cyan-200 to-white shadow-[0_0_8px_#38bdf8] animate-[discord-shooting-star_6s_ease-out_infinite]" />
      <div className="absolute top-[40%] left-[60%] w-32 h-0.5 bg-gradient-to-r from-transparent via-purple-300 to-white shadow-[0_0_8px_#c084fc] animate-[discord-shooting-star_8s_ease-out_infinite_3s]" />
    </div>
  );
}

/** 2. Discord Cyberpunk Laser Grid with descending scanline & tech data */
function CyberMatrixOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Perspective Cyber Grid */}
      <div
        className="absolute bottom-0 left-0 right-0 h-1/2 opacity-25"
        style={{
          background: "linear-gradient(to bottom, transparent, rgba(6,182,212,0.15)), repeating-linear-gradient(90deg, rgba(6,182,212,0.3) 0 1px, transparent 1px 24px), repeating-linear-gradient(0deg, rgba(6,182,212,0.3) 0 1px, transparent 1px 16px)",
          transform: "perspective(120px) rotateX(45deg)",
          transformOrigin: "bottom",
        }}
      />

      {/* Descending Holographic Laser Beam */}
      <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#06b6d4,0_0_30px_#38bdf8] animate-[discord-laser-scan_4s_linear_infinite]" />

      {/* CRT Scanline Bars */}
      <div
        className="absolute inset-0 opacity-15"
        style={{
          background: "repeating-linear-gradient(0deg, #000 0 2px, transparent 2px 4px)",
        }}
      />
    </div>
  );
}

/** 3. Discord Sakura Blossom Storm with organic wind drift */
function CherryPetalsOverlay() {
  const petals = useMemo(() => Array.from({ length: 22 }, (_, i) => ({
    x: Math.random() * 110 - 5,
    size: 10 + Math.random() * 8,
    delay: Math.random() * 5,
    duration: 5 + Math.random() * 4,
  })), []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {petals.map((p, i) => (
        <span
          key={i}
          className="absolute block text-rose-300 select-none opacity-80"
          style={{
            left: `${p.x}%`,
            top: "-15%",
            fontSize: p.size,
            animation: `confetti-drift ${p.duration}s linear ${p.delay}s infinite`,
            filter: "drop-shadow(0 0 6px rgba(251,113,133,0.5))",
          }}
        >
          🌸
        </span>
      ))}
    </div>
  );
}

/** 4. Discord Dragon's Inferno with rising volcanic embers & heat distortion */
function DragonInfernoOverlay() {
  const embers = useMemo(() => Array.from({ length: 28 }, (_, i) => ({
    x: Math.random() * 100,
    size: 2 + Math.random() * 4,
    delay: Math.random() * 4,
    duration: 3 + Math.random() * 3,
    color: ["#facc15", "#f97316", "#ef4444", "#ffffff"][i % 4],
  })), []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Bottom Heat Core Glow */}
      <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-orange-600/25 via-red-600/10 to-transparent animate-pulse" />

      {/* Rising Embers */}
      {embers.map((e, i) => (
        <span
          key={i}
          className="absolute block rounded-full"
          style={{
            left: `${e.x}%`,
            bottom: "-10%",
            width: e.size,
            height: e.size,
            backgroundColor: e.color,
            boxShadow: `0 0 8px ${e.color}`,
            animation: `snow-fall ${e.duration}s linear ${e.delay}s reverse infinite`,
          }}
        />
      ))}
    </div>
  );
}

/** 5. Discord Thunder Tempest with intermittent lightning flashes */
function ThunderStormOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Sky Flash */}
      <div className="absolute inset-0 bg-cyan-400/10 animate-[discord-electric-spark_3s_infinite]" />

      {/* Branching Lightning Arc */}
      <svg viewBox="0 0 200 100" className="absolute top-0 right-[15%] w-48 h-32 opacity-75 animate-[discord-electric-spark_2.4s_infinite]">
        <path
          d="M 120 0 L 110 30 L 135 34 L 95 70 L 105 72 L 75 100"
          fill="none"
          stroke="#e0f2fe"
          strokeWidth="2.5"
          filter="drop-shadow(0 0 8px #38bdf8)"
        />
        <path
          d="M 110 30 L 80 45"
          fill="none"
          stroke="#bae6fd"
          strokeWidth="1.5"
          filter="drop-shadow(0 0 5px #0284c7)"
        />
      </svg>
    </div>
  );
}

/** 6. Discord Pastel Fairy Hearts */
function KawaiiHeartsOverlay() {
  const hearts = useMemo(() => Array.from({ length: 16 }, (_, i) => ({
    x: Math.random() * 95,
    delay: Math.random() * 4,
    duration: 4 + Math.random() * 3,
    size: 12 + Math.random() * 8,
    color: ["#ff2d92", "#f472b6", "#c084fc", "#fda4af"][i % 4],
  })), []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {hearts.map((h, i) => (
        <span
          key={i}
          className="absolute block select-none"
          style={{
            left: `${h.x}%`,
            bottom: "-10%",
            fontSize: h.size,
            color: h.color,
            filter: `drop-shadow(0 0 6px ${h.color})`,
            animation: `snow-fall ${h.duration}s linear ${h.delay}s reverse infinite`,
          }}
        >
          ♥
        </span>
      ))}
    </div>
  );
}

function ConfettiOverlay() {
  const pieces = useMemo(() => Array.from({ length: 24 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 4,
    duration: 3 + Math.random() * 3,
    color: ["#ff2d92", "#a855f7", "#22d3ee", "#facc15", "#22c55e"][i % 5],
    size: 6 + Math.random() * 6,
  })), []);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <span key={i} className="absolute block rounded-sm" style={{
          left: `${p.left}%`, top: 0, width: p.size, height: p.size * 1.6,
          background: p.color, animation: `confetti-drift ${p.duration}s linear ${p.delay}s infinite`,
        }} />
      ))}
    </div>
  );
}

function SnowOverlay() {
  const flakes = useMemo(() => Array.from({ length: 30 }, () => ({
    left: Math.random() * 100,
    delay: Math.random() * 5,
    duration: 4 + Math.random() * 6,
    size: 2 + Math.random() * 3,
  })), []);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {flakes.map((f, i) => (
        <span key={i} className="absolute block rounded-full bg-white" style={{
          left: `${f.left}%`, top: 0, width: f.size, height: f.size,
          animation: `snow-fall ${f.duration}s linear ${f.delay}s infinite`,
        }} />
      ))}
    </div>
  );
}

function SparklesOverlay() {
  const stars = useMemo(() => Array.from({ length: 20 }, () => ({
    left: Math.random() * 100, top: Math.random() * 100,
    delay: Math.random() * 3, size: 4 + Math.random() * 5,
  })), []);
  return (
    <div className="pointer-events-none absolute inset-0">
      {stars.map((s, i) => (
        <span key={i} className="absolute block" style={{
          left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size,
          background: "radial-gradient(circle, #fde047, transparent 65%)",
          animation: `sparkle-twinkle 2.4s ease-in-out ${s.delay}s infinite`,
        }} />
      ))}
    </div>
  );
}

function GlitchOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 mix-blend-screen opacity-30" style={{
      background: "repeating-linear-gradient(0deg, rgba(255,0,128,0.1) 0 2px, transparent 2px 4px)",
      animation: "glitch-rgb 1.6s steps(6) infinite",
    }} />
  );
}
