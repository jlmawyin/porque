// Service worker: shell + catálogo público en caché. Nunca cachea
// respuestas privadas ni mutaciones. No publica nada automáticamente.
const CACHE = 'porque-v5';
const SHELL = ['/', '/panel', '/styles.css', '/manifest.webmanifest', '/icon.svg', '/panel.js', '/i18n.mjs',
  '/img/portada-apoyo.svg', '/img/portada-artesania.svg', '/img/portada-negocio.svg', '/img/portada-huerta.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return; // mutaciones: solo red, sin caché
  if (url.pathname.startsWith('/api/') && url.pathname !== '/api/products' && !url.pathname.startsWith('/api/products/')) return;
  // Navegaciones: network-first con fallback a caché (nunca HTML antiguo).
  // No se toca localStorage/IndexedDB ni se borran datos de usuario.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then((r) => {
        if (r.ok) {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return r;
      }).catch(() => caches.match(e.request).then((hit) => hit ?? caches.match('/'))),
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then((hit) => {
      const net = fetch(e.request).then((r) => {
        if (r.ok) {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return r;
      }).catch(() => hit);
      return hit ?? net;
    }),
  );
});
