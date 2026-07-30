/* ============================================================
   ADMIN WEBHOOKS — log de eventos recibidos
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};
  window.Consultia.Admin = window.Consultia.Admin || {};
  var A = window.Consultia.Admin;

  var STATUS_CHIP = {
    processed: { cls: 'chip-ok',  label: 'Procesado' },
    pending:   { cls: 'chip',     label: 'Pendiente' },
    failed:    { cls: 'chip-off', label: 'Fallido' }
  };

  A.renderWebhooks = function () {
    var s = A.getStore();
    var statusFilter = document.getElementById('whStatusFilter').value;
    var eventFilter = document.getElementById('whEventFilter').value;

    var rows = s.webhooks.filter(function (w) {
      if (statusFilter !== 'all' && w.status !== statusFilter) return false;
      if (eventFilter !== 'all' && w.event !== eventFilter) return false;
      return true;
    }).sort(function (a, b) { return b.received_at.localeCompare(a.received_at); });

    document.getElementById('whTotalCount').textContent = rows.length;

    var body = document.getElementById('whTableBody');
    var empty = document.getElementById('whEmpty');
    var wrap = document.querySelector('#adminView-webhooks .admin-table-wrap');
    if (!rows.length) {
      body.innerHTML = '';
      if (empty) empty.hidden = false;
      if (wrap) wrap.style.display = 'none';
      return;
    }
    if (empty) empty.hidden = true;
    if (wrap) wrap.style.display = '';

    body.innerHTML = rows.map(function (w) {
      var chip = STATUS_CHIP[w.status] || STATUS_CHIP.pending;
      return '<tr>' +
        '<td>' + A.fmtDate(w.received_at) + '</td>' +
        '<td style="font-family:monospace;font-size:12px"><span class="chip chip-accent">' + w.event + '</span></td>' +
        '<td>' + w.source + '</td>' +
        '<td style="font-family:monospace;font-size:11.5px">#' + w.payload_id + '</td>' +
        '<td>' + w.retries + '</td>' +
        '<td><span class="chip ' + chip.cls + '">' + chip.label + '</span></td>' +
        '<td><div class="cell-actions">' +
          (w.status === 'failed' || w.status === 'pending'
            ? '<button class="table-btn primary" data-wh-action="retry" data-id="' + w.id + '">Reintentar</button>'
            : '<button class="table-btn" data-wh-action="view" data-id="' + w.id + '">Ver</button>') +
        '</div></td>' +
      '</tr>';
    }).join('');
  };

  function retry(id) {
    var s = A.getStore();
    var w = s.webhooks.find(function (x) { return x.id === id; });
    if (!w) return;
    w.retries = (w.retries || 0) + 1;
    w.status = 'processed';
    w.received_at = new Date().toISOString();
    A.logAudit('webhook.retry', w.event, 'Payload #' + w.payload_id);
    A.persist();
    A.renderWebhooks();
    if (window.Consultia.toast) Consultia.toast({
      type: 'success',
      title: 'Webhook reprocesado',
      message: w.event + ' marcado como procesado.'
    });
  }

  function view(id) {
    var s = A.getStore();
    var w = s.webhooks.find(function (x) { return x.id === id; });
    if (!w) return;
    if (window.Consultia.toast) Consultia.toast({
      type: 'info',
      title: w.event,
      message: 'Payload #' + w.payload_id + ' · ' + w.retries + ' intento(s)'
    });
  }

  A.initWebhooks = function () {
    document.getElementById('whStatusFilter').addEventListener('change', A.renderWebhooks);
    document.getElementById('whEventFilter').addEventListener('change', A.renderWebhooks);
    document.getElementById('whTableBody').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-wh-action]');
      if (!btn) return;
      if (btn.dataset.whAction === 'retry') retry(btn.dataset.id);
      else if (btn.dataset.whAction === 'view') view(btn.dataset.id);
    });
  };
})();
