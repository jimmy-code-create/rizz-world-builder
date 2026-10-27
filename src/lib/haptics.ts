/**
 * Haptic Feedback Utility - Enhanced
 *
 * Provides consistent haptic feedback across the app for premium feel.
 * Supports various interaction types with appropriate vibration patterns.
 */

type HapticPattern =
  | "light" // Quick tap (10ms) - buttons, toggles
  | "medium" // Standard tap (15ms) - sends, reactions
  | "heavy" // Strong tap (25ms) - errors, important actions
  | "success" // Success pattern (10ms, 50ms, 10ms) - completed actions
  | "error" // Error pattern (50ms, 25ms, 50ms) - failed actions
  | "selection"; // Selection change (5ms) - scrolling through options

const PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 15,
  heavy: 25,
  success: [10, 50, 10],
  error: [50, 25, 50],
  selection: 5,
};

/** Two taps inside this window are the same physical press. */
const DEDUPE_MS = 90;
let lastPulseAt = 0;
let lastPattern: HapticPattern | null = null;

/** A stronger pulse may follow a generic tap (send/reaction/error), never a weaker one. */
const PRIORITY: Record<HapticPattern, number> = {
  selection: 0,
  light: 1,
  medium: 2,
  heavy: 3,
  success: 3,
  error: 4,
};

function canVibrate(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

/**
 * Trigger haptic feedback if supported by the device.
 * Safe to call on any device (and during SSR) - degrades to a no-op.
 *
 * Repeated calls in the same press are collapsed: a tap on a shared Button
 * plus a component's own reaction haptic still vibrates once.
 */
export function haptic(pattern: HapticPattern = "medium"): void {
  if (!canVibrate()) return;

  const now = Date.now();
  if (lastPattern && now - lastPulseAt < DEDUPE_MS && PRIORITY[pattern] <= PRIORITY[lastPattern]) {
    return;
  }
  lastPulseAt = now;
  lastPattern = pattern;

  try {
    navigator.vibrate(PATTERNS[pattern]);
  } catch {
    // Vibration can be blocked by the OS/browser; never let it break a tap.
  }
}

/**
 * One capture-phase listener for the whole app: every real tap on a control
 * gets the 10ms tick, including plain <button>s that predate this utility.
 * Safe to call twice - the listener is installed once per page.
 */
let tapListenerInstalled = false;

const TAP_SELECTOR =
  'button, [role="button"], [role="menuitem"], [role="tab"], [role="switch"], nav a';

export function installGlobalTapHaptics(): void {
  if (typeof window === "undefined" || tapListenerInstalled) return;
  tapListenerInstalled = true;

  window.addEventListener(
    "pointerdown",
    (event) => {
      if (event.pointerType === "mouse" || !event.isPrimary) return;
      const target = event.target as Element | null;
      const control = target?.closest?.(TAP_SELECTOR) as HTMLElement | null;
      if (!control) return;
      if (control.hasAttribute("disabled") || control.getAttribute("aria-disabled") === "true")
        return;
      hapticButton();
    },
    { capture: true, passive: true },
  );
}

/**
 * Haptic feedback for button presses
 */
export function hapticButton(): void {
  haptic("light");
}

/**
 * Haptic feedback for sending messages/posts
 */
export function hapticSend(): void {
  haptic("medium");
}

/**
 * Haptic feedback for reactions
 */
export function hapticReaction(): void {
  haptic("medium");
}

/**
 * Haptic feedback for successful actions
 */
export function hapticSuccess(): void {
  haptic("success");
}

/**
 * Haptic feedback for errors
 */
export function hapticError(): void {
  haptic("error");
}

/**
 * Haptic feedback for long press detection
 */
export function hapticLongPress(): void {
  haptic("heavy");
}

/**
 * Haptic feedback for story transitions
 */
export function hapticStoryTransition(): void {
  haptic("light");
}

/**
 * Haptic feedback for joining voice room
 */
export function hapticVoiceJoin(): void {
  haptic("success");
}

/**
 * Haptic feedback for leaving voice room
 */
export function hapticVoiceLeave(): void {
  haptic("medium");
}

/**
 * Haptic feedback for scrolling through items
 */
export function hapticSelection(): void {
  haptic("selection");
}

/**
 * Check if haptic feedback is supported
 */
export function isHapticSupported(): boolean {
  return canVibrate();
}

/**
 * React hook for haptic feedback
 */
export function useHaptic() {
  return {
    button: hapticButton,
    send: hapticSend,
    reaction: hapticReaction,
    success: hapticSuccess,
    error: hapticError,
    longPress: hapticLongPress,
    storyTransition: hapticStoryTransition,
    voiceJoin: hapticVoiceJoin,
    voiceLeave: hapticVoiceLeave,
    selection: hapticSelection,
    isSupported: isHapticSupported(),
  };
}
