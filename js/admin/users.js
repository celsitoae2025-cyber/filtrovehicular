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

  function renderRow(u) {
    var statusChip = u.status === 'active'
      ? '<span class="chip chip-ok">Activo</span>'
      : '<span class="chip chip-off">Suspendido</span>';
    var adminBadge = u.is_admin ? '<span class="chip chip-admin" style="background:#edf7d9;color:#141d1c;margin-left:4px;">Admin</span>' : '';
    var checkboxCell = '';
    if (isSelectModeActive() && !u.is_admin) {
      var checked = selectedForDelete.has(u.id) ? 'checked' : '';
      checkboxCell = '<td><input type="checkbox" class="user-row-check" data-user-id="' + u.id + '" ' + checked + '></td>';
    } else if (isSelectModeActive()) {
      // Admin: mostramos celda vacía para mantener la columna alineada
      checkboxCell = '<td></td>';
    }

    // Badges de email confirmado / suscripción / pagó (solo texto, sin emojis)
    var emailBadge = isEmailConfirmed(u)
      ? '<span class="chip chip-ok" style="margin-left:4px;font-size:10.5px;" title="Email confirmado">Confirmado</span>'
      : '<span class="chip chip-off" style="margin-left:4px;font-size:10.5px;" title="Email sin confirmar">Sin confirmar</span>';
    var subBadge = isSubscriptionActive(u)
      ? '<span class="chip chip-ok" style="margin-left:4px;background:#edf7d9;color:#141d1c;" title="Suscripción activa">Plan activo</span>'
      : '';
    var paidMpBadge = u._paid_mp
      ? '<span class="chip chip-ok" style="margin-left:4px;background:#edf7d9;color:#8fc72e;" title="Pagó por Mercado Pago">MP</span>'
      : '';
    var paidAdminBadge = u._paid_admin
      ? '<span class="chip chip-ok" style="margin-left:4px;background:#edf7d9;color:#141d1c;" title="Activado por admin (WhatsApp/manual)">Admin</span>'
      : '';
    var freeBadge = u._used_free
      ? '<span class="chip chip-off" style="margin-left:4px;font-size:10.5px;" title="Consumió sus 5 créditos gratis">Consumió free</span>'
      : '';

    var hasCredits = (u.credits_balance || 0) > 0;
    var subBtn = hasCredits
      ? '<button class="table-btn danger" data-action="subcredits" data-user-id="' + u.id + '" title="Restar o vaciar créditos">âˆ’ Créditos</button>'
      : '';

    // Plan/Tier column
    var TIER_COLORS = {
      profesional:      { bg: '#f5f5f5', color: '#141d1c', label: 'Profesional' },
      profesional_plus: { bg: '#141d1c', color: '#8fc72e', label: 'Prof. Plus (Premium)' },
      business:         { bg: '#141d1c', color: '#8fc72e', label: 'Business (Premium)' }
    };
    var planCell = '';
    var activeTier = null;
    
    // 1. Si tiene suscripción real activa por días
    if (isSubscriptionActive(u) && u.subscription_tier) {
      activeTier = u.subscription_tier;
    } 
    // 2. Si NO tiene suscripción, pero tiene créditos pagados o más que el saldo gratis
    else if (u.credits_balance > 5 || u.has_paid_credits) {
      if (u.credits_balance >= 1500) {
        activeTier = 'business';
      } else {
        activeTier = 'profesional';
      }
    }

    if (activeTier && TIER_COLORS[activeTier]) {
      var tc = TIER_COLORS[activeTier];
      planCell = '<span class="chip" style="background:' + tc.bg + ';color:' + tc.color + ';font-weight:600;font-size:11px;">' + tc.label + '</span>';
    } else {
      planCell = '<span style="color:var(--c-muted);font-size:12px;">Free</span>';
    }

    return '<tr data-user-id="' + u.id + '">' +
      checkboxCell +
      '<td><div class="cell-user">' +
        '<span class="avatar">' + esc(initialsOf(u.full_name || u.email)) + '</span>' +
        '<div class="user-info"><strong>' + esc(u.full_name || '—') + adminBadge + subBadge + paidMpBadge + paidAdminBadge + freeBadge + '</strong><span>' + esc(u.phone || 'Sin teléfono') + '</span></div>' +
      '</div></td>' +
      '<td>' + esc(u.email || '—') + emailBadge + '</td>' +
      '<td>' + planCell + '</td>' +
      '<td>' + esc(fmtDate(u.created_at)) + '</td>' +
      '<td><strong style="color:var(--c-primary);font-size:15px;">' + esc(u.credits_balance || 0) + '</strong></td>' +
      '<td>' + esc(fmtRelative(u.last_sign_in_at)) + '</td>' +
      '<td>' + statusChip + '</td>' +
      '<td><div class="cell-actions">' +
        '<button class="table-btn" data-action="view" data-user-id="' + u.id + '">Ver</button>' +
        '<button class="table-btn primary" data-action="addcredits" data-user-id="' + u.id + '">+ Créditos</button>' +
        subBtn +
      '</div></td>' +
    '</tr>';
  }

  async function loadUsers() {
    var sb = getSB();
    if (!sb) return [];

    var res = await sb.rpc('admin_list_users');
    if (res.error) {
      console.error('admin_list_users error:', res.error);
      if (Consultia.toast) Consultia.toast({
        type: 'error',
        title: 'Error cargando usuarios',
        message: res.error.message
      });
      return [];
    }
    var users = res.data || [];

    // Enriquecer: identificar quién pagó por MP, quién fue activado por admin
    // y cuántos consumos tiene cada usuario (para detectar si gastó los 5 free).
    try {
      var txRes = await sb
        .from('transactions')
        .select('user_id, type, amount, payment_method');
      if (!txRes.error && txRes.data) {
        var paidMpSet = new Set();
        var paidAdminSet = new Set();
        var consumosPorUsuario = {};
        txRes.data.forEach(function (t) {
          if (!t.user_id) return;
          // MP: pagos reales por Mercado Pago (purchase / subscription)
          var isMpPay = (t.type === 'purchase' || t.type === 'subscription')
                        && t.payment_method === 'mercadopago';
          if (isMpPay) paidMpSet.add(t.user_id);

          // Admin: cualquier ajuste manual hecho por un admin
          //   - admin_adjust: lo emite la RPC admin_adjust_credits
          //   - whatsapp/manual: rutas alternas heredadas
          var isAdminPay = (t.type === 'admin_adjust' && t.amount > 0)
                           || ((t.type === 'purchase' || t.type === 'subscription')
                               && (t.payment_method === 'whatsapp' || t.payment_method === 'manual'));
          if (isAdminPay) paidAdminSet.add(t.user_id);

          // Consumos: aceptamos los dos nombres históricos
          if (t.type === 'consumption' || t.type === 'consultation') {
            consumosPorUsuario[t.user_id] = (consumosPorUsuario[t.user_id] || 0) + 1;
          }
        });
        users.forEach(function (u) {
          u._paid_mp = paidMpSet.has(u.id);
          u._paid_admin = paidAdminSet.has(u.id);
          u._has_paid = u._paid_mp || u._paid_admin;
          u._consumos = consumosPorUsuario[u.id] || 0;
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
      // bienvenida o pagados) pero todavía no los gasta. Ãštil para hacer
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

  function updateStatCards() {
    var totalEl = document.getElementById('usersStatTotal');
    var mpEl = document.getElementById('usersStatPaidMp');
    var adminEl = document.getElementById('usersStatPaidAdmin');
    var freeEl = document.getElementById('usersStatUsedFree');
    if (!totalEl) return;
    var total = cachedUsers.length;
    var mp = 0, admin = 0, freeUsed = 0;
    cachedUsers.forEach(function (u) {
      if (u._paid_mp) mp++;
      if (u._paid_admin) admin++;
      if (u._used_free) freeUsed++;
    });
    totalEl.textContent = total;
    mpEl.textContent = mp;
    adminEl.textContent = admin;
    freeEl.textContent = freeUsed;
  }

  function paint() {
    var rows = filterUsers(cachedUsers);
    var body = document.getElementById('usersTableBody');
    var empty = document.getElementById('usersEmpty');
    var wrap = document.querySelector('#adminView-users .admin-table-wrap');

    updateStatCards();

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
      + '        <button type="button" class="ac-mode-tab is-active" data-mode="add" role="tab" aria-selected="true" style="flex:1;padding:9px 8px;border:none;background:var(--c-surface);border-radius:7px;font-size:13px;font-weight:600;cursor:pointer;color:var(--c-primary);box-shadow:0 1px 2px rgba(0,0,0,.06);">+ Sumar</button>'
      + '        <button type="button" class="ac-mode-tab" data-mode="sub" role="tab" aria-selected="false" style="flex:1;padding:9px 8px;border:none;background:transparent;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer;color:var(--c-muted);">âˆ’ Restar</button>'
      + '        <button type="button" class="ac-mode-tab" data-mode="clear" role="tab" aria-selected="false" style="flex:1;padding:9px 8px;border:none;background:transparent;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer;color:var(--c-muted);">Vaciar todo</button>'
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
        toastMsg = 'âˆ’' + Math.abs(amount) + ' créditos a ' + (currentUser.full_name || currentUser.email);
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

    // Plan activo (suscripción)
    var TIER_LABELS = { profesional: 'Profesional', profesional_plus: 'Profesional Plus', business: 'Business' };
    var subTier = u.subscription_tier;
    var subExp = u.subscription_expires_at;
    var subActive = subTier && subExp && (new Date(subExp).getTime() > Date.now());
    var hasPremiumAccess = subActive && (subTier === 'profesional_plus' || subTier === 'business');
    var subHtml = '';
    if (subActive) {
      var daysLeft = Math.max(0, Math.ceil((new Date(subExp).getTime() - Date.now()) / 86400000));
      var expFmt = new Date(subExp).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
      var premiumSvg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><polygon points="6 3 18 3 22 9 12 22 2 9"/><line x1="11" y1="3" x2="8" y2="9"/><line x1="13" y1="3" x2="16" y2="9"/><line x1="2" y1="9" x2="22" y2="9"/></svg>';
      var premiumBadgeHtml = hasPremiumAccess
        ? '<span style="display:inline-flex;align-items:center;margin-left:8px;padding:3px 10px;background:#141d1c;color:#8fc72e;border-radius:20px;font-size:11px;font-weight:700;">' + premiumSvg + 'Acceso Premium activo</span>'
        : '<span style="display:inline-flex;align-items:center;gap:4px;margin-left:8px;padding:3px 10px;background:#f5f5f5;color:#141d1c;border-radius:20px;font-size:11px;font-weight:600;">Sin acceso Premium</span>';
      subHtml =
        '<div class="user-detail-section">' +
          '<h4>Plan activo</h4>' +
          '<div class="sub-card">' +
            '<div class="sub-card-info">' +
              '<strong class="sub-tier">' + (TIER_LABELS[subTier] || subTier) + premiumBadgeHtml + '</strong>' +
              '<span class="sub-meta">Vence el ' + expFmt + ' · <strong>' + daysLeft + '</strong> día' + (daysLeft === 1 ? '' : 's') + ' restante' + (daysLeft === 1 ? '' : 's') + '</span>' +
            '</div>' +
            '<button class="btn btn-danger sub-cancel-btn" id="userDetailCancelSub" type="button">Cancelar plan</button>' +
          '</div>' +
        '</div>';
    } else {
      subHtml =
        '<div class="user-detail-section">' +
          '<h4>Plan activo</h4>' +
          '<p style="color:var(--c-muted);font-size:12.5px;margin:0">Sin plan activo.</p>' +
        '</div>';
    }

    // Botón "Activar Premium" si NO tiene acceso premium
    var activatePremiumHtml = '';
    if (!hasPremiumAccess) {
      var premiumPlans = (Consultia.Plans && Consultia.Plans.getActiveSubscriptionPlans)
        ? Consultia.Plans.getActiveSubscriptionPlans().filter(function (p) {
            return p.tier === 'profesional_plus' || p.tier === 'business';
          })
        : [];
      var premiumOptions = premiumPlans.map(function (p) {
        return '<option value="' + p.id + '">' + (TIER_LABELS[p.tier] || p.tier) + ' — ' + p.days + ' días — S/ ' + p.price + '</option>';
      }).join('');
      if (premiumOptions) {
        var premiumSvgMd = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#8fc72e;"><polygon points="6 3 18 3 22 9 12 22 2 9"/><line x1="11" y1="3" x2="8" y2="9"/><line x1="13" y1="3" x2="16" y2="9"/><line x1="2" y1="9" x2="22" y2="9"/></svg>';
        activatePremiumHtml =
          '<div class="user-detail-section" style="margin-top:8px;">' +
            '<div style="padding:14px;background:#141d1c;border-radius:10px;">' +
              '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">' +
                premiumSvgMd +
                '<strong style="font-size:14px;color:#8fc72e;">Activar Consultas Premium</strong>' +
              '</div>' +
              '<p style="font-size:12.5px;color:#94A3B8;margin:0 0 10px;">Otorga un plan Profesional Plus o Business para desbloquear las Consultas Premium a este usuario.</p>' +
              '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">' +
                '<select id="userDetailPremiumPlan" class="admin-select" style="flex:1;min-width:200px;">' +
                  '<option value="">— Selecciona plan —</option>' +
                  premiumOptions +
                '</select>' +
                '<button class="btn btn-primary" id="userDetailActivatePremium" type="button" style="white-space:nowrap;background:#8fc72e;color:#141d1c;border:none;">Activar Premium</button>' +
              '</div>' +
            '</div>' +
          '</div>';
      }
    }

    var html =
      '<div class="user-detail-grid">' +
        '<div class="user-detail-cell"><span class="label">Correo</span><span class="value">' + (u.email || '—') + '</span></div>' +
        '<div class="user-detail-cell"><span class="label">Teléfono</span><span class="value">' + (u.phone || '—') + '</span></div>' +
        '<div class="user-detail-cell"><span class="label">Estado</span><span class="value">' + (u.status === 'active' ? 'Activo' : 'Suspendido') + '</span></div>' +
        '<div class="user-detail-cell"><span class="label">Créditos actuales</span><span class="value">' + (u.credits_balance || 0) + '</span></div>' +
        '<div class="user-detail-cell"><span class="label">Registrado</span><span class="value">' + fmtDate(u.created_at) + '</span></div>' +
        '<div class="user-detail-cell"><span class="label">Ãšltimo acceso</span><span class="value">' + fmtRelative(u.last_sign_in_at) + '</span></div>' +
      '</div>' +
      subHtml +
      activatePremiumHtml +
      '<div class="user-detail-section">' +
        '<h4>Movimientos (' + transactions.length + ')</h4>' +
        txHtml +
      '</div>';

    document.getElementById('userDetailBody').innerHTML = html;

    // Wire del botón "Cancelar plan" (si existe)
    var cancelSubBtn = document.getElementById('userDetailCancelSub');
    if (cancelSubBtn) {
      cancelSubBtn.addEventListener('click', function () { cancelSubscription(userId); });
    }

    // Wire del botón "Activar Premium" (si existe)
    var activateBtn = document.getElementById('userDetailActivatePremium');
    if (activateBtn) {
      activateBtn.addEventListener('click', function () { handleActivatePremium(userId); });
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
  async function handleActivatePremium(userId) {
    var u = cachedUsers.find(function (x) { return x.id === userId; });
    if (!u) return;

    var sel = document.getElementById('userDetailPremiumPlan');
    var btn = document.getElementById('userDetailActivatePremium');
    if (!sel || !sel.value) {
      if (Consultia.toast) Consultia.toast({
        type: 'error',
        title: 'Selecciona un plan',
        message: 'Elige un plan Profesional Plus o Business para activar Premium.'
      });
      return;
    }

    var planId = sel.value;
    var plan = (Consultia.Plans && Consultia.Plans.getActiveSubscriptionPlans)
      ? Consultia.Plans.getActiveSubscriptionPlans().find(function (p) { return p.id === planId; })
      : null;
    if (!plan) {
      if (Consultia.toast) Consultia.toast({ type: 'error', title: 'Plan no encontrado', message: 'Recarga la página.' });
      return;
    }

    var sb = getSB();
    if (!sb) return;

    if (btn) { btn.disabled = true; btn.dataset.orig = btn.textContent; btn.textContent = 'Activando…'; }

    try {
      var res = await sb.rpc('admin_grant_subscription', {
        target_user_id: u.id,
        p_tier: plan.tier,
        p_days: plan.days,
        p_plan_id: plan.id,
        p_note: 'Activación Premium desde panel admin',
        p_amount_pen: plan.price ? parseFloat(plan.price) : null
      });
      if (res.error) throw res.error;

      var TIER_LABELS_LOCAL = { profesional: 'Profesional', profesional_plus: 'Profesional Plus', business: 'Business' };
      if (Consultia.toast) Consultia.toast({
        type: 'success',
        title: 'Premium activado',
        message: 'Plan ' + (TIER_LABELS_LOCAL[plan.tier] || plan.tier) + ' (' + plan.days + 'd) activado para ' + (u.full_name || u.email) + '. Ya puede acceder a Consultas Premium.'
      });

      if (typeof A.logAudit === 'function') {
        A.logAudit('subscription.activate_premium', u.email, 'Plan ' + plan.tier + ' ' + plan.days + 'd — desde detalle de usuario');
      }

      // Refrescar datos y re-abrir detalle
      cachedUsers = await loadUsers();
      paint();
      await openDetail(userId);
    } catch (err) {
      console.error('Error activando Premium:', err);
      if (Consultia.toast) Consultia.toast({
        type: 'error',
        title: 'No se pudo activar Premium',
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

  async function deleteUser() {
    var modal = document.getElementById('userDetailModal');
    if (!modal) return;
    var userId = modal.getAttribute('data-current-user');
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
    var btn = document.getElementById('userDetailDelete');
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
          ['ID', 'Nombre', 'Correo', 'Teléfono', 'Estado', 'Créditos', 'Registrado', 'Ãšltimo acceso'],
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
        else if (btn.dataset.action === 'addcredits' || btn.dataset.action === 'recargar') openCreditsModal(userId, 'add');
        else if (btn.dataset.action === 'subcredits') openCreditsModal(userId, 'sub');
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
    if (deleteUserBtn) deleteUserBtn.addEventListener('click', deleteUser);
  };
})();
