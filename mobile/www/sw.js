const CACHE_NAME = 'dterm-pwa-v13';
const SHELL_URLS = [
  '/dterm/pwa/',
  '/dterm/pwa/index.html',
  '/dterm/pwa/styles.css',
  '/dterm/pwa/app.js',
  '/dterm/pwa/api.js',
  '/dterm/pwa/tools.js',
  '/dterm/pwa/manifest.json',
  '/dterm/pwa/icons/icon-192.png',
  '/dterm/pwa/icons/icon-512.png'
];

const API_CACHE = 'dterm-pwa-api-v1';

// Install - precache shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate - clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== API_CACHE).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // API requests - network first, no caching for POST (Cache API doesn't support POST)
  if (url.pathname.includes('/dterm/api/')) {
    return;
  }

  // Shell files - cache first with network fallback
  if (url.pathname.startsWith('/dterm/pwa/')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const fetchPromise = fetch(event.request).then(res => {
          if (res.ok) {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
          }
          return res;
        }).catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }
});

// Push notification received
self.addEventListener('push', event => {
  let data = { title: 'dTerm', body: 'You have a new notification' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/dterm/pwa/icons/icon-192.png',
    badge: '/dterm/pwa/icons/icon-192.png',
    tag: data.type || 'general',
    data: {
      url: data.url || '/dterm/pwa/',
      type: data.type
    },
    vibrate: [200, 100, 200],
    actions: []
  };

  // Add action based on type
  if (data.type === 'uptime_down') {
    options.requireInteraction = true;
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click - open/focus PWA
self.addEventListener('notificationclick', event => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/dterm/pwa/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // Focus existing window if open
      for (const client of clients) {
        if (client.url.includes('/dterm/pwa/') && 'focus' in client) {
          client.focus();
          client.postMessage({
            type: 'notification-click',
            url: targetUrl,
            notificationType: event.notification.data?.type
          });
          return;
        }
      }
      // Otherwise open new window
      return self.clients.openWindow(targetUrl);
    })
  );
});
