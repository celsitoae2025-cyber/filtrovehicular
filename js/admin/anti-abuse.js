/* ============================================================
   ADMIN — ANTI-ABUSO
   Muestra estadísticas y lista de cuentas bloqueadas/sospechosas.
   - KPIs: total bloqueados, descartables, dup. email, dup. device
   - Tabla 1: cuentas con signup_block_reason (últimas 100)
   - Tabla 2: dispositivos compartidos por varias cuentas
   RLS: profiles ya restringe lectura a admins (is_admin=true).
============================================================ */
(function () {
  window.Consultia = window.Consultia || {};
  window.Consultia.Admin = window.Consultia.Admin || {};
  var A = window.Consultia.Admin;

  function getSB() {
    return (window.Consultia && window.Consultia.supabase) || null;
  }

  var REASON_LABEL = {
    disposable_email: 'Correo descartable',
    duplicate_email:  'Email duplicado',
    duplicate_device: 'Dispositivo repetido'
  };

  var escapeHtml = Consultia.Utils.escapeHtml;

  function formatDate(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      return d.toLocaleString('es-PE', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch (e) { return iso; }
  }

  // Acorta el fingerprint para mostrar solo los primeros 12 chars
  function shortHash(h) {
    if (!h) return '—';
    return h.length > 16 ? h.slice(0, 12) + '…' : h;
  }

  // ----------------------------------------------------------
  // Carga: cuentas con signup_block_reason
  // ----------------------------------------------------------
  async function loadBlockedAccounts() {
    var sb = getSB();
    if (!sb) return [];
    // Traemos profiles con motivo + email desde auth.users (vía RPC o join).
    // Como auth.users no es accesible directo desde anon/authenticated,
    // usamos admin_list_users (ya existente) para mapear ids â†’ email.
    var profRes = await sb
      .from('profiles')
      .select('id, full_name, email_normalized, signup_block_reason, credits_balance, created_at, device_fingerprint')
      .not('signup_block_reason', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100);
    if (profRes.error) {
      console.error('[anti-abuse] loadBlockedAccounts:', profRes.error);
      return [];
    }
    var rows = profRes.data || [];

    // Resolver email real desde admin_list_users
    var usersRes = await sb.rpc('admin_list_users');
    var usersMap = {};
    if (!usersRes.error && Array.isArray(usersRes.data)) {
      usersRes.data.forEach(function (u) { usersMap[u.id] = u; });
    }
    rows.forEach(function (r) {
      var u = usersMap[r.id];
      r.email = u ? u.email : (r.email_normalized || '—');
    });
    return rows;
  }

  // ----------------------------------------------------------
  // Carga: dispositivos compartidos (admin_v_duplicate_devices)
  // ----------------------------------------------------------
  async function loadDuplicateDevices() {
    var sb = getSB();
    if (!sb) return [];
    var res = await sb.from('admin_v_duplicate_devices').select('*').limit(100);
    if (res.error) {
      console.error('[anti-abuse] loadDuplicateDevices:', res.error);
      return [];
    }
    return res.data || [];
  }

  // ----------------------------------------------------------
  // Render: KPIs
  // ----------------------------------------------------------
  function renderKpis(list) {
    var disposable = 0, dupEmail = 0, dupDevice = 0;
    list.forEach(function (r) {
      if (r.signup_block_reason === 'disposable_email') disposable++;
      else if (r.signup_block_reason === 'duplicate_email') dupEmail++;
      else if (r.signup_block_reason === 'duplicate_device') dupDevice++;
    });
    var total = disposable + dupEmail + dupDevice;
    document.getElementById('kpiAbuseTotal').textContent      = total;
    document.getElementById('kpiAbuseDisposable').textContent = disposable;
    document.getElementById('kpiAbuseDupEmail').textContent   = dupEmail;
    document.getElementById('kpiAbuseDupDevice').textContent  = dupDevice;
  }

  // ----------------------------------------------------------
  // Render: tabla de cuentas marcadas
  // ----------------------------------------------------------
  function renderBlockedTable(list) {
    var tbody = document.getElementById('abuseListBody');
    var counter = document.getElementById('abuseListCount');
    if (!tbody) return;
    counter.textContent = list.length + (list.length === 1 ? ' cuenta' : ' cuentas');

    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="admin-empty">Sin cuentas sospechosas. âœ…</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(function (r) {
      var reason = REASON_LABEL[r.signup_block_reason] || r.signup_block_reason || '—';
      var creditsClass = (r.credits_balance === 0) ? 'style="color:#141d1c;font-weight:600"' : '';
      return (
        '<tr>' +
          '<td>' + escapeHtml(r.email) + (r.full_name ? '<br><small style="color:#5A6B6A">' + escapeHtml(r.full_name) + '</small>' : '') + '</td>' +
          '<td><code style="font-size:.85em">' + escapeHtml(r.email_normalized || '—') + '</code></td>' +
          '<td><span class="admin-badge">' + escapeHtml(reason) + '</span></td>' +
          '<td ' + creditsClass + '>' + (r.credits_balance != null ? r.credits_balance : '—') + '</td>' +
          '<td>' + formatDate(r.created_at) + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  // ----------------------------------------------------------
  // Render: tabla de dispositivos compartidos
  // ----------------------------------------------------------
  function renderDevicesTable(list) {
    var tbody = document.getElementById('abuseDevicesBody');
    var counter = document.getElementById('abuseDevicesCount');
    if (!tbody) return;
    counter.textContent = list.length + (list.length === 1 ? ' dispositivo' : ' dispositivos');

    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="admin-empty">Ningún dispositivo compartido. âœ…</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(function (r) {
      var emails = Array.isArray(r.emails) ? r.emails : [];
      var emailsHtml = emails.map(function (e) {
        return '<div style="font-size:.85em">' + escapeHtml(e || '—') + '</div>';
      }).join('');
      return (
        '<tr>' +
          '<td><strong style="color:#141d1c">' + r.account_count + '</strong></td>' +
          '<td>' + emailsHtml + '</td>' +
          '<td>' + formatDate(r.first_signup) + '</td>' +
          '<td>' + formatDate(r.last_signup) + '</td>' +
          '<td><code style="font-size:.8em">' + escapeHtml(shortHash(r.device_fingerprint)) + '</code></td>' +
        '</tr>'
      );
    }).join('');
  }

  // ----------------------------------------------------------
  // Render principal (entry-point cuando se abre la vista)
  // ----------------------------------------------------------
  async function renderAntiAbuse() {
    // Estado de carga
    var tb1 = document.getElementById('abuseListBody');
    var tb2 = document.getElementById('abuseDevicesBody');
    if (tb1) tb1.innerHTML = '<tr><td colspan="5" class="admin-empty">Cargando…</td></tr>';
    if (tb2) tb2.innerHTML = '<tr><td colspan="5" class="admin-empty">Cargando…</td></tr>';

    var blocked = await loadBlockedAccounts();
    renderKpis(blocked);
    renderBlockedTable(blocked);

    var devices = await loadDuplicateDevices();
    renderDevicesTable(devices);
  }

  // No requiere init: todo se hace en render cuando se abre la vista.
  function initAntiAbuse() { /* noop */ }

  A.initAntiAbuse   = initAntiAbuse;
  A.renderAntiAbuse = renderAntiAbuse;
})();
