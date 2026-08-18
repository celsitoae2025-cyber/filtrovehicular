/* ============================================================
   PREMIUM — vista de consultas exclusivas con diseño de
   sidebar de categorías + grid de cards.
============================================================ */
(function () {
  window.Consultia = window.Consultia || {};

  var catalog  = [];
  var groups   = Object.create(null);  // { cat: [items] }
  var catOrder = [];
  var activeConsulta = null;

  // ── Helpers ─────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, function(c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  // ── Acceso premium ──────────────────────────────────────
  function hasPremiumAccess() {
    try {
      if (!Consultia.Subscription || !Consultia.Subscription.isActiveSync) return false;
      if (!Consultia.Subscription.isActiveSync()) return false;
      var tier = (Consultia.Subscription.tier && Consultia.Subscription.tier()) || '';
      return tier === 'profesional_plus' || tier === 'business';
    } catch (_) { return false; }
  }

  function showGateModal() {
    if (Consultia.confirm) {
      Consultia.confirm({
        title: 'Servicio exclusivo Plus / Business',
        messageHtml: 'Esta consulta está disponible únicamente con el plan <b>Profesional Plus</b> o <b>Business</b>.<br><br>Mejora tu plan para desbloquear todos los servicios premium.',
        confirmText: 'Ver planes',
        cancelText: 'Cerrar',
      }).then(function (ok) {
        if (ok) {
          var btn = document.querySelector('[data-nav="saldo"]');
          if (btn) btn.click();
          else window.location.hash = '#saldo';
          setTimeout(function () {
            var subsSection = document.getElementById('plansSection-subs');
            if (subsSection) subsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 60);
        }
      });
    }
  }

  // ── Iconos ───────────────────────────────────────────────
  var CAT_ICONS = {
    'RENIEC':              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>',
    'TELEFONOS':           '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12a19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 3.06 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16.92z"/></svg>',
    'VEHÍCULOS':           '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
    'FINANCIERO':          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    'JUSTICIA':            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M5 8h14M3 8l4 8h-8zM21 8l-4 8h8z"/></svg>',
    'FAMILIA Y HOGAR':     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    'EDUCACIÓN Y LABORAL': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>',
    'EMPRESAS SUNAT':      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>',
    'SALUD':               '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    'OTROS':               '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><circle cx="5" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>',
  };

  // Iconos por servicio individual — se elige por keywords en el nombre.
  // El primer match gana, por eso el orden importa (FACIAL antes que DNI, etc.).
  var SERVICE_ICON_RULES = [
    { re: /facial|rostro|foto/i,                  ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>' },
    { re: /virtual|azul|c4|carnet|tarjeta/i,      ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><line x1="6" y1="15" x2="10" y2="15"/></svg>' },
    { re: /nombre|apellido/i,                     ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' },
    { re: /dni\s*v?\d|dni\b/i,                    ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="11" r="2.5"/><line x1="14" y1="9" x2="19" y2="9"/><line x1="14" y1="13" x2="19" y2="13"/><line x1="6" y1="17" x2="18" y2="17"/></svg>' },
    { re: /reniec/i,                              ic: CAT_ICONS['RENIEC'] },
    { re: /telef|celular|movist|claro|entel|bitel/i, ic: CAT_ICONS['TELEFONOS'] },
    { re: /placa|veh[ií]culo|soat|brevete|licencia/i, ic: CAT_ICONS['VEHÍCULOS'] },
    { re: /revisi[oó]n\s*t[eé]cnica/i,            ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>' },
    { re: /sutran|infracci/i,                     ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' },
    { re: /banco|cuenta|cci|cts|afp/i,            ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V10l7-5 7 5v11M9 14v3M12 14v3M15 14v3"/></svg>' },
    { re: /sueldo|salar|ingreso|remuner/i,        ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>' },
    { re: /deuda|infocorp|sentinel|equifax/i,     ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>' },
    { re: /tarjeta\s*cr/i,                        ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>' },
    { re: /judicial|denuncia|antecedent|polic|fiscal/i, ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' },
    { re: /agua|sedapal|luz|recibo|servicio/i,    ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v6M12 22v-2M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M2 12h6M22 12h-2M4.93 19.07l4.24-4.24M14.83 9.17l4.24-4.24"/></svg>' },
    { re: /direcci[oó]n|domicilio|catastro|predial/i, ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>' },
    { re: /familia|hijo|padre|madre|herman|conyuge|c[oó]nyuge|matrimon/i, ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>' },
    { re: /salud|medic|sis|essalud|cl[ií]nica|hospital/i, ic: CAT_ICONS['SALUD'] },
    { re: /trabajo|laboral|empleo|t-?reg|essalud|essa|ministerio/i, ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>' },
    { re: /educa|estudi|colegio|escuela|universidad|grado|t[ií]tulo/i, ic: CAT_ICONS['EDUCACIÓN Y LABORAL'] },
    { re: /sunat|ruc|empresa|negoc|raz[oó]n\s*social/i, ic: CAT_ICONS['EMPRESAS SUNAT'] },
    { re: /correo|email|gmail|hotmail/i,          ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>' },
    { re: /migrac|pasaporte|extranjer/i,          ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>' },
  ];

  function serviceIcon(item) {
    var name = (item && item.nombre) || '';
    for (var i = 0; i < SERVICE_ICON_RULES.length; i++) {
      if (SERVICE_ICON_RULES[i].re.test(name)) return SERVICE_ICON_RULES[i].ic;
    }
    // Fallback al icono de la categoría
    return CAT_ICONS[item && item.subcategoria] || CAT_ICONS['OTROS'];
  }

  // ── Renderizado sidebar ──────────────────────────────────
  function renderSidebar() {
    var inner = $('prem-sidebar-inner');
    if (!inner) return;

    var totalServices = 0;
    catOrder.forEach(function (g) { totalServices += groups[g].length; });

    var header = '<div class="prem-sidebar-header">' +
      '<span class="prem-sidebar-title">Categorías</span>' +
      '<span class="prem-sidebar-total">' + totalServices + '</span>' +
    '</div>';

    var btns = catOrder.map(function(g, i) {
      var icon = CAT_ICONS[g] || CAT_ICONS['OTROS'];
      var count = groups[g].length;
      return '<button class="prem-cat-btn' + (i === 0 ? ' active' : '') + '" data-cat="' + esc(g) + '" type="button">' +
        '<span class="prem-cat-icon">' + icon + '</span>' +
        '<span class="prem-cat-name">' + esc(g) + '</span>' +
        '<span class="prem-cat-badge">' + count + '</span>' +
      '</button>';
    }).join('');

    inner.innerHTML = header + '<div class="prem-cat-list">' + btns + '</div>';

    inner.querySelectorAll('.prem-cat-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        inner.querySelectorAll('.prem-cat-btn').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        setActiveCategory(btn.dataset.cat);
      });
    });
  }

  // ── Categoría activa ─────────────────────────────────────
  function setActiveCategory(cat) {
    var bar = $('prem-section-bar');
    if (bar) bar.hidden = false;
    var t = $('prem-cat-title');
    var c = $('prem-cat-count');
    if (t) t.textContent = cat;
    if (c) c.textContent = (groups[cat] || []).length + ' consultas';
    hideForm();
    hideResult();
    renderCards(groups[cat] || []);
  }

  // ── Grid de cards ────────────────────────────────────────
  function renderCards(items) {
    var grid = $('prem-cards-grid');
    if (!grid) return;
    if (!items.length) {
      grid.innerHTML =
        '<div class="prem-cards-empty">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="36" height="36"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
          '<span>No hay servicios en esta categoría.</span>' +
        '</div>';
      return;
    }
    var arrow = '<svg class="prem-card-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="9 18 15 12 9 6"/></svg>';

    grid.innerHTML = items.map(function(c) {
      var icon = serviceIcon(c);
      var price = parseFloat(c.precio_venta || 0);
      var priceLabel = (!price)
        ? '<span class="prem-card-cost is-free">Gratis</span>'
        : '<span class="prem-card-cost">' + price + '<span class="prem-card-cost-unit">' + (price === 1 ? 'crédito' : 'créditos') + '</span></span>';
      var tipo = (c.tipo_dato || '').toLowerCase();
      var tipoLabel = '';
      if (tipo === 'foto') tipoLabel = 'Imagen';
      else if (tipo === 'dni') tipoLabel = 'DNI';
      else if (tipo === 'placa') tipoLabel = 'Placa';
      else if (tipo === 'ruc') tipoLabel = 'RUC';
      else if (tipo === 'telefono') tipoLabel = 'Teléfono';
      var tipoChip = tipoLabel ? '<span class="prem-card-type">' + tipoLabel + '</span>' : '';

      return '<button class="prem-card" type="button" data-id="' + esc(c.id) + '">' +
        '<div class="prem-card-head">' +
          '<div class="prem-card-icon">' + icon + '</div>' +
          '<span class="prem-card-name">' + esc(c.nombre) + '</span>' +
        '</div>' +
        '<p class="prem-card-desc">' + esc(c.descripcion || '') + '</p>' +
        '<div class="prem-card-foot">' +
          priceLabel +
          tipoChip +
          '<span class="prem-card-arrow-wrap">' + arrow + '</span>' +
        '</div>' +
      '</button>';
    }).join('');

    grid.querySelectorAll('.prem-card').forEach(function(card) {
      card.addEventListener('click', function() {
        var id = card.dataset.id;
        var consulta = catalog.find(function(x) { return String(x.id) === String(id); });
        if (consulta) selectConsulta(consulta);
      });
    });
  }

  // ── Seleccionar consulta ─────────────────────────────────
  function selectConsulta(c) {
    activeConsulta = c;

    // Propagar al view interno PRIMERO (maneja el submit y setea sus campos);
    // luego sobreescribimos abajo con nuestros valores limpios.
    if (premiumView && premiumView.selectConsulta) {
      premiumView.selectConsulta(c);
    }

    // Actualizar highlights en cards
    var grid = $('prem-cards-grid');
    if (grid) {
      grid.querySelectorAll('.prem-card').forEach(function(card) {
        card.classList.toggle('selected', String(card.dataset.id) === String(c.id));
      });
    }

    // Mostrar panel de formulario
    var panel = $('prem-form-panel');
    if (panel) panel.hidden = false;

    var nameEl = $('prem-form-name');
    if (nameEl) nameEl.textContent = c.nombre;

    var descEl = $('premium-desc');
    if (descEl) descEl.textContent = c.descripcion || '';

    var credEl = $('premium-credits');
    if (credEl) {
      credEl.textContent = (!c.precio_venta || c.precio_venta === 0)
        ? 'GRATIS'
        : c.precio_venta + (c.precio_venta === 1 ? ' crédito' : ' créditos');
    }

    var emptyCredEl = $('premium-empty-credits');
    if (emptyCredEl) {
      emptyCredEl.textContent = (!c.precio_venta || c.precio_venta === 0)
        ? 'Esta consulta es gratuita.'
        : 'Esta consulta requiere ' + c.precio_venta + (c.precio_venta === 1 ? ' crédito' : ' créditos') + '.';
    }

    // Alternar entre entrada de texto y dropzone de foto
    var isFoto = c.tipo_dato === 'foto';
    var textRow   = $('prem-text-row');
    var photoBlk  = $('prem-photo-block');
    var consultBtn = $('premium-consultar');
    if (textRow)  textRow.hidden  = isFoto;
    if (photoBlk) photoBlk.hidden = !isFoto;

    if (isFoto) {
      // En modo foto el botón arranca deshabilitado hasta que se suba imagen
      if (consultBtn) consultBtn.disabled = true;
    } else {
      // En modo texto el botón siempre está habilitado
      if (consultBtn) consultBtn.disabled = false;
      var input = $('premium-input');
      if (input) {
        input.value = '';
        var ph = { dni:'Ingresa el DNI', telefono:'Ingresa el número', placa:'Ingresa la placa', ruc:'Ingresa el RUC', texto:'Ingresa el texto' };
        input.placeholder = ph[c.tipo_dato] || 'Ingresa el dato';
        input.focus();
      }
    }

    // Scroll al formulario
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Ocultar panel de resultado hasta que llegue respuesta
    var rp = $('prem-result-panel');
    if (rp) rp.hidden = true;
  }

  // ── Ocultar form / resultado ─────────────────────────────
  function hideForm() {
    var p = $('prem-form-panel');
    if (p) p.hidden = true;
    var grid = $('prem-cards-grid');
    if (grid) grid.querySelectorAll('.prem-card').forEach(function(c) { c.classList.remove('selected'); });
    activeConsulta = null;
  }

  function hideResult() {
    var rp = $('prem-result-panel');
    if (rp) rp.hidden = true;
    var rb = $('premium-result-body');
    if (rb) { rb.hidden = true; rb.innerHTML = ''; }
    var empty = $('premium-empty');
    if (empty) empty.hidden = false;
    var chip = $('premiumResultStatus');
    if (chip) { chip.className = 'status-chip status-empty'; chip.querySelector('.status-dot') && (chip.innerHTML = '<span class="status-dot"></span>Esperando consulta'); }
  }

  // ── Init ─────────────────────────────────────────────────
  var premiumView = null;

  Consultia.initPremiumCombo = async function () {
    // Crear view interno (maneja submit/resultado, usa IDs del HTML)
    premiumView = Consultia.createCategoryView({
      prefix: 'premium',
      categoria: 'premium',
    });
    premiumView.init();

    // Gate en botón Consultar
    var btn = $('premium-consultar');
    if (btn && !btn.dataset.premiumGate) {
      btn.dataset.premiumGate = '1';
      btn.addEventListener('click', function(e) {
        if (!hasPremiumAccess()) { e.stopImmediatePropagation(); e.preventDefault(); showGateModal(); }
      }, true);
    }
    var inp = $('premium-input');
    if (inp && !inp.dataset.premiumGate) {
      inp.dataset.premiumGate = '1';
      inp.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !hasPremiumAccess()) { e.stopImmediatePropagation(); e.preventDefault(); showGateModal(); }
      }, true);
    }

    // Botón cerrar formulario
    var closeBtn = $('prem-form-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        hideForm();
        hideResult();
      });
    }

    // Cargar catálogo y construir UI
    try {
      catalog = await Consultia.ConsultaRunner.loadCatalog('premium');
      groups   = Object.create(null);
      catOrder = [];
      catalog.forEach(function(c) {
        var g = c.subcategoria || 'OTROS';
        if (!groups[g]) { groups[g] = []; catOrder.push(g); }
        groups[g].push(c);
      });
      renderSidebar();

      // Popular stats del header
      var stats = $('prem-header-stats');
      var sn = $('prem-stat-services');
      var sc = $('prem-stat-cats');
      if (sn) sn.textContent = catalog.length;
      if (sc) sc.textContent = catOrder.length;
      if (stats) stats.hidden = false;

      if (catOrder.length > 0) setActiveCategory(catOrder[0]);
    } catch (err) {
      console.error('[premium] error cargando catálogo:', err);
      var inner = $('prem-sidebar-inner');
      if (inner) inner.innerHTML = '<div class="prem-sidebar-error">Error cargando servicios.</div>';
    }
  };
})();
