/**
 * Lightweight bridge for in-app notifications.
 *
 * No window/document access at module level, so it is safe to import during
 * SSR. The service worker posts SHOW_IN_APP_PILL messages to the window; the
 * RizzInAppPill component listens for them and re-dispatches through here.
 * TestNotificationsPanel also calls dispatchInAppNotification directly for
 * test pills.
 */

export type InAppNotification = {
  id: string;
  type: "dm" | "mention" | "reaction" | "paws_gift" | "voice_room";
  actor: string | null;
  body: string | null;
  target_url: string | null;
  avatar_url: string | null;
  created_at: string;
  is_test?: boolean;
};

const subscribers = new Set<(notification: InAppNotification) => void>();

export function subscribeToInAppNotifications(
  callback: (notification: InAppNotification) => void,
) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

export function dispatchInAppNotification(notification: InAppNotification) {
  subscribers.forEach((callback) => callback(notification));
}
