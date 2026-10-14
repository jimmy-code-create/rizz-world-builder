import { cn } from "@/lib/utils";

/**
 * A radio or checkbox mark where the box and its checked indicator are ONE
 * element.
 *
 * `.choice-mark` draws the frame; `.choice-mark.is-checked::after` draws the
 * tick (or the inner dot for a radio) inside that same box. Nothing is
 * absolutely positioned against anything else, so the mark cannot slide off its
 * container at 125%/150% zoom or with a larger text-size preference.
 */
export function ChoiceMark({
  checked,
  shape = "radio",
  className,
}: {
  checked: boolean;
  shape?: "radio" | "checkbox";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "choice-mark",
        shape === "radio" ? "choice-mark--radio" : "choice-mark--checkbox",
        checked && "is-checked",
        className,
      )}
    />
  );
}
