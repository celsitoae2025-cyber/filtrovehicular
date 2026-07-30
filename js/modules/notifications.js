/* ============================================================
   NOTIFICATIONS — lista en vista del cliente + badge en sidebar
   Lee de la tabla `notifications` de Supabase (RLS por auth.uid()).
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  function getSB() {
    return (window.Consultia && window.Consultia.supabase) || null;
  }

  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    var now = Date.now();
    var diff = Math.floor((now - d.getTime()) / 1000);
    if (diff < 60) return 'Hace un momento';
    if (diff < 3600) return 'Hace ' + Math.floor(diff / 60) + ' min';
    if (diff < 86400) return 'Hace ' + Math.floor(diff / 3600) + ' h';
    var days = Math.floor(diff / 86400);
    if (diff < 604800) return 'Hace ' + days + (days === 1 ? ' día' : ' días');
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function iconForType(type) {
    if (type === 'credits') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12h8M12 8v8"/></svg>';
    }
    if (type === 'system') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z"/><path d="M12 8v5M12 16h.01"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
  }

  async function loadNotifications() {
    var sb = getSB();
    if (!sb) return [];
    var user = await Consultia.Auth.getUser();
    if (!user) return [];
    var res = await sb
      .from('notifications')
      .select('id, type, title, body, meta, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    if (res.error) {
      console.error('[notifications] error:', res.error);
      return [];
    }
    return res.data || [];
  }

  function render(items) {
    var list = document.getElementById('notifList');
    var empty = document.getElementById('notifEmpty');
    if (!list || !empty) return;

    if (!items.length) {
      list.hidden = true;
      list.innerHTML = '';
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    list.hidden = false;

    function esc(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    list.innerHTML = items.map(function (n) {
      var unread = !n.read_at;
      var img = n.meta && n.meta.image_url
        ? '<img class="notif-image" src="' + esc(n.meta.image_url) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">'
        : '';
      return '<li class="notif-item' + (unread ? ' is-unread' : '') + '" data-id="' + esc(n.id) + '">' +
        '<span class="notif-icon notif-icon-' + esc(n.type || 'info') + '">' + iconForType(n.type) + '</span>' +
        '<div class="notif-body">' +
          '<div class="notif-head"><strong>' + esc(n.title) + '</strong><span class="notif-when">' + fmtDate(n.created_at) + '</span></div>' +
          img +
          (n.body ? '<p>' + esc(n.body) + '</p>' : '') +
        '</div>' +
        (unread ? '<span class="notif-dot" aria-label="No leída"></span>' : '') +
      '</li>';
    }).join('');
  }

  async function markAllAsRead() {
    var sb = getSB();
    if (!sb) return;
    var res = await sb.rpc('mark_all_notifications_read');
    if (res.error) {
      console.error('[notifications] mark all error:', res.error);
      return;
    }
    var items = await loadNotifications();
    render(items);
    updateBadge();
  }

  async function markOneAsRead(id) {
    var sb = getSB();
    if (!sb) return;
    await sb.rpc('mark_notification_read', { n_id: id });
    updateBadge();
  }

  // Memoria de la última cuenta vista para detectar nuevas notificaciones
  var _lastUnreadCount = null;
  var _lastSeenIds = null;
  var _pollInterval = null;

  // --------------------------------------------------------------
  // Aviso de mantenimiento — modal grande con contenido hardcodeado
  // en app.html, visible para todo usuario logueado hasta que lo
  // cierre. El cierre se recuerda en este navegador (localStorage),
  // por banner-id, para que futuros avisos (con otro data-banner-id)
  // vuelvan a mostrarse.
  // --------------------------------------------------------------
  function dismissKey(banner) {
    return 'fv_banner_dismissed_' + (banner.dataset.bannerId || 'default');
  }

  function checkDashboardBanner() {
    var banner = document.getElementById('dashBanner');
    if (!banner) return;
    var dismissed = false;
    try { dismissed = localStorage.getItem(dismissKey(banner)) === '1'; } catch (e) {}
    banner.hidden = dismissed;
    // Mini-notice: no bloquea la interfaz, no aplica modal-open
  }

  function dismissDashboardBanner() {
    var banner = document.getElementById('dashBanner');
    if (!banner) return;
    try { localStorage.setItem(dismissKey(banner), '1'); } catch (e) {}
    banner.hidden = true;
  }

  async function showToastForLatestUnread() {
    var sb = getSB();
    if (!sb) return;
    try {
      var r = await sb
        .from('notifications')
        .select('id, type, title, body')
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(1);
      if (r.error || !r.data || !r.data.length) return;
      var n = r.data[0];
      // Evitar mostrar el mismo toast repetido si volvió por foco
      if (_lastSeenIds && _lastSeenIds.indexOf(n.id) >= 0) return;
      _lastSeenIds = (_lastSeenIds || []).concat(n.id).slice(-10);
      if (Consultia.toast) {
        Consultia.toast({
          type: n.type === 'credits' ? 'success' : 'info',
          title: n.title || 'Nueva notificación',
          message: n.body || '',
          duration: 6500
        });
      }
    } catch (e) { /* silencioso */ }
  }

  async function updateBadge() {
    var sb = getSB();
    if (!sb) return;
    var res = await sb.rpc('unread_notifications_count');
    var count = (res && !res.error) ? (res.data || 0) : 0;

    // Si la cuenta SUBIÓ desde la última lectura → llegó una nueva: mostrar toast
    if (_lastUnreadCount !== null && count > _lastUnreadCount) {
      showToastForLatestUnread();
    }
    _lastUnreadCount = count;

    var badges = document.querySelectorAll('[data-notif-badge]');
    badges.forEach(function (b) {
      if (count > 0) {
        b.textContent = count > 99 ? '99+' : String(count);
        b.hidden = false;
      } else {
        b.hidden = true;
      }
    });
    // Campana dorada + shake cuando hay notificaciones sin leer (sidebar)
    var bells = document.querySelectorAll('.sb-action[data-nav="notificaciones"]');
    bells.forEach(function (el) {
      el.classList.toggle('has-notif', count > 0);
    });

    // Campana del topbar (al lado del avatar) — solo aparece cuando count > 0
    var topbarBell = document.getElementById('topbarBell');
    if (topbarBell) {
      topbarBell.hidden = count === 0;
    }

    checkDashboardBanner();
  }

  Consultia.renderNotifications = async function () {
    var items = await loadNotifications();
    render(items);
  };

  Consultia.initNotifications = function () {
    var btn = document.getElementById('notifMarkAllBtn');
    if (btn) btn.addEventListener('click', markAllAsRead);

    var bannerClose = document.getElementById('dashBannerClose');
    if (bannerClose) bannerClose.addEventListener('click', dismissDashboardBanner);
    checkDashboardBanner();

    // Delegación: click en una notificación la marca como leída y actualiza UI
    document.addEventListener('click', function (e) {
      var item = e.target.closest('.notif-item.is-unread');
      if (!item) return;
      var id = item.dataset.id;
      if (!id) return;
      item.classList.remove('is-unread');
      var dot = item.querySelector('.notif-dot');
      if (dot) dot.remove();
      markOneAsRead(id);
    });

    // Refresca al cambiar de sesión; detiene polling si no hay sesión
    if (Consultia.Auth && Consultia.Auth.onAuthChange) {
      Consultia.Auth.onAuthChange(function (event, session) {
        if (session && session.user) {
          updateBadge();
          if (!_pollInterval) _pollInterval = setInterval(updateBadge, 30000);
        } else {
          if (_pollInterval) { clearInterval(_pollInterval); _pollInterval = null; }
          _lastUnreadCount = null;
          var banner = document.getElementById('dashBanner');
          if (banner) banner.hidden = true;
          document.body.classList.remove('modal-open');
        }
      });
    }

    // Primer badge + inicia polling (si no lo inició onAuthChange ya)
    updateBadge();
    if (!_pollInterval) _pollInterval = setInterval(updateBadge, 30000);

    // Refresca el badge cuando la pestaña vuelve al foco (feedback inmediato)
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) updateBadge();
    });
  };
})();
