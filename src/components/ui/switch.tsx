import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer relative inline-flex h-11 min-h-11 w-12 min-w-12 shrink-0 cursor-pointer items-center justify-start rounded-full border-0 bg-transparent px-1 shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 before:content-[''] before:absolute before:inset-y-2 before:left-0 before:right-0 before:rounded-full before:bg-input before:transition-colors data-[state=checked]:before:bg-primary",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className="pointer-events-none relative z-10 block h-5 w-5 rounded-full bg-background shadow-sm ring-0 transition-transform"
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
