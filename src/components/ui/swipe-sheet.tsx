import { useState, type ReactNode } from "react";
import { motion, useDragControls } from "framer-motion";
import { X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * A bottom sheet you can throw away.
 *
 * Every action menu in the app should behave the same on a phone: grab the
 * handle, pull down, it leaves. Radix gives the sheet but no gesture, so the
 * handle owns a framer-motion drag and hands the sheet its final travel before
 * unmounting — no snap-back followed by a second close animation.
 */
export function SwipeSheet({
  open,
  onOpenChange,
  title,
  children,
  className,
  bodyClassName,
  showClose = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Screen-reader title; nothing is drawn from it. */
  title: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Draws an explicit X beside the grab handle; sheets with their own close
   *  button leave this off so the header never carries two of them. */
  showClose?: boolean;
}) {
  const controls = useDragControls();
  const [dismissing, setDismissing] = useState(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        hideClose
        className={cn(
          "swipe-sheet max-h-[86dvh] rounded-t-[26px] border-0 bg-black p-0",
          className,
        )}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <motion.div
          drag="y"
          dragControls={controls}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.5 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 90 || info.velocity.y > 650) setDismissing(true);
          }}
          animate={dismissing ? { y: 900 } : undefined}
          transition={dismissing ? { duration: 0.18, ease: "easeIn" } : undefined}
          onAnimationComplete={() => {
            if (!dismissing) return;
            setDismissing(false);
            onOpenChange(false);
          }}
          className="flex max-h-[86dvh] flex-col overflow-hidden rounded-t-[26px] bg-black"
        >
          <div className="relative flex shrink-0 items-center justify-center pb-2 pt-2.5">
            <div
              onPointerDown={(event) => {
                event.preventDefault();
                controls.start(event);
              }}
              role="presentation"
              className="flex w-24 cursor-grab touch-none justify-center active:cursor-grabbing"
            >
              <span aria-hidden className="h-1 w-10 rounded-full bg-white/45" />
              <span className="sr-only">Drag down to close</span>
            </div>
            {showClose ? (
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Close sheet"
                className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-white/55 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <div
            className={cn(
              "min-h-0 overflow-y-auto overscroll-contain px-2 pb-[max(env(safe-area-inset-bottom),0.85rem)]",
              bodyClassName,
            )}
          >
            {children}
          </div>
        </motion.div>
      </SheetContent>
    </Sheet>
  );
}
