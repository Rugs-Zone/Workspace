// Rugs Creation Workspace — service worker (makes the site installable as an app).
// Safe by design: the Workspace page is always fetched fresh from the network (so a new upload shows at once);
// the last good copy is kept only as an offline fallback. Supabase / Google / any other site is never touched.
const CACHE = 'rz-shell-v1';
const STATIC = ['./manifest.json', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)).catch(() => {})); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('message', e => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== self.location.origin) return;           // never touch other sites
  if (req.mode === 'navigate') {                                                           // the Workspace page: network first
    e.respondWith(fetch(req).then(r => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put('./', cp)); } return r; })
      .catch(() => caches.match('./').then(r => r || new Response('<h2 style="font-family:sans-serif">You are offline — connect to the internet and try again.</h2>', { headers: { 'Content-Type': 'text/html' } }))));
    return;
  }
  if (STATIC.some(p => url.pathname.endsWith(p.replace('./', '/')))) e.respondWith(caches.match(req).then(r => r || fetch(req)));
});
