/**
 * Modal de alerta personalizado — reemplaza alert() nativo.
 * Uso: showAppAlert('Título', 'Mensaje') o showAppAlert('Mensaje')
 */
(function () {
    'use strict';

    // Crear modal al cargar
    function createModal() {
        if (document.getElementById('appAlertOverlay')) return;
        var overlay = document.createElement('div');
        overlay.id = 'appAlertOverlay';
        overlay.style.cssText = 'display:none;position:fixed;inset:0;z-index:9999999;background:rgba(13,37,54,0.45);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);align-items:center;justify-content:center;padding:20px;';
        overlay.innerHTML = '<div id="appAlertCard" style="background:#ffffff;border-radius:20px;max-width:380px;width:100%;padding:32px 28px 24px;text-align:center;box-shadow:0 25px 60px rgba(0,0,0,0.15);border:1px solid #e2e8f0;animation:appAlertIn 0.25s ease-out;">' +
            '<div id="appAlertIcon" style="width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:24px;"></div>' +
            '<h3 id="appAlertTitle" style="font-size:17px;font-weight:900;color:#0d2536;margin:0 0 8px;line-height:1.3;"></h3>' +
            '<p id="appAlertMsg" style="font-size:13px;color:#64748b;line-height:1.6;margin:0 0 22px;white-space:pre-line;"></p>' +
            '<button id="appAlertBtn" type="button" style="width:100%;padding:13px;background:#0d2536;color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:800;cursor:pointer;transition:0.2s;" onmouseover="this.style.background=\'#15324d\'" onmouseout="this.style.background=\'#0d2536\'">Entendido</button>' +
            '</div>';
        document.body.appendChild(overlay);

        // Estilos de animación
        var style = document.createElement('style');
        style.textContent = '@keyframes appAlertIn{from{opacity:0;transform:scale(0.92) translateY(10px);}to{opacity:1;transform:scale(1) translateY(0);}}';
        document.head.appendChild(style);

        document.getElementById('appAlertBtn').addEventListener('click', closeAppAlert);
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closeAppAlert();
        });
    }

    // Detectar tipo por contenido
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
            // Solo un argumento: extraer título del mensaje
            var full = String(titleOrMsg || '');
            var lines = full.split('\n');
            title = lines[0].replace(/^[^\w\s]*\s*/, '').substring(0, 60);
            message = lines.length > 1 ? lines.slice(1).join('\n').trim() : '';
        }
        if (typeof msg === 'function') { callback = msg; message = ''; }
        _alertCallback = callback || null;

        var type = detectType(title, message);
        var icons = {
            success: { bg: '#ecfdf5', color: '#10b981', icon: 'fa-circle-check' },
            error: { bg: '#fef2f2', color: '#ef4444', icon: 'fa-circle-xmark' },
            warning: { bg: '#fffbeb', color: '#f59e0b', icon: 'fa-triangle-exclamation' },
            info: { bg: '#eff6ff', color: '#3b82f6', icon: 'fa-circle-info' }
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
})();
