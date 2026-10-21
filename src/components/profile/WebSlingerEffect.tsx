import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The Web Slinger profile effect.
 *
 * An original masked web-slinger — red-and-blue suit, black web lattice,
 * white lenses — crouched on a strand with both hands slinging. Everything is
 * transparent inline SVG: there is no background rect, no stage, no card and
 * no raster asset, so the profile's own banner stays visible through and
 * around the character.
 *
 * The art is hand-authored vector work, not generated imagery. No Marvel,
 * Sony or Disney assets, models or reference artwork are used.
 *
 * Three rules drive the implementation:
 *   - the effect is decoration: `pointer-events: none` and `aria-hidden`, so
 *     every button, link and menu on the profile keeps working;
 *   - the loop is quiet: a breath, drifting motes, web strands that extend
 *     and settle, one slow lens pulse — no shaking or flashing;
 *   - motion is optional: `prefers-reduced-motion` and low-core/low-memory
 *     devices get the same scene as a still, and the animation pauses while
 *     the banner is off screen.
 */

type Props = {
  className?: string;
};

/* ------------------------------------------------------------------ *
 * Character geometry — authored directly on a 640 × 360 canvas.
 * ------------------------------------------------------------------ */

const HEAD =
  "M 300 88 C 295 76 297 58 307 51 C 314 46 325 46 332 52 C 341 60 345 76 340 88 " +
  "C 336 97 329 101 320 101 C 311 101 304 97 300 88 Z";

const LENS_LEFT =
  "M 302 68 C 304 59 311 55 318 58 C 315 68 310 77 302 76 C 300 73 301 70 302 68 Z";
const LENS_RIGHT =
  "M 338 68 C 336 59 329 55 322 58 C 325 68 330 77 338 76 C 340 73 339 70 338 68 Z";

const NECK =
  "M 306 92 L 334 92 L 340 116 C 334 120 306 120 300 116 Z";

const TORSO =
  "M 320 108 C 344 108 365 116 378 130 C 392 146 400 168 399 186 " +
  "C 398 202 390 213 376 219 C 359 226 340 229 320 229 " +
  "C 300 229 281 226 264 219 C 250 213 242 202 241 186 " +
  "C 240 168 248 146 262 130 C 275 116 296 108 320 108 Z";

const ARM_RIGHT =
  "M 366 128 C 386 120 402 108 416 94 C 430 80 444 70 456 64 " +
  "C 464 60 472 64 472 72 C 472 82 460 92 448 102 " +
  "C 432 116 414 128 394 136 C 382 141 366 138 364 132 Z";

const HAND_RIGHT =
  "M 452 62 C 458 54 470 54 476 61 C 482 69 478 80 470 83 " +
  "C 462 86 454 79 452 71 Z";

const ARM_LEFT =
  "M 274 130 C 256 138 238 152 224 168 C 212 181 198 196 188 206 " +
  "C 182 212 180 220 188 223 C 196 226 204 217 211 208 " +
  "C 224 193 238 181 254 171 C 270 161 282 148 286 138 Z";

const HAND_LEFT =
  "M 186 202 C 178 206 172 214 174 222 C 176 230 186 232 192 226 " +
  "C 198 220 198 208 192 204 Z";

const THIGH_LEFT =
  "M 302 220 C 284 224 266 236 254 252 C 246 264 246 278 256 282 " +
  "C 266 286 280 276 290 262 C 299 250 310 236 316 228 Z";

const SHIN_LEFT =
  "M 252 270 C 242 282 238 298 244 312 C 248 322 260 322 266 314 " +
  "C 272 304 276 288 272 276 C 266 268 258 264 252 270 Z";

const BOOT_LEFT =
  "M 246 306 C 238 312 226 316 218 322 C 212 327 216 334 226 333 " +
  "L 264 327 C 270 321 271 311 265 306 Z";

const THIGH_RIGHT =
  "M 338 220 C 356 224 374 236 386 252 C 394 264 394 278 384 282 " +
  "C 374 286 360 276 350 262 C 341 250 330 236 324 228 Z";

const SHIN_RIGHT =
  "M 388 270 C 398 282 402 298 396 312 C 392 322 380 322 374 314 " +
  "C 368 304 364 288 368 276 C 374 268 382 264 388 270 Z";

const BOOT_RIGHT =
  "M 394 306 C 402 312 414 316 422 322 C 428 327 424 334 414 333 " +
  "L 376 327 C 370 321 369 311 375 306 Z";

/** Blue forearm sleeves, clipped to the arm silhouettes. */
const SLEEVE_RIGHT =
  "M 414 90 C 432 78 446 68 456 61 L 472 70 C 460 80 444 94 428 108 Z";
const SLEEVE_LEFT =
  "M 224 166 C 212 180 198 194 188 204 L 201 218 C 213 206 227 192 239 180 Z";

/** Blue side panels, clipped to the torso. */
const PANEL_LEFT =
  "M 270 128 C 254 144 244 166 243 186 C 242 201 249 212 261 217 " +
  "L 292 226 C 279 208 274 188 275 168 C 276 152 282 138 290 126 Z";
const PANEL_RIGHT =
  "M 370 128 C 386 144 396 166 397 186 C 398 201 391 212 379 217 " +
  "L 348 226 C 361 208 366 188 365 168 C 364 152 358 138 350 126 Z";

/** Blue outer stripes on the thighs. */
const THIGH_STRIPE_LEFT =
  "M 300 222 C 284 228 270 238 260 250 C 252 260 248 270 250 278 " +
  "L 262 280 C 264 270 270 260 278 250 C 286 240 296 232 304 228 Z";
const THIGH_STRIPE_RIGHT =
  "M 340 224 C 356 230 372 240 382 252 C 390 262 392 272 388 280 " +
  "L 376 276 C 370 266 362 254 350 244 C 344 238 340 230 338 226 Z";

// The scene is height-fitted inside a banner that can be much wider than
// 16:9. The strand and the web line run past the 640-unit viewBox and the SVG
// is `overflow: visible`, so they reach the banner edges instead of stopping
// in mid-air on a wide desktop header. The banner itself clips the excess.
const WEB_LINE = "M -300 350 C 140 330 500 330 940 348";

const STRANDS_RIGHT = [
  "M 468 64 C 560 30 760 10 940 4",
  "M 468 64 C 540 100 720 112 940 120",
  "M 468 64 C 600 60 780 40 940 40",
];

const STRANDS_LEFT = [
  "M 184 214 C 100 208 -40 196 -300 180",
  "M 184 214 C 110 236 -40 270 -300 310",
  "M 184 214 C 130 260 10 300 -300 344",
];

const TRAIL_RED =
  "M 174 212 C 144 176 150 132 192 108 C 224 90 264 84 296 92";
const TRAIL_BLUE =
  "M 472 70 C 508 100 516 140 492 170 C 474 194 444 208 414 210";

const PARTICLES = [
  { x: 124, y: 96, r: 2.4, color: "#ff8d9c", delay: 0, duration: 11 },
  { x: 176, y: 138, r: 1.7, color: "#cfe2ff", delay: 1.6, duration: 9 },
  { x: 152, y: 262, r: 2.1, color: "#ff6d80", delay: 3.1, duration: 13 },
  { x: 218, y: 318, r: 1.6, color: "#ffffff", delay: 0.8, duration: 10 },
  { x: 262, y: 152, r: 1.5, color: "#ffffff", delay: 4.2, duration: 12 },
  { x: 386, y: 300, r: 2.3, color: "#9fc8ff", delay: 2.2, duration: 11 },
  { x: 452, y: 252, r: 1.7, color: "#ffffff", delay: 0.4, duration: 9.5 },
  { x: 512, y: 190, r: 2.5, color: "#ff8d9c", delay: 3.6, duration: 12.5 },
  { x: 548, y: 118, r: 1.6, color: "#cfe2ff", delay: 1.1, duration: 10.5 },
  { x: 596, y: 250, r: 2, color: "#ffffff", delay: 5.2, duration: 14 },
  { x: 80, y: 196, r: 1.5, color: "#9fc8ff", delay: 2.7, duration: 11.5 },
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

export function WebSlingerEffect({ className }: Props) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const [calm, setCalm] = useState(false);
  const [onScreen, setOnScreen] = useState(true);

  // Follow the OS preference live, and step down on very small devices.
  useEffect(() => {
    setCalm(prefersStillFrame());
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setCalm(prefersStillFrame());
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  // Off-screen effects should cost nothing.
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

  return (
    <span
      ref={hostRef}
      aria-hidden="true"
      data-calm={calm ? "true" : undefined}
      data-visible={onScreen ? "true" : "false"}
      className={cn("wsx", className)}
    >
      <svg
        className="wsx-svg"
        viewBox="0 0 640 360"
        preserveAspectRatio="xMidYMid meet"
        role="presentation"
        focusable="false"
      >
        <defs>
          <linearGradient id="wsx-red" x1="0" y1="0" x2="0.65" y2="1">
            <stop offset="0%" stopColor="#f2435b" />
            <stop offset="42%" stopColor="#d01c37" />
            <stop offset="100%" stopColor="#7a0c1b" />
          </linearGradient>
          <linearGradient id="wsx-red-deep" x1="0" y1="0" x2="0.5" y2="1">
            <stop offset="0%" stopColor="#c2182f" />
            <stop offset="100%" stopColor="#5c0713" />
          </linearGradient>
          <linearGradient id="wsx-blue" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3f73e4" />
            <stop offset="52%" stopColor="#1b3c99" />
            <stop offset="100%" stopColor="#081642" />
          </linearGradient>
          <linearGradient id="wsx-blue-deep" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" stopColor="#22479f" />
            <stop offset="100%" stopColor="#060f2c" />
          </linearGradient>
          <linearGradient id="wsx-lens" x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="45%" stopColor="#e9f6ff" />
            <stop offset="78%" stopColor="#a4d8ff" />
            <stop offset="100%" stopColor="#67b6ff" />
          </linearGradient>
          <radialGradient id="wsx-bloom">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="45%" stopColor="#7cc7ff" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#3f8fff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="wsx-chest-glow">
            <stop offset="0%" stopColor="#ff5c72" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#ff2d4a" stopOpacity="0" />
          </radialGradient>

          {/* Edge light: cool from the upper right, warm from the left. */}
          <linearGradient id="wsx-rim-cool" x1="0" y1="0" x2="1" y2="0.25">
            <stop offset="0%" stopColor="#dcecff" stopOpacity="0" />
            <stop offset="58%" stopColor="#dcecff" stopOpacity="0" />
            <stop offset="100%" stopColor="#f2f9ff" stopOpacity="0.95" />
          </linearGradient>
          <linearGradient id="wsx-rim-warm" x1="0" y1="0" x2="1" y2="0.25">
            <stop offset="0%" stopColor="#ff8a9a" stopOpacity="0.8" />
            <stop offset="42%" stopColor="#ff8a9a" stopOpacity="0" />
            <stop offset="100%" stopColor="#ff8a9a" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="wsx-web" x1="0" y1="0" x2="1" y2="0.4">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25" />
            <stop offset="45%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#cfe6ff" stopOpacity="0.4" />
          </linearGradient>
          <linearGradient id="wsx-trail-red" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ff5c72" stopOpacity="0" />
            <stop offset="55%" stopColor="#ff5c72" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#ffb3bd" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="wsx-trail-blue" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7fb4ff" stopOpacity="0" />
            <stop offset="50%" stopColor="#5c9dff" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#2f6df6" stopOpacity="0" />
          </linearGradient>

          {/* A faint weave so the suit reads as fabric, not flat paint. */}
          <pattern id="wsx-fabric" width="4" height="4" patternUnits="userSpaceOnUse">
            <path d="M 0 4 L 4 0" stroke="#000000" strokeOpacity="0.09" strokeWidth="0.7" />
            <path d="M 0 0 L 4 4" stroke="#ffffff" strokeOpacity="0.05" strokeWidth="0.6" />
          </pattern>

          <filter id="wsx-soft" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.4" />
          </filter>
          <filter id="wsx-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
          <filter id="wsx-rim-blur" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="0.6" />
          </filter>

          <clipPath id="wsx-head-clip">
            <path d={HEAD} />
          </clipPath>
          <clipPath id="wsx-torso-clip">
            <path d={TORSO} />
          </clipPath>
          <clipPath id="wsx-arm-right-clip">
            <path d={ARM_RIGHT} />
          </clipPath>
          <clipPath id="wsx-arm-left-clip">
            <path d={ARM_LEFT} />
          </clipPath>
          <clipPath id="wsx-thigh-left-clip">
            <path d={THIGH_LEFT} />
          </clipPath>
          <clipPath id="wsx-thigh-right-clip">
            <path d={THIGH_RIGHT} />
          </clipPath>
          <clipPath id="wsx-shin-left-clip">
            <path d={SHIN_LEFT} />
          </clipPath>
          <clipPath id="wsx-shin-right-clip">
            <path d={SHIN_RIGHT} />
          </clipPath>

          {/* Silhouettes reused for the rim light. */}
          <path id="wsx-head-shape" d={HEAD} />
          <path id="wsx-torso-shape" d={TORSO} />
          <path id="wsx-arm-right-shape" d={ARM_RIGHT} />
          <path id="wsx-arm-left-shape" d={ARM_LEFT} />
          <path id="wsx-thigh-left-shape" d={THIGH_LEFT} />
          <path id="wsx-thigh-right-shape" d={THIGH_RIGHT} />
          <path id="wsx-shin-left-shape" d={SHIN_LEFT} />
          <path id="wsx-shin-right-shape" d={SHIN_RIGHT} />
          <path id="wsx-boot-left-shape" d={BOOT_LEFT} />
          <path id="wsx-boot-right-shape" d={BOOT_RIGHT} />
        </defs>

        {/* Energy trails sit behind the figure, so they never veil the face. */}
        <g className="wsx-trails" filter="url(#wsx-soft)">
          <path
            className="wsx-trail wsx-trail--red"
            d={TRAIL_RED}
            fill="none"
            stroke="url(#wsx-trail-red)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            className="wsx-trail wsx-trail--blue"
            d={TRAIL_BLUE}
            fill="none"
            stroke="url(#wsx-trail-blue)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>

        {/* The strand he is crouched on. */}
        <g className="wsx-webline">
          <path d={WEB_LINE} fill="none" stroke="#cfe6ff" strokeOpacity="0.16" strokeWidth="4" />
          {/* Dark keyline keeps the strand readable on a light banner. */}
          <path d={WEB_LINE} fill="none" stroke="#1a0a12" strokeOpacity="0.3" strokeWidth="2.4" strokeLinecap="round" />
          <path className="wsx-webline-core" d={WEB_LINE} fill="none" stroke="#ffffff" strokeWidth="1.15" strokeLinecap="round" />
        </g>

        <g className="wsx-figure">
          {/* ---- back leg (viewer's right) ---- */}
          <g className="wsx-leg wsx-leg--back">
            <path d={THIGH_RIGHT} fill="url(#wsx-red)" stroke="#420712" strokeWidth="1.2" strokeLinejoin="round" />
            <path d={THIGH_STRIPE_RIGHT} fill="url(#wsx-blue)" opacity="0.95" />
            <g clipPath="url(#wsx-thigh-right-clip)" fill="none" stroke="#2a0710" strokeOpacity="0.42" strokeWidth="0.8">
              <path d="M 340 230 C 356 240 368 254 374 270" />
              <path d="M 330 236 C 344 248 356 262 362 278" />
              <path d="M 352 236 C 366 246 378 258 386 272" />
            </g>
            <g clipPath="url(#wsx-thigh-right-clip)" fill="none">
              <path d="M 350 232 C 362 244 372 258 378 272" stroke="#ffb3bd" strokeWidth="1.2" strokeOpacity="0.35" />
              <path d="M 358 234 C 370 246 380 260 386 274" stroke="#1a0a12" strokeWidth="0.8" strokeDasharray="2 3" strokeOpacity="0.35" />
            </g>
            <path d={SHIN_RIGHT} fill="url(#wsx-blue)" stroke="#060f2c" strokeWidth="1.2" strokeLinejoin="round" />
            <g clipPath="url(#wsx-shin-right-clip)" fill="none" stroke="#a9c8ff" strokeOpacity="0.3" strokeWidth="0.8">
              <path d="M 376 282 C 382 296 384 308 380 318" />
              <path d="M 388 278 C 394 292 396 304 390 316" />
            </g>
            <path d={BOOT_RIGHT} fill="url(#wsx-red-deep)" stroke="#3a0611" strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M 378 322 L 420 329" stroke="#1c0309" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
            <path d="M 384 316 C 394 318 404 322 412 326" stroke="#7a0c1b" strokeWidth="2.2" fill="none" opacity="0.8" />
            <path d="M 386 306 C 396 310 406 316 414 322" stroke="#ff9aa7" strokeWidth="1" strokeOpacity="0.5" fill="none" />
          </g>

          {/* ---- front leg (viewer's left) ---- */}
          <g className="wsx-leg wsx-leg--front">
            <path d={THIGH_LEFT} fill="url(#wsx-red)" stroke="#420712" strokeWidth="1.2" strokeLinejoin="round" />
            <path d={THIGH_STRIPE_LEFT} fill="url(#wsx-blue)" opacity="0.95" />
            <g clipPath="url(#wsx-thigh-left-clip)" fill="none" stroke="#2a0710" strokeOpacity="0.42" strokeWidth="0.8">
              <path d="M 300 230 C 284 240 272 254 266 270" />
              <path d="M 310 236 C 296 248 284 262 278 278" />
              <path d="M 288 236 C 274 246 262 258 254 272" />
            </g>
            <g clipPath="url(#wsx-thigh-left-clip)" fill="none">
              <path d="M 292 232 C 280 244 270 258 264 272" stroke="#ffb3bd" strokeWidth="1.2" strokeOpacity="0.35" />
              <path d="M 284 234 C 272 246 262 260 256 274" stroke="#1a0a12" strokeWidth="0.8" strokeDasharray="2 3" strokeOpacity="0.35" />
            </g>
            <path d={SHIN_LEFT} fill="url(#wsx-blue)" stroke="#060f2c" strokeWidth="1.2" strokeLinejoin="round" />
            <g clipPath="url(#wsx-shin-left-clip)" fill="none" stroke="#a9c8ff" strokeOpacity="0.3" strokeWidth="0.8">
              <path d="M 264 282 C 258 296 256 308 260 318" />
              <path d="M 252 278 C 246 292 244 304 250 316" />
            </g>
            <path d={BOOT_LEFT} fill="url(#wsx-red-deep)" stroke="#3a0611" strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M 262 322 L 220 329" stroke="#1c0309" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
            <path d="M 256 316 C 246 318 236 322 228 326" stroke="#7a0c1b" strokeWidth="2.2" fill="none" opacity="0.8" />
            <path d="M 254 306 C 244 310 234 316 226 322" stroke="#ff9aa7" strokeWidth="1" strokeOpacity="0.5" fill="none" />
          </g>

          {/* ---- low left arm, weaving the strand ---- */}
          <g className="wsx-arm wsx-arm--left">
            <path d={ARM_LEFT} fill="url(#wsx-red)" stroke="#420712" strokeWidth="1.2" strokeLinejoin="round" />
            <g clipPath="url(#wsx-arm-left-clip)">
              <path d={SLEEVE_LEFT} fill="url(#wsx-blue)" opacity="0.96" />
              <path d={ARM_LEFT} fill="url(#wsx-fabric)" />
              <g fill="none" stroke="#2a0710" strokeOpacity="0.4" strokeWidth="0.75">
                <path d="M 274 138 C 260 150 246 162 234 176" />
                <path d="M 282 146 C 268 158 254 170 242 184" />
                <path d="M 262 132 C 250 142 238 152 226 164" />
              </g>
              <path d="M 262 142 C 248 156 234 170 222 182" stroke="#ff9aa7" strokeWidth="0.9" strokeDasharray="2 3.5" strokeOpacity="0.4" fill="none" />
              <path d="M 203 196 L 214 205" stroke="#9fc7ff" strokeWidth="1" strokeOpacity="0.6" />
            </g>
            <path d={HAND_LEFT} fill="url(#wsx-red-deep)" stroke="#3a0611" strokeWidth="1" />
            <g stroke="#ff9aa7" strokeWidth="2.1" strokeLinecap="round" opacity="0.85">
              <path d="M 176 214 L 164 212" />
              <path d="M 176 220 L 165 221" />
              <path d="M 180 226 L 171 231" />
            </g>
            <circle cx="191" cy="219" r="3.4" fill="#0b1020" stroke="#8fb8ff" strokeWidth="0.7" />
            <circle cx="191" cy="219" r="1.1" fill="#dcecff" />
            <path d="M 252 160 C 244 168 236 176 229 184" stroke="#ffb3bd" strokeWidth="1.2" strokeOpacity="0.45" fill="none" />
          </g>

          {/* ---- torso ---- */}
          <g className="wsx-torso">
            <path d={TORSO} fill="url(#wsx-red)" stroke="#3d0712" strokeWidth="1.5" strokeLinejoin="round" />
            <g clipPath="url(#wsx-torso-clip)">
              <path d={PANEL_LEFT} fill="url(#wsx-blue)" />
              <path d={PANEL_RIGHT} fill="url(#wsx-blue)" />
              <rect x="236" y="104" width="168" height="130" fill="url(#wsx-fabric)" />

              {/* web lattice */}
              <g fill="none" stroke="#2a0710" strokeOpacity="0.5" strokeWidth="0.9">
                <path d="M 320 116 L 320 230" />
                <path d="M 320 144 C 300 140 280 134 262 126" />
                <path d="M 320 144 C 340 140 360 134 378 126" />
                <path d="M 320 170 C 296 172 272 178 252 188" />
                <path d="M 320 170 C 344 172 368 178 388 188" />
                <path d="M 320 198 C 300 202 278 208 262 216" />
                <path d="M 320 198 C 340 202 362 208 378 216" />
                <path d="M 262 146 C 290 162 350 162 378 146" />
                <path d="M 252 174 C 286 190 354 190 388 174" />
                <path d="M 258 204 C 290 214 350 214 382 204" />
                <path d="M 288 128 C 306 138 334 138 352 128" />
              </g>

              {/* muscle shaping */}
              <g fill="none" stroke="#5c0917" strokeOpacity="0.45" strokeWidth="1.6" strokeLinecap="round">
                <path d="M 320 150 C 306 154 294 162 286 172" />
                <path d="M 320 150 C 334 154 346 162 354 172" />
                <path d="M 320 190 C 306 194 294 202 286 212" />
                <path d="M 320 190 C 334 194 346 202 354 212" />
              </g>

              {/* stitched seams */}
              <g fill="none" stroke="#8fc0ff" strokeOpacity="0.45" strokeWidth="0.9" strokeDasharray="2.5 3.5">
                <path d={PANEL_LEFT} />
                <path d={PANEL_RIGHT} />
              </g>
              <g fill="none" stroke="#ff9aa7" strokeOpacity="0.35" strokeWidth="0.9" strokeDasharray="2 4">
                <path d="M 262 132 C 246 154 240 180 244 200" />
                <path d="M 378 132 C 394 154 400 180 396 200" />
              </g>
              <path d="M 320 110 C 296 112 278 120 264 132" stroke="#ffc2ca" strokeWidth="1.1" strokeOpacity="0.4" fill="none" />
            </g>

            {/* chest mark, original: a small ink spider */}
            <g className="wsx-emblem" transform="translate(320 162)">
              <ellipse className="wsx-emblem-glow" cx="0" cy="0" rx="17" ry="19" fill="url(#wsx-chest-glow)" />
              <g stroke="#2b0710" strokeOpacity="0.82" strokeWidth="1.2" strokeLinecap="round" fill="none">
                <path d="M -4 -2 C -10 -9 -14 -15 -17 -21" />
                <path d="M -4 2 C -11 -2 -16 -5 -22 -7" />
                <path d="M -4 6 C -11 9 -16 13 -21 18" />
                <path d="M -3 9 C -9 14 -12 19 -15 24" />
                <path d="M 4 -2 C 10 -9 14 -15 17 -21" />
                <path d="M 4 2 C 11 -2 16 -5 22 -7" />
                <path d="M 4 6 C 11 9 16 13 21 18" />
                <path d="M 3 9 C 9 14 12 19 15 24" />
              </g>
              <ellipse cx="0" cy="3" rx="4.4" ry="6.8" fill="#2b0710" fillOpacity="0.85" />
              <circle cx="0" cy="-7.6" r="3.1" fill="#2b0710" fillOpacity="0.85" />
            </g>
          </g>

          {/* ---- raised right arm, shooting web ---- */}
          <g className="wsx-arm wsx-arm--right">
            <path d={ARM_RIGHT} fill="url(#wsx-red)" stroke="#420712" strokeWidth="1.2" strokeLinejoin="round" />
            <g clipPath="url(#wsx-arm-right-clip)">
              <path d={SLEEVE_RIGHT} fill="url(#wsx-blue)" opacity="0.96" />
              <path d={ARM_RIGHT} fill="url(#wsx-fabric)" />
              <g fill="none" stroke="#2a0710" strokeOpacity="0.4" strokeWidth="0.75">
                <path d="M 376 132 C 392 122 406 110 418 100" />
                <path d="M 388 138 C 402 128 416 116 428 106" />
                <path d="M 368 126 C 382 118 396 106 408 96" />
              </g>
              <path d="M 386 130 C 400 118 414 106 426 96" stroke="#ff9aa7" strokeWidth="0.9" strokeDasharray="2 3.5" strokeOpacity="0.4" fill="none" />
              <path d="M 438 78 L 452 88" stroke="#9fc7ff" strokeWidth="1" strokeOpacity="0.6" />
            </g>
            <path d={HAND_RIGHT} fill="url(#wsx-red-deep)" stroke="#3a0611" strokeWidth="1" />
            <g stroke="#ff9aa7" strokeWidth="2.2" strokeLinecap="round" opacity="0.85">
              <path d="M 472 64 L 482 60" />
              <path d="M 474 71 L 484 70" />
              <path d="M 472 78 L 480 82" />
            </g>
            <circle cx="454" cy="72" r="3.4" fill="#0b1020" stroke="#8fb8ff" strokeWidth="0.7" />
            <circle cx="454" cy="72" r="1.1" fill="#dcecff" />
            <path d="M 400 108 C 414 96 428 84 440 76" stroke="#ffb3bd" strokeWidth="1.2" strokeOpacity="0.45" fill="none" />
          </g>

          {/* ---- neck + mask ---- */}
          <g className="wsx-head">
            <path d={NECK} fill="url(#wsx-red-deep)" stroke="#3d0712" strokeWidth="1.1" />
            <path d="M 306 98 C 314 104 326 104 334 98" stroke="#4d0917" strokeWidth="1.4" fill="none" opacity="0.8" />
            <path d={HEAD} fill="url(#wsx-red)" stroke="#3d0712" strokeWidth="1.5" strokeLinejoin="round" />

            <g clipPath="url(#wsx-head-clip)">
              <path d={HEAD} fill="url(#wsx-fabric)" />
              {/* webbing */}
              <g fill="none" stroke="#2a0710" strokeOpacity="0.55" strokeWidth="0.85">
                <path d="M 320 48 L 320 101" />
                <path d="M 306 53 C 312 62 316 74 317 88" />
                <path d="M 334 53 C 328 62 324 74 323 88" />
                <path d="M 299 61 C 309 66 331 66 341 61" />
                <path d="M 300 75 C 310 79 330 79 340 75" />
                <path d="M 304 89 C 312 92 328 92 336 89" />
                <path d="M 309 48 C 303 60 300 74 302 88" />
                <path d="M 331 48 C 337 60 340 74 338 88" />
              </g>
              {/* shade on the left, light on the right */}
              <path d="M 300 88 C 297 72 301 58 311 51" fill="none" stroke="#5c0917" strokeOpacity="0.7" strokeWidth="5" />
              <path d="M 338 55 C 343 68 342 82 336 93" fill="none" stroke="#ffc2ca" strokeOpacity="0.4" strokeWidth="2" />
              {/* lens glow, inside the mask */}
              <ellipse className="wsx-lens-glow" cx="320" cy="66" rx="26" ry="17" fill="url(#wsx-bloom)" />
              {/* sockets */}
              <g fill="#150710" stroke="#12050c" strokeWidth="1.1">
                <path d={LENS_LEFT} />
                <path d={LENS_RIGHT} />
              </g>
              <path d={LENS_LEFT} fill="url(#wsx-lens)" stroke="#0d0308" strokeWidth="0.7" />
              <path d={LENS_RIGHT} fill="url(#wsx-lens)" stroke="#0d0308" strokeWidth="0.7" />
              {/* lens bevel + catchlights */}
              <path d="M 304 66 C 306 59 311 56 316 57" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.95" />
              <path d="M 336 66 C 334 59 329 56 324 57" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.95" />
              <circle cx="313" cy="62" r="1.1" fill="#ffffff" />
              <circle cx="327" cy="62" r="1.1" fill="#ffffff" />
              <path d="M 308 74 C 312 76 316 76 318 75" stroke="#3f8fff" strokeWidth="0.9" strokeOpacity="0.6" fill="none" />
              <path d="M 332 74 C 328 76 324 76 322 75" stroke="#3f8fff" strokeWidth="0.9" strokeOpacity="0.6" fill="none" />
            </g>

            {/* mask seams that sit on top of the lenses' frame */}
            <path d="M 320 96 C 318 90 318 84 319 79" stroke="#3d0712" strokeWidth="1.1" fill="none" opacity="0.75" />
          </g>

          {/* ---- rim light, on top of the silhouette ---- */}
          <g className="wsx-rim" filter="url(#wsx-rim-blur)" fill="none">
            <g stroke="url(#wsx-rim-cool)" strokeWidth="1.9" strokeLinejoin="round">
              <use href="#wsx-head-shape" />
              <use href="#wsx-torso-shape" />
              <use href="#wsx-arm-right-shape" />
              <use href="#wsx-arm-left-shape" />
              <use href="#wsx-thigh-left-shape" />
              <use href="#wsx-thigh-right-shape" />
              <use href="#wsx-shin-left-shape" />
              <use href="#wsx-shin-right-shape" />
              <use href="#wsx-boot-left-shape" />
              <use href="#wsx-boot-right-shape" />
            </g>
            <g stroke="url(#wsx-rim-warm)" strokeWidth="1.3" strokeLinejoin="round">
              <use href="#wsx-head-shape" />
              <use href="#wsx-torso-shape" />
              <use href="#wsx-arm-left-shape" />
              <use href="#wsx-thigh-left-shape" />
            </g>
          </g>
        </g>

        {/* ---- webs thrown from both hands ---- */}
        <g className="wsx-strands wsx-strands--left">
          {STRANDS_LEFT.map((d, index) => (
            <g key={`left-${index}`}>
              <path d={d} fill="none" stroke="#1a0a12" strokeWidth="2.6" strokeOpacity="0.3" strokeLinecap="round" />
              <path d={d} fill="none" stroke="url(#wsx-web)" strokeWidth="3" strokeOpacity="0.16" strokeLinecap="round" />
              <path
                className="wsx-strand"
                d={d}
                pathLength={100}
                fill="none"
                stroke="#ffffff"
                strokeWidth="1.15"
                strokeLinecap="round"
                style={{ animationDelay: `${index * 1.1}s` }}
              />
            </g>
          ))}
        </g>
        <g className="wsx-strands wsx-strands--right">
          {STRANDS_RIGHT.map((d, index) => (
            <g key={`right-${index}`}>
              <path d={d} fill="none" stroke="#1a0a12" strokeWidth="2.6" strokeOpacity="0.3" strokeLinecap="round" />
              <path d={d} fill="none" stroke="url(#wsx-web)" strokeWidth="3" strokeOpacity="0.16" strokeLinecap="round" />
              <path
                className="wsx-strand"
                d={d}
                pathLength={100}
                fill="none"
                stroke="#ffffff"
                strokeWidth="1.15"
                strokeLinecap="round"
                style={{ animationDelay: `${0.5 + index * 1.1}s` }}
              />
            </g>
          ))}
        </g>

        {/* ---- motes ---- */}
        <g className="wsx-particles">
          {PARTICLES.map((p, index) => (
            <circle
              key={`mote-${index}`}
              className="wsx-mote"
              cx={p.x}
              cy={p.y}
              r={p.r}
              fill={p.color}
              style={
                {
                  "--wsx-dur": `${p.duration}s`,
                  "--wsx-delay": `${p.delay}s`,
                } as React.CSSProperties
              }
            />
          ))}
          <path
            className="wsx-spark"
            d="M 508 84 l 1.8 5.2 5.2 1.8 -5.2 1.8 -1.8 5.2 -1.8 -5.2 -5.2 -1.8 5.2 -1.8 Z"
            fill="#eaf6ff"
            opacity="0.8"
          />
          <path
            className="wsx-spark wsx-spark--slow"
            d="M 144 178 l 1.4 4 4 1.4 -4 1.4 -1.4 4 -1.4 -4 -4 -1.4 4 -1.4 Z"
            fill="#ffc2ca"
            opacity="0.7"
          />
        </g>
      </svg>
    </span>
  );
}
