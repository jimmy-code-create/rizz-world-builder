import { Toaster as Sonner } from "sonner";
import { AlertCircle, CheckCircle2, Info, LoaderCircle } from "lucide-react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Standard Toast Configuration
 * - One at a time (visibleToasts: 1)
 * - Above the bottom nav (offset: 80px / calc(env(safe-area-inset-bottom,0px) + 5rem))
 * - role="status", 4s duration
 * - Centered real icons, optional Undo
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group rizz-toaster z-[var(--z-toast,200)]"
      position="bottom-center"
      offset="calc(env(safe-area-inset-bottom, 0px) + 4.75rem)"
      gap={8}
      duration={4000}
      visibleToasts={1}
      closeButton={false}
      icons={{
        success: <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-[var(--brand-signal,#c8ff3d)]" />,
        error: <AlertCircle aria-hidden="true" className="h-4 w-4 text-[var(--destructive,#ff6a55)]" />,
        info: <Info aria-hidden="true" className="h-4 w-4 text-[var(--brand-paper,#f4f1e7)]" />,
        loading: <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin text-[var(--brand-signal,#c8ff3d)]" />,
      }}
      toastOptions={{
        classNames: {
          toast: "rizz-toast border border-[var(--brand-line,rgba(244,241,231,0.13))] bg-[var(--brand-ink-2,#131315)] text-[var(--brand-paper,#f4f1e7)] shadow-xl rounded-xl text-xs sm:text-sm font-medium",
          title: "rizz-toast-title font-semibold text-[var(--brand-paper,#f4f1e7)]",
          description: "rizz-toast-description text-xs text-[var(--brand-paper-dim,#a9a69c)]",
          icon: "rizz-toast-icon",
          actionButton: "rizz-toast-action bg-[var(--brand-signal,#c8ff3d)] text-[var(--brand-signal-ink,#0a0a0b)] font-bold px-2.5 py-1 rounded-md text-xs",
          cancelButton: "rizz-toast-cancel bg-[var(--brand-ink-3,#1c1c1f)] text-[var(--brand-paper,#f4f1e7)] px-2.5 py-1 rounded-md text-xs",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
