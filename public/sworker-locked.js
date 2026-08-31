// /**
//  * GeoGebra Service Worker (Placeholder)
//  * 
//  * This is a placeholder for the GeoGebra service worker.
//  * For production, download the actual sworker-locked.js from:
//  * https://www.geogebra.org/apps/ -> GeoGebra/HTML5/5.0/web3d/sworker-locked.js
//  * 
//  * The service worker caches GeoGebra library files for faster subsequent loads.
//  * It only works on HTTPS connections.
//  */

// const CACHE_NAME = 'geogebra-cache-v1';
// const GEOGEBRA_CDN = 'https://www.geogebra.org/apps/';

// // Assets to cache
// const urlsToCache = [
//   'https://www.geogebra.org/apps/deployggb.js'
// ];

// // Install event - cache initial resources
// self.addEventListener('install', (event) => {
//   console.log('[GeoGebra SW] Installing...');
//   event.waitUntil(
//     caches.open(CACHE_NAME)
//       .then((cache) => {
//         console.log('[GeoGebra SW] Caching initial resources');
//         return cache.addAll(urlsToCache);
//       })
//       .then(() => self.skipWaiting())
//   );
// });

// // Activate event - cleanup old caches
// self.addEventListener('activate', (event) => {
//   console.log('[GeoGebra SW] Activating...');
//   event.waitUntil(
//     caches.keys().then((cacheNames) => {
//       return Promise.all(
//         cacheNames
//           .filter((name) => name !== CACHE_NAME)
//           .map((name) => caches.delete(name))
//       );
//     }).then(() => self.clients.claim())
//   );
// });

// // Fetch event - serve from cache, fallback to network
// self.addEventListener('fetch', (event) => {
//   // Only cache GeoGebra resources
//   if (event.request.url.includes('geogebra.org')) {
//     event.respondWith(
//       caches.match(event.request)
//         .then((response) => {
//           if (response) {
//             return response;
//           }
//           return fetch(event.request).then((networkResponse) => {
//             // Cache the new resource
//             if (networkResponse && networkResponse.status === 200) {
//               const responseClone = networkResponse.clone();
//               caches.open(CACHE_NAME).then((cache) => {
//                 cache.put(event.request, responseClone);
//               });
//             }
//             return networkResponse;
//           });
//         })
//     );
//   }
// });
