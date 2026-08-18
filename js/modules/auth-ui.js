/* ============================================================
   AUTH UI — sincroniza toda la interfaz con el estado de sesión
   - Sin sesión: muestra botones de login, oculta datos personales,
     gatea vistas privadas (al intentar entrar, abre login modal).
   - Con sesión: popula todos los campos con datos reales.
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  // Vistas que requieren estar logueado para acceder
  var PRIVATE_VIEWS = ['cuenta', 'saldo', 'compras', 'historial', 'notificaciones'];

  // Candado para las categorías de consultas cuando no hay sesión
  var LOCK_SVG = '<svg class="nav-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';

  var cachedProfile = null;
  var cachedUser = null;

  // Caché de UI en localStorage para mostrar el avatar al instante en la
  // próxima carga de la página (evita el flicker "Iniciar sesión" â†’ avatar).
  var UI_CACHE_KEY = 'consultia_auth_ui_cache';

  function saveUICache(name, email, ini, credits) {
    try {
      localStorage.setItem(UI_CACHE_KEY, JSON.stringify({
        name: name, email: email, ini: ini, credits: credits || 0
      }));
    } catch (_) {}
  }

  function clearUICache() {
    try { localStorage.removeItem(UI_CACHE_KEY); } catch (_) {}
  }

  function applyUICache() {
    try {
      var raw = localStorage.getItem(UI_CACHE_KEY);
      if (!raw) return false;
      var c = JSON.parse(raw);
      if (!c || !c.email) return false;
      // Pinta optimistamente el topbar/dropdown con los datos cacheados
      document.body.classList.remove('is-anonymous');
      document.body.classList.add('is-logged-in');
      var authBtns = document.getElementById('authButtons');
      var userMenu = document.querySelector('.user-menu');
      if (authBtns) authBtns.hidden = true;
      if (userMenu) userMenu.hidden = false;
      setText('userMenuName', c.name || '');
      setText('userMenuAvatar', c.ini || '—');
      setText('userDropdownAvatar', c.ini || '—');
      setText('userDropdownName', c.name || '');
      setText('userDropdownEmail', c.email);
      setText('userDropdownCredits', (c.credits || 0) + ' créditos');
      return true;
    } catch (e) { console.warn('[auth-ui] cache corrupto:', e); return false; }
  }

  function initials(name) {
    if (!name) return '—';
    var parts = String(name).trim().split(/\s+/);
    var a = parts[0] ? parts[0][0] : '';
    var b = parts[1] ? parts[1][0] : '';
    return ((a + b) || name[0]).toUpperCase();
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function setValue(id, value) {
    var el = document.getElementById(id);
    if (el) el.value = value || '';
  }

  // ==========================================================
  // Estado: sin sesión
  // ==========================================================
  function showLoggedOut() {
    cachedProfile = null;
    cachedUser = null;
    clearUICache();
    // Invalidar cache de stats para que el próximo login pida datos frescos
    if (Consultia.invalidateStatsCache) Consultia.invalidateStatsCache();

    document.body.classList.add('is-anonymous');
    document.body.classList.remove('is-logged-in');
    injectSidebarLocks();

    var authBtns = document.getElementById('authButtons');
    var userMenu = document.querySelector('.user-menu');
    if (authBtns) authBtns.hidden = false;
    if (userMenu) userMenu.hidden = true;

    // Dashboard — saludo neutral
    setText('dashTitle', 'Bienvenido a Filtro Vehicular+');

    // Plan card — sin datos personales
    setText('planCardName', 'PLAN FREE');
    setText('planCardEmail', 'Inicia sesión para ver tu información');

    // Plan stats
    var planStatEls = document.querySelectorAll('.plan-stat strong');
    if (planStatEls[0]) planStatEls[0].textContent = '0';
    if (planStatEls[1]) planStatEls[1].textContent = '0';

    // Avatar del plan card
    var planAvatar = document.querySelector('.plan-avatar .avatar');
    if (planAvatar) planAvatar.textContent = '—';

    // Ring de créditos
    var creditsTotalEl = document.querySelector('.credits-total');
    if (creditsTotalEl) creditsTotalEl.textContent = '0';

    // Tarjeta del sidebar en estado anónimo
    setText('sbInfoCredits', '0');

    // Vista Mi saldo
    setText('saldoCreditsBig', '0');

    // Vista Mi cuenta — limpia
    setText('accountAvatar', '—');
    setValue('accountName', '');
    setValue('accountEmail', '');
    setValue('accountPhone', '');

    // Admin link — oculto siempre
    var adminLink = document.getElementById('adminPanelLink');
    var adminDivider = document.getElementById('adminPanelDivider');
    var sidebarAdminLink = document.getElementById('sidebarAdminLink');
    if (adminLink) adminLink.hidden = true;
    if (adminDivider) adminDivider.hidden = true;
    if (sidebarAdminLink) sidebarAdminLink.hidden = true;
  }

  // ==========================================================
  // Estado: logueado
  // ==========================================================
  function showLoggedIn(user, profile) {
    cachedUser = user;
    cachedProfile = profile;

    document.body.classList.remove('is-anonymous');
    document.body.classList.add('is-logged-in');

    var authBtns = document.getElementById('authButtons');
    var userMenu = document.querySelector('.user-menu');
    if (authBtns) authBtns.hidden = true;
    if (userMenu) userMenu.hidden = false;

    var name = (profile && profile.full_name) || (user.email ? user.email.split('@')[0] : 'Usuario');
    var email = user.email;
    var phone = (profile && profile.phone) || '';
    var credits = (profile && profile.credits_balance) || 0;
    var ini = initials(name);
    var firstName = name.split(' ')[0];

    // Cachear estado para el próximo refresh (evita flicker del avatar)
    saveUICache(name, email, ini, credits);

    // Topbar
    setText('userMenuName', name);
    setText('userMenuAvatar', ini);
    setText('userDropdownAvatar', ini);
    setText('userDropdownName', name);
    setText('userDropdownEmail', email);
    setText('userDropdownCredits', credits + ' créditos');

    // Tarjeta del sidebar: saldo + plan
    setText('sbInfoCredits', credits.toLocaleString('es-PE'));

    // Dashboard
    setText('dashTitle', 'Bienvenido, ' + firstName);

    // Sincronizar caché global de suscripción
    if (Consultia.Subscription) Consultia.Subscription.setFromProfile(profile);

    // Actualizar panel lateral derecho
    if (Consultia.RightPanel) Consultia.RightPanel.update(user, profile);

    // Plan card del dashboard — refleja la suscripción activa si existe
    var TIER_LABELS = { profesional: 'PROFESIONAL', profesional_plus: 'PROFESIONAL PLUS', business: 'BUSINESS' };
    var subTier = profile && profile.subscription_tier;
    var subExp = profile && profile.subscription_expires_at;
    var subExpTime = subExp ? new Date(subExp).getTime() : NaN;
    var subActive = subTier && subExp && !isNaN(subExpTime) && (subExpTime > Date.now());
    var subStatusEl = document.getElementById('planCardSubStatus');
    if (subActive) {
      var planCardNameEl = document.getElementById('planCardName');
      var baseName = (TIER_LABELS[subTier] || subTier.toUpperCase());
      if (planCardNameEl) planCardNameEl.textContent = baseName;

      // El badge del sidebar usa ícono SVG fijo — no sobreescribir

      if (subStatusEl) {
        var expDate = new Date(subExp);
        var msLeft = expDate.getTime() - Date.now();
        var daysLeft = Math.ceil(msLeft / 86400000);
        var hoursLeft = Math.ceil(msLeft / 3600000);
        var fmtVence = expDate.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
        var label;
        if (daysLeft > 1) {
          label = 'Vigente · ' + daysLeft + ' días restantes';
        } else if (daysLeft === 1) {
          label = 'Vigente · vence mañana';
        } else if (hoursLeft > 1) {
          label = 'Vigente · vence en ' + hoursLeft + ' horas';
        } else {
          label = 'Vigente · vence hoy';
        }
        subStatusEl.innerHTML = '<span class="plan-sub-dot"></span>' + label + ' (' + fmtVence + ')';
        subStatusEl.hidden = false;
      }
    } else {
      var activeTier = null;
      var hasPaidCredits = profile && profile.has_paid_credits;
      if (credits > 5 || hasPaidCredits) {
        activeTier = (credits >= 1500) ? 'business' : 'profesional';
      }

      var planCardNameEl = document.getElementById('planCardName');
      if (activeTier) {
        var baseName = (TIER_LABELS[activeTier] || activeTier.toUpperCase());
        if (planCardNameEl) planCardNameEl.textContent = baseName;
        } else {
        setText('planCardName', 'FREE');
      }

      // El badge del sidebar usa ícono SVG fijo — no sobreescribir
      if (subStatusEl) {
        subStatusEl.hidden = true;
        subStatusEl.innerHTML = '';
      }
    }
    setText('planCardEmail', email);

    var planStatEls = document.querySelectorAll('.plan-stat strong');
    if (planStatEls[0]) planStatEls[0].textContent = String(credits);
    // planStatEls[1] es "consultas realizadas" — lo dejamos en 0 hasta conectar módulos

    var planAvatar = document.querySelector('.plan-avatar .avatar');
    if (planAvatar) planAvatar.textContent = ini;

    // Ring de créditos — con animación de conteo si está disponible
    var creditsTotalEl = document.querySelector('.credits-total');
    if (creditsTotalEl) {
      if (Consultia.animateCredits) Consultia.animateCredits(creditsTotalEl, credits);
      else creditsTotalEl.textContent = String(credits);
    }

    // Porcentaje de consumo y stats de período (se cargan de transactions)
    if (Consultia.renderDashboardStats) {
      Consultia.renderDashboardStats();
    }

    // Vista Mi saldo (número grande)
    setText('saldoCreditsBig', String(credits));

    // Vista Mi cuenta
    setText('accountAvatar', ini);
    setValue('accountName', name);
    setValue('accountEmail', email);
    setValue('accountPhone', phone);

    // Admin link — solo si is_admin = true
    var isAdmin = !!(profile && profile.is_admin);
    var adminLink = document.getElementById('adminPanelLink');
    var adminDivider = document.getElementById('adminPanelDivider');
    var sidebarAdminLink = document.getElementById('sidebarAdminLink');
    if (adminLink) adminLink.hidden = !isAdmin;
    if (adminDivider) adminDivider.hidden = !isAdmin;
    if (sidebarAdminLink) sidebarAdminLink.hidden = true; // siempre oculto en sidebar

    // Panel de socio — solo si is_socio = true. Es otro panel y otra
    // cuenta de resultados: un socio no es administrador, y un
    // administrador no ve esto salvo que además sea socio.
    var socioLink = document.getElementById('socioPanelLink');
    if (socioLink) socioLink.hidden = !(profile && profile.is_socio);
  }

  async function refresh() {
    try {
      if (Consultia.Auth.enforceRememberMe) {
        await Consultia.Auth.enforceRememberMe();
      }
      var sessionRes = Consultia.Auth.getSession ? await Consultia.Auth.getSession() : null;
      var sessionUser = sessionRes && sessionRes.data && sessionRes.data.session && sessionRes.data.session.user;
      if (!sessionUser) { showLoggedOut(); dismissLoader(); return; }
      var userPromise = Consultia.Auth.getUser();
      var profilePromise = Consultia.Auth.getProfile(sessionUser);
      var results = await Promise.all([userPromise, profilePromise]);
      var user = results[0];
      var profile = results[1];
      if (!user) { showLoggedOut(); dismissLoader(); return; }
      showLoggedIn(user, profile);
    } catch (e) {
      console.error('[auth-ui] refresh error:', e);
      showLoggedOut();
    } finally {
      dismissLoader();
    }
  }

  function dismissLoader() {
    var el = document.getElementById('appLoader');
    if (!el) return;
    el.addEventListener('transitionend', function () { el.remove(); });
    el.classList.add('ld-hide');
  }

  // ==========================================================
  // Gateo de vistas privadas
  // Intercepta clicks a data-nav que apunten a vistas privadas
  // y si no hay sesión, abre el modal de login.
  // ==========================================================
  function gatePrivateViews() {
    document.addEventListener('click', function (e) {
      var navBtn = e.target.closest('[data-nav]');
      if (!navBtn) return;
      var target = navBtn.dataset.nav;
      if (PRIVATE_VIEWS.indexOf(target) === -1) return;

      if (!cachedUser) {
        e.preventDefault();
        e.stopPropagation();
        if (Consultia.AuthModals) Consultia.AuthModals.openLogin();
        if (Consultia.toast) Consultia.toast({
          type: 'info',
          title: 'Inicia sesión',
          message: 'Necesitas una cuenta para acceder a esta sección.',
        });
      }
    }, true); // capture = true para atrapar antes del handler de views.js
  }

  // ==========================================================
  // Antes había un gate que bloqueaba la navegación de los anónimos
  // a las categorías. Ahora permitimos que las previsualicen y solo
  // gateamos al pulsar "Consultar" (en category-view.js / filter.js).
  // Mantengo las funciones como no-ops para no romper init.
  // ==========================================================
  function injectSidebarLocks() {
    // Limpiar cualquier candado previo si quedó del flujo anterior
    document.querySelectorAll('.nav-item.nav-category .nav-lock').forEach(function (el) {
      el.parentNode && el.parentNode.removeChild(el);
    });
  }

  function gateSidebarCategories() { /* no-op: anónimos pueden previsualizar */ }

  function bind() {
    // Botones login/registro del topbar
    document.addEventListener('click', async function (e) {
      var openBtn = e.target.closest('[data-auth-open]');
      if (openBtn) {
        var target = openBtn.dataset.authOpen;
        if (target === 'login' && Consultia.AuthModals) Consultia.AuthModals.openLogin();
        if (target === 'signup' && Consultia.AuthModals) Consultia.AuthModals.openSignup();
        return;
      }
      // Logout — confirmación con modal custom (no confirm() nativo)
      if (e.target.closest('#logoutBtn')) {
        var ok = Consultia.confirm
          ? await Consultia.confirm({
              title: '¿Está seguro que desea salir?',
              message: 'Tendrás que iniciar sesión de nuevo para acceder a tu cuenta.',
              confirmText: 'Cerrar sesión',
              cancelText: 'Cancelar',
              danger: true
            })
          : window.confirm('¿Cerrar sesión?');
        if (!ok) return;
        await Consultia.Auth.signOut();
        window.location.href = 'app.html';
      }
    });

    // Editar perfil — toggle entre modo lectura y edición
    var editSnapshot = null;
    function enterEditMode() {
      var nameEl  = document.getElementById('accountName');
      var phoneEl = document.getElementById('accountPhone');
      editSnapshot = { name: nameEl.value, phone: phoneEl.value };
      nameEl.readOnly = false;
      phoneEl.readOnly = false;
      nameEl.classList.add('is-editing');
      phoneEl.classList.add('is-editing');
      nameEl.focus();
      document.getElementById('accountEditBtn').hidden = true;
      document.getElementById('accountSaveBtn').hidden = false;
      document.getElementById('accountCancelBtn').hidden = false;
      var err = document.getElementById('accountError');
      if (err) { err.hidden = true; err.textContent = ''; }
    }
    function exitEditMode() {
      var nameEl  = document.getElementById('accountName');
      var phoneEl = document.getElementById('accountPhone');
      nameEl.readOnly = true;
      phoneEl.readOnly = true;
      nameEl.classList.remove('is-editing');
      phoneEl.classList.remove('is-editing');
      document.getElementById('accountEditBtn').hidden = false;
      document.getElementById('accountSaveBtn').hidden = true;
      document.getElementById('accountCancelBtn').hidden = true;
    }
    function cancelEdit() {
      if (editSnapshot) {
        document.getElementById('accountName').value  = editSnapshot.name;
        document.getElementById('accountPhone').value = editSnapshot.phone;
      }
      editSnapshot = null;
      exitEditMode();
    }
    async function saveEdit() {
      var nameEl  = document.getElementById('accountName');
      var phoneEl = document.getElementById('accountPhone');
      var saveBtn = document.getElementById('accountSaveBtn');
      var errEl   = document.getElementById('accountError');
      var name  = nameEl.value.trim();
      var phone = phoneEl.value.trim();

      if (!name) {
        errEl.textContent = 'El nombre no puede estar vacío.';
        errEl.hidden = false;
        return;
      }

      saveBtn.disabled = true;
      saveBtn.dataset.orig = saveBtn.dataset.orig || saveBtn.textContent;
      saveBtn.textContent = 'Guardando…';
      try {
        var res = await Consultia.Auth.updateProfile({ full_name: name, phone: phone });
        if (res && res.error) throw res.error;
        if (Consultia.toast) Consultia.toast({
          type: 'success', title: 'Perfil actualizado', message: 'Tus datos se guardaron.'
        });
        editSnapshot = null;
        exitEditMode();
        // Refresca cache + resto de la UI con los nuevos datos
        if (typeof refresh === 'function') await refresh();
      } catch (err) {
        console.error('[profile] error:', err);
        errEl.textContent = (err && err.message) || 'No se pudo guardar. Intenta de nuevo.';
        errEl.hidden = false;
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = saveBtn.dataset.orig || 'Guardar cambios';
      }
    }

    document.addEventListener('click', function (e) {
      if (e.target.closest('#accountEditBtn'))    enterEditMode();
      if (e.target.closest('#accountSaveBtn'))    saveEdit();
      if (e.target.closest('#accountCancelBtn'))  cancelEdit();
      if (e.target.closest('#accountPasswordBtn')) {
        if (Consultia.AuthModals) Consultia.AuthModals.openForgot();
      }
    });

    // Cambios de sesión
    Consultia.Auth.onAuthChange(function () { refresh(); });
  }

  Consultia.initAuthUI = function () {
    bind();
    gatePrivateViews();
    gateSidebarCategories();
    // Pinta el avatar al instante con el caché local (si lo hay) para evitar
    // el flicker entre "Iniciar sesión" â†’ avatar mientras Supabase responde.
    applyUICache();
    refresh();
  };

  // Expuesto para que módulos como consulta-runner puedan refrescar el
  // saldo del topbar tras una consulta sin tocar el flujo de auth.
  Consultia.AuthUI = {
    refresh: refresh,
  };
})();
