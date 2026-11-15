const CACHE = 'mi-mundo-v2';
const BASE = ['/', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASE)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.pathname.startsWith('/api/')) return;               // la IA siempre por red
  // Pictogramas ARASAAC: primero caché (no cambian), así funcionan sin internet
  if (u.hostname === 'static.arasaac.org') {
    e.respondWith(caches.match(r).then((hit) => hit || fetch(r).then((res) => {
      if (res.ok || res.type === 'opaque') { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(r, cp)); }
      return res;
    }).catch(() => new Response('', { status: 504 }))));
    return;
  }
  if (u.origin !== location.origin) return;
  // Resto: primero red (siempre la versión nueva), caché si no hay internet
  e.respondWith(fetch(r).then((res) => {
    if (res.ok) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(r, cp)); }
    return res;
  }).catch(() => caches.match(r).then((hit) => hit || caches.match('/'))));
});
