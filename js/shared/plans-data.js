/* ============================================================
   PLANS DATA — fuente única de planes (admin + landing)
   Los seeds se usan cuando admin todavía no guardó nada en
   localStorage. Si admin ya modificó precios/activos, los
   cambios se reflejan automáticamente en la landing.

   IMPORTANTE: estos valores DEBEN coincidir 1:1 con
   `supabase/functions/_shared/plans.ts`. Si modificas precios o
   créditos acá, actualiza también el archivo TypeScript y
   redespliega las edge functions `crear-preferencia` y
   `webhook-mercadopago`. Cualquier divergencia resulta en cobros
   incorrectos.
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  var STORAGE_KEY = 'consultia_admin_store_v5';

  // Sincronizado con supabase/functions/_shared/plans.ts (CREDIT_PLANS).
  // `effective` = credits + bonus = cantidad real acreditada al pagar.
  var CREDIT_PLANS_SEED = [
    { id: 'cp-prof-1', tier: 'profesional', credits: 150,  bonus: 50,  price: 15,  active: true },
    { id: 'cp-prof-2', tier: 'profesional', credits: 350,  bonus: 70,  price: 25,  active: true },
    { id: 'cp-prof-3', tier: 'profesional', credits: 550,  bonus: 150, price: 45,  active: true },
    { id: 'cp-biz-1',  tier: 'business',    credits: 1500, bonus: 300, price: 90,  active: true },
    { id: 'cp-biz-2',  tier: 'business',    credits: 3500, bonus: 500, price: 150, active: true },
    { id: 'cp-biz-3',  tier: 'business',    credits: 8500, bonus: 500, price: 300, active: true }
  ];

  // Sincronizado con supabase/functions/_shared/plans.ts (SUBSCRIPTION_PLANS).
  var SUBSCRIPTION_PLANS_SEED = [
    { id: 'sp-prof-7',  tier: 'profesional',      days: 7,  price: 30,  active: true },
    { id: 'sp-prof-15', tier: 'profesional',      days: 15, price: 50,  active: true },
    { id: 'sp-pp-30',   tier: 'profesional_plus', days: 30, price: 100, active: true },
    { id: 'sp-pp-60',   tier: 'profesional_plus', days: 60, price: 150, active: true },
    { id: 'sp-biz-90',  tier: 'business',         days: 90, price: 250, active: true }
  ];

  var TIER_LABELS = {
    profesional:      'Profesional',
    profesional_plus: 'Profesional Plus',
    business:         'Business'
  };

  // Lee el store del admin si existe. Permite que la landing vea
  // las ediciones de precios hechas desde el panel administrativo.
  function isValidPlan(p) {
    return p && typeof p.id === 'string' && typeof p.price === 'number' && p.price >= 0
      && typeof p.active === 'boolean';
  }

  function readAdminStore() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object') return null;
      // Validate structure to prevent tampered localStorage from corrupting UI
      if (obj.credit_plans && !Array.isArray(obj.credit_plans)) return null;
      if (obj.subscription_plans && !Array.isArray(obj.subscription_plans)) return null;
      if (obj.credit_plans && !obj.credit_plans.every(isValidPlan)) return null;
      if (obj.subscription_plans && !obj.subscription_plans.every(isValidPlan)) return null;
      return obj;
    } catch (e) {
      return null;
    }
  }

  Consultia.Plans = {
    STORAGE_KEY: STORAGE_KEY,
    CREDIT_PLANS_SEED: CREDIT_PLANS_SEED,
    SUBSCRIPTION_PLANS_SEED: SUBSCRIPTION_PLANS_SEED,
    TIER_LABELS: TIER_LABELS,

    tierLabel: function (tier) { return TIER_LABELS[tier] || tier; },

    getActiveCreditPlans: function () {
      var s = readAdminStore();
      var plans = (s && s.credit_plans) ? s.credit_plans : CREDIT_PLANS_SEED;
      return plans.filter(function (p) { return p.active; });
    },

    getActiveSubscriptionPlans: function () {
      var s = readAdminStore();
      var plans = (s && s.subscription_plans) ? s.subscription_plans : SUBSCRIPTION_PLANS_SEED;
      return plans.filter(function (p) { return p.active; });
    }
  };
})();
