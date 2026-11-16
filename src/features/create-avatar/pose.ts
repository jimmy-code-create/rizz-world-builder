/**
 * The supplied avatar ships in a T-pose: hands at shoulder height, 0.69m out to
 * each side. That is the pose a rigger wants and the pose nobody wants to see,
 * so the upper arms are rotated down to the sides before the model is framed.
 *
 * The angle is measured, not hardcoded. For each arm the current upper-arm
 * direction (shoulder → elbow) is read from the live skeleton, the rotation that
 * turns it toward the floor is solved, and that rotation is converted from world
 * space into the bone's parent space. Re-export the model in a different pose
 * and it still ends up with its arms down; feed it one that already hangs and
 * nothing moves.
 *
 * `THREE` is passed in rather than imported so the renderer stays a dynamic
 * import — this file is pure maths over transforms and loads with the caller.
 */

/** How far out from the body each arm hangs, so it clears the hips. */
export const ARM_OUTWARD = 0.22;

/** Below this the arm already points down; rotating again would fold it in. */
const ALREADY_DOWN_Y = -0.4;

const LEFT_ARM = /^LeftArm(?:[_\d]|$)/i;
const RIGHT_ARM = /^RightArm(?:[_\d]|$)/i;
const FOREARM = /forearm(?:[_\d]|$)/i;

export function dropArms(root: any, THREE: any): boolean {
  const bones: any[] = [];
  root.traverse((child: any) => {
    if (child.isBone) bones.push(child);
  });
  root.updateMatrixWorld(true);

  let moved = false;
  for (const side of [
    { pattern: LEFT_ARM, sign: +1 },
    { pattern: RIGHT_ARM, sign: -1 },
  ]) {
    const arm = bones.find((bone) => side.pattern.test(bone.name ?? ""));
    if (!arm?.parent) continue;
    const elbow = (arm.children ?? []).find((child: any) => FOREARM.test(child.name ?? ""));
    if (!elbow) continue;

    const shoulder = arm.getWorldPosition(new THREE.Vector3());
    const joint = elbow.getWorldPosition(new THREE.Vector3());
    const current = joint.sub(shoulder);
    if (current.lengthSq() < 1e-8) continue;
    current.normalize();
    if (current.y < ALREADY_DOWN_Y) continue;

    const target = new THREE.Vector3(side.sign * ARM_OUTWARD, -1, 0).normalize();
    const delta = new THREE.Quaternion().setFromUnitVectors(current, target);
    const parentWorld = arm.parent.getWorldQuaternion(new THREE.Quaternion());
    const localDelta = parentWorld.clone().invert().multiply(delta).multiply(parentWorld);
    arm.quaternion.premultiply(localDelta).normalize();
    arm.updateMatrixWorld(true);
    moved = true;
  }
  return moved;
}
