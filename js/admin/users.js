/* ============================================================
   ADMIN USERS — datos reales de Supabase
   - Lista usuarios desde admin_list_users RPC
   - Permite agregar créditos manualmente (flujo WhatsApp)
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};
  window.Consultia.Admin = window.Consultia.Admin || {};
  var A = window.Consultia.Admin;

  var cachedUsers = [];
  var currentUser = null;

  function getSB() {
    if (!window.Consultia || !window.Consultia.supabase) {
      console.error('Supabase no disponible');
      return null;
    }
    return window.Consultia.supabase;
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function fmtRelative(iso) {
    if (!iso) return 'Nunca';
    var d = new Date(iso);
    var now = Date.now();
    var diff = Math.floor((now - d.getTime()) / 1000);
    if (diff < 60) return 'Hace un momento';
    if (diff < 3600) return 'Hace ' + Math.floor(diff / 60) + ' min';
    if (diff < 86400) return 'Hace ' + Math.floor(diff / 3600) + ' h';
    if (diff < 604800) return 'Hace ' + Math.floor(diff / 86400) + ' días';
    return fmtDate(iso);
  }

  function initialsOf(name) {
    if (!name) return '??';
    var parts = String(name).trim().split(/\s+/);
    var a = parts[0] ? parts[0][0] : '';
    var b = parts[1] ? parts[1][0] : '';
    return ((a + b) || name[0]).toUpperCase();
  }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Set de IDs seleccionados para borrar (modo "Sin confirmar")
  var selectedForDelete = new Set();

  // Filtros que activan el "modo selección" (checkboxes por fila + botón
  // de eliminar). Permite borrar masivamente cualquier subset peligroso
  // detectado por filtro.
  var SELECTABLE_FILTERS = [
    'unconfirmed',          // emails sin verificar
    'inactive',             // no pagó ni consultó nunca
    'no_login_30d',         // no inicia sesión hace 30+ días
    'has_credits_no_use'    // tiene saldo, no consultó
  ];

  function isSelectModeActive() {
    var f = document.getElementById('usersFilter');
    return f && SELECTABLE_FILTERS.indexOf(f.value) !== -1;
  }

  /* ICONOS DE LA FILA
     Un trazo cada uno, del mismo grosor; el título los nombra. */
  var ICO_VER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
  var ICO_PLAN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
  var ICO_BORRAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';

  var TIER_NOMBRE = {
    profesional: 'Profesional',
    profesional_plus: 'Prof. Plus',
    business: 'Business'
  };

  function renderRow(u) {
    var checkboxCell = '';
    if (isSelectModeActive() && !u.is_admin) {
      var checked = selectedForDelete.has(u.id) ? 'checked' : '';
      checkboxCell = '<td><input type="checkbox" class="user-row-check" data-user-id="' + u.id + '" ' + checked + '></td>';
    } else if (isSelectModeActive()) {
      // Admin: celda vacía para que la columna no se descuadre
      checkboxCell = '<td></td>';
    }

    /* LA FILA SOLO LLEVA LO QUE SE MIRA DE UN VISTAZO.

       Antes cargaba ocho columnas y cinco etiquetas por usuario
       (confirmado, MP, admin, consumió free, plan activo). Con cien
       filas eso no es información: es ruido. El consumo, las consultas
       de hoy y esas marcas viven ahora en la ficha del ojo, donde hay
       sitio para explicarlas. */

    // ── Plan: sale de la suscripción, nunca del saldo ──
    var tier = u.subscription_tier;
    var vence = u.subscription_expires_at ? new Date(u.subscription_expires_at).getTime() : 0;
    var planVivo = !!(tier && vence > Date.now());
    var nombrePlan = TIER_NOMBRE[tier] || tier || '';
    var planCell;
    if (planVivo) {
      var dias = Math.ceil((vence - Date.now()) / 86400000);
      planCell = '<strong class="ad-fuerte">' + esc(nombrePlan) + '</strong>' +
        '<small class="ad-sub">Vence ' + esc(fmtDate(u.subscription_expires_at)) +
        ' · ' + (dias <= 0 ? 'vence hoy' : (dias === 1 ? 'queda 1 día' : 'quedan ' + dias + ' días')) + '</small>';
    } else if (tier && vence) {
      planCell = '<span class="ad-nada">' + esc(nombrePlan) + '</span>' +
        '<small class="ad-sub ad-sub-rojo">Venció el ' + esc(fmtDate(u.subscription_expires_at)) + '</small>';
    } else {
      planCell = '<span class="ad-nada">Sin plan</span>';
    }

    /* Con plan por días las consultas no gastan créditos (lo decide
       consulta-runner.js), así que enseñar el saldo ahí engaña. */
    var creditosCell = planVivo
      ? '<strong class="ad-fuerte">Ilimitado</strong><small class="ad-sub">mientras dure el plan</small>'
      : '<strong class="ad-fuerte">' + esc(u.credits_balance || 0) + '</strong>';

    var estadoCell = u.status === 'active'
      ? '<span class="chip chip-ok">Activo</span>'
      : '<span class="chip chip-off">Suspendido</span>';

    var hasCredits = (u.credits_balance || 0) > 0;
    var acciones =
      '<button class="ad-icono" data-action="view" data-user-id="' + u.id + '" title="Ver ficha completa" aria-label="Ver ficha completa">' + ICO_VER + '</button>' +
      '<button class="ad-boton-plan" data-action="plan" data-user-id="' + u.id + '" title="Dar o extender un plan por días">' + ICO_PLAN + 'Plan</button>' +
      '<button class="ad-icono ad-icono-mas" data-action="addcredits" data-user-id="' + u.id + '" title="Añadir créditos" aria-label="Añadir créditos">+</button>' +
      (hasCredits
        ? '<button class="ad-icono ad-icono-menos" data-action="subcredits" data-user-id="' + u.id + '" title="Restar o vaciar créditos" aria-label="Restar créditos">−</button>'
        : '') +
      (u.is_admin
        ? ''
        : '<button class="ad-icono ad-icono-borrar" data-action="borrar" data-user-id="' + u.id + '" title="Eliminar la cuenta" aria-label="Eliminar la cuenta">' + ICO_BORRAR + '</button>');

    var adminChip = u.is_admin ? '<span class="chip chip-off" style="margin-left:6px;">Admin</span>' : '';

    return '<tr data-user-id="' + u.id + '">' +
      checkboxCell +
      '<td><div class="cell-user">' +
        '<span class="avatar">' + esc(initialsOf(u.full_name || u.email)) + '</span>' +
        '<div class="user-info"><strong>' + esc(u.full_name || '—') + adminChip + '</strong>' +
        '<span>' + esc(u.email || 'Sin correo') + '</span></div>' +
      '</div></td>' +
      '<td>' + planCell + '</td>' +
      '<td>' + creditosCell + '</td>' +
      '<td>' + estadoCell + '</td>' +
      '<td>' + esc(fmtDate(u.created_at)) + '</td>' +
      '<td><div class="cell-actions">' + acciones + '</div></td>' +
    '</tr>';
  }

  async function loadUsers() {
    var sb = getSB();
    if (!sb) return [];

    /* Se pide POR TRAMOS, no de una vez.

       PostgREST corta cualquier respuesta en 1.000 filas, y el total que
       muestra el panel es la longitud de esta lista: pasados los mil
       usuarios el contador se quedaba clavado en «1000» para siempre y
       los registros nuevos no aparecían por ningún lado. No era que
       nadie se registrara — era que no se pedían.

       Se pide de mil en mil hasta que un tramo venga incompleto, que es
       la señal de que ya no hay más. */
    var users = [];
    var PASO = 1000;
    for (var desde = 0; ; desde += PASO) {
      var res = await sb.rpc('admin_list_users').range(desde, desde + PASO - 1);
      if (res.error) {
        console.error('admin_list_users error:', res.error);
        if (Consultia.toast) Consultia.toast({
          type: 'error',
          title: 'Error cargando usuarios',
          message: res.error.message
        });
        return users.length ? users : [];
      }
      var tramo = res.data || [];
      users = users.concat(tramo);
      if (tramo.length < PASO) break;
      if (desde > 200000) break;   // freno de seguridad
    }

    // Enriquecer: identificar quién pagó por MP, quién fue activado por admin
    // y cuántos consumos tiene cada usuario (para detectar si gastó los 5 free).
    try {
      /* Las transacciones, por el mismo motivo: con más de mil, el
         reparto de «quién pagó» se hacía con una muestra y había clientes
         de pago marcados como gratuitos. */
      var txData = [];
      var txError = null;
      for (var td = 0; ; td += 1000) {
        var txPag = await sb
          .from('transactions')
          .select('user_id, type, amount, payment_method, created_at')
          .range(td, td + 999);
        if (txPag.error) { txError = txPag.error; break; }
        var txTramo = txPag.data || [];
        txData = txData.concat(txTramo);
        if (txTramo.length < 1000) break;
        if (td > 500000) break;
      }
      var txRes = { data: txData, error: txError };
      if (!txRes.error && txRes.data) {
        var paidMpSet = new Set();
        var paidAdminSet = new Set();
        var consumosPorUsuario = {};
        var gastadoPorUsuario = {};   // créditos consumidos
        var hoyPorUsuario = {};       // consultas de hoy
        var inicioDeHoy = new Date(); inicioDeHoy.setHours(0, 0, 0, 0);
        txRes.data.forEach(function (t) {
          if (!t.user_id) return;
          // MP: pagos reales por Mercado Pago (purchase / subscription)
          var isMpPay = (t.type === 'purchase' || t.type === 'subscription' || t.type === 'sale')
                        && t.payment_method === 'mercadopago';
          if (isMpPay) paidMpSet.add(t.user_id);

          // Admin: cualquier ajuste manual hecho por un admin
          //   - admin_adjust: lo emite la RPC admin_adjust_credits
          //   - whatsapp/manual: rutas alternas heredadas
          /* 'sale' es la venta que anota el administrador cuando cobra
             por fuera (Yape, Plin, efectivo, transferencia). Antes todas
             se guardaban como 'whatsapp' y aquí solo se miraban dos
             métodos, así que quien pagaba por Yape no contaba como
             cliente de pago en ninguna ficha. */
          var isAdminPay = (t.type === 'admin_adjust' && t.amount > 0)
                           || ((t.type === 'purchase' || t.type === 'subscription' || t.type === 'sale')
                               && t.payment_method !== 'mercadopago');
          if (isAdminPay) paidAdminSet.add(t.user_id);

          // Consumos: aceptamos los dos nombres históricos
          if (t.type === 'consumption' || t.type === 'consultation') {
            consumosPorUsuario[t.user_id] = (consumosPorUsuario[t.user_id] || 0) + 1;
            gastadoPorUsuario[t.user_id] = (gastadoPorUsuario[t.user_id] || 0) + Math.abs(Number(t.amount) || 0);
            if (t.created_at && new Date(t.created_at) >= inicioDeHoy) {
              hoyPorUsuario[t.user_id] = (hoyPorUsuario[t.user_id] || 0) + 1;
            }
          }
        });
        users.forEach(function (u) {
          u._paid_mp = paidMpSet.has(u.id);
          u._paid_admin = paidAdminSet.has(u.id);
          u._has_paid = u._paid_mp || u._paid_admin;
          u._consumos = consumosPorUsuario[u.id] || 0;
          u._gastados = gastadoPorUsuario[u.id] || 0;
          u._hoy = hoyPorUsuario[u.id] || 0;
          u._used_free = u._consumos >= 5;
        });
      }
    } catch (e) {
      console.warn('No se pudo cargar info de pagos:', e);
    }

    return users;
  }

  function isSubscriptionActive(u) {
    if (!u || !u.subscription_expires_at) return false;
    return new Date(u.subscription_expires_at).getTime() > Date.now();
  }

  function isEmailConfirmed(u) {
    return !!(u && u.email_confirmed_at);
  }

  // Devuelve true si el usuario NO ha iniciado sesión en los últimos `days` días.
  // Considera "sin actividad reciente" tanto a quienes nunca iniciaron sesión
  // como a quienes lo hicieron hace mucho.
  function isStaleLogin(u, days) {
    var ms = days * 24 * 60 * 60 * 1000;
    if (!u || !u.last_sign_in_at) return true; // nunca se logueó después del registro
    return (Date.now() - new Date(u.last_sign_in_at).getTime()) > ms;
  }

  function filterUsers(list) {
    var search = (document.getElementById('usersSearch').value || '').toLowerCase().trim();
    var filter = document.getElementById('usersFilter').value;
    var filtered = list.filter(function (u) {
      if (filter === 'expired' && !(u.subscription_expires_at && new Date(u.subscription_expires_at).getTime() <= Date.now())) return false;
      if (filter === 'suspended' && u.status !== 'suspended') return false;
      if (filter === 'team' && !u.is_admin) return false;
      if (filter === 'paid_mp' && !u._paid_mp) return false;
      if (filter === 'paid_admin' && !u._paid_admin) return false;
      if (filter === 'used_free' && !u._used_free) return false;
      if (filter === 'kept_free' && u._used_free) return false;
      if (filter === 'unconfirmed' && isEmailConfirmed(u)) return false;
      if (filter === 'confirmed' && !isEmailConfirmed(u)) return false;

      // ===== Filtros de suscripción =====
      if (filter === 'has_sub' && !isSubscriptionActive(u)) return false;
      if (filter === 'no_sub' && isSubscriptionActive(u)) return false;
      if (filter === 'sub_profesional' && !(isSubscriptionActive(u) && u.subscription_tier === 'profesional')) return false;
      if (filter === 'sub_profesional_plus' && !(isSubscriptionActive(u) && u.subscription_tier === 'profesional_plus')) return false;
      if (filter === 'sub_business' && !(isSubscriptionActive(u) && u.subscription_tier === 'business')) return false;
      if (filter === 'sub_premium' && !(isSubscriptionActive(u) && (u.subscription_tier === 'profesional_plus' || u.subscription_tier === 'business'))) return false;

      // ===== Filtros de inactividad =====
      // "Inactivo total": nunca pagó Y nunca hizo consulta. El caso clásico
      // de quien se registró por el bonus de bienvenida y no volvió.
      if (filter === 'inactive' && (u._has_paid || (u._consumos || 0) > 0)) return false;

      // "Sin login hace 30+ días": detección de cuentas dormidas. Incluye a
      // los que nunca volvieron a iniciar sesión después del registro.
      if (filter === 'no_login_30d' && !isStaleLogin(u, 30)) return false;

      // "Con saldo, sin consultar": tiene créditos disponibles (sea de
      // bienvenida o pagados) pero todavía no los gasta. Útil para hacer
      // recordatorios de uso.
      if (filter === 'has_credits_no_use'
          && (!((u.credits_balance || 0) > 0) || (u._consumos || 0) > 0)) return false;

      if (search) {
        var hay = ((u.full_name || '') + ' ' + (u.email || '') + ' ' + (u.phone || '')).toLowerCase();
        if (hay.indexOf(search) === -1) return false;
      }
      return true;
    });
    // Ordenar por créditos descendente (más créditos arriba)
    filtered.sort(function (a, b) { return (b.credits_balance || 0) - (a.credits_balance || 0); });
    return filtered;
  }

  /* ── Las fichas de filtro, con su cuenta ──────────────────────
     Siete atajos a lo que se mira a diario. La cuenta se saca de la
     lista entera, no de lo que se ve: decir «Suspendidos 0» cuando hay
     tres escondidos por el buscador sería mentir. */
  /* CADA FICHA TIENE QUE EXISTIR EN EL DESPLEGABLE.

     Al pulsarla se escribe su clave en el <select>, y «Plan vencido»,
     «Suspendidos» y «Equipo» no estaban entre sus opciones: el navegador
     rechazaba el valor, el select se quedaba vacío, el filtro no casaba
     con ninguna regla y la tabla devolvía los 574 usuarios. Es decir:
     pulsabas «Suspendidos 1» y salían todos. Ya están las tres. */
  var FICHAS = [
    ['all',         'Todos',               function () { return true; }],
    ['has_sub',     'Con plan',            function (u) { return isSubscriptionActive(u); }],
    ['expired',     'Plan vencido',        function (u) { return u.subscription_expires_at && new Date(u.subscription_expires_at).getTime() <= Date.now(); }],
    ['paid_mp',     'Pagaron por MP',      function (u) { return u._paid_mp; }],
    ['paid_admin',  'Activados por admin', function (u) { return u._paid_admin; }],
    ['unconfirmed', 'Sin confirmar',       function (u) { return !isEmailConfirmed(u); }],
    ['suspended',   'Suspendidos',         function (u) { return u.status === 'suspended'; }],
    ['team',        'Equipo',              function (u) { return u.is_admin; }]
  ];

  function pintarFichas() {
    var caja = document.getElementById('usersChips');
    if (!caja) return;
    var sel = document.getElementById('usersFilter');
    var activo = sel ? sel.value : 'all';
    caja.innerHTML = FICHAS.map(function (f) {
      var n = cachedUsers.filter(f[2]).length;
      return '<button type="button" class="ad-ficha' + (f[0] === activo ? ' es-activa' : '') +
        '" data-users-chip="' + f[0] + '">' + f[1] + ' <b>' + n + '</b></button>';
    }).join('');
  }

  function paint() {
    pintarFichas();
    var rows = filterUsers(cachedUsers);
    var body = document.getElementById('usersTableBody');
    var empty = document.getElementById('usersEmpty');
    var wrap = document.querySelector('#adminView-users .admin-table-wrap');

    // Mostrar/ocultar columna de selección según el filtro activo
    var selectMode = isSelectModeActive();
    var selectCol = document.getElementById('usersSelectAllCol');
    if (selectCol) selectCol.hidden = !selectMode;
    if (!selectMode) selectedForDelete.clear();
    refreshDeleteBar();

    if (!rows.length) {
      if (body) body.innerHTML = '';
      if (empty) empty.hidden = false;
      if (wrap) wrap.style.display = 'none';
      return;
    }
    if (empty) empty.hidden = true;
    if (wrap) wrap.style.display = '';
    if (body) body.innerHTML = rows.map(renderRow).join('');

    // Ajustar el checkbox "select all" según el estado actual
    var selAll = document.getElementById('usersSelectAll');
    if (selAll && selectMode) {
      var visibleSelectables = rows.filter(function (u) { return !u.is_admin; });
      var allChecked = visibleSelectables.length > 0 &&
        visibleSelectables.every(function (u) { return selectedForDelete.has(u.id); });
      selAll.checked = allChecked;
      selAll.indeterminate = !allChecked && visibleSelectables.some(function (u) { return selectedForDelete.has(u.id); });
    }
  }

  function refreshDeleteBar() {
    var btn = document.getElementById('usersDeleteSelected');
    var counter = document.getElementById('usersDeleteCount');
    if (!btn || !counter) return;
    var n = selectedForDelete.size;
    counter.textContent = n;
    btn.hidden = !(isSelectModeActive() && n > 0);
  }

  // Etiqueta humana de cada filtro para los diálogos de confirmación.
  var FILTER_LABELS = {
    unconfirmed:        'sin confirmar email',
    inactive:           'inactivos (no pagó ni consultó)',
    no_login_30d:       'sin login hace 30+ días',
    has_credits_no_use: 'con saldo y sin consultar'
  };

  async function deleteSelectedUsers() {
    if (selectedForDelete.size === 0) return;
    var ids = Array.from(selectedForDelete);
    var n = ids.length;

    var filterValue = (document.getElementById('usersFilter') || {}).value || 'unconfirmed';
    var filterLabel = FILTER_LABELS[filterValue] || 'seleccionados';

    // El filtro 'unconfirmed' usa una RPC más estricta que solo borra
    // emails no confirmados (protección extra contra borrados accidentales).
    // El resto de filtros usan la RPC genérica que borra cualquier usuario
    // no-admin distinto del que llama.
    var rpcName = (filterValue === 'unconfirmed')
      ? 'admin_delete_unconfirmed_users'
      : 'admin_delete_users';

    var confirmed = false;
    if (window.Consultia && Consultia.confirmDialog) {
      await new Promise(function (resolve) {
        Consultia.confirmDialog({
          title: 'Eliminar usuarios ' + filterLabel,
          message: 'Vas a eliminar ' + n + ' usuario' + (n === 1 ? '' : 's') + ' tanto del sistema interno como de Supabase Auth. Esta acción no se puede deshacer.',
          confirmLabel: 'Eliminar ' + n,
          confirmStyle: 'danger',
          onConfirm: function () { confirmed = true; resolve(); },
          onCancel: function () { resolve(); }
        });
      });
    } else {
      confirmed = confirm('¿Eliminar ' + n + ' usuario(s) ' + filterLabel + '? Esta acción no se puede deshacer.');
    }
    if (!confirmed) return;

    var sb = getSB();
    if (!sb) return;
    var btn = document.getElementById('usersDeleteSelected');
    if (btn) { btn.disabled = true; btn.dataset.orig = btn.dataset.orig || btn.innerHTML; btn.textContent = 'Eliminando…'; }

    try {
      var res = await sb.rpc(rpcName, { user_ids: ids });
      if (res.error) throw res.error;
      var deleted = res.data || 0;

      if (window.Consultia.toast) Consultia.toast({
        type: 'success',
        title: 'Usuarios eliminados',
        message: deleted + ' de ' + n + ' fueron borrados.'
      });

      if (typeof A.logAudit === 'function') {
        A.logAudit('user.delete_' + filterValue, deleted + ' usuarios', 'IDs solicitados: ' + n);
      }

      selectedForDelete.clear();
      cachedUsers = await loadUsers();
      paint();
    } catch (err) {
      console.error('Error eliminando:', err);
      if (window.Consultia.toast) Consultia.toast({
        type: 'error',
        title: 'No se pudo eliminar',
        message: (err && err.message) || 'Intenta de nuevo.'
      });
    } finally {
      if (btn) {
        btn.disabled = false;
        if (btn.dataset.orig) btn.innerHTML = btn.dataset.orig;
      }
      refreshDeleteBar();
    }
  }

  // ============================================================
  // Realtime: suscripción a cambios en profiles y transactions
  // ============================================================
  var realtimeChannel = null;
  var refreshDebounceTimer = null;
  var pendingUserIdsToFlash = new Set();

  function setLiveState(state, label) {
    var dot = document.getElementById('usersLiveDot');
    var lbl = document.getElementById('usersLiveLabel');
    if (dot) dot.setAttribute('data-state', state);
    if (lbl) lbl.textContent = label;
  }

  function flashRow(userId) {
    var row = document.querySelector('tr[data-user-id="' + userId + '"]');
    if (!row) return;
    row.classList.add('users-row-flash');
    setTimeout(function () { row.classList.remove('users-row-flash'); }, 1000);
  }

  function scheduleRefresh(userId) {
    if (userId) pendingUserIdsToFlash.add(userId);
    clearTimeout(refreshDebounceTimer);
    refreshDebounceTimer = setTimeout(async function () {
      cachedUsers = await loadUsers();
      paint();
      pendingUserIdsToFlash.forEach(flashRow);
      pendingUserIdsToFlash.clear();
    }, 600);
  }

  function startRealtime() {
    var sb = getSB();
    if (!sb || realtimeChannel) return;
    setLiveState('off', 'Conectando…');
    try {
      realtimeChannel = sb.channel('admin-users-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, function (payload) {
          var uid = (payload.new && payload.new.id) || (payload.old && payload.old.id);
          scheduleRefresh(uid);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, function (payload) {
          var uid = (payload.new && payload.new.user_id) || (payload.old && payload.old.user_id);
          scheduleRefresh(uid);
        })
        .subscribe(function (status) {
          if (status === 'SUBSCRIBED') setLiveState('on', 'En vivo');
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setLiveState('error', 'Sin conexión en vivo');
        });
    } catch (e) {
      console.warn('Realtime no disponible:', e);
      setLiveState('error', 'Sin conexión en vivo');
    }
  }

  function stopRealtime() {
    var sb = getSB();
    if (realtimeChannel && sb) {
      try { sb.removeChannel(realtimeChannel); } catch (e) {}
    }
    realtimeChannel = null;
    setLiveState('off', '');
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-users-chip]');
    if (!b) return;
    var sel = document.getElementById('usersFilter');
    if (sel) { sel.value = b.dataset.usersChip; }
    paint();
  });

  A.renderUsers = async function () {
    cachedUsers = await loadUsers();
    paint();
    startRealtime();
  };

  A.stopUsersRealtime = stopRealtime;

  // ============================================================
  // Modal: agregar/quitar créditos manualmente
  // ============================================================
  // Modo actual del modal: 'add' | 'sub' | 'clear'
  var currentMode = 'add';

  function ensureCreditsModal() {
    if (document.getElementById('addCreditsModal')) return;

    var html = ''
      + '<div class="modal" id="addCreditsModal" hidden role="dialog" aria-modal="true">'
      + '  <div class="modal-overlay" data-close-credits></div>'
      + '  <div class="modal-panel" style="max-width:460px;">'
      + '    <header class="modal-header">'
      + '      <h2 id="addCreditsTitle">Ajustar créditos</h2>'
      + '      <button class="modal-close" type="button" aria-label="Cerrar" data-close-credits>'
      + '        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
      + '      </button>'
      + '    </header>'
      + '    <div class="modal-body">'
      + '      <div class="ac-user-info" id="addCreditsUserInfo" style="padding:12px 14px;background:var(--c-bg);border-radius:8px;margin-bottom:14px;font-size:13px;color:var(--c-muted);"></div>'
      + '      <div class="ac-mode-tabs" role="tablist" style="display:flex;gap:4px;background:var(--c-bg);padding:4px;border-radius:10px;margin-bottom:14px;">'
      + '        <button type="button" class="ac-mode-tab is-active" data-mode="add" role="tab" aria-selected="true" style="flex:1;padding:9px 8px;border:none;background:var(--c-surface);border-radius:7px;font-size:13px;font-weight:400;cursor:pointer;color:var(--c-primary);box-shadow:0 1px 2px rgba(0,0,0,.06);">+ Sumar</button>'
      + '        <button type="button" class="ac-mode-tab" data-mode="sub" role="tab" aria-selected="false" style="flex:1;padding:9px 8px;border:none;background:transparent;border-radius:7px;font-size:13px;font-weight:400;cursor:pointer;color:var(--c-muted);">− Restar</button>'
      + '        <button type="button" class="ac-mode-tab" data-mode="clear" role="tab" aria-selected="false" style="flex:1;padding:9px 8px;border:none;background:transparent;border-radius:7px;font-size:13px;font-weight:400;cursor:pointer;color:var(--c-muted);">Vaciar todo</button>'
      + '      </div>'
      + '      <div class="form-field" id="acAmountField"><label for="acAmount" id="acAmountLabel">Cantidad a sumar</label><input type="number" id="acAmount" class="input" min="1" step="1" placeholder="Ej: 200" required></div>'
      + '      <div id="acClearNotice" hidden style="padding:12px 14px;background:#f5f5f5;border:1px solid #DCDCDC;color:#141d1c;border-radius:8px;font-size:13px;margin-bottom:14px;">Esta acción <strong>vaciará por completo</strong> los créditos del usuario (saldo quedará en <strong>0</strong>). El movimiento queda registrado en el historial.</div>'
      + '      <div class="form-field"><label for="acMethod">Método</label><select id="acMethod" class="input"><option value="whatsapp">WhatsApp (Yape/Plin/transferencia)</option><option value="mercadopago">Mercado Pago</option><option value="manual">Ajuste manual (bonus, reembolso, error, etc.)</option></select></div>'
      + '      <div class="form-field"><label for="acNote">Nota (opcional)</label><input type="text" id="acNote" class="input" placeholder="Ej: pago Yape comp 001 del 22/04"></div>'
      + '      <div class="form-field"><label for="acRef">Referencia externa (opcional)</label><input type="text" id="acRef" class="input" placeholder="ID de transacción, número de operación…"></div>'
      + '      <div id="acError" class="auth-error" hidden style="margin-top:12px;"></div>'
      + '    </div>'
      + '    <footer class="modal-footer">'
      + '      <button class="btn btn-outline" type="button" data-close-credits>Cancelar</button>'
      + '      <button class="btn btn-primary" type="button" id="acSubmit">Confirmar</button>'
      + '    </footer>'
      + '  </div>'
      + '</div>';

    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    document.body.appendChild(tmp.firstElementChild);

    document.querySelectorAll('[data-close-credits]').forEach(function (el) {
      el.addEventListener('click', closeCreditsModal);
    });
    document.getElementById('acSubmit').addEventListener('click', submitCredits);

    // Tabs de modo
    document.querySelectorAll('.ac-mode-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        setCreditsMode(tab.dataset.mode);
      });
    });
  }

  function setCreditsMode(mode) {
    currentMode = mode;

    var tabs = document.querySelectorAll('.ac-mode-tab');
    tabs.forEach(function (t) {
      var active = t.dataset.mode === mode;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
      t.style.background = active ? 'var(--c-surface)' : 'transparent';
      t.style.color = active ? 'var(--c-primary)' : 'var(--c-muted)';
      t.style.boxShadow = active ? '0 1px 2px rgba(0,0,0,.06)' : 'none';
    });

    var amountField = document.getElementById('acAmountField');
    var amountLabel = document.getElementById('acAmountLabel');
    var clearNotice = document.getElementById('acClearNotice');
    var submitBtn = document.getElementById('acSubmit');
    var titleEl = document.getElementById('addCreditsTitle');

    if (mode === 'add') {
      amountField.hidden = false;
      clearNotice.hidden = true;
      amountLabel.textContent = 'Cantidad a sumar';
      submitBtn.textContent = 'Sumar créditos';
      submitBtn.classList.remove('btn-danger');
      submitBtn.classList.add('btn-primary');
      titleEl.textContent = 'Sumar créditos';
    } else if (mode === 'sub') {
      amountField.hidden = false;
      clearNotice.hidden = true;
      amountLabel.textContent = 'Cantidad a restar';
      submitBtn.textContent = 'Restar créditos';
      submitBtn.classList.remove('btn-primary');
      submitBtn.classList.add('btn-danger');
      titleEl.textContent = 'Restar créditos';
    } else if (mode === 'clear') {
      amountField.hidden = true;
      clearNotice.hidden = false;
      submitBtn.textContent = 'Vaciar saldo';
      submitBtn.classList.remove('btn-primary');
      submitBtn.classList.add('btn-danger');
      titleEl.textContent = 'Vaciar créditos';
    }

    // Limpiar el error visible al cambiar de modo
    var errBox = document.getElementById('acError');
    if (errBox) errBox.hidden = true;
  }

  function openCreditsModal(userId, mode) {
    ensureCreditsModal();
    var u = cachedUsers.find(function (x) { return x.id === userId; });
    if (!u) return;
    currentUser = u;

    document.getElementById('addCreditsUserInfo').innerHTML =
      '<strong>' + (u.full_name || '—') + '</strong><br>' +
      (u.email || '') + '<br>' +
      'Saldo actual: <strong style="color:var(--c-primary);">' + (u.credits_balance || 0) + ' créditos</strong>';

    document.getElementById('acAmount').value = '';
    document.getElementById('acMethod').value = 'whatsapp';
    document.getElementById('acNote').value = '';
    document.getElementById('acRef').value = '';
    document.getElementById('acError').hidden = true;

    setCreditsMode(mode || 'add');

    document.getElementById('addCreditsModal').hidden = false;
    setTimeout(function () {
      var input = document.getElementById('acAmount');
      if (input && !input.parentElement.hidden) input.focus();
    }, 50);
  }

  function closeCreditsModal() {
    var m = document.getElementById('addCreditsModal');
    if (m) m.hidden = true;
    currentUser = null;
  }

  async function submitCredits() {
    if (!currentUser) return;
    var rawAmount = parseInt(document.getElementById('acAmount').value, 10);
    var method = document.getElementById('acMethod').value;
    var note = document.getElementById('acNote').value.trim();
    var ref = document.getElementById('acRef').value.trim();
    var errBox = document.getElementById('acError');
    var submitBtn = document.getElementById('acSubmit');

    errBox.hidden = true;

    var balance = currentUser.credits_balance || 0;
    var amount; // delta final que se manda a la RPC (positivo o negativo)

    if (currentMode === 'add') {
      if (!rawAmount || isNaN(rawAmount) || rawAmount <= 0) {
        errBox.textContent = 'Ingresa una cantidad válida (positiva) para sumar.';
        errBox.hidden = false;
        return;
      }
      amount = Math.abs(rawAmount);
    } else if (currentMode === 'sub') {
      if (!rawAmount || isNaN(rawAmount) || rawAmount <= 0) {
        errBox.textContent = 'Ingresa una cantidad válida (positiva) para restar.';
        errBox.hidden = false;
        return;
      }
      var toSubtract = Math.abs(rawAmount);
      if (toSubtract > balance) {
        errBox.textContent = 'No puedes restar ' + toSubtract + ' créditos: el usuario solo tiene ' + balance + '. Usa "Vaciar todo" si quieres dejar el saldo en 0.';
        errBox.hidden = false;
        return;
      }
      amount = -toSubtract;
    } else if (currentMode === 'clear') {
      if (balance <= 0) {
        errBox.textContent = 'El usuario ya tiene saldo 0 — no hay nada que vaciar.';
        errBox.hidden = false;
        return;
      }
      amount = -balance;
    } else {
      errBox.textContent = 'Modo no reconocido.';
      errBox.hidden = false;
      return;
    }

    var sb = getSB();
    if (!sb) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Guardando…';

    try {
      var res = await sb.rpc('admin_adjust_credits', {
        target_user_id: currentUser.id,
        delta: amount,
        note: note || null,
        method: method,
        ref: ref || null
      });

      if (res.error) throw res.error;

      // Crear notificación in-app para el cliente (no bloquea si falla)
      try {
        var nTitle = amount > 0
          ? '¡Recibiste ' + amount + ' créditos!'
          : 'Se ajustaron tus créditos (' + amount + ')';
        var nBody = amount > 0
          ? ('Se acreditaron ' + amount + ' créditos a tu cuenta.' + (note ? ' Motivo: ' + note : ''))
          : ('Se restaron ' + Math.abs(amount) + ' créditos de tu cuenta.' + (note ? ' Motivo: ' + note : ''));
        await sb.rpc('admin_create_notification', {
          target_user_id: currentUser.id,
          n_title: nTitle,
          n_body: nBody,
          n_type: 'credits',
          n_meta: { delta: amount, method: method, ref: ref || null }
        });
      } catch (nerr) {
        console.warn('No se pudo crear la notificación:', nerr);
      }

      var toastTitle, toastMsg;
      if (currentMode === 'clear') {
        toastTitle = 'Saldo vaciado';
        toastMsg = 'Se eliminaron ' + Math.abs(amount) + ' créditos de ' + (currentUser.full_name || currentUser.email) + '. Saldo: 0.';
      } else if (amount > 0) {
        toastTitle = 'Créditos sumados';
        toastMsg = '+' + amount + ' créditos a ' + (currentUser.full_name || currentUser.email);
      } else {
        toastTitle = 'Créditos restados';
        toastMsg = '−' + Math.abs(amount) + ' créditos a ' + (currentUser.full_name || currentUser.email);
      }
      if (Consultia.toast) Consultia.toast({
        type: 'success',
        title: toastTitle,
        message: toastMsg
      });

      closeCreditsModal();
      await A.renderUsers();
    } catch (err) {
      console.error('Error ajustando créditos:', err);
      errBox.textContent = (err && err.message) || 'Error al guardar. Intenta de nuevo.';
      errBox.hidden = false;
    } finally {
      submitBtn.disabled = false;
      // Restaurar el texto correcto del modo activo
      if (currentMode === 'add') submitBtn.textContent = 'Sumar créditos';
      else if (currentMode === 'sub') submitBtn.textContent = 'Restar créditos';
      else if (currentMode === 'clear') submitBtn.textContent = 'Vaciar saldo';
      else submitBtn.textContent = 'Confirmar';
    }
  }

  // ============================================================
  // Modal: ver detalle del usuario
  // ============================================================
  async function openDetail(userId) {
    var u = cachedUsers.find(function (x) { return x.id === userId; });
    if (!u) return;

    var modal = document.getElementById('userDetailModal');
    if (!modal) return;
    modal.setAttribute('data-current-user', userId);

    document.getElementById('userDetailName').textContent = u.full_name || u.email || 'Usuario';

    // Cargar transacciones del usuario
    var sb = getSB();
    var txRes = sb ? await sb.rpc('admin_list_user_transactions', { target_user_id: userId }) : { data: [] };
    var transactions = txRes.data || [];

    var txHtml = transactions.length
      ? '<ul class="user-history-list">' + transactions.slice(0, 10).map(function (t) {
          var sign = t.amount > 0 ? '+' : '';
          return '<li><span>' + (t.description || t.type) + ' <strong>' + sign + t.amount + '</strong></span><span class="hist-when">' + fmtDate(t.created_at) + '</span></li>';
        }).join('') + '</ul>'
      : '<p style="color:var(--c-muted);font-size:12.5px;margin:0">Sin movimientos registrados.</p>';

    // ── Plan ──
    var TIER_LABELS = { profesional: 'Profesional', profesional_plus: 'Profesional Plus', business: 'Business' };
    var subTier = u.subscription_tier;
    var subExp = u.subscription_expires_at;
    var subActive = !!(subTier && subExp && (new Date(subExp).getTime() > Date.now()));
    var premiumActivo = subActive && (subTier === 'profesional_plus' || subTier === 'business');
    var subHtml;
    if (subActive) {
      var diasQuedan = Math.max(0, Math.ceil((new Date(subExp).getTime() - Date.now()) / 86400000));
      subHtml =
        '<div class="sub-card">' +
          '<div class="sub-card-info">' +
            '<strong class="sub-tier">' + esc(TIER_LABELS[subTier] || subTier) + '</strong>' +
            '<span class="sub-meta">Vence el ' + esc(fmtDate(subExp)) + ' · ' +
              (diasQuedan === 1 ? 'queda 1 día' : 'quedan ' + diasQuedan + ' días') + ' · ' +
              (premiumActivo ? 'con Consultas Premium' : 'sin Consultas Premium') +
            '</span>' +
          '</div>' +
          '<div class="cell-actions">' +
            '<button class="btn-ghost" id="userDetailPlanBtn" type="button">Extender o cambiar</button>' +
            '<button class="btn btn-danger" id="userDetailCancelSub" type="button">Cancelar plan</button>' +
          '</div>' +
        '</div>';
    } else {
      /* Sin plan vivo, pero puede haber uno caducado: decir solo «sin
         plan» escondía que el cliente FUE de pago, que es justo a quien
         hay que llamar. */
      subHtml =
        '<p class="fi-vacio">' + ((subTier && subExp)
          ? 'Tuvo el plan <strong>' + esc(TIER_LABELS[subTier] || subTier) + '</strong>, vencido el ' + esc(fmtDate(subExp))
          : 'Nunca ha tenido un plan: usa créditos sueltos.') + '</p>' +
        '<div class="fi-otorgar" style="margin-top:12px;">' +
          '<button class="btn btn-primary" id="userDetailPlanBtn" type="button">Dar un plan por días</button>' +
        '</div>';
    }

    /* Las marcas que antes iban pegadas al nombre en la tabla. Aquí
       caben con su nombre entero y sin abreviar. */
    var marcas = [];
    marcas.push(isEmailConfirmed(u)
      ? '<span class="fi-marca">Correo confirmado</span>'
      : '<span class="fi-marca fi-marca-no">Correo sin confirmar</span>');
    if (u.is_admin)     marcas.push('<span class="fi-marca">Administrador</span>');
    if (u._paid_mp)     marcas.push('<span class="fi-marca">Pagó por Mercado Pago</span>');
    if (u._paid_admin)  marcas.push('<span class="fi-marca">Activado por un administrador</span>');
    if (u._used_free)   marcas.push('<span class="fi-marca fi-marca-no">Gastó sus créditos de bienvenida</span>');

    var html =
      /* La ficha, en este orden: QUIÉN es, CÓMO llegó, QUÉ tiene y QUÉ
         ha hecho. La tabla solo enseña lo imprescindible; todo lo demás
         está aquí, escrito con todas las letras. */
      '<div class="fi-bloque">' +
        '<h4 class="fi-rot">Cuenta</h4>' +
        '<div class="fi-rejilla">' +
          '<div class="fi-dato"><span>Correo</span><strong>' + esc(u.email || '—') + '</strong></div>' +
          '<div class="fi-dato"><span>Teléfono</span><strong>' + esc(u.phone || '—') + '</strong></div>' +
          '<div class="fi-dato"><span>Estado</span><strong>' + (u.status === 'active' ? 'Activo' : 'Suspendido') + '</strong></div>' +
          '<div class="fi-dato"><span>Registrado</span><strong>' + esc(fmtDate(u.created_at)) + '</strong></div>' +
          '<div class="fi-dato"><span>Último acceso</span><strong>' + esc(fmtRelative(u.last_sign_in_at)) + '</strong></div>' +
          '<div class="fi-dato"><span>Identificador</span><strong style="font-size:13px;">' + esc(u.id) + '</strong></div>' +
        '</div>' +
      '</div>' +
      '<div class="fi-bloque">' +
        '<h4 class="fi-rot">Marcas</h4>' +
        '<div class="fi-marcas">' + marcas.join('') + '</div>' +
      '</div>' +
      '<div class="fi-bloque">' +
        '<h4 class="fi-rot">Créditos y consumo</h4>' +
        '<div class="fi-rejilla">' +
          '<div class="fi-dato"><span>Saldo actual</span><strong>' + (subActive ? 'Ilimitado' : esc(u.credits_balance || 0)) + '</strong></div>' +
          '<div class="fi-dato"><span>Créditos gastados</span><strong>' + esc(u._gastados || 0) + '</strong></div>' +
          '<div class="fi-dato"><span>Consultas totales</span><strong>' + esc(u._consumos || 0) + '</strong></div>' +
          '<div class="fi-dato"><span>Consultas hoy</span><strong>' + esc(u._hoy || 0) + '</strong></div>' +
          (subActive
            ? '<div class="fi-dato"><span>Saldo guardado</span><strong>' + esc(u.credits_balance || 0) + '</strong></div>'
            : '') +
        '</div>' +
        (subActive ? '<p class="fi-vacio" style="margin-top:10px;">Con plan por días las consultas no descuentan créditos; el saldo queda intacto para cuando venza.</p>' : '') +
      '</div>' +
      '<div class="fi-bloque">' +
        '<h4 class="fi-rot">Plan</h4>' +
        subHtml +
      '</div>' +
      '<div class="fi-bloque">' +
        '<h4 class="fi-rot">Movimientos <small>' + transactions.length + '</small></h4>' +
        txHtml +
      '</div>';

    document.getElementById('userDetailBody').innerHTML = html;

    // Wire del botón "Cancelar plan" (si existe)
    var cancelSubBtn = document.getElementById('userDetailCancelSub');
    if (cancelSubBtn) {
      cancelSubBtn.addEventListener('click', function () { cancelSubscription(userId); });
    }

    // Dar, extender o cambiar el plan: el mismo cuadro que el botón
    // «Plan» de la fila, para no tener dos sitios donde se otorga.
    var planBtn = document.getElementById('userDetailPlanBtn');
    if (planBtn) {
      planBtn.addEventListener('click', function () { openPlanModal(userId); });
    }

    // Botón Suspender/Reactivar — visible para todos los usuarios excepto
    // admins (no permitimos que un admin suspenda a otro admin desde aquí
    // — el manejo del rol admin se hace en la sección "Equipo").
    var toggleBtn = document.getElementById('userDetailToggle');
    if (toggleBtn) {
      if (u.is_admin) {
        toggleBtn.hidden = true;
      } else {
        toggleBtn.hidden = false;
        if (u.status === 'active') {
          toggleBtn.textContent = 'Suspender';
          toggleBtn.classList.remove('btn-primary');
          toggleBtn.classList.add('btn-danger');
        } else {
          toggleBtn.textContent = 'Reactivar';
          toggleBtn.classList.remove('btn-danger');
          toggleBtn.classList.add('btn-primary');
        }
      }
    }

    // Botón Eliminar cuenta — oculto para admins
    var deleteBtn = document.getElementById('userDetailDelete');
    if (deleteBtn) deleteBtn.hidden = !!u.is_admin;

    modal.hidden = false;
  }

  function closeDetail() {
    var m = document.getElementById('userDetailModal');
    if (m) m.hidden = true;
  }

  // ============================================================
  // Toggle status (Suspender / Reactivar)
  // Requiere la política RLS "admin updates profiles" creada en
  // supabase/admin/admin_rls.sql para que el UPDATE no sea bloqueado.
  // ============================================================
  // ============================================================
  // Activar Premium: otorga plan Profesional Plus o Business
  // ============================================================
  // ============================================================
  // DAR, EXTENDER O CAMBIAR EL PLAN POR DÍAS
  //
  // Un solo cuadro para los dos sitios que lo piden: el botón «Plan» de
  // la fila y el de la ficha. Antes esto solo vivía dentro de la ficha
  // y únicamente para los planes que desbloquean Premium, así que dar
  // un Profesional de 7 días había que hacerlo por otro camino.
  //
  // La base suma los días si el plan es el mismo y empieza de cero si
  // es otro (admin_grant_subscription); aquí solo hay que decirlo claro
  // antes de que se pulse.
  // ============================================================
  var planModalUserId = null;

  function ensurePlanModal() {
    if (document.getElementById('userPlanModal')) return;
    var html = ''
      + '<div class="modal" id="userPlanModal" hidden role="dialog" aria-modal="true">'
      + '  <div class="modal-overlay" data-close-plan></div>'
      + '  <div class="modal-panel" style="max-width:520px;">'
      + '    <header class="modal-header">'
      + '      <h2 id="userPlanTitle">Dar un plan por días</h2>'
      + '      <button class="modal-close" type="button" aria-label="Cerrar" data-close-plan>'
      + '        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
      + '      </button>'
      + '    </header>'
      + '    <div class="modal-body">'
      + '      <p class="fi-vacio" id="userPlanWho"></p>'
      + '      <div class="field" style="margin-top:14px;">'
      + '        <label for="userPlanSelect">Plan</label>'
      + '        <select id="userPlanSelect" class="admin-select" style="width:100%;"></select>'
      + '      </div>'
      + '      <div class="field" style="margin-top:12px;">'
      + '        <label for="userPlanMetodo">Cómo pagó</label>'
      + '        <select id="userPlanMetodo" class="admin-select" style="width:100%;">'
      + '          <option value="yape">Yape</option>'
      + '          <option value="plin">Plin</option>'
      + '          <option value="efectivo">Efectivo</option>'
      + '          <option value="transferencia">Transferencia</option>'
      + '          <option value="mercadopago">Mercado Pago</option>'
      + '          <option value="otro">Otro</option>'
      + '        </select>'
      + '      </div>'
      + '      <p class="field-hint" id="userPlanHint" style="margin-top:10px;"></p>'
      + '    </div>'
      + '    <footer class="modal-footer">'
      + '      <button class="btn-ghost" type="button" data-close-plan>Cancelar</button>'
      + '      <button class="btn btn-primary" type="button" id="userPlanConfirm">Otorgar plan</button>'
      + '    </footer>'
      + '  </div>'
      + '</div>';
    var cont = document.createElement('div');
    cont.innerHTML = html;
    document.body.appendChild(cont.firstChild);

    document.querySelectorAll('#userPlanModal [data-close-plan]').forEach(function (el) {
      el.addEventListener('click', closePlanModal);
    });
    document.getElementById('userPlanConfirm').addEventListener('click', grantPlan);
    document.getElementById('userPlanSelect').addEventListener('change', paintPlanHint);
  }

  function planesDisponibles() {
    return (Consultia.Plans && Consultia.Plans.getActiveSubscriptionPlans)
      ? Consultia.Plans.getActiveSubscriptionPlans()
      : [];
  }

  function paintPlanHint() {
    var hint = document.getElementById('userPlanHint');
    var sel = document.getElementById('userPlanSelect');
    if (!hint || !sel) return;
    var u = cachedUsers.find(function (x) { return x.id === planModalUserId; });
    var plan = planesDisponibles().find(function (p) { return p.id === sel.value; });
    if (!plan) { hint.textContent = 'Elige un plan para ver en qué queda la cuenta.'; return; }

    var premium = (plan.tier === 'profesional_plus' || plan.tier === 'business');
    var vivo = !!(u && u.subscription_tier && u.subscription_expires_at &&
                  new Date(u.subscription_expires_at).getTime() > Date.now());
    var texto;
    if (vivo && u.subscription_tier === plan.tier) {
      texto = 'Se le SUMAN ' + plan.days + ' días a lo que ya tiene (vence el ' + fmtDate(u.subscription_expires_at) + ').';
    } else if (vivo) {
      texto = 'Cambia de plan: los ' + plan.days + ' días empiezan hoy y pierde lo que le quedaba del anterior.';
    } else {
      texto = 'Empieza hoy y dura ' + plan.days + ' días.';
    }
    texto += premium ? ' Desbloquea las Consultas Premium.' : ' No incluye Consultas Premium.';
    texto += ' Mientras dure, sus consultas no gastan créditos.';
    hint.textContent = texto;
  }

  function openPlanModal(userId) {
    var u = cachedUsers.find(function (x) { return x.id === userId; });
    if (!u) return;
    var planes = planesDisponibles();
    if (!planes.length) {
      if (Consultia.toast) Consultia.toast({
        type: 'error', title: 'Sin planes', message: 'No hay planes por días activos.'
      });
      return;
    }

    ensurePlanModal();
    planModalUserId = userId;

    var vivo = !!(u.subscription_tier && u.subscription_expires_at &&
                  new Date(u.subscription_expires_at).getTime() > Date.now());
    document.getElementById('userPlanTitle').textContent = vivo ? 'Extender o cambiar el plan' : 'Dar un plan por días';
    document.getElementById('userPlanWho').textContent = (u.full_name || 'Sin nombre') + ' · ' + (u.email || 'sin correo');

    var TIER = { profesional: 'Profesional', profesional_plus: 'Profesional Plus', business: 'Business' };
    var sel = document.getElementById('userPlanSelect');
    sel.innerHTML = '<option value="">— Elige un plan —</option>' + planes.map(function (p) {
      return '<option value="' + p.id + '">' + (TIER[p.tier] || p.tier) + ' · ' + p.days + ' días · S/ ' + p.price + '</option>';
    }).join('');
    paintPlanHint();

    document.getElementById('userPlanModal').hidden = false;
  }

  function closePlanModal() {
    var m = document.getElementById('userPlanModal');
    if (m) m.hidden = true;
    planModalUserId = null;
  }

  async function grantPlan() {
    var userId = planModalUserId;
    var u = cachedUsers.find(function (x) { return x.id === userId; });
    if (!u) return;

    var sel = document.getElementById('userPlanSelect');
    var plan = planesDisponibles().find(function (p) { return p.id === (sel && sel.value); });
    if (!plan) {
      if (Consultia.toast) Consultia.toast({
        type: 'error', title: 'Elige un plan', message: 'No has seleccionado ninguno.'
      });
      return;
    }

    var sb = getSB();
    if (!sb) return;
    var btn = document.getElementById('userPlanConfirm');
    if (btn) { btn.disabled = true; btn.dataset.orig = btn.textContent; btn.textContent = 'Otorgando…'; }

    try {
      var metodoEl = document.getElementById('userPlanMetodo');
      var metodo = (metodoEl && metodoEl.value) || 'whatsapp';

      /* Sin p_amount_pen: con importe, la RPC anota la venta ella misma y
         la marca «whatsapp» pase lo que pase. Se anota aquí debajo con el
         método elegido. Sigue siendo una sola fila de venta. */
      var res = await sb.rpc('admin_grant_subscription', {
        target_user_id: u.id,
        p_tier: plan.tier,
        p_days: plan.days,
        p_plan_id: plan.id,
        p_note: 'Plan otorgado desde el panel',
        p_amount_pen: null
      });
      if (res.error) throw res.error;

      if (plan.price) {
        try {
          await sb.rpc('admin_record_sale', {
            target_user_id: u.id,
            p_amount_pen: parseFloat(plan.price),
            p_kind: 'subscription',
            p_plan_id: plan.id,
            p_note: 'Plan otorgado desde el panel',
            p_method: metodo
          });
        } catch (saleErr) {
          console.warn('No se pudo registrar el ingreso S/ del plan:', saleErr);
        }
      }

      var TIER = { profesional: 'Profesional', profesional_plus: 'Profesional Plus', business: 'Business' };
      if (Consultia.toast) Consultia.toast({
        type: 'success',
        title: 'Plan otorgado',
        message: (TIER[plan.tier] || plan.tier) + ' de ' + plan.days + ' días para ' + (u.full_name || u.email) + '.'
      });
      if (typeof A.logAudit === 'function') {
        A.logAudit('subscription.grant', u.email, plan.tier + ' · ' + plan.days + ' días');
      }

      closePlanModal();
      cachedUsers = await loadUsers();
      paint();
      var ficha = document.getElementById('userDetailModal');
      if (ficha && !ficha.hidden && ficha.getAttribute('data-current-user') === userId) {
        await openDetail(userId);
      }
    } catch (err) {
      console.error('Error otorgando plan:', err);
      if (Consultia.toast) Consultia.toast({
        type: 'error',
        title: 'No se pudo otorgar el plan',
        message: (err && err.message) || 'Intenta de nuevo.'
      });
    } finally {
      if (btn) {
        btn.disabled = false;
        if (btn.dataset.orig) btn.textContent = btn.dataset.orig;
      }
    }
  }

  // ============================================================
  // Cancelar la suscripción de un usuario (admin_cancel_subscription)
  // ============================================================
  async function cancelSubscription(userId) {
    var u = cachedUsers.find(function (x) { return x.id === userId; });
    if (!u) return;

    var confirmed = false;
    var motivo = '';

    if (Consultia.confirmDialog) {
      await new Promise(function (resolve) {
        Consultia.confirmDialog({
          title: 'Cancelar plan',
          messageHtml: '¿Seguro que quieres cancelar el plan de <strong>' + esc(u.full_name || u.email) + '</strong>?<br><br>' +
                   'Perderá inmediatamente el acceso a las consultas premium. Esta acción no se puede deshacer.',
          confirmLabel: 'Cancelar plan',
          confirmStyle: 'danger',
          onConfirm: function () { confirmed = true; resolve(); },
          onCancel: function () { resolve(); }
        });
      });
    } else {
      confirmed = confirm('¿Cancelar plan de ' + (u.full_name || u.email) + '?');
    }
    if (!confirmed) return;

    var sb = getSB();
    if (!sb) return;
    var btn = document.getElementById('userDetailCancelSub');
    if (btn) { btn.disabled = true; btn.dataset.orig = btn.textContent; btn.textContent = 'Cancelando…'; }

    try {
      var res = await sb.rpc('admin_cancel_subscription', {
        target_user_id: userId,
        p_note: motivo || null
      });
      if (res.error) throw res.error;

      if (Consultia.toast) Consultia.toast({
        type: 'success',
        title: 'Plan cancelado',
        message: 'Se canceló el plan de ' + (u.full_name || u.email) + '. El usuario fue notificado.'
      });

      A.logAudit('subscription.cancel', u.email, 'Plan cancelado por admin');

      // Refrescar cache y UI
      cachedUsers = await loadUsers();
      paint();
      // Re-renderizar el detalle con los datos actualizados
      await openDetail(userId);
    } catch (err) {
      console.error('Error cancelando suscripción:', err);
      if (Consultia.toast) Consultia.toast({
        type: 'error',
        title: 'No se pudo cancelar',
        message: (err && err.message) || 'Intenta de nuevo.'
      });
    } finally {
      if (btn) {
        btn.disabled = false;
        if (btn.dataset.orig) btn.textContent = btn.dataset.orig;
      }
    }
  }

  async function toggleUserStatus() {
    var modal = document.getElementById('userDetailModal');
    if (!modal) return;
    var userId = modal.getAttribute('data-current-user');
    if (!userId) return;
    var u = cachedUsers.find(function (x) { return x.id === userId; });
    if (!u) return;
    if (u.is_admin) {
      if (Consultia.toast) Consultia.toast({
        type: 'warning', title: 'Acción bloqueada',
        message: 'No puedes cambiar el estado de otro administrador.'
      });
      return;
    }

    var newStatus = u.status === 'active' ? 'suspended' : 'active';
    var actionLabel = newStatus === 'suspended' ? 'Suspender' : 'Reactivar';

    var confirmed = false;
    if (Consultia.confirmDialog) {
      await new Promise(function (resolve) {
        Consultia.confirmDialog({
          title: actionLabel + ' usuario',
          message: '¿Seguro que quieres ' + actionLabel.toLowerCase() + ' a "' + (u.full_name || u.email) + '"?' +
                   (newStatus === 'suspended'
                     ? ' No podrá iniciar sesión hasta que lo reactives.'
                     : ' Podrá volver a iniciar sesión.'),
          confirmLabel: actionLabel,
          confirmStyle: newStatus === 'suspended' ? 'danger' : 'primary',
          onConfirm: function () { confirmed = true; resolve(); },
          onCancel: function () { resolve(); }
        });
      });
    } else {
      confirmed = confirm('¿' + actionLabel + ' a ' + (u.full_name || u.email) + '?');
    }
    if (!confirmed) return;

    var sb = getSB();
    if (!sb) return;
    var btn = document.getElementById('userDetailToggle');
    if (btn) { btn.disabled = true; btn.dataset.orig = btn.textContent; btn.textContent = 'Guardando…'; }

    try {
      var res = await sb.from('profiles')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select('id, status');
      if (res.error) throw res.error;
      if (!res.data || !res.data.length) {
        throw new Error('No se pudo actualizar (¿faltan políticas RLS?)');
      }

      if (typeof A.logAudit === 'function') {
        A.logAudit(
          'user.' + (newStatus === 'suspended' ? 'suspend' : 'reactivate'),
          u.email || userId,
          actionLabel + ' desde panel admin'
        );
      }

      if (Consultia.toast) Consultia.toast({
        type: 'success',
        title: actionLabel + 'do',
        message: (u.full_name || u.email) + ' — estado: ' + newStatus
      });

      closeDetail();
      cachedUsers = await loadUsers();
      paint();
    } catch (err) {
      console.error('Error cambiando estado:', err);
      if (Consultia.toast) Consultia.toast({
        type: 'error',
        title: 'No se pudo cambiar el estado',
        message: (err && err.message) || 'Intenta de nuevo.'
      });
    } finally {
      if (btn) {
        btn.disabled = false;
        if (btn.dataset.orig) btn.textContent = btn.dataset.orig;
      }
    }
  }

  // ============================================================
  // Eliminar cuenta de usuario (definitivo) + abrir WhatsApp
  // Requiere la RPC admin_delete_user creada en
  // supabase/admin/admin_delete_user.sql
  // ============================================================
  function normalizePhoneForWa(raw) {
    if (!raw) return '';
    // Dejar solo dígitos
    var digits = String(raw).replace(/\D+/g, '');
    if (!digits) return '';
    // Si tiene 9 dígitos asumimos Perú y prefijamos 51
    if (digits.length === 9) digits = '51' + digits;
    return digits;
  }

  function openWhatsAppWithDeletionMessage(u) {
    var phone = normalizePhoneForWa(u && u.phone);
    var name = (u && (u.full_name || u.email)) || '';
    var firstName = name ? name.split(' ')[0] : '';
    var msg =
      'Hola' + (firstName ? ' ' + firstName : '') + ', te escribimos de *Filtro Vehicular+*.\n\n' +
      'Tu cuenta ha sido *eliminada* de nuestra plataforma.\n' +
      'Ya no tendrás acceso a tus créditos ni historial de consultas.\n\n' +
      'Si no solicitaste esto o tienes alguna duda, responde este mensaje y te ayudamos.\n\n' +
      '— Equipo Filtro Vehicular+';
    var encoded = encodeURIComponent(msg);
    var url = phone
      ? ('https://wa.me/' + phone + '?text=' + encoded)
      : ('https://wa.me/?text=' + encoded);
    try { window.open(url, '_blank', 'noopener'); } catch (_) {}
  }

  /* Se llama desde dos sitios: la papelera de la fila (que pasa el id)
     y el botón del pie de la ficha (que no lo pasa y lo saca de ella). */
  async function deleteUser(idArg) {
    var modal = document.getElementById('userDetailModal');
    var userId = idArg || (modal && modal.getAttribute('data-current-user'));
    if (!userId) return;
    var u = cachedUsers.find(function (x) { return x.id === userId; });
    if (!u) return;
    if (u.is_admin) {
      if (Consultia.toast) Consultia.toast({
        type: 'warning', title: 'Acción bloqueada',
        message: 'No puedes eliminar a otro administrador.'
      });
      return;
    }

    var label = u.full_name || u.email || 'usuario';
    var confirmed = false;
    if (Consultia.confirmDialog) {
      await new Promise(function (resolve) {
        Consultia.confirmDialog({
          title: 'Eliminar cuenta',
          message:
            '¿Seguro que quieres ELIMINAR la cuenta de "' + label + '"?\n\n' +
            'Se borrarán de forma permanente: perfil, créditos, transacciones, ' +
            'pagos, notificaciones y consultas. Esta acción NO se puede deshacer.\n\n' +
            'Después se abrirá WhatsApp para que le notifiques al usuario.',
          confirmLabel: 'Sí, eliminar',
          confirmStyle: 'danger',
          onConfirm: function () { confirmed = true; resolve(); },
          onCancel: function () { resolve(); }
        });
      });
    } else {
      confirmed = confirm('¿Eliminar definitivamente la cuenta de ' + label + '?');
    }
    if (!confirmed) return;

    var sb = getSB();
    if (!sb) return;
    var btn = idArg ? null : document.getElementById('userDetailDelete');
    if (btn) { btn.disabled = true; btn.dataset.orig = btn.textContent; btn.textContent = 'Eliminando…'; }

    try {
      var res = await sb.rpc('admin_delete_user', { target_user_id: userId });
      if (res.error) throw res.error;
      var ok = !!res.data;

      if (!ok) {
        throw new Error('No se pudo eliminar (la operación devolvió false).');
      }

      if (typeof A.logAudit === 'function') {
        A.logAudit('user.delete', u.email || userId, 'Eliminación definitiva desde panel admin');
      }

      // Snapshot del usuario para WhatsApp ANTES de limpiar caché
      var snapshot = { phone: u.phone, full_name: u.full_name, email: u.email };

      if (Consultia.toast) Consultia.toast({
        type: 'success',
        title: 'Cuenta eliminada por completo',
        message: 'La cuenta de "' + label + '" fue borrada del sistema. Abriendo WhatsApp…',
        duration: 5500
      });

      closeDetail();
      cachedUsers = await loadUsers();
      paint();

      // Abrir WhatsApp con el mensaje pre-escrito (con un pequeño delay
      // para que el toast se vea antes del cambio de pestaña)
      setTimeout(function () { openWhatsAppWithDeletionMessage(snapshot); }, 600);
    } catch (err) {
      console.error('Error eliminando cuenta:', err);
      if (Consultia.toast) Consultia.toast({
        type: 'error',
        title: 'No se pudo eliminar',
        message: (err && err.message) || 'Intenta de nuevo.'
      });
    } finally {
      if (btn) {
        btn.disabled = false;
        if (btn.dataset.orig) btn.textContent = btn.dataset.orig;
      }
    }
  }

  // ============================================================
  // Init
  // ============================================================
  A.initUsers = function () {
    var searchInput = document.getElementById('usersSearch');
    var filterSelect = document.getElementById('usersFilter');
    if (searchInput) searchInput.addEventListener('input', paint);
    if (filterSelect) filterSelect.addEventListener('change', paint);

    var exportBtn = document.getElementById('usersExport');
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        if (!A.exportCSV) return;
        A.exportCSV('usuarios.csv',
          ['ID', 'Nombre', 'Correo', 'Teléfono', 'Estado', 'Créditos', 'Registrado', 'Último acceso'],
          cachedUsers.map(function (u) {
            return [u.id, u.full_name || '', u.email || '', u.phone || '', u.status, u.credits_balance || 0, u.created_at, u.last_sign_in_at || ''];
          })
        );
      });
    }

    var tableBody = document.getElementById('usersTableBody');
    if (tableBody) {
      tableBody.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-action]');
        if (!btn) return;
        var userId = btn.dataset.userId;
        if (btn.dataset.action === 'view') openDetail(userId);
        else if (btn.dataset.action === 'plan') openPlanModal(userId);
        else if (btn.dataset.action === 'addcredits' || btn.dataset.action === 'recargar') openCreditsModal(userId, 'add');
        else if (btn.dataset.action === 'subcredits') openCreditsModal(userId, 'sub');
        else if (btn.dataset.action === 'borrar') deleteUser(userId);
      });

      // Checkboxes por fila (modo "Sin confirmar")
      tableBody.addEventListener('change', function (e) {
        var cb = e.target.closest('.user-row-check');
        if (!cb) return;
        var id = cb.dataset.userId;
        if (cb.checked) selectedForDelete.add(id);
        else selectedForDelete.delete(id);
        refreshDeleteBar();

        // Sincronizar el "select all"
        var selAll = document.getElementById('usersSelectAll');
        if (selAll) {
          var visibleSelectables = filterUsers(cachedUsers).filter(function (u) { return !u.is_admin; });
          var allChecked = visibleSelectables.length > 0 &&
            visibleSelectables.every(function (u) { return selectedForDelete.has(u.id); });
          selAll.checked = allChecked;
          selAll.indeterminate = !allChecked && visibleSelectables.some(function (u) { return selectedForDelete.has(u.id); });
        }
      });
    }

    // Checkbox "select all"
    var selAll = document.getElementById('usersSelectAll');
    if (selAll) {
      selAll.addEventListener('change', function () {
        var visible = filterUsers(cachedUsers).filter(function (u) { return !u.is_admin; });
        if (selAll.checked) visible.forEach(function (u) { selectedForDelete.add(u.id); });
        else visible.forEach(function (u) { selectedForDelete.delete(u.id); });
        paint();
      });
    }

    // Botón "Eliminar seleccionados"
    var deleteBtn = document.getElementById('usersDeleteSelected');
    if (deleteBtn) deleteBtn.addEventListener('click', deleteSelectedUsers);

    document.querySelectorAll('#userDetailModal [data-close]').forEach(function (el) {
      el.addEventListener('click', closeDetail);
    });
    var recargarBtn = document.getElementById('userDetailRecargar');
    if (recargarBtn) {
      recargarBtn.textContent = '+ Agregar créditos';
      recargarBtn.addEventListener('click', function () {
        var currentId = document.getElementById('userDetailModal').getAttribute('data-current-user');
        if (currentId) openCreditsModal(currentId);
        closeDetail();
      });
    }

    // Botón Suspender/Reactivar (en el modal de detalle)
    var toggleBtn = document.getElementById('userDetailToggle');
    if (toggleBtn) toggleBtn.addEventListener('click', toggleUserStatus);

    // Botón Eliminar cuenta (definitivo + WhatsApp al usuario)
    var deleteUserBtn = document.getElementById('userDetailDelete');
    if (deleteUserBtn) deleteUserBtn.addEventListener('click', function () { deleteUser(); });
  };
})();
