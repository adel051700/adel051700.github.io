// Service Worker for PWA functionality
const CACHE_VERSION = 'v1';
const CACHE_NAME = `order-crazy-${CACHE_VERSION}`;

const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/game.js',
    '/supabase-config.js',
    '/service-worker.js',
    'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect fill="%23ff6b6b" width="192" height="192"/><text x="50%" y="50%" font-size="100" fill="white" text-anchor="middle" dominant-baseline="central">🍔</text></svg>'
];

// Install event - cache files
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(urlsToCache).catch(err => {
                    console.warn('Some assets failed to cache:', err);
                    // Don't fail installation if some assets can't be cached
                    return Promise.resolve();
                });
            })
    );
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Skip file:// protocol requests (for local testing)
    if (event.request.url.startsWith('file://')) {
        return;
    }

    // Network first for API calls
    if (event.request.url.includes('supabase')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Cache successful API responses
                    if (response.ok) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Return cached response if offline
                    return caches.match(event.request);
                })
        );
    } else {
        // Cache first for static assets
        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    if (response) {
                        return response;
                    }
                    
                    return fetch(event.request)
                        .then(response => {
                            // Don't cache non-successful responses
                            if (!response || response.status !== 200 || response.type !== 'basic') {
                                return response;
                            }

                            const responseClone = response.clone();
                            caches.open(CACHE_NAME)
                                .then(cache => {
                                    cache.put(event.request, responseClone);
                                });

                            return response;
                        })
                        .catch(() => {
                            // Return a fallback response if offline
                            if (event.request.destination === 'image') {
                                return caches.match('/images/offline.png');
                            }
                            return new Response('Offline - please check your connection');
                        });
                })
        );
    }
});

// Background sync for offline score submissions
self.addEventListener('sync', event => {
    if (event.tag === 'sync-scores') {
        event.waitUntil(
            // Sync pending scores when connection is restored
            (async () => {
                // Implementation would go here
                console.log('Syncing offline scores...');
            })()
        );
    }
});
