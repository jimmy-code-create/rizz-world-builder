import { useEffect, useRef, useState } from "react";
import type { CatEmojiName } from "./cat-emoji-manifest";

/**
 * <CatEmoji name size animate />
 * Inline SVG black-cat head (lime ears/whiskers/eye accents), viewBox 0 0 64 64.
 * CSS keyframes only. Static frame under prefers-reduced-motion.
 *
 * animate:
 * - false / "static": no animation
 * - "hover": animates only on hover/press/focus (picker grids)
 * - "once": plays once 600ms (reaction just added)
 * - "loop": continuous loop (capped: max 3 on screen via module budget,
 *   paused offscreen via IntersectionObserver)
 */

// Global loop budget: at most 3 looping emojis on screen.
let liveLoops = 0;
const loopWaiters = new Set<() => void>();
function claimLoopSlot(): boolean {
  if (liveLoops < 3) {
    liveLoops += 1;
    return true;
  }
  return false;
}
function releaseLoopSlot() {
  liveLoops = Math.max(0, liveLoops - 1);
  const next = [...loopWaiters][0];
  if (next) {
    loopWaiters.delete(next);
    next();
  }
}

export function CatEmoji({
  name,
  size = 20,
  animate = false,
  className = "",
  label,
}: {
  name: CatEmojiName;
  size?: 16 | 20 | 24 | 32 | number;
  animate?: boolean | "hover" | "once" | "loop" | "static";
  className?: string;
  label?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(true);
  const [loopOn, setLoopOn] = useState(false);

  const mode: "static" | "hover" | "once" | "loop" =
    animate === true ? "loop" : animate === false ? "static" : animate;

  // Pause offscreen.
  useEffect(() => {
    const el = ref.current;
    if (!el || mode === "static") return;
    const io = new IntersectionObserver(
      (entries) => setVisible(entries[0]?.isIntersecting ?? true),
      { threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mode]);

  // Loop budget.
  useEffect(() => {
    if (mode !== "loop" || !visible) {
      setLoopOn(false);
      return;
    }
    let claimed = false;
    let cancelled = false;
    const tryClaim = () => {
      if (cancelled) return;
      if (claimLoopSlot()) {
        claimed = true;
        setLoopOn(true);
      } else {
        const retry = () => tryClaim();
        loopWaiters.add(retry);
        return () => loopWaiters.delete(retry);
      }
    };
    const cleanup = tryClaim();
    return () => {
      cancelled = true;
      if (typeof cleanup === "function") cleanup();
      if (claimed) {
        releaseLoopSlot();
        setLoopOn(false);
      }
    };
  }, [mode, visible]);

  const cls = [
    "cat-emoji",
    `cat-emoji--${name}`,
    mode === "hover" ? "cat-emoji--hover" : "",
    mode === "once" ? "cat-emoji--once" : "",
    mode === "loop" && loopOn && visible ? "cat-emoji--loop" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      ref={ref}
      role="img"
      aria-label={label ?? name.replace(/_/g, " ")}
      className={cls}
      style={{ width: size, height: size, display: "inline-grid", placeItems: "center", flex: "none" }}
    >
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
        {/* shared ears */}
        <path d="M12 26 8 6l16 10z" fill="#0b0b0c" stroke="#c8ff3d" strokeWidth="2" strokeLinejoin="round" />
        <path d="M52 26l4-20-16 10z" fill="#0b0b0c" stroke="#c8ff3d" strokeWidth="2" strokeLinejoin="round" />
        {name === "cat_hype" ? (
          <>
            <path className="fx" d="M14 18c-2-5 2-8 3-12 3 3 5 6 4 10" stroke="#f97316" strokeWidth="2.4" strokeLinecap="round" />
            <path className="fx" d="M50 18c2-5-2-8-3-12-3 3-5 6-4 10" stroke="#f97316" strokeWidth="2.4" strokeLinecap="round" />
          </>
        ) : null}
        {/* shared head */}
        <circle cx="32" cy="37" r="21" fill="#0b0b0c" stroke="#2a2a2e" strokeWidth="2" />
        {/* shared whiskers */}
        <g stroke="#c8ff3d" strokeWidth="1.6" strokeLinecap="round" opacity="0.9">
          <line x1="6" y1="38" x2="16" y2="40" />
          <line x1="6" y1="44" x2="16" y2="43" />
          <line x1="58" y1="38" x2="48" y2="40" />
          <line x1="58" y1="44" x2="48" y2="43" />
        </g>
        <EmojiFace name={name} />
      </svg>
    </span>
  );
}

function EmojiFace({ name }: { name: CatEmojiName }) {
  switch (name) {
    case "cat_love":
      return (
        <g className="fx">
          <path d="M21 33c-2.6-3.4.4-7 3-5.4C25.4 26.6 27 28 27 28s1.6-1.4 3-0.4c2.6 1.6-.4 5.4-3 5.4" fill="#c8ff3d" transform="translate(0,1) scale(1)" />
          <path d="M37 33c-2.6-3.4.4-7 3-5.4 1.4-1 3 .4 3 .4s1.6-1.4 3-.4c2.6 1.6-.4 5.4-3 5.4" fill="#c8ff3d" />
          <path className="fx-heart" d="M32 20c-1.6-2 .2-4 1.8-3.2.8-.6 2 .4 2 .4s1.2-1 2-.4c1.6.8-.2 3.2-1.8 3.2" fill="#c8ff3d" opacity="0.9" />
          <path d="M29 46q3 3 6 0" stroke="#f2efe6" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      );
    case "cat_cool":
      return (
        <g className="fx">
          <rect x="14" y="30" width="15" height="10" rx="3" fill="#0b0b0c" stroke="#c8ff3d" strokeWidth="2" />
          <rect x="35" y="30" width="15" height="10" rx="3" fill="#0b0b0c" stroke="#c8ff3d" strokeWidth="2" />
          <line x1="29" y1="33" x2="35" y2="33" stroke="#c8ff3d" strokeWidth="2" />
          <line className="fx-glint" x1="18" y1="31" x2="24" y2="39" stroke="#f2efe6" strokeWidth="2" strokeLinecap="round" />
          <path d="M28 47q4 3 8 0" stroke="#f2efe6" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      );
    case "cat_sleep":
      return (
        <g className="fx">
          <path d="M19 35q5 4 10 0" stroke="#c8ff3d" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M35 35q5 4 10 0" stroke="#c8ff3d" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M28 47q4 2 8 0" stroke="#f2efe6" strokeWidth="1.6" strokeLinecap="round" />
          <text className="fx-z" x="48" y="22" fontSize="11" fontWeight="800" fill="#c8ff3d" fontFamily="sans-serif">z</text>
          <text className="fx-z2" x="52" y="13" fontSize="8" fontWeight="800" fill="#c8ff3d" opacity="0.7" fontFamily="sans-serif">z</text>
        </g>
      );
    case "cat_lol":
      return (
        <g className="fx" stroke="#c8ff3d" strokeWidth="2.2" strokeLinecap="round">
          <path d="M19 34l4 3 4-3M19 37l4-3 4 3" fill="none" />
          <path d="M35 34l4 3 4-3M35 37l4-3 4 3" fill="none" />
          <path d="M26 45q6 6 12 0" fill="none" stroke="#f2efe6" />
        </g>
      );
    case "cat_wow":
      return (
        <g className="fx">
          <circle cx="24" cy="35" r="6.5" fill="#f2efe6" />
          <circle cx="40" cy="35" r="6.5" fill="#f2efe6" />
          <circle className="fx-pupil" cx="24" cy="36" r="2.6" fill="#0b0b0c" />
          <circle className="fx-pupil" cx="40" cy="36" r="2.6" fill="#0b0b0c" />
          <ellipse cx="32" cy="47" rx="3.4" ry="4.2" fill="none" stroke="#f2efe6" strokeWidth="1.8" />
        </g>
      );
    case "cat_sus":
      return (
        <g className="fx">
          <circle cx="24" cy="35" r="5.5" fill="none" stroke="#c8ff3d" strokeWidth="2" />
          <circle cx="40" cy="35" r="5.5" fill="none" stroke="#c8ff3d" strokeWidth="2" />
          <circle className="fx-slide" cx="26" cy="35" r="2.2" fill="#c8ff3d" />
          <circle className="fx-slide" cx="42" cy="35" r="2.2" fill="#c8ff3d" />
          <path d="M27 47h10" stroke="#f2efe6" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      );
    case "cat_music":
      return (
        <g className="fx">
          <path d="M15 34v-4a17 17 0 0 1 34 0v4" fill="none" stroke="#c8ff3d" strokeWidth="2.4" strokeLinecap="round" />
          <rect x="12" y="32" width="7" height="10" rx="3" fill="#c8ff3d" />
          <rect x="45" y="32" width="7" height="10" rx="3" fill="#c8ff3d" />
          <circle cx="24" cy="38" r="2.4" fill="#f2efe6" />
          <circle cx="40" cy="38" r="2.4" fill="#f2efe6" />
          <path d="M28 47q4 3 8 0" stroke="#f2efe6" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      );
    case "cat_hype":
      return (
        <g className="fx">
          <circle cx="24" cy="36" r="3" fill="#c8ff3d" />
          <circle cx="40" cy="36" r="3" fill="#c8ff3d" />
          <path className="fx-flick" d="M32 42c3-2 5-5 3-9-2 2-3 3-3 5-1-1-1-2-1-3-2 2-3 5 1 7z" fill="#f97316" />
          <path d="M27 48q5 3 10 0" stroke="#f2efe6" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      );
    case "cat_gg":
      return (
        <g className="fx">
          <path className="fx-crown" d="M22 22l3 5 3-6 4 6 3-5 3 5-8 4z" fill="#c8ff3d" stroke="#c8ff3d" strokeWidth="1.4" strokeLinejoin="round" />
          <circle cx="24" cy="37" r="2.6" fill="#f2efe6" />
          <circle cx="40" cy="37" r="2.6" fill="#f2efe6" />
          <path d="M28 46q4 4 8 0" stroke="#f2efe6" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      );
    case "cat_sad":
      return (
        <g className="fx">
          <circle cx="24" cy="36" r="3" fill="none" stroke="#c8ff3d" strokeWidth="2" />
          <circle cx="40" cy="36" r="3" fill="none" stroke="#c8ff3d" strokeWidth="2" />
          <path className="fx-tear" d="M20 41c-1.5 2.5-1.5 5 0 6.5 1.5-1.5 1.5-4 0-6.5z" fill="#7dd3fc" />
          <path d="M27 48q5-2 10 0" stroke="#f2efe6" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      );
    case "cat_wave":
      return (
        <g className="fx">
          <circle cx="24" cy="36" r="2.6" fill="#c8ff3d" />
          <circle cx="40" cy="36" r="2.6" fill="#c8ff3d" />
          <path d="M28 46q4 3 8 0" stroke="#f2efe6" strokeWidth="1.8" strokeLinecap="round" />
          <g className="fx-paw">
            <ellipse cx="50" cy="18" rx="5" ry="6.5" fill="#0b0b0c" stroke="#c8ff3d" strokeWidth="2" />
            <line x1="48" y1="14" x2="48" y2="18" stroke="#c8ff3d" strokeWidth="1.4" strokeLinecap="round" />
            <line x1="50.5" y1="13.5" x2="50.5" y2="17.5" stroke="#c8ff3d" strokeWidth="1.4" strokeLinecap="round" />
          </g>
        </g>
      );
    case "cat_think":
    default:
      return (
        <g className="fx">
          <circle cx="24" cy="37" r="2.6" fill="#c8ff3d" />
          <circle cx="40" cy="37" r="2.6" fill="#c8ff3d" />
          <circle className="fx-dot1" cx="28" cy="16" r="2.2" fill="#c8ff3d" />
          <circle className="fx-dot2" cx="34" cy="11" r="2.6" fill="#c8ff3d" />
          <circle className="fx-dot3" cx="41" cy="15" r="2" fill="#c8ff3d" />
          <path d="M28 47q4 2 8 0" stroke="#f2efe6" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      );
  }
}
