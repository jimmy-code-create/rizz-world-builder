import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type { LucideIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type MessageActionDescriptor = {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  destructive?: boolean;
};

export type MessageActionMenuProps = {
  children: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  align: "left" | "right";
  actions: readonly MessageActionDescriptor[];
  triggerRole?: "button" | "group";
};

type PressOrigin = {
  x: number;
  y: number;
  pointerId: number;
};

const LONG_PRESS_DELAY = 480;
const MOVEMENT_TOLERANCE = 10;

export function MessageActionMenu({
  children,
  open,
  onOpenChange,
  align,
  actions,
  triggerRole = "button",
}: MessageActionMenuProps) {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressOrigin = useRef<PressOrigin | null>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  const clearPress = () => {
    if (pressTimer.current !== null) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    pressOrigin.current = null;
  };

  useEffect(
    () => () => {
      if (pressTimer.current !== null) clearTimeout(pressTimer.current);
    },
    [],
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }
    if ((event.target as HTMLElement).closest("button, a, input, textarea, [role='button']")) {
      return;
    }

    clearPress();
    pressOrigin.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
    };
    pressTimer.current = setTimeout(() => {
      pressTimer.current = null;
      if (!pressOrigin.current) return;
      onOpenChangeRef.current(true);
    }, LONG_PRESS_DELAY);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const origin = pressOrigin.current;
    if (!origin || origin.pointerId !== event.pointerId) return;

    const movedX = event.clientX - origin.x;
    const movedY = event.clientY - origin.y;
    if (movedX * movedX + movedY * movedY > MOVEMENT_TOLERANCE ** 2) {
      clearPress();
    }
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLSpanElement>) => {
    const keyboardShortcut =
      triggerRole === "group"
        ? event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey)
        : event.key === "Enter" || event.key === " ";
    if (!keyboardShortcut) return;
    event.preventDefault();
    if (event.repeat) return;
    onOpenChange(!open);
  };

  const handleSelect = (action: MessageActionDescriptor) => {
    onOpenChange(false);
    action.onSelect();
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <span
          role={triggerRole}
          tabIndex={0}
          aria-label={triggerRole === "button" ? "Open message actions" : "Message actions"}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="inline-flex max-w-full rounded-[inherit] align-middle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rizz-pink)]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          style={{ touchAction: "pan-y", WebkitTouchCallout: "none" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={clearPress}
          onPointerCancel={clearPress}
          onPointerLeave={clearPress}
          onContextMenu={(event) => {
            event.preventDefault();
            clearPress();
            onOpenChange(true);
          }}
          onClick={(event) => {
            // Pointer taps should not open the menu; keyboard activation is
            // handled explicitly below and by the accessible trigger state.
            if (event.detail > 0) {
              event.preventDefault();
            }
          }}
          onKeyDown={handleKeyDown}
        >
          {children}
        </span>
      </PopoverTrigger>
      <PopoverContent
        align={align === "left" ? "start" : "end"}
        side="top"
        sideOffset={8}
        collisionPadding={12}
        aria-label="Message actions"
        onOpenAutoFocus={(event) => {
          if (!actions.length) return;
          event.preventDefault();
          firstActionRef.current?.focus();
        }}
        className="glass-strong relative max-h-[min(70dvh,24rem)] w-[min(13rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border-white/10 p-1.5 shadow-[0_16px_44px_-18px_rgba(0,0,0,0.9)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-[var(--rizz-pink)]/45 to-transparent"
        />
        <div role="group" aria-label="Available actions" className="flex flex-col gap-0.5">
          {actions.map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                key={`${action.label}-${index}`}
                ref={index === 0 ? firstActionRef : undefined}
                type="button"
                onClick={() => handleSelect(action)}
                className={`group flex min-h-11 w-full items-center gap-3 rounded-lg px-2.5 text-left text-[12px] font-medium tracking-[0.01em] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--rizz-pink)] ${
                  action.destructive
                    ? "text-destructive hover:bg-destructive/10"
                    : "text-foreground/85 hover:bg-white/[0.07] hover:text-foreground"
                }`}
              >
                <Icon
                  aria-hidden="true"
                  className={`h-4 w-4 shrink-0 ${
                    action.destructive
                      ? "text-destructive"
                      : "text-[var(--rizz-violet)] transition-colors group-hover:text-[var(--rizz-pink)]"
                  }`}
                  strokeWidth={1.9}
                />
                <span className="truncate">{action.label}</span>
              </button>
            );
          })}
          {actions.length === 0 && (
            <p className="px-2.5 py-3 text-xs text-muted-foreground">No actions available</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default MessageActionMenu;
