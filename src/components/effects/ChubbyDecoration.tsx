import { cn } from "@/lib/utils";
import "./effects.css";

/**
 * Chubby avatar decorations.
 *
 * Each variant is a hand-drawn SVG ring that lives OUTSIDE the avatar circle —
 * paper-cream shapes with an ink outline, a blush and a lime sparkle. There is
 * no background plate and no bitmap frame, so the decoration sits directly on
 * the banner and the photo shows through the middle untouched. The wrapper is
 * 20% larger than the avatar box, which is exactly the space the art needs
 * (viewBox 140 ≈ avatar diameter 100 + overhang on both sides).
 */
const INK = "#0a0a0b";
const PAPER = "#f4f1e7";
const SIGNAL = "#c9ff3d";
const BLUSH = "#ffb4a8";

const CENTER = 70;
const RING = 55.5;

export type ChubbyVariant = "cloud" | "paws" | "bloom";

function polar(angleDeg: number, radius: number) {
  const angle = (angleDeg * Math.PI) / 180;
  return { x: CENTER + Math.cos(angle) * radius, y: CENTER + Math.sin(angle) * radius };
}

/**
 * A scalloped ring: 24 tangent bumps joined by one continuous outline, so the
 * cloud reads as a single puffy sticker instead of a chain of overlapping
 * circles. Bump radius is the tangent radius for the ring, which makes adjacent
 * arcs meet exactly.
 */
const BUMPS = 24;
const BUMP_BASE = RING + 1.5;
const BUMP_RADIUS = BUMP_BASE * Math.sin(Math.PI / BUMPS);

function scallopedRing() {
  const step = (Math.PI * 2) / BUMPS;
  const tangentRadius = BUMP_BASE * Math.cos(step / 2);
  const point = (angle: number) => [
    CENTER + Math.cos(angle) * tangentRadius,
    CENTER + Math.sin(angle) * tangentRadius,
  ];
  const first = point(-step / 2);
  let d = `M${first[0].toFixed(2)} ${first[1].toFixed(2)}`;
  for (let i = 0; i < BUMPS; i += 1) {
    const next = point(i * step + step / 2);
    d += ` A${BUMP_RADIUS.toFixed(2)} ${BUMP_RADIUS.toFixed(2)} 0 0 1 ${next[0].toFixed(2)} ${next[1].toFixed(2)}`;
  }
  return `${d} Z`;
}

const CLOUD_PATH = scallopedRing();

function Cloud({ animated }: { animated: boolean }) {
  return (
    <>
      <path
        d={CLOUD_PATH}
        fill={PAPER}
        stroke={INK}
        strokeWidth="2.6"
        strokeLinejoin="round"
      />

      {/* Blush on the cheeks of the ring, plus a small sleeping-soft highlight. */}
      {[
        { angle: -148, rx: 5.4, ry: 3.2 },
        { angle: -32, rx: 5.4, ry: 3.2 },
      ].map((cheek) => {
        const point = polar(cheek.angle, BUMP_BASE - 2.5);
        return (
          <ellipse
            key={cheek.angle}
            cx={point.x}
            cy={point.y}
            rx={cheek.rx}
            ry={cheek.ry}
            fill={BLUSH}
            opacity="0.8"
          />
        );
      })}
      {[196, 262, 300].map((deg) => {
        const point = polar(deg, BUMP_BASE - 1.5);
        return (
          <circle key={`dot-${deg}`} cx={point.x} cy={point.y} r="1.2" fill={INK} opacity="0.28" />
        );
      })}

      {[22, 158, 250, 322].map((deg, i) => {
        const point = polar(deg, 66.5);
        return (
          <g key={`sparkle-${deg}`} transform={`translate(${point.x} ${point.y})`}>
            <g
              className={animated ? "fx-chubby-sparkle" : undefined}
              style={animated ? { animationDelay: `${0.4 + i * 0.5}s` } : undefined}
            >
              <path
                d="M0 -6.6 L1.9 -1.9 L6.6 0 L1.9 1.9 L0 6.6 L-1.9 1.9 L-6.6 0 L-1.9 -1.9 Z"
                fill={SIGNAL}
                stroke={INK}
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </g>
          </g>
        );
      })}
    </>
  );
}

function Paws({ animated }: { animated: boolean }) {
  return (
    <>
      {Array.from({ length: 6 }, (_, i) => i * 60).map((deg, i) => (
        <g key={deg} transform={`rotate(${deg} ${CENTER} ${CENTER})`}>
          <g
            className={animated ? "fx-chubby-paw" : undefined}
            style={animated ? { animationDelay: `${i * 0.24}s` } : undefined}
          >
            <ellipse
              cx={CENTER}
              cy={CENTER - RING + 4.5}
              rx="7.4"
              ry="6.3"
              fill={PAPER}
              stroke={INK}
              strokeWidth="2.4"
            />
            <circle cx={CENTER - 6.2} cy={CENTER - RING - 2.4} r="3" fill={PAPER} stroke={INK} strokeWidth="2.2" />
            <circle cx={CENTER} cy={CENTER - RING - 4.6} r="3.2" fill={PAPER} stroke={INK} strokeWidth="2.2" />
            <circle cx={CENTER + 6.2} cy={CENTER - RING - 2.4} r="3" fill={PAPER} stroke={INK} strokeWidth="2.2" />
            <ellipse
              cx={CENTER}
              cy={CENTER - RING + 5.4}
              rx="2.6"
              ry="1.7"
              fill={BLUSH}
              opacity="0.85"
            />
          </g>
        </g>
      ))}
    </>
  );
}

const HEART =
  "M0 6.5 C-4.4 3.5 -7 0.9 -7 -1.9 C-7 -4.7 -5 -6.5 -2.6 -6.5 C-1.2 -6.5 -0.3 -5.6 0 -4.9 " +
  "C0.3 -5.6 1.2 -6.5 2.6 -6.5 C5 -6.5 7 -4.7 7 -1.9 C7 0.9 4.4 3.5 0 6.5 Z";

function Bloom({ animated }: { animated: boolean }) {
  return (
    <>
      {Array.from({ length: 8 }, (_, i) => i * 45).map((deg, i) => (
        <g key={deg} transform={`rotate(${deg} ${CENTER} ${CENTER}) translate(${CENTER} ${CENTER - RING})`}>
          <g
            className={animated ? "fx-chubby-heart" : undefined}
            style={animated ? { animationDelay: `${i * 0.22}s` } : undefined}
          >
            <path
              d={HEART}
              transform={i % 2 === 0 ? undefined : "scale(0.82)"}
              fill={PAPER}
              stroke={INK}
              strokeWidth="2.3"
              strokeLinejoin="round"
            />
          </g>
        </g>
      ))}

      {Array.from({ length: 8 }, (_, i) => i * 45 + 22.5).map((deg) => {
        const point = polar(deg, 62);
        return (
          <g key={`leaf-${deg}`} transform={`translate(${point.x} ${point.y}) rotate(${deg + 90})`}>
            <ellipse rx="3.4" ry="1.8" fill={SIGNAL} stroke={INK} strokeWidth="1.4" />
          </g>
        );
      })}
    </>
  );
}

export function ChubbyDecoration({
  variant,
  className,
  animated = true,
}: {
  variant: ChubbyVariant;
  className?: string;
  /** Static art (no loops) for reduced-motion members and dense grids. */
  animated?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("pointer-events-none absolute -inset-[20%] block", className)}
    >
      <svg
        viewBox="0 0 140 140"
        className={cn("block h-full w-full", animated && "fx-chubby")}
        focusable="false"
        aria-hidden="true"
      >
        {variant === "cloud" && <Cloud animated={animated} />}
        {variant === "paws" && <Paws animated={animated} />}
        {variant === "bloom" && <Bloom animated={animated} />}
      </svg>
    </span>
  );
}
