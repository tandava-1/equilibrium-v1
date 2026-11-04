// Equilibrium service worker. Its only job is notifications: Android Chrome
// can show them only through a service worker, and a click should bring the
// app back. It has no fetch handler, caches nothing and makes no requests.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/#/today";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const client = windows[0];
      if (client) {
        await client.focus();
        client.postMessage({ type: "open-today" });
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
