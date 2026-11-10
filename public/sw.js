const CACHE_NAME = "rizz-shell-v2";
const SHELL = ["/", "/manifest.webmanifest", "/rizz-pwa.svg"];
const DEFAULT_ICON = "/brand/rizz-cat-logo.svg";
const DEFAULT_BADGE = "/brand/badge-mono-96.png";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/rest/") || url.pathname.startsWith("/storage/") || url.pathname.startsWith("/auth/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match("/")) || Response.error()),
    );
    return;
  }
  if (url.pathname.startsWith("/assets/") || url.pathname === "/manifest.webmanifest" || url.pathname === "/rizz-pwa.svg") {
    event.respondWith(
      caches.match(request).then((cached) => {
        const update = fetch(request).then((response) => {
          if (response.ok)
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
          return response;
        });
        return cached || update;
      }),
    );
  }
});

function safePath(value, fallback = "/") {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : fallback;
}

function safeAsset(value, fallback) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : fallback;
}

function safeImage(value, fallback) {
  if (typeof value !== "string") return fallback;
  return (value.startsWith("/") && !value.startsWith("//")) || value.startsWith("https://")
    ? value
    : fallback;
}

function readPayload(event) {
  if (!event.data) return null;
  try {
    const parsed = event.data.json();
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return { title: "RIZZ", body: event.data.text() };
  }
}

self.addEventListener("push", (event) => {
  const payload = readPayload(event);
  if (!payload) return;

  const payloadData =
    payload.data && typeof payload.data === "object" ? payload.data : {};
  const type = String(payloadData.type || payload.type || "message");
  const url = safePath(payloadData.url ?? payload.url, "/");
  const tag = String(payload.tag || `${type}:${url}`).slice(0, 64);

  // Call cancel: remove the ringing notification instead of showing another.
  if (type === "call_cancel") {
    event.waitUntil(
      self.registration.getNotifications({ tag }).then((notifications) =>
        notifications.forEach((notification) => notification.close()),
      ),
    );
    return;
  }

  const icon = safeImage(payloadData.actor_avatar_url || payload.icon, DEFAULT_ICON);
  const badge = safeAsset(payload.badge, DEFAULT_BADGE);
  const data = { ...payloadData, url, type };
  const configuredActions = Array.isArray(payload.actions) ? payload.actions : [];
  const actions = configuredActions
    .filter((action) => action && typeof action.action === "string" && typeof action.title === "string")
    .slice(0, 2);
  const options = {
    body: String(payload.body || "You have a new notification.").slice(0, 180),
    icon,
    badge,
    tag,
    renotify: payload.renotify !== false,
    requireInteraction: Boolean(payload.requireInteraction),
    actions,
    data,
    ...(safeImage(payload.image, "")
      ? { image: safeImage(payload.image, "") }
      : {}),
  };
  const title = String(payload.title || "RIZZ").slice(0, 80);

  // If a visible client exists, hand the payload to the in-app island instead
  // of showing an OS banner. This is the only duplicate-suppression path.
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const visibleClient =
        clients.find((client) => client.visibilityState === "visible") ||
        clients.find((client) => client.focused);
      if (visibleClient) {
        visibleClient.postMessage({
          type: "SHOW_IN_APP_PILL",
          notification: { ...payload, ...options, title, data },
        });
        return;
      }
      return self.registration.showNotification(title, options);
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  const data = event.notification.data || {};
  event.notification.close();

  // A dismiss action closes the notification and does not navigate.
  if (event.action === "dismiss") return;

  let path = safePath(data.url, "/");
  if (data.call_id) {
    const callUrl = new URL(path, self.location.origin);
    callUrl.searchParams.set("callId", data.call_id);
    path = callUrl.pathname + callUrl.search;
  }
  if (event.action === "decline" && data.call_id) {
    const url = new URL(path, self.location.origin);
    url.searchParams.set("decline", "1");
    url.searchParams.set("callId", data.call_id);
    path = url.pathname + url.search;
  }

  const target = new URL(path, self.location.origin);
  if (target.origin !== self.location.origin) return;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
      for (const client of windows) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        await client.navigate(target.href);
        return client.focus();
      }
      return self.clients.openWindow(target.href);
    }),
  );
});
