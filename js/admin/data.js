/* ============================================================
   ADMIN DATA — seed + store (localStorage)
   Expone Consultia.Admin con funciones para leer/escribir
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};
  window.Consultia.Admin = window.Consultia.Admin || {};
  var A = window.Consultia.Admin;

  var STORAGE_KEY = Consultia.Plans.STORAGE_KEY;

  // -------- SEED --------
  var SEED_USERS = [];

  // Las fuentes de verdad de planes y tier labels viven en
  // js/shared/plans-data.js para compartir entre admin y landing.
  var TIER_LABELS      = Consultia.Plans.TIER_LABELS;
  var CREDIT_PLANS     = Consultia.Plans.CREDIT_PLANS_SEED;
  var SUBSCRIPTION_PLANS = Consultia.Plans.SUBSCRIPTION_PLANS_SEED;

  var METODOS = ['yape', 'plin', 'visa', 'transferencia'];

  var SEED_COMPRAS = [];

  // Generar consultas de ejemplo (solo si hay usuarios semilla)
  function generateConsultas() {
    if (!SEED_USERS.length) return [];
    var MODULES = [
      { key: 'vehiculos',   types: ['TIVE', 'Licencia virtual', 'Historial vehicular', 'SOAT', 'Gravámenes', 'Propietarios'], cost: 5, inputType: 'placa' },
      { key: 'sunarp',      types: ['Partida registral', 'Propiedad por DNI', 'Placa datos'],                                 cost: 8, inputType: 'mixed' },
      { key: 'reniec',      types: ['Ficha RENIEC', 'Búsqueda por nombre', 'Ficha familiar'],                                 cost: 6, inputType: 'dni' },
      { key: 'sunat',       types: ['Ficha RUC', 'Representantes', 'Estado tributario'],                                      cost: 7, inputType: 'ruc' },
      { key: 'financiero',  types: ['Deudas SBS', 'Reporte crediticio', 'Infocorp'],                                         cost: 10, inputType: 'dni' },
      { key: 'facial',      types: ['Reconocimiento facial', 'Comparación'],                                                  cost: 12, inputType: 'imagen' },
      { key: 'telefonia',   types: ['Titular de número', 'Antenas cercanas'],                                                 cost: 6, inputType: 'telefono' },
      { key: 'familiares',  types: ['Ãrbol genealógico', 'Hijos', 'Cónyuge'],                                                 cost: 9, inputType: 'dni' },
      { key: 'certificados', types: ['Antecedentes penales', 'Antecedentes policiales', 'Judiciales'],                        cost: 8, inputType: 'dni' },
      { key: 'delitos',     types: ['Requisitorias', 'Sentencias'],                                                           cost: 7, inputType: 'dni' },
      { key: 'migraciones', types: ['Movimientos migratorios', 'Visa'],                                                       cost: 8, inputType: 'dni' },
      { key: 'estudios',    types: ['Grado académico', 'Constancia SUNEDU'],                                                  cost: 6, inputType: 'dni' }
    ];

    function randomInput(type) {
      if (type === 'placa') {
        var letters = 'ABCDEFGHJKLMNPRSTUVWXYZ';
        return letters[Math.floor(Math.random()*letters.length)] +
               letters[Math.floor(Math.random()*letters.length)] +
               letters[Math.floor(Math.random()*letters.length)] + '-' +
               String(Math.floor(Math.random()*900)+100);
      }
      if (type === 'dni')      return String(Math.floor(Math.random()*90000000)+10000000);
      if (type === 'ruc')      return '20' + String(Math.floor(Math.random()*900000000)+100000000);
      if (type === 'telefono') return '9' + String(Math.floor(Math.random()*90000000)+10000000);
      if (type === 'imagen')   return 'rostro_' + Math.floor(Math.random()*999) + '.jpg';
      if (type === 'mixed') {
        return Math.random() < 0.5 ? String(Math.floor(Math.random()*90000000)+10000000)
                                    : 'P' + String(Math.floor(Math.random()*90000000)+10000000);
      }
      return '-';
    }

    function randomUser() { return SEED_USERS[Math.floor(Math.random()*SEED_USERS.length)].id; }

    var out = [];
    var now = new Date('2026-04-21T12:00:00').getTime();
    for (var i = 0; i < 50; i++) {
      var m = MODULES[Math.floor(Math.random()*MODULES.length)];
      var type = m.types[Math.floor(Math.random()*m.types.length)];
      var ageMs = Math.floor(Math.random() * 1000*60*60*24*30); // últimos 30 días
      var created = new Date(now - ageMs).toISOString();
      var success = Math.random() > 0.08;
      out.push({
        id: 'q' + (i+1),
        user_id: randomUser(),
        module: m.key,
        type: type,
        input: randomInput(m.inputType),
        cost: m.cost,
        status: success ? 'success' : 'error',
        created_at: created
      });
    }
    return out.sort(function (a, b) { return b.created_at.localeCompare(a.created_at); });
  }

  // -------- ROLES --------
  var ROLES = {
    super_admin: { label: 'Super Admin', desc: 'Acceso total al sistema', color: '#8fc72e' },
    admin:       { label: 'Admin',       desc: 'Operación general',      color: '#141d1c' },
    soporte:     { label: 'Soporte',     desc: 'Atención y recargas',    color: '#141d1c' },
    developer:   { label: 'Developer',   desc: 'APIs y webhooks',        color: '#141d1c' },
    auditor:     { label: 'Auditor',     desc: 'Solo lectura',           color: '#141d1c' }
  };

  var PERMISSIONS = [
    { key: 'users',       label: 'Usuarios',              by_role: { super_admin: 'full', admin: 'full',  soporte: 'read', developer: 'read', auditor: 'read' } },
    { key: 'recargas',    label: 'Recargas de créditos',  by_role: { super_admin: 'full', admin: 'full',  soporte: 'full', developer: 'none', auditor: 'read' } },
    { key: 'compras',     label: 'Compras',               by_role: { super_admin: 'full', admin: 'read',  soporte: 'read', developer: 'none', auditor: 'read' } },
    { key: 'consultas',   label: 'Consultas',             by_role: { super_admin: 'full', admin: 'read',  soporte: 'read', developer: 'read', auditor: 'read' } },
    { key: 'mercadopago', label: 'Mercado Pago',          by_role: { super_admin: 'full', admin: 'read',  soporte: 'none', developer: 'full', auditor: 'read' } },
    { key: 'webhooks',    label: 'Webhooks',              by_role: { super_admin: 'full', admin: 'none',  soporte: 'none', developer: 'full', auditor: 'read' } },
    { key: 'team',        label: 'Equipo admin',          by_role: { super_admin: 'full', admin: 'read',  soporte: 'none', developer: 'none', auditor: 'read' } },
    { key: 'apikeys',     label: 'API Keys',              by_role: { super_admin: 'full', admin: 'none',  soporte: 'none', developer: 'full', auditor: 'read' } },
    { key: 'audit',       label: 'Auditoría',             by_role: { super_admin: 'full', admin: 'read',  soporte: 'none', developer: 'none', auditor: 'read' } },
    { key: 'settings',    label: 'Configuración',         by_role: { super_admin: 'full', admin: 'read',  soporte: 'none', developer: 'read', auditor: 'read' } }
  ];

  // -------- SEED: ADMINS (solo el Super Admin del login demo) --------
  var SEED_ADMINS = [
    { id: 'a1', email: 'admin@consultia.pe', name: 'Admin General', role: 'super_admin', status: 'active', two_fa: true, last_login: null, created_at: new Date().toISOString() }
  ];

  // -------- SEED: limpio --------
  var SEED_MP = [];
  var SEED_WEBHOOKS = [];
  var SEED_API_KEYS = [];
  var SEED_AUDIT = [];

  // -------- SEED: SETTINGS --------
  var DEFAULT_SETTINGS = {
    company_name: 'Plataforma Filtro Vehicular+',
    legal_name: 'Filtro Vehicular+ SAC',
    ruc: '20601234567',
    currency: 'PEN',
    igv_rate: 18,
    support_email: 'soporte@consultia.pe',
    country: 'PE',
    mp: {
      connected: true,
      mode: 'sandbox',
      public_key: 'TEST-a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      access_token_suffix: '8912',
      webhook_url: 'https://consultia.pe/api/webhooks/mercadopago'
    }
  };

  // -------- STORE --------
  function defaultStore() {
    return {
      users: SEED_USERS.map(function (u) { return Object.assign({}, u); }),
      credit_plans: CREDIT_PLANS.map(function (p) { return Object.assign({}, p); }),
      subscription_plans: SUBSCRIPTION_PLANS.map(function (p) { return Object.assign({}, p); }),
      tier_labels: TIER_LABELS,
      metodos: METODOS,
      compras: SEED_COMPRAS.map(function (c) { return Object.assign({}, c); }),
      consultas: generateConsultas(),
      recargas: [],
      added_users: [],
      admins: SEED_ADMINS.map(function (x) { return Object.assign({}, x); }),
      roles: ROLES,
      permissions: PERMISSIONS,
      mp_transactions: SEED_MP.map(function (x) { return Object.assign({}, x); }),
      webhooks: SEED_WEBHOOKS.map(function (x) { return Object.assign({}, x); }),
      api_keys: SEED_API_KEYS.map(function (x) { return Object.assign({}, x); }),
      audit: SEED_AUDIT.map(function (x) { return Object.assign({}, x); }),
      settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
    };
  }

  A.ROLES = ROLES;
  A.PERMISSIONS = PERMISSIONS;
  A.TIER_LABELS = TIER_LABELS;

  A.tierLabel = function (tier) { return TIER_LABELS[tier] || tier; };

  A.getActiveCreditPlans = function () {
    var s = A.getStore();
    return (s.credit_plans || []).filter(function (p) { return p.active; });
  };

  A.getActiveSubscriptionPlans = function () {
    var s = A.getStore();
    return (s.subscription_plans || []).filter(function (p) { return p.active; });
  };

  A.findCreditPlan = function (id) {
    var s = A.getStore();
    return (s.credit_plans || []).find(function (p) { return p.id === id; }) || null;
  };

  A.findSubscriptionPlan = function (id) {
    var s = A.getStore();
    return (s.subscription_plans || []).find(function (p) { return p.id === id; }) || null;
  };

  // Otorga o extiende una suscripción a un usuario.
  // Si ya tiene una activa, se extiende (expires_at += days).
  A.grantSubscription = function (userId, planId) {
    var u = A.findUser(userId);
    var plan = A.findSubscriptionPlan(planId);
    if (!u || !plan) return null;

    var now = new Date();
    var baseDate = now;
    if (u.active_subscription && u.active_subscription.expires_at) {
      var currentExp = new Date(u.active_subscription.expires_at);
      if (currentExp > now && u.active_subscription.tier === plan.tier) {
        baseDate = currentExp;
      }
    }
    var expires = new Date(baseDate.getTime() + plan.days * 86400000);

    u.active_subscription = {
      plan_id: plan.id,
      tier: plan.tier,
      days: plan.days,
      granted_at: now.toISOString(),
      expires_at: expires.toISOString()
    };
    return u.active_subscription;
  };

  A.daysUntilExpiration = function (sub) {
    if (!sub || !sub.expires_at) return 0;
    var now = new Date();
    var exp = new Date(sub.expires_at);
    return Math.max(0, Math.ceil((exp - now) / 86400000));
  };

  A.isSubscriptionActive = function (sub) {
    if (!sub || !sub.expires_at) return false;
    return new Date(sub.expires_at) > new Date();
  };

  A.load = function () {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    var fresh = defaultStore();
    A.save(fresh);
    return fresh;
  };

  A.save = function (store) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch (e) {}
  };

  A.reset = function () {
    localStorage.removeItem(STORAGE_KEY);
    return A.load();
  };

  A.getStore = function () {
    if (!A._store) A._store = A.load();
    return A._store;
  };

  A.persist = function () {
    if (A._store) A.save(A._store);
  };

  // -------- HELPERS --------
  A.findUserByEmail = function (email) {
    if (!email) return null;
    var s = A.getStore();
    var e = email.trim().toLowerCase();
    return s.users.find(function (u) { return u.email.toLowerCase() === e; }) || null;
  };

  A.findUser = function (id) {
    var s = A.getStore();
    return s.users.find(function (u) { return u.id === id; }) || null;
  };

  A.userInitials = function (name) {
    if (!name) return '??';
    var parts = name.trim().split(/\s+/);
    return ((parts[0][0] || '') + (parts[1] ? parts[1][0] : '')).toUpperCase();
  };

  A.fmtDate = function (iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d)) return '—';
    var dd = String(d.getDate()).padStart(2,'0');
    var mm = String(d.getMonth()+1).padStart(2,'0');
    var yy = d.getFullYear();
    var hh = String(d.getHours()).padStart(2,'0');
    var mi = String(d.getMinutes()).padStart(2,'0');
    return dd+'/'+mm+'/'+yy+' '+hh+':'+mi;
  };

  A.fmtDateShort = function (iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d)) return '—';
    return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear();
  };

  A.fmtMoney = function (n) {
    return 'S/ ' + (Number(n) || 0).toFixed(2);
  };

  A.relativeTime = function (iso) {
    if (!iso) return '—';
    var now = Date.now();
    var t = new Date(iso).getTime();
    var diff = Math.max(0, now - t);
    var m = Math.floor(diff/60000);
    if (m < 1) return 'ahora';
    if (m < 60) return 'hace ' + m + ' min';
    var h = Math.floor(m/60);
    if (h < 24) return 'hace ' + h + ' h';
    var d = Math.floor(h/24);
    if (d < 30) return 'hace ' + d + ' días';
    var mo = Math.floor(d/30);
    return 'hace ' + mo + ' mes' + (mo>1?'es':'');
  };

  // Formato exacto: "27 abr · 09:34" (fecha corta + hora)
  A.exactTime = function (iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var fecha = d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
    var hora = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
    return fecha + ' · ' + hora;
  };

  // Registra una acción del admin en la tabla `admin_audit` de Supabase
  // (RPC `log_admin_action`). Es fire-and-forget: si falla no rompe el flujo
  // del admin, solo loggea por consola. Reemplaza el log local previo, que
  // vivía en localStorage del navegador y no era global.
  A.logAudit = function (action, target, meta) {
    try {
      var sb = window.Consultia && window.Consultia.supabase;
      if (!sb) return;
      sb.rpc('log_admin_action', {
        action_in: action,
        target_in: target || null,
        meta_in: meta || null,
        ip_in: null
      }).then(function (res) {
        if (res && res.error) console.warn('[admin] log_admin_action error:', res.error.message);
      });
    } catch (e) {
      console.warn('[admin] no se pudo loggear acción:', e);
    }
  };

  A.roleLabel = function (key) {
    return (A.ROLES[key] && A.ROLES[key].label) || key;
  };

  A.roleColor = function (key) {
    return (A.ROLES[key] && A.ROLES[key].color) || 'var(--c-muted)';
  };

  A.exportCSV = function (filename, headers, rows) {
    var csv = [headers.join(',')].concat(
      rows.map(function (row) {
        return row.map(function (cell) {
          var s = (cell == null ? '' : String(cell)).replace(/"/g, '""');
          return /[",\n]/.test(s) ? '"' + s + '"' : s;
        }).join(',');
      })
    ).join('\n');
    var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
})();
