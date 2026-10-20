/**
 * The Web Slinger scene.
 *
 * Original character and original art: a masked web-slinger in the
 * red-and-blue spider aesthetic, drawn from scratch as bezier paths. No
 * Marvel, Sony or Disney assets are used, referenced or needed.
 *
 * Layer order is back to front:
 *
 *   stage          the dark stage and its light
 *   haze-back      slow drifting colour clouds (far parallax)
 *   emblem-back    the spider sigil that flashes behind the hero
 *   web-back       strands that reach in from the edges
 *   hero           the character, rim lit, breathing
 *   web-line       the line the hero swings on
 *   shockwave      the ring that lands with them
 *   web-front      strands that spread out at the hero moment
 *   particles-back motes that live behind the hero
 *   hero-light     a specular sweep across the suit
 *   particles-front motes that drift in front
 *   bokeh          out-of-focus foreground dust
 *   grade          the vignette that focuses the centre
 */

import {
  W,
  H,
  FR,
  OP,
  RED,
  DEEP_RED,
  BLUE,
  DEEP_BLUE,
  INK,
  anim,
  still,
  group,
  path,
  ellipse,
  fill,
  stroke,
  gradientStroke,
  trim,
  tr,
  linearGradient,
  glow,
  shapeLayer,
  EASE_IN,
  EASE_OUT,
  EASE_SOFT,
} from "./web-slinger-lib.mjs";

/** The avatar disc the effect is designed to sit behind. */
export const AVATAR = { cx: W / 2, cy: H / 2, r: 168 };

/* ------------------------------------------------------------------ *
 * The character
 * ------------------------------------------------------------------ */

/**
 * The character, authored directly in canvas space.
 *
 * The figure is deliberately large and set into the upper left. The avatar
 * disc covers the middle of the frame, so a centred character would simply
 * disappear behind it — off to one side, the mask and its lenses stay in
 * view and the silhouette still reads around the rim.
 *
 * The head is cropped by the top of the frame, the way a poster crops a
 * close-up: the eyes are the part that has to survive, so they sit high
 * enough to clear the disc.
 */

/** The mask: a tall egg, cropped by the top of the frame. */
const HEAD =
  "M 120 -62 C 226 -62 250 24 250 80 C 250 162 190 216 120 216 " +
  "C 50 216 -10 162 -10 80 C -10 24 14 -62 120 -62 Z";

/** The two lenses — the focal point, and what still reads at 64px. */
const LENS_LEFT = "M 30 64 C 38 32 72 18 100 34 C 92 70 60 96 32 90 Z";
const LENS_RIGHT = "M 210 64 C 202 32 168 18 140 34 C 148 70 180 96 208 90 Z";

/** Shoulders and chest, rising out of the bottom of the frame. */
const TORSO =
  "M 140 146 C 222 146 282 180 312 238 C 366 332 414 442 436 542 " +
  "C 448 600 456 700 460 900 L -176 900 C -174 700 -170 600 -158 542 " +
  "C -134 442 -88 332 -30 238 C 0 180 60 146 140 146 Z";

/** The raised arm — the one that throws the web, out to the right. */
/**
 * The raised shoulder. Kept short on purpose: a long limb at this scale
 * reads as a hook rather than an arm, and the web line already carries the
 * "throwing" gesture.
 */
const ARM_RAISED =
  "M 284 224 C 322 216 352 200 374 178 C 386 166 404 162 412 174 " +
  "C 420 186 412 204 396 214 C 366 232 326 246 292 252 Z";

/** The trailing arm, reaching down and out to the left. */
const ARM_LOW =
  "M -26 296 C 18 318 56 348 86 386 C 104 410 86 438 60 426 " + "C 30 412 2 384 -34 362 Z";

/** The web pattern: lines that run over the mask and across the chest. */
const WEB_LINES_HEAD = [
  "M 120 -62 L 120 216",
  "M 120 66 C 76 72 46 90 30 116",
  "M 120 66 C 164 72 194 90 210 116",
  "M 120 124 C 84 134 60 152 46 176",
  "M 120 124 C 156 134 180 152 194 176",
  "M -10 80 C 24 58 62 48 120 48",
  "M 250 80 C 216 58 178 48 120 48",
];

const WEB_LINES_CHEST = [
  "M 140 150 L 140 520",
  "M 140 220 C 84 232 46 262 26 302",
  "M 140 220 C 196 232 234 262 254 302",
  "M 140 300 C 92 316 58 346 40 386",
  "M 140 300 C 188 316 222 346 240 386",
  "M -30 238 C 20 206 70 194 140 194",
  "M 312 238 C 262 206 212 194 140 194",
];

/** A stylized spider sigil, drawn in its own local space. */
const SPIDER_BODY =
  "M 0 -4 C 9 -4 13 4 13 14 C 13 26 8 34 0 34 C -8 34 -13 26 -13 14 C -13 4 -9 -4 0 -4 Z";
const SPIDER_HEAD =
  "M 0 -30 C 9 -30 14 -24 14 -17 C 14 -10 8 -5 0 -5 C -8 -5 -14 -10 -14 -17 C -14 -24 -9 -30 0 -30 Z";
const SPIDER_LEGS = [
  "M -9 -2 C -32 -16 -50 -34 -58 -58",
  "M -10 6 C -36 0 -58 -10 -72 -26",
  "M -10 14 C -34 20 -52 32 -64 52",
  "M -8 22 C -26 36 -38 52 -46 72",
  "M 9 -2 C 32 -16 50 -34 58 -58",
  "M 10 6 C 36 0 58 -10 72 -26",
  "M 10 14 C 34 20 52 32 64 52",
  "M 8 22 C 26 36 38 52 46 72",
];

/* ------------------------------------------------------------------ *
 * Web strands
 * ------------------------------------------------------------------ */

/** A strand: a bezier that reaches in from the edge, with its own trim. */
function strand(d, { width = 2.2, from = "edge", opacity = 100 } = {}) {
  const gradient =
    from === "edge"
      ? gradientStroke(
          [
            [0, BLUE, 0.9],
            [0.45, "#9fd0ff", 0.55],
            [1, RED, 0.85],
          ],
          0,
          0,
          420,
          420,
          width,
          opacity,
        )
      : gradientStroke(
          [
            [0, RED, 0.9],
            [0.5, "#ffd0d6", 0.5],
            [1, BLUE, 0.85],
          ],
          420,
          420,
          0,
          0,
          width,
          opacity,
        );
  return group([path(d), gradient], {});
}

const STRANDS_BACK = [
  "M 150 512 C 250 430 350 330 470 226",
  "M 300 512 C 356 452 410 386 498 320",
  "M 512 180 C 430 214 350 250 268 300",
  "M 512 386 C 420 386 340 392 262 406",
];

const STRANDS_FRONT = [
  "M 500 250 C 452 330 396 400 320 470",
  "M 512 120 C 430 150 356 182 300 226",
  "M 220 512 C 260 440 300 372 360 316",
];

/* ------------------------------------------------------------------ *
 * Particles
 * ------------------------------------------------------------------ */

function mote(index, seed) {
  // A closed orbit, so the particle is exactly where it started when the
  // loop comes back round.
  const radius = 40 + ((index * 37) % 150);
  const angle = (index / 16) * Math.PI * 2 + seed;
  const cx = W / 2 + Math.cos(angle) * radius;
  const cy = H / 2 + Math.sin(angle) * radius * 0.8;
  const drift = 18 + ((index * 13) % 26);
  const size = 1.4 + ((index * 7) % 5) * 0.7;
  const colour = index % 3 === 0 ? "#ffd7de" : index % 3 === 1 ? "#cfe2ff" : "#ffffff";
  const start = (index * 5) % 40;
  const wobble = 6 + ((index * 11) % 10);

  const keyframes = [];
  const steps = 6;
  for (let step = 0; step <= steps; step += 1) {
    const t = (step / steps) * OP;
    const phase = angle + (step / steps) * Math.PI * 2;
    keyframes.push({
      t: Math.round(t),
      v: [
        cx + Math.cos(phase) * drift,
        cy + Math.sin(phase) * drift * 0.7 + Math.sin(phase * 3) * wobble,
      ],
      ease: EASE_SOFT,
    });
  }
  // The orbit closes, so the last keyframe lands back on the first.
  keyframes[keyframes.length - 1].t = OP;
  keyframes[keyframes.length - 1].v = keyframes[0].v;

  return group([ellipse([size, size], [0, 0]), fill(colour, 70)], {
    p: anim(keyframes),
    o: anim([
      { t: 0, v: 0, ease: EASE_OUT },
      { t: start + 18, v: 62, ease: EASE_SOFT },
      { t: OP - 40, v: 40, ease: EASE_IN },
      { t: OP, v: 0 },
    ]),
    s: anim([
      { t: 0, v: [40, 40, 100], ease: EASE_OUT },
      { t: start + 26, v: [100, 100, 100], ease: EASE_SOFT },
      { t: OP - 30, v: [70, 70, 100], ease: EASE_IN },
      { t: OP, v: [40, 40, 100] },
    ]),
  });
}

/**
 * A soft radial glow, built from concentric rings that fade outward.
 *
 * Lottie has no cheap radial gradient that every renderer agrees on, so the
 * glow is stacked flat ellipses instead — and the same trick keeps the SVG
 * preview honest, because it is the same geometry.
 */
function radialGlow(cx, cy, radius, colour, peakOpacity, rings = 7, falloff = 1.7) {
  const out = [];
  for (let i = 0; i < rings; i += 1) {
    const t = (i + 1) / rings;
    const r = radius * t;
    const opacity = peakOpacity * Math.pow(1 - t, falloff);
    out.push(group([ellipse([r * 2, r * 2], [cx, cy]), fill(colour, opacity)], {}));
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * The layers
 * ------------------------------------------------------------------ */

export function buildScene() {
  const layers = [];
  let index = 1;
  const push = (layer) => {
    layer.ind = index;
    index += 1;
    layers.push(layer);
    return layer;
  };

  /* --- the stage ------------------------------------------------- */
  push(
    shapeLayer(
      "stage",
      [
        group(
          [
            ellipse([W * 1.6, H * 1.6], [W / 2, H / 2]),
            linearGradient(
              [
                [0, "#16224a", 0.95],
                [0.45, "#0a0f22", 0.9],
                [1, "#05060b", 1],
              ],
              W / 2 - 120,
              H / 2 - 120,
              W / 2 + 120,
              H / 2 + 120,
            ),
          ],
          {},
        ),
        // A cold pool of light behind the hero.
        group(
          [
            ellipse([520, 520], [W / 2, H / 2 + 40]),
            linearGradient(
              [
                [0, "#2f6df6", 0.5],
                [0.55, "#1a2f66", 0.22],
                [1, "#05060b", 0],
              ],
              W / 2,
              H / 2 - 120,
              W / 2,
              H / 2 + 180,
            ),
          ],
          {},
        ),
        // A warm counter-light from the lower right.
        group(
          [
            ellipse([420, 420], [W - 40, H - 30]),
            linearGradient(
              [
                [0, "#e8253f", 0.42],
                [0.5, "#7d0f1f", 0.16],
                [1, "#05060b", 0],
              ],
              W - 160,
              H - 150,
              W + 60,
              H + 70,
            ),
          ],
          {},
        ),
      ],
      {
        // The camera pushes in, very slightly, across the whole loop.
        s: anim([
          { t: 0, v: [100, 100, 100], ease: EASE_SOFT },
          { t: OP / 2, v: [107, 107, 100], ease: EASE_SOFT },
          { t: OP, v: [100, 100, 100] },
        ]),
      },
    ),
  );

  /* --- drifting haze (far parallax) ------------------------------- */
  const haze = (cx, cy, r, colour, opacity, sway) =>
    group(
      [
        ellipse([r * 2, r * 2], [0, 0]),
        linearGradient(
          [
            [0, colour, opacity],
            [0.6, colour, opacity * 0.28],
            [1, colour, 0],
          ],
          0,
          -r,
          0,
          r,
        ),
      ],
      {
        p: anim([
          { t: 0, v: [cx, cy, 0], ease: EASE_SOFT },
          { t: OP / 2, v: [cx + sway, cy - sway * 0.6, 0], ease: EASE_SOFT },
          { t: OP, v: [cx, cy, 0] },
        ]),
      },
    );

  push(
    shapeLayer("haze-back", [
      haze(110, 150, 130, "#2f6df6", 0.3, 34),
      haze(410, 120, 110, "#e8253f", 0.22, -28),
      haze(300, 430, 150, "#1a3a8a", 0.18, 22),
    ]),
  );

  /* --- the backlight behind the mask ------------------------------- */
  // A dark figure on a dark stage is invisible. A cold pool of light behind
  // the mask turns the hero into a silhouette, which is what makes the shape
  // read at a glance.
  push(
    shapeLayer(
      "backlight",
      [
        ...radialGlow(100, 80, 250, "#7fa6ff", 58, 9, 1.9),
        ...radialGlow(100, 70, 140, "#e6f0ff", 82, 7, 2.2),
        ...radialGlow(400, 340, 220, "#ff6d80", 42, 6, 1.8),
      ],
      {
        // The light only exists while the hero does, so the loop opens in
        // darkness rather than under a glowing dome.
        o: anim([
          { t: 0, v: 0, ease: EASE_OUT },
          { t: 30, v: 0, ease: EASE_OUT },
          { t: 52, v: 100, ease: EASE_SOFT },
          { t: 198, v: 100, ease: EASE_IN },
          { t: OP, v: 0 },
        ]),
      },
    ),
  );

  /* --- the spider sigil behind the hero --------------------------- */
  const spiderGroup = group(
    [
      group([path(SPIDER_BODY), fill(RED, 92)], { a: still([0, 14, 0]) }),
      group([path(SPIDER_HEAD), fill("#ff4a60", 92)], { a: still([0, 0, 0]) }),
      group([...SPIDER_LEGS.map((leg) => path(leg)), stroke("#ff5c6e", 5, 92)], {}),
    ],
    {},
  );

  push(
    shapeLayer(
      "emblem-back",
      [
        // The halo the sigil burns into.
        ...radialGlow(0, 0, 190, "#ff2d4a", 50, 7, 1.8),
        spiderGroup,
      ],
      {
        p: still([352, 120, 0]),
        a: still([0, 0, 0]),
        s: anim([
          { t: 0, v: [86, 86, 100], ease: EASE_SOFT },
          { t: 108, v: [86, 86, 100], ease: EASE_OUT },
          { t: 132, v: [108, 108, 100], ease: EASE_IN },
          { t: 168, v: [92, 92, 100], ease: EASE_SOFT },
          { t: OP, v: [86, 86, 100] },
        ]),
        o: anim([
          { t: 0, v: 10, ease: EASE_SOFT },
          { t: 108, v: 10, ease: EASE_OUT },
          { t: 126, v: 95, ease: EASE_IN },
          { t: 160, v: 22, ease: EASE_SOFT },
          { t: OP, v: 10 },
        ]),
        r: anim([
          { t: 0, v: -4, ease: EASE_SOFT },
          { t: OP / 2, v: 4, ease: EASE_SOFT },
          { t: OP, v: -4 },
        ]),
      },
    ),
  );

  /* --- strands that reach in from the edges ------------------------ */
  const backStrands = STRANDS_BACK.map((d, i) => {
    const start = i * 9;
    return group(
      [
        path(d),
        trim(
          still(0),
          anim([
            { t: 0, v: 0, ease: EASE_OUT },
            { t: 16 + start, v: 100, ease: EASE_SOFT },
            { t: 196, v: 100, ease: EASE_IN },
            { t: OP, v: 0 },
          ]),
          still(0),
        ),
        gradientStroke(
          [
            [0, BLUE, 0.85],
            [0.5, "#bcdcff", 0.5],
            [1, RED, 0.8],
          ],
          0,
          0,
          460,
          460,
          2.2,
          100,
        ),
      ],
      {},
    );
  });
  push(shapeLayer("web-back", backStrands));

  /* --- the hero ---------------------------------------------------- */
  /**
   * The hero, built from four assemblies: the head (tilted, rim lit, with a
   * hot pair of lenses), the torso, the arms and the web texture.
   */
  const heroBody = () => {
    const silhouette = (paths) => group([...paths.map((d) => path(d))], {});

    const rim = (paths, scale, stops, x1, y1, x2, y2) =>
      group([...paths.map((d) => path(d)), linearGradient(stops, x1, y1, x2, y2)], {
        p: still([120, 120, 0]),
        a: still([120, 120, 0]),
        s: still([scale, scale, 100]),
      });

    const headPaths = [HEAD];
    const torsoPaths = [TORSO, ARM_RAISED, ARM_LOW];

    return group(
      [
        // Wide soft rim, then a tight hot rim: the edge reads as light
        // wrapping the figure instead of a flat outline.
        rim(
          [...headPaths, ...torsoPaths],
          108,
          [
            [0, "#ff3d55", 0.8],
            [0.32, "#8d1226", 0.28],
            [0.58, "#0a0f22", 0.06],
            [1, "#4a86ff", 0.78],
          ],
          -20,
          -60,
          300,
          380,
        ),
        rim(
          [...headPaths, ...torsoPaths],
          103,
          [
            [0, "#ffd7de", 0.9],
            [0.28, "#ff6d80", 0.5],
            [0.54, "#0a0f22", 0.08],
            [0.76, "#0a0f22", 0.08],
            [1, "#cfe4ff", 0.9],
          ],
          10,
          -70,
          270,
          400,
        ),

        // The body itself: near black, with a cold sheen.
        group(
          [
            ...torsoPaths.map((d) => path(d)),
            linearGradient(
              [
                [0, "#16203c", 1],
                [0.36, "#0b0f1c", 1],
                [0.7, "#080a14", 1],
                [1, "#101a38", 1],
              ],
              10,
              0,
              320,
              440,
            ),
          ],
          {},
        ),
        // The mask, tilted as if the head is leaning in.
        group(
          [
            path(HEAD),
            linearGradient(
              [
                [0, "#1b2748", 1],
                [0.4, "#0c1120", 1],
                [0.74, "#080a14", 1],
                [1, "#132043", 1],
              ],
              -10,
              -60,
              240,
              210,
            ),
          ],
          { p: still([120, 76, 0]), a: still([120, 76, 0]), r: still(-7) },
        ),

        // A cold sheen across the shoulders, so the body is not a flat void.
        group(
          [
            path(TORSO),
            linearGradient(
              [
                [0, "#5f86d8", 0.14],
                [0.22, "#2b4a8f", 0.07],
                [0.6, "#0a0d1a", 0],
                [1, "#e8253f", 0.1],
              ],
              -20,
              150,
              440,
              560,
            ),
          ],
          {},
        ),

        // The web texture.
        group([...WEB_LINES_CHEST.map((d) => path(d)), stroke("#9fc2ff", 1.4, 22)], {}),
        group([...WEB_LINES_HEAD.map((d) => path(d)), stroke("#9fc2ff", 1.3, 26)], {
          p: still([140, 30, 0]),
          a: still([140, 30, 0]),
          r: still(-7),
        }),

        // The lenses: a bloom, a hot core, and the dark rim that makes them
        // read as glass set into the mask.
        group(
          [
            ellipse([176, 108], [120, 62]),
            linearGradient(
              [
                [0, "#eaf6ff", 0.7],
                [0.45, "#7fd4ff", 0.32],
                [1, "#2f6df6", 0],
              ],
              32,
              8,
              208,
              116,
            ),
          ],
          { p: still([140, 30, 0]), a: still([140, 30, 0]), r: still(-7) },
        ),
        group(
          [
            ellipse([120, 74], [120, 62]),
            linearGradient(
              [
                [0, "#ffffff", 0.9],
                [0.5, "#bfe8ff", 0.5],
                [1, "#4aa8ff", 0],
              ],
              60,
              25,
              180,
              99,
            ),
          ],
          { p: still([140, 30, 0]), a: still([140, 30, 0]), r: still(-7) },
        ),
        group([path(LENS_LEFT), path(LENS_RIGHT), fill("#070a14", 100)], {
          p: still([140, 30, 0]),
          a: still([140, 30, 0]),
          r: still(-7),
        }),
        group(
          [
            path(LENS_LEFT),
            path(LENS_RIGHT),
            linearGradient(
              [
                [0, "#ffffff", 1],
                [0.4, "#d6ecff", 1],
                [0.75, "#7cc0ff", 0.95],
                [1, "#3f8fff", 0.85],
              ],
              30,
              40,
              210,
              96,
            ),
          ],
          { p: still([140, 30, 0]), a: still([140, 30, 0]), r: still(-7) },
        ),
      ],
      {},
    );
  };

  push(
    shapeLayer("hero", [heroBody()], {
      a: still([120, 120, 0]),
      // Swings in from the upper right and settles.
      p: anim([
        { t: 0, v: [420, -120, 0], ease: EASE_IN },
        { t: 34, v: [420, -120, 0], ease: EASE_OUT },
        { t: 88, v: [190, 60, 0], ease: EASE_SOFT },
        { t: 112, v: [100, 116, 0], ease: EASE_SOFT },
        { t: 132, v: [100, 100, 0], ease: EASE_OUT },
        { t: 200, v: [100, 100, 0], ease: EASE_IN },
        { t: OP, v: [420, -120, 0] },
      ]),
      r: anim([
        { t: 0, v: 26, ease: EASE_IN },
        { t: 34, v: 26, ease: EASE_OUT },
        { t: 88, v: 8, ease: EASE_SOFT },
        { t: 112, v: 0, ease: EASE_SOFT },
        { t: 132, v: -1.5, ease: EASE_OUT },
        { t: 200, v: -1.5, ease: EASE_IN },
        { t: OP, v: 26 },
      ]),
      // A breath, and the rise at the hero moment.
      s: anim([
        { t: 0, v: [44, 44, 100], ease: EASE_IN },
        { t: 34, v: [44, 44, 100], ease: EASE_OUT },
        { t: 112, v: [61, 61, 100], ease: EASE_SOFT },
        { t: 128, v: [63.5, 63.5, 100], ease: EASE_SOFT },
        { t: 168, v: [62, 62, 100], ease: EASE_SOFT },
        { t: 200, v: [61, 61, 100], ease: EASE_IN },
        { t: OP, v: [44, 44, 100] },
      ]),
      o: anim([
        { t: 0, v: 0, ease: EASE_OUT },
        { t: 36, v: 100, ease: EASE_SOFT },
        { t: 196, v: 100, ease: EASE_IN },
        { t: OP, v: 0 },
      ]),
    }),
  );

  /* --- the web line the hero swings on ------------------------------ */
  push(
    shapeLayer(
      "web-line",
      [
        group(
          [
            path("M 498 150 C 512 104 518 56 520 4"),
            trim(
              still(0),
              anim([
                { t: 0, v: 0, ease: EASE_OUT },
                { t: 30, v: 0, ease: EASE_OUT },
                { t: 46, v: 100, ease: EASE_SOFT },
                { t: 104, v: 100, ease: EASE_IN },
                { t: 126, v: 0 },
                { t: OP, v: 0 },
              ]),
              still(0),
            ),
            gradientStroke(
              [
                [0, "#e8f2ff", 0.9],
                [0.6, "#9dc4ff", 0.6],
                [1, "#4a86ff", 0.25],
              ],
              498,
              150,
              520,
              4,
              2.4,
              100,
            ),
          ],
          {},
        ),
      ],
      { o: still(100) },
    ),
  );

  /* --- the landing shockwave --------------------------------------- */
  push(
    shapeLayer("shockwave", [
      group([ellipse([300, 300], [0, 0]), stroke("#cfe6ff", 3, 90)], {
        a: still([300, 300, 0]),
        s: anim([
          { t: 0, v: [10, 10, 100], ease: EASE_OUT },
          { t: 106, v: [10, 10, 100], ease: EASE_OUT },
          { t: 148, v: [190, 190, 100], ease: EASE_IN },
          { t: OP, v: [10, 10, 100] },
        ]),
        o: anim([
          { t: 0, v: 0, ease: EASE_OUT },
          { t: 106, v: 0, ease: EASE_OUT },
          { t: 116, v: 85, ease: EASE_IN },
          { t: 152, v: 0 },
          { t: OP, v: 0 },
        ]),
      }),
    ]),
  );

  /* --- strands that spread out at the hero moment ------------------ */
  const frontStrands = STRANDS_FRONT.map((d, i) => {
    const start = 118 + i * 7;
    return group(
      [
        path(d),
        trim(
          still(0),
          anim([
            { t: 0, v: 0, ease: EASE_OUT },
            { t: start, v: 0, ease: EASE_OUT },
            { t: start + 22, v: 100, ease: EASE_SOFT },
            { t: 198, v: 100, ease: EASE_IN },
            { t: OP, v: 0 },
          ]),
          still(0),
        ),
        gradientStroke(
          [
            [0, RED, 0.9],
            [0.5, "#ffd6dc", 0.55],
            [1, BLUE, 0.85],
          ],
          460,
          460,
          0,
          0,
          2.4,
          100,
        ),
      ],
      {},
    );
  });
  push(shapeLayer("web-front", frontStrands));

  /* --- particles ---------------------------------------------------- */
  const backMotes = [];
  const frontMotes = [];
  for (let i = 0; i < 16; i += 1) {
    const moteGroup = mote(i, i * 0.37);
    if (i % 2 === 0) backMotes.push(moteGroup);
    else frontMotes.push(moteGroup);
  }
  push(shapeLayer("particles-back", backMotes));

  /* --- a specular sweep across the suit ---------------------------- */
  push(
    shapeLayer("hero-light", [
      group(
        [
          ellipse([150, 640], [168, 120]),
          linearGradient(
            [
              [0, "#ffffff", 0],
              [0.42, "#e8f1ff", 0.16],
              [0.55, "#f4f9ff", 0.22],
              [1, "#ffffff", 0],
            ],
            96,
            -200,
            240,
            440,
          ),
        ],
        {
          r: anim([
            { t: 0, v: -28, ease: EASE_SOFT },
            { t: 118, v: -28, ease: EASE_OUT },
            { t: 150, v: 26, ease: EASE_IN },
            { t: 196, v: 26, ease: EASE_SOFT },
            { t: OP, v: -28 },
          ]),
          o: anim([
            { t: 0, v: 0, ease: EASE_OUT },
            { t: 120, v: 0, ease: EASE_OUT },
            { t: 138, v: 42, ease: EASE_IN },
            { t: 170, v: 0 },
            { t: OP, v: 0 },
          ]),
        },
      ),
    ]),
  );

  push(shapeLayer("particles-front", frontMotes));

  /* --- out of focus foreground dust -------------------------------- */
  const bokeh = (cx, cy, r, colour, opacity) =>
    group(
      [
        ellipse([r * 2, r * 2], [0, 0]),
        linearGradient(
          [
            [0, colour, opacity],
            [0.65, colour, opacity * 0.3],
            [1, colour, 0],
          ],
          -r,
          -r,
          r,
          r,
        ),
      ],
      {
        p: anim([
          { t: 0, v: [cx, cy, 0], ease: EASE_SOFT },
          { t: OP / 2, v: [cx + 26, cy - 18, 0], ease: EASE_SOFT },
          { t: OP, v: [cx, cy, 0] },
        ]),
        o: anim([
          { t: 0, v: opacity * 0.7, ease: EASE_SOFT },
          { t: OP / 2, v: opacity, ease: EASE_SOFT },
          { t: OP, v: opacity * 0.7 },
        ]),
      },
    );

  push(
    shapeLayer("bokeh", [
      bokeh(70, 430, 60, "#ff8fa0", 0.16),
      bokeh(450, 120, 74, "#7fb0ff", 0.14),
      bokeh(250, 470, 52, "#ffffff", 0.1),
    ]),
  );

  /* --- the grade ---------------------------------------------------- */
  push(
    shapeLayer("grade", [
      group(
        [
          ellipse([W * 1.5, H * 1.5], [W / 2, H / 2]),
          linearGradient(
            [
              [0, "#000000", 0],
              [0.62, "#000000", 0.1],
              [1, "#000000", 0.78],
            ],
            W / 2 - 200,
            H / 2 - 200,
            W / 2 + 200,
            H / 2 + 200,
          ),
        ],
        {},
      ),
    ]),
  );

  return layers;
}

/** The Lottie document. */
export function buildLottie() {
  return {
    v: "5.9.0",
    fr: FR,
    ip: 0,
    op: OP,
    w: W,
    h: H,
    nm: "Web Slinger",
    ddd: 0,
    assets: [],
    layers: buildScene(),
    markers: [],
  };
}
