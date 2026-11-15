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

// ── «Compartir» desde otras apps (Android, con la web instalada) ──
// El menú de compartir manda las fotos y el texto aquí (ver share_target en el
// manifiesto). Se guardan en el almacén del navegador y se abre la pantalla
// «Guardar en Junti», que los recoge.
function guardarCompartido(value) {
  return new Promise((ok, ko) => {
    const r = indexedDB.open('junti-compartir', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('pendiente');
    r.onerror = () => ko(r.error);
    r.onsuccess = () => {
      const tx = r.result.transaction('pendiente', 'readwrite');
      tx.objectStore('pendiente').put(value, 'ultimo');
      tx.oncomplete = () => {
        r.result.close();
        ok();
      };
      tx.onerror = () => ko(tx.error);
    };
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'POST') return;
  const url = new URL(req.url);
  if (!url.pathname.endsWith('/compartir')) return;
  event.respondWith(
    (async () => {
      try {
        const form = await req.formData();
        const files = form.getAll('media').filter((f) => typeof f !== 'string');
        const text = ['title', 'text', 'url']
          .map((k) => form.get(k))
          .filter((v) => typeof v === 'string' && v.trim())
          .join('\n');
        await guardarCompartido({ files, text });
      } catch (e) {
        // si algo falla, se abre igualmente la pantalla (dirá que no hay nada)
      }
      return Response.redirect(self.registration.scope + 'compartir?recibido=1', 303);
    })(),
  );
});
