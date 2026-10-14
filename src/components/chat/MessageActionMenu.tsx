import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type { LucideIcon } from "lucide-react";
import { Maximize2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ReactionQuickBar } from "@/components/chat/ReactionQuickBar";
import { useIsMobile } from "@/hooks/use-mobile";

export type MessageActionDescriptor = {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  destructive?: boolean;
};

/**
 * The message the menu belongs to, shown at the top of the menu.
 *
 * Long-pressing a message used to replace it with a list of actions, so the
 * message you pressed was no longer readable — and with the menu open there was
 * nothing to read it in. The header keeps the author, the time and the text in
 * view, and `onView` opens the message full size (the whole message, including
 * anything the bubble clipped).
 */
export type MessageActionPreview = {
  author: string;
  time?: string;
  body?: string | null;
  avatarUrl?: string | null;
  /** Opens the focused, full-size message view. */
  onView?: () => void;
};

export type MessageActionMenuProps = {
  children: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  align: "left" | "right";
  actions: readonly MessageActionDescriptor[];
  triggerRole?: "button" | "group";
  /** Adds the six quick emojis + "+" reaction bar at the top of the menu. */
  reactionBar?: { onPick: (emoji: string) => void };
  /** Double tapping the message (not the menu) fires this. */
  onDoubleTap?: () => void;
  /** Who wrote it and what it says, shown above the actions. */
  preview?: MessageActionPreview;
};

type PressOrigin = {
  x: number;
  y: number;
  pointerId: number;
};

const LONG_PRESS_DELAY = 320;
const MOVEMENT_TOLERANCE = 22;
/** Two taps within this window count as a double tap (react with a heart). */
const DOUBLE_TAP_WINDOW = 300;

export function MessageActionMenu({
  children,
  open,
  onOpenChange,
  align,
  actions,
  triggerRole = "button",
  reactionBar,
  onDoubleTap,
  preview,
}: MessageActionMenuProps) {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressOrigin = useRef<PressOrigin | null>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  const longPressFired = useRef(false);
  const lastTap = useRef(0);
  const onDoubleTapRef = useRef(onDoubleTap);
  onDoubleTapRef.current = onDoubleTap;
  // Phones get Discord's bottom sheet (thumb reach, nothing covered); a mouse
  // keeps the popover next to the message it belongs to.
  const isMobile = useIsMobile();

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
    longPressFired.current = false;
    pressOrigin.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
    };
    pressTimer.current = setTimeout(() => {
      pressTimer.current = null;
      if (!pressOrigin.current) return;
      longPressFired.current = true;
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try { navigator.vibrate(35); } catch {}
      }
      onOpenChangeRef.current(true);
    }, LONG_PRESS_DELAY);
  };

  /** A tap that never became a long press: the second one within the window is a
   *  double tap (heart reaction), and it must not also open the menu. */
  const handleTapEnd = () => {
    if (!onDoubleTapRef.current) return;
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_WINDOW) {
      lastTap.current = 0;
      onDoubleTapRef.current();
      return;
    }
    lastTap.current = now;
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

  const select = (action: MessageActionDescriptor) => handleSelect(action);

  const previewHeader = preview ? (
    <div className="mb-2 flex items-start gap-3 rounded-2xl border border-white/10 bg-card p-3 shadow-md">
      <Avatar className="mt-0.5 h-8 w-8 shrink-0 ring-1 ring-white/15">
        <AvatarImage src={preview.avatarUrl ?? undefined} alt="" />
        <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
          {preview.author.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-1.5 text-xs font-semibold text-foreground">
          <span className="truncate">{preview.author}</span>
          {preview.time && <span className="shrink-0 font-normal text-[10px] text-muted-foreground">{preview.time}</span>}
        </p>
        <p className="mt-1 line-clamp-4 whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground/95">
          {preview.body?.trim() ? preview.body : "No text — open it to see the media."}
        </p>
      </div>
      {preview.onView && (
        <button
          type="button"
          onClick={() => {
            onOpenChange(false);
            preview.onView?.();
          }}
          aria-label="Open this message"
          title="Open this message"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
        >
          <Maximize2 className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  ) : null;

  const actionRows = (
    <div role="group" aria-label="Available actions" className="flex flex-col gap-0.5">
      {actions.map((action, index) => {
        const Icon = action.icon;
        return (
          <button
            key={`${action.label}-${index}`}
            ref={index === 0 ? firstActionRef : undefined}
            type="button"
            onClick={() => select(action)}
            className={`group flex min-h-11 w-full items-center gap-3 rounded-lg px-2.5 text-left text-[12px] font-medium tracking-[0.01em] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary ${
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
                  : "text-muted-foreground transition-colors group-hover:text-primary"
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
  );

  const trigger = (
    <span
      role={triggerRole}
      tabIndex={0}
      aria-label={triggerRole === "button" ? "Open message actions" : "Message actions"}
      aria-haspopup="dialog"
      aria-expanded={open}
      className="inline-flex max-w-full rounded-[inherit] align-middle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      style={{ touchAction: "pan-y", WebkitTouchCallout: "none" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={() => {
        const wasLongPress = longPressFired.current;
        longPressFired.current = false;
        clearPress();
        if (!wasLongPress) handleTapEnd();
      }}
      onPointerCancel={() => {
        longPressFired.current = false;
        clearPress();
      }}
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
  );

  if (isMobile) {
    return (
      <>
        {trigger}
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent
            side="bottom"
            className="glass-strong z-[100] max-h-[80dvh] overflow-y-auto rounded-t-3xl border-white/10 px-3 pb-[max(env(safe-area-inset-bottom),1rem)]"
          >
            {/* Kept in the tree for screen readers, hidden from view. */}
            <SheetHeader className="sr-only">
              <SheetTitle>Message actions</SheetTitle>
            </SheetHeader>
            <span aria-hidden className="mx-auto mb-3 block h-1 w-10 rounded-full bg-white/20" />
            {previewHeader}
            {reactionBar && (
              <ReactionQuickBar
                className="mb-2"
                onPick={(emoji) => {
                  onOpenChange(false);
                  reactionBar.onPick(emoji);
                }}
              />
            )}
            {actionRows}
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align={align === "left" ? "start" : "end"}
        side="top"
        sideOffset={8}
        collisionPadding={12}
        aria-label="Message actions"
        onOpenAutoFocus={(event) => {
          // With a preview or a reaction bar, the first control is not a plain
          // action button; leave focus alone so the page doesn't scroll or jump.
          if (preview || reactionBar || !actions.length) {
            event.preventDefault();
            return;
          }
          event.preventDefault();
          firstActionRef.current?.focus();
        }}
        className={`glass-strong relative max-h-[min(72dvh,30rem)] w-[min(${reactionBar ? "21rem" : "15rem"},calc(100vw-1.5rem))] overflow-y-auto rounded-xl border-white/10 p-1.5 shadow-[0_16px_44px_-18px_rgba(0,0,0,0.9)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95`}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-primary/45 to-transparent"
        />
        {previewHeader}
        {reactionBar && (
          <ReactionQuickBar
            className="mb-2"
            onPick={(emoji) => {
              onOpenChange(false);
              reactionBar.onPick(emoji);
            }}
          />
        )}
        {actionRows}
      </PopoverContent>
    </Popover>
  );
}

export default MessageActionMenu;
