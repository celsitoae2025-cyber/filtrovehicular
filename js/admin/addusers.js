/* ============================================================
   ADMIN ADD USERS — agregar usuarios registrados por correo
   Valida el email contra Supabase (admin_list_users RPC) y
   mantiene una lista local de "usuarios gestionados" por el admin.
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};
  window.Consultia.Admin = window.Consultia.Admin || {};
  var A = window.Consultia.Admin;

  var realUsers = [];
  var currentTarget = null;

  function getSB() {
    return (window.Consultia && window.Consultia.supabase) || null;
  }

  async function loadRealUsers() {
    var sb = getSB();
    if (!sb) return [];
    var res = await sb.rpc('admin_list_users');
    if (res.error) { console.error('admin_list_users error:', res.error); return []; }
    return res.data || [];
  }

  function findRealUserByEmail(email) {
    if (!email) return null;
    var needle = email.trim().toLowerCase();
    for (var i = 0; i < realUsers.length; i++) {
      if ((realUsers[i].email || '').toLowerCase() === needle) return realUsers[i];
    }
    return null;
  }

  function updatePreview() {
    var email = document.getElementById('addUserEmail').value.trim();
    var preview = document.getElementById('addUserPreview');
    var hint = document.getElementById('addUserEmailHint');
    currentTarget = null;

    if (!email) {
      preview.hidden = true;
      hint.textContent = 'Escribe el correo de un usuario registrado';
      hint.classList.remove('is-error', 'is-ok');
      return;
    }

    var u = findRealUserByEmail(email);
    if (!u) {
      preview.hidden = true;
      hint.textContent = 'Este correo no está registrado en la plataforma';
      hint.classList.remove('is-ok');
      hint.classList.add('is-error');
      return;
    }

    currentTarget = u;
    var name = u.full_name || u.email;

    // Verificar si ya fue agregado
    var s = A.getStore();
    var already = s.added_users.some(function (a) { return a.user_id === u.id; });
    if (already) {
      preview.hidden = false;
      document.getElementById('addUserAvatar').textContent = A.userInitials(name);
      document.getElementById('addUserName').textContent = name;
      document.getElementById('addUserInfo').textContent = u.email;
      hint.textContent = 'Este usuario ya fue agregado anteriormente';
      hint.classList.remove('is-ok');
      hint.classList.add('is-error');
      return;
    }

    preview.hidden = false;
    document.getElementById('addUserAvatar').textContent = A.userInitials(name);
    document.getElementById('addUserName').textContent = name;
    document.getElementById('addUserInfo').textContent = u.email + (u.phone ? ' · ' + u.phone : '');
    hint.textContent = 'Usuario encontrado — listo para agregar';
    hint.classList.remove('is-error');
    hint.classList.add('is-ok');
  }

  function renderList() {
    var s = A.getStore();
    var items = s.added_users.slice().sort(function (a, b) { return b.added_at.localeCompare(a.added_at); });

    document.getElementById('addedUsersCount').textContent = items.length + (items.length === 1 ? ' registro' : ' registros');

    var list = document.getElementById('addedUsersList');
    var empty = document.getElementById('addedUsersEmpty');

    if (!items.length) {
      list.innerHTML = '';
      list.hidden = true;
      if (empty) empty.hidden = false;
      return;
    }
    list.hidden = false;
    if (empty) empty.hidden = true;

    function esc(v) {
      return String(v == null ? '' : v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    list.innerHTML = items.map(function (it) {
      var name = it.user_name;
      var email = it.user_email;
      if (!name || !email) {
        var u = A.findUser(it.user_id);
        if (u) { name = u.name; email = u.email; }
      }
      var userBlock = (name || email)
        ? '<div class="entry-user">' +
            '<span class="avatar">' + esc(A.userInitials(name || email)) + '</span>' +
            '<div class="entry-user-info"><strong>' + esc(name || email) + '</strong><span>' + esc(email || '') + '</span></div>' +
          '</div>'
        : '<div class="entry-user"><span class="avatar">?</span><div class="entry-user-info"><strong>Usuario eliminado</strong></div></div>';

      var creditsBlock = it.credits_granted
        ? '<span class="entry-credits">+' + it.credits_granted + ' cr</span>'
        : '';

      var noteBlock = it.note
        ? '<span class="entry-note" title="' + esc(it.note) + '">' + esc(it.note) + '</span>'
        : '';

      return '<li class="entry-row">' +
          '<span class="entry-date">' + esc(A.fmtDate(it.added_at)) + '</span>' +
          userBlock +
          creditsBlock +
          noteBlock +
          '<div class="entry-action"><button class="table-btn" data-remove-id="' + it.id + '">Quitar</button></div>' +
        '</li>';
    }).join('');
  }

  function repopulateSelect() {
    var select = document.getElementById('addUserCreditsPreset');
    if (!select) return;
    var plans = A.getActiveCreditPlans();
    var byTier = { profesional: [], business: [] };
    plans.forEach(function (p) { if (byTier[p.tier]) byTier[p.tier].push(p); });

    var premiumTiers = { profesional_plus: true, business: true };
    var html = '<option value="0">Sin créditos</option>';
    ['profesional', 'business'].forEach(function (tierKey) {
      if (!byTier[tierKey].length) return;
      var label = A.tierLabel(tierKey) + (premiumTiers[tierKey] ? ' (Premium)' : '');
      html += '<optgroup label="' + label + '">';
      byTier[tierKey].forEach(function (p) {
        var total = p.credits + p.bonus;
        var premiumTag = premiumTiers[tierKey] ? ' (Premium)' : '';
        html += '<option value="' + p.id + '">' + p.credits + ' + ' + p.bonus + ' (' + total + ' cr) — S/ ' + p.price + premiumTag + '</option>';
      });
      html += '</optgroup>';
    });
    html += '<option value="custom">Monto personalizado</option>';
    select.innerHTML = html;

    repopulateSubSelect();
  }
  A.repopulateAddUserSelect = repopulateSelect;

  function repopulateSubSelect() {
    var select = document.getElementById('addUserSubPlan');
    if (!select) return;
    var plans = A.getActiveSubscriptionPlans();
    var byTier = { profesional: [], profesional_plus: [], business: [] };
    plans.forEach(function (p) { if (byTier[p.tier]) byTier[p.tier].push(p); });

    var premiumTiers = { profesional_plus: true, business: true };
    var html = '<option value="">No otorgar suscripción</option>';
    ['profesional', 'profesional_plus', 'business'].forEach(function (tierKey) {
      if (!byTier[tierKey].length) return;
      var label = A.tierLabel(tierKey) + (premiumTiers[tierKey] ? ' (Premium)' : '');
      html += '<optgroup label="' + label + '">';
      byTier[tierKey].forEach(function (p) {
        var premiumTag = premiumTiers[tierKey] ? ' (Premium)' : '';
        html += '<option value="' + p.id + '">' + p.days + ' días — S/ ' + p.price + premiumTag + '</option>';
      });
      html += '</optgroup>';
    });
    select.innerHTML = html;
  }
  A.repopulateAddUserSubSelect = repopulateSubSelect;

  function getCreditsValue() {
    var val = document.getElementById('addUserCreditsPreset').value;
    if (val === '0' || !val) return 0;
    if (val === 'custom') return parseInt(document.getElementById('addUserCredits').value, 10) || 0;
    var plan = A.findCreditPlan(val);
    if (plan) return plan.credits + plan.bonus;
    return parseInt(val, 10) || 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    var submitBtn = document.querySelector('#addUserForm button[type="submit"]');
    var email = document.getElementById('addUserEmail').value.trim();
    var u = currentTarget || findRealUserByEmail(email);
    if (!u) {
      if (window.Consultia.toast) Consultia.toast({
        type: 'error',
        title: 'No está registrado',
        message: 'El correo no pertenece a ningún usuario de la plataforma.'
      });
      return;
    }

    var s = A.getStore();
    if (s.added_users.some(function (a) { return a.user_id === u.id; })) {
      if (window.Consultia.toast) Consultia.toast({
        type: 'warning',
        title: 'Ya estaba agregado',
        message: (u.full_name || u.email) + ' ya está en la lista.'
      });
      return;
    }

    var note = document.getElementById('addUserNote').value.trim();
    var credits = getCreditsValue();
    var name = u.full_name || u.email;

    if (submitBtn) { submitBtn.disabled = true; submitBtn.dataset.orig = submitBtn.dataset.orig || submitBtn.textContent; submitBtn.textContent = 'Guardando…'; }

    try {
      // Si hay créditos para otorgar, los aplicamos vía RPC real
      if (credits > 0) {
        var sb = getSB();
        if (!sb) throw new Error('Supabase no disponible');
        var res = await sb.rpc('admin_adjust_credits', {
          target_user_id: u.id,
          delta: credits,
          note: note ? ('Agregar usuario — ' + note) : 'Agregar usuario',
          method: 'manual',
          ref: null
        });
        if (res.error) throw res.error;

        // Notificar al cliente
        try {
          await sb.rpc('admin_create_notification', {
            target_user_id: u.id,
            n_title: '¡Recibiste ' + credits + ' créditos!',
            n_body: note
              ? 'Se acreditaron ' + credits + ' créditos a tu cuenta. ' + note
              : 'Se acreditaron ' + credits + ' créditos a tu cuenta.',
            n_type: 'credits',
            n_meta: { credits: credits, method: 'manual' }
          });
        } catch (nerr) {
          console.warn('No se pudo crear la notificación:', nerr);
        }

        s.recargas.push({
          id: 'r' + Date.now(),
          user_id: u.id,
          user_email: u.email,
          user_name: name,
          credits: credits,
          motivo: note ? ('Agregar usuario — ' + note) : 'Agregar usuario',
          created_at: new Date().toISOString()
        });
      }

      s.added_users.push({
        id: 'au' + Date.now(),
        user_id: u.id,
        user_email: u.email,
        user_name: name,
        note: note,
        credits_granted: credits,
        added_at: new Date().toISOString()
      });

      var auditExtras = [];
      if (credits > 0) auditExtras.push('+' + credits + ' cr');
      A.logAudit('user.add', u.email, (auditExtras.length ? auditExtras.join(' · ') + ' · ' : '') + (note || 'Agregado a lista gestionada'));
      A.persist();

      // Refrescar cache local
      realUsers = await loadRealUsers();
      currentTarget = null;

      document.getElementById('addUserForm').reset();
      document.getElementById('addUserCreditsCustomField').hidden = true;
      document.getElementById('addUserPreview').hidden = true;
      var hint = document.getElementById('addUserEmailHint');
      hint.textContent = 'Escribe el correo de un usuario registrado';
      hint.classList.remove('is-ok', 'is-error');

      renderList();
      if (A.renderUsers) A.renderUsers();
      if (A.renderRecargas) A.renderRecargas();

      var toastMsg = name + (credits > 0 ? ' · +' + credits + ' cr' : '') + '.';
      if (window.Consultia.toast) Consultia.toast({
        type: 'success',
        title: 'Usuario agregado',
        message: toastMsg
      });
    } catch (err) {
      console.error('Error agregando usuario:', err);
      if (window.Consultia.toast) Consultia.toast({
        type: 'error',
        title: 'Error al agregar',
        message: 'Intenta de nuevo.'
      });
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = submitBtn.dataset.orig || 'Agregar'; }
    }
  }

  function handleRemove(id) {
    var s = A.getStore();
    var idx = s.added_users.findIndex(function (a) { return a.id === id; });
    if (idx === -1) return;
    var removed = s.added_users[idx];
    var name = removed.user_name || (A.findUser(removed.user_id) || {}).name || removed.user_email;
    s.added_users.splice(idx, 1);
    A.logAudit('user.remove', removed.user_email || removed.user_id, 'Removido de lista gestionada');
    A.persist();
    renderList();
    if (window.Consultia.toast) Consultia.toast({
      type: 'success',
      title: 'Usuario removido',
      message: name || 'Entrada eliminada.'
    });
  }

  A.renderAddUsers = async function () {
    repopulateSelect();
    renderList();
    realUsers = await loadRealUsers();
  };

  function resetForm() {
    document.getElementById('addUserCreditsCustomField').hidden = true;
    document.getElementById('addUserPreview').hidden = true;
    var hint = document.getElementById('addUserEmailHint');
    hint.textContent = 'Escribe el correo de un usuario registrado';
    hint.classList.remove('is-ok', 'is-error');
  }

  A.initAddUsers = async function () {
    repopulateSelect();
    document.getElementById('addUserEmail').addEventListener('input', updatePreview);
    document.getElementById('addUserForm').addEventListener('submit', handleSubmit);
    document.getElementById('addUserForm').addEventListener('reset', function () {
      setTimeout(function () { resetForm(); repopulateSelect(); }, 0);
    });
    document.getElementById('addUserCreditsPreset').addEventListener('change', function (e) {
      document.getElementById('addUserCreditsCustomField').hidden = e.target.value !== 'custom';
    });
    document.getElementById('addedUsersList').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-remove-id]');
      if (!btn) return;
      handleRemove(btn.dataset.removeId);
    });
    realUsers = await loadRealUsers();
  };
})();
