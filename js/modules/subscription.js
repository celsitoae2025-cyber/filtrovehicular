/* ============================================================
   SUBSCRIPTION — caché del estado de la suscripción del usuario.
   Refresca al iniciar sesión y al ejecutar consultas.

   Expone:
     Consultia.Subscription.isActiveSync()  // boolean (cache local)
     Consultia.Subscription.refresh()       // re-lee del perfil
     Consultia.Subscription.tier()          // 'profesional' | 'profesional_plus' | 'business' | null
     Consultia.Subscription.expiresAt()     // Date o null
     Consultia.Subscription.daysLeft()      // entero >= 0
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  var state = {
    tier: null,
    expiresAt: null, // Date | null
    planId: null,
    isLegacyPremium: false
  };

  function setFromProfile(profile) {
    if (!profile) {
      state.tier = null;
      state.expiresAt = null;
      state.planId = null;
      state.isLegacyPremium = false;
      return;
    }
    state.tier = profile.subscription_tier || null;
    state.planId = profile.subscription_plan_id || null;
    state.expiresAt = profile.subscription_expires_at
      ? new Date(profile.subscription_expires_at)
      : null;

    var subActive = state.tier && state.expiresAt && !isNaN(state.expiresAt.getTime()) && (state.expiresAt.getTime() > Date.now());
    if (!subActive) {
      var credits = profile.credits_balance || 0;
      var hasPaidCredits = profile.has_paid_credits;
      // Legacy premium: usuarios con créditos comprados (no de referral).
      // business = 1500+ créditos (equivalente a ~3+ meses de plan Profesional Plus).
      // profesional = 6+ créditos (mínimo para acceso premium).
      if (credits > 5 || hasPaidCredits) {
        state.isLegacyPremium = true;
        state.tier = (credits >= 1500) ? 'business' : 'profesional';
      } else {
        state.isLegacyPremium = false;
      }
    } else {
      state.isLegacyPremium = false;
    }
  }

  async function refresh() {
    if (!Consultia.Auth || !Consultia.Auth.getProfile) return;
    try {
      var profile = await Consultia.Auth.getProfile(true); // forzar refresh si soporta el flag
      setFromProfile(profile);
    } catch (e) {
      console.warn('[subscription] no se pudo refrescar:', e);
    }
  }

  function isActiveSync() {
    if (state.isLegacyPremium) return true;
    if (!state.expiresAt || isNaN(state.expiresAt.getTime())) return false;
    return state.expiresAt.getTime() > Date.now();
  }

  function daysLeft() {
    if (!isActiveSync()) return 0;
    if (!state.expiresAt || isNaN(state.expiresAt.getTime())) return 0;
    var ms = state.expiresAt.getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / 86400000));
  }

  Consultia.Subscription = {
    setFromProfile: setFromProfile,
    refresh: refresh,
    isActiveSync: isActiveSync,
    tier: function () { return state.tier; },
    expiresAt: function () { return state.expiresAt; },
    planId: function () { return state.planId; },
    daysLeft: daysLeft,
  };
})();
