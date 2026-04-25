const CACHE_VERSION = 'alphaai-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;
const PAGE_CACHE = `${CACHE_VERSION}-pages`;

// Static assets to pre-cache
const STATIC_ASSETS = [
  '/logo.svg',
  '/logo.png',
  '/logo-clean.png',
  '/manifest.json',
];

// Install: pre-cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('alphaai-') && name !== CACHE_VERSION)
          .flatMap((name) => [
            caches.delete(`${name}-static`),
            caches.delete(`${name}-api`),
            caches.delete(`${name}-pages`),
          ])
      );
    })
  );
  self.clients.claim();
});

// Fetch: route by request type
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) return;

  // API calls: network-first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE, 3600)); // 1 hour TTL
    return;
  }

  // Page navigation: stale-while-revalidate
  if (request.mode === 'navigate') {
    event.respondWith(staleWhileRevalidate(request, PAGE_CACHE));
    return;
  }

  // Static assets (images, fonts, etc.): cache-first
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE, 86400)); // 24 hour TTL
    return;
  }
});

// ---- Strategies ----

async function cacheFirst(request, cacheName, maxAgeSeconds) {
  const cached = await caches.match(request);
  if (cached) {
    const cachedTime = cached.headers.get('sw-cache-time');
    if (cachedTime) {
      const age = (Date.now() - parseInt(cachedTime, 10)) / 1000;
      if (age < maxAgeSeconds) {
        return cached;
      }
    }
    // Expired — still serve but refresh in background
    fetchAndCache(request, cacheName);
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      const cloned = response.clone();
      const headers = new Headers(cloned.headers);
      headers.set('sw-cache-time', Date.now().toString());
      const body = await cloned.blob();
      cache.put(request, new Response(body, { headers }));
    }
    return response;
  } catch {
    return offlineFallback();
  }
}

async function networkFirst(request, cacheName, maxAgeSeconds) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      const cloned = response.clone();
      const headers = new Headers(cloned.headers);
      headers.set('sw-cache-time', Date.now().toString());
      const body = await cloned.blob();
      cache.put(request, new Response(body, { headers }));
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) {
      const cachedTime = cached.headers.get('sw-cache-time');
      if (cachedTime) {
        const age = (Date.now() - parseInt(cachedTime, 10)) / 1000;
        if (age < maxAgeSeconds) {
          return cached;
        }
      }
      return cached;
    }
    return offlineFallback();
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

async function fetchAndCache(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
  } catch {
    // Silently fail — this is a background refresh
  }
}

function offlineFallback() {
  return new Response(
    '<html><body><h1>Offline</h1><p>Du er offline. Prøv igen senere.</p></body></html>',
    {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      status: 503,
    }
  );
}

function isStaticAsset(url) {
  const staticExtensions = [
    '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp',
    '.woff', '.woff2', '.ttf', '.eot', '.otf', '.ico', '.json',
  ];
  return staticExtensions.some((ext) => url.pathname.endsWith(ext));
}
