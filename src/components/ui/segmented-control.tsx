import { cn } from "@/lib/utils";

/**
 * A real segmented control: one track, one movable selected segment.
 *
 * Used for the Password / Email code choice on sign-up, and anywhere else a
 * two-or-three-way either/or needs to read as a single control instead of two
 * loose buttons. The selected segment uses the primary token so it follows the
 * theme, and the whole thing keeps a visible focus ring on the keyboard.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  /** Accessible name for the group, e.g. "Sign-up method". */
  label: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "flex w-full gap-1 rounded-[8px] border border-border bg-muted p-[3px]",
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 rounded-[5px] px-3 py-2 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              selected
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
