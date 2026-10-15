import type { ReactNode } from "react";
import { toast as sonner } from "sonner";
import { GlassToast, type GlassToastAction, type GlassToastType } from "@/components/ui/GlassToast";

/**
 * The app-wide toast API.
 *
 * Every call renders one <GlassToast /> (top-center, glass, accent rail) with
 * the behaviour the product asks for:
 *   - success / error / info / warning (+ loading for progress flows),
 *   - an optional one-line message and one action button ("Retry", "Undo"),
 *   - auto-dismiss after 3.5s (5s when there is an action), paused while the
 *     card is pressed or focused,
 *   - identical calls merge instead of stacking: the same type+title+message
 *     reuses one toast id, so three failed retries never become three cards,
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

const BASE_DURATION = 3500;
const ACTION_DURATION = 5000;

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
  const duration = options.duration ?? (options.action ? ACTION_DURATION : BASE_DURATION);
  if (type === "error") hapticError();

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
