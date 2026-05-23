// Papyrus eReader - Service Worker
// Cache-on-fetch strategy: pre-cache the app shell on install, then cache
// every same-origin asset dynamically so the full app is available offline
// after the first complete load.

const CACHE_NAME = 'papyrus-v38';

// Critical shell assets — cached at install time so the app can boot offline
const SHELL_ASSETS = [
    './index.html',
    './manifest.json',
    './enyo/enyo.js',
    './webos-compat.js',
    './depends.js',
    './icon.png',
    './icon-256.png',
    './icons/192.png',
    './icons/512.png'
];

self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(SHELL_ASSETS);
        }).then(function() {
            return self.skipWaiting();
        })
    );
});

self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(
                keys.filter(function(k) { return k !== CACHE_NAME; })
                    .map(function(k) { return caches.delete(k); })
            );
        }).then(function() {
            return self.clients.claim();
        })
    );
});

// Cache-first for same-origin GET requests; network-fallback with dynamic caching.
// This means the first full page load populates the cache; subsequent loads
// (including offline) are served entirely from cache.
self.addEventListener('fetch', function(event) {
    var request = event.request;

    if (request.method !== 'GET') return;

    var url = new URL(request.url);
    if (url.origin !== location.origin) return;

    event.respondWith(
        caches.match(request).then(function(cached) {
            if (cached) return cached;

            return fetch(request).then(function(response) {
                if (response.status === 200) {
                    var clone = response.clone();
                    caches.open(CACHE_NAME).then(function(cache) {
                        cache.put(request, clone);
                    });
                }
                return response;
            }).catch(function() {
                // Offline fallback for navigation requests
                if (request.destination === 'document') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});
