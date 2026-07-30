/* ============================================================
   RIGHT PANEL — panel de resumen lateral en desktop
   Se actualiza con los datos del usuario al iniciar sesión
   y cada vez que cambian las estadísticas del dashboard.
============================================================ */
(function () {
  window.Consultia = window.Consultia || {};

  function $(id) { return document.getElementById(id); }

  function setText(id, val) {
    var el = $(id);
    if (el) el.textContent = val;
  }

  function initials(name) {
    if (!name) return '?';
    var parts = String(name).trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }

  // Renderiza el gauge del panel usando la misma función global
  function renderRpGauge(percent) {
    var svg = $('rp-gauge-svg');
    if (!svg) return;
    svg.dataset.percent = String(percent || 0);
    if (window.Consultia && Consultia.renderGauge) Consultia.renderGauge(svg);
    var pctEl = $('rp-gauge-pct');
    if (pctEl) pctEl.textContent = Math.round(percent || 0) + '%';
  }

  // Rellena el panel con los datos del usuario y perfil
  function update(user, profile) {
    if (!user || !profile) {
      var panel = $('right-panel');
      if (panel) panel.style.display = 'none';
      return;
    }

    var panel = $('right-panel');
    if (panel) panel.style.removeProperty('display');

    var name = (profile.full_name) || (user.email ? user.email.split('@')[0] : 'Usuario');
    var credits = Math.floor(parseFloat(profile.credits_balance) || 0);
    var ini = initials(name);

    // Avatar
    var avatarEl = $('rp-avatar');
    if (avatarEl) avatarEl.textContent = ini;

    // Nombre
    setText('rp-username', name);

    // Plan — misma lógica de inferencia que auth-ui.js:
    var subTier = (profile.subscription_tier || '').toLowerCase();
    var subExp  = profile.subscription_expires_at;
    var subActive = subTier && subExp && (new Date(subExp).getTime() > Date.now());
    var effectiveTier;
    if (subActive) {
      effectiveTier = subTier;
    } else if (credits > 5 || profile.has_paid_credits) {
      effectiveTier = (credits >= 1500) ? 'business' : 'profesional';
    } else {
      effectiveTier = 'free';
    }
    var planLabels = {
      'free': 'Plan Free', 'basic': 'Plan Básico',
      'profesional': 'Profesional', 'profesional_plus': 'Profesional Plus',
      'business': 'Business',
    };
    setText('rp-plan', planLabels[effectiveTier] || effectiveTier);

    // Créditos
    setText('rp-credits', credits.toLocaleString('es-PE'));

    // Vencimiento de plan
    renderExpiry(profile);

    // Última consulta
    renderLastQuery();
  }

  // ── Vencimiento de plan ──
  function renderExpiry(profile) {
    var wrap = $('rp-expiry');
    if (!wrap) return;
    var sub = Consultia.Subscription;
    var expDate = sub && sub.expiresAt ? sub.expiresAt() : null;
    if (!sub || !sub.isActiveSync || !sub.isActiveSync() || !expDate || isNaN(expDate.getTime())) {
      wrap.hidden = true;
      return;
    }
    var days = sub.daysLeft();
    // Calcular barra de progreso (asumimos plan de 30 días como base)
    var totalDays = 30;
    if (profile.subscription_started_at) {
      var started = new Date(profile.subscription_started_at).getTime();
      var expires = expDate.getTime();
      totalDays = Math.max(1, Math.round((expires - started) / 86400000));
    }
    var pct = Math.max(0, Math.min(100, (days / totalDays) * 100));

    var fill = $('rp-expiry-fill');
    var text = $('rp-expiry-text');
    if (fill) {
      fill.style.width = pct + '%';
      fill.className = 'rp-expiry-fill' + (days <= 3 ? ' is-danger' : days <= 7 ? ' is-warning' : '');
    }
    if (text) {
      var dateStr = expDate.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
      text.textContent = days <= 0
        ? 'Tu plan ha vencido'
        : days === 1
          ? 'Vence mañana (' + dateStr + ')'
          : 'Vence en ' + days + ' días (' + dateStr + ')';
      text.className = 'rp-expiry-text' + (days <= 3 ? ' is-danger' : days <= 7 ? ' is-warning' : '');
    }
    wrap.hidden = false;
  }

  // ── Última consulta ──
  function renderLastQuery() {
    var card = $('rp-last-query');
    if (!card) return;
    var history = Consultia.SearchHistory && Consultia.SearchHistory.getAll ? Consultia.SearchHistory.getAll() : [];
    if (!history.length) { card.hidden = true; return; }
    var last = history[0];
    setText('rp-lq-value', last.q);

    var catLabels = {
      'filter': 'Consultar Placa', 'reniec': 'Reniec', 'vehiculos': 'Vehículos',
      'sunarp': 'Sunarp', 'sunat': 'Sunat', 'financiero': 'Financiero',
      'estudios': 'Estudios', 'telefonia': 'Telefonía', 'familiares': 'Familia',
      'certificados': 'Certificados', 'actas': 'Actas', 'delitos': 'Justicia',
      'mtc': 'MTC', 'seeker': 'Seeker', 'vip': 'VIP', 'facial': 'Facial',
      'migraciones': 'Internacional', 'extras': 'Extras', 'premium': 'Premium'
    };
    setText('rp-lq-cat', catLabels[last.cat] || last.cat || 'Consulta');

    // Tiempo relativo
    if (last.ts) {
      var diff = Math.floor((Date.now() - last.ts) / 1000);
      var timeStr;
      if (diff < 60) timeStr = 'Hace un momento';
      else if (diff < 3600) timeStr = 'Hace ' + Math.floor(diff / 60) + ' min';
      else if (diff < 86400) timeStr = 'Hace ' + Math.floor(diff / 3600) + ' h';
      else timeStr = 'Hace ' + Math.floor(diff / 86400) + ' días';
      setText('rp-lq-time', timeStr);
    }
    card.hidden = false;
  }

  // Repetir última consulta
  function bindRepeatButton() {
    var btn = $('rp-lq-repeat');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var history = Consultia.SearchHistory && Consultia.SearchHistory.getAll ? Consultia.SearchHistory.getAll() : [];
      if (!history.length) return;
      var last = history[0];
      var cat = last.cat || 'filter';
      // Navegar a la categoría
      var navBtn = document.querySelector('.nav-item[data-nav="' + cat + '"]');
      if (navBtn) navBtn.click();
      // Llenar el input después de un tick
      setTimeout(function () {
        var input = document.querySelector('#' + cat + '-input') || document.querySelector('#filter-input');
        if (input) {
          input.value = last.q;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.focus();
        }
      }, 150);
    });
  }

  // Actualiza las estadísticas del panel cuando el dashboard las calcula
  function updateStats(stats) {
    if (!stats) return;
    setText('rp-stat-today', stats.consultasHoy);
    setText('rp-stat-month', stats.consultasMes);
    setText('rp-stat-year',  stats.consultasAnio);
    // Actualizar gauge con el % de consumo
    if (typeof stats.percent !== 'undefined') {
      renderRpGauge(stats.percentRaw || stats.percent);
    }
  }

  // Navegación desde los botones de acceso rápido y historial
  // Bug fix #6: el querySelector genérico '[data-nav="X"]' podía encontrar
  // el propio botón y causar un bucle infinito de auto-clicks.
  // Se busca explícitamente en sidebar/dropdown, excluyendo el right-panel.
  function bindQuickButtons() {
    document.querySelectorAll('.rp-quick-btn[data-nav], .rp-hist-btn[data-nav], .rp-buy-btn[data-nav]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var nav = btn.dataset.nav;
        // Primero intentar sidebar nav-item
        var navTarget = document.querySelector('.nav-item[data-nav="' + nav + '"]');
        // Fallback: dropdown-item (Mi saldo, Mi cuenta, etc.)
        if (!navTarget) navTarget = document.querySelector('.dropdown-item[data-nav="' + nav + '"]');
        if (navTarget) navTarget.click();
      });
    });
  }

  // Escucha cambios de auth para actualizar
  function init() {
    bindQuickButtons();
    bindRepeatButton();

    // Si ya hay sesión activa al cargar, obtener perfil + stats
    if (Consultia.Auth && Consultia.Auth.getUser) {
      Consultia.Auth.getUser().then(function (user) {
        if (!user) return;
        if (Consultia.Auth.getProfile) {
          Consultia.Auth.getProfile(user).then(function (profile) {
            update(user, profile);
            // Cargar estadísticas en segundo plano
            if (Consultia.loadDashboardStats) {
              Consultia.loadDashboardStats().then(function (stats) {
                updateStats(stats);
              }).catch(function () {});
            }
          });
        }
      });
    }

    // Escuchar cambios de sesión
    if (Consultia.Auth && Consultia.Auth.onAuthChange) {
      Consultia.Auth.onAuthChange(function (user, profile) {
        update(user, profile);
        if (user && Consultia.loadDashboardStats) {
          Consultia.loadDashboardStats().then(function (stats) {
            updateStats(stats);
          }).catch(function () {});
        }
      });
    }
  }

  // Exponemos para que auth-ui.js lo llame tras login/refresh
  Consultia.RightPanel = {
    init: init,
    update: update,
    updateStats: updateStats,
  };
})();
