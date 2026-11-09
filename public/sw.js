const CACHE_NAME = "rizz-shell-v1";
const SHELL = ["/", "/manifest.webmanifest", "/rizz-pwa.svg"];

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

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "RIZZ", body: event.data.text() };
  }

  // Call cancel: close any matching notification instead of showing one.
  if (payload.type === "call_cancel") {
    event.waitUntil(
      self.registration.getNotifications({ tag: payload.tag }).then((notifications) =>
        notifications.forEach((notification) => notification.close()),
      ),
    );
    return;
  }

  // Structured payload fields (see backend-sql/10_push.sql send_push payload shape):
  // title, body, icon, badge, tag, renotify, data.url, data.type, data.actions, image.
  const title = payload.title || "RIZZ";
  const options = {
    body: payload.body || "You have a new notification.",
    icon: payload.icon || "/rizz-pwa.svg",
    badge: payload.badge || "/rizz-pwa.svg",
    tag: payload.tag || "rizz-notification",
    renotify: payload.renotify !== false,
    requireInteraction: Boolean(payload.requireInteraction),
    actions: payload.actions || [],
    data: {
      url: payload.url || "/",
      type: payload.type || "message",
      ...(payload.data || {}),
    },
    // Optional rich-media image banner. No image generator exists in the repo yet,
    // so this is left unset unless the payload explicitly carries one. TODO: wire
    // up an image generator here when one exists (payload.image).
    ...(payload.image ? { image: payload.image } : {}),
  };

  // If a focused/visible client exists, do NOT show the OS notification. Tell the
  // client to show the in-app pill instead so there is never a duplicate alert.
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const visibleClient =
        clients.find((client) => client.visibilityState === "visible") ||
        clients.find((client) => client.focused);
      if (visibleClient) {
        visibleClient.postMessage({ type: "SHOW_IN_APP_PILL", notification: payload });
        return;
      }
      return self.registration.showNotification(title, options);
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  const data = event.notification.data || {};
  event.notification.close();
  let path = typeof data.url === "string" ? data.url : "/";
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
