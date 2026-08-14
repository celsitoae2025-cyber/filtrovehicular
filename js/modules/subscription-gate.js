/* ============================================================
   SUBSCRIPTION GATE — modal "Activa un plan" cuando el usuario
   intenta ejecutar una consulta marcada como requires_subscription
   sin tener suscripcion activa.

   Uso desde category-view.js / filter.js:
     Consultia.SubscriptionGate.openModal(consulta);
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  function openModal(consulta) {
    var nombre = (consulta && consulta.nombre) || 'Esta consulta';

    if (Consultia.confirm) {
      Consultia.confirm({
        title: 'ðŸ”’ Requiere un plan activo',
        message:
          '<strong>' + escapeHtml(nombre) + '</strong> es una consulta premium. ' +
          'Para visualizar el resultado necesitas activar un plan de suscripción.<br><br>' +
          'Con tu plan podrás acceder a Leyenda vehicular, Cambio de características, ' +
          'Gravámenes y afectaciones, Propietarios y mucho más sin gastar créditos.',
        confirmText: 'Ver planes',
        cancelText: 'Cerrar',
      }).then(function (ok) {
        if (!ok) return;
        // Navegar a la vista de saldo/planes y abrir la pestaña de suscripciones
        var btn = document.querySelector('[data-nav="saldo"]');
        if (btn) btn.click();
        else window.location.hash = '#saldo';
        setTimeout(function () {
          var subsSection = document.getElementById('plansSection-subs');
          if (subsSection) subsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 60);
      });
    } else {
      // Fallback minimo
      alert('Esta consulta requiere un plan activo. Ve a la sección Saldo â†’ Planes para activarlo.');
    }
  }

  var escapeHtml = Consultia.Utils.escapeHtml;

  // ============================================================
  // openNoCreditsModal — saldo agotado, no tiene suscripcion activa.
  // Muestra modal con opciones directas de pago:
  //   1) Mercado Pago / Yape (automático, créditos al instante)
  //   2) WhatsApp (manual, última opción)
  // ============================================================
  var NC_MODAL_ID = 'noCreditsModalRoot';

  function getPlans() {
    if (Consultia.Plans && Consultia.Plans.getPlans) {
      var all = Consultia.Plans.getPlans();
      return (all.creditPlans || []).filter(function (p) { return p.active; });
    }
    return [];
  }

  function closeNoCreditsModal() {
    var root = document.getElementById(NC_MODAL_ID);
    if (root) root.innerHTML = '';
    document.body.classList.remove('confirm-dialog-open');
  }

  async function iniciarPagoMP(planId, btnEl) {
    var user = await Consultia.Auth.getUser();
    if (!user) {
      if (Consultia.AuthModals) Consultia.AuthModals.openLogin();
      return;
    }
    var orig = btnEl.innerHTML;
    btnEl.disabled = true;
    btnEl.innerHTML = 'Redirigiendo al pago…';
    try {
      var res = await Consultia.supabase.functions.invoke('crear-preferencia', {
        body: { plan_id: planId }
      });
      if (res.error) throw res.error;
      if (!res.data || !res.data.init_point) throw new Error(res.data && res.data.error ? res.data.error : 'Respuesta inválida');
      var url = res.data.init_point;
      if (!/^https:\/\/[a-z]+\.mercadopago\.com/i.test(url) && !/^https:\/\/[a-z]+\.mercadolibre\.com/i.test(url)) throw new Error('URL de pago no reconocida');
      window.location.href = url;
    } catch (err) {
      btnEl.disabled = false;
      btnEl.innerHTML = orig;
      if (Consultia.toast) Consultia.toast({ type: 'error', title: 'Error al iniciar pago', message: 'Intenta por WhatsApp.' });
    }
  }

  async function openNoCreditsModal(consulta) {
    var nombre = (consulta && consulta.nombre) || 'Esta consulta';
    var precio = (consulta && consulta.precio_venta) || 0;

    // Saldo desconocido (null) no es lo mismo que saldo cero: si la lectura
    // falla no se le puede decir a alguien que ya gastó todos sus créditos.
    var saldo = null;
    try {
      var sb = Consultia.supabase;
      var user = await Consultia.Auth.getUser();
      if (sb && user) {
        var res = await sb.from('profiles').select('credits_balance').eq('id', user.id).single();
        if (!res.error && res.data) saldo = res.data.credits_balance || 0;
      }
    } catch (_) {}

    var plans = getPlans();
    var cheapest = plans.length > 0 ? plans.reduce(function (a, b) { return a.price < b.price ? a : b; }) : null;

    var msgSaldo;
    if (saldo === null)     msgSaldo = '';                       // no se pudo leer
    else if (saldo > 0)     msgSaldo = 'Tienes <strong>' + saldo + ' crédito' + (saldo === 1 ? '' : 's') + '</strong>, pero ';
    else                    msgSaldo = 'Ya usaste todos tus créditos. ';
    var msgPrecio = '<strong>' + escapeHtml(nombre) + '</strong> requiere ' + precio +
      ' crédito' + (precio === 1 ? '' : 's') + '.';

    // Construir lista de planes
    var planesHTML = '';
    if (plans.length > 0) {
      planesHTML = '<div class="nc-plans">';
      plans.forEach(function (p) {
        var total = (p.credits || 0) + (p.bonus || 0);
        planesHTML +=
          '<div class="nc-plan-row">' +
            '<span class="nc-plan-info"><strong>' + total + '</strong> créditos</span>' +
            '<span class="nc-plan-price">S/ ' + p.price + '</span>' +
            '<button type="button" class="btn btn-primary nc-btn-pagar" data-nc-plan="' + p.id + '">Pagar</button>' +
          '</div>';
      });
      planesHTML += '</div>';
    }

    var waMsg = Consultia.greeting() +
      ', se me acabaron los créditos en Filtro Vehicular+ justo cuando los necesitaba. ' +
      'Quiero recargar cuanto antes. ¿Cómo hago el pago?';
    var waLink = 'https://wa.me/' + Consultia.WHATSAPP_NUMBER + '?text=' + encodeURIComponent(waMsg);

    var root = document.getElementById(NC_MODAL_ID);
    if (!root) {
      root = document.createElement('div');
      root.id = NC_MODAL_ID;
      document.body.appendChild(root);
    }

    root.innerHTML =
      '<div class="cd-modal" role="dialog" aria-modal="true">' +
        '<div class="cd-overlay"></div>' +
        '<div class="cd-panel nc-panel">' +
          '<button class="cd-close nc-close" type="button" aria-label="Cerrar">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
          '</button>' +
          '<h3 class="cd-title">Créditos insuficientes</h3>' +
          '<p class="cd-message">' + msgSaldo + msgPrecio + '</p>' +
          '<p class="cd-message" style="margin-top:4px;font-size:.92em;color:#141d1c;">Elige un paquete y paga al instante con <strong>Yape</strong> o <strong>Mercado Pago</strong>:</p>' +
          planesHTML +
          '<div class="nc-alt">' +
            '<a class="nc-wa-link" href="' + waLink + '" target="_blank" rel="noopener">' +
              'O escríbenos por WhatsApp' +
            '</a>' +
            ' · ' +
            '<a class="nc-ver-planes" href="#">Ver todos los planes</a>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.classList.add('confirm-dialog-open');

    // Eventos
    root.querySelector('.cd-overlay').addEventListener('click', closeNoCreditsModal);
    root.querySelector('.nc-close').addEventListener('click', closeNoCreditsModal);

    root.querySelectorAll('.nc-btn-pagar').forEach(function (btn) {
      btn.addEventListener('click', function () {
        iniciarPagoMP(btn.dataset.ncPlan, btn);
      });
    });

    var verPlanesLink = root.querySelector('.nc-ver-planes');
    if (verPlanesLink) {
      verPlanesLink.addEventListener('click', function (e) {
        e.preventDefault();
        closeNoCreditsModal();
        var navBtn = document.querySelector('[data-nav="saldo"]');
        if (navBtn) navBtn.click();
        else window.location.hash = '#saldo';
      });
    }
  }

  Consultia.SubscriptionGate = {
    openModal: openModal,
    openNoCreditsModal: openNoCreditsModal,
  };
})();
