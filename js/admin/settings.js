/* ============================================================
   ADMIN SETTINGS — configuración global (empresa + MP)
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};
  window.Consultia.Admin = window.Consultia.Admin || {};
  var A = window.Consultia.Admin;

  function loadCompany() {
    var s = A.getStore();
    document.getElementById('setCompanyName').value = s.settings.company_name;
    document.getElementById('setLegalName').value = s.settings.legal_name;
    document.getElementById('setRuc').value = s.settings.ruc;
    document.getElementById('setSupportEmail').value = s.settings.support_email;
  }

  function loadBilling() {
    var s = A.getStore();
    document.getElementById('setCurrency').value = s.settings.currency;
    document.getElementById('setIgv').value = s.settings.igv_rate;
  }

  function loadMp() {
    var s = A.getStore();
    var mp = s.settings.mp;
    document.getElementById('setMpMode').value = mp.mode;
    document.getElementById('setMpPublicKey').value = mp.public_key || '';
    document.getElementById('setMpAccessToken').value = mp.access_token_suffix ? '••••••••' + mp.access_token_suffix : '';
    document.getElementById('setMpWebhook').value = mp.webhook_url || '';
    document.getElementById('setMpModeLabel').textContent = mp.mode === 'production' ? 'Producción' : 'Sandbox';
  }

  A.renderSettings = function () {
    loadCompany();
    loadBilling();
    loadMp();
  };

  A.initSettings = function () {
    document.getElementById('settingsCompanyForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var s = A.getStore();
      s.settings.company_name = document.getElementById('setCompanyName').value.trim();
      s.settings.legal_name = document.getElementById('setLegalName').value.trim();
      s.settings.ruc = document.getElementById('setRuc').value.trim();
      s.settings.support_email = document.getElementById('setSupportEmail').value.trim();
      A.logAudit('settings.update', 'Empresa', 'Datos fiscales actualizados');
      A.persist();
      if (window.Consultia.toast) Consultia.toast({ type:'success', title:'Guardado', message:'Datos de empresa actualizados.' });
    });

    document.getElementById('settingsBillingForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var s = A.getStore();
      s.settings.currency = document.getElementById('setCurrency').value;
      s.settings.igv_rate = parseFloat(document.getElementById('setIgv').value) || 0;
      A.logAudit('settings.update', 'Facturación', 'IGV ' + s.settings.igv_rate + '% · ' + s.settings.currency);
      A.persist();
      if (window.Consultia.toast) Consultia.toast({ type:'success', title:'Guardado', message:'Configuración de facturación actualizada.' });
    });

    document.getElementById('settingsMpForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var s = A.getStore();
      s.settings.mp.mode = document.getElementById('setMpMode').value;
      var pk = document.getElementById('setMpPublicKey').value.trim();
      if (pk) s.settings.mp.public_key = pk;
      var tok = document.getElementById('setMpAccessToken').value.trim();
      if (tok && !/^•+/.test(tok)) {
        s.settings.mp.access_token_suffix = tok.slice(-4);
      }
      s.settings.mp.webhook_url = document.getElementById('setMpWebhook').value.trim();
      s.settings.mp.connected = !!s.settings.mp.public_key;
      A.logAudit('settings.update', 'Mercado Pago', 'Modo: ' + s.settings.mp.mode);
      A.persist();
      loadMp();
      if (window.Consultia.toast) Consultia.toast({ type:'success', title:'Guardado', message:'Integración de Mercado Pago actualizada.' });
      if (A.renderMercadoPago) A.renderMercadoPago();
    });

    document.getElementById('setMpTest').addEventListener('click', function () {
      if (window.Consultia.toast) Consultia.toast({
        type: 'info',
        title: 'Probando conexión...',
        message: 'Simulación — conexión exitosa con Mercado Pago.'
      });
      setTimeout(function () {
        if (window.Consultia.toast) Consultia.toast({
          type: 'success',
          title: 'Conexión OK',
          message: 'Credenciales válidas.'
        });
      }, 900);
    });
  };
})();
