import { useEffect, type ReactNode } from "react";
import { motion, useAnimationControls, useDragControls } from "framer-motion";
import { X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * A bottom sheet you can throw away.
 *
 * Every action menu in the app should behave the same on a phone: grab the
 * header, pull down, it leaves. Radix gives the sheet but no gesture, so the
 * header owns a framer-motion drag, then hands the close to Radix's exit
 * animation from wherever the thumb left it — no snap-back followed by a
 * second close animation.
 *
 * Two details keep the pull honest. The drag is 1:1 (a generous bottom bound,
 * no elastic) so the sheet follows the thumb instead of fighting a 0px
 * constraint that springs back to the top on release. And the Radix box paints
 * nothing: the moving card owns the black surface, so pulling it down reveals
 * the page behind rather than a static black strip above the header.
 */
export function SwipeSheet({
  open,
  onOpenChange,
  title,
  children,
  className,
  bodyClassName,
  showClose = false,
  floatingHandle = false,
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
  /** Lays the grab strip over the content instead of above it, so a hero header
   *  can begin at the sheet's top edge. The strip stays the drag surface. */
  floatingHandle?: boolean;
}) {
  const controls = useDragControls();
  const sheet = useAnimationControls();

  // A fresh open always starts at rest, even if the last close was a swipe.
  useEffect(() => {
    if (!open) return;
    void sheet.start({ y: 0, transition: { duration: 0 } });
  }, [open, sheet]);

  const settle = () => {
    void sheet.start({
      y: 0,
      transition: { type: "spring", stiffness: 520, damping: 42, mass: 0.7 },
    });
  };

  /** Freeze the card where it is before Radix starts carrying it off screen. */
  const changeOpen = (next: boolean) => {
    if (!next) sheet.stop();
    onOpenChange(next);
  };

  return (
    <Sheet open={open} onOpenChange={changeOpen}>
      <SheetContent
        side="bottom"
        hideClose
        className={cn(
          // The portal box is a frame only: transparent, no border or shadow.
          // styles.css makes this win over the generic bottom-sheet glass.
          "swipe-sheet max-h-[86dvh] gap-0 overflow-visible border-0 bg-transparent p-0 shadow-none",
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
          dragMomentum={false}
          // A large bottom bound lets the card track the finger 1:1. The old
          // 0px constraint made framer start its own spring back to the origin
          // on every release, which raced the close and caused the three-try
          // dismissals. Zero elastic also means the sheet never drifts upward.
          dragConstraints={{ top: 0, bottom: 1400 }}
          dragElastic={0}
          onDragStart={() => sheet.stop()}
          onDragEnd={(_, info) => {
            // Framer starts a zero-velocity inertia animation on release; stop
            // it so it cannot fight the close or the spring back. A deliberate
            // pull (64px at 1:1) or a quick flick closes, anything less settles.
            sheet.stop();
            if (info.offset.y > 64 || info.velocity.y > 480) changeOpen(false);
            else settle();
          }}
          animate={sheet}
          className="flex max-h-[inherit] flex-col overflow-hidden rounded-t-[26px] bg-black"
        >
          {/* The whole strip is the grab surface, not just the pill: one thumb
              on the header always finds the drag. The X keeps its own tap
              because the handler ignores buttons. With a hero header the
              strip floats over the cover instead of taking a black row above
              it, so the profile can start at the sheet's top edge. The strip
              stays tall enough to hit but the pill itself is kept compact so
              it reads as an affordance rather than a bar across the artwork. */}
          <div
            onPointerDown={(event) => {
              if ((event.target as HTMLElement).closest("button, a")) return;
              event.preventDefault();
              controls.start(event);
            }}
            className={cn(
              "cursor-grab touch-none select-none active:cursor-grabbing",
              floatingHandle
                ? "absolute inset-x-0 top-0 z-30 flex h-9 items-center justify-center"
                : "relative flex min-h-11 shrink-0 items-center justify-center pb-1.5",
            )}
          >
            <div
              className={cn(
                "flex justify-center",
                floatingHandle
                  ? "w-11 rounded-full bg-black/40 px-1.5 py-1 backdrop-blur-sm"
                  : "w-16",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "rounded-full",
                  floatingHandle
                    ? "h-[3px] w-6 bg-white/80 shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
                    : "h-1 w-9 bg-white/45",
                )}
              />
              <span className="sr-only">Drag down to close</span>
            </div>
            {showClose ? (
              <button
                type="button"
                onClick={() => changeOpen(false)}
                aria-label="Close sheet"
                className={cn(
                  "absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-white/55 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                  floatingHandle &&
                    "h-8 w-8 bg-black/30 text-white/85 backdrop-blur-sm hover:bg-black/50",
                )}
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
