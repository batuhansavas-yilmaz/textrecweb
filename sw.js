var OCR_CACHE = 'textrec-ocr-v1';
var OCR_PATH = new URL('vendor/paddleocr/', self.location.href).pathname;

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          if (key !== OCR_CACHE) return caches.delete(key);
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  if (req.mode === 'navigate') {
    event.respondWith(fetch(req));
    return;
  }

  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf(OCR_PATH) !== 0) return;

  event.respondWith(
    caches.open(OCR_CACHE).then(function (cache) {
      return cache.match(req).then(function (hit) {
        if (hit) return hit;
        return fetch(req).then(function (res) {
          if (res && res.status === 200) {
            var copy = res.clone();
            cache.put(req, copy).catch(function () {});
          }
          return res;
        });
      });
    })
  );
});
