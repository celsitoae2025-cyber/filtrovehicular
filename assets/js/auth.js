// Login / registro / sesión (custom + localStorage)

let isLoginMode = true;
let currentUser = null;
var _adminEmail = 'juandevillar80@gmail.com';

function _isAdmin(email, pass) {
    return email === _adminEmail && pass === '201090';
}

async function initAuth() {
    // Leer sesión real
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

    window.plataformaActiva = false;
    window.dashboardActivo = false;

    if (currentUser && currentUser.email) {
        hideLoginScreen();

        // Admin siempre premium
        if (currentUser.email === _adminEmail) {
            window.plataformaActiva = true;
            window.dashboardActivo = true;
        }

        // Verificar plataforma activa desde Supabase
        if (window.sb) {
            try {
                var res = await window.sb.from('saldos').select('plataforma_activa, dashboard_activo, creditos').eq('email', currentUser.email).single();
                if (res.data) {
                    window.plataformaActiva = res.data.plataforma_activa || false;
                    window.dashboardActivo = res.data.dashboard_activo || false;
                }
            } catch (e) {}
        }

        // Admin override
        if (currentUser.email === _adminEmail) {
            window.plataformaActiva = true;
            window.dashboardActivo = true;
        }

        renderLoggedInState();

        // Actualizar logo
        var logoStatus = document.getElementById('logoStatus');
        if (logoStatus) logoStatus.textContent = window.plataformaActiva ? 'Premium' : 'Estándar';
    } else {
        currentUser = null;
        hideLoginScreen();
        renderLoggedOutState();
    }
}

// Login screen: mostrar/ocultar
function showLoginScreen() {
    var ls = document.getElementById('loginScreen');
    if (ls) ls.style.display = 'flex';
}

function hideLoginScreen() {
    var ls = document.getElementById('loginScreen');
    if (ls) {
        ls.classList.add('hide');
        setTimeout(function() { ls.style.display = 'none'; }, 400);
    }
    // Mostrar contenido principal
    var main = document.getElementById('mainAppContent');
    if (main) main.style.display = 'block';
}

// Login desde la pantalla de login
async function handleLoginScreen() {
    var email = document.getElementById('loginScreenEmail').value.trim().toLowerCase();
    var pass = document.getElementById('loginScreenPass').value;
    var btn = document.getElementById('loginScreenBtn');
    var err = document.getElementById('loginScreenError');

    err.style.display = 'none';

    if (!email || !pass) {
        err.textContent = 'Ingresa tu correo y contraseña.';
        err.style.display = 'block';
        return;
    }

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando...';
    btn.disabled = true;

    try {
        if (!window.sb) throw new Error('Sin conexión. Verifica tu internet.');

        // Admin
        if (_isAdmin(email, pass)) {
            currentUser = { email: email, nombre: 'Admin' };
            localStorage.setItem('filtro_user_session', JSON.stringify(currentUser));
            hideLoginScreen();
            renderLoggedInState();
            return;
        }

        // Buscar usuario
        var res = await window.sb.from('solicitudes').select('datos, placa').like('placa', 'REGISTRO_%');
        if (res.error) throw new Error('Error al consultar. Intenta luego.');

        var match = (res.data || []).find(function(item) {
            if (!item.datos || item.datos.email !== email) return false;
            return item.datos.pass === pass || item.datos.password === pass;
        });

        if (!match) throw new Error('Correo o contraseña incorrectos.');

        if (match.datos.status !== 'approved' && email !== _adminEmail) {
            throw new Error('Tu cuenta está pendiente de activación. Contacta a soporte por WhatsApp.');
        }

        currentUser = {
            email: match.datos.email,
            nombre: match.datos.nombre || 'Usuario',
            whatsapp: match.datos.whatsapp || ''
        };
        localStorage.setItem('filtro_user_session', JSON.stringify(currentUser));
        hideLoginScreen();
        renderLoggedInState();
        checkPromoPlataforma();

    } catch (e) {
        err.textContent = e.message;
        err.style.display = 'block';
        btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Acceder';
        btn.disabled = false;
    }
}

// Promo plataforma desactivada (modo premium)
function checkPromoPlataforma() {}
function closePromoModal() {}

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

    var logoStatus = document.getElementById('logoStatus');
    if (logoStatus) logoStatus.textContent = 'Demo';

    updateIntranetFooterBar(false);

    nav.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;">
            <button type="button" class="btn-header-login" id="mainAuthBtn" onclick="openAuthModal()" title="Entrar" style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:#ffffff;border:none;cursor:pointer;">
                <i class="fa-solid fa-user" aria-hidden="true" style="color:#111b21;font-size:16px;"></i>
            </button>
        </div>
    `;
}

async function renderLoggedInState() {
    var nav = document.getElementById('desktopNavAuth');
    if (!nav) return;

    var displayName = currentUser.nombre || currentUser.email.split('@')[0];

    var creditos = 0;
    var plataformaActiva = false;
    
    // Inicializar siempre en false por defecto
    window.dashboardActivo = false;
    window.plataformaActiva = false;
    
    try {
        if (window.sb) {
            var res = await window.sb
                .from('saldos')
                .select('creditos, dashboard_activo, plataforma_activa')
                .eq('email', currentUser.email)
                .single();
            if (res.data) {
                creditos = res.data.creditos || 0;
                window.dashboardActivo = res.data.dashboard_activo || false;
                plataformaActiva = res.data.plataforma_activa || false;
                window.plataformaActiva = plataformaActiva;
            }
        }
    } catch (e) {
        console.error('Error obteniendo créditos:', e);
        // Mantener valores por defecto en false si hay error
        window.dashboardActivo = false;
        window.plataformaActiva = false;
    }

    // Actualizar logo según estado de plataforma
    var logoStatus = document.getElementById('logoStatus');
    if (logoStatus) {
        logoStatus.textContent = plataformaActiva ? 'Premium' : 'Estándar';
    }

    var creditosDisplay = Math.floor(creditos);

    var emailParts = currentUser.email.split('@');
    var namePart = emailParts[0];
    var maskedName = namePart.length > 4 ? namePart.substring(0, 4) + '***' : namePart.substring(0, 1) + '***';
    var maskedEmail = maskedName + '@' + (emailParts[1] || 'gmail.com');
    var isAdminEmail = currentUser.email === _adminEmail;

    window.currentUserProfile = {
        nombre: displayName,
        email: currentUser.email
    };

    if (!document.getElementById('profileClienteModal')) {
        var modalHtml = `
            <div id="profileClienteModal" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(248,250,252,0.30);z-index:999999;display:none;align-items:center;justify-content:center;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);font-family:'Roboto',sans-serif;padding:16px;overflow-y:auto;">
                <div style="background:#ffffff;width:100%;max-width:420px;border-radius:20px;overflow:hidden;position:relative;box-shadow:0 20px 60px rgba(13,37,54,0.15),0 0 0 1px rgba(13,37,54,0.06);margin:auto;">

                    <!-- Header navy -->
                    <div style="background:linear-gradient(135deg,#111b21 0%,#1f2c34 100%);padding:30px 24px 24px;text-align:center;position:relative;">
                        <button onclick="document.getElementById('profileClienteModal').style.display='none'" style="position:absolute;top:14px;right:16px;background:none;border:none;font-size:18px;color:rgba(255,255,255,0.35);cursor:pointer;transition:0.2s;padding:4px;line-height:1;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='rgba(255,255,255,0.35)'"><i class="fa-solid fa-xmark"></i></button>
                        <div style="width:60px;height:60px;border-radius:50%;background:rgba(139,195,74,0.12);border:2px solid rgba(139,195,74,0.3);display:flex;align-items:center;justify-content:center;margin:0 auto 14px;">
                            <i class="fa-solid fa-user" style="font-size:22px;color:#25d366;"></i>
                        </div>
                        <h3 style="font-size:18px;color:#ffffff;margin:0 0 4px;font-weight:800;" id="profName">Nombre</h3>
                        <p style="color:rgba(255,255,255,0.5);font-size:12px;margin:0;font-weight:500;" id="profEmail">correo@ejemplo.com</p>
                    </div>

                    <!-- Contenido -->
                    <div style="padding:20px 24px 24px;">

                        <!-- Info personal -->
                        <div style="margin-bottom:18px;">
                            <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Información personal</div>
                            <div style="display:flex;flex-direction:column;gap:0;">
                                <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #f1f5f9;">
                                    <div style="width:32px;height:32px;background:#f1f5f9;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                                        <i class="fa-solid fa-user-tag" style="color:#111b21;font-size:12px;"></i>
                                    </div>
                                    <div style="flex:1;min-width:0;">
                                        <div style="font-size:10px;color:#94a3b8;font-weight:500;">Nombre completo</div>
                                        <div style="font-size:13px;color:#111b21;font-weight:700;" id="profNameField">---</div>
                                    </div>
                                </div>
                                <div style="display:flex;align-items:center;gap:12px;padding:12px 0;">
                                    <div style="width:32px;height:32px;background:#f1f5f9;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                                        <i class="fa-solid fa-envelope" style="color:#111b21;font-size:12px;"></i>
                                    </div>
                                    <div style="flex:1;min-width:0;">
                                        <div style="font-size:10px;color:#94a3b8;font-weight:500;">Correo electrónico</div>
                                        <div style="font-size:13px;color:#111b21;font-weight:700;word-break:break-all;" id="profEmailField">---</div>
                                    </div>
                                    <div style="width:22px;height:22px;background:#dcfce7;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;" title="Correo verificado">
                                        <i class="fa-solid fa-check" style="color:#22c55e;font-size:10px;"></i>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Seguridad -->
                        <div style="margin-bottom:20px;">
                            <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Seguridad</div>
                            <div id="profChangePassSection">
                                <button onclick="toggleChangePassword()" id="btnTogglePass" style="width:100%;padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;cursor:pointer;display:flex;align-items:center;gap:10px;transition:0.2s;" onmouseover="this.style.borderColor='#cbd5e1'" onmouseout="this.style.borderColor='#e2e8f0'">
                                    <div style="width:32px;height:32px;background:#f1f5f9;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                                        <i class="fa-solid fa-lock" style="color:#111b21;font-size:12px;"></i>
                                    </div>
                                    <span style="font-size:13px;color:#111b21;font-weight:600;flex:1;text-align:left;">Cambiar contraseña</span>
                                    <i class="fa-solid fa-chevron-right" style="color:#cbd5e1;font-size:11px;"></i>
                                </button>
                                <div id="changePassForm" style="display:none;margin-top:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;">
                                    <div style="margin-bottom:10px;">
                                        <label style="font-size:11px;color:#64748b;font-weight:600;display:block;margin-bottom:4px;">Contraseña actual</label>
                                        <input type="password" id="profCurrentPass" placeholder="••••••••" style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:'Roboto',sans-serif;outline:none;transition:0.2s;box-sizing:border-box;" onfocus="this.style.borderColor='#111b21'" onblur="this.style.borderColor='#e2e8f0'">
                                    </div>
                                    <div style="margin-bottom:10px;">
                                        <label style="font-size:11px;color:#64748b;font-weight:600;display:block;margin-bottom:4px;">Nueva contraseña</label>
                                        <input type="password" id="profNewPass" placeholder="••••••••" style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:'Roboto',sans-serif;outline:none;transition:0.2s;box-sizing:border-box;" onfocus="this.style.borderColor='#111b21'" onblur="this.style.borderColor='#e2e8f0'">
                                    </div>
                                    <div style="margin-bottom:12px;">
                                        <label style="font-size:11px;color:#64748b;font-weight:600;display:block;margin-bottom:4px;">Confirmar nueva contraseña</label>
                                        <input type="password" id="profConfirmPass" placeholder="••••••••" style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:'Roboto',sans-serif;outline:none;transition:0.2s;box-sizing:border-box;" onfocus="this.style.borderColor='#111b21'" onblur="this.style.borderColor='#e2e8f0'">
                                    </div>
                                    <div id="profPassError" style="display:none;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:12px;color:#dc2626;font-weight:600;"></div>
                                    <div id="profPassSuccess" style="display:none;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:12px;color:#15803d;font-weight:600;"></div>
                                    <button onclick="handleChangePassword()" style="width:100%;padding:10px;background:#111b21;color:#fff;border:none;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;transition:0.2s;" onmouseover="this.style.background='#1f2c34'" onmouseout="this.style.background='#111b21'">
                                        Actualizar contraseña
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Panel Admin (solo para admin) -->
                        ${isAdminEmail ? `
                        <div style="margin-bottom:18px;">
                            <button onclick="window.location.href='admin.html'" style="width:100%;padding:14px 16px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;cursor:pointer;display:flex;align-items:center;gap:12px;transition:0.2s;" onmouseover="this.style.borderColor='#111b21';this.style.background='#ffffff'" onmouseout="this.style.borderColor='#e2e8f0';this.style.background='#f8fafc'">
                                <div style="width:32px;height:32px;background:linear-gradient(135deg,#111b21,#1f2c34);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                                    <i class="fa-solid fa-shield-halved" style="color:#25d366;font-size:13px;"></i>
                                </div>
                                <div style="flex:1;text-align:left;">
                                    <div style="font-size:13px;color:#111b21;font-weight:700;">Panel Administrador</div>
                                    <div style="font-size:10px;color:#94a3b8;font-weight:500;">Acceso completo al sistema</div>
                                </div>
                                <i class="fa-solid fa-chevron-right" style="color:#cbd5e1;font-size:12px;"></i>
                            </button>
                        </div>
                        ` : ''}

                        <!-- Botón cerrar -->
                        <button onclick="document.getElementById('profileClienteModal').style.display='none'" style="width:100%;padding:12px;background:#f1f5f9;color:#64748b;border:none;border-radius:10px;font-weight:600;font-size:13px;cursor:pointer;transition:0.2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        window.toggleChangePassword = function() {
            var form = document.getElementById('changePassForm');
            form.style.display = form.style.display === 'none' ? 'block' : 'none';
        };

        window.handleChangePassword = async function() {
            var errEl = document.getElementById('profPassError');
            var okEl = document.getElementById('profPassSuccess');
            errEl.style.display = 'none';
            okEl.style.display = 'none';

            var current = document.getElementById('profCurrentPass').value;
            var newP = document.getElementById('profNewPass').value;
            var confirmPass = document.getElementById('profConfirmPass').value;

            if (!current || !newP || !confirmPass) {
                errEl.textContent = 'Completa todos los campos.';
                errEl.style.display = 'block';
                return;
            }
            if (newP.length < 6) {
                errEl.textContent = 'La nueva contraseña debe tener al menos 6 caracteres.';
                errEl.style.display = 'block';
                return;
            }
            if (newP !== confirmPass) {
                errEl.textContent = 'Las contraseñas no coinciden.';
                errEl.style.display = 'block';
                return;
            }

            try {
                if (!window.sb) throw new Error('Sin conexión');
                var email = window.currentUserProfile.email;
                var { data: users } = await window.sb.from('solicitudes').select('placa, datos').like('placa', 'REGISTRO_%');
                var userReg = (users || []).find(u => u.datos && u.datos.email === email);
                if (!userReg) {
                    errEl.textContent = 'No se encontró tu registro. Contacta soporte.';
                    errEl.style.display = 'block';
                    return;
                }
                var storedPass = userReg.datos.password || userReg.datos.pass;
                if (String(storedPass) !== current) {
                    errEl.textContent = 'La contraseña actual es incorrecta.';
                    errEl.style.display = 'block';
                    return;
                }
                var updatedDatos = Object.assign({}, userReg.datos, { password: newP, pass: newP });
                await window.sb.from('solicitudes').update({ datos: updatedDatos }).eq('placa', userReg.placa);

                okEl.textContent = 'Contraseña actualizada correctamente.';
                okEl.style.display = 'block';
                document.getElementById('profCurrentPass').value = '';
                document.getElementById('profNewPass').value = '';
                document.getElementById('profConfirmPass').value = '';
            } catch(e) {
                errEl.textContent = 'Error al actualizar. Intenta de nuevo.';
                errEl.style.display = 'block';
            }
        };

        window.mostrarPerfilCliente = function () {
            if (window.currentUserProfile) {
                document.getElementById('profName').innerText = window.currentUserProfile.nombre;
                document.getElementById('profEmail').innerText = window.currentUserProfile.email;
                document.getElementById('profNameField').innerText = window.currentUserProfile.nombre;
                document.getElementById('profEmailField').innerText = window.currentUserProfile.email;
            }
            // Reset password form
            document.getElementById('changePassForm').style.display = 'none';
            document.getElementById('profPassError').style.display = 'none';
            document.getElementById('profPassSuccess').style.display = 'none';
            document.getElementById('profileClienteModal').style.display = 'flex';
        };
    }

    nav.innerHTML = `
        <div style="display: flex; align-items: center; gap: 6px;">
            <div class="auth-user-greeting">
                Hola, <span style="color:#25d366; font-weight:600;">${displayName}</span>
            </div>
            <div class="dropdown" id="userDropdown">
                <div class="dropdown-trigger" onclick="toggleDropdown(event)" style="position:relative; background:#ffffff; border:1px solid #e5e7eb;">
                    <span style="font-size:13px; font-weight:700; font-family:'Roboto',sans-serif; color:#111b21;">${creditosDisplay} Créditos</span>
                    <div style="width:1px; height:16px; background:#e5e7eb;"></div>
                    <i class="fa-solid fa-bars" style="font-size:15px; color:#111b21;"></i>
                    <span id="notificationBadge" style="position:absolute; top:-5px; right:-5px; background:#ef4444; color:white; font-size:9px; font-weight:800; width:16px; height:16px; border-radius:50%; align-items:center; justify-content:center; border:2px solid #ffffff; display:none;"></span>
                </div>
                <div class="dropdown-menu" id="userDropdownMenu" style="background:#ffffff; border:1px solid #e5e7eb;">
                    <div onclick="mostrarPerfilCliente()" style="cursor: pointer; padding: 18px 20px 14px; border-bottom: 1px solid #f1f5f9;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                            <span style="font-size: 14px; font-weight: 800; color: #111b21;">Mi Perfil</span>
                            <span style="background: #25d366; color: #ffffff; font-size: 9px; font-weight: 700; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.5px;">PREMIUM</span>
                        </div>
                        <span style="font-size: 11px; color: #6b7280; font-weight: 500;">${maskedEmail}</span>
                    </div>
                    <div style="padding: 14px 20px; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: space-between;">
                        <div>
                            <div style="font-size: 20px; font-weight: 900; color: #25d366; letter-spacing: -0.5px; line-height: 1;">${creditosDisplay} Créditos</div>
                            <div style="font-size: 10px; color: #6b7280; font-weight: 600; margin-top: 2px;">CRÉDITOS DISPONIBLES</div>
                        </div>
                    </div>
                    <div style="padding: 4px 0;">
                        <a href="panel_cliente.html" onclick="closeUserDropdown()" class="dropdown-item" id="misConsultasLink" style="color:#111b21;">
                            <i class="fa-solid fa-file-invoice" style="color: #25d366;"></i> Mis Consultas
                        </a>
                        <a href="javascript:void(0)" onclick="closeUserDropdown(); openAccess();" class="dropdown-item" style="color:#111b21;">
                            <i class="fa-solid fa-coins" style="color: #25d366;"></i> Mis Créditos
                        </a>
                        <a href="javascript:void(0)" onclick="closeUserDropdown(); openChangePasswordModal();" class="dropdown-item" style="color:#111b21;">
                            <i class="fa-solid fa-key" style="color: #25d366;"></i> Cambiar Contraseña
                        </a>
                        <a href="tutorial.html" onclick="closeUserDropdown();" class="dropdown-item" style="color:#111b21;">
                            <i class="fa-solid fa-book-open" style="color: #25d366;"></i> Tutorial
                        </a>
                    </div>
                    <div style="border-top: 1px solid #f1f5f9; padding: 4px 0;">
                        <a href="javascript:void(0)" onclick="handleLogout()" class="dropdown-item" style="color: #6b7280; font-weight: 500;">
                            <i class="fa-solid fa-right-from-bracket" style="color: #6b7280;"></i> Cerrar Sesión
                        </a>
                    </div>
                </div>
            </div>
        </div>
    `;

    updateIntranetFooterBar(false);
    
    // Iniciar sistema de verificación de notificaciones
    startNotificationChecker();
}

// Sistema de notificaciones
function startNotificationChecker() {
    if (!currentUser) return;
    
    // Guardar estado inicial
    const initialState = {
        plataformaActiva: window.plataformaActiva || false,
        dashboardActivo: window.dashboardActivo || false
    };
    
    // Verificar cada 30 segundos
    setInterval(async () => {
        if (!currentUser || !window.sb) return;
        
        try {
            const { data, error } = await window.sb
                .from('saldos')
                .select('plataforma_activa, dashboard_activo')
                .eq('email', currentUser.email)
                .single();
            
            if (error || !data) return;
            
            const newPlataformaActiva = data.plataforma_activa || false;
            const newDashboardActivo = data.dashboard_activo || false;
            
            // Detectar cambios
            const plataformaActivada = !initialState.plataformaActiva && newPlataformaActiva;
            const dashboardActivado = !initialState.dashboardActivo && newDashboardActivo;
            
            if (plataformaActivada || dashboardActivado) {
                // Actualizar estado global
                window.plataformaActiva = newPlataformaActiva;
                window.dashboardActivo = newDashboardActivo;
                
                // Actualizar logo
                const logoStatus = document.getElementById('logoStatus');
                if (logoStatus) {
                    logoStatus.textContent = newPlataformaActiva ? 'Premium' : 'Estándar';
                }
                
                // Mostrar notificación
                showActivationNotification(plataformaActivada, dashboardActivado);
                
                // Actualizar estado inicial para no mostrar de nuevo
                initialState.plataformaActiva = newPlataformaActiva;
                initialState.dashboardActivo = newDashboardActivo;
                
                // Actualizar UI del usuario
                if (typeof renderLoggedInState === 'function') {
                    renderLoggedInState();
                }
            }
        } catch (e) {
            console.error('Error verificando notificaciones:', e);
        }
    }, 30000); // Cada 30 segundos
}

function showActivationNotification(plataformaActivada, dashboardActivado) {
    // Mostrar badge en ícono
    const badge = document.getElementById('notificationBadge');
    if (badge) {
        badge.textContent = '1';
        badge.style.display = 'flex';
    }
    
    // Agregar notificación al dropdown
    const dropdownMenu = document.getElementById('userDropdownMenu');
    if (dropdownMenu) {
        const notificationHtml = plataformaActivada ? `
            <div id="activationNotification" class="dropdown-item" onclick="closeNotification('plataforma')" style="cursor: pointer; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); color: #92400e; font-weight: 700; padding: 13px 20px; border-bottom: 2px solid #f59e0b; animation: pulse 2s infinite;">
                <i class="fa-solid fa-rocket" style="color: #f59e0b;"></i> ¡Plataforma Activada!
            </div>
        ` : `
            <div id="activationNotification" class="dropdown-item" onclick="closeNotification('dashboard')" style="cursor: pointer; background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); color: #1e40af; font-weight: 700; padding: 13px 20px; border-bottom: 2px solid #3b82f6; animation: pulse 2s infinite;">
                <i class="fa-solid fa-table-columns" style="color: #3b82f6;"></i> ¡Dashboard Activado!
            </div>
        `;
        
        dropdownMenu.insertAdjacentHTML('afterbegin', notificationHtml);
    }
    
    // Mostrar modal de bienvenida
    setTimeout(() => {
        showWelcomeModal(plataformaActivada, dashboardActivado);
    }, 1000);
}

function showWelcomeModal(plataformaActivada, dashboardActivado) {
    const modalHtml = `
        <div id="welcomeModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(17,27,33,0.5); z-index: 9999999; display: flex; align-items: center; justify-content: center; padding: 20px;" onclick="if(event.target===this){dismissNotification();}">
            <div style="background: #ffffff; width: 92%; max-width: 400px; border-radius: 20px; padding: 35px 28px; text-align: center; border: 1px solid #e5e7eb; animation: scaleUp 0.3s ease forwards;">
                <style>
                    @keyframes scaleUp { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                </style>
                <div style="width: 72px; height: 72px; border-radius: 50%; background: rgba(37,211,102,0.1); color: #25d366; display: flex; align-items: center; justify-content: center; font-size: 32px; margin: 0 auto 20px;">
                    <i class="fa-solid fa-rocket"></i>
                </div>
                <h2 style="font-size: 22px; color: #111b21; margin: 0 0 8px; font-weight: 900;">¡Bienvenido!</h2>
                <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 24px; font-weight: 500;">Tu cuenta <span style="color: #25d366; font-weight: 700;">PREMIUM</span> está activa. Tienes acceso completo a:</p>

                <div style="background: #f9fafb; border-radius: 14px; padding: 18px 20px; margin-bottom: 24px; border: 1px solid #e5e7eb; text-align: left;">
                    <div style="display: grid; gap: 14px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="width: 30px; height: 30px; background: #25d366; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                <i class="fa-solid fa-check" style="color: #ffffff; font-size: 13px;"></i>
                            </div>
                            <span style="font-size: 13px; color: #111b21; font-weight: 600;">22 Servicios Vehiculares</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="width: 30px; height: 30px; background: #25d366; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                <i class="fa-solid fa-check" style="color: #ffffff; font-size: 13px;"></i>
                            </div>
                            <span style="font-size: 13px; color: #111b21; font-weight: 600;">Dashboard Organizado</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="width: 30px; height: 30px; background: #25d366; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                <i class="fa-solid fa-check" style="color: #ffffff; font-size: 13px;"></i>
                            </div>
                            <span style="font-size: 13px; color: #111b21; font-weight: 600;">Historial de Consultas</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="width: 30px; height: 30px; background: #25d366; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                <i class="fa-solid fa-check" style="color: #ffffff; font-size: 13px;"></i>
                            </div>
                            <span style="font-size: 13px; color: #111b21; font-weight: 600;">Acceso Permanente</span>
                        </div>
                    </div>
                </div>

                <button onclick="dismissNotification();" style="width: 100%; padding: 14px; background: #25d366; color: #ffffff; border: none; border-radius: 12px; font-weight: 800; font-size: 14px; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#1ebe5d'" onmouseout="this.style.background='#25d366'">
                    <i class="fa-solid fa-bolt" style="margin-right: 8px;"></i> COMENZAR
                </button>

                <p style="margin-top: 14px; font-size: 11px; color: #9ca3af; line-height: 1.4;">
                    <i class="fa-solid fa-info-circle" style="margin-right: 4px;"></i>
                    Recuerda recargar créditos para realizar consultas
                </p>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function dismissNotification() {
    // Ocultar badge
    const badge = document.getElementById('notificationBadge');
    if (badge) {
        badge.style.display = 'none';
    }
    
    // Eliminar notificación del dropdown
    const notification = document.getElementById('activationNotification');
    if (notification) {
        notification.remove();
    }
    
    // Cerrar modal de bienvenida
    const modal = document.getElementById('welcomeModal');
    if (modal) {
        modal.remove();
    }
}

function closeNotification(type) {
    // Ocultar badge
    const badge = document.getElementById('notificationBadge');
    if (badge) {
        badge.style.display = 'none';
    }
    
    // Eliminar notificación del dropdown
    const notification = document.getElementById('activationNotification');
    if (notification) {
        notification.remove();
    }
    
    // Cerrar dropdown
    closeUserDropdown();
    
    // Mostrar modal de bienvenida si no se ha mostrado
    if (type === 'plataforma') {
        showWelcomeModal(true, false);
    } else {
        showWelcomeModal(false, true);
    }
}

function hideFloatingElements() {
    var wa = document.querySelector('.wa-assistant');
    var wallet = document.getElementById('walletFloatingBtn');
    if (wa) wa.style.display = 'none';
    if (wallet) wallet.style.display = 'none';
    document.body.style.overflow = 'hidden';
}

function showFloatingElements() {
    var wa = document.querySelector('.wa-assistant');
    var wallet = document.getElementById('walletFloatingBtn');
    if (wa) wa.style.display = '';
    if (wallet) wallet.style.display = '';
    document.body.style.overflow = '';
}

function openAuthModal() {
    if (typeof showAuthFloatingModal === 'function') {
        showAuthFloatingModal();
        if (typeof toggleAuthFloatingMode === 'function') toggleAuthFloatingMode();
    }
}

function openRegisterModal() {
    if (typeof showAuthFloatingModal === 'function') {
        showAuthFloatingModal();
    }
}

function closeAuthModal() {
    var modal = document.getElementById('authModal');
    if (modal) modal.style.display = 'none';
    showFloatingElements();
}

function togglePasswordVisibility() {
    var passInput = document.getElementById('authPassword');
    var icon = document.getElementById('togglePasswordIcon');
    if (!passInput || !icon) return;
    
    if (passInput.type === 'password') {
        passInput.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        passInput.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

let loginStep = 1; // 1 = email, 2 = password

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    loginStep = 1; // Reset to step 1
    var err = document.getElementById('authError');
    if (err) err.style.display = 'none';
    
    // Limpiar campos
    var emailInput = document.getElementById('authEmail');
    var passInput = document.getElementById('authPassword');
    if (emailInput) emailInput.value = '';
    if (passInput) passInput.value = '';
    
    updateAuthInterface();
}

function updateAuthInterface() {
    var btn = document.getElementById('authButton');
    var title = document.getElementById('authTitle');
    var sub = document.getElementById('authSubtitle');
    var toggleLink = document.getElementById('authToggleText');
    var nameGroup = document.getElementById('nameGroup');
    var wppGroup = document.getElementById('wppGroup');
    var passwordGroup = document.getElementById('passwordGroup');
    if (!btn || !title || !sub || !toggleLink) return;

    if (isLoginMode) {
        if (loginStep === 1) {
            // Paso 1: Solo email
            title.innerText = 'Iniciar Sesión';
            sub.innerText = 'Ingresa tu correo electrónico';
            btn.innerText = 'CONTINUAR';
            if (passwordGroup) passwordGroup.style.display = 'none';
        } else {
            // Paso 2: Contraseña
            title.innerText = 'Bienvenido de nuevo';
            sub.innerText = 'Ingresa tu contraseña para continuar';
            btn.innerText = 'INGRESAR';
            if (passwordGroup) passwordGroup.style.display = 'block';
        }
        if (nameGroup) nameGroup.style.display = 'none';
        var lastNameGroup = document.getElementById('lastNameGroup');
        if (lastNameGroup) lastNameGroup.style.display = 'none';
        if (wppGroup) wppGroup.style.display = 'none';
        toggleLink.innerHTML = '¿No tienes cuenta? <span class="auth-toggle-link" onclick="toggleAuthMode()" style="color: #111b21; font-weight: 700; cursor: pointer; text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color=\'#25d366\';" onmouseout="this.style.color=\'#111b21\';"> Regístrate aquí</span>';
    } else {
        // Modo Registro
        title.innerText = 'Crear mi Cuenta';
        sub.innerText = 'Solo necesitas tu correo para empezar';
        btn.innerText = 'REGISTRARME HOY';
        if (nameGroup) nameGroup.style.display = 'block';
        var lastNameGroup = document.getElementById('lastNameGroup');
        if (lastNameGroup) lastNameGroup.style.display = 'block';
        if (wppGroup) wppGroup.style.display = 'block';
        if (passwordGroup) passwordGroup.style.display = 'block';
        toggleLink.innerHTML = '¿Ya tienes cuenta? <span class="auth-toggle-link" onclick="toggleAuthMode()" style="color: #111b21; font-weight: 700; cursor: pointer; text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color=\'#25d366\';" onmouseout="this.style.color=\'#111b21\';"> Inicia Sesión</span>';
    }
}

async function handleAuthSubmit() {
    var errBox = document.getElementById('authError');
    var btn = document.getElementById('authButton');
    if (!errBox || !btn) return;

    errBox.style.display = 'none';

    // Modo Login con dos pasos
    if (isLoginMode) {
        if (loginStep === 1) {
            // Paso 1: Validar email
            var email = document.getElementById('authEmail').value.trim().toLowerCase();
            if (!email) {
                errBox.innerText = 'Por favor, ingresa tu correo electrónico.';
                errBox.style.display = 'block';
                return;
            }
            
            // Mostrar indicador de carga
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Verificando...';
            btn.disabled = true;
            
            // Delay visual de 1.5 segundos
            setTimeout(() => {
                // Pasar al paso 2
                loginStep = 2;
                btn.disabled = false;
                updateAuthInterface();
                
                // Focus en campo de contraseña
                setTimeout(() => {
                    var passInput = document.getElementById('authPassword');
                    if (passInput) passInput.focus();
                }, 100);
            }, 1500);
            
            return;
        }
    }

    // Capturar valores DESPUÉS de verificar el paso
    var email = document.getElementById('authEmail').value.trim().toLowerCase();
    var pass = document.getElementById('authPassword').value;


    // Validación para registro o paso 2 de login
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
            if (_isAdmin(email, pass)) {
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
                if (!item.datos || item.datos.email !== email) return false;
                return item.datos.pass === pass || item.datos.password === pass;
            });


            if (!userMatch) {
                throw new Error('Correo o contraseña incorrectos.');
            }

            if (userMatch.datos.status !== 'approved' && email !== _adminEmail) {
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
            var firstNameEl = document.getElementById('authFirstName');
            var lastNameEl = document.getElementById('authLastName');
            var firstName = firstNameEl ? firstNameEl.value.trim() : '';
            var lastName = lastNameEl ? lastNameEl.value.trim() : '';
            var name = (firstName + ' ' + lastName).trim();
            var wppInput = document.getElementById('authWhatsapp');
            var wpp = wppInput ? wppInput.value.trim().replace(/\s/g, '') : '';

            if (!firstName || !lastName) {
                throw new Error('Por favor, ingresa tus nombres y apellidos.');
            }

            if (!wpp || wpp.length !== 9 || wpp[0] !== '9') {
                var hint = document.getElementById('wppHint');
                if (hint) { hint.textContent = 'Ingresa un número válido de 9 dígitos que empiece con 9'; hint.style.display = 'block'; }
                throw new Error('El número de WhatsApp debe tener 9 dígitos y empezar con 9.');
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

            // Obtener enlace del grupo de WhatsApp desde localStorage
            var whatsappGroupLink = localStorage.getItem('whatsapp_group_link') || '';
            var groupButtonHtml = '';
            
            // Si hay enlace de grupo configurado, agregar botón de unirse al grupo
            if (whatsappGroupLink) {
                groupButtonHtml = `
                    <a href="${whatsappGroupLink}" target="_blank" id="joinGroupBtn" style="display: flex; align-items: center; justify-content: center; gap: 10px; padding: 16px; background: linear-gradient(135deg, #111b21 0%, #1f2c34 100%); color: white; border: none; border-radius: 12px; font-weight: 800; font-size: 14px; cursor: pointer; text-decoration: none; transition: all 0.3s; text-transform: uppercase; letter-spacing: 0.5px;" onmouseover="this.style.transform='translateY(-2px)';" onmouseout="this.style.transform='translateY(0)';">
                        <i class="fa-brands fa-whatsapp" style="font-size: 20px;"></i> Unirse al Grupo de Clientes
                    </a>`;
            }

            var alertHtml = `
                <div id="customAlertModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(13,37,54,0.85); z-index: 9999999; display: flex; align-items: center; justify-content: center; animation: fadeInAlert 0.3s ease-out;">
                    <style>
                        @keyframes fadeInAlert { from { opacity: 0; } to { opacity: 1; } }
                        @keyframes scaleUpAlert { from { transform: scale(0.92); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                    </style>
                    <div style="background: #ffffff; width: 90%; max-width: 420px; border-radius: 20px; padding: 35px 30px; text-align: center; animation: scaleUpAlert 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.15) forwards;">
                        <div style="width: 72px; height: 72px; border-radius: 50%; background: linear-gradient(135deg, #25d366 0%, #1ebe5d 100%); color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 32px; margin: 0 auto 20px;">
                            <i class="fa-solid fa-circle-check"></i>
                        </div>
                        <h3 style="font-size: 22px; color: #111b21; margin: 0 0 12px; font-weight: 900; letter-spacing: -0.5px;">¡Cuenta Creada Exitosamente!</h3>
                        <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 28px; font-weight: 500;">Tu registro ha sido recibido correctamente.<br><br>Para <b style="color: #111b21;">activar tu cuenta</b> y comenzar a usar la plataforma, contacta a nuestro equipo de soporte por WhatsApp.<br><br><span style="color: #25d366; font-weight: 700;">Te responderemos en minutos.</span></p>
                        <div style="display: flex; flex-direction: column; gap: 12px;">
                            <a href="https://wa.me/51932465820?text=Hola,%20acabo%20de%20registrarme%20con%20el%20correo%20${encodeURIComponent(email)}.%20Por%20favor%20activar%20mi%20cuenta." target="_blank" style="display: flex; align-items: center; justify-content: center; gap: 10px; padding: 16px; background: linear-gradient(135deg, #25d366 0%, #1ebe5d 100%); color: white; border: none; border-radius: 12px; font-weight: 800; font-size: 14px; cursor: pointer; text-decoration: none; transition: all 0.3s; text-transform: uppercase; letter-spacing: 0.5px;" onmouseover="this.style.transform='translateY(-2px)';" onmouseout="this.style.transform='translateY(0)';">
                                <i class="fa-brands fa-whatsapp" style="font-size: 20px;"></i> Contactar por WhatsApp
                            </a>
                            ${groupButtonHtml}
                            <button onclick="document.getElementById('customAlertModal').remove()" style="width: 100%; padding: 14px; background: #f1f5f9; color: #64748b; border: none; border-radius: 12px; font-weight: 700; font-size: 13px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#e2e8f0';" onmouseout="this.style.background='#f1f5f9';">Entendido</button>
                        </div>
                    </div>
                </div>`;
            document.body.insertAdjacentHTML('beforeend', alertHtml);
            
            // Abrir automáticamente el enlace del grupo después de 2 segundos si existe
            if (whatsappGroupLink) {
                setTimeout(function() {
                    var joinBtn = document.getElementById('joinGroupBtn');
                    if (joinBtn) {
                        joinBtn.click();
                    }
                }, 2000);
            }
        }
    } catch (err) {
        errBox.innerText = err.message;
        errBox.style.display = 'block';
    } finally {
        // Resetear botón según modo y paso
        if (isLoginMode) {
            btn.innerText = loginStep === 1 ? 'CONTINUAR' : 'INGRESAR';
        } else {
            btn.innerText = 'REGISTRARME HOY';
        }
        btn.disabled = false;
    }
}

async function handleLogout() {
    showAppConfirm('¿Seguro que deseas salir de tu cuenta?', function () {
        if (window.FiltroSession) window.FiltroSession.clear();
        else localStorage.removeItem('filtro_user_session');
        currentUser = null;
        renderLoggedOutState();
        if (/panel_cliente/i.test(window.location.pathname)) {
            window.location.href = 'index.html';
        }
    });
}

function closeUserDropdown() {
    var drp = document.getElementById('userDropdown');
    if (drp) drp.classList.remove('open');
    var bd = document.getElementById('dropdownBackdrop');
    if (bd) bd.remove();
}

window.openIntranetModal = function (e) {
    if (e) {
        e.stopPropagation();
        e.preventDefault();
    }
    closeUserDropdown();
    var m = document.getElementById('intranetModal');
    if (!m) {
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
            run();
        }
    }, 50);
}

// ============================================
// CAMBIAR CONTRASEÑA
// ============================================
function openChangePasswordModal() {
    var existing = document.getElementById('changePassModal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'changePassModal';
    modal.style.cssText = 'display:flex;position:fixed;inset:0;z-index:9999999;background:rgba(13,37,54,0.45);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);align-items:center;justify-content:center;padding:20px;';
    modal.onclick = function(e) { if (e.target === modal) modal.remove(); };

    modal.innerHTML = '<div style="background:#fff;border-radius:20px;max-width:380px;width:100%;padding:28px 24px;box-shadow:0 25px 60px rgba(0,0,0,0.15);border:1px solid #e2e8f0;">' +
        '<div style="text-align:center;margin-bottom:20px;">' +
            '<div style="width:50px;height:50px;border-radius:50%;background:#eff6ff;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;"><i class="fa-solid fa-key" style="font-size:20px;color:#3b82f6;"></i></div>' +
            '<h3 style="font-size:17px;font-weight:900;color:#111b21;margin:0 0 4px;">Cambiar Contraseña</h3>' +
            '<p style="font-size:12px;color:#94a3b8;margin:0;">Ingresa tu contraseña actual y la nueva</p>' +
        '</div>' +
        '<div style="margin-bottom:14px;">' +
            '<label style="display:block;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Contraseña actual</label>' +
            '<input type="password" id="cpCurrentPass" placeholder="Tu contraseña actual" style="width:100%;padding:12px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;transition:0.2s;box-sizing:border-box;" onfocus="this.style.borderColor=\'#111b21\'" onblur="this.style.borderColor=\'#e2e8f0\'">' +
        '</div>' +
        '<div style="margin-bottom:14px;">' +
            '<label style="display:block;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Nueva contraseña</label>' +
            '<input type="password" id="cpNewPass" placeholder="Mínimo 6 caracteres" style="width:100%;padding:12px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;transition:0.2s;box-sizing:border-box;" onfocus="this.style.borderColor=\'#111b21\'" onblur="this.style.borderColor=\'#e2e8f0\'">' +
        '</div>' +
        '<div style="margin-bottom:18px;">' +
            '<label style="display:block;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Confirmar nueva contraseña</label>' +
            '<input type="password" id="cpConfirmPass" placeholder="Repite la nueva contraseña" style="width:100%;padding:12px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;transition:0.2s;box-sizing:border-box;" onfocus="this.style.borderColor=\'#111b21\'" onblur="this.style.borderColor=\'#e2e8f0\'">' +
        '</div>' +
        '<div id="cpError" style="display:none;margin-bottom:14px;padding:10px 12px;background:#fef2f2;color:#b91c1c;border-radius:10px;font-size:12px;font-weight:600;"></div>' +
        '<div style="display:flex;gap:10px;">' +
            '<button onclick="document.getElementById(\'changePassModal\').remove()" style="flex:1;padding:13px;background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;">Cancelar</button>' +
            '<button onclick="submitChangePassword()" id="cpSubmitBtn" style="flex:1;padding:13px;background:#111b21;color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:800;cursor:pointer;">Guardar</button>' +
        '</div>' +
    '</div>';

    document.body.appendChild(modal);
}

async function submitChangePassword() {
    var currentPass = document.getElementById('cpCurrentPass').value.trim();
    var newPass = document.getElementById('cpNewPass').value;
    var confirmPass = document.getElementById('cpConfirmPass').value;
    var errBox = document.getElementById('cpError');
    var btn = document.getElementById('cpSubmitBtn');

    errBox.style.display = 'none';

    if (!currentPass) {
        errBox.textContent = 'Ingresa tu contraseña actual.';
        errBox.style.display = 'block';
        return;
    }
    if (newPass.length < 6) {
        errBox.textContent = 'La nueva contraseña debe tener al menos 6 caracteres.';
        errBox.style.display = 'block';
        return;
    }
    if (newPass !== confirmPass) {
        errBox.textContent = 'Las contraseñas nuevas no coinciden.';
        errBox.style.display = 'block';
        return;
    }

    var email = currentUser ? currentUser.email : null;
    if (!email) {
        errBox.textContent = 'No se pudo identificar tu sesión. Cierra sesión e ingresa de nuevo.';
        errBox.style.display = 'block';
        return;
    }

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btn.disabled = true;

    try {
        if (!window.sb) throw new Error('Sin conexión a la base de datos.');

        // Buscar registro del usuario
        var res = await window.sb.from('solicitudes').select('placa, datos').like('placa', 'REGISTRO_%');
        if (res.error) throw new Error('Error consultando. Intenta luego.');

        var userReg = (res.data || []).find(function(item) {
            return item.datos && item.datos.email === email;
        });

        if (!userReg) throw new Error('No se encontró tu registro. Contacta a soporte.');

        // Verificar contraseña actual
        var storedPass = userReg.datos.pass || userReg.datos.password || '';
        if (currentPass !== storedPass) {
            throw new Error('La contraseña actual es incorrecta.');
        }

        // Actualizar contraseña
        userReg.datos.pass = newPass;
        var upRes = await window.sb.from('solicitudes').update({
            datos: userReg.datos,
            updated_at: new Date()
        }).eq('placa', userReg.placa);

        if (upRes.error) throw new Error('Error al actualizar. Intenta de nuevo.');

        document.getElementById('changePassModal').remove();
        alert('Contraseña actualizada correctamente.\n\nUsa tu nueva contraseña la próxima vez que inicies sesión.');

    } catch (e) {
        errBox.textContent = e.message;
        errBox.style.display = 'block';
        btn.innerHTML = 'Guardar';
        btn.disabled = false;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startAuth);
} else {
    startAuth();
}
