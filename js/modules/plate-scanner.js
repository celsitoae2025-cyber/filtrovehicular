/* ============================================================
   PLATE SCANNER — Escaneo de placas vehiculares con la cámara
   Usa Tesseract.js (OCR) cargado bajo demanda desde CDN.
   Detecta patrones de placas peruanas:
     - 3 letras + guión + 3 dígitos     (ABC-123)
     - 3 letras + guión + 3 alfanum     (ABC-1A2)
     - 2 letras + guión + 4 dígitos     (AB-1234)
     - 1 letra + 1 dígito + 1 letra + guión + 3 dígitos (motos)
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  var TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.4/dist/tesseract.min.js';
  var _tesseractLoading = null;

  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (_tesseractLoading) return _tesseractLoading;
    _tesseractLoading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = TESSERACT_CDN;
      s.async = true;
      s.onload = function () { resolve(window.Tesseract); };
      s.onerror = function () {
        _tesseractLoading = null;
        reject(new Error('No se pudo cargar el OCR. Revisa tu conexión.'));
      };
      document.head.appendChild(s);
    });
    return _tesseractLoading;
  }

  // Patrones de placas peruanas
  var PLATE_PATTERNS = [
    /\b([A-Z]{3})[-\s]?(\d{3})\b/,           // ABC-123 / ABC123 (autos antiguos)
    /\b([A-Z]{3})[-\s]?(\d{2}[A-Z0-9])\b/,   // ABC-1A2 (autos modernos)
    /\b([A-Z]{2})[-\s]?(\d{4})\b/,           // AB-1234 (taxis)
    /\b([A-Z]\d[A-Z])[-\s]?(\d{3})\b/,       // A1B-234 (motos)
  ];

  function extractPlate(text) {
    if (!text) return null;
    // Normalizar: mayúsculas y limpiar caracteres ruidosos
    var clean = text.toUpperCase()
      .replace(/[OQ]/g, '0')   // Confusiones comunes de OCR
      .replace(/[Il|]/g, '1')
      .replace(/[^A-Z0-9\s\-\n]/g, ' ');

    for (var i = 0; i < PLATE_PATTERNS.length; i++) {
      var m = clean.match(PLATE_PATTERNS[i]);
      if (m) return m[1] + '-' + m[2];
    }
    return null;
  }

  function createScannerModal(inputEl) {
    var root = document.createElement('div');
    root.className = 'ps-modal';
    root.innerHTML =
      '<div class="ps-overlay"></div>' +
      '<div class="ps-panel">' +
        '<button class="ps-close" type="button" aria-label="Cerrar">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
        '</button>' +
        '<h3 class="ps-title">Escanear placa</h3>' +
        '<p class="ps-hint">Toma una foto clara de la placa del vehículo. El sistema detectará el número automáticamente.</p>' +
        '<label class="ps-camera-btn" for="ps-camera-input">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>' +
          '<span>Tomar foto</span>' +
        '</label>' +
        '<input type="file" id="ps-camera-input" accept="image/*" capture="environment" hidden>' +
        '<div class="ps-preview" hidden>' +
          '<img class="ps-preview-img" alt="Preview">' +
          '<div class="ps-status">' +
            '<div class="ps-spinner"></div>' +
            '<span class="ps-status-text">Analizando imagen…</span>' +
          '</div>' +
          '<div class="ps-result" hidden>' +
            '<span class="ps-result-label">Placa detectada:</span>' +
            '<strong class="ps-result-value">—</strong>' +
            '<div class="ps-result-actions">' +
              '<button class="ps-btn ps-btn-retry" type="button">Tomar otra</button>' +
              '<button class="ps-btn ps-btn-use" type="button">Usar esta placa</button>' +
            '</div>' +
          '</div>' +
          '<div class="ps-manual" hidden>' +
            '<p class="ps-manual-text">No pudimos leer la placa. Escríbela manualmente:</p>' +
            '<input type="text" class="input ps-manual-input" placeholder="ABC-123" autocomplete="off">' +
            '<div class="ps-result-actions">' +
              '<button class="ps-btn ps-btn-retry" type="button">Tomar otra</button>' +
              '<button class="ps-btn ps-btn-use-manual" type="button">Usar</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(root);
    return root;
  }

  function close(root) {
    root.classList.add('ps-closing');
    setTimeout(function () { root.remove(); }, 200);
  }

  async function processImage(file, root, inputEl) {
    var preview = root.querySelector('.ps-preview');
    var img     = root.querySelector('.ps-preview-img');
    var status  = root.querySelector('.ps-status');
    var statusText = root.querySelector('.ps-status-text');
    var result  = root.querySelector('.ps-result');
    var manual  = root.querySelector('.ps-manual');
    var resultValue = root.querySelector('.ps-result-value');

    // Mostrar preview
    img.src = URL.createObjectURL(file);
    preview.hidden = false;
    status.hidden = false;
    result.hidden = true;
    manual.hidden = true;
    statusText.textContent = 'Cargando OCR…';

    try {
      var Tesseract = await loadTesseract();
      statusText.textContent = 'Analizando imagen…';

      var data = await Tesseract.recognize(file, 'eng', {
        // sin logger para evitar spam en consola
      });

      var text = (data && data.data && data.data.text) || '';
      var plate = extractPlate(text);

      status.hidden = true;

      if (plate) {
        resultValue.textContent = plate;
        result.hidden = false;
      } else {
        // No se detectó: mostrar input manual
        manual.hidden = false;
        var mInput = root.querySelector('.ps-manual-input');
        if (mInput) mInput.focus();
      }
    } catch (err) {
      status.hidden = true;
      manual.hidden = false;
      var mInput2 = root.querySelector('.ps-manual-input');
      if (mInput2) mInput2.focus();
      if (Consultia.toast) Consultia.toast({
        type: 'error',
        title: 'No se pudo procesar',
        message: 'Escríbela manualmente.'
      });
    }
  }

  function openScanner(inputEl) {
    var root = createScannerModal(inputEl);
    document.body.classList.add('ps-open');

    var camInput = root.querySelector('#ps-camera-input');
    var resultValue = root.querySelector('.ps-result-value');

    // Cerrar
    root.querySelector('.ps-overlay').addEventListener('click', function () {
      document.body.classList.remove('ps-open');
      close(root);
    });
    root.querySelector('.ps-close').addEventListener('click', function () {
      document.body.classList.remove('ps-open');
      close(root);
    });

    // Tomar foto
    camInput.addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (file) processImage(file, root, inputEl);
    });

    // Usar la placa detectada
    root.addEventListener('click', function (e) {
      if (e.target.closest('.ps-btn-use')) {
        var plate = resultValue.textContent.trim();
        if (plate && plate !== '—') {
          inputEl.value = plate;
          inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        }
        document.body.classList.remove('ps-open');
        close(root);
      } else if (e.target.closest('.ps-btn-use-manual')) {
        var mInput = root.querySelector('.ps-manual-input');
        var val = (mInput && mInput.value || '').trim().toUpperCase();
        if (val) {
          inputEl.value = val;
          inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        }
        document.body.classList.remove('ps-open');
        close(root);
      } else if (e.target.closest('.ps-btn-retry')) {
        // Reset y reabrir cámara
        root.querySelector('.ps-preview').hidden = true;
        camInput.value = '';
        camInput.click();
      }
    });

    // Lanzar cámara inmediatamente
    setTimeout(function () { camInput.click(); }, 50);
  }

  // Adjunta un botón de escanear al lado de un input
  function attachScannerButton(inputEl) {
    if (!inputEl || inputEl.dataset.psAttached) return;
    inputEl.dataset.psAttached = 'true';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ps-trigger';
    btn.setAttribute('aria-label', 'Escanear placa con la cámara');
    btn.setAttribute('title', 'Escanear placa');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg><span>Escanear placa</span>';

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      openScanner(inputEl);
    });

    // Desktop: dentro del input con wrapper relativo
    // Móvil: se reposiciona via CSS (order:10, position:static, width:100%)
    var formRow = inputEl.closest('.form-row') || inputEl.parentNode;
    var wrapper = document.createElement('div');
    wrapper.className = 'ps-input-wrap';
    wrapper.style.cssText = 'position:relative;flex:1 1 260px;min-width:0;';
    inputEl.parentNode.insertBefore(wrapper, inputEl);
    wrapper.appendChild(inputEl);
    wrapper.appendChild(btn);
    inputEl.style.paddingRight = '40px';

    // En móvil, mover el botón al form-row para que sea full-width
    function adjustLayout() {
      if (window.innerWidth <= 768) {
        if (btn.parentNode !== formRow) formRow.appendChild(btn);
        inputEl.style.paddingRight = '';
      } else {
        if (btn.parentNode !== wrapper) wrapper.appendChild(btn);
        inputEl.style.paddingRight = '40px';
      }
    }
    adjustLayout();
    window.addEventListener('resize', adjustLayout);
  }

  Consultia.PlateScanner = {
    open: openScanner,
    attach: attachScannerButton,
  };

  Consultia.initPlateScanner = function () {
    // Auto-adjuntar al input de placa de vehículos
    var vehInput = document.getElementById('vehiculos-input');
    if (vehInput) attachScannerButton(vehInput);
  };
})();
