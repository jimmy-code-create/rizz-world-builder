import { RadioTower } from "lucide-react";

/**
 * The RIZZ live mark.
 *
 * Lucide's broadcast tower does the semantic work: a tower, a signal, and a
 * clear "live" read at 16–24px. Keeping this wrapper means every existing
 * launch surface inherits the change without touching its props.
 */
export function RizzLiveIcon({ className }: { className?: string }) {
  return (
    <RadioTower
      className={className}
      strokeWidth={1.9}
      aria-hidden="true"
      focusable="false"
    />
  );
}

export default RizzLiveIcon;
