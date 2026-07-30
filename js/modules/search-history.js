/* ============================================================
   SEARCH HISTORY — Guarda y sugiere las últimas búsquedas
   del usuario para autocompletar en los inputs de consulta.
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  var STORAGE_KEY = 'fv-search-history';
  var MAX_ITEMS = 10;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function getHistory() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_) { return []; }
  }

  function saveHistory(list) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_ITEMS))); } catch (_) {}
  }

  // Agrega una búsqueda al historial (evita duplicados)
  function addSearch(query, category) {
    if (!query || query.length < 2) return;
    var list = getHistory();
    // Remover si ya existe
    list = list.filter(function (item) { return item.q !== query; });
    // Agregar al inicio
    list.unshift({ q: query, cat: category || '', ts: Date.now() });
    saveHistory(list);
  }

  // Muestra sugerencias debajo de un input
  function attachSuggestions(inputEl) {
    if (!inputEl || inputEl.dataset.historyAttached) return;
    inputEl.dataset.historyAttached = 'true';

    var dropdown = document.createElement('div');
    dropdown.className = 'search-suggestions';
    dropdown.hidden = true;
    inputEl.parentNode.style.position = 'relative';
    inputEl.parentNode.appendChild(dropdown);

    function showSuggestions() {
      var list = getHistory();
      var val = inputEl.value.trim().toLowerCase();
      var filtered = val
        ? list.filter(function (item) { return item.q.toLowerCase().indexOf(val) !== -1; })
        : list;
      if (filtered.length === 0) { dropdown.hidden = true; return; }

      dropdown.innerHTML = filtered.slice(0, 5).map(function (item) {
        return '<button type="button" class="ss-item" data-value="' + esc(item.q) + '">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>' +
          '<span>' + esc(item.q) + '</span>' +
        '</button>';
      }).join('');
      dropdown.hidden = false;
    }

    function hideSuggestions() {
      setTimeout(function () { dropdown.hidden = true; }, 150);
    }

    inputEl.addEventListener('focus', showSuggestions);
    inputEl.addEventListener('input', showSuggestions);
    inputEl.addEventListener('blur', hideSuggestions);

    dropdown.addEventListener('click', function (e) {
      var item = e.target.closest('.ss-item');
      if (item) {
        inputEl.value = item.dataset.value;
        dropdown.hidden = true;
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        inputEl.focus();
      }
    });
  }

  Consultia.SearchHistory = {
    add: addSearch,
    getAll: getHistory,
    attach: attachSuggestions,
    clear: function () { localStorage.removeItem(STORAGE_KEY); }
  };

  // Auto-adjuntar a todos los inputs de consulta al inicializar
  Consultia.initSearchHistory = function () {
    document.querySelectorAll('.form-row .input[type="text"], .form-row .input[type="search"]').forEach(attachSuggestions);
  };
})();
