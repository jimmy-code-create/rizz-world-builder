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

/** Full-coverage overlay effect (banner/profile background). */
export function ProfileEffect({ slug, accent }: { slug?: string | null; accent?: string | null }) {
  if (!slug) return null;
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