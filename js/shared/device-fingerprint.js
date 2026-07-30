// ============================================================
// Consultia.DeviceFingerprint
// ------------------------------------------------------------
// Genera un identificador único del navegador/dispositivo usando
// FingerprintJS Open Source (CDN). Funciona aunque el usuario
// borre cookies, use incógnito o cambie de IP.
//
// Uso:
//   var visitorId = await Consultia.DeviceFingerprint.get();
//
// Internamente cachea el resultado en memoria + sessionStorage
// para no recalcularlo en cada llamada.
//
// Si la librería no está disponible (CDN bloqueado, sin red), la
// función retorna null. El backend lo trata como "sin fingerprint"
// y NO bloquea el registro — solo no aplica la regla anti-duplicado.
// ============================================================
(function () {
  window.Consultia = window.Consultia || {};

  var SESSION_KEY = 'consultia_device_fp_v1';
  var FPJS_CDN = 'https://openfpcdn.io/fingerprintjs/v4';

  var cached = null;       // visitor_id en memoria
  var loadingPromise = null;

  // Lee cache de sessionStorage (mismo browser, misma pestaña)
  function readCache() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      // Cache válido por 1 hora
      if (obj && obj.id && obj.t && (Date.now() - obj.t) < 3600000) {
        return obj.id;
      }
      return null;
    } catch (e) { return null; }
  }

  function writeCache(id) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        id: id, t: Date.now()
      }));
    } catch (e) { /* ignore */ }
  }

  // Carga la librería FingerprintJS dinámicamente (UMD desde CDN)
  function loadLibrary() {
    if (window.FingerprintJS) return Promise.resolve(window.FingerprintJS);
    if (loadingPromise) return loadingPromise;

    loadingPromise = new Promise(function (resolve, reject) {
      // FingerprintJS v4 OSS se distribuye como ESM. Lo importamos
      // dinámicamente y exponemos a window.FingerprintJS para reuso.
      var script = document.createElement('script');
      script.type = 'module';
      script.textContent =
        "import FingerprintJS from '" + FPJS_CDN + "';" +
        "window.FingerprintJS = FingerprintJS;" +
        "window.dispatchEvent(new Event('fpjs-ready'));";
      var timeout = setTimeout(function () {
        reject(new Error('FingerprintJS load timeout'));
      }, 8000);
      window.addEventListener('fpjs-ready', function onReady() {
        clearTimeout(timeout);
        window.removeEventListener('fpjs-ready', onReady);
        resolve(window.FingerprintJS);
      });
      script.onerror = function () {
        clearTimeout(timeout);
        reject(new Error('FingerprintJS CDN error'));
      };
      document.head.appendChild(script);
    });

    return loadingPromise;
  }

  // API pública
  Consultia.DeviceFingerprint = {
    /**
     * Devuelve el visitor_id (string ~40 chars) del navegador actual.
     * Si falla por cualquier motivo, retorna null (no rompe el flujo).
     */
    get: async function () {
      // 1) Cache en memoria
      if (cached) return cached;

      // 2) Cache en sessionStorage
      var fromSession = readCache();
      if (fromSession) { cached = fromSession; return cached; }

      // 3) Calcular nuevo
      try {
        var FP = await loadLibrary();
        var fp = await FP.load();
        var result = await fp.get();
        if (result && result.visitorId) {
          cached = result.visitorId;
          writeCache(cached);
          return cached;
        }
      } catch (err) {
        console.warn('[Consultia.DeviceFingerprint] No disponible:', err && err.message);
      }
      return null;
    },

    /** Limpia el cache (útil para testing / logout). */
    clear: function () {
      cached = null;
      try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
    }
  };
})();
