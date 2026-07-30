/* ============================================================
   MAIN — punto de entrada, inicializa todos los módulos
============================================================ */

// ── Constantes y utilidades compartidas ──
window.Consultia = window.Consultia || {};
Consultia.WHATSAPP_NUMBER = '51932465820';
Consultia.greeting = function () {
  var h = new Date().getHours();
  if (h >= 5 && h < 12)  return 'Buenos días';
  if (h >= 12 && h < 19) return 'Buenas tardes';
  return 'Buenas noches';
};

// Dibuja un gauge segmentado (tipo speedometer) con ticks radiales
function renderGauge(svg) {
  if (!svg) return;
  // permitir re-render si el porcentaje cambió
  const percent = parseFloat(svg.dataset.percent || '0');
  if (svg.__rendered && svg.__lastPercent === percent) return;
  svg.__lastPercent = percent;
  const NUM = 44;        // cantidad de ticks
  const START = 135;     // ángulo inicial (bottom-left)
  const SWEEP = 270;     // barrido total (deja hueco abajo)
  const C = 60;
  const INNER = 42;
  const OUTER = 54;
  let markup = '';
  for (let i = 0; i < NUM; i++) {
    const t = i / (NUM - 1);
    const rad = (START + SWEEP * t) * Math.PI / 180;
    const x1 = (C + Math.cos(rad) * INNER).toFixed(2);
    const y1 = (C + Math.sin(rad) * INNER).toFixed(2);
    const x2 = (C + Math.cos(rad) * OUTER).toFixed(2);
    const y2 = (C + Math.sin(rad) * OUTER).toFixed(2);
    const filled = t * 100 <= percent;
    markup += '<line class="gauge-tick ' + (filled ? 'on' : 'off') + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"/>';
  }
  svg.innerHTML = markup;
  svg.__rendered = true;
}

// Exponemos globalmente para que otros módulos puedan re-renderizar
window.Consultia = window.Consultia || {};
window.Consultia.renderGauge = renderGauge;

document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.gauge-svg').forEach(renderGauge);

  const sidebarAPI = Consultia.initSidebar();
  if (Consultia.initUserMenu) Consultia.initUserMenu();
  if (Consultia.initVehiculosCombo) Consultia.initVehiculosCombo();
  if (Consultia.initSunarpCombo) Consultia.initSunarpCombo();
  if (Consultia.initReniecCombo) Consultia.initReniecCombo();
  if (Consultia.initSunatCombo) Consultia.initSunatCombo();
  if (Consultia.initFinancieroCombo) Consultia.initFinancieroCombo();
  if (Consultia.initEstudiosCombo) Consultia.initEstudiosCombo();
  if (Consultia.initMtcCombo) Consultia.initMtcCombo();
  if (Consultia.initSeekerCombo) Consultia.initSeekerCombo();
  if (Consultia.initVipCombo) Consultia.initVipCombo();
  if (Consultia.initTelefoniaCombo) Consultia.initTelefoniaCombo();
  if (Consultia.initFamiliaresCombo) Consultia.initFamiliaresCombo();
  if (Consultia.initCertificadosCombo) Consultia.initCertificadosCombo();
  if (Consultia.initActasCombo) Consultia.initActasCombo();
  if (Consultia.initDelitosCombo) Consultia.initDelitosCombo();
  if (Consultia.initLaboralCombo) Consultia.initLaboralCombo();
  if (Consultia.initMigracionesCombo) Consultia.initMigracionesCombo();
  if (Consultia.initExtrasCombo) Consultia.initExtrasCombo();
  if (Consultia.initPremiumCombo) Consultia.initPremiumCombo();
  if (Consultia.initFacialCombo) Consultia.initFacialCombo();
  if (Consultia.initFilterCombo) Consultia.initFilterCombo();
  if (Consultia.initOverlays) Consultia.initOverlays();
  if (Consultia.initServicesUploader) Consultia.initServicesUploader();
  if (Consultia.initSaldoCatalog) Consultia.initSaldoCatalog();
  if (Consultia.initAuthModals) Consultia.initAuthModals();
  // Gate global: si no hay sesión, oculta la app y muestra login obligatorio.
  // Debe correr DESPUÉS de initAuthModals (necesita el modal inyectado).
  if (Consultia.initAuthGate) Consultia.initAuthGate();
  if (Consultia.initAuthUI) Consultia.initAuthUI();
  if (Consultia.initNotifications) Consultia.initNotifications();
  if (Consultia.initWhatsappSupport) Consultia.initWhatsappSupport();
  if (Consultia.initValidation) Consultia.initValidation();
  // scroll-reveal desactivado — eliminado
  if (Consultia.RightPanel) Consultia.RightPanel.init();

  // === Funciones nuevas ===
  if (Consultia.initSearchHistory) Consultia.initSearchHistory();
  if (Consultia.initFavorites) Consultia.initFavorites();
  if (Consultia.initCreditsCounter) Consultia.initCreditsCounter();
  if (Consultia.initPlateScanner) Consultia.initPlateScanner();
  // Alerta saldo bajo: revisar tras carga del usuario
  setTimeout(function () {
    if (Consultia.checkLowBalance) Consultia.checkLowBalance();
  }, 2500);
  // Escuchar pagos acreditados en tiempo real (toast + refresh automático)
  if (Consultia.PaymentWatcher) Consultia.PaymentWatcher.init();

  Consultia.initViews(function (viewId) {
    if (window.innerWidth <= 768 && sidebarAPI) sidebarAPI.close();
    // Al entrar a vistas del cliente, recargar desde Supabase
    if (viewId === 'view-notificaciones' && Consultia.renderNotifications) {
      Consultia.renderNotifications();
    }
    if (viewId === 'view-compras' && Consultia.renderCompras) {
      Consultia.renderCompras();
    }
    if (viewId === 'view-historial' && Consultia.renderHistorial) {
      Consultia.renderHistorial();
    }
    if (viewId === 'view-dashboard' && Consultia.renderDashboardStats) {
      Consultia.renderDashboardStats();
      if (Consultia.checkLowBalance) Consultia.checkLowBalance();
    }
    // En dashboard: marcar body Y <html> para que .content cambie a 1 columna
    // y oculte el right-panel. Sincronizar ambos elimina el flash del panel
    // en la carga inicial (el inline script del <head> ya pone la clase en <html>
    // antes del primer paint; aquí la mantenemos en sincronía en navegación).
    var isDash = viewId === 'view-dashboard';
    document.body.classList.toggle('is-dashboard-view', isDash);
    document.documentElement.classList.toggle('is-dashboard-view', isDash);
  });

  // ── Anti-FOUC: revelar body cuando todo está inicializado ──
  requestAnimationFrame(function () {
    document.body.classList.add('app-ready');
  });

});
