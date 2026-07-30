/* ============================================================
   ADMIN TEAM — admins reales desde Supabase (profiles.is_admin)
   - Listado vía RPC admin_list_admins
   - Invitar / Revocar vía RPC admin_set_admin_flag (por correo)
   - Realtime: se actualiza al instante si otro admin cambia el flag
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};
  window.Consultia.Admin = window.Consultia.Admin || {};
  var A = window.Consultia.Admin;

  function getSB() { return (window.Consultia && window.Consultia.supabase) || null; }

  var cachedAdmins = [];
  var realtimeChannel = null;
  var refreshTimer = null;

  var escapeHtml = Consultia.Utils.escapeHtml;

  function roleTag() {
    // Por ahora solo distinguimos "Admin" — la matriz de roles compleja
    // está hardcoded en la matriz de permisos.
    return '<span class="role-tag" style="background:#141d1c"><span class="dot"></span>Admin</span>';
  }

  async function loadAdmins() {
    var sb = getSB();
    if (!sb) return [];
    var res = await sb.rpc('admin_list_admins');
    if (res.error) {
      console.error('admin_list_admins error:', res.error);
      return [];
    }
    return res.data || [];
  }

  function renderTable() {
    var search = ((document.getElementById('teamSearch') || {}).value || '').toLowerCase().trim();

    var rows = cachedAdmins.filter(function (a) {
      if (search) {
        var hay = ((a.full_name || '') + ' ' + (a.email || '')).toLowerCase();
        if (hay.indexOf(search) === -1) return false;
      }
      return true;
    });

    var body = document.getElementById('teamTableBody');
    var empty = document.getElementById('teamEmpty');
    var wrap = document.querySelector('#adminView-team .admin-table-wrap:first-of-type');
    if (!body) return;

    if (!rows.length) {
      body.innerHTML = '';
      if (empty) empty.hidden = false;
      if (wrap) wrap.style.display = 'none';
      return;
    }
    if (empty) empty.hidden = true;
    if (wrap) wrap.style.display = '';

    body.innerHTML = rows.map(function (a) {
      var name = a.full_name || a.email || '—';
      var status = a.status === 'active'
        ? '<span class="chip chip-ok">Activo</span>'
        : '<span class="chip chip-off">' + escapeHtml(a.status || 'Inactivo') + '</span>';
      var lastLogin = a.last_sign_in_at ? A.relativeTime(a.last_sign_in_at) : '—';
      return '<tr>' +
        '<td><div class="cell-user"><span class="avatar">' + escapeHtml(A.userInitials(name)) + '</span><div class="user-info"><strong>' + escapeHtml(name) + '</strong><span>' + escapeHtml(a.email || '') + '</span></div></div></td>' +
        '<td>' + roleTag() + '</td>' +
        '<td><span class="chip">—</span></td>' +
        '<td>' + lastLogin + '</td>' +
        '<td>' + status + '</td>' +
        '<td><div class="cell-actions">' +
          '<button class="table-btn" data-team-action="revoke" data-email="' + escapeHtml(a.email || '') + '">Revocar</button>' +
        '</div></td>' +
      '</tr>';
    }).join('');
  }

  function renderPermsMatrix() {
    var s = A.getStore();
    var body = document.getElementById('permsTableBody');
    if (!body) return;
    var perms = s.permissions || A.PERMISSIONS;
    var roles = ['super_admin', 'admin', 'soporte', 'developer', 'auditor'];

    function chip(level) {
      if (level === 'full') return '<span class="perm-chip perm-full">Total</span>';
      if (level === 'read') return '<span class="perm-chip perm-read">Lectura</span>';
      return '<span class="perm-chip perm-none">—</span>';
    }

    body.innerHTML = perms.map(function (p) {
      return '<tr>' +
        '<td>' + p.label + '</td>' +
        roles.map(function (r) { return '<td>' + chip(p.by_role[r] || 'none') + '</td>'; }).join('') +
      '</tr>';
    }).join('');
  }

  // ---------- Modal Invitar ----------
  function openInviteModal() {
    var form = document.getElementById('inviteAdminForm');
    if (form) form.reset();
    var modal = document.getElementById('inviteAdminModal');
    if (modal) modal.hidden = false;
  }
  function closeInviteModal() {
    var modal = document.getElementById('inviteAdminModal');
    if (modal) modal.hidden = true;
  }

  async function handleInvite(e) {
    e.preventDefault();
    var sb = getSB();
    if (!sb) return;
    var email = (document.getElementById('inviteEmail').value || '').trim().toLowerCase();
    if (!email) return;

    try {
      var res = await sb.rpc('admin_set_admin_flag', { target_email: email, make_admin: true });
      if (res.error) throw res.error;
      A.logAudit('admin.invite', email, 'Otorgado rol admin');
      closeInviteModal();
      cachedAdmins = await loadAdmins();
      renderTable();
      if (window.Consultia.toast) Consultia.toast({
        type: 'success',
        title: 'Acceso otorgado',
        message: email + ' ahora es administrador.'
      });
    } catch (err) {
      if (window.Consultia.toast) Consultia.toast({
        type: 'error',
        title: 'No se pudo otorgar acceso',
        message: (err && err.message) || 'El usuario debe estar registrado.'
      });
    }
  }

  async function revokeByEmail(email) {
    var sb = getSB();
    if (!sb) return;
    try {
      var res = await sb.rpc('admin_set_admin_flag', { target_email: email, make_admin: false });
      if (res.error) throw res.error;
      A.logAudit('admin.revoke', email, 'Revocado rol admin');
      cachedAdmins = await loadAdmins();
      renderTable();
      if (window.Consultia.toast) Consultia.toast({
        type: 'success',
        title: 'Acceso revocado',
        message: email + ' ya no es administrador.'
      });
    } catch (err) {
      if (window.Consultia.toast) Consultia.toast({
        type: 'error',
        title: 'No se pudo revocar',
        message: (err && err.message) || 'Intenta de nuevo.'
      });
    }
  }

  function scheduleReload() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async function () {
      cachedAdmins = await loadAdmins();
      renderTable();
    }, 600);
  }

  function startRealtime() {
    var sb = getSB();
    if (!sb || realtimeChannel) return;
    try {
      realtimeChannel = sb.channel('admin-team-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, scheduleReload)
        .subscribe();
    } catch (e) { console.warn('Team realtime no disponible:', e); }
  }

  A.renderTeam = async function () {
    cachedAdmins = await loadAdmins();
    renderTable();
    renderPermsMatrix();
    startRealtime();
  };

  A.initTeam = function () {
    var s = document.getElementById('teamSearch');
    var rf = document.getElementById('teamRoleFilter');
    var inv = document.getElementById('teamInviteBtn');
    if (s) s.addEventListener('input', renderTable);
    if (rf) rf.addEventListener('change', renderTable);
    if (inv) inv.addEventListener('click', openInviteModal);

    var body = document.getElementById('teamTableBody');
    if (body) body.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-team-action]');
      if (!btn) return;
      if (btn.dataset.teamAction === 'revoke') {
        var email = btn.dataset.email;
        if (!email) return;
        if (window.Consultia.confirmDialog) {
          Consultia.confirmDialog({
            title: 'Revocar acceso de administrador',
            message: '¿Seguro que quieres quitar acceso a ' + email + '?',
            confirmLabel: 'Revocar',
            confirmStyle: 'danger',
            onConfirm: function () { revokeByEmail(email); }
          });
        } else if (confirm('¿Revocar acceso a ' + email + '?')) {
          revokeByEmail(email);
        }
      }
    });

    document.querySelectorAll('#inviteAdminModal [data-close]').forEach(function (el) {
      el.addEventListener('click', closeInviteModal);
    });
    var inviteForm = document.getElementById('inviteAdminForm');
    if (inviteForm) inviteForm.addEventListener('submit', handleInvite);
  };
})();
