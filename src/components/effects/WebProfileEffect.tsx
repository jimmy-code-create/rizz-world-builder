import { cn } from "@/lib/utils";
import "./effects.css";

/**
 * Profile effects: silk scenes drawn over the profile header.
 *
 * The art is a single transparent SVG in profile coordinates — the banner is the
 * top third of the box — so the same component decorates a shop card, the shop's
 * full profile preview and the real profile page. Nothing here is a bitmap and
 * nothing carries a background: the banner photo stays visible underneath.
 *
 * Two skins:
 *   slinger — lime silk, a small slinger dropped in on a thread, swaying.
 *   veil    — paper-white veil, a denser corner web and a longer, lazier drop.
 */
const INK = "#0a0a0b";
const PAPER = "#f4f1e7";
const SIGNAL = "#c9ff3d";

export type WebVariant = "slinger" | "veil";

/** A quarter web (spokes + three rings) anchored to a top corner. */
function quarterWeb(spokes: number, radius: number) {
  const step = Math.PI / 2 / spokes;
  const paths: string[] = [];
  for (let i = 0; i <= spokes; i += 1) {
    const angle = i * step;
    paths.push(`M0 0 L${Math.cos(angle) * radius} ${Math.sin(angle) * radius}`);
  }
  // Rings sag between the spokes instead of running as straight chords: each
  // segment bows toward the corner, which is what makes silk read as silk.
  for (const ring of [0.38, 0.64, 0.88]) {
    const at = (i: number, r: number) => {
      const angle = i * step;
      return [Math.cos(angle) * radius * r, Math.sin(angle) * radius * r] as const;
    };
    const start = at(0, ring);
    let path = `M${start[0].toFixed(2)} ${start[1].toFixed(2)}`;
    for (let i = 1; i <= spokes; i += 1) {
      const end = at(i, ring);
      const mid = (i - 0.5) * step;
      const sag = radius * ring * 0.9;
      path +=
        ` Q${(Math.cos(mid) * sag).toFixed(2)} ${(Math.sin(mid) * sag).toFixed(2)} ` +
        `${end[0].toFixed(2)} ${end[1].toFixed(2)}`;
    }
    paths.push(path);
  }
  return paths;
}

function Spider({ accent, veil }: { accent: string; veil: boolean }) {
  const body = veil ? SIGNAL : INK;
  const leg = `M170 57.5 C164 54.5 160.5 58.5 157.5 63.5
    M170.8 61.5 C165 60.5 161.5 65.5 159 70
    M171.4 65.5 C166.5 66.5 164 71 162.5 75.5
    M182 57.5 C188 54.5 191.5 58.5 194.5 63.5
    M181.2 61.5 C187 60.5 190.5 65.5 193 70
    M180.6 65.5 C185.5 66.5 188 71 189.5 75.5`;
  return (
    <g className="fx-web-spider">
      <path
        d={`M176 0 L176 ${veil ? 78 : 50}`}
        stroke={accent}
        strokeOpacity="0.75"
        strokeWidth="0.9"
        fill="none"
      />
      <g transform={veil ? "translate(0 26)" : undefined}>
        <path
          d={leg}
          stroke={accent}
          strokeOpacity="0.92"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <ellipse cx="176" cy="62" rx="6.4" ry="7.6" fill={body} stroke={accent} strokeWidth="1.6" />
        <circle cx="176" cy="53" r="4.5" fill={body} stroke={accent} strokeWidth="1.5" />
        <circle cx="173.7" cy="52.2" r="1.25" fill={accent} />
        <circle cx="178.3" cy="52.2" r="1.25" fill={accent} />
        <ellipse cx="176" cy="64.5" rx="2.4" ry="1.5" fill={accent} opacity="0.55" />
      </g>
    </g>
  );
}

export function WebProfileEffect({
  variant,
  className,
  animated = true,
  once = false,
}: {
  variant: WebVariant;
  className?: string;
  /** Static art (no loops) for reduced-motion members. */
  animated?: boolean;
  /** Let the silk settle after one entrance instead of looping forever. */
  once?: boolean;
}) {
  const veil = variant === "veil";
  const accent = veil ? PAPER : SIGNAL;

  const leftWeb = quarterWeb(veil ? 6 : 5, veil ? 78 : 64);
  const rightWeb = quarterWeb(veil ? 8 : 5, veil ? 132 : 74);

  const strands = [
    "M34 0 C30 30 38 46 32 74",
    "M104 0 C101 22 108 34 102 52",
    "M236 0 C239 26 232 40 238 62",
    "M292 0 C296 32 288 48 294 86",
  ];

  const motes = [
    { x: 58, y: 22, r: 1.6, delay: 0 },
    { x: 132, y: 10, r: 1.2, delay: 2.1 },
    { x: 214, y: 30, r: 1.5, delay: 4.3 },
    { x: 268, y: 14, r: 1.1, delay: 1.2 },
    { x: 176, y: 6, r: 1.3, delay: 5.4 },
  ];

  // Cover, anchored top: the corner webs stay welded to the banner corners
  // while the strands below are allowed to spill over the identity row.
  return (
    <svg
      viewBox="0 0 320 240"
      preserveAspectRatio="xMidYMin slice"
      className={cn(
        "fx-web pointer-events-none absolute inset-0 h-full w-full",
        once && "fx-once",
        className,
      )}
      aria-hidden="true"
      focusable="false"
    >
      {/* Outline pass: keeps the silk legible on a bright banner. */}
      <g
        fill="none"
        stroke={INK}
        strokeOpacity="0.26"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {leftWeb.map((d, i) => (
          <path key={`lo-${i}`} d={d} />
        ))}
        <g transform="translate(320 0) scale(-1 1)">
          {rightWeb.map((d, i) => (
            <path key={`ro-${i}`} d={d} />
          ))}
        </g>
        {strands.map((d, i) => (
          <path key={`so-${i}`} d={d} />
        ))}
      </g>

      {/* Silk pass. */}
      <g
        fill="none"
        stroke={accent}
        strokeOpacity="0.62"
        strokeWidth="0.95"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {leftWeb.map((d, i) => (
          <path key={`l-${i}`} d={d} />
        ))}
        <g transform="translate(320 0) scale(-1 1)">
          {rightWeb.map((d, i) => (
            <path key={`r-${i}`} d={d} />
          ))}
        </g>
        {strands.map((d, i) => (
          <path key={`s-${i}`} d={d} />
        ))}
        <circle
          cx="292"
          cy="86"
          r="2"
          fill={accent}
          stroke="none"
          opacity="0.8"
          className={animated ? "fx-web-glint" : undefined}
        />
        <circle
          cx="32"
          cy="74"
          r="1.5"
          fill={accent}
          stroke="none"
          opacity="0.7"
        />
      </g>

      {/* Dew motes drifting down the silk. */}
      {motes.map((mote) => (
        <circle
          key={`${mote.x}-${mote.y}`}
          cx={mote.x}
          cy={mote.y}
          r={mote.r}
          fill={accent}
          opacity="0.55"
          className={animated ? "fx-web-mote" : undefined}
          style={animated ? { animationDelay: `${mote.delay}s` } : undefined}
        />
      ))}

      <Spider accent={accent} veil={veil} />
    </svg>
  );
}
