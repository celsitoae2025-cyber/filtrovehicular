/* ============================================================
   ADMIN PLANS — catálogo de planes (créditos + suscripciones)
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};
  window.Consultia.Admin = window.Consultia.Admin || {};
  var A = window.Consultia.Admin;

  var currentEditing = null; // { type: 'credit'|'sub', id }

  function renderCreditPlans() {
    var s = A.getStore();
    var byTier = { profesional: [], business: [] };
    (s.credit_plans || []).forEach(function (p) {
      if (byTier[p.tier]) byTier[p.tier].push(p);
    });

    var proBadge = '<span class="plan-pro-badge">PRO</span>';

    function cardHTML(p) {
      var total = p.credits + p.bonus;
      var isPro = p.tier === 'business';
      return '<div class="plan-card' + (p.active ? '' : ' is-inactive') + '" data-plan-id="' + p.id + '">' +
        '<div class="plan-main">' +
          '<div class="plan-num-box"><span class="num">' + total + '</span><span class="unit">cr</span></div>' +
          '<div class="plan-info">' +
            '<span class="plan-info-top"><strong>' + p.credits + ' + ' + p.bonus + '</strong> bonus' + (isPro ? ' ' + proBadge : '') + '</span>' +
            '<span class="plan-info-price"><span class="cur">S/</span>' + p.price + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="plan-controls">' +
          '<button type="button" class="plan-toggle' + (p.active ? ' on' : '') + '" data-plan-toggle="' + p.id + '" aria-label="Activar/desactivar"></button>' +
          '<button type="button" class="plan-edit" data-plan-edit-credit="' + p.id + '">Editar</button>' +
        '</div>' +
      '</div>';
    }

    document.getElementById('plansGridProfesional').innerHTML = byTier.profesional.map(cardHTML).join('');
    document.getElementById('plansGridBusiness').innerHTML = byTier.business.map(cardHTML).join('');
  }

  function renderSubscriptionPlans() {
    var s = A.getStore();
    var byTier = { profesional: [], profesional_plus: [], business: [] };
    (s.subscription_plans || []).forEach(function (p) {
      if (byTier[p.tier]) byTier[p.tier].push(p);
    });

    var proBadgeSub = '<span class="plan-pro-badge">PRO</span>';

    function cardHTML(p) {
      var isPro = p.tier === 'profesional_plus' || p.tier === 'business';
      return '<div class="plan-card' + (p.active ? '' : ' is-inactive') + '" data-plan-id="' + p.id + '">' +
        '<div class="plan-main">' +
          '<div class="plan-num-box"><span class="num">' + p.days + '</span><span class="unit">días</span></div>' +
          '<div class="plan-info">' +
            '<span class="plan-info-top"><strong>' + A.tierLabel(p.tier) + '</strong>' + (isPro ? ' ' + proBadgeSub : '') + '</span>' +
            '<span class="plan-info-price"><span class="cur">S/</span>' + p.price + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="plan-controls">' +
          '<button type="button" class="plan-toggle' + (p.active ? ' on' : '') + '" data-plan-toggle-sub="' + p.id + '" aria-label="Activar/desactivar"></button>' +
          '<button type="button" class="plan-edit" data-plan-edit-sub="' + p.id + '">Editar</button>' +
        '</div>' +
      '</div>';
    }

    document.getElementById('subsGridProfesional').innerHTML       = byTier.profesional.map(cardHTML).join('');
    document.getElementById('subsGridProfesionalPlus').innerHTML   = byTier.profesional_plus.map(cardHTML).join('');
    document.getElementById('subsGridBusiness').innerHTML          = byTier.business.map(cardHTML).join('');
  }

  function switchTab(tab) {
    document.querySelectorAll('.plans-tab').forEach(function (b) {
      b.classList.toggle('active', b.dataset.plansTab === tab);
    });
    document.getElementById('plansSection-credits').hidden = tab !== 'credits';
    document.getElementById('plansSection-subs').hidden    = tab !== 'subs';
  }

  function toggleCreditActive(id) {
    var s = A.getStore();
    var p = (s.credit_plans || []).find(function (x) { return x.id === id; });
    if (!p) return;
    p.active = !p.active;
    A.logAudit('plan.toggle', 'Créditos · ' + (p.credits + p.bonus), p.active ? 'Activado' : 'Desactivado');
    A.persist();
    renderCreditPlans();
    if (A.renderRecargas) A.renderRecargas();
    if (A.renderAddUsers) A.renderAddUsers();
    if (A.repopulateRecargaSelect) A.repopulateRecargaSelect();
    if (A.repopulateAddUserSelect) A.repopulateAddUserSelect();
  }

  function toggleSubActive(id) {
    var s = A.getStore();
    var p = (s.subscription_plans || []).find(function (x) { return x.id === id; });
    if (!p) return;
    p.active = !p.active;
    A.logAudit('plan.toggle', A.tierLabel(p.tier) + ' · ' + p.days + ' días', p.active ? 'Activado' : 'Desactivado');
    A.persist();
    renderSubscriptionPlans();
    if (A.repopulateRecargaSubSelect) A.repopulateRecargaSubSelect();
    if (A.repopulateAddUserSubSelect) A.repopulateAddUserSubSelect();
  }

  // --- Modal de edición ---
  function openEditCredit(id) {
    var p = A.findCreditPlan(id);
    if (!p) return;
    currentEditing = { type: 'credit', id: id };
    document.getElementById('planEditTitle').textContent = 'Editar plan de créditos';
    document.getElementById('planEditBody').innerHTML =
      '<div class="form-field"><label for="pfCredits">Créditos base</label><input type="number" id="pfCredits" class="input" min="0" value="' + p.credits + '" required></div>' +
      '<div class="form-field"><label for="pfBonus">Bonus</label><input type="number" id="pfBonus" class="input" min="0" value="' + p.bonus + '" required></div>' +
      '<div class="form-field"><label for="pfPrice">Precio (S/)</label><input type="number" id="pfPrice" class="input" min="0" step="0.01" value="' + p.price + '" required></div>';
    document.getElementById('planEditModal').hidden = false;
  }

  function openEditSub(id) {
    var p = A.findSubscriptionPlan(id);
    if (!p) return;
    currentEditing = { type: 'sub', id: id };
    document.getElementById('planEditTitle').textContent = 'Editar plan por días';
    document.getElementById('planEditBody').innerHTML =
      '<div class="form-field"><label for="pfDays">Días</label><input type="number" id="pfDays" class="input" min="1" value="' + p.days + '" required></div>' +
      '<div class="form-field"><label for="pfPrice">Precio (S/)</label><input type="number" id="pfPrice" class="input" min="0" step="0.01" value="' + p.price + '" required></div>';
    document.getElementById('planEditModal').hidden = false;
  }

  function closeEditModal() {
    document.getElementById('planEditModal').hidden = true;
    currentEditing = null;
  }

  function saveEdit(e) {
    e.preventDefault();
    if (!currentEditing) return;
    var s = A.getStore();

    if (currentEditing.type === 'credit') {
      var p = (s.credit_plans || []).find(function (x) { return x.id === currentEditing.id; });
      if (!p) return closeEditModal();
      p.credits = parseInt(document.getElementById('pfCredits').value, 10) || 0;
      p.bonus = parseInt(document.getElementById('pfBonus').value, 10) || 0;
      p.price = parseFloat(document.getElementById('pfPrice').value) || 0;
      A.logAudit('plan.update', 'Créditos · ' + (p.credits + p.bonus), 'S/ ' + p.price);
    } else if (currentEditing.type === 'sub') {
      var sp = (s.subscription_plans || []).find(function (x) { return x.id === currentEditing.id; });
      if (!sp) return closeEditModal();
      sp.days = parseInt(document.getElementById('pfDays').value, 10) || 0;
      sp.price = parseFloat(document.getElementById('pfPrice').value) || 0;
      A.logAudit('plan.update', A.tierLabel(sp.tier) + ' · ' + sp.days + ' días', 'S/ ' + sp.price);
    }

    var wasCredit = currentEditing && currentEditing.type === 'credit';
    A.persist();
    closeEditModal();
    if (wasCredit) {
      renderCreditPlans();
      if (A.repopulateRecargaSelect) A.repopulateRecargaSelect();
      if (A.repopulateAddUserSelect) A.repopulateAddUserSelect();
    } else {
      renderSubscriptionPlans();
      if (A.repopulateRecargaSubSelect) A.repopulateRecargaSubSelect();
      if (A.repopulateAddUserSubSelect) A.repopulateAddUserSubSelect();
    }
    if (window.Consultia.toast) Consultia.toast({
      type: 'success',
      title: 'Plan actualizado',
      message: 'Cambios guardados.'
    });
  }

  A.renderPlans = function () {
    renderCreditPlans();
    renderSubscriptionPlans();
  };

  A.initPlans = function () {
    document.querySelectorAll('.plans-tab').forEach(function (btn) {
      btn.addEventListener('click', function () { switchTab(btn.dataset.plansTab); });
    });

    document.getElementById('plansSection-credits').addEventListener('click', function (e) {
      var tg = e.target.closest('[data-plan-toggle]');
      if (tg) { toggleCreditActive(tg.dataset.planToggle); return; }
      var ed = e.target.closest('[data-plan-edit-credit]');
      if (ed) { openEditCredit(ed.dataset.planEditCredit); return; }
    });

    document.getElementById('plansSection-subs').addEventListener('click', function (e) {
      var tg = e.target.closest('[data-plan-toggle-sub]');
      if (tg) { toggleSubActive(tg.dataset.planToggleSub); return; }
      var ed = e.target.closest('[data-plan-edit-sub]');
      if (ed) { openEditSub(ed.dataset.planEditSub); return; }
    });

    document.querySelectorAll('#planEditModal [data-close]').forEach(function (el) {
      el.addEventListener('click', closeEditModal);
    });
    document.getElementById('planEditForm').addEventListener('submit', saveEdit);
  };
})();
