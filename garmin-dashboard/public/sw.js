// Service worker för Coach OS: tar emot pushnotiser och öppnar rätt rapport.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = { title: 'Coach OS', body: e.data ? e.data.text() : '' };
  }
  e.waitUntil(
    self.registration.showNotification(d.title || 'Coach OS', {
      body: d.body || '',
      icon: '/icon-180.png',
      badge: '/icon-180.png',
      tag: d.id ? `msg-${d.id}` : undefined,
      data: { id: d.id || null },
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const id = e.notification.data && e.notification.data.id;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          c.postMessage({ open: id });
          return c.focus();
        }
      }
      return self.clients.openWindow(id ? `/?m=${id}` : '/');
    }),
  );
});
