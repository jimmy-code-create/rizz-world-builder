const WORKER_PATH = "/service-worker.js";
const DEFAULT_ICON = "/brand/rizz-cat-logo.svg";

export type DesktopAlertPermission = NotificationPermission | "unsupported";

export function desktopAlertsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function desktopAlertPermission(): DesktopAlertPermission {
  return desktopAlertsSupported() ? Notification.permission : "unsupported";
}

export async function requestDesktopAlerts(): Promise<DesktopAlertPermission> {
  if (!desktopAlertsSupported()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

async function notificationWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration("/");
    if (existing) return existing;
    return await navigator.serviceWorker.register(WORKER_PATH, { scope: "/" });
  } catch {
    // No worker: the constructor path below still works on desktop browsers.
    return null;
  }
}

export type DesktopAlertInput = {
  title: string;
  body?: string;
  icon?: string;
  tag?: string;
  /** Opened when the alert is clicked. */
  url?: string;
};

/**
 * Shows a system notification — the Discord-style pop-up people expect when a
 * DM lands while the tab is in the background.
 *
 * Uses the service worker when the browser has one (required on Android), and
 * falls back to the Notification constructor on desktop. Nothing is shown
 * unless the user has already granted permission.
 */
export async function showDesktopAlert(input: DesktopAlertInput): Promise<boolean> {
  if (!desktopAlertsSupported() || Notification.permission !== "granted") return false;
  const icon = input.icon || DEFAULT_ICON;
  const options: NotificationOptions = {
    body: input.body ?? "",
    icon,
    badge: DEFAULT_ICON,
    tag: input.tag ?? "rizz-dm",
    data: { url: input.url ?? "/" },
  };

  const registration = await notificationWorker();
  if (registration) {
    try {
      await registration.showNotification(input.title, options);
      return true;
    } catch {
      // Fall through to the constructor.
    }
  }

  try {
    const notification = new Notification(input.title, options);
    notification.onclick = () => {
      window.focus();
      if (input.url) window.location.assign(input.url);
      notification.close();
    };
    return true;
  } catch {
    return false;
  }
}
