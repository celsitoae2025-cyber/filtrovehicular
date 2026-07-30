/* ============================================================
   ADMIN API KEYS — generar, rotar, revocar (mock)
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};
  window.Consultia.Admin = window.Consultia.Admin || {};
  var A = window.Consultia.Admin;

  var escapeHtml = Consultia.Utils.escapeHtml;

  function randomKey(len) {
    var chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var out = '';
    for (var i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  A.renderApiKeys = function () {
    var s = A.getStore();
    var rows = s.api_keys.slice().sort(function (a, b) { return b.created_at.localeCompare(a.created_at); });

    var body = document.getElementById('apikeysTableBody');
    var empty = document.getElementById('apikeysEmpty');
    var wrap = document.querySelector('#adminView-apikeys .admin-table-wrap');
    if (!rows.length) {
      body.innerHTML = '';
      if (empty) empty.hidden = false;
      if (wrap) wrap.style.display = 'none';
      return;
    }
    if (empty) empty.hidden = true;
    if (wrap) wrap.style.display = '';

    body.innerHTML = rows.map(function (k) {
      var typeChip = k.type === 'production'
        ? '<span class="chip chip-ok">Producción</span>'
        : '<span class="chip">Test</span>';
      var status = k.status === 'active'
        ? '<span class="chip chip-ok">Activa</span>'
        : '<span class="chip chip-off">Revocada</span>';
      return '<tr>' +
        '<td><strong>' + escapeHtml(k.name) + '</strong></td>' +
        '<td>' + typeChip + '</td>' +
        '<td style="font-family:monospace;font-size:12px">' + k.key_prefix + '••••••••' + k.key_suffix + '</td>' +
        '<td>' + A.relativeTime(k.last_used) + '</td>' +
        '<td>' + A.fmtDateShort(k.created_at) + '</td>' +
        '<td>' + status + '</td>' +
        '<td><div class="cell-actions">' +
          (k.status === 'active'
            ? '<button class="table-btn" data-apikey-action="rotate" data-id="' + k.id + '">Rotar</button>' +
              '<button class="table-btn" data-apikey-action="revoke" data-id="' + k.id + '">Revocar</button>'
            : '<span style="color:var(--c-muted);font-size:12px">—</span>') +
        '</div></td>' +
      '</tr>';
    }).join('');
  };

  function openModal(title, bodyHtml, footerHtml) {
    document.getElementById('apiKeyModalTitle').textContent = title;
    document.getElementById('apiKeyModalBody').innerHTML = bodyHtml;
    document.getElementById('apiKeyModalFooter').innerHTML = footerHtml;
    document.getElementById('apiKeyModal').hidden = false;
    // Rebindear close en footer redibujado
    document.querySelectorAll('#apiKeyModalFooter [data-close]').forEach(function (el) {
      el.addEventListener('click', closeModal);
    });
  }

  function closeModal() {
    document.getElementById('apiKeyModal').hidden = true;
  }

  function showFullKey(key, name) {
    var html =
      '<div class="apikey-warning">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' +
        '<span>Copia esta clave ahora. Por seguridad no volverá a mostrarse completa.</span>' +
      '</div>' +
      '<p style="font-size:13px;margin:0 0 6px;color:var(--c-muted)">Clave de <strong style="color:var(--c-primary)">' + escapeHtml(name) + '</strong>:</p>' +
      '<div class="apikey-display"><code id="apiKeyFullCode">' + escapeHtml(key) + '</code><button type="button" class="table-btn" id="apiKeyCopyBtn">Copiar</button></div>';
    openModal('Clave generada', html,
      '<button type="button" class="btn btn-primary" id="apiKeyDoneBtn">Entendido</button>'
    );
    document.getElementById('apiKeyDoneBtn').addEventListener('click', closeModal);
    document.getElementById('apiKeyCopyBtn').addEventListener('click', function () {
      if (navigator.clipboard) navigator.clipboard.writeText(key);
      if (window.Consultia.toast) Consultia.toast({ type:'success', title:'Copiada', message:'Clave al portapapeles.' });
    });
  }

  function openCreate() {
    var html =
      '<div class="field"><label for="newKeyName">Nombre identificador</label>' +
      '<input type="text" id="newKeyName" class="input" placeholder="Ej: Integración Xyz"></div>' +
      '<div class="field"><label for="newKeyType">Tipo</label>' +
      '<select id="newKeyType" class="admin-select" style="width:100%"><option value="test">Test (sandbox)</option><option value="production">Producción</option></select></div>';
    openModal('Generar nueva clave', html,
      '<button type="button" class="btn-ghost" data-close="apiKeyModal">Cancelar</button>' +
      '<button type="button" class="btn btn-primary" id="apiKeyCreateBtn">Generar</button>'
    );
    document.getElementById('apiKeyCreateBtn').addEventListener('click', function () {
      var name = document.getElementById('newKeyName').value.trim();
      var type = document.getElementById('newKeyType').value;
      if (!name) {
        if (window.Consultia.toast) Consultia.toast({ type:'error', title:'Falta el nombre' });
        return;
      }
      var prefix = type === 'production' ? 'ck_live_' : 'ck_test_';
      var body = randomKey(28);
      var suffix = body.slice(-4);
      var fullKey = prefix + body;
      var s = A.getStore();
      s.api_keys.unshift({
        id: 'k' + Date.now(),
        name: name,
        type: type,
        key_prefix: prefix,
        key_suffix: suffix,
        status: 'active',
        last_used: null,
        created_at: new Date().toISOString()
      });
      A.logAudit('apikey.create', name, 'Tipo: ' + type);
      A.persist();
      A.renderApiKeys();
      showFullKey(fullKey, name);
    });
  }

  function rotate(id) {
    var s = A.getStore();
    var k = s.api_keys.find(function (x) { return x.id === id; });
    if (!k) return;
    var prefix = k.key_prefix;
    var body = randomKey(28);
    var suffix = body.slice(-4);
    var fullKey = prefix + body;
    k.key_suffix = suffix;
    k.created_at = new Date().toISOString();
    A.logAudit('apikey.rotate', k.name, 'Clave rotada');
    A.persist();
    A.renderApiKeys();
    showFullKey(fullKey, k.name);
  }

  function revoke(id) {
    var s = A.getStore();
    var k = s.api_keys.find(function (x) { return x.id === id; });
    if (!k) return;
    k.status = 'revoked';
    A.logAudit('apikey.revoke', k.name, '');
    A.persist();
    A.renderApiKeys();
    if (window.Consultia.toast) Consultia.toast({ type:'success', title:'Clave revocada', message: k.name });
  }

  A.initApiKeys = function () {
    document.getElementById('apikeysCreateBtn').addEventListener('click', openCreate);
    document.getElementById('apikeysTableBody').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-apikey-action]');
      if (!btn) return;
      if (btn.dataset.apikeyAction === 'rotate') rotate(btn.dataset.id);
      else if (btn.dataset.apikeyAction === 'revoke') revoke(btn.dataset.id);
    });
    document.querySelectorAll('#apiKeyModal [data-close]').forEach(function (el) {
      el.addEventListener('click', closeModal);
    });
  };
})();
