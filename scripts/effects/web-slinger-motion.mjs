/**
 * The Web Slinger motion.
 *
 * One loop, 8 seconds at 30fps:
 *
 *   hang in the dark just off the top-right corner
 *   swing down across the top of the frame on a taut web line
 *   release at the top of the arc, tuck and rotate through the air
 *   land in a crouch on the left shoulder of the avatar
 *   hold the perch, breathe, scan
 *   shoot a line back up and zip out
 *   hold the empty stage, so the loop restarts invisibly
 *
 * The swing is solved, not eyeballed: the hand follows a real pendulum and
 * the root position is back-solved from it, so the web line is always exactly
 * attached. Joint angles are absolute in body space; the rig converts them to
 * nested Lottie rotations.
 */

import { withHandAt, withToeAt, sceneHand } from "./web-slinger-rig.mjs";

const DEG = Math.PI / 180;

/** The web anchor, above the top-right corner of the scene. */
export const ANCHOR = [470, -96];
/** Rope length from the anchor to the hand. */
export const ROPE = 212;

/** The hand position on the pendulum, in scene space. */
export function handOnArc(angle) {
  return [ANCHOR[0] + Math.sin(angle * DEG) * ROPE, ANCHOR[1] + Math.cos(angle * DEG) * ROPE];
}

/** Where the feet land: on the left shoulder of the avatar disc. */
export const LANDING = [150, 332];

const BASE = {
  x: 256,
  y: 256,
  rot: 0,
  lean: 0,
  scale: 0.58,
  opacity: 100,
  head: 0,
  armL: [119, 110, 110],
  armR: [61, 70, 70],
  legL: [92, 90, 29],
  legR: [89, 90, 32],
};

const P = (over) => ({ ...BASE, ...over });

/** Hang from the right hand: arm toward the line, legs loose. */
export const hangPose = (over) =>
  P({
    armR: [-88, -92, -95],
    armL: [146, 160, 155],
    legR: [64, 100, 44],
    legL: [78, 118, 58],
    head: -6,
    ...over,
  });

/**
 * The swing, sampled along the pendulum. Body rotation follows the rope with
 * a little lag, and the trailing limbs lag a little more.
 */
function swing(angle, lag, over) {
  const pose = hang({
    rot: angle + lag,
    armR: [-88, -92, -95],
    armL: [140 + angle * 0.3, 155 + angle * 0.2, 150],
    legR: [64 + angle * 0.22, 100, 44],
    legL: [78 + angle * 0.18, 118, 58],
    ...over,
  });
  return withHandAt(pose, "R", handOnArc(angle));
}

/** Tuck for the aerial rotation. */
export const tuckPose = (over) =>
  P({
    legR: [16, 150, 118],
    legL: [30, 158, 128],
    armR: [-26, -34, -18],
    armL: [44, 34, 42],
    head: 16,
    lean: 14,
    ...over,
  });

const tuck = tuckPose;
const hang = hangPose;

/** Landing: compact crouch, front knee up, fist braced on it. */
export const landingPose = (over) =>
  P({
    lean: 38,
    legR: [10, 130, 40],
    legL: [45, 168, 130],
    armR: [30, 20, 22],
    armL: [135, 118, 110],
    head: -34,
    ...over,
  });

/** The perch he holds for the hero beat. */
export const perchPose = (over) =>
  P({
    lean: 24,
    legR: [12, 126, 46],
    legL: [50, 164, 130],
    armR: [46, 70, 74],
    armL: [116, 104, 100],
    head: -26,
    ...over,
  });

const landing = landingPose;
const perch = perchPose;

/** Place the landed poses by the planted front foot. */
const planted = (pose) => withToeAt(pose, "R", LANDING);

const EASE = {
  in: { i: { x: [0.35], y: [1] }, o: { x: [0.65], y: [0] } },
  out: { i: { x: [0.16], y: [1] }, o: { x: [0.3], y: [0] } },
  soft: { i: { x: [0.42], y: [1] }, o: { x: [0.58], y: [0] } },
  snap: { i: { x: [0.1], y: [1] }, o: { x: [0.3], y: [0] } },
};

/** Build the pose timeline. */
export function buildTimeline() {
  return [
    { t: 0, pose: swing(44, 0, { scale: 0.3, opacity: 0 }), ease: EASE.soft },
    { t: 12, pose: swing(44, 2, { scale: 0.3, opacity: 100 }), ease: EASE.soft },
    { t: 24, pose: swing(43, 3, { scale: 0.31 }), ease: EASE.in },

    { t: 36, pose: swing(26, 3, { scale: 0.38 }), ease: EASE.in },
    { t: 48, pose: swing(6, 2, { scale: 0.46 }), ease: EASE.soft },
    { t: 58, pose: swing(-16, 0, { scale: 0.52 }), ease: EASE.soft },
    { t: 66, pose: swing(-36, -2, { scale: 0.56 }), ease: EASE.soft },

    { t: 72, pose: swing(-52, -4, { scale: 0.57 }), ease: EASE.out },
    { t: 78, pose: tuck({ rot: 24, x: 296, y: 150, scale: 0.58 }), ease: EASE.in },
    { t: 84, pose: tuck({ rot: 132, x: 244, y: 198, scale: 0.58 }), ease: EASE.soft },
    { t: 90, pose: tuck({ rot: 250, x: 186, y: 246, scale: 0.58 }), ease: EASE.in },
    { t: 96, pose: planted(landing({ rot: 360, head: -46 })), ease: EASE.out },
    { t: 101, pose: planted(landing({ rot: 360, head: -50, scale: 0.575 })), ease: EASE.soft },
    { t: 112, pose: planted(perch({ rot: 360 })), ease: EASE.soft },

    { t: 132, pose: planted(perch({ rot: 360, head: -11, scale: 0.585 })), ease: EASE.soft },
    { t: 154, pose: planted(perch({ rot: 360, head: -18, scale: 0.582 })), ease: EASE.soft },
    { t: 176, pose: planted(perch({ rot: 360, head: -9, scale: 0.58 })), ease: EASE.soft },
    { t: 188, pose: planted(perch({ rot: 360, head: -6 })), ease: EASE.soft },

    {
      t: 196,
      pose: planted(
        perch({
          rot: 360,
          lean: 8,
          head: -22,
          armR: [-40, -62, -80],
          armL: [118, 136, 142],
          legR: [58, 132, 78],
        }),
      ),
      ease: EASE.out,
    },
    {
      t: 200,
      pose: planted(
        perch({
          rot: 366,
          lean: 4,
          head: -28,
          armR: [-96, -108, -118],
          armL: [130, 150, 158],
          legR: [52, 120, 70],
        }),
      ),
      ease: EASE.snap,
    },
    {
      t: 206,
      pose: P({
        rot: 382,
        lean: 0,
        x: 296,
        y: 70,
        scale: 0.5,
        head: -8,
        armR: [-112, -118, -120],
        armL: [140, 162, 168],
        legR: [66, 104, 40],
        legL: [84, 118, 52],
      }),
      ease: EASE.in,
    },
    {
      t: 214,
      pose: P({
        rot: 392,
        x: 408,
        y: -64,
        scale: 0.42,
        armR: [-116, -120, -122],
        armL: [150, 168, 172],
        legR: [74, 96, 34],
        legL: [92, 110, 44],
      }),
      ease: EASE.in,
    },
    {
      t: 222,
      pose: P({
        rot: 396,
        x: 452,
        y: -120,
        scale: 0.38,
        opacity: 0,
        armR: [-116, -120, -122],
        armL: [150, 168, 172],
        legR: [74, 96, 34],
        legL: [92, 110, 44],
      }),
      ease: EASE.soft,
    },
    { t: 240, pose: swing(44, 0, { scale: 0.3, opacity: 0 }), ease: EASE.soft },
  ];
}

/** A gentle catenary sag for the line, in scene space. */
function linePath(from, to, bow = 0) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  const c1 = [from[0] + dx / 3 + nx * bow, from[1] + dy / 3 + ny * bow];
  const c2 = [from[0] + (dx * 2) / 3 + nx * bow, from[1] + (dy * 2) / 3 + ny * bow];
  const r = (p) => `${Math.round(p[0] * 10) / 10} ${Math.round(p[1] * 10) / 10}`;
  return `M ${r(from)} C ${r(c1)} ${r(c2)} ${r(to)}`;
}

/** The swing line, keyed to the hand at every pose. */
export function swingLine(timeline) {
  return timeline
    .filter((key) => key.t <= 74)
    .map((key) => ({
      t: key.t,
      d: linePath(ANCHOR, sceneHand(key.pose), key.t < 30 ? 2 : 0.5),
      ease: key.ease,
    }));
}

/** The exit line, from the hand to the same anchor. */
export function exitLine(timeline) {
  return timeline
    .filter((key) => key.t >= 198 && key.t <= 226)
    .map((key) => ({ t: key.t, d: linePath(ANCHOR, sceneHand(key.pose), 0), ease: key.ease }));
}

export { linePath };
