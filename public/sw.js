/* ==========================================================================
   As You Want — service worker
   --------------------------------------------------------------------------
   Kept deliberately small. On Safari 18.4+ this file is barely involved:
   Declarative Web Push renders the notification without waking a worker at
   all. Everything here is the fallback path for browsers that still require
   a push handler — and it reads the identical payload, so there is one
   message format in the system rather than two.
   ========================================================================== */

self.addEventListener("install", () => {
  // Take over immediately; there is no cached shell whose version could
  // conflict with a newly deployed one.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  // Same shape Safari consumes declaratively.
  const n = payload.notification;
  if (!n || !n.title) return;

  const shown = self.registration.showNotification(n.title, {
    body: n.body,
    tag: n.tag,
    // Matching tags replace rather than stack: this is what turns a stream of
    // reminders into one card that stays current.
    renotify: false,
    silent: Boolean(n.silent),
    data: { navigate: n.navigate },
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-72.png",
  });

  const badged =
    typeof n.app_badge === "number" && self.navigator.setAppBadge
      ? n.app_badge > 0
        ? self.navigator.setAppBadge(n.app_badge)
        : self.navigator.clearAppBadge()
      : Promise.resolve();

  event.waitUntil(Promise.all([shown, badged]));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.navigate || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Focus an open window rather than stacking up new ones — on iOS a
        // second window means losing whatever was on screen.
        for (const client of clients) {
          if ("focus" in client) {
            client.navigate(target);
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      }),
  );
});
