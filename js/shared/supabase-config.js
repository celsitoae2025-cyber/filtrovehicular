/* ============================================================
   SUPABASE — inicialización del cliente
   URL y key son públicas, seguras de exponer.
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  var SUPABASE_URL = 'https://kkqpayfyhvxatskkrqdg.supabase.co';
  var SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_8_jKLgXupm7hybBYdXrNMA_w9YRYJpm';

  // El SDK de Supabase se carga vía CDN en el HTML y expone window.supabase
  if (!window.supabase || !window.supabase.createClient) {
    console.error('[Consultia] Supabase SDK no cargado — revisar que el script CDN esté antes de supabase-config.js');
    return;
  }

  // ===== Storage dinámico para "Recordarme por 30 días" =====
  // Si el usuario marcó "Recordarme" → tokens en localStorage (persisten 30d).
  // Si no lo marcó                    → tokens en sessionStorage (mueren al
  //                                     cerrar el navegador).
  // El flag lo setea Auth.signIn ANTES de signInWithPassword, así el SDK lo
  // ve cuando hace setItem por primera vez.
  var REMEMBER_KEY = 'consultia_remember';

  function activeStorage() {
    try {
      return localStorage.getItem(REMEMBER_KEY) === '1' ? localStorage : sessionStorage;
    } catch (_) {
      return sessionStorage;
    }
  }

  var dualStorage = {
    getItem: function (key) {
      try {
        var s = activeStorage();
        var v = s.getItem(key);
        if (v !== null) return v;
        // Fallback: si el otro storage tiene el valor, lo leemos para no
        // perder sesiones legacy.
        var other = s === localStorage ? sessionStorage : localStorage;
        return other.getItem(key);
      } catch (_) { return null; }
    },
    setItem: function (key, value) {
      try {
        var s = activeStorage();
        s.setItem(key, value);
        // Limpia del otro storage para evitar duplicados conflictivos.
        var other = s === localStorage ? sessionStorage : localStorage;
        other.removeItem(key);
      } catch (_) {}
    },
    removeItem: function (key) {
      try {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      } catch (_) {}
    }
  };

  Consultia.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: dualStorage
    }
  });
  // Exponer la URL para que otros módulos (consulta-runner) puedan llamar a
  // edge functions sin depender de propiedades internas del SDK.
  Consultia.SUPABASE_URL = SUPABASE_URL;
})();
