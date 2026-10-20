/**
 * The Web Slinger banner scene.
 *
 * A 1200x420 cinematic loop built for the profile banner, where there is room
 * for the whole figure. The square avatar decoration keeps its own scene.
 *
 * Timeline (30fps, 240 frames):
 *
 *   0-24    a distant figure hangs off the top-right corner
 *   24-72   swings down across the sky on a solved pendulum, camera pushing in
 *   72-96   releases, tucks and rotates through a full aerial flip
 *   96-112  lands in a crouch on the roof, web and dust burst outward
 *   112-188 holds the perch; breathing and a slow scan
 *   188-222 shoots a line and zips out of frame
 *   222-240 empty roof, so the loop point is invisible
 *
 * The character is original art, drawn from scratch. No Marvel, Sony or
 * Disney assets are used.
 */

import {
  group,
  path,
  ellipse,
  fill,
  stroke,
  linearGradient,
  gradientStroke,
  still,
  anim,
  animPath,
  trim,
  shapeLayer,
  lottieZOrder,
} from "./web-slinger-lib.mjs";
import {
  buildCharacter,
  withHandAt,
  withToeAt,
  sceneHand,
} from "./web-slinger-rig.mjs";
import {
  hangPose,
  tuckPose,
  landingPose,
  perchPose,
} from "./web-slinger-motion.mjs";

export const W = 1200;
export const H = 420;
export const FR = 30;
export const OP = 240;

const DEG = Math.PI / 180;
const ANCHOR = [1080, -240];
const ROPE = 340;
const LANDING = [470, 380];
const LEDGE_Y = 382;

const arcPoint = (deg) => [
  ANCHOR[0] + Math.sin(deg * DEG) * ROPE,
  ANCHOR[1] + Math.cos(deg * DEG) * ROPE,
];

const EASE = {
  in: { i: { x: [0.35], y: [1] }, o: { x: [0.65], y: [0] } },
  out: { i: { x: [0.16], y: [1] }, o: { x: [0.3], y: [0] } },
  soft: { i: { x: [0.42], y: [1] }, o: { x: [0.58], y: [0] } },
  snap: { i: { x: [0.1], y: [1] }, o: { x: [0.3], y: [0] } },
};

/* ------------------------------------------------------------------ *
 * Motion
 * ------------------------------------------------------------------ */

function swing(angle, lag, over) {
  const pose = hangPose({
    rot: angle + lag,
    armR: [-88, -92, -95],
    armL: [146 + angle * 0.2, 160, 155],
    legR: [72 + angle * 0.22, 94, 48],
    legL: [100 + angle * 0.18, 118, 60],
    ...over,
  });
  return withHandAt(pose, "R", arcPoint(angle));
}

const planted = (pose) => withToeAt(pose, "R", LANDING);

export function buildBannerTimeline() {
  return [
    { t: 0, pose: swing(44, 0, { scale: 0.45, opacity: 0 }), ease: EASE.soft },
    { t: 12, pose: swing(44, 2, { scale: 0.45, opacity: 100 }), ease: EASE.soft },
    { t: 24, pose: swing(41, 3, { scale: 0.48 }), ease: EASE.in },

    { t: 36, pose: swing(25, 4, { scale: 0.55 }), ease: EASE.in },
    { t: 48, pose: swing(5, 3, { scale: 0.61 }), ease: EASE.soft },
    { t: 58, pose: swing(-20, 1, { scale: 0.68 }), ease: EASE.soft },
    { t: 66, pose: swing(-38, -1, { scale: 0.74 }), ease: EASE.soft },
    { t: 72, pose: swing(-54, -3, { scale: 0.8 }), ease: EASE.out },

    { t: 78, pose: tuckPose({ rot: 35, x: 742, y: 196, scale: 0.82 }), ease: EASE.in },
    { t: 84, pose: tuckPose({ rot: 150, x: 660, y: 252, scale: 0.85 }), ease: EASE.soft },
    { t: 90, pose: tuckPose({ rot: 268, x: 566, y: 308, scale: 0.88 }), ease: EASE.in },
    { t: 96, pose: planted(landingPose({ rot: 360, scale: 0.9 })), ease: EASE.out },
    { t: 101, pose: planted(landingPose({ rot: 360, head: -30, scale: 0.895 })), ease: EASE.soft },
    { t: 112, pose: planted(perchPose({ rot: 360, scale: 0.9 })), ease: EASE.soft },

    { t: 132, pose: planted(perchPose({ rot: 360, head: -13, scale: 0.905 })), ease: EASE.soft },
    { t: 154, pose: planted(perchPose({ rot: 360, head: -22, scale: 0.9 })), ease: EASE.soft },
    { t: 176, pose: planted(perchPose({ rot: 360, head: -11, scale: 0.9 })), ease: EASE.soft },
    { t: 188, pose: planted(perchPose({ rot: 360, head: -8 })), ease: EASE.soft },

    {
      t: 196,
      pose: planted(
        perchPose({
          rot: 360,
          lean: 8,
          head: -24,
          armR: [-40, -62, -80],
          armL: [118, 96, 92],
          legR: [48, 120, 72],
        }),
      ),
      ease: EASE.out,
    },
    {
      t: 200,
      pose: planted(
        perchPose({
          rot: 366,
          lean: 4,
          head: -30,
          armR: [-96, -108, -118],
          armL: [130, 110, 104],
          legR: [44, 112, 68],
        }),
      ),
      ease: EASE.snap,
    },
    {
      t: 206,
      pose: {
        ...perchPose({}),
        rot: 382,
        lean: 0,
        x: 790,
        y: 130,
        scale: 0.72,
        head: -10,
        armR: [-112, -118, -120],
        armL: [140, 120, 116],
        legR: [66, 104, 40],
        legL: [84, 118, 52],
      },
      ease: EASE.in,
    },
    {
      t: 214,
      pose: {
        ...perchPose({}),
        rot: 392,
        x: 1010,
        y: -30,
        scale: 0.56,
        armR: [-116, -120, -122],
        armL: [150, 130, 126],
        legR: [74, 96, 34],
        legL: [92, 110, 44],
      },
      ease: EASE.in,
    },
    {
      t: 222,
      pose: {
        ...perchPose({}),
        rot: 396,
        x: 1090,
        y: -110,
        scale: 0.5,
        opacity: 0,
        armR: [-116, -120, -122],
        armL: [150, 130, 126],
        legR: [74, 96, 34],
        legL: [92, 110, 44],
      },
      ease: EASE.soft,
    },
    { t: 240, pose: swing(44, 0, { scale: 0.45, opacity: 0 }), ease: EASE.soft },
  ];
}

const linePath = (from, to, bow = 0) => {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L;
  const ny = dx / L;
  const c1 = [from[0] + dx / 3 + nx * bow, from[1] + dy / 3 + ny * bow];
  const c2 = [from[0] + (dx * 2) / 3 + nx * bow, from[1] + (dy * 2) / 3 + ny * bow];
  const r = (p) => `${Math.round(p[0] * 10) / 10} ${Math.round(p[1] * 10) / 10}`;
  return `M ${r(from)} C ${r(c1)} ${r(c2)} ${r(to)}`;
};

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** A soft disc built from stacked flat rings — no blur, plays anywhere. */
function glowDisc(cx, cy, radius, colour, opacity, rings = 16) {
  const items = [];
  for (let i = rings; i >= 1; i -= 1) {
    const k = i / rings;
    items.push(group([ellipse([radius * 2 * k, radius * 2 * k], [cx, cy]), fill(colour, opacity / rings)], {}));
  }
  return group(items, {});
}

function vignette() {
  return shapeLayer("grade", [
    group(
      [
        path(`M 0 0 H ${W} V 120 H 0 Z`),
        linearGradient([[0, "#000000", 0.46], [1, "#000000", 0]], 0, 0, 0, 120),
      ],
      {},
    ),
    group(
      [
        path(`M 0 ${H - 130} H ${W} V ${H} H 0 Z`),
        linearGradient([[0, "#000000", 0], [1, "#000000", 0.52]], 0, H - 130, 0, H),
      ],
      {},
    ),
    group(
      [
        path(`M 0 0 H 150 V ${H} H 0 Z`),
        linearGradient([[0, "#000000", 0.55], [1, "#000000", 0]], 0, 0, 150, 0),
      ],
      {},
    ),
    group(
      [
        path(`M ${W - 170} 0 H ${W} V ${H} H ${W - 170} Z`),
        linearGradient([[0, "#000000", 0], [1, "#000000", 0.48]], W - 170, 0, W, 0),
      ],
      {},
    ),
  ]);
}

/* ------------------------------------------------------------------ *
 * Scene
 * ------------------------------------------------------------------ */

export function buildBannerScene() {
  const layers = [];
  const push = (layer) => layers.push(layer);

  /* --- sky ---------------------------------------------------------- */
  const rand = seeded(20261020);
  const stars = Array.from({ length: 34 }, () => {
    const x = rand() * W;
    const y = rand() * 280;
    const r = 0.6 + rand() * 1.4;
    const o = 12 + rand() * 34;
    return group([ellipse([r * 2, r * 2], [x, y]), fill("#dfe8ff", o)], {});
  });

  push(
    shapeLayer("sky", [
      group(
        [
          path(`M 0 0 H ${W} V ${H} H 0 Z`),
          linearGradient(
            [
              [0, "#04050d", 1],
              [0.5, "#0a0c1d", 1],
              [0.78, "#1a0b18", 1],
              [1, "#2a0b14", 1],
            ],
            0,
            0,
            0,
            H,
          ),
        ],
        {},
      ),
      glowDisc(1000, 320, 300, "#ff2d4a", 30, 18),
      glowDisc(1090, 90, 220, "#ff3d55", 14, 14),
      group(stars, {}),
      // A thin red horizon light behind the city.
      group(
        [
          path(`M 0 300 H ${W} V ${H} H 0 Z`),
          linearGradient([[0, "#ff2d4a", 0], [0.6, "#ff3d55", 0.1], [1, "#ff6b3d", 0.2]], 0, 300, 0, H),
        ],
        {},
      ),
    ]),
  );

  /* --- skyline ------------------------------------------------------ */
  const buildings = [];
  let x = -30;
  let i = 0;
  while (x < W + 40) {
    const w = 34 + rand() * 56;
    const h = 24 + rand() * 104;
    const top = H - h;
    buildings.push(
      group(
        [
          path(`M ${x} ${top} L ${x + w} ${top} L ${x + w} ${H} L ${x} ${H} Z`),
          linearGradient(
            [[0, "#0a0f20", 1], [1, "#05070f", 1]],
            x,
            top,
            x,
            H,
          ),
        ],
        {},
      ),
    );
    // Roof rim.
    buildings.push(group([path(`M ${x} ${top} L ${x + w} ${top}`), stroke("#3d5f96", 1.4, 65)], {}));
    // Lit windows, sparse.
    const cols = Math.max(2, Math.floor(w / 16));
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < 3; r += 1) {
        if (rand() > 0.42) continue;
        const wx = x + 7 + c * (w - 14) / cols;
        const wy = top + 14 + r * 16;
        if (wy > H - 10) continue;
        buildings.push(
          group([path(`M ${wx} ${wy} h 4 v 6 h -4 Z`), fill(i % 3 === 0 ? "#ffb066" : "#7fb4ff", 42)], {}),
        );
      }
    }
    x += w + 3 + rand() * 8;
    i += 1;
  }
  push(shapeLayer("skyline", buildings));

  /* --- drifting haze ----------------------------------------------- */
  const puff = (cx, cy, r, colour, opacity, drift = 26) =>
    group(
      [glowDisc(0, 0, r, colour, opacity, 10)],
      {
        p: anim([
          { t: 0, v: [cx, cy, 0], ease: EASE.soft },
          { t: OP / 2, v: [cx + drift, cy - drift * 0.5, 0], ease: EASE.soft },
          { t: OP, v: [cx, cy, 0] },
        ]),
      },
    );
  push(
    shapeLayer("haze", [
      puff(220, 260, 150, "#25418c", 9),
      puff(430, 230, 110, "#3a1a5c", 8),
      puff(690, 170, 130, "#7a1c32", 8),
      puff(900, 260, 160, "#8a2030", 9),
      puff(1080, 340, 170, "#ff3d55", 10),
      puff(140, 360, 120, "#1b3268", 8),
      puff(560, 330, 150, "#2a1a52", 7),
    ]),
  );

  /* --- spider sigil behind the landing ----------------------------- */
  const sigil =
    "M 0 -46 C 26 -46 40 -22 40 -2 C 40 30 24 48 0 48 C -24 48 -40 30 -40 -2 C -40 -22 -26 -46 0 -46 Z";
  const sigilLegs = [
    "M -30 -22 C -90 -60 -150 -86 -196 -136",
    "M -34 -6 C -104 -16 -172 -34 -226 -70",
    "M -36 10 C -106 22 -170 48 -214 92",
    "M -30 30 C -86 54 -132 88 -162 132",
    "M 30 -22 C 90 -60 150 -86 196 -136",
    "M 34 -6 C 104 -16 172 -34 226 -70",
    "M 36 10 C 106 22 170 48 214 92",
    "M 30 30 C 86 54 132 88 162 132",
  ];
  push(
    shapeLayer(
      "emblem",
      [
        group(
          [
            group([path(sigil), fill("#ff3d55", 26)], {}),
            group([...sigilLegs.map((d) => path(d)), stroke("#ff3d55", 13, 22)], {}),
          ],
          {},
        ),
      ],
      {
        p: still([880, 246, 0]),
        a: still([0, 0, 0]),
        s: anim([
          { t: 0, v: [64, 64, 100], ease: EASE.soft },
          { t: 96, v: [70, 70, 100], ease: EASE.out },
          { t: 118, v: [78, 78, 100], ease: EASE.soft },
          { t: 190, v: [72, 72, 100], ease: EASE.soft },
          { t: 240, v: [64, 64, 100] },
        ]),
        r: anim([
          { t: 0, v: -4, ease: EASE.soft },
          { t: 120, v: 3, ease: EASE.soft },
          { t: 240, v: -4 },
        ]),
        o: anim([
          { t: 0, v: 42, ease: EASE.soft },
          { t: 84, v: 38, ease: EASE.out },
          { t: 100, v: 64, ease: EASE.soft },
          { t: 130, v: 44, ease: EASE.soft },
          { t: 210, v: 38, ease: EASE.soft },
          { t: 240, v: 42 },
        ]),
      },
    ),
  );

  /* --- back strands ------------------------------------------------- */
  const strand = (d, width, opacity) =>
    group([path(d), gradientStroke([[0, "#ff5a6e", 0.9], [0.5, "#ffd9df", 0.35], [1, "#4d7bf0", 0.8]], 0, 0, W, H, width, opacity)], {});
  push(
    shapeLayer("web-back", [
      strand("M -20 40 C 180 90 320 140 460 220", 1.6, 30),
      strand(`M ${W + 20} 60 C 1020 90 900 140 820 210`, 1.4, 26),
      strand(`M ${W + 20} 250 C 1000 260 900 280 820 320`, 1.2, 20),
      strand("M 40 420 C 120 340 190 280 300 250", 1.2, 18),
    ]),
  );

  /* --- the roof ----------------------------------------------------- */
  push(
    shapeLayer("ledge", [
      group(
        [
          path(`M 0 ${LEDGE_Y} H 780 L 880 ${LEDGE_Y + 16} L 880 ${H} H 0 Z`),
          linearGradient(
            [
              [0, "#0a0d16", 1],
              [0.72, "#0a0d16", 1],
              [1, "#0a0d16", 0],
            ],
            0,
            LEDGE_Y,
            900,
            LEDGE_Y,
          ),
        ],
        {},
      ),
      group(
        [
          path(`M 0 ${LEDGE_Y} H 780 L 880 ${LEDGE_Y + 16} L 880 ${LEDGE_Y + 26} L 0 ${LEDGE_Y + 12} Z`),
          linearGradient([[0, "#2a3a58", 0.95], [0.7, "#1b2740", 0.9], [1, "#141b30", 0]], 0, LEDGE_Y, 900, LEDGE_Y),
        ],
        {},
      ),
      group(
        [
          path(`M 0 ${LEDGE_Y} H 780`),
          linearGradient([[0, "#ff5a6e", 0.5], [0.55, "#ff9aa8", 0.7], [1, "#ff5a6e", 0]], 0, 0, 820, 0),
        ],
        {},
      ),
      group(
        [
          path(`M 0 ${LEDGE_Y + 18} H 812`),
          linearGradient([[0, "#1b2b4a", 55], [1, "#1b2b4a", 0]], 0, 0, 840, 0),
        ],
        {},
      ),
      // Brick seams.
      group(
        [
          ...Array.from({ length: 9 }, (_, n) => path(`M ${40 + n * 92} ${LEDGE_Y + 2} V ${H}`)),
          stroke("#1b2540", 1, 22),
        ],
        {},
      ),
      group(
        [
          ...Array.from({ length: 3 }, (_, n) => path(`M 0 ${LEDGE_Y + 22 + n * 14} H 830`)),
          stroke("#141b30", 1, 30),
        ],
        {},
      ),
    ]),
  );

  /* --- the hero ----------------------------------------------------- */
  const timeline = buildBannerTimeline();
  const hero = buildCharacter(timeline, { name: "hero" });
  push(hero);

  /* --- web line ----------------------------------------------------- */
  const swingKeys = timeline
    .filter((k) => k.t <= 72)
    .map((k) => ({ t: k.t, d: linePath(ANCHOR, sceneHand(k.pose), k.t < 30 ? 3 : 0.5), ease: k.ease }));
  const webOpacity = anim([
    { t: 0, v: 0, ease: EASE.soft },
    { t: 10, v: 95, ease: EASE.soft },
    { t: 68, v: 95, ease: EASE.out },
    { t: 76, v: 0, ease: EASE.soft },
    { t: OP, v: 0 },
  ]);
  push(
    shapeLayer(
      "web-line",
      [
        group([animPath(swingKeys), stroke("#ff3d55", 7, 16)], {}),
        group([animPath(swingKeys), stroke("#ffe9ee", 2, 90)], {}),
        group([animPath(swingKeys), stroke("#ffffff", 0.9, 95)], {}),
      ],
      { o: webOpacity },
    ),
  );

  /* --- impact ------------------------------------------------------- */
  const burst = Array.from({ length: 11 }, (_, n) => {
    const a = (n / 11) * Math.PI * 2 + 0.2;
    const r1 = 14 + (n % 3) * 5;
    const r2 = 40 + (n % 4) * 8;
    return `M ${Math.cos(a) * r1} ${Math.sin(a) * r1} L ${Math.cos(a) * r2} ${Math.sin(a) * r2}`;
  });
  push(
    shapeLayer(
      "impact",
      [
        group(
          [
            ellipse([60, 60], [0, 0]),
            stroke("#ffd9df", 2.4, 100),
          ],
          {
            p: still([LANDING[0], LANDING[1], 0]),
            a: still([0, 0, 0]),
            s: anim([
              { t: 90, v: [10, 10, 100], ease: EASE.out },
              { t: 96, v: [100, 30, 100], ease: EASE.out },
              { t: 112, v: [230, 60, 100], ease: EASE.soft },
            ]),
            o: anim([
              { t: 90, v: 0 },
              { t: 95, v: 55 },
              { t: 108, v: 0 },
              { t: OP, v: 0 },
            ]),
          },
        ),
        group(
          [
            ...burst.map((d) => path(d)),
            stroke("#ffd9df", 1.8, 80),
          ],
          {
            p: still([0, 0, 0]),
            a: still([0, 0, 0]),
            s: anim([
              { t: 92, v: [40, 40, 100], ease: EASE.out },
              { t: 104, v: [100, 100, 100], ease: EASE.soft },
              { t: 114, v: [120, 120, 100] },
            ]),
            o: anim([
              { t: 92, v: 0 },
              { t: 96, v: 80 },
              { t: 112, v: 0 },
              { t: OP, v: 0 },
            ]),
          },
        ),
      ],
      { p: still([LANDING[0], LANDING[1], 0]), a: still([LANDING[0], LANDING[1], 0]) },
    ),
  );

  /* --- dust burst --------------------------------------------------- */
  const dustRand = seeded(77123);
  const dust = Array.from({ length: 14 }, () => {
    const a = (0.15 + dustRand() * 0.7) * Math.PI;
    const r = 40 + dustRand() * 130;
    const dx = Math.cos(a) * r;
    const dy = -Math.sin(a) * r * 0.5;
    const size = 1.4 + dustRand() * 2.6;
    return group(
      [
        ellipse([size * 2, size * 2], [0, 0]),
        fill(dustRand() > 0.5 ? "#ffb8a0" : "#c8d8ff", 60),
      ],
      {
        p: anim([
          { t: 94, v: [LANDING[0], LANDING[1], 0], ease: EASE.out },
          { t: 104, v: [LANDING[0] + dx, LANDING[1] + dy, 0], ease: EASE.soft },
          { t: 124, v: [LANDING[0] + dx * 1.25, LANDING[1] + dy - 22, 0], ease: EASE.soft },
        ]),
        o: anim([
          { t: 94, v: 0 },
          { t: 97, v: 80 },
          { t: 118, v: 0 },
          { t: OP, v: 0 },
        ]),
      },
    );
  });
  push(shapeLayer("dust", dust));

  /* --- speed streaks ------------------------------------------------ */
  const streak = (d, delay, length) =>
    group(
      [
        path(d),
        stroke("#ffd9df", 1.4, 70),
        trim(
          0,
          anim([
            { t: 25 + delay, v: 0, ease: EASE.in },
            { t: 42 + delay, v: length * 0.4, ease: EASE.soft },
            { t: 70 + delay, v: 0.98, ease: EASE.soft },
          ]),
        ),
      ],
      {
        o: anim([
          { t: 25 + delay, v: 0 },
          { t: 36 + delay, v: 45 },
          { t: 70, v: 30 },
          { t: 80, v: 0 },
          { t: OP, v: 0 },
        ]),
      },
    );
  push(
    shapeLayer("speed", [
      streak("M 1330 120 C 1160 210 980 280 760 330", 0, 1),
      streak("M 1310 60 C 1150 160 1000 230 840 280", 6, 1),
      streak("M 1340 200 C 1170 270 1010 320 830 356", 12, 1),
    ]),
  );

  /* --- foreground web strands -------------------------------------- */
  push(
    shapeLayer("web-front", [
      strand("M -10 400 C 120 350 210 290 300 200", 1.3, 22),
      strand(`M ${W + 10} 420 C 1080 370 1000 320 930 260`, 1.2, 18),
      strand("M 0 200 C 90 220 160 250 230 300", 1, 14),
    ]),
  );

  /* --- motes -------------------------------------------------------- */
  const moteRand = seeded(55119);
  const motes = Array.from({ length: 26 }, () => {
    const x = moteRand() * W;
    const y = 120 + moteRand() * 280;
    const r = 0.8 + moteRand() * 2;
    const drift = 16 + moteRand() * 30;
    const dur = 120 + moteRand() * 80;
    return group(
      [
        ellipse([r * 2, r * 2], [0, 0]),
        fill(moteRand() > 0.6 ? "#ff8a9a" : "#9fc6ff", 55),
      ],
      {
        p: anim([
          { t: 0, v: [x, y, 0], ease: EASE.soft },
          { t: dur, v: [x + drift, y - drift * 1.6, 0], ease: EASE.soft },
          { t: OP, v: [x, y, 0] },
        ]),
        o: anim([
          { t: 0, v: 20, ease: EASE.soft },
          { t: dur / 2, v: 65, ease: EASE.soft },
          { t: OP, v: 20 },
        ]),
      },
    );
  });
  push(shapeLayer("particles", motes));

  /* --- bokeh -------------------------------------------------------- */

  push(vignette());

  return { layers, timeline };
}

/* ------------------------------------------------------------------ *
 * Lottie
 * ------------------------------------------------------------------ */

export function buildBannerLottie() {
  const { layers } = buildBannerScene();
  // Lottie's layer array runs top-to-bottom; the scene is built in painter's
  // order (bottom-to-top), so it is reversed for the player.
  layers.reverse();
  layers.forEach((layer, index) => {
    layer.ind = index + 1;
  });
  return {
    v: "5.9.0",
    fr: FR,
    ip: 0,
    op: OP,
    w: W,
    h: H,
    nm: "Web Slinger — banner",
    ddd: 0,
    assets: [],
    layers: lottieZOrder(layers),
    markers: [],
  };
}
