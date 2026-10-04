import { supabase } from "@/integrations/supabase/client";

export type NotificationPrefs = {
  user_id: string;
  dms: boolean;
  calls: boolean;
  group_mentions: boolean;
  quiet_start: string | null;
  quiet_end: string | null;
  muted_conversations: string[];
};

export const DEFAULT_NOTIFICATION_PREFS = {
  dms: true,
  calls: true,
  group_mentions: true,
  quiet_start: null,
  quiet_end: null,
  muted_conversations: [] as string[],
};

function decodeVapidKey(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const decoded = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

function publicEnv(name: string) {
  return (import.meta.env as Record<string, string | undefined>)[name];
}

export async function enablePushNotifications(userId: string) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    throw new Error("This browser does not support web push notifications.");
  }
  const vapidPublicKey = publicEnv("VITE_VAPID_PUBLIC_KEY");
  if (!vapidPublicKey || vapidPublicKey.startsWith("REPLACE_")) {
    throw new Error("Web push is not configured yet. Add the VAPID public key after the Worker setup.");
  }
  const permission = Notification.permission === "granted"
    ? "granted"
    : await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Allow notifications in your browser settings to enable push.");

  const registration = await navigator.serviceWorker.register("/service-worker.js", { scope: "/" });
  const readyRegistration = await navigator.serviceWorker.ready;
  const target = readyRegistration.active ? readyRegistration : registration;
  const subscription = await target.pushManager.getSubscription()
    ?? await target.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeVapidKey(vapidPublicKey),
    });
  const keys = subscription.toJSON().keys;
  if (!keys?.p256dh || !keys.auth) throw new Error("The browser returned an incomplete push subscription.");

  const { error } = await (supabase.from as any)("push_subscriptions").upsert({
    user_id: userId,
    endpoint: subscription.endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
    user_agent: navigator.userAgent.slice(0, 500),
    platform: navigator.platform.slice(0, 80),
    last_used_at: new Date().toISOString(),
  }, { onConflict: "endpoint" });
  if (error) throw error;
  return subscription;
}

export async function disablePushNotifications(userId: string) {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  const { error } = await (supabase.from as any)("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", subscription.endpoint);
  if (error) throw error;
  const unsubscribed = await subscription.unsubscribe();
  if (!unsubscribed) throw new Error("The browser could not disable this subscription.");
}

export async function saveNotificationPrefs(prefs: NotificationPrefs) {
  const { error } = await (supabase.from as any)("notification_prefs").upsert(
    { ...prefs, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

export async function sendTestPush() {
  const { error } = await (supabase.rpc as any)("send_test_push");
  if (error) throw error;
}