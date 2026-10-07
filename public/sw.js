/* SetList service worker: cache-first for the app shell, network-first for APIs. */
const VERSION = 'setlist-v2';
const SHELL = ['./', './index.html', './sets/', './offline/', './chords/', './scales/', './data/chordidx.json.gz', './data/chordidx.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(VERSION)
      .then((c) => c.addAll(SHELL).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  const isAPI =
    url.hostname === 'itunes.apple.com' ||
    url.hostname === 'lrclib.net' ||
    url.hostname === 'datasets-server.huggingface.co';

  if (isAPI) {
    // Network-first, fall back to cache when offline.
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // App shell: cache-first, refresh in background; fall back to network when uncached.
  e.respondWith(
    caches.match(e.request, { ignoreSearch: url.pathname.endsWith('/') }).then((hit) => {
      const refresh = fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || refresh;
    })
  );
});
