/**
 * Modal de alerta y confirmación personalizado.
 * Usa clases .modal-* del sistema unificado.
 * Estilo idéntico al modal de login: icono circular, título, subtítulo, botones.
 */
(function () {
    'use strict';

    var iconMap = {
        success: { icon: 'fa-solid fa-check',            bg: '#25d366' },
        error:   { icon: 'fa-solid fa-triangle-exclamation', bg: '#ef4444' },
        warning: { icon: 'fa-solid fa-exclamation',       bg: '#f59e0b' },
        info:    { icon: 'fa-solid fa-info',              bg: '#111b21' }
    };

    function createModal() {
        if (document.getElementById('appAlertOverlay')) return;
        var overlay = document.createElement('div');
        overlay.id = 'appAlertOverlay';
        overlay.className = 'modal-overlay';
        overlay.style.zIndex = '9999999';
        overlay.innerHTML =
            '<div id="appAlertCard" class="modal-card" style="max-width:360px;">' +
                '<div class="modal-header">' +
                    '<button id="appAlertClose" type="button" class="modal-close" aria-label="Cerrar"><i class="fa-solid fa-xmark"></i></button>' +
                    '<div id="appAlertIcon" style="width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;">' +
                        '<i id="appAlertIconI" style="font-size:20px;color:#fff;"></i>' +
                    '</div>' +
                    '<div id="appAlertTitle" class="modal-title"></div>' +
                    '<div id="appAlertMsg" class="modal-subtitle" style="margin-top:4px; line-height:1.5; white-space:pre-line;"></div>' +
                '</div>' +
                '<div class="modal-body" style="padding-top:8px;">' +
                    '<button id="appAlertBtn" type="button" class="modal-btn modal-btn-primary">Entendido</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(overlay);

        document.getElementById('appAlertBtn').addEventListener('click', closeAppAlert);
        document.getElementById('appAlertClose').addEventListener('click', closeAppAlert);
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

    function applyIcon(type) {
        var cfg = iconMap[type] || iconMap.info;
        var iconWrap = document.getElementById('appAlertIcon');
        var iconI = document.getElementById('appAlertIconI');
        iconWrap.style.background = cfg.bg;
        iconI.className = cfg.icon;
    }

    var _alertCallback = null;

    window.showAppAlert = function (titleOrMsg, msg, callback) {
        createModal();
        var title, message;
        if (msg !== undefined && msg !== null && typeof msg !== 'function') {
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
        applyIcon(type);
        document.getElementById('appAlertTitle').textContent = title;
        document.getElementById('appAlertMsg').textContent = message;
        document.getElementById('appAlertMsg').style.display = message ? 'block' : 'none';

        // Reset: show single button, remove confirm buttons if exist
        document.getElementById('appAlertBtn').style.display = '';
        var existingBtns = document.getElementById('appConfirmBtns');
        if (existingBtns) existingBtns.remove();

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

    window._originalAlert = window.alert;
    window.alert = function (msg) {
        if (typeof window.showAppAlert === 'function') {
            window.showAppAlert(msg);
        } else {
            window._originalAlert(msg);
        }
    };

    window.showAppConfirm = function (msg, onAccept, onCancel) {
        createModal();
        var overlay = document.getElementById('appAlertOverlay');
        var text = String(msg || '');
        var lines = text.split('\n');
        var title = lines[0].replace(/^[^\w\s¿]*\s*/, '').substring(0, 60);
        var message = lines.length > 1 ? lines.slice(1).join('\n').trim() : '';

        var type = text.toLowerCase().match(/eliminar|borrar|limpiar|salir/) ? 'warning' : 'info';
        applyIcon(type);

        document.getElementById('appAlertTitle').textContent = title;
        document.getElementById('appAlertMsg').textContent = message;
        document.getElementById('appAlertMsg').style.display = message ? 'block' : 'none';

        // Hide single button, add confirm pair
        var btnEl = document.getElementById('appAlertBtn');
        btnEl.style.display = 'none';
        var existingBtns = document.getElementById('appConfirmBtns');
        if (existingBtns) existingBtns.remove();

        var btnsDiv = document.createElement('div');
        btnsDiv.id = 'appConfirmBtns';
        btnsDiv.style.cssText = 'display:flex; gap:10px;';
        btnsDiv.innerHTML =
            '<button id="appConfirmNo" type="button" class="modal-btn modal-btn-secondary" style="flex:1;">Cancelar</button>' +
            '<button id="appConfirmYes" type="button" class="modal-btn modal-btn-primary" style="flex:1;">Aceptar</button>';
        btnEl.parentNode.appendChild(btnsDiv);

        overlay.style.display = 'flex';

        function cleanup() {
            overlay.style.display = 'none';
            btnsDiv.remove();
            btnEl.style.display = '';
        }

        document.getElementById('appConfirmYes').onclick = function () { cleanup(); if (onAccept) onAccept(); };
        document.getElementById('appConfirmNo').onclick = function () { cleanup(); if (onCancel) onCancel(); };
        overlay.onclick = function (e) { if (e.target === overlay) { cleanup(); if (onCancel) onCancel(); } };
    };
})();
