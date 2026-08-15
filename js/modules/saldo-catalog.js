/* ============================================================
   SALDO CATALOG — tarjetas de planes en la vista "Mi saldo"
   Lee de Consultia.Plans (compartido con admin) y solo muestra
   los que están marcados como activos desde el panel admin.
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  function whatsappLink() {
    var msg = Consultia.greeting() +
      ', quiero adquirir créditos en Filtro Vehicular+ para seguir haciendo mis consultas. ' +
      '¿Cuál es la forma más rápida de realizar el pago?';
    return 'https://wa.me/' + Consultia.WHATSAPP_NUMBER + '?text=' + encodeURIComponent(msg);
  }

  var WA_SVG = '<svg class="pcv2-btn-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';
  var MP_SVG  = '<svg class="pcv2-btn-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 2H8c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-4 19c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-4H8V5h8v12z"/></svg>';
  var SPIN_SVG = '<svg class="pcv2-spin" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="40 60"/></svg>';

  // Llama a la edge function y redirige al checkout de MP
  async function iniciarPagoMP(planId, buttonEl) {
    if (!Consultia.Auth) {
      if (Consultia.toast) Consultia.toast({ type: 'error', title: 'Error', message: 'Auth no cargado.' });
      return;
    }
    var user = await Consultia.Auth.getUser();
    if (!user) {
      // Sin sesión → pedir que inicie sesión primero
      if (Consultia.AuthModals) Consultia.AuthModals.openLogin();
      if (Consultia.toast) Consultia.toast({
        type: 'info',
        title: 'Inicia sesión primero',
        message: 'Necesitas una cuenta para comprar créditos por Mercado Pago.'
      });
      return;
    }

    // Estado: loading con spinner
    var originalHTML = buttonEl.innerHTML;
    buttonEl.disabled = true;
    buttonEl.classList.add('is-loading');
    buttonEl.innerHTML = SPIN_SVG + '<span>Redirigiendo…</span>';

    try {
      var res = await Consultia.supabase.functions.invoke('crear-preferencia', {
        body: { plan_id: planId }
      });

      if (res.error) throw res.error;
      if (!res.data || !res.data.init_point) {
        throw new Error(res.data && res.data.error ? res.data.error : 'Respuesta inválida');
      }

      // Validar que la URL sea de Mercado Pago antes de redirigir
      var payUrl = res.data.init_point;
      if (!/^https:\/\/[a-z]+\.mercadopago\.com/i.test(payUrl) && !/^https:\/\/[a-z]+\.mercadolibre\.com/i.test(payUrl)) throw new Error('URL de pago no reconocida');
      window.location.href = payUrl;
    } catch (err) {
      buttonEl.disabled = false;
      buttonEl.classList.remove('is-loading');
      buttonEl.innerHTML = originalHTML;
      console.error('Error iniciando pago MP:', err);
      if (Consultia.toast) Consultia.toast({
        type: 'error',
        title: 'No se pudo iniciar el pago',
        message: 'Intenta más tarde o paga por WhatsApp.'
      });
    }
  }

  function actionsHTML(p, desc) {
    // Sin botones — la tarjeta entera es el clickeable que abre el modal de pago.
    return '';
  }

  function creditCardHTML(p) {
    // El precio por crédito se calcula, no se escribe a mano: así la tarjeta
    // nunca puede contradecir al precio real. Es además lo que deja ver de un
    // vistazo que los paquetes grandes salen más baratos.
    var unitario = (p.price / p.credits).toFixed(3);

    return '<button type="button" class="pay-kard" data-open-pay="' + p.id + '">' +
      '<span class="pk-credits-num">' + p.credits.toLocaleString('es-PE') + '</span>' +
      '<span class="pk-credits-unit">créditos</span>' +
      '<span class="pk-divider" aria-hidden="true"></span>' +
      '<span class="pk-price"><span class="pk-cur">S/</span>' + p.price + '</span>' +
      '<span class="pk-unit-price">S/ ' + unitario + ' c/u</span>' +
    '</button>';
  }

  function subCardHTML(p) {
    var tierLabel = Consultia.Plans.tierLabel(p.tier);
    return '<div class="plan-card-v2 plan-card-v2-sub" data-plan-id="' + p.id + '">' +
      '<div class="pcv2-top">' +
        '<div class="pcv2-amount">' +
          '<span class="pcv2-num">' + p.days + '</span>' +
          '<span class="pcv2-unit">días</span>' +
        '</div>' +
        '<div class="pcv2-right">' +
          '<span class="pcv2-price"><span class="pcv2-cur">S/</span>' + p.price + '</span>' +
        '</div>' +
      '</div>' +
      '<p class="pcv2-detail">Plan ' + tierLabel + ' · acceso completo</p>' +
      actionsHTML(p, p.days + ' días ' + tierLabel) +
    '</div>';
  }

  function groupByTier(plans, tiers) {
    var out = {};
    tiers.forEach(function (t) { out[t] = []; });
    plans.forEach(function (p) { if (out[p.tier]) out[p.tier].push(p); });
    return out;
  }

  function setGrid(id, html) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  // Catálogo fijo de créditos: 4 paquetes + recarga personalizada.
  // Los IDs y precios están alineados con supabase/functions/_shared/plans.ts
  // (fuente de verdad para Mercado Pago).
  var FIXED_PLANS = [
    { id: 'cp-prof-1', credits: 200,  price: 15  },
    { id: 'cp-prof-2', credits: 420,  price: 25  },
    { id: 'cp-biz-1',  credits: 1800, price: 90  },
    { id: 'cp-biz-2',  credits: 4000, price: 150 }
  ];

  function customCardHTML() {
    return '<button type="button" class="pay-custom" data-open-pay="custom">' +
      '<span class="pay-custom-eyebrow">Elige tu propio monto</span>' +
      '<span class="pay-custom-title">Recarga personalizada</span>' +
      '<span class="pay-custom-sub">Desde S/ ' + (CUSTOM_MIN * CUSTOM_RATE) + '. Paga solo lo que necesitas.</span>' +
      '<span class="pay-custom-cta">Configurar</span>' +
    '</button>';
  }

  // Tarifa por crédito para la recarga personalizada (basada en el paquete de 4000).
  var CUSTOM_RATE = 0.05;     // S/ por crédito
  var CUSTOM_MIN  = 400;      // mínimo de créditos (= S/ 20)

  // ── Modal minimalista para recarga personalizada ─────
  function customModalHTML() {
    return '<div class="rx-modal" id="payModal" hidden role="dialog" aria-modal="true">' +
      '<div class="rx-modal-backdrop" data-close-pay></div>' +
      '<div class="rx-modal-shell">' +
        '<button type="button" class="rx-modal-close" data-close-pay aria-label="Cerrar">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
        '</button>' +
        '<div class="rx-modal-main">' +
          '<span class="rx-main-title">Recarga personalizada</span>' +
          '<span class="rx-main-sub">Ingresa la cantidad de créditos y verás el total.</span>' +
          '<div class="rx-field">' +
            '<label class="rx-label" for="customCredits">Cantidad</label>' +
            '<div class="rx-input-wrap">' +
              '<input type="number" class="rx-input" id="customCredits" min="' + CUSTOM_MIN + '" step="10" placeholder="Ej: 500" inputmode="numeric" autocomplete="off">' +
              '<span class="rx-input-suffix">créditos</span>' +
            '</div>' +
          '</div>' +
          '<div class="rx-summary">' +
            '<span class="rx-summary-key">Total a pagar</span>' +
            '<span class="rx-summary-val" id="customTotal">S/ 0.00</span>' +
          '</div>' +
          '<a class="rx-cta" id="customPayCTA" href="#" target="_blank" rel="noopener" aria-disabled="true">Confirmar recarga</a>' +
          '<p class="rx-foot-note">Mínimo S/ ' + (CUSTOM_MIN * CUSTOM_RATE) + ' (' + CUSTOM_MIN + ' créditos) · Tarifa S/ ' + CUSTOM_RATE.toFixed(2) + ' por crédito</p>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function updateCustomTotal() {
    var input = document.getElementById('customCredits');
    var totalEl = document.getElementById('customTotal');
    var cta = document.getElementById('customPayCTA');
    if (!input || !totalEl || !cta) return;
    var credits = parseInt(input.value, 10) || 0;
    var total = credits * CUSTOM_RATE;
    totalEl.textContent = 'S/ ' + total.toFixed(2);
    if (credits >= CUSTOM_MIN) {
      cta.removeAttribute('aria-disabled');
      cta.classList.remove('is-disabled');
      var msg = Consultia.greeting() +
        ', quiero adquirir ' + credits + ' créditos personalizados en Filtro Vehicular+ ' +
        'por un total de S/ ' + total.toFixed(2) + '. ¿Cómo procedo con el pago?';
      cta.href = 'https://wa.me/' + Consultia.WHATSAPP_NUMBER + '?text=' + encodeURIComponent(msg);
    } else {
      cta.setAttribute('aria-disabled', 'true');
      cta.classList.add('is-disabled');
      cta.href = '#';
    }
  }

  function openPayModal(planKey) {
    // Planes fijos → checkout Mercado Pago directo, sin modal intermedio
    if (planKey !== 'custom') {
      var card = document.querySelector('[data-open-pay="' + planKey + '"]');
      iniciarPagoMP(planKey, card);
      return;
    }
    // Personalizado → modal con input de créditos
    var modal = document.getElementById('payModal');
    if (!modal) return;
    var input = document.getElementById('customCredits');
    if (input) input.value = '';
    updateCustomTotal();
    modal.hidden = false;
    document.body.classList.add('modal-open');
    setTimeout(function () { if (input) input.focus(); }, 100);
  }
  function closePayModal() {
    var modal = document.getElementById('payModal');
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove('modal-open');
  }

  function render() {
    setGrid('catalogGridCredits', FIXED_PLANS.map(creditCardHTML).join(''));
    setGrid('catalogGridCustom',  customCardHTML());
    // Inyectar el modal de recarga personalizada si no existe todavía
    if (!document.getElementById('payModal')) {
      document.body.insertAdjacentHTML('beforeend', customModalHTML());
    }
  }

  function switchTab(tab) {
    // Las secciones se muestran ambas siempre (sin pestañas)
    var target = document.getElementById('plansSection-' + tab);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Restaurar botones MP si el usuario vuelve con "atrás" (bfcache o recarga)
  window.addEventListener('pageshow', function () {
    document.querySelectorAll('.pcv2-yape.is-loading').forEach(function (btn) {
      btn.disabled = false;
      btn.classList.remove('is-loading');
      btn.innerHTML = MP_SVG + '<span>Yape</span>';
    });
  });

  Consultia.initSaldoCatalog = function () {
    var view = document.getElementById('view-saldo');
    if (!view) return;

    render();

    // Botones externos (ej. "Mejorar plan" del dashboard) pueden indicar
    // qué sección scrollear al navegar a Mi saldo.
    document.querySelectorAll('[data-saldo-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () { switchTab(btn.dataset.saldoTab); });
    });

    view.addEventListener('click', function (e) {
      // Clic sobre una tarjeta de plan → abrir modal de pago
      var card = e.target.closest('[data-open-pay]');
      if (card) {
        e.preventDefault();
        openPayModal(card.dataset.openPay);
        return;
      }
      // Compatibilidad: por si queda algún botón MP directo
      var mpBtn = e.target.closest('[data-mp-plan]');
      if (mpBtn) {
        e.preventDefault();
        iniciarPagoMP(mpBtn.dataset.mpPlan, mpBtn);
      }
    });

    // Delegación global — cerrar modal + actualizar total del personalizado
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-close-pay]')) closePayModal();
    });
    document.addEventListener('input', function (e) {
      if (e.target.id === 'customCredits') updateCustomTotal();
    });
    document.addEventListener('click', function (e) {
      var chip = e.target.closest('.rx-chip');
      if (chip) {
        var input = document.getElementById('customCredits');
        if (input) {
          input.value = chip.dataset.quick;
          updateCustomTotal();
          input.focus();
        }
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closePayModal();
    });
  };
})();
