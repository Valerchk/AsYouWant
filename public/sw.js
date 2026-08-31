/* ==========================================================================
   As You Want — service worker
   --------------------------------------------------------------------------
   Two jobs.

   Push: on Safari 18.4+ this file is barely involved, because Declarative Web
   Push renders the notification without waking a worker at all. The handler
   below is the fallback for browsers that still require one — and it reads
   the identical payload, so there is one message format in the system rather
   than two.

   Offline: an app on the home screen that shows a white page in the metro is
   a broken app, whatever it does above ground. The day itself is drawn on the
   client from data already in the browser, so serving the last shell is
   enough to make the app open and stay usable.
   ========================================================================== */

const VERSION = "v1";
const SHELL = `ayw-shell-${VERSION}`;
const ASSETS = `ayw-assets-${VERSION}`;

/* The routes worth having when there is no network. Fetched at install so the
   very first flight already has them. */
const PRECACHE = ["/today", "/inbox", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  // Take over immediately: a half-updated app is worse than a reloaded one.
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL).then((cache) =>
      // Individually, so one 401 on a protected route cannot fail the install
      // and leave the app with no worker at all.
      Promise.all(
        PRECACHE.map((url) =>
          cache.add(new Request(url, { credentials: "same-origin" })).catch(() => {}),
        ),
      ),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("ayw-") && k !== SHELL && k !== ASSETS)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  /* Never the API. These answer with somebody's day, a calendar, or an auth
     exchange; a stale one is worse than an error, and a cached one is a copy
     of private data sitting on disk for no benefit. */
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) {
    return;
  }

  /* Build output is content-hashed, so a hit is always correct and a miss is
     always worth storing. */
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(ASSETS).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  /* Pages: the network wins whenever it answers, because the page carries the
     session and a stale one can be signed out. The cache exists only for the
     case where there is no answer at all. */
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(SHELL).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((hit) => hit ?? caches.match("/today"))
            .then(
              (hit) =>
                hit ??
                new Response(
                  "<!doctype html><meta charset=utf-8><title>Offline</title>" +
                    "<body style=\"font:16px system-ui;padding:3rem;color:#3a3a38\">" +
                    "<p>No connection, and this page has not been opened here before.",
                  { headers: { "content-type": "text/html; charset=utf-8" } },
                ),
            ),
        ),
    );
  }
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
