// Lightweight zero-dep confetti burst from a screen point.
// Spawns absolutely-positioned emoji particles that fall + fade.

const EMOJIS = ["✨", "💖", "🔥", "🎉", "💫", "⭐", "🌟", "💥"];

export function confettiBurst(x?: number, y?: number, count = 28) {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const cx = x ?? window.innerWidth / 2;
  const cy = y ?? window.innerHeight / 3;
  const root = document.createElement("div");
  root.style.cssText =
    "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden";
  document.body.appendChild(root);

  for (let i = 0; i < count; i++) {
    const el = document.createElement("span");
    el.textContent = EMOJIS[i % EMOJIS.length];
    const angle = Math.random() * Math.PI * 2;
    const dist = 80 + Math.random() * 200;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 80;
    const rot = (Math.random() - 0.5) * 720;
    const size = 14 + Math.random() * 18;
    const dur = 900 + Math.random() * 800;
    el.style.cssText = `position:absolute;left:${cx}px;top:${cy}px;font-size:${size}px;transform:translate(-50%,-50%);will-change:transform,opacity;`;
    root.appendChild(el);
    el.animate(
      [
        { transform: "translate(-50%,-50%) rotate(0deg)", opacity: 1 },
        {
          transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${rot}deg)`,
          opacity: 0,
        },
      ],
      { duration: dur, easing: "cubic-bezier(.2,.7,.3,1)", fill: "forwards" },
    );
  }
  setTimeout(() => root.remove(), 2200);
}