/* ============================================================
   SERVICE IMAGES — reemplaza el SVG por defecto de cada card de
   servicio/región con una imagen real desde assets/ si existe.
   (Antes este módulo también permitía subir imágenes desde el
   navegador; esa parte se retiró por ser herramienta de admin.)
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  // IDs de servicios en el orden exacto en que aparecen en el HTML
  const SERVICE_IDS = [
    'multas-region',
    'sunarp-propiedad',
    'historial-placa',
    'cambio-caracteristicas',
    'sat-lima',
    'sat-callao',
    'papeletas-atu',
    'siniestralidad',
    'estado-placa',
    'foto-pit',
    'citv',
    'soat',
    'sutran',
    'lunas-oscurecidas',
    'fise-gnv',
    'deuda-gnv',
    'denuncias',
    'boleta',
    'tive',
    'propietarios',
    'record-conductor',
  ];

  // IDs de las regiones dentro del modal "Papeletas por región"
  const REGION_IDS = [
    'region-lima', 'region-callao', 'region-arequipa', 'region-trujillo',
    'region-piura', 'region-cusco', 'region-chiclayo', 'region-huancayo',
    'region-puno', 'region-cajamarca', 'region-ica', 'region-huanuco',
    'region-tacna', 'region-chachapoyas', 'region-tarapoto',
    'region-coronel-portillo', 'region-huarmey',
  ];

  const STORAGE_KEY = 'consultia_service_images';

  // Extensión conocida por id. Evita sondear múltiples formatos
  // (lo cual ensuciaba la consola con 404).
  const KNOWN_EXTENSIONS = {
    'sunarp-propiedad': 'png',
    'historial-placa': 'png',
    'cambio-caracteristicas': 'png',
    'sat-lima': 'webp',
    'sat-callao': 'webp',
    'papeletas-atu': 'webp',
    'siniestralidad': 'webp',
    'estado-placa': 'webp',
    'foto-pit': 'webp',
    'citv': 'jpg',
    'soat': 'png',
    'sutran': 'webp',
    'lunas-oscurecidas': 'webp',
    'fise-gnv': 'webp',
    'deuda-gnv': 'webp',
    'denuncias': 'webp',
    'boleta': 'png',
    'tive': 'png',
    'propietarios': 'png',
    'record-conductor': 'jpg',
    'region-lima': 'png',
    'region-callao': 'webp',
    'region-arequipa': 'webp',
    'region-trujillo': 'webp',
    'region-piura': 'webp',
    'region-cusco': 'webp',
    'region-chiclayo': 'webp',
    'region-huancayo': 'svg',
    'region-puno': 'png',
    'region-cajamarca': 'webp',
    'region-ica': 'webp',
    'region-huanuco': 'webp',
    'region-tacna': 'webp',
    'region-chachapoyas': 'webp',
    'region-tarapoto': 'png',
    'region-coronel-portillo': 'png',
    'region-huarmey': 'png',
  };

  function loadStore() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch { return {}; }
  }

  function tryFolderImage(folder, id, onFound, onNotFound) {
    const ext = KNOWN_EXTENSIONS[id];
    if (!ext) { onNotFound(); return; }
    const url = 'assets/' + folder + '/' + id + '.' + ext;
    const probe = new Image();
    probe.onload  = () => onFound(url);
    probe.onerror = () => onNotFound();
    probe.src = url;
  }

  function getIconEl(card) {
    return card.querySelector('.service-icon') || card.querySelector('.region-flag');
  }

  function applyImage(card, dataUrl) {
    const icon = getIconEl(card);
    if (!icon) return;
    const existing = icon.querySelector('img');
    if (existing) existing.remove();
    const svg = icon.querySelector(':scope > svg');
    if (svg) svg.style.display = 'none';
    const img = document.createElement('img');
    img.src = dataUrl;
    img.alt = '';
    // Dimensiones explícitas + decode async = cero layout shift
    img.width = 36;
    img.height = 36;
    img.decoding = 'async';
    img.loading = 'eager';
    icon.insertBefore(img, icon.firstChild);
    card.classList.add('has-image');
  }

  // 1° assets/{folder}/{id}.{ext} → 2° localStorage (fallback) → 3° SVG por defecto
  function resolveCardImage(card, id, folder, store) {
    tryFolderImage(folder, id,
      (url) => applyImage(card, url),
      () => { if (store[id]) applyImage(card, store[id]); }
    );
  }

  Consultia.initServicesUploader = function () {
    const store = loadStore();

    document.querySelectorAll('.services-grid .service-card').forEach((card, i) => {
      const id = SERVICE_IDS[i];
      if (!id) return;
      card.dataset.service = id;
      resolveCardImage(card, id, 'services', store);
    });

    document.querySelectorAll('.regiones-grid .region-card').forEach((card, i) => {
      const id = REGION_IDS[i];
      if (!id) return;
      card.dataset.service = id;
      resolveCardImage(card, id, 'regions', store);
    });
  };
})();
