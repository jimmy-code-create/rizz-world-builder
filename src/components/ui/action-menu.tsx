import { useState, useRef, type ReactNode } from "react";
import { ResponsiveOverlay } from "@/components/ui/responsive-overlay";
import { IconButton } from "@/components/ui/icon-button";
import { Ellipsis, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActionMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  destructive?: boolean;
  /** When true or string provided, requires a confirm step before firing */
  confirmText?: string;
  disabled?: boolean;
}

export interface ActionMenuProps {
  title?: string;
  trigger?: ReactNode;
  triggerLabel?: string;
  items: ActionMenuItem[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

/**
 * Shared Menu for every "..." button
 * - Built on ResponsiveOverlay (bottom sheet on touch/mobile, compact dialog on desktop)
 * - Rows: icon + label, min 48px tap targets
 * - Destructive rows in danger color with a confirm step
 * - Closes on select, Esc, outside click
 */
export function ActionMenu({
  title = "Actions",
  trigger,
  triggerLabel = "More options",
  items,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  className,
}: ActionMenuProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setOpen = (val: boolean) => {
    if (!val) setConfirmingId(null);
    if (isControlled) {
      controlledOnOpenChange?.(val);
    } else {
      setInternalOpen(val);
    }
  };

  const handleSelect = (item: ActionMenuItem) => {
    if (item.disabled) return;

    if (item.confirmText && confirmingId !== item.id) {
      setConfirmingId(item.id);
      return;
    }

    setOpen(false);
    item.onSelect();
  };

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)} className="inline-block">
          {trigger}
        </span>
      ) : (
        <IconButton
          ref={triggerRef}
          aria-label={triggerLabel}
          size="lg"
          variant="ghost"
          onClick={() => setOpen(true)}
        >
          <Ellipsis className="h-5 w-5" />
        </IconButton>
      )}

      <ResponsiveOverlay
        open={isOpen}
        onOpenChange={setOpen}
        title={title}
        triggerRef={triggerRef}
        showClose={true}
        className={cn("p-4 sm:p-5", className)}
      >
        <div className="flex flex-col divide-y divide-[var(--brand-line,rgba(244,241,231,0.08))]">
          {items.map((item) => {
            const isConfirming = confirmingId === item.id;
            const isDanger = item.destructive;

            return (
              <button
                key={item.id}
                type="button"
                disabled={item.disabled}
                onClick={() => handleSelect(item)}
                className={cn(
                  "group flex min-h-[48px] w-full items-center justify-between gap-3 px-3 py-3 text-left rounded-xl transition-colors select-none",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-signal,#c8ff3d)]",
                  "disabled:opacity-40 disabled:pointer-events-none",
                  isDanger
                    ? isConfirming
                      ? "bg-[#ff6a55]/20 text-[#ff6a55] font-bold"
                      : "text-[#ff6a55] hover:bg-[#ff6a55]/10"
                    : "text-[var(--brand-paper,#f4f1e7)] hover:bg-[var(--brand-ink-3,#1c1c1f)]",
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {item.icon && (
                    <span
                      className={cn(
                        "grid h-6 w-6 place-items-center shrink-0 [&>svg]:block [&>svg]:m-0",
                        isDanger ? "text-[#ff6a55]" : "text-[var(--brand-paper-dim,#a9a69c)] group-hover:text-white",
                      )}
                    >
                      {item.icon}
                    </span>
                  )}
                  <span className="truncate text-sm font-medium">
                    {isConfirming ? (item.confirmText || `Confirm ${item.label}?`) : item.label}
                  </span>
                </div>

                {isConfirming && (
                  <span className="text-[11px] font-bold text-[#ff6a55] flex items-center gap-1 shrink-0">
                    <AlertTriangle className="h-3.5 w-3.5" /> Tap again
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </ResponsiveOverlay>
    </>
  );
}
