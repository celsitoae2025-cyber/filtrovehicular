/* ============================================================
   FAVORITES — consultas guardadas para repetir con un clic.
   Se almacenan en localStorage vinculadas al email del usuario.
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  var STORAGE_KEY = 'fv-favorites';
  var MAX_FAVS = 8;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function getFavs() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_) { return []; }
  }

  function saveFavs(list) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_FAVS))); } catch (_) {}
  }

  var catLabels = {
    'filter': 'Placa', 'reniec': 'Reniec', 'vehiculos': 'Vehículos',
    'sunarp': 'Sunarp', 'sunat': 'Sunat', 'financiero': 'Financiero',
    'estudios': 'Estudios', 'telefonia': 'Telefonía', 'familiares': 'Familia',
    'certificados': 'Certificados', 'actas': 'Actas', 'delitos': 'Justicia',
    'mtc': 'MTC', 'seeker': 'Seeker', 'vip': 'VIP', 'facial': 'Facial',
    'migraciones': 'Internacional', 'extras': 'Extras', 'premium': 'Premium'
  };

  function addFav(query, category) {
    if (!query || query.length < 2) return false;
    var list = getFavs();
    // No duplicar
    var exists = list.some(function (f) { return f.q === query && f.cat === category; });
    if (exists) return false;
    list.unshift({ q: query, cat: category || '', ts: Date.now() });
    saveFavs(list);
    renderPanel();
    return true;
  }

  function removeFav(query, category) {
    var list = getFavs();
    list = list.filter(function (f) { return !(f.q === query && f.cat === category); });
    saveFavs(list);
    renderPanel();
  }

  function isFav(query, category) {
    return getFavs().some(function (f) { return f.q === query && f.cat === category; });
  }

  // Renderiza la lista en el right-panel
  function renderPanel() {
    var card = document.getElementById('rp-favorites');
    var list = document.getElementById('rp-fav-list');
    if (!card || !list) return;
    var favs = getFavs();
    if (!favs.length) { card.hidden = true; return; }

    list.innerHTML = favs.map(function (f) {
      return '<div class="rp-fav-item" data-q="' + esc(f.q) + '" data-cat="' + esc(f.cat) + '">' +
        '<button class="rp-fav-go" type="button" title="Ejecutar consulta">' +
          '<span class="rp-fav-q">' + esc(f.q) + '</span>' +
          '<span class="rp-fav-cat">' + esc(catLabels[f.cat] || f.cat) + '</span>' +
        '</button>' +
        '<button class="rp-fav-del" type="button" title="Quitar de favoritos">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
        '</button>' +
      '</div>';
    }).join('');
    card.hidden = false;
  }

  function bindPanel() {
    var list = document.getElementById('rp-fav-list');
    if (!list) return;
    list.addEventListener('click', function (e) {
      var del = e.target.closest('.rp-fav-del');
      if (del) {
        var item = del.closest('.rp-fav-item');
        if (item) removeFav(item.dataset.q, item.dataset.cat);
        return;
      }
      var go = e.target.closest('.rp-fav-go');
      if (go) {
        var item = go.closest('.rp-fav-item');
        if (!item) return;
        var cat = item.dataset.cat || 'filter';
        var q = item.dataset.q;
        // Navegar a la categoría
        var navBtn = document.querySelector('.nav-item[data-nav="' + cat + '"]');
        if (navBtn) navBtn.click();
        setTimeout(function () {
          var input = document.getElementById(cat + '-input') || document.getElementById('filter-input');
          if (input) {
            input.value = q;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.focus();
          }
        }, 150);
      }
    });
  }

  // Agrega estrella de favorito en los headers de resultado
  function injectStarButton(panelEl, query, category) {
    if (!panelEl || !query) return;
    var header = panelEl.querySelector('.result-header-actions') || panelEl.querySelector('.result-header');
    if (!header) return;
    // No duplicar
    if (header.querySelector('.fav-star-btn')) return;

    var active = isFav(query, category);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fav-star-btn' + (active ? ' is-active' : '');
    btn.title = active ? 'Quitar de favoritos' : 'Guardar en favoritos';
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="' + (active ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';

    btn.addEventListener('click', function () {
      if (isFav(query, category)) {
        removeFav(query, category);
        btn.classList.remove('is-active');
        btn.title = 'Guardar en favoritos';
        btn.querySelector('svg').setAttribute('fill', 'none');
      } else {
        addFav(query, category);
        btn.classList.add('is-active');
        btn.title = 'Quitar de favoritos';
        btn.querySelector('svg').setAttribute('fill', 'currentColor');
      }
    });

    // Si hay result-header-actions, insertar ahí; si no, crear
    var actions = panelEl.querySelector('.result-header-actions');
    if (actions) {
      actions.insertBefore(btn, actions.firstChild);
    } else {
      var rh = panelEl.querySelector('.result-header');
      if (rh) {
        actions = document.createElement('div');
        actions.className = 'result-header-actions';
        actions.appendChild(btn);
        rh.appendChild(actions);
      }
    }
  }

  Consultia.Favorites = {
    add: addFav,
    remove: removeFav,
    isFav: isFav,
    render: renderPanel,
    injectStar: injectStarButton,
  };

  Consultia.initFavorites = function () {
    bindPanel();
    renderPanel();
  };
})();
