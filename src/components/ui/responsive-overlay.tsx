import { useEffect, useRef, useState, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { CloseButton } from "@/components/ui/close-button";

export interface ResponsiveOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  triggerRef?: React.RefObject<HTMLElement | null>;
  showClose?: boolean;
}

/**
 * Shared Responsive Overlay
 * - Bottom sheet on touch or <=640px (handle bar, drag dismiss feel, max-height 85dvh, safe-area bottom)
 * - Compact centered dialog (<=420px) on fine pointers / desktop
 * - Outside click & Esc close, focus trap, returns focus to trigger
 * - Initial focus never on close button
 * - Dimmed backdrop (bg-black/75), inert background, hides floating helpers
 */
export function ResponsiveOverlay({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  triggerRef,
  showClose = true,
}: ResponsiveOverlayProps) {
  const [isMobile, setIsMobile] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth <= 640 || window.matchMedia("(pointer: coarse)").matches);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Dimmed backdrop */}
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-[var(--z-overlay,100)] bg-black/75 backdrop-blur-xs transition-opacity duration-200 data-[state=closed]:opacity-0 data-[state=open]:opacity-100"
        />

        {/* Overlay Content */}
        <DialogPrimitive.Content
          ref={contentRef}
          onOpenAutoFocus={(e) => {
            // Prevent initial auto-focus from landing on the close button
            e.preventDefault();
            contentRef.current?.focus();
          }}
          onCloseAutoFocus={(e) => {
            if (triggerRef?.current) {
              e.preventDefault();
              triggerRef.current.focus();
            }
          }}
          className={cn(
            "fixed z-[calc(var(--z-overlay,100)+1)] bg-[var(--brand-ink-2,#131315)] border border-[var(--brand-line,rgba(244,241,231,0.13))] text-[var(--brand-paper,#f4f1e7)] shadow-2xl focus:outline-none",
            isMobile
              ? "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-3xl p-5 pb-[max(env(safe-area-inset-bottom,0px)+1rem,1.25rem)] overflow-y-auto animate-in slide-in-from-bottom duration-200"
              : "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[420px] rounded-2xl p-6 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150",
            className,
          )}
        >
          {/* Mobile Drag Handle */}
          {isMobile && (
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/20" aria-hidden="true" />
          )}

          {/* Header */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="font-display text-lg font-bold tracking-tight text-[var(--brand-paper,#f4f1e7)] truncate">
                {title}
              </DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="text-xs text-[var(--brand-paper-dim,#a9a69c)] mt-0.5">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>

            {showClose && (
              <DialogPrimitive.Close asChild>
                <CloseButton />
              </DialogPrimitive.Close>
            )}
          </div>

          {/* Body */}
          <div className="relative">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
