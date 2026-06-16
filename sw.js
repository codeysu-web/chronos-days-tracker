var CACHE_NAME = 'chronos-v1';
var ASSETS = [
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install — cache all files
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS);
    }).then(function() {
      return self.skipWaiting(); // moved inside waitUntil
    })
  );
});

// Activate — clean old caches
self.addEventListener('activate', function(e) {
  e.waitUntil(
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

// Fetch — serve from cache, fallback to network
self.addEventListener('fetch', function(e) {
  // Only handle GET requests
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      return cached || fetch(e.request).catch(function() {
        // If network fails and no cache, return offline page
        return caches.match('./index.html');
      });
    })
  );
});

// Show notification from message
self.addEventListener('message', function(e) {
  if (!e.data || e.data.type !== 'SHOW_NOTIFICATION') return;
  var d = e.data;
  e.waitUntil(
    self.registration.showNotification(d.title, {
      body:               d.body,
      icon:               './icon-192.png',
      badge:              './icon-192.png',
      tag:                d.tag || d.title,
      vibrate:            [200, 100, 200],
      requireInteraction: false,
      data:               { url: './index.html' }
    })
  );
});

// Notification click — open app
self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(list) {
        for (var i = 0; i < list.length; i++) {
          if (list[i].url.indexOf('index.html') !== -1 && 'focus' in list[i]) {
            return list[i].focus();
          }
        }
        return clients.openWindow('./index.html');
      })
  );
});