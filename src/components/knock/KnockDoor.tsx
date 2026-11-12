import { cn } from "@/lib/utils";

export type KnockDoorState = "idle" | "live" | "knocking" | "sent";

/**
 * The knock mark, rebuilt from the supplied 512×512 door reference.
 *
 * It is deliberately an SVG rather than the original white-background video:
 * the door has to sit on ink, paper and every theme without a baked-in matte,
 * and it has to stay crisp at 18px in the DM strip and 56px in the knock sheet.
 * The frame stays put; the leaf swings on a perspective transform, the handle
 * and three rays carry the teal accent, and each interaction gets a short,
 * reduced-motion-safe animation.
 */
export function KnockDoor({
  className,
  state = "idle",
  title,
}: {
  className?: string;
  state?: KnockDoorState;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      className={cn("knock-door", className)}
      data-state={state}
    >
      {title ? <title>{title}</title> : null}

      <g className="knock-door__rays" aria-hidden="true">
        <path d="M9 23.5h5.2" />
        <path d="M6.6 32h6.1" />
        <path d="M9 40.5h5.2" />
        <path d="M49.8 23.5H55" />
        <path d="M51.3 32h6.1" />
        <path d="M49.8 40.5H55" />
      </g>

      <path
        className="knock-door__frame"
        d="M15 56V11.8c0-1.55 1.25-2.8 2.8-2.8h28.4c1.55 0 2.8 1.25 2.8 2.8V56"
      />
      <path className="knock-door__base" d="M10.5 56h43" />

      <g className="knock-door__leaf">
        <path d="M22.2 52V15.6c0-1.15.93-2.08 2.08-2.08h18.1c1.15 0 2.08.93 2.08 2.08V52" />
        <path d="M22.2 52h22.3" />
        <path className="knock-door__handle" d="M27.2 33.2h4.4" />
      </g>
    </svg>
  );
}
