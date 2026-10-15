import { Toaster as Sonner } from "sonner";

/**
 * The toast host.
 *
 * Sonner keeps the hard parts — stacking, swipe-to-dismiss, viewport math —
 * while every card is drawn by <GlassToast /> (src/lib/toast.tsx): top-center,
 * below the status bar / safe area, up to 3 at once, never over the composer.
 */
const Toaster = ({ ...props }: React.ComponentProps<typeof Sonner>) => {
  return (
    <Sonner
      className="rizz-toaster"
      position="top-center"
      offset="calc(env(safe-area-inset-top, 0px) + 10px)"
      gap={8}
      duration={3500}
      visibleToasts={3}
      closeButton={false}
      swipeDirections={["top", "left", "right"]}
      toastOptions={{ unstyled: true }}
      {...props}
    />
  );
};

export { Toaster };
