import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * ONE button for the whole app.
 *
 * Variants follow the style law: `primary` is the lime fill with ink text,
 * `secondary` is a surfaced control with a 1px border, `ghost` has no chrome,
 * `danger` is a red *outline* (the red fill is `destructive`, kept for confirm
 * dialogs only). Heights are 36 / 44 / 52 — `default` stays 36 so existing
 * call sites keep their layout, `md` is the 44px touch target and `lg` the 52px
 * hero action.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/85",
        // `default` is kept as the primary alias so older call sites do not change look.
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        danger: "border border-destructive/60 bg-transparent text-destructive hover:bg-destructive/15",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-[var(--shadow-1)]",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-9 rounded-xl px-3 text-xs",
        md: "h-11 px-4",
        lg: "h-[52px] px-6 text-[15px]",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
