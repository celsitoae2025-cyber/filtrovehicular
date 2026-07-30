/* ============================================================
   SERVICE WORKER — Filtro Vehicular+
   Estrategias:
     - HTML / app shell: network-first con timeout (5s) → fallback cache
     - JS / CSS:         stale-while-revalidate
     - Imágenes / fonts: cache-first con expiración por límite de entradas
     - Resto (API, supabase, bridge, MP): NEVER cache (passthrough)

   Versionado: cualquier cambio aquí incrementa CACHE_VERSION para
   invalidar cachés viejos automáticamente al activarse.
============================================================ */

// IMPORTANTE: incrementar CACHE_VERSION en cada deploy para que los usuarios
// reciban las actualizaciones de JS/CSS/HTML automáticamente.
const CACHE_VERSION = "v1.0.6-20260730";
const SHELL_CACHE = "fv-shell-" + CACHE_VERSION;
const ASSETS_CACHE = "fv-assets-" + CACHE_VERSION;
const IMG_CACHE = "fv-img-" + CACHE_VERSION;

// Recursos críticos que se precachean al instalar.
// Mantener pequeño: solo lo imprescindible para que la app levante offline.
const PRECACHE_URLS = [
  "/",
  "/app.html",
  "/manifest.json",
  "/icons/favicon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

const MAX_IMG_ENTRIES = 80;
const NETWORK_TIMEOUT_MS = 5000;

// Hosts que NUNCA se cachean (datos dinámicos / privados).
const NEVER_CACHE_HOSTS = [
  "supabase.co",
  "supabase.in",
  "mercadopago.com",
  "mercadolibre.com",
  "api.json.pe",
  "filtro-bridge",
  "railway.app",
  "telegram.org",
];

// ---------- INSTALL ----------
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(function (cache) {
      return cache.addAll(PRECACHE_URLS).catch(function (err) {
        // Si alguna URL del shell falla, no bloqueamos la instalación —
        // se cacheará luego al navegar a ella.
        console.warn("[sw] precache parcial:", err);
      });
    }),
  );
  self.skipWaiting();
});

// ---------- ACTIVATE ----------
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (k) {
          // Borrar cachés de versiones anteriores
          if (
            k !== SHELL_CACHE &&
            k !== ASSETS_CACHE &&
            k !== IMG_CACHE
          ) {
            return caches.delete(k);
          }
        }),
      );
    }).then(function () {
      return self.clients.claim();
    }),
  );
});

// ---------- HELPERS ----------
function isNeverCacheUrl(url) {
  try {
    var u = new URL(url);
    return NEVER_CACHE_HOSTS.some(function (h) {
      return u.hostname.indexOf(h) !== -1;
    });
  } catch (_) { return true; }
}

function isHTMLRequest(req) {
  if (req.mode === "navigate") return true;
  var accept = req.headers.get("accept") || "";
  return accept.indexOf("text/html") !== -1;
}

function isStaticAsset(url) {
  return /\.(?:js|css|woff2?|ttf|otf)(?:$|\?)/i.test(url);
}

function isImage(url) {
  return /\.(?:png|jpg|jpeg|gif|webp|svg|ico)(?:$|\?)/i.test(url);
}

function trimCache(cacheName, maxEntries) {
  caches.open(cacheName).then(function (cache) {
    cache.keys().then(function (keys) {
      if (keys.length <= maxEntries) return;
      var excess = keys.length - maxEntries;
      for (var i = 0; i < excess; i++) cache.delete(keys[i]);
    });
  });
}

// Network-first con timeout — para HTML.
function networkFirst(req, cacheName) {
  return new Promise(function (resolve) {
    var done = false;
    var timer = setTimeout(function () {
      if (done) return;
      caches.match(req).then(function (cached) {
        if (cached) { done = true; resolve(cached); }
      });
    }, NETWORK_TIMEOUT_MS);

    fetch(req).then(function (res) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      // Solo cachear respuestas OK same-origin
      if (res && res.ok && res.type === "basic") {
        var copy = res.clone();
        caches.open(cacheName).then(function (c) { c.put(req, copy); });
      }
      resolve(res);
    }).catch(function () {
      if (done) return;
      done = true;
      clearTimeout(timer);
      caches.match(req).then(function (cached) {
        if (cached) resolve(cached);
        else resolve(new Response("Offline", { status: 503, statusText: "Offline" }));
      });
    });
  });
}

// Stale-while-revalidate — para JS/CSS/fonts.
function staleWhileRevalidate(req, cacheName) {
  return caches.open(cacheName).then(function (cache) {
    return cache.match(req).then(function (cached) {
      var network = fetch(req).then(function (res) {
        if (res && res.ok && (res.type === "basic" || res.type === "cors")) {
          cache.put(req, res.clone());
        }
        return res;
      }).catch(function () { return cached || Response.error(); });
      return cached || network;
    });
  });
}

// Cache-first con límite de entradas — para imágenes.
function cacheFirst(req, cacheName, maxEntries) {
  return caches.open(cacheName).then(function (cache) {
    return cache.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (res) {
        if (res && res.ok) {
          cache.put(req, res.clone());
          if (maxEntries) trimCache(cacheName, maxEntries);
        }
        return res;
      });
    });
  });
}

// ---------- FETCH ----------
self.addEventListener("fetch", function (event) {
  var req = event.request;

  // Solo manejamos GET. POST/PUT/DELETE pasan directo.
  if (req.method !== "GET") return;

  var url = req.url;

  // Hosts dinámicos / privados → passthrough (no tocar)
  if (isNeverCacheUrl(url)) return;

  // Same-origin policy: no interferimos con cross-origin no contemplado
  // (analytics, fonts, CDNs) salvo que sea Google Fonts (cache de assets).
  var sameOrigin = false;
  try { sameOrigin = new URL(url).origin === self.location.origin; } catch (_) {}

  if (isHTMLRequest(req)) {
    event.respondWith(networkFirst(req, SHELL_CACHE));
    return;
  }

  if (sameOrigin && isStaticAsset(url)) {
    // En localhost (desarrollo) NO cachear — siempre pedir red para
    // que los cambios de CSS/JS se vean inmediatamente
    var host = self.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.')) {
      event.respondWith(fetch(req));
      return;
    }
    event.respondWith(staleWhileRevalidate(req, ASSETS_CACHE));
    return;
  }

  if (sameOrigin && isImage(url)) {
    event.respondWith(cacheFirst(req, IMG_CACHE, MAX_IMG_ENTRIES));
    return;
  }

  // Google Fonts (CSS + woff): stale-while-revalidate, son seguros y públicos.
  if (/fonts\.(googleapis|gstatic)\.com/.test(url)) {
    event.respondWith(staleWhileRevalidate(req, ASSETS_CACHE));
    return;
  }

  // Por defecto: passthrough
});

// Permitir que la página fuerce skipWaiting al detectar nueva versión.
self.addEventListener("message", function (event) {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
