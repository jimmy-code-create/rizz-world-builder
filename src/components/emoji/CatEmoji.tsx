import { useEffect, useRef, useState } from "react";
import type { CatEmojiName } from "./cat-emoji-manifest";

/**
 * <CatEmoji name size animate />
 * Inline SVG cat head, viewBox 0 0 64 64. CSS keyframes only, static frame
 * under prefers-reduced-motion.
 *
 * animate:
 * - false / "static": no animation
 * - "hover": animates only on hover/press/focus (picker grids)
 * - "once": plays once 600ms (reaction just added)
 * - "loop": continuous loop (budgeted: max 3 running at a time, paused
 *   offscreen — and only that mode pays for an observer)
 *
 * Drawing rules, so twelve faces read as one set at 20px:
 *   1. One silhouette — the ear pair and the head circle — with a single
 *      lift colour for the top-left rim. No outline soup.
 *   2. Big features only: the eyes are 9px tall on the 64 grid, the mouth is
 *      one stroke, and nothing decorative sits on top of the face.
 *   3. Expression lives in the eyes and the mouth. Every other mark (blush,
 *      whiskers, accessory) is decoration that can be dropped without losing
 *      which cat this is.
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

const FUR = "#17171b";
const RIM = "#33333a";
const INK = "#08080a";
const LIME = "#c8ff3d";
const CREAM = "#f6f3ea";

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

  // Only a running loop is worth watching for visibility: a hover or one-shot
  // animation is paused or finished anyway, and a picker of twelve faces used
  // to cost twelve observers for nothing.
  useEffect(() => {
    const el = ref.current;
    if (!el || mode !== "loop") return;
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
        {/* ears — outer pair, then the lime inner cup */}
        <path d="M16 27C13 21 9.5 12 8.5 6.5c4.6 1.6 13.4 6.2 19 10.6Z" fill={FUR} stroke={RIM} strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M48 27c3-6 6.5-15 7.5-20.5-4.6 1.6-13.4 6.2-19 10.6Z" fill={FUR} stroke={RIM} strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M13.8 22c-2-4.4-4-9.6-4.6-13.2 3.4 1.4 9 4.6 12.8 7.7Z" fill={LIME} fillOpacity=".2" />
        <path d="M50.2 22c2-4.4 4-9.6 4.6-13.2-3.4 1.4-9 4.6-12.8 7.7Z" fill={LIME} fillOpacity=".2" />
        {/* head, with one rim light from the top left */}
        <circle cx="32" cy="37" r="21.5" fill={FUR} stroke={RIM} strokeWidth="1.6" />
        <path d="M13.6 33.4a18.6 18.6 0 0 1 36.8 0" stroke="#3a3a42" strokeWidth="1.4" strokeLinecap="round" />
        {/* blush */}
        <ellipse className="fx-blush" cx="19.5" cy="42" rx="4.2" ry="2.6" fill={LIME} fillOpacity=".18" />
        <ellipse className="fx-blush" cx="44.5" cy="42" rx="4.2" ry="2.6" fill={LIME} fillOpacity=".18" />
        {/* whiskers */}
        <g stroke={LIME} strokeOpacity=".5" strokeWidth="1.2" strokeLinecap="round">
          <line x1="4.5" y1="37" x2="13" y2="38.5" />
          <line x1="4.5" y1="42.5" x2="13" y2="42" />
          <line x1="59.5" y1="37" x2="51" y2="38.5" />
          <line x1="59.5" y1="42.5" x2="51" y2="42" />
        </g>
        <EmojiFace name={name} />
      </svg>
    </span>
  );
}

/** A pair of open eyes with pupils and a catchlight — the default cat look. */
function Eyes({ squint = false }: { squint?: boolean }) {
  return (
    <g className="fx">
      <ellipse cx="24" cy="35.5" rx="4.4" ry="5.6" fill={LIME} />
      <ellipse cx="40" cy="35.5" rx="4.4" ry="5.6" fill={LIME} />
      {squint ? (
        <>
          <path d="M20.4 33.4h7.2" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M36.4 33.4h7.2" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="24" cy="36.4" rx="2.1" ry="2.8" fill={INK} />
          <ellipse cx="40" cy="36.4" rx="2.1" ry="2.8" fill={INK} />
          <circle cx="22.8" cy="33.8" r="1.15" fill="#fff" />
          <circle cx="38.8" cy="33.8" r="1.15" fill="#fff" />
        </>
      )}
    </g>
  );
}

/** The little lime nose every face shares. */
function Nose() {
  return <path d="M29.6 42.2h4.8L32 45.2Z" fill={LIME} fillOpacity=".9" />;
}

function EmojiFace({ name }: { name: CatEmojiName }) {
  switch (name) {
    case "cat_love":
      return (
        <g className="fx">
          <path d="M24 30.4c-2.6-3.1.1-7 3-5.3 1.1-.9 2.6.2 2.6.2s1.5-1.1 2.6-.2c2.9 1.7-.4 5.6-3 5.3" fill={LIME} transform="translate(-7 2)" />
          <path d="M31 32.4c-2.6-3.1.1-7 3-5.3 1.1-.9 2.6.2 2.6.2s1.5-1.1 2.6-.2c2.9 1.7-.4 5.6-3 5.3" fill={LIME} />
          <path className="fx-heart" d="M32 18.5c-1.9-2.4.1-4.8 2.1-3.8 1-.7 2.4.4 2.4.4s1.4-1.1 2.4-.4c2 1-.1 3.9-2.1 3.8" fill={LIME} />
          <Nose />
          <path d="M27.6 47.2q4.4 4 8.8 0" stroke={CREAM} strokeWidth="1.8" strokeLinecap="round" />
        </g>
      );
    case "cat_cool":
      return (
        <g className="fx">
          <rect x="13" y="29.5" width="16" height="11" rx="3.6" fill={INK} stroke={LIME} strokeWidth="1.8" />
          <rect x="35" y="29.5" width="16" height="11" rx="3.6" fill={INK} stroke={LIME} strokeWidth="1.8" />
          <path d="M29 32.6h6" stroke={LIME} strokeWidth="1.8" strokeLinecap="round" />
          <line className="fx-glint" x1="17" y1="31" x2="23.5" y2="39" stroke={CREAM} strokeWidth="2" strokeLinecap="round" opacity=".85" />
          <Nose />
          <path d="M27.8 47q4.2 3.4 8.4 0" stroke={CREAM} strokeWidth="1.8" strokeLinecap="round" />
        </g>
      );
    case "cat_sleep":
      return (
        <g className="fx">
          <path d="M19 35.5q5 5 10 0" stroke={LIME} strokeWidth="2.4" strokeLinecap="round" />
          <path d="M35 35.5q5 5 10 0" stroke={LIME} strokeWidth="2.4" strokeLinecap="round" />
          <Nose />
          <path d="M28.4 47.4q3.6 2.4 7.2 0" stroke={CREAM} strokeWidth="1.6" strokeLinecap="round" />
          {/* Drawn, not typeset: a text glyph picks up whatever font the phone
              has, and these have to look the same everywhere. */}
          <path className="fx-z" d="M45 17h7l-7 6h7" fill="none" stroke={LIME} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <path className="fx-z2" d="M51 9.5h5l-5 4h5" fill="none" stroke={LIME} strokeOpacity=".7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );
    case "cat_lol":
      return (
        <g className="fx">
          <path d="M19.5 32.5l8 7M27.5 32.5l-8 7" stroke={LIME} strokeWidth="2.4" strokeLinecap="round" />
          <path d="M36.5 32.5l8 7M44.5 32.5l-8 7" stroke={LIME} strokeWidth="2.4" strokeLinecap="round" />
          <ellipse cx="32" cy="47" rx="8.4" ry="7" fill={INK} stroke={LIME} strokeWidth="1.6" />
          <path d="M27 50.6q5 3.6 10 0" fill={CREAM} fillOpacity=".95" />
        </g>
      );
    case "cat_wow":
      return (
        <g className="fx">
          <circle cx="24" cy="35" r="7" fill={CREAM} />
          <circle cx="40" cy="35" r="7" fill={CREAM} />
          <circle className="fx-pupil" cx="24" cy="36.4" r="2.9" fill={INK} />
          <circle className="fx-pupil" cx="40" cy="36.4" r="2.9" fill={INK} />
          <circle cx="22" cy="32.6" r="1.3" fill="#fff" />
          <circle cx="38" cy="32.6" r="1.3" fill="#fff" />
          <ellipse cx="32" cy="48" rx="3.6" ry="4.4" fill={INK} stroke={CREAM} strokeWidth="1.6" />
        </g>
      );
    case "cat_sus":
      return (
        <g className="fx">
          <path d="M19 31.5h10v5.2H19z" fill={LIME} />
          <path d="M35 31.5h10v5.2H35z" fill={LIME} />
          <circle className="fx-slide" cx="26" cy="34.6" r="2.3" fill={INK} />
          <circle className="fx-slide" cx="42" cy="34.6" r="2.3" fill={INK} />
          <path d="M19.5 27.3q4.5-2.2 9 0" stroke={RIM} strokeWidth="1.8" strokeLinecap="round" />
          <Nose />
          <path d="M27.6 47.6h8.8" stroke={CREAM} strokeWidth="1.8" strokeLinecap="round" />
        </g>
      );
    case "cat_music":
      return (
        <g className="fx">
          <path d="M13.5 36.5v-2.8a18.5 18.5 0 0 1 37 0v2.8" fill="none" stroke={LIME} strokeWidth="2.6" strokeLinecap="round" />
          <rect x="9.5" y="33" width="8" height="12.5" rx="3.6" fill={LIME} />
          <rect x="46.5" y="33" width="8" height="12.5" rx="3.6" fill={LIME} />
          <path d="M19.5 35.5q4.5 4.5 9 0" stroke={INK} strokeWidth="2" strokeLinecap="round" />
          <path d="M35.5 35.5q4.5 4.5 9 0" stroke={INK} strokeWidth="2" strokeLinecap="round" />
          <Nose />
          <path d="M27.8 47.2q4.2 3.2 8.4 0" stroke={CREAM} strokeWidth="1.8" strokeLinecap="round" />
        </g>
      );
    case "cat_hype":
      return (
        <g className="fx">
          <path className="fx-flick" d="M32 16.5c4.6 3.4 7.6 8.2 4 14.6-2.6-3.4-4.2-5.4-4.2-8.6-1.6 1.8-1.6 3.8-1.6 5.4-3.4-4.4-2.6-8.4 1.8-11.4z" fill="#ff7a2f" />
          <circle cx="24" cy="36" r="3.4" fill={LIME} />
          <circle cx="40" cy="36" r="3.4" fill={LIME} />
          <path d="M22.6 32.8h3.2M38.6 32.8h3.2" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
          <Nose />
          <path d="M26.4 46.4q5.6 5 11.2 0" stroke={CREAM} strokeWidth="2" strokeLinecap="round" fill="none" />
        </g>
      );
    case "cat_gg":
      return (
        <g className="fx">
          <path className="fx-crown" d="M21.5 21.5l3.2 5.6 3.4-6.6 4 6.6 3.4-5.6 3.2 5.6-8.6 4.6z" fill={LIME} stroke={LIME} strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M24 30.4c.7 3.9 1.8 5 5.7 5.7-3.9.7-5 1.8-5.7 5.7-.7-3.9-1.8-5-5.7-5.7 3.9-.7 5-1.8 5.7-5.7z" fill={LIME} />
          <path d="M40 30.4c.7 3.9 1.8 5 5.7 5.7-3.9.7-5 1.8-5.7 5.7-.7-3.9-1.8-5-5.7-5.7 3.9-.7 5-1.8 5.7-5.7z" fill={LIME} />
          <Nose />
          <path d="M27.8 47q4.2 3.6 8.4 0" stroke={CREAM} strokeWidth="1.8" strokeLinecap="round" />
        </g>
      );
    case "cat_sad":
      return (
        <g className="fx">
          <circle cx="24" cy="35.5" r="5.4" fill={LIME} />
          <circle cx="40" cy="35.5" r="5.4" fill={LIME} />
          <circle cx="24" cy="36.6" r="2.4" fill={INK} />
          <circle cx="40" cy="36.6" r="2.4" fill={INK} />
          <circle cx="22.8" cy="33.6" r="1.2" fill="#fff" />
          <circle cx="38.8" cy="33.6" r="1.2" fill="#fff" />
          <path className="fx-tear" d="M20 41.6c-1.7 2.8-1.7 5.6 0 7.3 1.7-1.7 1.7-4.5 0-7.3z" fill="#7dd3fc" />
          <Nose />
          <path d="M27.4 48.6q4.6-3 9.2 0" stroke={CREAM} strokeWidth="1.8" strokeLinecap="round" fill="none" />
        </g>
      );
    case "cat_wave":
      return (
        <g className="fx">
          <Eyes />
          <Nose />
          <path d="M27.8 46.8q4.2 3.4 8.4 0" stroke={CREAM} strokeWidth="1.8" strokeLinecap="round" />
          <g className="fx-paw">
            <ellipse cx="51" cy="17" rx="5.6" ry="7" fill={FUR} stroke={LIME} strokeWidth="1.8" />
            <path d="M48.4 12.4v3.4M51 11.6v3.6M53.6 12.6v3.2" stroke={LIME} strokeWidth="1.3" strokeLinecap="round" />
          </g>
        </g>
      );
    case "cat_think":
    default:
      return (
        <g className="fx">
          <Eyes squint />
          <Nose />
          <path d="M28.2 47.4q3.8 2.2 7.6 0" stroke={CREAM} strokeWidth="1.6" strokeLinecap="round" />
          <circle className="fx-dot1" cx="27.5" cy="16.5" r="2.4" fill={LIME} />
          <circle className="fx-dot2" cx="33.5" cy="11" r="2.9" fill={LIME} />
          <circle className="fx-dot3" cx="40.5" cy="15.5" r="2.1" fill={LIME} />
        </g>
      );
  }
}
