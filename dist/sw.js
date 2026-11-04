// Equilibrium service worker. Its only job is notifications: Android Chrome
// can show them only through a service worker, and a click should bring the
// app back. It has no fetch handler, caches nothing and makes no requests.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || self.registration.scope + "#/today";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // includeUncontrolled lists every window on the origin, and on
      // github.io that includes other Pages sites under the same account.
      const client = windows.find((c) =>
        c.url.startsWith(self.registration.scope),
      );
      if (client) {
        await client.focus();
        client.postMessage({ type: "open-today" });
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
