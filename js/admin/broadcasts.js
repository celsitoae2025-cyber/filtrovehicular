/* ============================================================
   ADMIN BROADCASTS — anuncios masivos a usuarios
   - Vista previa en vivo del título/cuerpo/tipo
   - Conteo de audiencia con admin_count_broadcast_audience
   - Envío con admin_broadcast_notification (RPC inserta N notifs)
   - Historial con métricas de lectura
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};
  window.Consultia.Admin = window.Consultia.Admin || {};
  var A = window.Consultia.Admin;

  function getSB() { return (window.Consultia && window.Consultia.supabase) || null; }

  var lastAudienceCount = null;
  var historyRows = [];

  // Estado de la imagen seleccionada
  var selectedImage = null;      // File object del picker
  var selectedImageDataUrl = ''; // para preview en vivo (base64)
  var MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3 MB

  // --------------------------------------------------------------
  // Helpers de UI
  // --------------------------------------------------------------
  var escapeHtml = Consultia.Utils.escapeHtml;

  function fmtDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return d.toLocaleString('es-PE', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  var TYPE_LABEL = {
    info: 'Info',
    system: 'Sistema',
    promo: 'Promo',
    credits: 'Créditos'
  };

  var AUDIENCE_LABEL = {
    all: 'Todos',
    subscribers: 'Suscriptores',
    with_credits: 'Con créditos',
    paid: 'Han pagado',
    active_30d: 'Activos 30d'
  };

  // SVG icons por tipo (para el preview)
  var TYPE_ICONS = {
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    system: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    promo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
    credits: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></svg>'
  };

  var TYPE_COLORS = {
    info:    { bg: '#edf7d9', fg: '#141d1c', border: '#DCDCDC' },
    system:  { bg: '#f5f5f5', fg: '#141d1c', border: '#f5f5f5' },
    promo:   { bg: '#f5f5f5', fg: '#141d1c', border: '#f5f5f5' },
    credits: { bg: '#edf7d9', fg: '#141d1c', border: '#DCDCDC' }
  };

  // --------------------------------------------------------------
  // Live preview
  // --------------------------------------------------------------
  function updatePreview() {
    var type = (document.getElementById('bcType') || {}).value || 'info';
    var title = ((document.getElementById('bcTitle') || {}).value || '').trim();
    var body = ((document.getElementById('bcBody') || {}).value || '').trim();

    var titleEl = document.getElementById('bcPreviewTitle');
    var bodyEl  = document.getElementById('bcPreviewBody');
    var iconEl  = document.getElementById('bcPreviewIcon');
    var toastEl = document.getElementById('bcPreviewToast');

    if (titleEl) titleEl.textContent = title || 'Tu título aparecerá aquí';
    if (bodyEl)  bodyEl.textContent  = body  || 'Y tu mensaje aquí. Empieza a escribir para ver el resultado.';

    // Imagen en la vista previa
    var previewImg = document.getElementById('bcPreviewImage');
    if (previewImg) {
      if (selectedImageDataUrl) {
        previewImg.src = selectedImageDataUrl;
        previewImg.hidden = false;
      } else {
        previewImg.removeAttribute('src');
        previewImg.hidden = true;
      }
    }

    if (iconEl) iconEl.innerHTML = TYPE_ICONS[type] || TYPE_ICONS.info;

    var col = TYPE_COLORS[type] || TYPE_COLORS.info;
    if (toastEl) {
      toastEl.style.background = col.bg;
      toastEl.style.color = col.fg;
      toastEl.style.borderLeftColor = col.fg;
    }
    if (iconEl) iconEl.style.color = col.fg;

    // Contadores
    var titleCount = document.getElementById('bcTitleCount');
    var bodyCount  = document.getElementById('bcBodyCount');
    if (titleCount) titleCount.textContent = (title.length) + '/200';
    if (bodyCount)  bodyCount.textContent  = (body.length)  + '/1000';
  }

  // --------------------------------------------------------------
  // Conteo de audiencia (preview)
  // --------------------------------------------------------------
  async function refreshAudienceCount() {
    var sb = getSB();
    var info = document.getElementById('bcAudienceInfo');
    if (!sb || !info) return;
    var aud = (document.getElementById('bcAudience') || {}).value || 'all';
    info.textContent = 'Calculando destinatarios…';
    try {
      var res = await sb.rpc('admin_count_broadcast_audience', { p_audience: aud });
      if (res.error) throw res.error;
      var n = res.data || 0;
      lastAudienceCount = n;
      info.innerHTML = 'Esta audiencia incluye <strong>' + n + '</strong> usuario' + (n === 1 ? '' : 's') + '. ' +
        '<span style="color:var(--c-muted);font-size:11.5px;">(Excluye admins, suspendidos y no confirmados.)</span>';
    } catch (e) {
      console.error('count audience error:', e);
      info.textContent = 'Error calculando audiencia: ' + (e.message || e);
      lastAudienceCount = null;
    }
  }

  // --------------------------------------------------------------
  // Imagen: seleccionar / preview / quitar / subir a Storage
  // --------------------------------------------------------------
  function fmtBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(2) + ' MB';
  }

  function handleImageChange(file) {
    var errBox = document.getElementById('bcError');
    var thumbWrap = document.getElementById('bcImageThumbWrap');
    var thumbImg  = document.getElementById('bcImageThumb');
    var metaSpan  = document.getElementById('bcImageMeta');
    var removeBtn = document.getElementById('bcImageRemove');
    var pickLabel = document.getElementById('bcImagePickLabel');

    if (!file) {
      selectedImage = null;
      selectedImageDataUrl = '';
      if (thumbWrap) thumbWrap.hidden = true;
      if (thumbImg)  thumbImg.removeAttribute('src');
      if (removeBtn) removeBtn.hidden = true;
      if (pickLabel) pickLabel.textContent = 'Elegir imagen';
      updatePreview();
      return;
    }

    // Validaciones
    if (!/^image\//.test(file.type)) {
      if (errBox) { errBox.textContent = 'El archivo seleccionado no es una imagen válida.'; errBox.hidden = false; }
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      if (errBox) { errBox.textContent = 'La imagen pesa ' + fmtBytes(file.size) + '. El máximo permitido es 3 MB.'; errBox.hidden = false; }
      return;
    }

    selectedImage = file;
    if (errBox) errBox.hidden = true;

    var reader = new FileReader();
    reader.onload = function (ev) {
      selectedImageDataUrl = ev.target.result;
      if (thumbImg) { thumbImg.src = selectedImageDataUrl; }
      if (thumbWrap) thumbWrap.hidden = false;
      if (metaSpan) metaSpan.textContent = file.name + ' · ' + fmtBytes(file.size);
      if (removeBtn) removeBtn.hidden = false;
      if (pickLabel) pickLabel.textContent = 'Cambiar imagen';
      updatePreview();
    };
    reader.readAsDataURL(file);
  }

  async function uploadImageIfAny() {
    if (!selectedImage) return null;
    var sb = getSB();
    if (!sb) throw new Error('Supabase no disponible');

    // Nombre único: timestamp + sanitización del original
    var origName = selectedImage.name || 'imagen';
    var safe = origName.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-80);
    var path = Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '_' + safe;

    var up = await sb.storage.from('broadcasts').upload(path, selectedImage, {
      contentType: selectedImage.type || 'image/*',
      upsert: false
    });
    if (up.error) throw up.error;

    var pub = sb.storage.from('broadcasts').getPublicUrl(path);
    var url = (pub && pub.data && pub.data.publicUrl) || '';
    if (!url) throw new Error('No se obtuvo la URL pública de la imagen');
    return url;
  }

  // --------------------------------------------------------------
  // Helper: promesa con timeout — evita que el botón quede colgado
  // si la RPC o el upload nunca responden (ej: red caída, función
  // RPC inexistente en Supabase, política RLS mal configurada, etc.)
  // --------------------------------------------------------------
  function withTimeout(promise, ms, label) {
    return new Promise(function (resolve, reject) {
      var to = setTimeout(function () {
        reject(new Error('Tiempo de espera agotado en: ' + label + ' (' + ms + 'ms). Revisa tu conexión o la configuración de Supabase.'));
      }, ms);
      Promise.resolve(promise).then(
        function (v) { clearTimeout(to); resolve(v); },
        function (e) { clearTimeout(to); reject(e); }
      );
    });
  }

  // Restaura el botón Enviar a su estado original (idempotente)
  function restoreSendButton() {
    var sendBtn = document.getElementById('bcSendBtn');
    if (!sendBtn) return;
    sendBtn.disabled = false;
    sendBtn.textContent = sendBtn.dataset.orig || 'Vista previa y enviar';
  }

  // --------------------------------------------------------------
  // Envío (con confirmación)
  // --------------------------------------------------------------
  async function sendBroadcast() {
    var sb = getSB();
    if (!sb) return;

    var type = (document.getElementById('bcType') || {}).value || 'info';
    var aud  = (document.getElementById('bcAudience') || {}).value || 'all';
    var title = ((document.getElementById('bcTitle') || {}).value || '').trim();
    var body  = ((document.getElementById('bcBody')  || {}).value || '').trim();
    var errBox = document.getElementById('bcError');
    var sendBtn = document.getElementById('bcSendBtn');

    if (errBox) errBox.hidden = true;

    if (!title) {
      if (errBox) { errBox.textContent = 'El título es obligatorio.'; errBox.hidden = false; }
      return;
    }
    if (!body) {
      if (errBox) { errBox.textContent = 'El mensaje es obligatorio.'; errBox.hidden = false; }
      return;
    }

    // Asegurar conteo actualizado
    if (lastAudienceCount === null) {
      await refreshAudienceCount();
    }
    var n = lastAudienceCount || 0;
    if (n === 0) {
      if (errBox) { errBox.textContent = 'La audiencia seleccionada no tiene destinatarios.'; errBox.hidden = false; }
      return;
    }

    // Confirmación (con safety: si el modal no responde en 60s,
    // se considera cancelado para no congelar la UI)
    var confirmed = false;
    if (Consultia.confirmDialog) {
      try {
        await withTimeout(new Promise(function (resolve) {
          Consultia.confirmDialog({
            title: 'Enviar anuncio',
            message:
              'Vas a enviar este anuncio a ' + n + ' usuario' + (n === 1 ? '' : 's') + ' (' +
              (AUDIENCE_LABEL[aud] || aud) + ').\n\n' +
              'Cada uno recibirá una notificación in-app con un toast en pantalla. ' +
              'Esta acción NO se puede deshacer.',
            confirmLabel: 'Enviar a ' + n,
            confirmStyle: 'primary',
            onConfirm: function () { confirmed = true; resolve(); },
            onCancel: function () { resolve(); }
          });
        }), 60000, 'modal de confirmación');
      } catch (e) {
        console.warn('[broadcasts] confirm dialog timeout:', e);
        return;
      }
    } else {
      confirmed = confirm('¿Enviar el anuncio a ' + n + ' usuario(s)?');
    }
    if (!confirmed) return;

    // Bloquear botón con guardia para asegurar restauración SIEMPRE
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.dataset.orig = sendBtn.textContent;
      sendBtn.textContent = 'Enviando…';
    }

    // Failsafe global: si después de 90s el botón sigue deshabilitado,
    // forzar rehabilitación (ej. el navegador perdió la conexión y
    // promise nunca resuelve ni rechaza).
    var failsafe = setTimeout(function () {
      restoreSendButton();
      if (errBox) {
        errBox.textContent = 'El envío tardó demasiado. Verifica tu conexión y vuelve a intentar.';
        errBox.hidden = false;
      }
    }, 90000);

    try {

      // 1) Subir imagen (si hay) — con timeout de 30s
      var imageUrl = null;
      if (selectedImage) {
        if (sendBtn) sendBtn.textContent = 'Subiendo imagen…';
        try {
          imageUrl = await withTimeout(uploadImageIfAny(), 30000, 'subida de imagen a Storage');
        } catch (upErr) {
          throw new Error('Error subiendo la imagen: ' + (upErr.message || upErr) +
            ' — Verifica que el bucket "broadcasts" exista en Supabase Storage y que tu usuario sea admin.');
        }
      }

      if (sendBtn) sendBtn.textContent = 'Enviando…';

      // 2) RPC con timeout de 30s
      var res = await withTimeout(
        sb.rpc('admin_broadcast_notification', {
          p_audience: aud,
          p_type: type,
          p_title: title,
          p_body: body,
          p_meta: null,
          p_image_url: imageUrl
        }),
        30000,
        'RPC admin_broadcast_notification'
      );

      if (res.error) {
        // Mensaje más específico según el código de error de Supabase
        var msg = res.error.message || 'Error desconocido al ejecutar la RPC';
        if (/function .* does not exist/i.test(msg)) {
          msg = 'La función admin_broadcast_notification no existe en Supabase. Re-ejecuta el SQL "supabase/admin/admin_broadcast_notification.sql".';
        } else if (/Solo administradores/i.test(msg)) {
          msg = 'Tu usuario no tiene permisos de administrador (profiles.is_admin debe ser true).';
        }
        throw new Error(msg);
      }

      var sent = (res.data && res.data.sent_count) || 0;

      if (typeof A.logAudit === 'function') {
        try {
          A.logAudit('broadcast.send', AUDIENCE_LABEL[aud] || aud, sent + ' notifs · "' + title.slice(0, 80) + '"');
        } catch (aerr) { console.warn('[broadcasts] audit log falló (no crítico):', aerr); }
      }

      if (Consultia.toast) Consultia.toast({
        type: 'success',
        title: 'Anuncio enviado',
        message: 'Se entregó a ' + sent + ' usuario' + (sent === 1 ? '' : 's') + '.',
        duration: 5500
      });

      // Limpiar formulario
      var titleField = document.getElementById('bcTitle');
      var bodyField  = document.getElementById('bcBody');
      if (titleField) titleField.value = '';
      if (bodyField)  bodyField.value  = '';
      var fileInput = document.getElementById('bcImageInput');
      if (fileInput) fileInput.value = '';
      handleImageChange(null);
      updatePreview();

      // Recargar historial (no bloqueante para el botón: ya lo restauramos en finally)
      try {
        await withTimeout(loadAndRenderHistory(), 15000, 'recarga de historial');
      } catch (hErr) {
        console.warn('[broadcasts] no se pudo recargar el historial (no crítico):', hErr);
      }
    } catch (err) {
      console.error('[broadcasts] error en envío:', err);
      if (errBox) {
        errBox.textContent = (err && err.message) || 'No se pudo enviar el anuncio.';
        errBox.hidden = false;
      }
    } finally {
      clearTimeout(failsafe);
      restoreSendButton();
    }
  }

  // --------------------------------------------------------------
  // Historial
  // --------------------------------------------------------------
  async function loadAndRenderHistory() {
    var sb = getSB();
    if (!sb) return;
    var body = document.getElementById('bcHistoryBody');
    var empty = document.getElementById('bcHistoryEmpty');
    if (!body) return;

    try {
      var res = await sb.rpc('admin_list_broadcasts');
      if (res.error) throw res.error;
      historyRows = res.data || [];
    } catch (e) {
      console.error('list broadcasts error:', e);
      historyRows = [];
    }

    if (!historyRows.length) {
      body.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    body.innerHTML = historyRows.map(function (b) {
      var sent = b.sent_count || 0;
      var read = b.read_count || 0;
      var pct = sent > 0 ? Math.round((read / sent) * 100) : 0;
      var typeChip = '<span class="bc-chip bc-chip-' + (b.type || 'info') + '">' + (TYPE_LABEL[b.type] || b.type || 'info') + '</span>';
      var thumb = b.image_url
        ? '<img src="' + escapeHtml(b.image_url) + '" alt="" class="bc-history-thumb" onerror="this.style.display=\'none\'">'
        : '';
      return '<tr>' +
        '<td>' + fmtDate(b.created_at) + '</td>' +
        '<td>' + typeChip + '</td>' +
        '<td><div class="bc-history-title-cell">' + thumb +
          '<div><strong>' + escapeHtml(b.title) + '</strong><br><span style="color:var(--c-muted);font-size:12px;">' + escapeHtml((b.body || '').slice(0, 80)) + (b.body && b.body.length > 80 ? '…' : '') + '</span></div>' +
        '</div></td>' +
        '<td>' + escapeHtml(AUDIENCE_LABEL[b.audience] || b.audience || '—') + '</td>' +
        '<td><strong>' + sent + '</strong></td>' +
        '<td>' + read + '</td>' +
        '<td><strong style="color:' + (pct >= 50 ? 'var(--c-accent)' : 'var(--c-muted)') + ';">' + pct + '%</strong></td>' +
      '</tr>';
    }).join('');
  }

  // --------------------------------------------------------------
  // Init / render
  // --------------------------------------------------------------
  A.renderBroadcasts = async function () {
    updatePreview();
    refreshAudienceCount();
    await loadAndRenderHistory();
  };

  A.initBroadcasts = function () {
    var typeEl  = document.getElementById('bcType');
    var audEl   = document.getElementById('bcAudience');
    var titleEl = document.getElementById('bcTitle');
    var bodyEl  = document.getElementById('bcBody');
    var clearBtn = document.getElementById('bcClear');
    var sendBtn  = document.getElementById('bcSendBtn');
    var reloadBtn = document.getElementById('bcReloadHistory');

    if (typeEl)  typeEl.addEventListener('change', updatePreview);
    if (titleEl) titleEl.addEventListener('input', updatePreview);
    if (bodyEl)  bodyEl.addEventListener('input', updatePreview);
    if (audEl)   audEl.addEventListener('change', refreshAudienceCount);

    if (clearBtn) clearBtn.addEventListener('click', function () {
      if (titleEl) titleEl.value = '';
      if (bodyEl)  bodyEl.value = '';
      var fileInput = document.getElementById('bcImageInput');
      if (fileInput) fileInput.value = '';
      handleImageChange(null);
      var errBox = document.getElementById('bcError');
      if (errBox) errBox.hidden = true;
      updatePreview();
      if (titleEl) titleEl.focus();
    });

    // Imagen
    var imgInput  = document.getElementById('bcImageInput');
    var removeBtn = document.getElementById('bcImageRemove');
    if (imgInput) imgInput.addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      handleImageChange(f || null);
    });
    if (removeBtn) removeBtn.addEventListener('click', function () {
      var fi = document.getElementById('bcImageInput');
      if (fi) fi.value = '';
      handleImageChange(null);
    });

    if (sendBtn) sendBtn.addEventListener('click', sendBroadcast);
    if (reloadBtn) reloadBtn.addEventListener('click', loadAndRenderHistory);
  };
})();
