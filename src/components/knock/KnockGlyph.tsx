import { KnockDoor, type KnockDoorState } from "@/components/knock/KnockDoor";

/**
 * RIZZ's knock mark: the animated door from the supplied reference.
 *
 * Kept as a tiny wrapper so every existing call site (DM strip, knock sheet,
 * thread cards, doorbell, profile) gets the same door without touching each
 * surface. `currentColor` carries the frame; the teal handle/rays use the
 * knock accent token.
 */
export function KnockGlyph({
  className,
  state = "idle",
}: {
  className?: string;
  state?: KnockDoorState;
}) {
  return <KnockDoor className={className} state={state} />;
}
