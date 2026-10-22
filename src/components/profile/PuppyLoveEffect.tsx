import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import "./puppy-love.css";

/**
 * Puppy Love — the RIZZ profile effect.
 *
 * An original character, not a licensed mascot: **Biscuit**, a floppy-eared
 * pup in a lime RIZZ hoodie and heart-shaped shades, leaning into the banner
 * with one paw up. Everything is transparent inline SVG — no stage, no card,
 * no raster asset — so the profile's own banner shows through the scene.
 *
 * Rules the effect keeps:
 *   - decoration only: `pointer-events: none` and `aria-hidden`, so profile
 *     controls underneath stay usable;
 *   - quiet loop: a head bob, one ear flop, a tail wag, rising hearts and a
 *     slow shade glint. Nothing flashes or shakes;
 *   - motion is optional: `prefers-reduced-motion` (or a very small device)
 *     renders the same scene as a still, and animation pauses off screen.
 */

type Props = {
  className?: string;
};

/** Measure before paint in the browser, without an SSR layout-effect warning. */
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Heart outline, used for the shades, the nose and the floating hearts. */
function heartPath(cx: number, cy: number, scale = 1) {
  const s = scale;
  return (
    `M ${cx} ${cy + 12 * s} ` +
    `C ${cx - 10 * s} ${cy + 2 * s} ${cx - 20 * s} ${cy - 6 * s} ${cx - 20 * s} ${cy - 14 * s} ` +
    `C ${cx - 20 * s} ${cy - 24 * s} ${cx - 8 * s} ${cy - 27 * s} ${cx} ${cy - 16 * s} ` +
    `C ${cx + 8 * s} ${cy - 27 * s} ${cx + 20 * s} ${cy - 24 * s} ${cx + 20 * s} ${cy - 14 * s} ` +
    `C ${cx + 20 * s} ${cy - 6 * s} ${cx + 10 * s} ${cy + 2 * s} ${cx} ${cy + 12 * s} Z`
  );
}

const HEARTS = [
  { x: 362, y: 268, scale: 0.85, color: "#c9ff3d", delay: 0, duration: 9.5, drift: -14 },
  { x: 442, y: 316, scale: 0.5, color: "#f4f1e7", delay: 2.4, duration: 11, drift: 10 },
  { x: 300, y: 176, scale: 0.62, color: "#ff9aa8", delay: 4.1, duration: 10.5, drift: -8 },
  { x: 988, y: 250, scale: 0.95, color: "#c9ff3d", delay: 1.2, duration: 9, drift: 12 },
  { x: 1054, y: 160, scale: 0.55, color: "#f4f1e7", delay: 3.6, duration: 12, drift: -10 },
  { x: 924, y: 338, scale: 0.42, color: "#ff9aa8", delay: 5.4, duration: 10, drift: 8 },
  { x: 214, y: 320, scale: 0.44, color: "#c9ff3d", delay: 0.8, duration: 11.5, drift: 6 },
];

/*
 * Three compositions, chosen by the banner's real aspect ratio. The card keeps
 * the full pup inside the cover crop (the right ear used to be sliced off a
 * 400×176 banner); short previews step down again; wide desktop banners get a
 * smaller, top-anchored bust. All of them leave the bottom-left clear for the
 * avatar and status dot.
 */
type Composition = "wide" | "card" | "compact";
// Anchoring the card crop to the banner's bottom edge plants Biscuit's paws on
// the frame instead of leaving him floating mid-banner on the short preview
// card. Wide desktop banners keep the top-anchored bust.
const DOG_TALL = "translate(720 360) scale(0.82) translate(-720 -360) translate(-80 0)";
const DOG_WIDE = "translate(720 0) scale(0.68) translate(-720 0) translate(-40 0)";
const DOG_COMPACT = "translate(720 360) scale(0.7) translate(-720 -360) translate(-70 0)";
const DOG_BY_COMPOSITION: Record<Composition, string> = {
  wide: DOG_WIDE,
  card: DOG_TALL,
  compact: DOG_COMPACT,
};

const SPARKS = [
  { x: 236, y: 118, scale: 1.15, delay: 0.3 },
  { x: 522, y: 92, scale: 0.8, delay: 2.1 },
  { x: 916, y: 96, scale: 1, delay: 1.2 },
  { x: 1040, y: 322, scale: 0.75, delay: 3.4 },
  { x: 604, y: 328, scale: 0.55, delay: 4.6 },
];

/** Reduced motion, or a device we would rather not animate. */
function prefersStillFrame() {
  if (typeof window === "undefined") return false;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  if (reduce) return true;
  const cores = navigator.hardwareConcurrency ?? 8;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  return cores <= 2 || memory <= 2;
}

export function PuppyLoveEffect({ className }: Props) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const [calm, setCalm] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const [composition, setComposition] = useState<Composition>("card");
  // Every instance owns its gradient/filter ids. Shared static ids made a second
  // Puppy Love on the page (feed card + profile preview) point at the first
  // SVG's paint servers, which is why the look could flatten or grey out.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const fx = (name: string) => `plx-${name}-${uid}`;

  useEffect(() => {
    setCalm(prefersStillFrame());
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setCalm(prefersStillFrame());
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    const node = hostRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      { rootMargin: "80px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // A 400×176 card and a wide desktop banner need different crops. Measuring
  // before paint avoids a one-frame flash between the compositions. The server
  // has no layout, so it falls back to useEffect.
  useIsomorphicLayoutEffect(() => {
    const node = hostRef.current;
    if (!node) return;
    const measure = () => {
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const ratio = rect.width / rect.height;
      setComposition(ratio > 3.2 ? "wide" : ratio < 2.08 ? "compact" : "card");
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <span
      ref={hostRef}
      aria-hidden="true"
      data-calm={calm ? "true" : undefined}
      data-visible={onScreen ? "true" : "false"}
      className={cn("plx", className)}
    >
      <svg
        className="plx-svg"
        viewBox="0 0 1100 360"
        preserveAspectRatio="xMidYMin slice"
        role="presentation"
        focusable="false"
      >
        <defs>
          <linearGradient id={fx("fur")} x1="0.25" y1="0" x2="0.7" y2="1">
            <stop offset="0" stopColor="#fff8ea" />
            <stop offset="0.45" stopColor="#f6e2c0" />
            <stop offset="1" stopColor="#d9b183" />
          </linearGradient>
          <linearGradient id={fx("fur-shade")} x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0" stopColor="#f2d6ab" />
            <stop offset="1" stopColor="#c99a68" />
          </linearGradient>
          <linearGradient id={fx("ear")} x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0" stopColor="#d3a374" />
            <stop offset="0.6" stopColor="#b07d4d" />
            <stop offset="1" stopColor="#8d5f36" />
          </linearGradient>
          <linearGradient id={fx("hood")} x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0" stopColor="#edffab" />
            <stop offset="0.42" stopColor="#c9ff3d" />
            <stop offset="1" stopColor="#83b600" />
          </linearGradient>
          <linearGradient id={fx("shade")} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#e8ffa0" />
            <stop offset="0.55" stopColor="#b6ef2a" />
            <stop offset="1" stopColor="#6fa800" />
          </linearGradient>
          <linearGradient id={fx("muzzle")} x1="0.3" y1="0" x2="0.7" y2="1">
            <stop offset="0" stopColor="#fffcf3" />
            <stop offset="0.7" stopColor="#f3e7d2" />
            <stop offset="1" stopColor="#dfccb0" />
          </linearGradient>
          <radialGradient id={fx("glow")} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#c9ff3d" stopOpacity="0.34" />
            <stop offset="0.55" stopColor="#c9ff3d" stopOpacity="0.12" />
            <stop offset="1" stopColor="#c9ff3d" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={fx("shade-glint")} cx="0.32" cy="0.26" r="0.7">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="0.42" stopColor="#ffffff" stopOpacity="0.16" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <filter id={fx("soft")} x="-30%" y="-30%" width="160%" height="170%">
            <feDropShadow dx="0" dy="8" stdDeviation="9" floodColor="#2c1a08" floodOpacity="0.35" />
          </filter>
          <filter id={fx("blur")} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="16" />
          </filter>
          <linearGradient id={fx("cuff")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#efffc4" />
            <stop offset="0.5" stopColor="#b6ef2a" />
            <stop offset="1" stopColor="#6d9e00" />
          </linearGradient>
          <radialGradient id={fx("ground")} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#050603" stopOpacity="0.55" />
            <stop offset="0.62" stopColor="#050603" stopOpacity="0.2" />
            <stop offset="1" stopColor="#050603" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Lime afterglow behind the pup; it fades to zero, so the banner shows through. */}
        <ellipse cx="748" cy="242" rx="420" ry="230" fill={`url(#${fx("glow")})`} />

        {/* Soft bokeh and a grounded shadow give the character depth. */}
        <g className="plx-bokeh" fill="#c9ff3d">
          {[
            [248, 116, 13, 0.1],
            [318, 238, 8, 0.14],
            [204, 296, 5, 0.2],
            [994, 116, 11, 0.12],
            [1052, 286, 7, 0.16],
            [884, 66, 4.5, 0.22],
          ].map(([cx, cy, r, opacity], index) => (
            <circle
              key={`bokeh-${cx}-${cy}`}
              cx={cx}
              cy={cy}
              r={r}
              opacity={opacity}
              style={{ animationDelay: `${index * 1.3}s` }}
            />
          ))}
        </g>
        <g transform={DOG_BY_COMPOSITION[composition]}>
        <ellipse cx="750" cy="354" rx="292" ry="26" fill={`url(#${fx("ground")})`} filter={`url(#${fx("blur")})`} />
        {/* ---- tail, behind the body ---- */}
        <g className="plx-tail" filter={`url(#${fx("soft")})`}>
          <path
            d="M 938 318 C 998 326 1042 300 1032 268 C 1024 244 1044 226 1064 224"
            fill="none"
            stroke="#8d5f36"
            strokeWidth="38"
            strokeLinecap="round"
          />
          <path
            d="M 938 318 C 998 326 1042 300 1032 268 C 1024 244 1044 226 1064 224"
            fill="none"
            stroke={`url(#${fx("fur-shade")})`}
            strokeWidth="30"
            strokeLinecap="round"
          />
          <path
            d="M 1042 230 C 1050 225 1057 223 1064 224"
            fill="none"
            stroke="#fff8ea"
            strokeWidth="12"
            strokeLinecap="round"
            opacity="0.9"
          />
        </g>

        {/* ---- hoodie shoulders and chest ---- */}
        <g filter={`url(#${fx("soft")})`}>
          <path
            d="M 488 360 C 500 318 552 288 618 276 L 862 276 C 928 288 980 318 992 360 Z"
            fill={`url(#${fx("hood")})`}
            stroke="#4d6b00"
            strokeWidth="4"
          />
          <path
            d="M 618 279 C 664 306 816 306 862 279"
            fill="none"
            stroke="#5d7f00"
            strokeWidth="3"
            opacity="0.55"
          />
          {/* Centre zipper, kangaroo pocket and drawstrings. */}
          <path
            d="M 740 300 L 740 360"
            stroke="#5d7f00"
            strokeWidth="3.2"
            strokeLinecap="round"
            opacity="0.72"
          />
          <path
            d="M 740 300 L 740 360"
            stroke="#efffc4"
            strokeWidth="1.1"
            strokeLinecap="round"
            opacity="0.8"
            strokeDasharray="1.5 4"
          />
          <path
            d="M 710 360 C 712 338 726 326 740 326 C 754 326 768 338 770 360"
            fill="#b5ee28"
            stroke="#5d7f00"
            strokeWidth="2.6"
            opacity="0.95"
          />
          <path
            d="M 716 360 C 718 344 728 334 740 334 C 752 334 762 344 764 360"
            fill="none"
            stroke="#85b700"
            strokeWidth="1.6"
            opacity="0.55"
          />
          <path
            d="M 700 300 L 694 360 M 786 300 L 792 360"
            stroke="#efffc4"
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.75"
          />
          <circle cx="694" cy="360" r="6" fill="#d9ff70" />
          <circle cx="792" cy="360" r="6" fill="#d9ff70" />

          {/* Drawstrings hanging from the hood, with little aglets. */}
          <g className="plx-strings" strokeLinecap="round" fill="none">
            <path d="M 676 282 C 668 304 664 328 666 348" stroke="#f6ffd8" strokeWidth="5.5" />
            <path d="M 806 282 C 814 304 818 324 816 342" stroke="#f6ffd8" strokeWidth="5.5" />
            <path d="M 664 348 L 668 360" stroke="#9adb00" strokeWidth="7" />
            <path d="M 814 342 L 818 354" stroke="#9adb00" strokeWidth="7" />
          </g>

          {/* Stitched seams catch the light without outlining the whole hoodie. */}
          <g
            fill="none"
            stroke="#efffc4"
            strokeWidth="1.2"
            strokeDasharray="2 5"
            strokeLinecap="round"
            opacity="0.55"
          >
            <path d="M 500 350 C 520 324 552 304 590 292" />
            <path d="M 980 350 C 960 324 928 304 890 292" />
            <path d="M 710 360 C 712 338 726 326 740 326 C 754 326 768 338 770 360" />
          </g>
          {/* Paw crest on the chest — the RIZZ mark, no text to rasterize. */}
          <g transform="translate(740 330)" opacity="0.9">
            <ellipse cx="0" cy="6" rx="13" ry="11" fill="#5d7f00" />
            <ellipse cx="-13" cy="-8" rx="5.5" ry="7" fill="#5d7f00" />
            <ellipse cx="-4.5" cy="-14" rx="5.5" ry="7" fill="#5d7f00" />
            <ellipse cx="4.5" cy="-14" rx="5.5" ry="7" fill="#5d7f00" />
            <ellipse cx="13" cy="-8" rx="5.5" ry="7" fill="#5d7f00" />
          </g>
        </g>

        {/* ---- hood, then ears, then head ---- */}
        <path
          d="M 740 28 C 616 28 546 106 550 198 C 552 264 592 318 654 342 L 826 342 C 888 318 928 264 930 198 C 934 106 864 28 740 28 Z"
          fill={`url(#${fx("hood")})`}
          stroke="#4d6b00"
          strokeWidth="5"
          filter={`url(#${fx("soft")})`}
        />
        <path
          d="M 740 52 C 634 52 578 120 582 200 C 584 258 618 304 672 326 L 808 326 C 862 304 896 258 898 200 C 902 120 846 52 740 52 Z"
          fill="#0e1008"
          opacity="0.35"
        />

        <g className="plx-ear plx-ear--left">
          <path
            d="M 612 108 C 548 98 506 142 508 206 C 510 262 542 300 584 314 C 604 284 598 222 622 176 Z"
            fill={`url(#${fx("ear")})`}
            stroke="#5f3d1c"
            strokeWidth="4"
          />
          <path
            d="M 600 138 C 562 138 538 170 540 212 C 542 250 560 278 586 290 C 598 264 592 216 610 184 Z"
            fill="#8d5f36"
            opacity="0.55"
          />
          <path
            d="M 596 126 C 568 130 550 154 548 184"
            fill="none"
            stroke="#f3d8b4"
            strokeWidth="5"
            strokeLinecap="round"
            opacity="0.35"
          />
          {/* Fur strands and a soft inner fluff. */}
          <g fill="none" stroke="#e7c69c" strokeWidth="1.6" strokeLinecap="round" opacity="0.45">
            <path d="M 542 194 C 552 188 558 180 560 170" />
            <path d="M 548 222 C 560 218 570 210 576 200" />
            <path d="M 558 250 C 570 244 578 234 582 222" />
            <path d="M 536 210 C 548 214 556 222 560 232" />
          </g>
        </g>
        <g className="plx-ear plx-ear--right">
          <path
            d="M 868 108 C 932 98 974 142 972 206 C 970 262 938 300 896 314 C 876 284 882 222 858 176 Z"
            fill={`url(#${fx("ear")})`}
            stroke="#5f3d1c"
            strokeWidth="4"
          />
          <path
            d="M 880 138 C 918 138 942 170 940 212 C 938 250 920 278 894 290 C 882 264 888 216 870 184 Z"
            fill="#8d5f36"
            opacity="0.55"
          />
          <path
            d="M 884 126 C 912 130 930 154 932 184"
            fill="none"
            stroke="#f3d8b4"
            strokeWidth="5"
            strokeLinecap="round"
            opacity="0.35"
          />
          <g fill="none" stroke="#e7c69c" strokeWidth="1.6" strokeLinecap="round" opacity="0.45">
            <path d="M 938 194 C 928 188 922 180 920 170" />
            <path d="M 932 222 C 920 218 910 210 904 200" />
            <path d="M 922 250 C 910 244 902 234 898 222" />
            <path d="M 944 210 C 932 214 924 222 920 232" />
          </g>
        </g>

        <g className="plx-head" filter={`url(#${fx("soft")})`}>
          <path
            d="M 740 60 C 650 60 592 114 592 192 C 592 250 632 290 690 306 C 710 311 770 311 790 306 C 848 290 888 250 888 192 C 888 114 830 60 740 60 Z"
            fill={`url(#${fx("fur")})`}
            stroke="#a9794a"
            strokeWidth="4"
          />
          {/* Face shading + a warm rim from the lime hood. */}
          <path
            d="M 740 62 C 690 62 646 90 622 132 C 648 116 690 106 740 106 C 790 106 832 116 858 132 C 834 90 790 62 740 62 Z"
            fill="#fffdf7"
            opacity="0.5"
          />
          <path
            d="M 596 208 C 600 258 636 292 692 306 C 660 280 636 240 628 196 Z"
            fill="#a9794a"
            opacity="0.16"
          />
          <path
            d="M 884 208 C 880 258 844 292 788 306 C 820 280 844 240 852 196 Z"
            fill="#a9794a"
            opacity="0.12"
          />

          {/* Forehead fur tufts and cheek fluff. */}
          <g fill="none" stroke="#b98d5f" strokeWidth="2.2" strokeLinecap="round" opacity="0.5">
            <path d="M 716 92 C 720 82 726 76 734 72" />
            <path d="M 740 88 C 744 78 750 73 758 70" />
            <path d="M 764 94 C 770 84 776 80 784 78" />
          </g>
          <g fill="none" stroke="#fffaf0" strokeWidth="2" strokeLinecap="round" opacity="0.55">
            <path d="M 606 214 C 598 226 596 240 600 252" />
            <path d="M 618 236 C 610 246 608 258 612 268" />
            <path d="M 874 214 C 882 226 884 240 880 252" />
            <path d="M 862 236 C 870 246 872 258 868 268" />
          </g>

          {/* muzzle */}
          <ellipse cx="740" cy="244" rx="80" ry="52" fill={`url(#${fx("muzzle")})`} />
          <ellipse cx="740" cy="258" rx="56" ry="30" fill="#e3cfae" opacity="0.35" />

          {/* freckles */}
          <g fill="#b98d5f" opacity="0.55">
            <circle cx="658" cy="252" r="2.4" />
            <circle cx="648" cy="264" r="2" />
            <circle cx="666" cy="266" r="2" />
            <circle cx="822" cy="252" r="2.4" />
            <circle cx="832" cy="264" r="2" />
            <circle cx="814" cy="266" r="2" />
          </g>

          {/* blush */}
          <ellipse cx="648" cy="228" rx="24" ry="12" fill="#ff9aa8" opacity="0.28" />
          <ellipse cx="832" cy="228" rx="24" ry="12" fill="#ff9aa8" opacity="0.28" />

          {/* nose */}
          <path d={heartPath(740, 216, 0.92)} fill="#2b1a14" />
          <ellipse cx="732" cy="204" rx="6" ry="4" fill="#fff" opacity="0.5" />

          {/* smile + tongue */}
          <path
            d="M 716 248 Q 740 272 764 248"
            fill="none"
            stroke="#5a3b2e"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          <path d="M 740 250 L 740 262" stroke="#5a3b2e" strokeWidth="3.5" strokeLinecap="round" />
          <g className="plx-tongue">
            <path
              d="M 724 264 C 724 282 756 282 756 264 C 756 256 748 252 740 252 C 732 252 724 256 724 264 Z"
              fill="#ff8f9c"
              stroke="#d9636f"
              strokeWidth="2"
            />
            <path d="M 740 256 V 272" stroke="#e8737f" strokeWidth="2" strokeLinecap="round" />
          </g>

          {/* heart-shaped shades */}
          <g className="plx-shades">
            <path d="M 640 206 L 600 190" stroke="#15130c" strokeWidth="7" strokeLinecap="round" />
            <path d="M 840 206 L 880 190" stroke="#15130c" strokeWidth="7" strokeLinecap="round" />
            <path d={heartPath(676, 184, 2.15)} fill={`url(#${fx("shade")})`} stroke="#15130c" strokeWidth="9" />
            <path d={heartPath(804, 184, 2.15)} fill={`url(#${fx("shade")})`} stroke="#15130c" strokeWidth="9" />
            <path d="M 718 176 Q 740 168 762 176" fill="none" stroke="#15130c" strokeWidth="8" strokeLinecap="round" />
            <path d={heartPath(676, 184, 1.45)} fill={`url(#${fx("shade-glint")})`} opacity="0.85" />
            <path d={heartPath(804, 184, 1.45)} fill={`url(#${fx("shade-glint")})`} opacity="0.85" />
            <path
              d="M 656 170 C 664 162 676 162 682 170"
              fill="none"
              stroke="#ffffff"
              strokeWidth="4"
              strokeLinecap="round"
              opacity="0.75"
            />
            <path
              d="M 784 170 C 792 162 804 162 810 170"
              fill="none"
              stroke="#ffffff"
              strokeWidth="4"
              strokeLinecap="round"
              opacity="0.75"
            />
          </g>

          {/* brows above the shades */}
          <path
            d="M 636 140 C 652 132 674 132 690 140"
            fill="none"
            stroke="#a9794a"
            strokeWidth="6"
            strokeLinecap="round"
            opacity="0.65"
          />
          <path
            d="M 790 140 C 806 132 828 132 844 140"
            fill="none"
            stroke="#a9794a"
            strokeWidth="6"
            strokeLinecap="round"
            opacity="0.65"
          />
        </g>

        {/* ---- waving paw + resting paw ---- */}
        <g className="plx-paw">
          <path
            d="M 556 318 C 526 322 506 340 502 360"
            fill="none"
            stroke="#4d6b00"
            strokeWidth="42"
            strokeLinecap="round"
          />
          <path
            d="M 556 318 C 526 322 506 340 502 360"
            fill="none"
            stroke={`url(#${fx("hood")})`}
            strokeWidth="34"
            strokeLinecap="round"
          />
          {/* Ribbed cuff, then the hand itself. */}
          <g transform="translate(532 326) rotate(-24)">
            <ellipse cx="0" cy="0" rx="26" ry="17" fill={`url(#${fx("cuff")})`} stroke="#4d6b00" strokeWidth="3" />
            <path d="M -16 -9 V 9 M -9 -13 V 13 M -2 -14 V 14 M 5 -13 V 13 M 12 -10 V 10" stroke="#8cc300" strokeWidth="2" opacity="0.75" />
          </g>
          <g transform="translate(504 336) rotate(-16)">
            <ellipse cx="0" cy="0" rx="31" ry="25" fill={`url(#${fx("fur")})`} stroke="#a9794a" strokeWidth="3.5" />
            <path d="M -13 8 C -10 2 -8 -2 -8 -8" stroke="#c99a68" strokeWidth="3" strokeLinecap="round" fill="none" />
            <path d="M -1 10 C 1 3 2 -2 2 -9" stroke="#c99a68" strokeWidth="3" strokeLinecap="round" fill="none" />
            <path d="M 11 9 C 13 3 14 -1 14 -7" stroke="#c99a68" strokeWidth="3" strokeLinecap="round" fill="none" />
            <ellipse cx="-3" cy="12" rx="12" ry="7" fill="#e7c69c" opacity="0.55" />
            <ellipse cx="-15" cy="-10" rx="8" ry="5" fill="#fffdf7" opacity="0.55" />
          </g>
        </g>

        <g>
          <ellipse cx="948" cy="344" rx="36" ry="24" fill={`url(#${fx("fur")})`} stroke="#a9794a" strokeWidth="3.5" />
          <path d="M 930 342 C 934 336 936 330 936 324" stroke="#c99a68" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M 945 346 C 948 338 949 332 949 326" stroke="#c99a68" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M 960 344 C 962 338 963 332 963 327" stroke="#c99a68" strokeWidth="3" strokeLinecap="round" fill="none" />
          <ellipse cx="946" cy="354" rx="17" ry="8" fill="#e7c69c" opacity="0.5" />
          <path d="M 936 358 C 940 356 944 356 947 358 M 954 358 C 958 356 961 356 963 358" stroke="#c99a68" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.7" />
        </g>
        </g>

        {/* ---- floating hearts and sparks ---- */}
        {HEARTS.map((heart, index) => (
          <path
            key={`heart-${index}`}
            className="plx-heart"
            d={heartPath(heart.x, heart.y, heart.scale)}
            fill={heart.color}
            style={
              {
                "--plx-dur": `${heart.duration}s`,
                "--plx-delay": `${heart.delay}s`,
                "--plx-drift": `${heart.drift}px`,
                opacity: 0.85,
              } as CSSProperties
            }
          />
        ))}
        {SPARKS.map((spark, index) => (
          <path
            key={`spark-${index}`}
            className="plx-spark"
            d={`M ${spark.x} ${spark.y - 9 * spark.scale} l ${2.4 * spark.scale} ${6.6 * spark.scale} ${6.6 * spark.scale} ${2.4 * spark.scale} -${6.6 * spark.scale} ${2.4 * spark.scale} -${2.4 * spark.scale} ${6.6 * spark.scale} -${2.4 * spark.scale} -${6.6 * spark.scale} -${6.6 * spark.scale} -${2.4 * spark.scale} ${6.6 * spark.scale} -${2.4 * spark.scale} Z`}
            fill="#f4f1e7"
            style={{ animationDelay: `${spark.delay}s`, transformOrigin: `${spark.x}px ${spark.y}px` }}
          />
        ))}
      </svg>
    </span>
  );
}
