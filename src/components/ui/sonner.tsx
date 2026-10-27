import { Toaster as Sonner } from "sonner";

/**
 * The toast host.
 *
 * Sonner keeps the hard parts — stacking, swipe-to-dismiss, viewport math —
 * while every card is drawn by <GlassToast /> (src/lib/toast.tsx): a compact
 * pill at the top, below the status bar / safe area, and never more than two
 * at once. A toast is a receipt for a tap, so the page behind it has to stay
 * readable: two is the pile-up limit, and the pill is content-width rather than
 * a full-bleed banner across the app.
 */
const Toaster = ({ ...props }: React.ComponentProps<typeof Sonner>) => {
  return (
    <Sonner
      className="rizz-toaster"
      position="top-center"
      offset="calc(env(safe-area-inset-top, 0px) + 8px)"
      gap={6}
      duration={2400}
      visibleToasts={2}
      closeButton={false}
      swipeDirections={["top", "left", "right"]}
      toastOptions={{ unstyled: true }}
      {...props}
    />
  );
};

export { Toaster };
