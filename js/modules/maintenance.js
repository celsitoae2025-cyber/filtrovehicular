/* ============================================================
   MODO MANTENIMIENTO — aviso para los usuarios.

   Lee el interruptor global (app_settings.maintenance) y, si está
   activo, cubre la aplicación con un aviso a pantalla completa.

   Los administradores no quedan bloqueados: ven una cinta superior
   que les recuerda que el modo está activo y siguen trabajando, que
   es justamente cuando hace falta entrar a revisar.

   El estado se revisa al cargar y cada 60 s, para que un usuario que
   ya tenía la página abierta también se entere.

   Expone:
     Consultia.Maintenance.check()          — fuerza una revisión
     Consultia.Maintenance.applyState(est)  — pinta un estado dado
============================================================ */
(function () {
  window.Consultia = window.Consultia || {};

  var OVERLAY_ID = 'maintenanceOverlay';
  var BANNER_ID  = 'maintenanceBanner';
  var POLL_MS    = 60000;

  // Petición de acceso del administrador por dirección (#admin o ?admin).
  // Se lee aquí, al ejecutarse el script, y no cuando se pinta el aviso:
  // el router de vistas (js/views.js) reescribe la URL al arrancar y se
  // lleva por delante el hash, así que para entonces ya no estaría.
  var PIDE_ADMIN = /(^|[#&?])admin\b/i.test(location.hash + location.search);

  var MENSAJE_POR_DEFECTO =
    'Estamos realizando tareas de mejora en la plataforma. ' +
    'El servicio se restablecerá en breve.';

  function sb() {
    return window.Consultia && window.Consultia.supabase;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── ¿La sesión actual es de un administrador? ──
  // El resultado se guarda POR USUARIO, nunca "en general". La primera
  // revisión ocurre al cargar la página, normalmente antes de que
  // Supabase haya restaurado la sesión: si ese "todavía no hay usuario"
  // se guardaba como "no es administrador", el admin quedaba encerrado
  // tras su propio aviso y ya no salía de ahí ni iniciando sesión.
  //
  // Por eso solo se guarda una respuesta del servidor sobre un usuario
  // concreto. Sin sesión, o si la consulta falla, se responde que no
  // pero sin recordarlo, y la próxima revisión vuelve a preguntar.
  var adminPorUsuario = Object.create(null);
  async function esAdmin() {
    try {
      var c = sb();
      if (!c) return false;
      var u = await c.auth.getUser();
      var user = u && u.data && u.data.user;
      if (!user) return false;
      if (user.id in adminPorUsuario) return adminPorUsuario[user.id];
      var res = await c.from('profiles').select('is_admin').eq('id', user.id).single();
      if (res.error) return false;
      adminPorUsuario[user.id] = !!(res.data && res.data.is_admin);
      return adminPorUsuario[user.id];
    } catch (e) {
      return false;
    }
  }

  function quitar(id) {
    var el = document.getElementById(id);
    if (el) el.remove();
  }

  /* ── Aviso a pantalla completa (usuarios) ── */
  function mostrarAviso(mensaje) {
    if (document.getElementById(OVERLAY_ID)) return;   // ya visible
    var el = document.createElement('div');
    el.id = OVERLAY_ID;
    el.className = 'mnt-overlay';
    el.setAttribute('role', 'alertdialog');
    el.setAttribute('aria-live', 'assertive');
    el.setAttribute('aria-label', 'Sistema en mantenimiento');
    el.innerHTML =
      '<div class="mnt-card">' +
        '<div class="mnt-mark">' +
          '<span class="mnt-mark-text">Filtro Vehicular</span>' +
          '<span class="mnt-mark-plus">+</span>' +
        '</div>' +
        '<div class="mnt-rule"></div>' +
        '<div class="mnt-icon" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
               'stroke-linecap="round" stroke-linejoin="round">' +
            '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>' +
          '</svg>' +
        '</div>' +
        '<h1 class="mnt-title">Sistema en mantenimiento</h1>' +
        '<p class="mnt-text">' + esc(mensaje || MENSAJE_POR_DEFECTO) + '</p>' +
        '<div class="mnt-note">' +
          'Tus créditos y tu información están intactos. ' +
          'Vuelve a intentarlo en unos minutos.' +
        '</div>' +
        '<button type="button" class="mnt-retry" id="mntRetry">Reintentar</button>' +
      '</div>';
    document.body.appendChild(el);
    document.documentElement.classList.add('mnt-locked');

    var btn = document.getElementById('mntRetry');
    if (btn) btn.addEventListener('click', function () { window.location.reload(); });

    // ── Entrada del administrador ──
    // Sin nada a la vista: el cliente no tiene por qué ver un acceso de
    // administración ni saber por dónde se entra. Hacen falta las dos
    // vías porque el aviso tapa el modal de login (99999 contra 500) y
    // admin.html devuelve a la app cuando no hay sesión.
    //
    //   a) abrir  app.html#admin
    //   b) cinco toques seguidos sobre la marca del aviso (para el móvil,
    //      donde escribir la dirección es incómodo)
    if (PIDE_ADMIN) abrirLoginAdmin();

    var marca = el.querySelector('.mnt-mark');
    var toques = 0, ultimo = 0;
    if (marca) marca.addEventListener('click', function () {
      var ahora = Date.now();
      toques = (ahora - ultimo > 1200) ? 1 : toques + 1;   // seguidos, no sueltos
      ultimo = ahora;
      if (toques >= 5) { toques = 0; abrirLoginAdmin(); }
    });
  }

  // Levanta el login por encima del aviso. La clase se pone solo aquí:
  // mientras nadie la pida, el visitante ve el aviso y no un formulario.
  function abrirLoginAdmin() {
    document.documentElement.classList.add('mnt-auth');
    if (Consultia.AuthModals && Consultia.AuthModals.openLogin) {
      Consultia.AuthModals.openLogin();
    }
  }

  function ocultarAviso() {
    quitar(OVERLAY_ID);
    document.documentElement.classList.remove('mnt-locked');
    document.documentElement.classList.remove('mnt-auth');
  }

  /* ── Cinta para el administrador ── */
  function mostrarCinta() {
    if (document.getElementById(BANNER_ID)) return;
    var el = document.createElement('div');
    el.id = BANNER_ID;
    el.className = 'mnt-banner';
    el.innerHTML =
      '<span class="mnt-banner-dot" aria-hidden="true"></span>' +
      '<strong>Modo mantenimiento activo.</strong>' +
      '<span>Los usuarios ven el aviso; tú puedes seguir operando.</span>';
    document.body.appendChild(el);
    document.documentElement.classList.add('mnt-with-banner');
  }

  function ocultarCinta() {
    quitar(BANNER_ID);
    document.documentElement.classList.remove('mnt-with-banner');
  }

  /* ── Pintar un estado ── */
  async function applyState(estado) {
    var activo = !!(estado && estado.enabled);
    if (!activo) { ocultarAviso(); ocultarCinta(); return; }

    if (await esAdmin()) {
      ocultarAviso();
      mostrarCinta();
    } else {
      ocultarCinta();
      mostrarAviso(estado.message);
    }
  }

  /* ── Consultar el interruptor ── */
  var enVuelo = false;   // evita solaparse consigo mismo
  var apagado = false;   // deja de insistir si la RPC no existe
  var timer = null;

  async function check() {
    if (apagado || enVuelo) return;
    var c = sb();
    if (!c) return;
    enVuelo = true;
    try {
      var res = await c.rpc('get_maintenance');
      if (res.error) throw res.error;
      await applyState(res.data || null);
    } catch (e) {
      // Si la función todavía no está creada, no tiene sentido seguir
      // preguntando: se deja de consultar y la aplicación sigue normal.
      var msg = (e && e.message) || '';
      if (/not find|does not exist|404|PGRST202/i.test(msg)) {
        apagado = true;
        if (timer) { clearInterval(timer); timer = null; }
        console.info('[mantenimiento] inactivo: falta ejecutar ' +
                     'supabase/admin/maintenance_mode.sql');
      } else {
        console.warn('[mantenimiento] no se pudo leer el estado:', msg || e);
      }
    } finally {
      enVuelo = false;
    }
  }

  function iniciar() {
    check();
    timer = setInterval(check, POLL_MS);
    // Al volver a la pestaña conviene revisar de inmediato.
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) check();
    });
    // Y en cuanto cambia la sesión, sin esperar al siguiente sondeo: si
    // quien acaba de entrar es administrador, el aviso tiene que
    // levantarse ya, no un minuto después.
    try {
      var c = sb();
      if (c && c.auth && c.auth.onAuthStateChange) {
        c.auth.onAuthStateChange(function () { check(); });
      }
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }

  Consultia.Maintenance = { check: check, applyState: applyState };
})();
