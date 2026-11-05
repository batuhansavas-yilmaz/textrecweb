var SHELL_CACHE = 'textrec-shell-v62';
var OCR_CACHE = 'textrec-ocr-v2';
var OCR_PATH = new URL('vendor/paddleocr/', self.location.href).pathname;
var APP_SHELL = [
  './',
  './index.html',
  './privacy/index.html',
  './style.css',
  './app.js',
  './strings.js',
  './orientation-guard.js',
  './firebase-extras.js',
  './manifest.webmanifest',
  './vendor/pdfjs/pdf.min.js',
  './vendor/pdfjs/pdf.worker.min.js',
  './vendor/Rubik.ttf',
  './assets/apple-touch-icon.png',
  './assets/crop.png',
  './assets/favicon-32.png',
  './assets/favicon.ico',
  './assets/github-button.png',
  './assets/frombsy-icon.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-512.png',
  './assets/icon-maskable.svg',
  './assets/icon.svg',
  './assets/toolbox-close.webp',
  './assets/warning.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil((async function () {
    var cache = await caches.open(SHELL_CACHE);
    await Promise.all(APP_SHELL.map(function (url) {
      return cache.add(url).catch(function () {});
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    var keys = await caches.keys();
    await Promise.all(keys.map(function (key) {
      if (key !== SHELL_CACHE && key !== OCR_CACHE) return caches.delete(key);
    }));
    var cache = await caches.open(SHELL_CACHE);
    await Promise.all(APP_SHELL.map(function (url) {
      return cache.match(url).then(function (hit) {
        return hit || cache.add(url).catch(function () {});
      });
    }));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var reqPath = '';
  try { reqPath = new URL(req.url).pathname; } catch (e) {}
  if (req.mode === 'navigate' && /\/privacy\/?$/.test(reqPath)) {
    event.respondWith((async function () {
      var cached = await caches.match('./privacy/index.html');
      if (cached) return cached;
      try {
        var res = await fetch(req);
        if (res && res.ok) {
          var cache = await caches.open(SHELL_CACHE);
          cache.put('./privacy/index.html', res.clone());
        }
        return res;
      } catch (e) {
        return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith((async function () {
      var cached = await caches.match('./index.html');
      if (cached) return cached;
      try {
        var res = await fetch(req);
        if (res && res.ok) {
          var cache = await caches.open(SHELL_CACHE);
          cache.put('./index.html', res.clone());
        }
        return res;
      } catch (e) {
        return (await caches.match('./')) || new Response('Offline', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
    })());
    return;
  }

  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;

  if (url.pathname.indexOf(OCR_PATH) === 0) {
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
    return;
  }

  event.respondWith(
    caches.open(SHELL_CACHE).then(function (cache) {
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
