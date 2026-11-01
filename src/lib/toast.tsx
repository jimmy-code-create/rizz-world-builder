import type { ReactNode } from "react";
import { toast as sonner } from "sonner";
import { GlassToast, type GlassToastAction, type GlassToastType } from "@/components/ui/GlassToast";

/**
 * The app-wide toast API.
 *
 * Every call renders one <GlassToast /> (a compact pill at the top, content
 * width) with the behaviour the product asks for:
 *   - success / error / info / warning (+ loading for progress flows),
 *   - an optional one-line message and one action button ("Retry", "Undo"),
 *   - auto-dismiss after 1.8s (2.2s info, 3.8s error, 4.5s when there is an
 *     action), paused while the card is pressed or focused,
 *   - identical calls merge instead of stacking: the same type+title+message
 *     reuses one toast id, so three failed retries never become three cards,
 *   - a repeated info/warning is ignored for six seconds instead of refreshing
 *     the card, so tapping a locked control twice cannot keep a gate on screen,
 *   - only one card can be on screen at once, so a burst of confirmations can
 *     never pile up over the page,
 *   - a light haptic on error where the device supports it.
 *
 * Import this instead of "sonner" so every popup in the app is this component.
 */

export type ToastOptions = {
  /** One short line under the title. */
  description?: string;
  /** Optional button, e.g. { label: "Retry", onClick }. */
  action?: GlassToastAction;
  /** Replace an existing toast (e.g. updating a loading toast). */
  id?: string | number;
  /** Override the auto-dismiss time in ms. */
  duration?: number;
  /** Replace the type icon with a custom glyph (e.g. a focus-mode moon). */
  icon?: ReactNode;
};

/**
 * Receipts, not announcements. A confirmation card is only useful for as long
 * as the eye needs to catch it, so routine ones leave fast; errors linger a
 * little longer because they may need acting on.
 */
const DURATIONS: Record<string, number> = {
  success: 1800,
  info: 2200,
  warning: 2800,
  error: 3800,
  loading: 3500,
};
const ACTION_DURATION = 4500;

/**
 * A gate is tapped more than once while someone works out what it means. The
 * first card already said it, so the next few taps are silent instead of
 * restarting the timer and pinning the message to the screen.
 */
const REPEAT_WINDOW_MS = 6000;
const lastShownAt = new Map<string, number>();

function shownTooRecently(id: string): boolean {
  const now = Date.now();
  const last = lastShownAt.get(id);
  if (last !== undefined && now - last < REPEAT_WINDOW_MS) return true;
  if (lastShownAt.size > 40) lastShownAt.clear();
  lastShownAt.set(id, now);
  return false;
}

function hapticError() {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(12);
  } catch {
    // Vibration is a bonus, never a failure.
  }
}

function push(type: GlassToastType, title: string, options: ToastOptions = {}) {
  const safeTitle = typeof title === "string" && title.trim() ? title : "Something went wrong";
  // Identical toasts merge: the hash id makes sonner refresh the existing card.
  const id = options.id ?? `${type}:${safeTitle}:${options.description ?? ""}`;
  const duration = options.duration ?? (options.action ? ACTION_DURATION : (DURATIONS[type] ?? 2200));
  if (type === "error") hapticError();
  // Actions (Undo, Retry) are one-off receipts and must always appear; only a
  // gating message is throttled.
  const gated = type === "info" || type === "warning";
  if (!options.action && gated && shownTooRecently(String(id))) {
    return id;
  }

  return sonner.custom(
    (toastId) => (
      <GlassToast
        type={type}
        title={safeTitle}
        message={options.description}
        action={options.action}
        icon={options.icon}
        duration={type === "loading" ? Number.POSITIVE_INFINITY : duration}
        onClose={() => sonner.dismiss(toastId)}
      />
    ),
    // The countdown runs inside <GlassToast /> so it can pause on press.
    { id, duration: Number.POSITIVE_INFINITY },
  );
}

const base = (title: string, options?: ToastOptions) => push("info", title, options);

/**
 * Callable like sonner's (`toast("Saved")`) and with the same method names, so
 * every existing call site keeps working while rendering the glass card.
 */
export const toast = Object.assign(base, {
  success: (title: string, options?: ToastOptions) => push("success", title, options),
  error: (title: string, options?: ToastOptions) => push("error", title, options),
  info: (title: string, options?: ToastOptions) => push("info", title, options),
  warning: (title: string, options?: ToastOptions) => push("warning", title, options),
  message: (title: string, options?: ToastOptions) => push("info", title, options),
  loading: (title: string, options?: ToastOptions) => push("loading", title, options),
  dismiss: (id?: string | number) => sonner.dismiss(id),
});
