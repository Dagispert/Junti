// Junti · recibe los avisos cuando la app está cerrada y abre el grupo al tocarlos.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Aviso sin contenido legible: se muestra uno genérico.
  }
  const scope = self.registration.scope; // p. ej. https://…/Junti/
  event.waitUntil(
    self.registration.showNotification(data.title || 'Junti', {
      body: data.body || 'Hay una propuesta nueva en tu grupo.',
      icon: scope + 'icon-192.png',
      badge: scope + 'icon-192.png',
      tag: data.groupId || 'junti',
      data: { url: data.groupId ? scope + 'group/' + data.groupId : scope },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
