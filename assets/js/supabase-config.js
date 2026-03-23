// Configuración central Supabase (clave publicable — usar RLS estricto en el proyecto)
(function () {
    'use strict';
    var SUPABASE_URL = 'https://xojgpfbpomjxpyytmczg.supabase.co';
    var SUPABASE_KEY = 'sb_publishable_CjQ1bJD0Uvhs5wlKgI6FKw_PX7V4fuB';

    if (window.supabase) {
        window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } else {
        console.error('Falta el script CDN de @supabase/supabase-js antes de supabase-config.js');
    }
})();
