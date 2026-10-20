/**
 * The Web Slinger avatar decoration.
 *
 * This is the square scene the profile draws behind the avatar disc. At an
 * avatar size of 96px the scene is only 182px across, so a full figure would
 * be a dozen pixels tall. Instead the scene is a close bust: the masked head
 * and one shoulder sit at the top-left of the disc, the rest of the body
 * disappears behind the avatar, and a few web strands and motes give the
 * corners some life.
 *
 * The hero drops in on a line, settles, breathes and scans, then zips out
 * before the loop restarts — the same story as the banner, told in close-up.
 *
 * The art is original: a masked web-slinger in the red-and-blue spider
 * aesthetic, drawn from scratch as bezier paths. No Marvel, Sony or Disney
 * assets are used, referenced or required.
 */

import {
  group,
  path,
  ellipse,
  fill,
  stroke,
  linearGradient,
  gradientStroke,
  shapeLayer,
  still,
  anim,
  animPath,
  lottieZOrder,
} from "./web-slinger-lib.mjs";
import { buildCharacter, sceneHand } from "./web-slinger-rig.mjs";

export { W, H, FR } from "./web-slinger-lib.mjs";

/** The avatar disc the scene is composed around, in scene units. */
export const AVATAR = { r: 135 };

const EASE = {
  in: { i: { x: [0.35], y: [1] }, o: { x: [0.65], y: [0] } },
  out: { i: { x: [0.16], y: [1] }, o: { x: [0.3], y: [0] } },
  soft: { i: { x: [0.42], y: [1] }, o: { x: [0.58], y: [0] } },
  snap: { i: { x: [0.1], y: [1] }, o: { x: [0.3], y: [0] } },
};

const OP = 240;

function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** A soft light pool built from stacked flat rings — no blur required. */
function glowDisc(cx, cy, radius, colour, opacity, rings = 14) {
  const items = [];
  for (let i = rings; i >= 1; i -= 1) {
    const k = i / rings;
    items.push(
      group([ellipse([radius * 2 * k, radius * 2 * k], [cx, cy]), fill(colour, opacity / rings)], {}),
    );
  }
  return group(items, {});
}

/**
 * The hold. The hero stands at the left edge of the avatar, clear of the
 * disc, with one hand up on the line. The body is deliberately narrow so the
 * chest stays readable outside the avatar.
 */
const HOLD = {
  x: 76,
  y: 276,
  scale: 1.2,
  rot: 0,
  lean: 7,
  head: -2,
  opacity: 100,
  armL: [104, 100, 96],
  armR: [-40, -44, -46],
  legL: [100, 86, 30],
  legR: [78, 96, 38],
};

const P = (over) => ({ ...HOLD, ...over });

/** The web anchor, just off the top-right corner. */
const ANCHOR = [500, -70];

export function buildTimeline() {
  const hold = (over) => P({ y: 276 + (over?.dy ?? 0), ...over });
  return [
    { t: 0, pose: P({ y: -190, opacity: 0, head: -10 }), ease: EASE.soft },
    { t: 6, pose: P({ y: -70, opacity: 100, head: -8 }), ease: EASE.in },
    { t: 16, pose: P({ y: 289, head: 2 }), ease: EASE.out },
    { t: 22, pose: P({ y: 274, head: -2 }), ease: EASE.soft },
    { t: 28, pose: P({ y: 276 }), ease: EASE.soft },

    { t: 46, pose: hold({ dy: 2, lean: 7, head: -8 }), ease: EASE.soft },
    { t: 70, pose: hold({ dy: -1, lean: 5, head: 2, armR: [-38, -43, -45] }), ease: EASE.soft },
    { t: 94, pose: hold({ dy: 2, lean: 7, head: 6, armR: [-42, -46, -48] }), ease: EASE.soft },
    { t: 118, pose: hold({ dy: -1, lean: 5, head: -3 }), ease: EASE.soft },
    { t: 142, pose: hold({ dy: 2, lean: 6, head: -9 }), ease: EASE.soft },
    { t: 166, pose: hold({ dy: -1, lean: 5, head: 0 }), ease: EASE.soft },
    { t: 184, pose: hold({ dy: 1, lean: 6, head: -5 }), ease: EASE.soft },

    { t: 192, pose: P({ y: 268, lean: 4, head: -18, armR: [-52, -60, -66] }), ease: EASE.out },
    { t: 198, pose: P({ y: 250, lean: 2, head: -22, armR: [-96, -108, -116] }), ease: EASE.snap },
    { t: 204, pose: P({ y: 150, lean: 0, head: -16, armR: [-110, -118, -120], scale: 1.14 }), ease: EASE.in },
    { t: 212, pose: P({ y: -120, scale: 1.04, head: -8, armR: [-114, -120, -122], opacity: 0 }), ease: EASE.soft },
    { t: 240, pose: P({ y: -190, opacity: 0, head: -10 }), ease: EASE.soft },
  ];
}

const strand = (d, width, opacity) =>
  group(
    [
      path(d),
      gradientStroke(
        [
          [0, "#ff5a6e", 0.9],
          [0.5, "#ffd9df", 0.35],
          [1, "#4d7bf0", 0.8],
        ],
        0,
        0,
        512,
        512,
        width,
        opacity,
      ),
    ],
    {},
  );

export function buildScene() {
  const layers = [];

  /* --- light pools ------------------------------------------------- */
  const rand = seeded(68241);
  layers.push(
    shapeLayer("glow", [
      group([glowDisc(120, 170, 190, "#ff2d4a", 22, 16)], {}),
      group([glowDisc(250, 120, 170, "#2f6df6", 14, 14)], {}),
      group([glowDisc(60, 300, 140, "#7a1c32", 12, 12)], {}),
    ]),
  );

  /* --- back strands ------------------------------------------------- */
  layers.push(
    shapeLayer("web-back", [
      strand("M -20 42 C 120 58 260 74 400 130", 1.5, 32),
      strand("M 30 -20 C 90 60 130 130 150 220", 1.2, 24),
      strand("M 532 150 C 430 170 350 200 300 260", 1.2, 22),
      strand("M -30 330 C 60 300 120 260 170 210", 1.1, 18),
    ]),
  );

  /* --- the hero ----------------------------------------------------- */
  layers.push(buildCharacter(buildTimeline(), { name: "hero" }));

  /* --- the web line -------------------------------------------------- */
  const timeline = buildTimeline();
  const lineKeys = timeline.map((key) => {
    const hand = sceneHand(key.pose, "R");
    const dx = hand[0] - ANCHOR[0];
    const dy = hand[1] - ANCHOR[1];
    const L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L;
    const ny = dx / L;
    const c1 = [ANCHOR[0] + dx / 3 + nx * 3, ANCHOR[1] + dy / 3 + ny * 3];
    const c2 = [ANCHOR[0] + (dx * 2) / 3 + nx * 3, ANCHOR[1] + (dy * 2) / 3 + ny * 3];
    const r = (p) => `${Math.round(p[0] * 10) / 10} ${Math.round(p[1] * 10) / 10}`;
    return { t: key.t, d: `M ${r(ANCHOR)} C ${r(c1)} ${r(c2)} ${r(hand)}`, ease: key.ease };
  });
  layers.push(
    shapeLayer(
      "web-line",
      [
        group([animPath(lineKeys), stroke("#ff3d55", 6, 16)], {}),
        group([animPath(lineKeys), stroke("#ffe9ee", 1.8, 90)], {}),
        group([animPath(lineKeys), stroke("#ffffff", 0.8, 95)], {}),
      ],
      {
        o: anim([
          { t: 0, v: 0, ease: EASE.soft },
          { t: 6, v: 95, ease: EASE.soft },
          { t: 204, v: 95, ease: EASE.soft },
          { t: 214, v: 0, ease: EASE.soft },
          { t: 240, v: 0 },
        ]),
      },
    ),
  );

  /* --- front strands ------------------------------------------------ */
  layers.push(
    shapeLayer("web-front", [
      strand("M -10 500 C 70 420 110 340 150 270", 1.1, 16),
      strand("M 522 420 C 440 380 380 330 340 280", 1, 14),
    ]),
  );

  /* --- motes -------------------------------------------------------- */
  const motes = Array.from({ length: 22 }, () => {
    const x = rand() * 512;
    const y = rand() * 512;
    const r = 0.8 + rand() * 1.8;
    const drift = 14 + rand() * 26;
    const dur = 130 + rand() * 70;
    return group(
      [
        ellipse([r * 2, r * 2], [0, 0]),
        fill(rand() > 0.55 ? "#ff8a9a" : "#9fc6ff", 55),
      ],
      {
        p: anim([
          { t: 0, v: [x, y, 0], ease: EASE.soft },
          { t: dur, v: [x + drift, y - drift * 1.5, 0], ease: EASE.soft },
          { t: OP, v: [x, y, 0] },
        ]),
        o: anim([
          { t: 0, v: 18, ease: EASE.soft },
          { t: dur / 2, v: 70, ease: EASE.soft },
          { t: OP, v: 18 },
        ]),
      },
    );
  });
  layers.push(shapeLayer("particles", motes));

  /* --- a small sigil in the lower right, mostly behind the avatar --- */
  const sigil =
    "M 0 -34 C 19 -34 30 -16 30 -2 C 30 22 18 35 0 35 C -18 35 -30 22 -30 -2 C -30 -16 -19 -34 0 -34 Z";
  layers.push(
    shapeLayer(
      "sigil",
      [
        group([path(sigil), stroke("#ff3d55", 2.2, 55)], {}),
        group(
          [
            path("M -22 -16 C -62 -42 -98 -62 -128 -92"),
            path("M -24 -4 C -70 -10 -112 -22 -146 -42"),
            path("M -24 8 C -70 16 -108 32 -136 58"),
            path("M -20 22 C -56 38 -86 60 -104 88"),
            path("M 22 -16 C 62 -42 98 -62 128 -92"),
            path("M 24 -4 C 70 -10 112 -22 146 -42"),
            path("M 24 8 C 70 16 108 32 136 58"),
            path("M 20 22 C 56 38 86 60 104 88"),
            stroke("#ff3d55", 7, 32),
          ],
          {},
        ),
      ],
      {
        p: still([410, 380, 0]),
        a: still([0, 0, 0]),
        s: still([72, 72, 100]),
        r: still([-12, -12, 0]),
        o: still([52, 52, 100]),
      },
    ),
  );

  return layers;
}

export function buildLottie() {
  // Lottie's layer array runs top-to-bottom; the scene is built in painter's
  // order (bottom-to-top), so it is reversed for the player.
  const layers = buildScene().reverse();
  layers.forEach((layer, index) => {
    layer.ind = index + 1;
  });
  return {
    v: "5.9.0",
    fr: 30,
    ip: 0,
    op: 240,
    w: 512,
    h: 512,
    nm: "Web Slinger — avatar",
    ddd: 0,
    assets: [],
    layers: lottieZOrder(layers),
    markers: [],
  };
}
