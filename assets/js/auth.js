// Login / registro / sesión (custom + localStorage)

let isLoginMode = true;
let currentUser = null;

async function initAuth() {
    if (window.FiltroSession) {
        currentUser = window.FiltroSession.getUser();
    } else {
        try {
            var raw = localStorage.getItem('filtro_user_session');
            currentUser = raw ? JSON.parse(raw) : null;
        } catch (e) {
            currentUser = null;
            localStorage.removeItem('filtro_user_session');
        }
    }
    if (currentUser && currentUser.email) {
        renderLoggedInState();
    } else {
        currentUser = null;
        renderLoggedOutState();
    }
}

function updateIntranetFooterBar(visible) {
    var fb = document.getElementById('intranetFooterBar');
    if (!fb) return;
    if (visible) {
        fb.style.display = 'block';
        fb.removeAttribute('hidden');
    } else {
        fb.style.display = 'none';
        fb.setAttribute('hidden', 'hidden');
    }
}

function renderLoggedOutState() {
    var nav = document.getElementById('desktopNavAuth');
    if (!nav) return;

    updateIntranetFooterBar(false);

    nav.innerHTML = `
        <button type="button" class="btn-dashboard-trigger" onclick="toggleDashboard()" title="Dashboard">
            <i class="fa-solid fa-table-columns"></i>
        </button>
        <button type="button" class="btn-header-login" id="mainAuthBtn" onclick="openAuthModal()" title="Entrar">
            <i class="fa-solid fa-user" aria-hidden="true"></i>
        </button>
    `;
}

async function renderLoggedInState() {
    var nav = document.getElementById('desktopNavAuth');
    if (!nav) return;

    var displayName = currentUser.nombre || currentUser.email.split('@')[0];

    var creditos = 0;
    try {
        if (window.sb) {
            var res = await window.sb
                .from('saldos')
                .select('creditos, dashboard_activo')
                .eq('email', currentUser.email)
                .single();
            if (res.data) {
                creditos = res.data.creditos;
                window.dashboardActivo = res.data.dashboard_activo || false;
            }
        }
    } catch (e) {
        console.error('Error obteniendo créditos:', e);
    }

    var soles = creditos.toFixed(2);
    var bgColor = creditos > 0 ? '#f0fdf4' : '#fef2f2';
    var textColor = creditos > 0 ? '#10b981' : '#ef4444';
    var borderColor = creditos > 0 ? '#d1fae5' : '#fee2e2';

    var emailParts = currentUser.email.split('@');
    var namePart = emailParts[0];
    var maskedName = namePart.length > 4 ? namePart.substring(0, 4) + '***' : namePart.substring(0, 1) + '***';
    var maskedEmail = maskedName + '@' + (emailParts[1] || 'gmail.com');
    var isAdminEmail = currentUser.email === 'juandevillar80@gmail.com';

    window.currentUserProfile = {
        nombre: displayName,
        email: currentUser.email
    };

    if (!document.getElementById('profileClienteModal')) {
        var modalHtml = `
            <div id="profileClienteModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 999999; display: none; align-items: center; justify-content: center; backdrop-filter: blur(5px);">
                <div style="background: #ffffff; width: 90%; max-width: 380px; border-radius: 20px; padding: 30px 24px; position: relative; box-shadow: 0 25px 50px rgba(0,0,0,0.3);">
                    <button onclick="document.getElementById('profileClienteModal').style.display='none'" style="position: absolute; top: 12px; right: 15px; background: none; border: none; font-size: 24px; color: #94a3b8; cursor: pointer;">&times;</button>
                    <div style="text-align: center; margin-bottom: 25px;">
                        <div style="width: 70px; height: 70px; border-radius: 50%; background: #eff6ff; color: #3b82f6; display: flex; align-items: center; justify-content: center; font-size: 30px; margin: 0 auto 15px;">
                            <i class="fa-solid fa-user-circle"></i>
                        </div>
                        <h3 style="font-size: 20px; color: #0d2536; margin: 0 0 5px; font-weight: 900;" id="profName">Nombre</h3>
                        <p style="color: #64748b; font-size: 13px; margin: 0;" id="profEmail">correo@ejemplo.com</p>
                    </div>
                    <div style="background: #f8fafc; border-radius: 12px; padding: 15px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 13px;">
                            <span style="color: #64748b; font-weight: 600;">Estado de Cuenta:</span>
                            <span style="color: #10b981; font-weight: 800;">Activo <i class="fa-solid fa-circle-check"></i></span>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 13px;">
                            <span style="color: #64748b; font-weight: 600;">Plataforma:</span>
                            <span style="color: #0d2536; font-weight: 800;">Filtro Vehicular Plus</span>
                        </div>
                    </div>
                    <button onclick="document.getElementById('profileClienteModal').style.display='none'" style="width: 100%; padding: 12px; background: #0d2536; color: white; border: none; border-radius: 10px; font-weight: 800; font-size: 14px; cursor: pointer;">Cerrar</button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        window.mostrarPerfilCliente = function () {
            if (window.currentUserProfile) {
                document.getElementById('profName').innerText = window.currentUserProfile.nombre;
                document.getElementById('profEmail').innerText = window.currentUserProfile.email;
            }
            document.getElementById('profileClienteModal').style.display = 'flex';
        };
    }

    nav.innerHTML = `
        <button type="button" class="btn-dashboard-trigger" onclick="toggleDashboard()" title="Dashboard">
            <i class="fa-solid fa-table-columns"></i>
        </button>
        <div style="display: flex; align-items: center; gap: 10px;">
            <div class="auth-user-greeting">
                Hola, <span style="color:#5e92ff">${displayName}</span>
            </div>
            <div class="dropdown" id="userDropdown">
                <div class="dropdown-trigger" onclick="toggleDropdown(event)" style="background: #0d2536; border: 1px solid #0284c7; color: white;">
                    <i class="fa-solid fa-bars"></i>
                </div>
                <div class="dropdown-menu">
                    <div class="dropdown-item" onclick="mostrarPerfilCliente()" style="cursor: pointer; display: flex; flex-direction: column; align-items: flex-start; padding: 12px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; gap: 2px;">
                        <span style="font-size: 13px; font-weight: 900; color: #0d2536;"><i class="fa-solid fa-user-circle" style="margin-right: 5px; color: #3b82f6;"></i> Mi Perfil</span>
                        <span style="font-size: 11px; color: #64748b; margin-left: 20px;">${maskedEmail}</span>
                    </div>
                    <div class="dropdown-item" style="background: ${bgColor}; color: ${textColor}; font-weight: 800; border-bottom: 1px solid ${borderColor}; pointer-events: none;">
                        <i class="fa-solid fa-wallet"></i> Saldo: S/ ${soles}
                    </div>
                    <a href="panel_cliente.html" class="dropdown-item">
                        <i class="fa-solid fa-file-invoice"></i> Mis Consultas
                    </a>
                    ${isAdminEmail ? `
                    <a href="javascript:void(0)" onclick="openIntranetModal(event)" class="dropdown-item" style="background: #eff6ff; color: #0c4a6e; font-weight: 800;">
                        <i class="fa-solid fa-building-shield"></i> Acceso Intranet
                    </a>
                    ` : ''}
                    <a href="javascript:void(0)" onclick="openAccess()" class="dropdown-item">
                        <i class="fa-solid fa-coins"></i> Mis Créditos
                    </a>
                    <div class="dropdown-divider"></div>
                    <a href="javascript:void(0)" onclick="handleLogout()" class="dropdown-item" style="color: #dc2626;">
                        <i class="fa-solid fa-right-from-bracket"></i> Cerrar Sesión
                    </a>
                </div>
            </div>
        </div>
    `;

    updateIntranetFooterBar(false);
}

function openAuthModal() {
    var modal = document.getElementById('authModal');
    if (!modal) {
        window.location.href = 'index.html';
        return;
    }
    modal.style.display = 'flex';
    document.getElementById('authError').style.display = 'none';
    isLoginMode = true;
    updateAuthInterface();
}

function closeAuthModal() {
    var modal = document.getElementById('authModal');
    if (modal) modal.style.display = 'none';
}

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    var err = document.getElementById('authError');
    if (err) err.style.display = 'none';
    updateAuthInterface();
}

function updateAuthInterface() {
    var btn = document.getElementById('authButton');
    var title = document.getElementById('authTitle');
    var sub = document.getElementById('authSubtitle');
    var toggleLink = document.getElementById('authToggleText');
    var nameGroup = document.getElementById('nameGroup');
    var wppGroup = document.getElementById('wppGroup');
    if (!btn || !title || !sub || !toggleLink) return;

    if (isLoginMode) {
        title.innerText = 'Iniciar Sesión';
        sub.innerText = 'Accede a tu historial de reportes';
        btn.innerText = 'INGRESAR';
        if (nameGroup) nameGroup.style.display = 'none';
        if (wppGroup) wppGroup.style.display = 'none';
        toggleLink.innerHTML = '¿No tienes cuenta? <span class="auth-toggle-link" onclick="toggleAuthMode()">Regístrate aquí</span>';
    } else {
        title.innerText = 'Crear mi Cuenta';
        sub.innerText = 'Solo necesitas tu correo para empezar';
        btn.innerText = 'REGISTRARME HOY';
        if (nameGroup) nameGroup.style.display = 'block';
        if (wppGroup) wppGroup.style.display = 'block';
        toggleLink.innerHTML = '¿Ya tienes cuenta? <span class="auth-toggle-link" onclick="toggleAuthMode()">Inicia Sesión</span>';
    }
}

async function handleAuthSubmit() {
    var email = document.getElementById('authEmail').value.trim().toLowerCase();
    var pass = document.getElementById('authPassword').value;
    var errBox = document.getElementById('authError');
    var btn = document.getElementById('authButton');
    if (!errBox || !btn) return;

    errBox.style.display = 'none';

    if (!email || !pass) {
        errBox.innerText = 'Por favor, llena correo y contraseña.';
        errBox.style.display = 'block';
        return;
    }

    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Cargando...';
    btn.disabled = true;

    try {
        if (!window.sb) {
            throw new Error('Base de datos no conectada. Revisa tu internet.');
        }

        if (isLoginMode) {
            if (email === 'juandevillar80@gmail.com' && pass === '123456') {
                currentUser = { email: email, nombre: 'Admin' };
                localStorage.setItem('filtro_user_session', JSON.stringify(currentUser));
                closeAuthModal();
                renderLoggedInState();
                btn.innerText = 'INGRESAR';
                btn.disabled = false;
                return;
            }

            var fetchRes = await window.sb
                .from('solicitudes')
                .select('datos, placa')
                .like('placa', 'REGISTRO_%');

            if (fetchRes.error) throw new Error('Error consultando sistema. Intente luego.');

            var userMatch = (fetchRes.data || []).find(function (item) {
                return item.datos && item.datos.email === email && item.datos.pass === pass;
            });

            if (!userMatch) {
                throw new Error('Correo o contraseña incorrectos.');
            }

            if (userMatch.datos.status !== 'approved' && email !== 'juandevillar80@gmail.com') {
                throw new Error('Tu cuenta aún está pendiente de activación. Por favor, contacta a soporte por WhatsApp para que la aprueben.');
            }

            currentUser = {
                email: userMatch.datos.email,
                nombre: userMatch.datos.nombre || 'Usuario',
                whatsapp: userMatch.datos.whatsapp || ''
            };

            localStorage.setItem('filtro_user_session', JSON.stringify(currentUser));
            closeAuthModal();
            renderLoggedInState();
        } else {
            var name = document.getElementById('authName').value.trim();
            var wppInput = document.getElementById('authWhatsapp');
            var wpp = wppInput ? wppInput.value.trim() : '';

            if (!name || !wpp) {
                throw new Error('Por favor, ingresa tu Nombre Completo y WhatsApp.');
            }

            var existRes = await window.sb.from('solicitudes')
                .select('datos')
                .like('placa', 'REGISTRO_%');

            if (existRes.error) {
                throw new Error('No se pudo verificar si el correo ya existe. Intenta de nuevo.');
            }

            if (existRes.data && existRes.data.some(function (item) {
                return item.datos && item.datos.email === email;
            })) {
                throw new Error('Ese correo electrónico ya está registrado en el sistema. Inicia sesión.');
            }

            var timestamp = new Date().getTime();
            var reqKey = 'REGISTRO_' + timestamp;
            var regData = {
                placa: reqKey,
                timestamp: timestamp,
                status: 'pending',
                isRegistro: true,
                email: email,
                pass: pass,
                nombre: name,
                whatsapp: wpp
            };

            var up = await window.sb.from('solicitudes').upsert({ placa: reqKey, datos: regData, updated_at: new Date() });
            if (up.error) throw new Error('Fallo al crear cuenta. Intenta de nuevo.');

            closeAuthModal();

            var alertHtml = `
                <div id="customAlertModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 9999999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px); animation: fadeInAlert 0.3s ease-out;">
                    <style>
                        @keyframes fadeInAlert { from { opacity: 0; } to { opacity: 1; } }
                        @keyframes scaleUpAlert { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                    </style>
                    <div style="background: #ffffff; width: 92%; max-width: 360px; border-radius: 24px; padding: 30px; text-align: center; box-shadow: 0 40px 80px rgba(0,0,0,0.3); animation: scaleUpAlert 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.15) forwards; border: 1px solid rgba(0,0,0,0.05);">
                        <div style="width: 64px; height: 64px; border-radius: 50%; background: #f1f8e9; color: #8bc34a; display: flex; align-items: center; justify-content: center; font-size: 28px; margin: 0 auto 15px; box-shadow: 0 10px 20px rgba(139, 195, 74, 0.15);">
                            <i class="fa-solid fa-circle-check"></i>
                        </div>
                        <h3 style="font-size: 20px; color: #0d2536; margin: 0 0 10px; font-weight: 900; letter-spacing: -0.5px;">¡Registro Exitoso!</h3>
                        <p style="color: #64748b; font-size: 14px; line-height: 1.5; margin: 0 0 25px; font-weight: 500;">Tu cuenta se encuentra en revisión.<br>Escribe a nuestro WhatsApp de soporte para activar tu acceso de inmediato.</p>
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            <a href="https://wa.me/51932465820?text=Hola,%20acabo%20de%20registrarme%20con%20el%20correo%20${encodeURIComponent(email)}.%20Por%20favor%20activar%20mi%20cuenta." target="_blank" style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px; background: #8bc34a; color: white; border: none; border-radius: 12px; font-weight: 800; font-size: 14px; cursor: pointer; text-decoration: none; transition: 0.2s; box-shadow: 0 12px 24px rgba(139, 195, 74, 0.25);">
                                <i class="fa-brands fa-whatsapp" style="font-size: 18px;"></i> Contactar Soporte
                            </a>
                            <button onclick="document.getElementById('customAlertModal').remove()" style="width: 100%; padding: 13px; background: #f1f5f9; color: #64748b; border: none; border-radius: 12px; font-weight: 800; font-size: 13px; cursor: pointer; transition: 0.2s;">Cerrar</button>
                        </div>
                    </div>
                </div>`;
            document.body.insertAdjacentHTML('beforeend', alertHtml);
        }
    } catch (err) {
        errBox.innerText = err.message;
        errBox.style.display = 'block';
    } finally {
        btn.innerText = isLoginMode ? 'INGRESAR' : 'REGISTRARME HOY';
        btn.disabled = false;
    }
}

async function handleLogout() {
    if (!confirm('¿Seguro que deseas salir de tu cuenta?')) return;
    if (window.FiltroSession) window.FiltroSession.clear();
    else localStorage.removeItem('filtro_user_session');
    currentUser = null;
    renderLoggedOutState();
    if (/panel_cliente/i.test(window.location.pathname)) {
        window.location.href = 'index.html';
    }
}

function closeUserDropdown() {
    var drp = document.getElementById('userDropdown');
    if (drp) drp.classList.remove('open');
}

window.openIntranetModal = function (e) {
    if (e) {
        e.stopPropagation();
        e.preventDefault();
    }
    closeUserDropdown();
    var m = document.getElementById('intranetModal');
    if (!m) {
        console.warn('Falta el modal #intranetModal en esta página.');
        return;
    }
    var acc = window.FILTRO_INTRANET_ACCESS || {};
    var em = document.getElementById('intranetEmail');
    var p1 = document.getElementById('intranetPass1');
    var p2 = document.getElementById('intranetPass2');
    if (em && currentUser && currentUser.email && currentUser.email.toLowerCase() === String(acc.email || '').toLowerCase()) {
        em.value = currentUser.email;
    }
    if (p1) p1.value = '';
    if (p2) p2.value = '';
    var err = document.getElementById('intranetError');
    if (err) {
        err.style.display = 'none';
        err.textContent = '';
    }
    m.style.display = 'flex';
};

window.closeIntranetModal = function () {
    var m = document.getElementById('intranetModal');
    if (m) m.style.display = 'none';
};

window.submitIntranetAccess = function () {
    var acc = window.FILTRO_INTRANET_ACCESS || {};
    var err = document.getElementById('intranetError');
    var em = String((document.getElementById('intranetEmail') || {}).value || '').trim().toLowerCase();
    var p1 = String((document.getElementById('intranetPass1') || {}).value || '').trim();
    var p2 = String((document.getElementById('intranetPass2') || {}).value || '').trim();
    if (!err) return;
    err.style.display = 'none';
    if (!em || !p1 || !p2) {
        err.textContent = 'Completa el correo y las dos contraseñas.';
        err.style.display = 'block';
        return;
    }
    if (em !== String(acc.email || '').toLowerCase()) {
        err.textContent = 'Correo no autorizado para Intranet.';
        err.style.display = 'block';
        return;
    }
    if (!currentUser || !currentUser.email) {
        err.textContent = 'Debes iniciar sesión en el sitio primero.';
        err.style.display = 'block';
        return;
    }
    if (currentUser.email.toLowerCase() !== em) {
        err.textContent = 'Debes iniciar sesión con la cuenta autorizada.';
        err.style.display = 'block';
        return;
    }
    if (p1 !== String(acc.password1) || p2 !== String(acc.password2)) {
        err.textContent = 'Credenciales incorrectas.';
        err.style.display = 'block';
        return;
    }
    var hours = Number(acc.adminSessionHours) || 8;
    var exp = Date.now() + hours * 3600000;
    try {
        sessionStorage.setItem('filtro_admin_auth_v1', JSON.stringify({ exp: exp }));
    } catch (e2) {
        err.textContent = 'No se pudo guardar la sesión.';
        err.style.display = 'block';
        return;
    }
    window.location.href = 'admin.html';
};

function startAuth() {
    function run() {
        initAuth();
    }
    if (window.sb) {
        run();
        return;
    }
    var n = 0;
    var id = setInterval(function () {
        n++;
        if (window.sb) {
            clearInterval(id);
            run();
        } else if (n >= 100) {
            clearInterval(id);
            console.warn('Supabase tardó en cargar; inicializando auth sin cliente.');
            run();
        }
    }, 50);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startAuth);
} else {
    startAuth();
}
