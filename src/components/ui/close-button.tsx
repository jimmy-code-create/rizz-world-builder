import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export interface CloseButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

/**
 * Shared CloseButton:
 * - 44x44 hit area (touch-friendly 44px target)
 * - display: grid; place-items: center
 * - Single 20px SVG X with stroke 2
 * - Cream text (#f2efe6) at 70% opacity, 100% on hover/press
 * - Focus-visible ring in lime #c8ff3d
 * - aria-label="Close"
 */
export const CloseButton = React.forwardRef<HTMLButtonElement, CloseButtonProps>(
  ({ className, asChild = false, type = "button", children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : type}
        aria-label="Close"
        className={cn(
          "grid h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-full text-[#f2efe6]/70 transition-colors hover:bg-white/10 hover:text-[#f2efe6] active:scale-95 active:text-[#f2efe6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d] disabled:pointer-events-none disabled:opacity-40",
          className,
        )}
        {...props}
      >
        {children ?? (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        )}
      </Comp>
    );
  },
);
CloseButton.displayName = "CloseButton";
