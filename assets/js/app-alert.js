/**
 * Modal de alerta y confirmación personalizado.
 * Colores institucionales: #111b21 + #25d366
 * Fondo arcoíris difuminado estilo premium.
 */
(function () {
    'use strict';

    var RAINBOW_BG = 'linear-gradient(135deg, rgba(37,211,102,0.25) 0%, rgba(59,130,246,0.22) 25%, rgba(168,85,247,0.22) 50%, rgba(236,72,153,0.22) 75%, rgba(251,191,36,0.18) 100%)';

    function createModal() {
        if (document.getElementById('appAlertOverlay')) return;
        var overlay = document.createElement('div');
        overlay.id = 'appAlertOverlay';
        overlay.style.cssText = 'display:none;position:fixed;inset:0;z-index:9999999;background:' + RAINBOW_BG + ';backdrop-filter:blur(24px) saturate(150%);-webkit-backdrop-filter:blur(24px) saturate(150%);align-items:center;justify-content:center;padding:20px;';
        overlay.innerHTML = '<div id="appAlertCard" style="background:#ffffff;border-radius:16px;max-width:360px;width:92%;padding:28px 24px 24px;text-align:center;border:1px solid #e5e7eb;animation:appAlertIn 0.2s ease-out;">' +
            '<div id="appAlertIcon" style="width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:20px;"></div>' +
            '<h3 id="appAlertTitle" style="font-size:15px;font-weight:700;color:#111b21;margin:0 0 6px;line-height:1.3;"></h3>' +
            '<p id="appAlertMsg" style="font-size:12px;color:#6b7280;line-height:1.6;margin:0 0 20px;white-space:pre-line;font-weight:400;"></p>' +
            '<button id="appAlertBtn" type="button" style="width:100%;padding:12px;background:#25d366;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;transition:background 0.2s;" onmouseover="this.style.background=\'#1ebe5d\'" onmouseout="this.style.background=\'#25d366\'">Entendido</button>' +
            '</div>';
        document.body.appendChild(overlay);

        var style = document.createElement('style');
        style.textContent = '@keyframes appAlertIn{from{opacity:0;transform:scale(0.95);}to{opacity:1;transform:scale(1);}}';
        document.head.appendChild(style);

        document.getElementById('appAlertBtn').addEventListener('click', closeAppAlert);
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closeAppAlert();
        });
    }

    function detectType(title, msg) {
        var text = (title + ' ' + msg).toLowerCase();
        if (text.includes('error') || text.includes('fallo') || text.includes('no se pudo') || text.includes('no encontr')) return 'error';
        if (text.includes('insuficiente') || text.includes('advertencia') || text.includes('warning') || text.includes('no tienes') || text.includes('ingresa')) return 'warning';
        if (text.includes('éxito') || text.includes('exito') || text.includes('confirmado') || text.includes('procesado') || text.includes('publicado') || text.includes('aprobado') || text.includes('activado') || text.includes('guardado') || text.includes('recargaron')) return 'success';
        return 'info';
    }

    var _alertCallback = null;

    window.showAppAlert = function (titleOrMsg, msg, callback) {
        createModal();
        var title, message;
        if (msg !== undefined && msg !== null) {
            title = String(titleOrMsg || '');
            message = String(msg || '');
        } else {
            var full = String(titleOrMsg || '');
            var lines = full.split('\n');
            title = lines[0].replace(/^[^\w\s]*\s*/, '').substring(0, 60);
            message = lines.length > 1 ? lines.slice(1).join('\n').trim() : '';
        }
        if (typeof msg === 'function') { callback = msg; message = ''; }
        _alertCallback = callback || null;

        var type = detectType(title, message);
        var icons = {
            success: { bg: 'rgba(37,211,102,0.1)', color: '#25d366', icon: 'fa-circle-check' },
            error: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', icon: 'fa-circle-xmark' },
            warning: { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', icon: 'fa-triangle-exclamation' },
            info: { bg: 'rgba(37,211,102,0.1)', color: '#25d366', icon: 'fa-circle-info' }
        };
        var cfg = icons[type];

        var iconEl = document.getElementById('appAlertIcon');
        iconEl.style.background = cfg.bg;
        iconEl.innerHTML = '<i class="fa-solid ' + cfg.icon + '" style="color:' + cfg.color + ';"></i>';

        document.getElementById('appAlertTitle').textContent = title;
        document.getElementById('appAlertMsg').textContent = message;
        document.getElementById('appAlertOverlay').style.display = 'flex';
    };

    window.closeAppAlert = function () {
        var ov = document.getElementById('appAlertOverlay');
        if (ov) ov.style.display = 'none';
        if (_alertCallback && typeof _alertCallback === 'function') {
            var cb = _alertCallback;
            _alertCallback = null;
            cb();
        }
    };

    // Override global alert
    window._originalAlert = window.alert;
    window.alert = function (msg) {
        if (typeof window.showAppAlert === 'function') {
            window.showAppAlert(msg);
        } else {
            window._originalAlert(msg);
        }
    };

    // Confirm personalizado
    window.showAppConfirm = function (msg, onAccept, onCancel) {
        createModal();
        var overlay = document.getElementById('appAlertOverlay');
        var type = 'info';
        var text = String(msg || '');
        var lines = text.split('\n');
        var title = lines[0].replace(/^[^\w\s¿]*\s*/, '').substring(0, 60);
        var message = lines.length > 1 ? lines.slice(1).join('\n').trim() : '';

        if (text.toLowerCase().includes('eliminar') || text.toLowerCase().includes('borrar') || text.toLowerCase().includes('limpiar') || text.toLowerCase().includes('salir')) type = 'warning';

        var icons = {
            success: { bg: 'rgba(37,211,102,0.1)', color: '#25d366', icon: 'fa-circle-check' },
            error: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', icon: 'fa-circle-xmark' },
            warning: { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', icon: 'fa-triangle-exclamation' },
            info: { bg: 'rgba(37,211,102,0.1)', color: '#25d366', icon: 'fa-circle-info' }
        };
        var cfg = icons[type];

        var iconEl = document.getElementById('appAlertIcon');
        iconEl.style.background = cfg.bg;
        iconEl.innerHTML = '<i class="fa-solid ' + cfg.icon + '" style="color:' + cfg.color + ';"></i>';

        document.getElementById('appAlertTitle').textContent = title;
        document.getElementById('appAlertMsg').textContent = message;

        var btnEl = document.getElementById('appAlertBtn');
        btnEl.style.display = 'none';
        var card = document.getElementById('appAlertCard');
        var existingBtns = document.getElementById('appConfirmBtns');
        if (existingBtns) existingBtns.remove();

        var btnsDiv = document.createElement('div');
        btnsDiv.id = 'appConfirmBtns';
        btnsDiv.style.cssText = 'display:flex;gap:10px;margin-top:4px;';
        btnsDiv.innerHTML = '<button id="appConfirmNo" type="button" style="flex:1;padding:12px;background:#f9fafb;color:#6b7280;border:1px solid #e5e7eb;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;transition:0.2s;">Cancelar</button>' +
            '<button id="appConfirmYes" type="button" style="flex:1;padding:12px;background:#25d366;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;transition:0.2s;" onmouseover="this.style.background=\'#1ebe5d\'" onmouseout="this.style.background=\'#25d366\'">Aceptar</button>';
        card.appendChild(btnsDiv);

        overlay.style.display = 'flex';

        function cleanup() {
            overlay.style.display = 'none';
            btnsDiv.remove();
            btnEl.style.display = 'block';
        }

        document.getElementById('appConfirmYes').onclick = function () {
            cleanup();
            if (onAccept) onAccept();
        };
        document.getElementById('appConfirmNo').onclick = function () {
            cleanup();
            if (onCancel) onCancel();
        };
        overlay.onclick = function (e) {
            if (e.target === overlay) {
                cleanup();
                if (onCancel) onCancel();
            }
        };
    };
})();
