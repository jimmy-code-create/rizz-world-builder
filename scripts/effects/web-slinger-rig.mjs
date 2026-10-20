/**
 * The Web Slinger character rig.
 *
 * A 2D cutout rig: every limb is its own shape, parented at its joint. The
 * pose is expressed as absolute joint angles in body space, and the builder
 * converts them into the nested group rotations Lottie needs. The upper body
 * hangs off a chest joint at the pelvis, so the character can hinge forward
 * for the landing and the arms can reach the ground.
 *
 * Coordinates are in "rig space": origin at the pelvis, +x right, +y down,
 * one unit = one pixel at 100% scale. The figure is 340 units tall, so 0.9
 * draws it at ~306px.
 *
 * Art note: the character is original. It is a masked web-slinger in the
 * red-and-blue spider aesthetic, drawn from scratch as bezier paths. No
 * Marvel, Sony or Disney art, models or textures are used.
 *
 * Style: flat cutout with cross-limb gradients and rim light. The limbs have
 * no outline; the silhouette is separated from the scene by lighting instead
 * of a black stroke, which is what keeps the joints from reading as sausages.
 */

import {
  group,
  path,
  ellipse,
  fill,
  stroke,
  linearGradient,
  still,
  anim,
} from "./web-slinger-lib.mjs";

const DEG = Math.PI / 180;

/* ------------------------------------------------------------------ *
 * Skeleton
 * ------------------------------------------------------------------ */

export const J = {
  pelvis: [0, 0],
  neck: [0, -104],
  head: [0, -136],
  shoulder: { L: [-46, -92], R: [46, -92] },
  elbow: { L: [-80, -22], R: [80, -22] },
  wrist: { L: [-96, 54], R: [96, 54] },
  hip: { L: [-21, 6], R: [21, 6] },
  knee: { L: [-23, 88], R: [23, 88] },
  ankle: { L: [-23, 172], R: [23, 172] },
  toe: { L: [-5, 182], R: [41, 182] },
};

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const len = (a) => Math.hypot(a[0], a[1]);
const unit = (a) => mul(a, 1 / (len(a) || 1));
const angle = (a) => Math.atan2(a[1], a[0]) / DEG;
const dir = (deg) => [Math.cos(deg * DEG), Math.sin(deg * DEG)];
const rot = (p, deg) => {
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
};
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const normal = (a, b) => {
  const u = unit(sub(b, a));
  return [-u[1], u[0]];
};

/** Rest angles of every drawn segment, in rig space. */
export const REST = {
  armUpper: { L: angle(sub(J.elbow.L, J.shoulder.L)), R: angle(sub(J.elbow.R, J.shoulder.R)) },
  armFore: { L: angle(sub(J.wrist.L, J.elbow.L)), R: angle(sub(J.wrist.R, J.elbow.R)) },
  legThigh: { L: angle(sub(J.knee.L, J.hip.L)), R: angle(sub(J.knee.R, J.hip.R)) },
  legShin: { L: angle(sub(J.ankle.L, J.knee.L)), R: angle(sub(J.ankle.R, J.knee.R)) },
  legFoot: { L: angle(sub(J.toe.L, J.ankle.L)), R: angle(sub(J.toe.R, J.ankle.R)) },
};

/** A tapered capsule with optional bow. */
export function capsule(a, b, wa, wb, bow = 0) {
  const d = sub(b, a);
  const L = len(d) || 1;
  const u = mul(d, 1 / L);
  const n = [-u[1], u[0]];
  const mid = add(mix(a, b, 0.5), mul(n, bow));
  const wm = (wa + wb) / 2;
  const k = 0.5523;

  const side = (base, w, sgn) => add(base, mul(n, w * sgn));
  const cap = (base, w, outward) => {
    const from = side(base, w, 1);
    const to = side(base, w, -1);
    const t = add(base, mul(u, w * outward));
    return (
      `C ${from[0] + u[0] * w * k * outward} ${from[1] + u[1] * w * k * outward} ` +
      `${t[0] + n[0] * w * k} ${t[1] + n[1] * w * k} ${t[0]} ${t[1]} ` +
      `C ${t[0] - n[0] * w * k} ${t[1] - n[1] * w * k} ` +
      `${to[0] + u[0] * w * k * outward} ${to[1] + u[1] * w * k * outward} ${to[0]} ${to[1]}`
    );
  };

  const a1 = side(a, wa, 1);
  const b1 = side(b, wb, 1);
  const a2 = side(a, wa, -1);
  const mUp = add(mid, mul(n, wm));
  const mDown = add(mid, mul(n, -wm));

  return (
    `M ${a1[0]} ${a1[1]} ` +
    `Q ${mUp[0]} ${mUp[1]} ${b1[0]} ${b1[1]} ` +
    `${cap(b, wb, 1)} ` +
    `Q ${mDown[0]} ${mDown[1]} ${a2[0]} ${a2[1]} ` +
    `${cap(a, wa, -1)} Z`
  );
}

/* ------------------------------------------------------------------ *
 * Palette
 * ------------------------------------------------------------------ */

const C = {
  red: "#d71430",
  redLight: "#ff566c",
  redDeep: "#8a0a1b",
  redDark: "#4a030e",
  blue: "#1f43bb",
  blueLight: "#5b7df2",
  blueDeep: "#0d1f6b",
  blueDark: "#060d33",
  ink: "#07070d",
  rim: "#ff9aa8",
  coolRim: "#7ea8ff",
};

/* ------------------------------------------------------------------ *
 * Shading helpers
 * ------------------------------------------------------------------ */

/**
 * A limb with a gradient across its width, so it reads as a cylinder instead
 * of a flat sticker. `light` sits on the upper-left in the rest pose.
 */
function limb(a, b, wa, wb, bow, light, mid, dark) {
  const n = normal(a, b);
  const m = mix(a, b, 0.5);
  const W = Math.max(wa, wb);
  const from = add(m, mul(n, W));
  const to = add(m, mul(n, -W));
  return group(
    [
      path(capsule(a, b, wa, wb, bow)),
      linearGradient(
        [
          [0, light, 1],
          [0.38, mid, 1],
          [1, dark, 1],
        ],
        from[0],
        from[1],
        to[0],
        to[1],
      ),
    ],
    {},
  );
}

/** A thin specular strip along the lit edge of a limb. */
function sheen(a, b, wa, wb, bow, offset = 0.38) {
  const n = normal(a, b);
  const shift = (w) => mul(n, w);
  const a2 = add(add(a, shift(wa * offset)), mul(sub(b, a), 0.06));
  const b2 = add(add(b, shift(wb * offset)), mul(sub(a, b), 0.12));
  return group(
    [
      path(capsule(a2, b2, Math.max(1, wa * 0.11), Math.max(0.8, wb * 0.09), bow)),
      linearGradient(
        [
          [0, "#ffffff", 0],
          [0.5, "#ffd9de", 0.12],
          [1, "#ffffff", 0],
        ],
        a2[0] - n[0] * wa,
        a2[1] - n[1] * wa,
        a2[0] + n[0] * wa,
        a2[1] + n[1] * wa,
      ),
    ],
    {},
  );
}

/* ------------------------------------------------------------------ *
 * Emblem
 * ------------------------------------------------------------------ */

const spiderBody =
  "M 0 -6 C 10 -6 15 4 15 16 C 15 30 9 38 0 38 C -9 38 -15 30 -15 16 C -15 4 -10 -6 0 -6 Z";
const spiderHead =
  "M 0 -34 C 10 -34 16 -27 16 -19 C 16 -11 9 -6 0 -6 C -9 -6 -16 -11 -16 -19 C -16 -27 -10 -34 0 -34 Z";
const spiderLegs = [
  "M -10 -4 C -34 -20 -54 -38 -62 -64",
  "M -11 4 C -40 -2 -64 -12 -80 -30",
  "M -11 14 C -38 20 -58 34 -70 58",
  "M -9 24 C -28 40 -40 58 -48 80",
  "M 10 -4 C 34 -20 54 -38 62 -64",
  "M 11 4 C 40 -2 64 -12 80 -30",
  "M 11 14 C 38 20 58 34 70 58",
  "M 9 24 C 28 40 40 58 48 80",
];

/* ------------------------------------------------------------------ *
 * Torso
 * ------------------------------------------------------------------ */

function torsoArt() {
  const body =
    "M -26 10 C -30 -10 -36 -50 -48 -88 C -34 -98 -16 -102 0 -102 " +
    "C 16 -102 34 -98 48 -88 C 36 -50 30 -10 26 10 C 12 16 -12 16 -26 10 Z";
  return [
    // Main chest, lit from the upper left.
    group(
      [
        path(body),
        linearGradient(
          [
            [0, "#ff6a7c", 1],
            [0.34, C.red, 1],
            [0.76, C.redDeep, 1],
            [1, "#5c0612", 1],
          ],
          -40,
          -98,
          32,
          14,
        ),
      ],
      {},
    ),
    // Cool ambient on the right flank.
    group(
      [
        path("M 18 -86 C 28 -50 24 -10 20 8 C 30 -2 34 -30 38 -72 C 34 -80 26 -84 18 -86 Z"),
        linearGradient([[0, "#3a0a3a", 0], [1, "#2a0a2a", 0.35]], 16, -60, 36, 0),
      ],
      {},
    ),
    // Chest emblem: black spider with a warm rim so it separates at small sizes.
    group(
      [
        group([path(spiderBody), path(spiderHead), stroke("#ff7a8a", 2, 12), fill("#08030a", 100)], {}),
        group([...spiderLegs.map((l) => path(l)), stroke("#08030a", 5.2, 100)], {}),
        group([...spiderLegs.map((l) => path(l)), stroke("#ff7a8a", 0.9, 10)], {}),
      ],
      { p: still([0, -58, 0]), a: still([0, 0, 0]), s: still([33, 33, 100]) },
    ),
    // Pec crease.
    group(
      [path("M -27 -74 C -13 -81 13 -81 27 -74"), stroke("#5b0410", 1.4, 42)],
      {},
    ),
    // Ab seams.
    group(
      [
        path("M -15 -36 C -6 -33 6 -33 15 -36"),
        path("M -13 -20 C -5 -17 5 -17 13 -20"),
        stroke("#5b0410", 1.1, 30),
      ],
      {},
    ),
    // Belt.
    group(
      [
        path("M -27 4 C -12 12 12 12 27 4 L 26 15 C 11 21 -11 21 -26 15 Z"),
        fill("#1a0208", 100),
      ],
      {},
    ),
    group([path("M -20 9 C -8 13 8 13 20 9"), stroke("#ff4f66", 1.1, 30)], {}),
    // Neck column, then the collar over its base.
    group(
      [
        path("M -8 -84 L -7 -112 C -3 -115 3 -115 7 -112 L 8 -84 Z"),
        linearGradient([[0, "#b3152b", 1], [1, "#5c0612", 1]], -8, -106, 8, -86),
      ],
      {},
    ),
    group(
      [
        path("M -19 -96 C -9 -105 9 -105 19 -96 L 16 -86 C 6 -93 -6 -93 -16 -86 Z"),
        fill(C.redDeep, 100),
      ],
      {},
    ),
  ];
}

/** Blue briefs at the pelvis; sits at the root so it does not lean. */
function hipArt() {
  return [
    group(
      [
        path("M -26 6 C -12 15 12 15 26 6 L 22 30 C 10 37 -10 37 -22 30 Z"),
        linearGradient(
          [[0, "#2e56d6", 1], [0.55, C.blueDeep, 1], [1, "#060d33", 1]],
          -26,
          4,
          18,
          34,
        ),
      ],
      {},
    ),
    group([path("M -20 10 C -8 15 8 15 20 10"), stroke("#0a1648", 1.2, 50)], {}),
  ];
}

/* ------------------------------------------------------------------ *
 * Head
 * ------------------------------------------------------------------ */

function headArt() {
  const mask =
    "M 0 -30 C 13 -30 22 -23 24 -11 C 26 2 22 15 14 23 " +
    "C 9 28 4 30 0 30 C -4 30 -9 28 -14 23 C -22 15 -26 2 -24 -11 C -22 -23 -13 -30 0 -30 Z";
  const lensL = "M -3 -6 C -7 -10.5 -14 -12 -19 -8.5 C -21 -6 -18.5 -3 -13 -3 C -8.5 -3 -4 -3.5 -3 -6 Z";
  const lensR = "M 3 -6 C 7 -10.5 14 -12 19 -8.5 C 21 -6 18.5 -3 13 -3 C 8.5 -3 4 -3.5 3 -6 Z";
  const web = [
    "M 0 -29 L 0 -18",
    "M -22 -13 C -14 -20 -7 -25 0 -27",
    "M 22 -13 C 14 -20 7 -25 0 -27",
    "M -24 -3 C -16 -7 -8 -9 0 -10",
    "M 24 -3 C 16 -7 8 -9 0 -10",
    "M -21 8 C -13 5 13 5 21 8",
    "M -17 17 C -9 14 9 14 17 17",
    "M -10 25 C -4 23 4 23 10 25",
  ];
  return [
    group(
      [
        path(mask),
        stroke("#2a020a", 1.4, 40),
        linearGradient(
          [
            [0, "#ff6577", 1],
            [0.32, C.red, 1],
            [0.72, C.redDeep, 1],
            [1, "#50040f", 1],
          ],
          -20,
          -30,
          18,
          28,
        ),
      ],
      {},
    ),
    // Mask webbing, near-black against the red.
    group([...web.map((w) => path(w)), stroke("#25020a", 1.3, 36)], {}),
    // Brow shadow.
    group([path("M -22 -17 C -13 -24 13 -24 22 -17 C 12 -20 -12 -20 -22 -17 Z"), fill("#40030d", 100)], {}),
    // Lens rims.
    group([path(lensL), path(lensR), fill(C.ink, 100), stroke(C.ink, 2.6, 100)], {}),
    // Lens glass.
    group(
      [
        path(lensL),
        path(lensR),
        linearGradient(
          [
            [0, "#ffffff", 1],
            [0.5, "#f6fcff", 1],
            [0.82, "#dcecf8", 1],
            [1, "#a9c2d8", 1],
          ],
          -18,
          -15,
          18,
          -1,
        ),
      ],
      {},
    ),
    // Catchlights.
    group(
      [
        ellipse([6.4, 2.6], [-13.6, -9.2]),
        ellipse([6.4, 2.6], [13.6, -9.2]),
        fill("#ffffff", 100),
      ],
      {},
    ),
    // Warm rim along the crown.
    group([path("M -22 -12 C -19 -24 -10 -30 1 -30 C 13 -30 21 -24 24 -12"), stroke(C.rim, 1.6, 55)], {}),
  ];
}

/* ------------------------------------------------------------------ *
 * Arms
 * ------------------------------------------------------------------ */

function armArt(side) {
  const s = J.shoulder[side];
  const e = J.elbow[side];
  const w = J.wrist[side];
  const handDir = dir(REST.armFore[side]);
  const handTip = add(w, mul(handDir, 27));
  const cuffTop = mix(e, w, 0.78);
  const n = normal(e, w);
  const lit = side === "R";

  const gloveCuff = () => group([], {});

  return {
    upperArt: [
      limb(add(s, mul(dir(REST.armUpper[side]), 7)), add(e, mul(dir(REST.armUpper[side]), 7)), 15.5, 12, 2, lit ? "#ff6a7c" : "#c82339", lit ? C.red : "#a5122a", lit ? "#620713" : "#43040e"),
      sheen(add(s, mul(dir(REST.armUpper[side]), 8)), e, 15, 11, 2, 0.34),
    ],
    foreArt: [
      limb(e, w, 12, 8.5, 1, lit ? "#ff6274" : "#bc1c33", lit ? C.red : "#a0122a", "#5a0512"),
      gloveCuff(),
      sheen(e, w, 12, 8.5, 1, 0.34),
    ],
    handArt: [
      group(
        [
          path(capsule(w, handTip, 13, 10, 0.3)),
          linearGradient(
            [[0, "#ff7c8c", 1], [0.42, C.red, 1], [1, "#5c0612", 1]],
            w[0] - 6,
            w[1] - 6,
            handTip[0] + 6,
            handTip[1] + 6,
          ),
        ],
        {},
      ),
      group([path(`M ${w[0] - 2} ${w[1] + 8} C ${w[0] + 2} ${w[1] + 3} ${w[0] + 7} ${w[1] + 2} ${w[0] + 9} ${w[1] + 5}`), stroke("#42030e", 1.2, 55)], {}),
    ],
  };
}

/* ------------------------------------------------------------------ *
 * Legs
 * ------------------------------------------------------------------ */

function legArt(side) {
  const h = J.hip[side];
  const k = J.knee[side];
  const a = J.ankle[side];
  const t = J.toe[side];
  const lit = side === "R";
  const bootTop = mix(k, a, 0.5);
  const n = normal(k, a);

  return {
    thighArt: [
      limb(h, add(k, mul(dir(REST.legThigh[side]), 5)), 20, 14, -2, lit ? "#5b7df2" : "#2748b4", lit ? C.blue : "#1a369c", lit ? "#0b1d63" : "#081445"),
      sheen(h, k, 20, 14, -2, 0.32),
      // Quad shadow on the inside.
      group(
        [
          path(capsule(add(h, mul(n, 14)), add(k, mul(n, 10)), 4.5, 3.4, -2)),
          fill("#050b26", 35),
        ],
        {},
      ),
    ],
    shinArt: [
      limb(k, a, 14, 9.5, 2, lit ? "#4a6fe8" : "#1f3fae", lit ? "#17328f" : "#122a7a", "#060d33"),
      sheen(k, a, 14, 9.5, 2, 0.3),
      // Boot shaft, flat red with a cuff.
      group(
        [
          path(capsule(bootTop, a, 12.5, 11, 0.4)),
          linearGradient(
            [
              [0, "#ff5a6e", 1],
              [0.45, C.red, 1],
              [1, "#5c0612", 1],
            ],
            bootTop[0] - n[0] * 12,
            bootTop[1] - n[1] * 12,
            bootTop[0] + n[0] * 12,
            bootTop[1] + n[1] * 12,
          ),
        ],
        {},
      ),
      sheen(bootTop, a, 12.5, 11, 0.4, 0.32),
    ],
    footArt: [
      group(
        [
          path(capsule(a, t, 12, 9, 0.4)),
          linearGradient(
            [
              [0, "#ff6a7c", 1],
              [0.5, C.red, 1],
              [1, "#6d0817", 1],
            ],
            a[0] - 6,
            a[1] - 8,
            t[0] + 10,
            t[1] + 8,
          ),
        ],
        {},
      ),
      // Sole.
      group([path(capsule(add(a, [1, 9]), add(t, [1, 9]), 4, 3.6, 0.4)), fill("#160208", 100)], {}),
      // Toe cap.
      group([path(capsule(mix(a, t, 0.62), t, 10, 9, 0.4)), fill("#a50e22", 50)], {}),
    ],
  };
}

/* ------------------------------------------------------------------ *
 * Forward kinematics
 * ------------------------------------------------------------------ */

const ARM_LEN = {
  upper: { L: len(sub(J.elbow.L, J.shoulder.L)), R: len(sub(J.elbow.R, J.shoulder.R)) },
  fore: { L: len(sub(J.wrist.L, J.elbow.L)), R: len(sub(J.wrist.R, J.elbow.R)) },
};
const LEG_LEN = {
  thigh: { L: len(sub(J.knee.L, J.hip.L)), R: len(sub(J.knee.R, J.hip.R)) },
  shin: { L: len(sub(J.ankle.L, J.knee.L)), R: len(sub(J.ankle.R, J.knee.R)) },
};

/** The hand centre in rig space for an absolute-angle pose. */
export function handAt(pose, side) {
  const arm = pose[side === "R" ? "armR" : "armL"];
  const s = J.shoulder[side];
  const e = add(s, mul(dir(arm[0]), ARM_LEN.upper[side]));
  const w = add(e, mul(dir(arm[1]), ARM_LEN.fore[side]));
  const hand = add(w, mul(dir(arm[2]), 11));
  return rot(hand, pose.lean ?? 0);
}

/** The toe in rig space for an absolute-angle pose. */
export function toeAt(pose, side) {
  const leg = pose[side === "R" ? "legR" : "legL"];
  const h = J.hip[side];
  const k = add(h, mul(dir(leg[0]), LEG_LEN.thigh[side]));
  const a = add(k, mul(dir(leg[1]), LEG_LEN.shin[side]));
  return add(a, mul(dir(leg[2]), len(sub(J.toe[side], J.ankle[side]))));
}

/** Place the rig so a hand lands on a scene point. */
export function withHandAt(pose, side, target) {
  const p = rot(mul(handAt(pose, side), pose.scale), pose.rot);
  return { ...pose, x: target[0] - p[0], y: target[1] - p[1] };
}

/** Place the rig so a foot lands on a scene point. */
export function withToeAt(pose, side, target) {
  const p = rot(mul(toeAt(pose, side), pose.scale), pose.rot);
  return { ...pose, x: target[0] - p[0], y: target[1] - p[1] };
}

/** The scene-space position of a hand for a placed pose. */
export function sceneHand(pose, side = "R") {
  const p = rot(mul(handAt(pose, side), pose.scale), pose.rot);
  return [pose.x + p[0], pose.y + p[1]];
}

/** The scene-space position of a foot for a placed pose. */
export function sceneToe(pose, side = "R") {
  const p = rot(mul(toeAt(pose, side), pose.scale), pose.rot);
  return [pose.x + p[0], pose.y + p[1]];
}

/* ------------------------------------------------------------------ *
 * Builder
 * ------------------------------------------------------------------ */

/**
 * Turn a pose timeline into one Lottie shape layer.
 *
 * `timeline` is `[{ t, ease?, pose }]`. Pose angles are absolute in body
 * space; the builder converts them to the relative rotations Lottie's nested
 * groups need.
 */
export function buildCharacter(timeline, { name = "hero" } = {}) {
  const keys = (get) =>
    anim(timeline.map((k) => ({ t: k.t, v: get(k.pose), ease: k.ease })));

  const armNode = (side) => {
    const { upperArt, foreArt, handArt } = armArt(side);
    const s = J.shoulder[side];
    const e = J.elbow[side];
    const w = J.wrist[side];
    const ang = (p) => (side === "R" ? p.armR : p.armL);
    const upperRel = (p) => ang(p)[0] - REST.armUpper[side];
    const foreRel = (p) => ang(p)[1] - REST.armFore[side] - upperRel(p);
    const handRel = (p) => ang(p)[2] - REST.armFore[side] - upperRel(p) - foreRel(p);

    return group(
      [
        ...upperArt,
        group(
          [
            ...foreArt,
            group([...handArt], {
              p: still([w[0], w[1], 0]),
              a: still([w[0], w[1], 0]),
              r: keys(handRel),
            }),
          ],
          { p: still([e[0], e[1], 0]), a: still([e[0], e[1], 0]), r: keys(foreRel) },
        ),
      ],
      { p: still([s[0], s[1], 0]), a: still([s[0], s[1], 0]), r: keys(upperRel) },
    );
  };

  const legNode = (side) => {
    const { thighArt, shinArt, footArt } = legArt(side);
    const h = J.hip[side];
    const k = J.knee[side];
    const a = J.ankle[side];
    const ang = (p) => (side === "R" ? p.legR : p.legL);
    const thighRel = (p) => ang(p)[0] - REST.legThigh[side];
    const shinRel = (p) => ang(p)[1] - REST.legShin[side] - thighRel(p);
    const footRel = (p) => ang(p)[2] - REST.legFoot[side] - thighRel(p) - shinRel(p);

    return group(
      [
        ...thighArt,
        group(
          [
            ...shinArt,
            group([...footArt], {
              p: still([a[0], a[1], 0]),
              a: still([a[0], a[1], 0]),
              r: keys(footRel),
            }),
          ],
          { p: still([k[0], k[1], 0]), a: still([k[0], k[1], 0]), r: keys(shinRel) },
        ),
      ],
      { p: still([h[0], h[1], 0]), a: still([h[0], h[1], 0]), r: keys(thighRel) },
    );
  };

  const headNode = group(
    [group([...headArt()], { p: still([J.head[0], J.head[1], 0]), a: still([0, 0, 0]) })],
    {
      p: still([J.head[0], J.head[1], 0]),
      a: still([J.head[0], J.head[1], 0]),
      r: keys((p) => p.head ?? 0),
    },
  );

  // The upper body hinges at the pelvis so the landing can fold forward and
  // the fist can reach the roof.
  const chest = group(
    [armNode("L"), group(torsoArt(), {}), headNode, armNode("R")],
    { p: still([0, 0, 0]), a: still([0, 0, 0]), r: keys((p) => p.lean ?? 0) },
  );

  return {
    ind: 1,
    ty: 4,
    nm: name,
    sr: 1,
    ks: {
      o: keys((p) => p.opacity ?? 100),
      r: keys((p) => p.rot),
      p: keys((p) => [p.x, p.y, 0]),
      a: still([0, 0, 0]),
      s: keys((p) => [p.scale * 100, p.scale * 100, 100]),
    },
    ao: 0,
    shapes: [
      group([legNode("L"), legNode("R"), group(hipArt(), {}), chest], {}),
    ],
    ip: 0,
    op: 240,
    st: 0,
    bm: 0,
  };
}
