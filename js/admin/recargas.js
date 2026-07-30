/* ============================================================
   ADMIN RECARGAS — abonar créditos a un usuario por correo
   Los usuarios se buscan desde Supabase (admin_list_users RPC).
   Los créditos se aplican vía admin_adjust_credits RPC (transacción real).
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};
  window.Consultia.Admin = window.Consultia.Admin || {};
  var A = window.Consultia.Admin;

  // Cache local de usuarios reales (se refresca al entrar a la vista
  // y después de cada recarga exitosa).
  var realUsers = [];
  var currentTarget = null;

  function getSB() {
    return (window.Consultia && window.Consultia.supabase) || null;
  }

  async function loadRealUsers() {
    var sb = getSB();
    if (!sb) return [];
    var res = await sb.rpc('admin_list_users');
    if (res.error) {
      console.error('admin_list_users error:', res.error);
      return [];
    }
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

  // Cache de las últimas recargas reales leídas de `transactions`.
  var cachedRecargas = [];
  var recargasRealtimeChannel = null;
  var recargasRefreshTimer = null;

  async function loadRealRecargas() {
    var sb = getSB();
    if (!sb) return [];
    // Recargas de admin = transactions con type='admin_adjust' y amount > 0
    var res = await sb.from('transactions')
      .select('id, user_id, type, amount, description, payment_method, reference, created_at')
      .eq('type', 'admin_adjust')
      .gt('amount', 0)
      .order('created_at', { ascending: false })
      .limit(300);
    if (res.error) {
      console.error('recargas load error:', res.error);
      return [];
    }
    var rows = res.data || [];

    // Resolver nombres y correos
    var ids = {};
    rows.forEach(function (r) { if (r.user_id) ids[r.user_id] = 1; });
    var nameById = {}, emailById = {};
    var userIds = Object.keys(ids);
    if (userIds.length) {
      var prof = await sb.from('profiles').select('id, full_name').in('id', userIds);
      if (prof.data) prof.data.forEach(function (p) { nameById[p.id] = p.full_name || ''; });
      try {
        var ulist = await sb.rpc('admin_list_users');
        if (ulist.data) ulist.data.forEach(function (u) { emailById[u.id] = u.email || ''; });
      } catch (_) {}
    }
    rows.forEach(function (r) {
      r._user_name = nameById[r.user_id] || 'Usuario eliminado';
      r._user_email = emailById[r.user_id] || '';
    });
    return rows;
  }

  function escapeRecargaHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function renderHistory() {
    var list = document.getElementById('recargasList');
    var empty = document.getElementById('recargasEmpty');
    var count = document.getElementById('recargasCount');
    if (!list) return;

    var items = cachedRecargas;
    if (count) count.textContent = items.length + (items.length === 1 ? ' registro' : ' registros');

    if (!items.length) {
      list.innerHTML = '';
      list.hidden = true;
      if (empty) empty.hidden = false;
      return;
    }
    list.hidden = false;
    if (empty) empty.hidden = true;

    list.innerHTML = items.map(function (r) {
      var name = r._user_name;
      var email = r._user_email;
      var userBlock = '<div class="entry-user">' +
            '<span class="avatar">' + escapeRecargaHtml(A.userInitials(name)) + '</span>' +
            '<div class="entry-user-info"><strong>' + escapeRecargaHtml(name) + '</strong><span>' + escapeRecargaHtml(email) + '</span></div>' +
          '</div>';

      // El "motivo" original lo guarda admin_adjust_credits dentro de description.
      var motivo = (r.description || '').replace(/^[^/]*\/\s*/, '').trim();
      var motivoBlock = motivo
        ? '<span class="entry-note" title="' + escapeRecargaHtml(motivo) + '">' + escapeRecargaHtml(motivo) + '</span>'
        : '';

      return '<li class="entry-row">' +
          '<span class="entry-date">' + A.fmtDate(r.created_at) + '</span>' +
          userBlock +
          '<span class="entry-credits">+' + (r.amount || 0) + ' cr</span>' +
          motivoBlock +
        '</li>';
    }).join('');
  }

  function scheduleReloadHistory() {
    clearTimeout(recargasRefreshTimer);
    recargasRefreshTimer = setTimeout(async function () {
      cachedRecargas = await loadRealRecargas();
      renderHistory();
    }, 500);
  }

  function startRecargasRealtime() {
    var sb = getSB();
    if (!sb || recargasRealtimeChannel) return;
    try {
      recargasRealtimeChannel = sb.channel('admin-recargas-live')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, scheduleReloadHistory)
        .subscribe();
    } catch (e) { console.warn('Recargas realtime no disponible:', e); }
  }

  function updateUserPreview() {
    var email = document.getElementById('recargaEmail').value.trim();
    var preview = document.getElementById('recargaUserPreview');
    var hint = document.getElementById('recargaEmailHint');
    currentTarget = null;
    if (!email) {
      preview.hidden = true;
      hint.textContent = 'El usuario debe estar registrado';
      hint.classList.remove('is-error', 'is-ok');
      return;
    }
    var u = findRealUserByEmail(email);
    if (!u) {
      preview.hidden = true;
      hint.textContent = 'No se encontró un usuario con ese correo';
      hint.classList.remove('is-ok');
      hint.classList.add('is-error');
      return;
    }
    currentTarget = u;
    preview.hidden = false;
    var name = u.full_name || u.email;
    document.getElementById('recargaUserAvatar').textContent = A.userInitials(name);
    document.getElementById('recargaUserName').textContent = name;
    document.getElementById('recargaUserCredits').textContent =
      'Saldo actual: ' + (u.credits_balance || 0) + ' créditos · ' + u.email;
    hint.textContent = 'Usuario encontrado';
    hint.classList.remove('is-error');
    hint.classList.add('is-ok');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    var submitBtn = document.querySelector('#recargaForm button[type="submit"]');
    var email = document.getElementById('recargaEmail').value.trim();
    var u = currentTarget || findRealUserByEmail(email);
    if (!u) {
      if (window.Consultia.toast) Consultia.toast({ type:'error', title:'Usuario no encontrado', message:'Revisa el correo.' });
      return;
    }

    // Tipo de operación: 'creditos' | 'dias' | 'ambos' (decide qué procesa)
    var tipoEl = document.querySelector('input[name="recargaTipo"]:checked');
    var tipo = tipoEl ? tipoEl.value : 'creditos';

    // Solo lee créditos si el tipo lo permite
    var credits = 0;
    var paq = '';
    if (tipo === 'creditos' || tipo === 'ambos') {
      paq = document.getElementById('recargaPaquete').value;
      if (paq === 'custom') {
        credits = parseInt(document.getElementById('recargaCustom').value, 10) || 0;
      } else if (paq) {
        var plan = A.findCreditPlan(paq);
        credits = plan ? (plan.credits + plan.bonus) : (parseInt(paq, 10) || 0);
      }
    }

    // Solo lee plan por días si el tipo lo permite
    var subPlan = null;
    if (tipo === 'dias' || tipo === 'ambos') {
      var subPlanId = document.getElementById('recargaSubPlan').value;
      subPlan = subPlanId ? A.findSubscriptionPlan(subPlanId) : null;
    }

    // Validación según tipo
    if (tipo === 'creditos' && credits <= 0) {
      if (window.Consultia.toast) Consultia.toast({
        type: 'error',
        title: 'Selecciona un paquete',
        message: 'Elige un paquete de créditos o un monto personalizado.'
      });
      return;
    }
    if (tipo === 'dias' && !subPlan) {
      if (window.Consultia.toast) Consultia.toast({
        type: 'error',
        title: 'Selecciona un plan por días',
        message: 'Elige uno de los planes por días disponibles.'
      });
      return;
    }
    if (tipo === 'ambos' && (credits <= 0 || !subPlan)) {
      if (window.Consultia.toast) Consultia.toast({
        type: 'error',
        title: 'Combo incompleto',
        message: 'Para asignar ambos, selecciona créditos Y plan por días.'
      });
      return;
    }

    var motivo = document.getElementById('recargaMotivo').value.trim();
    var sb = getSB();
    if (!sb) {
      if (window.Consultia.toast) Consultia.toast({ type:'error', title:'Supabase no disponible', message:'Recarga la página.' });
      return;
    }

    if (submitBtn) { submitBtn.disabled = true; submitBtn.dataset.orig = submitBtn.dataset.orig || submitBtn.textContent; submitBtn.textContent = 'Guardando…'; }

    // Precio en soles del paquete de créditos (si aplica) — para tracking
    // de ingresos. `custom` no tiene precio asociado, solo créditos.
    var creditPlanObj = (paq && paq !== 'custom') ? A.findCreditPlan(paq) : null;
    var creditPricePEN = (creditPlanObj && creditPlanObj.price) ? parseFloat(creditPlanObj.price) : 0;

    try {
      // 1) Sumar créditos (si aplica)
      if (credits > 0) {
        var res = await sb.rpc('admin_adjust_credits', {
          target_user_id: u.id,
          delta: credits,
          note: motivo || null,
          method: 'whatsapp',
          ref: null
        });
        if (res.error) throw res.error;

        // Registrar el ingreso en S/ si el paquete tiene precio
        // (NO si fue "custom" sin precio). Fire-and-forget.
        if (creditPricePEN > 0) {
          try {
            await sb.rpc('admin_record_sale', {
              target_user_id: u.id,
              p_amount_pen: creditPricePEN,
              p_kind: 'credits',
              p_plan_id: creditPlanObj.id,
              p_note: motivo || null
            });
          } catch (saleErr) {
            console.warn('No se pudo registrar el ingreso S/:', saleErr);
          }
        }

        // Notificación de créditos (solo si no hay sub — si hay, una sola notif consolidada)
        if (!subPlan) {
          try {
            await sb.rpc('admin_create_notification', {
              target_user_id: u.id,
              n_title: '¡Recibiste ' + credits + ' créditos!',
              n_body: motivo
                ? 'Se acreditaron ' + credits + ' créditos a tu cuenta. Motivo: ' + motivo
                : 'Se acreditaron ' + credits + ' créditos a tu cuenta.',
              n_type: 'credits',
              n_meta: { credits: credits, method: 'whatsapp' }
            });
          } catch (nerr) {
            console.warn('No se pudo crear la notificación de créditos:', nerr);
          }
        }
      }

      // 2) Activar/extender suscripción (si aplica)
      var subResult = null;
      if (subPlan) {
        var subRes = await sb.rpc('admin_grant_subscription', {
          target_user_id: u.id,
          p_tier:   subPlan.tier,
          p_days:   subPlan.days,
          p_plan_id: subPlan.id,
          p_note:   motivo || null,
          p_amount_pen: subPlan.price ? parseFloat(subPlan.price) : null
        });
        if (subRes.error) throw subRes.error;
        subResult = subRes.data;
        // La RPC ya inserta la notificación de "Plan activado" con la fecha
        // de vencimiento Y registra el ingreso S/ del plan automáticamente.
      }

      // Toast consolidado
      var toastMsg;
      if (credits > 0 && subPlan) {
        toastMsg = '+' + credits + ' créditos · Plan ' + A.tierLabel(subPlan.tier) + ' (' + subPlan.days + 'd) a ' + (u.full_name || u.email);
      } else if (subPlan) {
        toastMsg = 'Plan ' + A.tierLabel(subPlan.tier) + ' (' + subPlan.days + 'd) activado a ' + (u.full_name || u.email);
      } else {
        toastMsg = '+' + credits + ' a ' + (u.full_name || u.email);
      }
      if (window.Consultia.toast) Consultia.toast({
        type: 'success',
        title: subPlan ? 'Asignado correctamente' : 'Créditos sumados',
        message: toastMsg
      });

      var auditDetail = (credits > 0 ? '+' + credits + ' cr' : '') +
        (subPlan ? (credits > 0 ? ' + ' : '') + 'Plan ' + subPlan.tier + ' ' + subPlan.days + 'd' : '') +
        (motivo ? ' · ' + motivo : '');
      A.logAudit(subPlan ? 'recarga.create+sub' : 'recarga.create', u.email, auditDetail);

      // Refrescar cache de usuarios reales (sus créditos cambiaron) y el
      // historial de recargas que ahora vive en `transactions`.
      realUsers = await loadRealUsers();
      cachedRecargas = await loadRealRecargas();

      document.getElementById('recargaForm').reset();
      document.getElementById('recargaCustomField').hidden = true;
      document.getElementById('recargaUserPreview').hidden = true;
      document.getElementById('recargaEmailHint').textContent = 'El usuario debe estar registrado';
      document.getElementById('recargaEmailHint').classList.remove('is-ok', 'is-error');
      currentTarget = null;

      renderHistory();
      if (A.renderUsers) A.renderUsers();
      if (A.renderDashboard) A.renderDashboard();
    } catch (err) {
      console.error('Error recargando:', err);
      if (window.Consultia.toast) Consultia.toast({
        type: 'error',
        title: 'Error al sumar créditos',
        message: (err && err.message) || 'Intenta de nuevo.'
      });
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = submitBtn.dataset.orig || 'Confirmar'; }
    }
  }

  A.renderRecargas = async function () {
    if (typeof repopulateSelect === 'function') repopulateSelect();
    // Cargar historial real desde Supabase + suscribirse a cambios
    cachedRecargas = await loadRealRecargas();
    renderHistory();
    startRecargasRealtime();
    // Refresca usuarios reales cada vez que se abre la vista
    realUsers = await loadRealUsers();
    // Wire del botón de pago de prueba (S/2 = 200 créditos)
    wireTestPaymentButton();
  };

  // ============================================================
  // BOTÓN DE PAGO DE PRUEBA — S/2 = 200 créditos
  // Llama a la edge function `crear-preferencia` con plan_id 'cp-test'
  // y redirige al checkout de Mercado Pago. Útil para verificar que el
  // webhook acredita los créditos automáticamente al aprobar el pago.
  // ============================================================
  var testBtnWired = false;
  function wireTestPaymentButton() {
    if (testBtnWired) return;
    var btn = document.getElementById('testMpPaymentBtn');
    if (!btn) return;
    btn.addEventListener('click', startTestPayment);
    testBtnWired = true;
  }

  async function startTestPayment() {
    var btn = document.getElementById('testMpPaymentBtn');
    var hint = document.getElementById('testMpPaymentHint');
    if (!btn) return;

    var sb = getSB();
    if (!sb) {
      if (Consultia.toast) Consultia.toast({
        type: 'error', title: 'Supabase no disponible', message: 'Recarga la página.'
      });
      return;
    }

    // Tomar el usuario logueado (admin actual)
    var auth = await sb.auth.getUser();
    var user = auth && auth.data && auth.data.user;
    if (!user) {
      if (Consultia.toast) Consultia.toast({
        type: 'error', title: 'Sin sesión', message: 'No se detectó tu sesión de admin.'
      });
      return;
    }

    var originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="width:14px;height:14px;margin-right:6px;vertical-align:-2px;animation:spin 0.8s linear infinite;">' +
        '<circle cx="12" cy="12" r="10" stroke-dasharray="40 60"/>' +
      '</svg>Generando preferencia…';
    if (hint) hint.textContent = 'Creando preferencia de pago...';

    try {
      var res = await sb.functions.invoke('crear-preferencia', {
        body: { plan_id: 'cp-test' }
      });
      if (res.error) throw res.error;
      if (!res.data || !res.data.init_point) {
        throw new Error(res.data && res.data.error ? res.data.error : 'Respuesta inválida del servidor');
      }
      // Redirige al checkout de MP
      if (hint) hint.textContent = 'Redirigiendo al checkout de Mercado Pago…';
      window.location.href = res.data.init_point;
    } catch (err) {
      console.error('Error en pago de prueba:', err);
      btn.disabled = false;
      btn.innerHTML = originalHTML;
      if (hint) hint.textContent = 'Error: ' + ((err && err.message) || 'No se pudo crear la preferencia.');
      if (Consultia.toast) Consultia.toast({
        type: 'error',
        title: 'No se pudo iniciar el pago de prueba',
        message: (err && err.message) || 'Verifica que el plan cp-test exista en crear-preferencia.'
      });
    }
  }

  function repopulateSelect() {
    var select = document.getElementById('recargaPaquete');
    if (!select) return;
    var plans = A.getActiveCreditPlans();
    var byTier = { profesional: [], business: [] };
    plans.forEach(function (p) { if (byTier[p.tier]) byTier[p.tier].push(p); });

    var premiumTiers = { profesional_plus: true, business: true };
    // Placeholder vacío para evitar selección por defecto accidental
    var html = '<option value="">— Selecciona un paquete —</option>';
    ['profesional', 'business'].forEach(function (tierKey) {
      if (!byTier[tierKey].length) return;
      var label = A.tierLabel(tierKey) + (premiumTiers[tierKey] ? ' (Premium)' : '');
      html += '<optgroup label="' + label + '">';
      byTier[tierKey].forEach(function (p) {
        var total = p.credits + p.bonus;
        var premiumTag = premiumTiers[tierKey] ? ' (Premium)' : '';
        html += '<option value="' + p.id + '">' + p.credits + ' + ' + p.bonus + ' créditos (' + total + ') — S/ ' + p.price + premiumTag + '</option>';
      });
      html += '</optgroup>';
    });
    html += '<option value="custom">Monto personalizado</option>';
    select.innerHTML = html;

    repopulateSubSelect();
  }
  A.repopulateRecargaSelect = repopulateSelect;

  function repopulateSubSelect() {
    var select = document.getElementById('recargaSubPlan');
    if (!select) return;
    var plans = A.getActiveSubscriptionPlans();
    var byTier = { profesional: [], profesional_plus: [], business: [] };
    plans.forEach(function (p) { if (byTier[p.tier]) byTier[p.tier].push(p); });

    var premiumTiers = { profesional_plus: true, business: true };
    var html = '<option value="">— Selecciona un plan por días —</option>';
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
  A.repopulateRecargaSubSelect = repopulateSubSelect;

  // Muestra/oculta los bloques según el tipo de operación elegido.
  function applyTipoOperacion() {
    var tipoEl = document.querySelector('input[name="recargaTipo"]:checked');
    var tipo = tipoEl ? tipoEl.value : 'creditos';
    var credBlock  = document.getElementById('recargaCreditosBlock');
    var diasBlock  = document.getElementById('recargaDiasBlock');
    var customField = document.getElementById('recargaCustomField');
    if (credBlock) credBlock.hidden = (tipo === 'dias');
    if (diasBlock) diasBlock.hidden = (tipo === 'creditos');
    // Si oculta créditos, también el campo personalizado
    if (customField && tipo === 'dias') customField.hidden = true;
    // Reset de selects al cambiar de tipo, para evitar arrastrar valores previos
    if (tipo === 'dias') {
      var pq = document.getElementById('recargaPaquete'); if (pq) pq.value = '';
    }
    if (tipo === 'creditos') {
      var sp = document.getElementById('recargaSubPlan'); if (sp) sp.value = '';
    }
  }

  function resetRecargaForm() {
    repopulateSelect();
    var select = document.getElementById('recargaPaquete');
    if (select) select.value = '';
    var subSel = document.getElementById('recargaSubPlan');
    if (subSel) subSel.value = '';
    // Volver al tipo por defecto: solo créditos
    var defaultRadio = document.querySelector('input[name="recargaTipo"][value="creditos"]');
    if (defaultRadio) defaultRadio.checked = true;
    applyTipoOperacion();
    document.getElementById('recargaCustomField').hidden = true;
    document.getElementById('recargaUserPreview').hidden = true;
    var hint = document.getElementById('recargaEmailHint');
    hint.textContent = 'El usuario debe estar registrado';
    hint.classList.remove('is-ok', 'is-error');
  }

  A.initRecargas = async function () {
    repopulateSelect();
    applyTipoOperacion();
    document.getElementById('recargaEmail').addEventListener('input', updateUserPreview);
    document.getElementById('recargaPaquete').addEventListener('change', function (e) {
      document.getElementById('recargaCustomField').hidden = e.target.value !== 'custom';
    });
    // Listener para el radio group de tipo de operación
    var radios = document.querySelectorAll('input[name="recargaTipo"]');
    radios.forEach(function (r) { r.addEventListener('change', applyTipoOperacion); });
    document.getElementById('recargaForm').addEventListener('submit', handleSubmit);
    document.getElementById('recargaForm').addEventListener('reset', function () {
      setTimeout(resetRecargaForm, 0);
    });
    // Pre-carga los usuarios reales para que la búsqueda por correo funcione
    // desde el primer intento.
    realUsers = await loadRealUsers();
  };
})();
