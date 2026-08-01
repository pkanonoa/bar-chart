const CACHE_NAME = 'bar-chart-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(['/']);
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Try network first, then cache
  event.respondWith(
    fetch(event.request).catch(async () => {
      const response = await caches.match(event.request);
      if (response) {
        return response;
      }
      
      // If it's a navigation request and we're offline, fallback to home page
      if (event.request.mode === 'navigate') {
        const homeResponse = await caches.match('/');
        if (homeResponse) {
          return homeResponse;
        }
      }
      
      // Return a 503 fallback response so the browser doesn't throw ERR_FAILED
      return new Response("Offline", {
        status: 503,
        statusText: "Service Unavailable"
      });
    })
  );
});
