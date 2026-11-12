import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type { LucideIcon } from "lucide-react";
import { SmilePlus, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ReactionPicker } from "@/components/chat/ReactionPicker";
import { useIsMobile } from "@/hooks/use-mobile";

export type MessageActionDescriptor = {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  destructive?: boolean;
  /** A short explanation shown under the label, Discord-style. */
  description?: string;
};

/**
 * The message the menu belongs to, shown at the top of the menu.
 *
 * Long-pressing a message used to replace it with a list of actions, so the
 * message you pressed was no longer readable — and with the menu open there was
 * nothing to read it in. The header keeps the author, the time and the text in
 * view; the only control on its right edge is the reaction smiley, so the menu
 * never turns into a wall of emoji before someone asks for it.
 */
export type MessageActionPreview = {
  author: string;
  time?: string;
  body?: string | null;
  avatarUrl?: string | null;
};

export type MessageActionMenuProps = {
  children: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  align: "left" | "right";
  actions: readonly MessageActionDescriptor[];
  triggerRole?: "button" | "group";
  /** Adds the emoji button that opens the reaction picker (not a whole tray). */
  reactionBar?: { onPick: (emoji: string) => void };
  /** Double tapping the message (not the menu) fires this. */
  onDoubleTap?: () => void;
  /** Who wrote it and what it says, shown above the actions. */
  preview?: MessageActionPreview;
  /**
   * Whether the trigger runs its own long-press timer. Set false when the
   * parent already detects long-press (e.g. realm rows cover media + avatar
   * areas the trigger doesn't wrap) — two racing 320ms timers meant double
   * vibration and double open state per press. Double-tap, context menu and
   * keyboard still work with this off.
   */
  detectPress?: boolean;
  /**
   * Which pane opens first. The desktop hover toolbar's smiley opens straight
   * into the reaction picker, the way Discord's does, while every other route
   * into the menu still starts on the actions.
   */
  initialView?: "actions" | "reactions";
  /**
   * Extra trigger classes. A poll owns the whole row, so its trigger needs
   * `w-full`; the inline trigger otherwise shrink-wraps the card.
   */
  className?: string;
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
  detectPress = true,
  initialView = "actions",
  className,
}: MessageActionMenuProps) {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressOrigin = useRef<PressOrigin | null>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  const longPressFired = useRef(false);
  const movedDuringPress = useRef(false);
  const lastTap = useRef(0);
  const onDoubleTapRef = useRef(onDoubleTap);
  onDoubleTapRef.current = onDoubleTap;
  // Phones get Discord's bottom sheet (thumb reach, nothing covered); a mouse
  // keeps the popover next to the message it belongs to.
  const isMobile = useIsMobile();
  // Actions are the default view. Reactions mount only after the emoji button
  // is tapped, which keeps opening the menu cheap and the sheet short.
  const [view, setView] = useState<"actions" | "reactions">("actions");

  useEffect(() => {
    setView(open ? initialView : "actions");
  }, [open, initialView]);

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
    if (!detectPress) return;

    clearPress();
    longPressFired.current = false;
    movedDuringPress.current = false;
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
    // A swipe or scroll must never count as a tap (and two swipes must never
    // accidentally fire the heart). Movement is latched until pointerdown.
    if (movedDuringPress.current) return;
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
      movedDuringPress.current = true;
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

  /** The one control for reactions: a smiley on the message's right edge. */
  const reactionButton = reactionBar ? (
    <button
      type="button"
      onClick={() => setView("reactions")}
      aria-label="Add reaction"
      title="Add reaction"
      className="grid h-7 w-7 shrink-0 place-items-center rounded text-[#b5bac1] transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
    >
      <SmilePlus className="h-4 w-4" aria-hidden="true" />
    </button>
  ) : null;

  // Discord's context-menu header: avatar, name, timestamp, then the text, with
  // the reaction smiley at the right edge of the message. No card, no border.
  const previewHeader = preview ? (
    <div className="rizz-action-preview flex items-start gap-2.5 px-2 pb-2 pt-1.5">
      <Avatar className="rizz-action-avatar mt-0.5 h-8 w-8 shrink-0">
        <AvatarImage src={preview.avatarUrl ?? undefined} alt="" />
        <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">
          {preview.author.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-1.5 text-[13px] font-semibold leading-[18px] text-white">
          <span className="truncate">{preview.author}</span>
          {preview.time && (
            <span className="shrink-0 text-[11px] font-normal text-[#949ba4]">{preview.time}</span>
          )}
        </p>
        <p className="rizz-action-quote mt-0.5 line-clamp-3 whitespace-pre-wrap break-words text-[13px] leading-[18px] text-[#dbdee1]">
          {preview.body?.trim() ? preview.body : "No text — open it to see the media."}
        </p>
      </div>
    </div>
  ) : null;

  const closeButton = (
    <button
      type="button"
      onClick={() => onOpenChange(false)}
      aria-label="Close message actions"
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#b5bac1] transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
    >
      <X className="h-4 w-4" aria-hidden="true" />
    </button>
  );

  /**
   * One top row for the menu: its label on the left, the reaction smiley and
   * the close control tight together on the right. They used to sit in
   * different corners of the sheet with the preview card between them.
   */
  const menuTopBar = (withClose: boolean) => (
    <div className="flex h-9 items-center justify-between gap-2 pl-2 pr-0.5">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#949ba4]">
        Message actions
      </span>
      <div className="flex shrink-0 items-center gap-0.5">
        {!showingReactions ? reactionButton : null}
        {withClose ? closeButton : null}
      </div>
    </div>
  );

  const reactionsView = reactionBar ? (
    <ReactionPicker
      onBack={() => setView("actions")}
      onPick={(emoji) => {
        onOpenChange(false);
        reactionBar.onPick(emoji);
      }}
    />
  ) : null;
  const showingReactions = view === "reactions" && !!reactionBar;

  /**
   * Discord groups the destructive action at the bottom behind a hairline, so
   * Delete never sits next to Reply. `dense` is the desktop row height; the
   * phone sheet keeps full 44px targets.
   */
  const renderActions = (dense: boolean) => (
    <div role="group" aria-label="Available actions" className="rizz-action-list flex flex-col">
      {actions.map((action, index) => {
        const Icon = action.icon;
        const startsDanger = action.destructive && !actions.slice(0, index).some((item) => item.destructive);
        return (
          <Fragment key={`${action.label}-${index}`}>
            {startsDanger && index > 0 && (
              <div aria-hidden className="rizz-action-divider my-1 h-px bg-white/[0.06]" />
            )}
            <button
              ref={index === 0 ? firstActionRef : undefined}
              type="button"
              onClick={() => select(action)}
              className={`rizz-action-row group flex w-full items-center gap-3 rounded-lg px-2 text-left text-[14px] font-medium leading-5 transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${
                dense ? "min-h-9" : "min-h-12"
              } ${
                action.destructive
                  ? "rizz-action-row--danger text-[#f23f43] hover:bg-[#da373c] hover:text-white"
                  : "text-[#dbdee1] hover:bg-white/[0.08] hover:text-white"
              }`}
            >
              <span
                className={`rizz-action-icon grid h-8 w-8 shrink-0 place-items-center rounded-[10px] ${
                  action.destructive
                    ? "bg-[#f23f43]/10 text-[#f23f43] group-hover:bg-white/15 group-hover:text-white"
                    : "bg-white/[0.055] text-[#b5bac1] group-hover:bg-white/10 group-hover:text-white"
                }`}
              >
                <Icon aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1 truncate">{action.label}</span>
            </button>
          </Fragment>
        );
      })}
      {actions.length === 0 && (
        <p className="px-2 py-3 text-[13px] text-[#949ba4]">No actions available</p>
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
      className={`inline-flex max-w-full rounded-[inherit] align-middle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${className ?? ""}`}
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
        {/* The overlay mounts only for the open row: 80 closed portal trees
            (focus traps, scroll locks, reaction bars) per channel was the
            long-press jank. Open animation still plays on mount. */}
        {open ? (
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent
            side="bottom"
            hideClose
            className="action-sheet rizz-action-menu z-[100] max-h-[78dvh] overflow-y-auto rounded-t-2xl border-white/[0.06] bg-[#111214] px-2 pb-[max(env(safe-area-inset-bottom),1rem)]"
          >
            {/* Kept in the tree for screen readers, hidden from view. */}
            <SheetHeader className="sr-only">
              <SheetTitle>Message actions</SheetTitle>
            </SheetHeader>
            <span aria-hidden className="mx-auto mb-1 block h-1 w-10 rounded-full bg-white/20" />
            {menuTopBar(true)}
            {showingReactions ? (
              reactionsView
            ) : (
              <>
                {previewHeader}
                {preview && <div aria-hidden className="mx-1 mb-1 h-px bg-white/[0.06]" />}
                {renderActions(false)}
              </>
            )}
          </SheetContent>
        </Sheet>
        ) : null}
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      {open ? (
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
        className={`rizz-action-menu relative max-h-[min(72dvh,30rem)] w-[min(${showingReactions ? "19.5rem" : "15.5rem"},calc(100vw-1.5rem))] overflow-y-auto rounded-lg border border-black/50 bg-[#111214] p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.55)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95`}
      >
        {menuTopBar(false)}
        {showingReactions ? (
          reactionsView
        ) : (
          <>
            {previewHeader}
            {preview && <div aria-hidden className="mx-1 mb-1 h-px bg-white/[0.06]" />}
            {renderActions(true)}
          </>
        )}
      </PopoverContent>
      ) : null}
    </Popover>
  );
}

export default MessageActionMenu;
