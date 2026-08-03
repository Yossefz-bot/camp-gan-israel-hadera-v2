const CACHE_NAME = 'camp-v18-smart-header';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin/')) return;

  const isNavigation = request.mode === 'navigate';
  const isCode = /\.(?:html|css|js)$/.test(url.pathname);

  // Pages and code are always checked online first so iPhone cannot stay on an old build.
  if (isNavigation || isCode) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          if (isNavigation) {
            const fallback = await caches.match('/index.html');
            if (fallback) return fallback;
          }
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        })
    );
  }
});
