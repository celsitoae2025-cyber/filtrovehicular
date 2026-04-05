// =========================================


                async function consultarDNI() {
                    var input = document.getElementById('reniecDniInput');
                    var btn = document.getElementById('btnConsultaDni');
                    var result = document.getElementById('reniecResult');
                    var dni = (input ? input.value.trim() : '');

                    if (!dni || dni.length !== 8 || !/^\d{8}$/.test(dni)) {
                        result.style.display = 'block';
                        result.innerHTML = '<div style="background:#fef2f2; border:1px solid #fecaca; border-radius:10px; padding:12px; text-align:center; font-size:13px; color:#dc2626; font-weight:600;">Ingresa un DNI válido de 8 dígitos</div>';
                        return;
                    }

                    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Buscando...';
                    btn.disabled = true;
                    result.style.display = 'none';

                    try {
                        var resp = await fetch('https://apiperu.dev/api/dni/' + dni, {
                            method: 'GET',
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json'
                            }
                        });
                        var data = await resp.json();

                        if (data.success && data.data) {
                            var d = data.data;
                            var fullName = d.nombre_completo || ((d.nombres || '') + ' ' + (d.apellido_paterno || '') + ' ' + (d.apellido_materno || '')).trim();
                            result.innerHTML = `
                                <div style="text-align:center; padding:6px 0 2px;">
                                    <div style="font-size:16px; font-weight:800; color:#111b21; margin-bottom:4px;">${esc(fullName)}</div>
                                    <div style="font-size:12px; color:#94a3b8; font-weight:500; margin-bottom:12px;">DNI: ${esc(d.numero || dni)}${d.codigo_verificacion ? ' · Cód: ' + esc(d.codigo_verificacion) : ''}</div>
                                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                                        <div style="background:#f8fafc; border-radius:8px; padding:10px; text-align:left;">
                                            <div style="font-size:9px; color:#94a3b8; font-weight:600; text-transform:uppercase; margin-bottom:3px;">Nombres</div>
                                            <div style="font-size:12px; color:#111b21; font-weight:700;">${esc(d.nombres || '—')}</div>
                                        </div>
                                        <div style="background:#f8fafc; border-radius:8px; padding:10px; text-align:left;">
                                            <div style="font-size:9px; color:#94a3b8; font-weight:600; text-transform:uppercase; margin-bottom:3px;">Ap. Paterno</div>
                                            <div style="font-size:12px; color:#111b21; font-weight:700;">${esc(d.apellido_paterno || '—')}</div>
                                        </div>
                                        <div style="background:#f8fafc; border-radius:8px; padding:10px; text-align:left;">
                                            <div style="font-size:9px; color:#94a3b8; font-weight:600; text-transform:uppercase; margin-bottom:3px;">Ap. Materno</div>
                                            <div style="font-size:12px; color:#111b21; font-weight:700;">${esc(d.apellido_materno || '—')}</div>
                                        </div>
                                        <div style="background:#f8fafc; border-radius:8px; padding:10px; text-align:left;">
                                            <div style="font-size:9px; color:#94a3b8; font-weight:600; text-transform:uppercase; margin-bottom:3px;">DNI</div>
                                            <div style="font-size:12px; color:#111b21; font-weight:700;">${esc(d.numero || dni)}</div>
                                        </div>
                                    </div>
                                </div>
                            `;
                        } else {
                            result.innerHTML = '<div style="background:#fef2f2; border:1px solid #fecaca; border-radius:10px; padding:12px; text-align:center; font-size:13px; color:#dc2626; font-weight:600;">No se encontraron datos para el DNI ingresado</div>';
                        }
                        result.style.display = 'block';
                    } catch (e) {
                        console.error('Error API DNI:', e);
                        result.style.display = 'block';
                        result.innerHTML = '<div style="background:#fef2f2; border:1px solid #fecaca; border-radius:10px; padding:12px; text-align:center; font-size:13px; color:#dc2626; font-weight:600;">Error al consultar. Intenta nuevamente.</div>';
                    }

                    btn.innerHTML = '<i class="fa-solid fa-magnifying-glass" style="font-size:13px;"></i> Buscar';
                    btn.disabled = false;
                }

                // Enter para buscar
                document.addEventListener('DOMContentLoaded', function() {
                    var dniInput = document.getElementById('reniecDniInput');
                    if (dniInput) {
                        dniInput.addEventListener('keydown', function(e) {
                            if (e.key === 'Enter') consultarDNI();
                        });
                    }
                });
            

// =========================================


        // --- MOTOR DE ALMACENAMIENTO MASIVO (IndexedDB) ---
        const DB_NAME = 'FiltroVehicularDB';
        const STORE_NAME = 'reports';

        function initDB() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME, 1);
                request.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        db.createObjectStore(STORE_NAME);
                    }
                };
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }

        async function getReportDB(key) {
            const db = await initDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const req = store.get(key);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        }

        const cats = [
            // 1. Registro y propiedad
            { icon: 'fa-id-card', title: 'Propiedad Vehicular SUNARP', link: 'https://consultavehicular.sunarp.gob.pe/consulta-vehicular/' },
            { icon: 'fa-file-lines', title: 'Inscripción y Precio de Vehículo (PDF)', link: 'https://enlinea.sunarp.gob.pe/sunarpweb/pages/acceso/ingreso.faces' },
            { icon: 'fa-car-side', title: 'Cambio de Características', link: 'https://sprl.sunarp.gob.pe/sprl/ingreso' },
            { icon: 'fa-id-badge', title: 'Tarjeta de Propiedad (TIVE)', link: 'https://enlinea.sunarp.gob.pe/sunarpweb/pages/acceso/ingreso.faces' },
            { icon: 'fa-users', title: 'Historial de Propietarios Inscritos', link: 'https://enlinea.sunarp.gob.pe/sunarpweb/pages/acceso/ingreso.faces' },
            { icon: 'fa-building-columns', title: 'Boleta Informativa', link: 'https://enlinea.sunarp.gob.pe/sunarpweb/pages/acceso/ingreso.faces' },
            // 2. Seguridad y denuncias
            { icon: 'fa-handcuffs', title: 'Denuncias y Órdenes de Captura', link: 'https://serviciopolicias.policia.gob.pe:8090/Denuncias/verificar' },
            { icon: 'fa-heart-pulse', title: 'Siniestralidad por Placa', link: 'https://servicios.sbs.gob.pe/reportesoat/' },
            { icon: 'fa-sheet-plastic', title: 'Estado de Placa', link: 'https://www.placas.pe/#/home/verificarEstadoPlaca' },
            // 3. Multas y deudas
            { icon: 'fa-money-bill-wave', title: 'Deudas y Multas SAT Lima', link: 'https://www.sat.gob.pe/pagosenlinea/' },
            { icon: 'fa-money-bill-wave', title: 'Deudas y Multas SAT Callao', link: 'https://pagopapeletascallao.pe/' },
            { icon: 'fa-map-location-dot', title: 'Deudas y Multas por Región', action: 'regiones' },
            { icon: 'fa-triangle-exclamation', title: 'Papeletas de Tránsito ATU', link: 'https://pasarela.atu.gob.pe/#' },
            { icon: 'fa-truck', title: 'Papeletas SUTRAN', link: 'https://www.sutran.gob.pe/consultas/record-de-infracciones/record-de-infracciones/' },
            { icon: 'fa-camera', title: 'Foto Pit Lima', link: 'http://www.pit.gob.pe/pit2007/EstadoCuenta.aspx' },
            // 4. Documentos y técnico
            { icon: 'fa-screwdriver-wrench', title: 'Inspección Técnica Vehicular CITV', link: 'https://rec.mtc.gob.pe/Citv/ArConsultaCitv' },
            { icon: 'fa-shield-halved', title: 'Vigencia del SOAT', link: 'https://www.apeseg.org.pe/consultas-soat/' },
            { icon: 'fa-address-card', title: 'Récord de Conductor (DNI)', link: 'https://recordconductor.mtc.gob.pe/' },
            { icon: 'fa-circle-half-stroke', title: 'Lunas Oscurecidas', link: 'https://sistemas.policia.gob.pe/consultalunas/ConsultarServicioLunas' },
            // 5. Servicios adicionales
            { icon: 'fa-gas-pump', title: 'FISE GNV Subsidio Gas', link: 'https://fise.minem.gob.pe:23308/consulta-taller/pages/consultaTaller/inicio' },
            { icon: 'fa-coins', title: 'Consulta Deuda GNV', link: 'https://infogas.com.pe/consulta-placa/' },
            { icon: 'fa-list-check', title: 'Otras Afectaciones', link: 'https://consultavehicular.sunarp.gob.pe/consulta-vehicular/' }
        ];

        // --- SISTEMA DE HISTORIAL DE NAVEGACIÓN ---
        let navigationStack = ['home'];
        
        // --- SISTEMA DE PESTAÑAS DE SERVICIOS ---
        function switchServicesTab(tabName, addToHistory = true) {
            
            // Verificar si el usuario está logueado
            if (typeof currentUser === 'undefined' || !currentUser) {
                mostrarModalActivacion('login');
                return;
            }

            // Consultas requiere créditos
            if (tabName === 'consultas') {
                // Verificar si tiene créditos (ya cargados en auth.js)
                // Si aún no cargó (undefined), dejar pasar — el bridge verificará server-side
                if (window.tieneCreditos === false) {
                    openAccess();
                    return;
                }
            }
            
            // Agregar al historial de navegación
            if (addToHistory) {
                navigationStack.push('tab-' + tabName);
                history.pushState({ view: 'tab-' + tabName }, '', '#' + tabName);
            }
            
            // Actualizar pestañas visuales
            document.querySelectorAll('.services-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
            
            // Ocultar todos los contenidos (limpiar estilos inline, dejar que CSS maneje con !important)
            document.querySelectorAll('.services-tab-content').forEach(content => {
                content.classList.remove('active');
                content.removeAttribute('style');
            });
            
            // Mostrar el contenido seleccionado
            const targetContent = document.getElementById(`tab-${tabName}`);
            if (targetContent) {
                targetContent.classList.add('active');
                targetContent.removeAttribute('style');
                
                // Si es la pestaña Consultas, renderizar categorías
                if (tabName === 'consultas') {
                    setTimeout(() => renderConsultasCategorias(), 100);
                }

                // Si es la pestaña Dashboard, renderizar el contenido
                if (tabName === 'dashboard') {
                    setTimeout(() => {
                        currentDashTab = 'all';
                        dashViewMode = 'categories';
                        document.getElementById('dashSearch').value = '';
                        renderDashGrid();
                    }, 100);
                }
            } else {
                console.error('No se encontró el contenido para:', tabName);
            }
        }

        // Modal de registro flotante
        var _authFloatingMode = 'register';

        function showAuthFloatingModal() {
            _authFloatingMode = 'register';
            var m = document.getElementById('authFloatingModal');
            if (m) {
                document.getElementById('authRegisterFields').style.display = 'block';
                document.getElementById('authModalIcon').className = 'fa-solid fa-user-pen';
                document.getElementById('authModalTitle').textContent = 'Crear cuenta';
                document.getElementById('authModalSubtitle').textContent = 'Regístrate para acceder a todos los servicios';
                document.getElementById('authModalBtn').textContent = 'Crear cuenta';
                document.getElementById('authToggleText').innerHTML = '¿Ya tienes cuenta? <b style="color:#111b21;">Inicia sesión</b>';
                document.getElementById('authModalError').style.display = 'none';
                m.style.display = 'flex';
            }
        }

        function toggleAuthFloatingMode() {
            _authFloatingMode = _authFloatingMode === 'register' ? 'login' : 'register';
            document.getElementById('authRegisterFields').style.display = _authFloatingMode === 'register' ? 'block' : 'none';
            document.getElementById('authModalIcon').className = _authFloatingMode === 'register' ? 'fa-solid fa-user-pen' : 'fa-solid fa-user-lock';
            document.getElementById('authModalTitle').textContent = _authFloatingMode === 'register' ? 'Crear cuenta' : 'Iniciar sesión';
            document.getElementById('authModalSubtitle').textContent = _authFloatingMode === 'register' ? 'Regístrate para acceder a todos los servicios' : 'Ingresa tus credenciales para continuar';
            document.getElementById('authModalBtn').textContent = _authFloatingMode === 'register' ? 'Crear cuenta' : 'Iniciar sesión';
            document.getElementById('authToggleText').innerHTML = _authFloatingMode === 'register'
                ? '¿Ya tienes cuenta? <b style="color:#111b21;">Inicia sesión</b>'
                : '¿No tienes cuenta? <b style="color:#111b21;">Regístrate</b>';
            document.getElementById('authModalError').style.display = 'none';
        }

        async function handleAuthFloating() {
            var btn = document.getElementById('authModalBtn');
            var err = document.getElementById('authModalError');
            var email = document.getElementById('authRegEmail').value.trim().toLowerCase();
            var pass = document.getElementById('authRegPass').value;
            err.style.display = 'none';

            if (!email || !pass) { err.textContent = 'Ingresa correo y contraseña.'; err.style.display = 'block'; return; }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = 'Ingresa un correo electrónico válido.'; err.style.display = 'block'; return; }
            if (pass.length < 6) { err.textContent = 'La contraseña debe tener al menos 6 caracteres.'; err.style.display = 'block'; return; }

            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';
            btn.disabled = true;

            try {
                if (!window.sb) throw new Error('Sin conexión. Verifica tu internet.');

                if (_authFloatingMode === 'register') {
                    var name = document.getElementById('authRegName').value.trim();
                    var wpp = document.getElementById('authRegWhatsapp').value.trim();
                    if (!name) throw new Error('Ingresa tu nombre.');
                    if (!wpp || wpp.length !== 9 || wpp[0] !== '9') throw new Error('WhatsApp debe tener 9 dígitos y empezar con 9.');

                    // Verificar si ya existe
                    var existRes = await window.sb.from('solicitudes').select('datos').like('placa', 'REGISTRO_%');
                    if ((existRes.data || []).some(function(r) { return r.datos && r.datos.email === email; })) throw new Error('Ese correo ya está registrado. Inicia sesión.');

                    // Crear registro
                    var reqKey = 'REGISTRO_' + Date.now();
                    var regData = { placa: reqKey, timestamp: Date.now(), status: 'pending', isRegistro: true, email: email, pass: pass, nombre: name, whatsapp: wpp };
                    var up = await window.sb.from('solicitudes').upsert({ placa: reqKey, datos: regData, updated_at: new Date() });
                    if (up.error) throw new Error('Error al crear cuenta.');

                    // Crear saldo
                    await window.sb.from('saldos').upsert({ email: email, creditos: 0, plataforma_activa: false, dashboard_activo: false, updated_at: new Date() }, { onConflict: 'email' });

                    currentUser = { email: email, nombre: name, whatsapp: wpp };
                    localStorage.setItem('filtro_user_session', JSON.stringify(currentUser));
                    document.getElementById('authFloatingModal').style.display = 'none';
                    hideLoginScreen();
                    renderLoggedInState();
                    alert('Cuenta creada exitosamente.\n\nBienvenido a Filtro Vehicular Plus.');

                } else {
                    // Login
                    if (_isAdmin(email, pass)) {
                        currentUser = { email: email, nombre: 'Admin' };
                        localStorage.setItem('filtro_user_session', JSON.stringify(currentUser));
                        window.plataformaActiva = true;
                        document.getElementById('authFloatingModal').style.display = 'none';
                        hideLoginScreen();
                        renderLoggedInState();
                        return;
                    }

                    var res = await window.sb.from('solicitudes').select('datos, placa').like('placa', 'REGISTRO_%');
                    if (res.error) throw new Error('Error al consultar.');
                    var match = (res.data || []).find(function(item) {
                        if (!item.datos || item.datos.email !== email) return false;
                        return item.datos.pass === pass || item.datos.password === pass;
                    });
                    if (!match) throw new Error('Correo o contraseña incorrectos.');

                    currentUser = { email: match.datos.email, nombre: match.datos.nombre || 'Usuario', whatsapp: match.datos.whatsapp || '' };
                    localStorage.setItem('filtro_user_session', JSON.stringify(currentUser));

                    // Leer plataforma
                    try {
                        var sRes = await window.sb.from('saldos').select('plataforma_activa').eq('email', email).single();
                        if (sRes.data) window.plataformaActiva = sRes.data.plataforma_activa || false;
                    } catch(e) {}

                    document.getElementById('authFloatingModal').style.display = 'none';
                    hideLoginScreen();
                    renderLoggedInState();
                }
            } catch (e) {
                err.textContent = e.message;
                err.style.display = 'block';
            }
            btn.innerHTML = _authFloatingMode === 'register' ? 'Crear cuenta' : 'Iniciar sesión';
            btn.disabled = false;
        }

        // Mostrar modal de upgrade S/35
        function showUpgradeModal() {
            var m = document.getElementById('upgradeModal');
            if (m) m.style.display = 'flex';
        }

        // Verificar acceso antes de cualquier servicio
        function checkAccessAndRun(callback) {
            if (!currentUser) {
                showAuthFloatingModal();
                return;
            }
            callback();
        }

        // Funciones legacy redirigidas
        function showAccessRestrictedModal() { showAuthFloatingModal(); }
        function showUpgradePremiumModal() { showUpgradeModal(); }
        function abrirPasarelaPremium() { showUpgradeModal(); }
        function mostrarModalActivacion() { if (!currentUser) showAuthFloatingModal(); else showUpgradeModal(); }
        function activarPlataforma() { showUpgradeModal(); }
        function showLoginModal() { showAuthFloatingModal(); }

        // --- SISTEMA DE CATEGORÍAS DEL DASHBOARD ---
        const dashboardCategories = {
            mtc: {
                title: 'Servicios MTC',
                services: [
                    { icon: 'fa-id-card', title: 'Récord de Conductor', desc: 'Consulta tu historial de conductor DNI', link: 'https://recordconductor.mtc.gob.pe/' },
                    { icon: 'fa-car-side', title: 'Verificación Vehicular', desc: 'Estado de verificación del vehículo', link: 'https://consultavehicular.sunarp.gob.pe/consulta-vehicular/' },
                    { icon: 'fa-file-lines', title: 'Papeletas de Tránsito', desc: 'Consultar papeletas y multas MTC', link: 'https://pasarela.atu.gob.pe/#' },
                    { icon: 'fa-truck', title: 'Papeletas SUTRAN', desc: 'Infracciones de transporte pesado', link: 'https://www.sutran.gob.pe/consultas/record-de-infracciones/record-de-infracciones/' },
                    { icon: 'fa-camera', title: 'Foto PIT Lima', desc: 'Fotografía del vehículo en Lima', link: 'http://www.pit.gob.pe/pit2007/EstadoCuenta.aspx' },
                    { icon: 'fa-screwdriver-wrench', title: 'Inspección Técnica Vehicular', desc: 'Estado del CITV del vehículo', link: 'https://rec.mtc.gob.pe/Citv/ArConsultaCitv' },
                    { icon: 'fa-shield-halved', title: 'Vigencia del SOAT', desc: 'Verificar estado del SOAT', link: 'https://www.apeseg.org.pe/consultas-soat/' },
                    { icon: 'fa-circle-half-stroke', title: 'Lunas Oscurecidas', desc: 'Verificación de lunas polarizadas', link: 'https://sistemas.policia.gob.pe/consultalunas/ConsultarServicioLunas' },
                    { icon: 'fa-gas-pump', title: 'FISE GNV Subsidio', desc: 'Consulta subsidio GNV', link: 'https://fise.minem.gob.pe:23308/consulta-taller/pages/consultaTaller/inicio' },
                    { icon: 'fa-coins', title: 'Consulta Deuda GNV', desc: 'Deuda de conversión a GNV', link: 'https://infogas.com.pe/consulta-placa/' },
                    { icon: 'fa-road', title: 'Restricciones Vehiculares', desc: 'Limitaciones de circulación', link: 'https://www.sutran.gob.pe/consultas/record-de-infracciones/record-de-infracciones/' },
                    { icon: 'fa-certificate', title: 'Certificado de Antecedentes', desc: 'Antecedentes del propietario', link: 'https://antecedentes.pj.gob.pe/' },
                    { icon: 'fa-file-contract', title: 'Contrato de Compraventa', desc: 'Plantilla de contrato vehicular', link: 'https://enlinea.sunarp.gob.pe/sunarpweb/pages/acceso/ingreso.faces' },
                    { icon: 'fa-calculator', title: 'Calculadora de Impuestos', desc: 'Cálculo de tributos vehiculares', link: 'https://www.sat.gob.pe/pagosenlinea/' },
                    { icon: 'fa-gavel', title: 'Resolución de Multas', desc: 'Trámites para resolver multas', link: 'https://www.sat.gob.pe/pagosenlinea/' }
                ]
            },
            sunarp: {
                title: 'SUNARP - Registros Públicos',
                services: [
                    { icon: 'fa-id-card', title: 'Propiedad Vehicular SUNARP', desc: 'Consulta de titularidad del vehículo', link: 'https://consultavehicular.sunarp.gob.pe/consulta-vehicular/' },
                    { icon: 'fa-file-lines', title: 'Inscripción y Precio de Vehículo', desc: 'Registro completo de transferencias', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-car-side', title: 'Cambio de Características', desc: 'Modificaciones al vehículo', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-users', title: 'Historial de Propietarios', desc: 'Lista completa de dueños', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-id-badge', title: 'Tarjeta de Propiedad (TIVE)', desc: 'Tarjeta de identificación vehicular', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-building-columns', title: 'Boleta Informativa', desc: 'Resumen de datos del vehículo', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-search', title: 'Búsqueda de Gravámenes', desc: 'Verificar cargas y embargos', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-file-shield', title: 'Partida Registral', desc: 'Documento oficial del registro', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-magnifying-glass', title: 'Búsqueda por DNI', desc: 'Vehículos asociados a persona', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-file-invoice', title: 'Constancia de No Propiedad', desc: 'Certificado de no tener vehículos', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-copy', title: 'Certificado de Copia Literal', desc: 'Copia certificada del registro', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-clock', title: 'Estado de Trámite', desc: 'Seguimiento de solicitudes', link: 'https://filtrovehicularperu.com/' }
                ]
            },
            sat: {
                title: 'SAT y Municipalidades',
                services: [
                    { icon: 'fa-money-bill-wave', title: 'Deudas y Multas SAT Lima', desc: 'Tributos municipales de Lima', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-money-bill-wave', title: 'Deudas y Multas SAT Callao', desc: 'Tributos municipales del Callao', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-map-location-dot', title: 'Deudas por Región', desc: 'Consultar por departamento', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-triangle-exclamation', title: 'Papeletas de Tránsito ATU', desc: 'Infracciones de tránsito', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-money-bill', title: 'Arbitrios Municipales', desc: 'Impuestos municipales', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-home', title: 'Predio del Propietario', desc: 'Bienes inmuebles asociados', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-file-invoice-dollar', title: 'Deuda Coactiva', desc: 'Procesos de cobranza', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-receipt', title: 'Recibos de Pago', desc: 'Historial de pagos', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-calculator', title: 'Calculadora de Tributos', desc: 'Simulador de impuestos', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-file-contract', title: 'Fraccionamiento Tributario', desc: 'Planes de pago', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-gavel', title: 'Reclamos y Recursos', desc: 'Impugnaciones de multas', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-building', title: 'Licencia de Funcionamiento', desc: 'Permisos comerciales', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-map', title: 'Zonificación y Uso de Suelo', desc: 'Regulación territorial', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-hard-hat', title: 'Certificado de Construcción', desc: 'Permisos de obra', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-tree', title: 'Impuesto Predial', desc: 'Impuesto sobre inmuebles', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-car', title: 'Impuesto Vehicular', desc: 'Impuesto anual al vehículo', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-industry', title: 'Impuesto a la Renta', desc: 'Declaraciones anuales', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-chart-line', title: 'Estado de Cuenta', desc: 'Resumen de deudas', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-file-alt', title: 'Declaraciones Juradas', desc: 'Documentos tributarios', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-credit-card', title: 'Medios de Pago', desc: 'Opciones de pago', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-bell', title: 'Notificaciones Tributarias', desc: 'Alertas y avisos', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-user-shield', title: 'Representante Legal', desc: 'Poderes y representaciones', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-file-signature', title: 'Power Attorney', desc: 'Documentos de representación', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-handshake', title: 'Convenios de Pago', desc: 'Acuerdos con la administración', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-exclamation-triangle', title: 'Alertas de Deuda', desc: 'Notificaciones de vencimiento', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-sync', title: 'Actualización de Datos', desc: 'Modificar información tributaria', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-lock', title: 'Levantamiento de Medidas', desc: 'Desbloquear cuentas', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-file-medical', title: 'Dictamen Fiscal', desc: 'Opinión de la autoridad', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-balance-scale', title: 'Tribunal Fiscal', desc: 'Instancia de apelación', link: 'https://filtrovehicularperu.com/' }
                ]
            },
            otros: {
                title: 'Otros Servicios',
                services: [
                    { icon: 'fa-heart-pulse', title: 'Siniestralidad por Placa', desc: 'Historial de siniestros aseguradoras', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-sheet-plastic', title: 'Estado de Placa', desc: 'Verificación de placa vehicular', link: 'https://www.placas.pe/#/home/verificarEstadoPlaca' },
                    { icon: 'fa-handcuffs', title: 'Denuncias y Capturas', desc: 'Órdenes judiciales vigentes', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-shield-alt', title: 'Seguro Obligatorio', desc: 'Información de pólizas', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-car-crash', title: 'Historial de Accidentes', desc: 'Registro de colisiones', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-gavel', title: 'Procesos Judiciales', desc: 'Casos en el sistema judicial', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-file-contract', title: 'Contratos de Arrendamiento', desc: 'Acuerdos de alquiler', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-key', title: 'Cambio de Titularidad', desc: 'Proceso de transferencia', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-tools', title: 'Mantenimiento Vehicular', desc: 'Historial de servicios', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-gas-pump', title: 'Consumo de Combustible', desc: 'Registro de consumo', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-route', title: 'Kilometraje Registrado', desc: 'Historial de odómetro', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-parking', title: 'Multas de Estacionamiento', desc: 'Infracciones de estacionamiento', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-tachometer-alt', title: 'Inspección Técnica', desc: 'Resultados de inspección', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-id-card-alt', title: 'Identificación del Conductor', desc: 'Verificación de licencia', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-file-medical-alt', title: 'Certificado Médico', desc: 'Aptitud para conducir', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-graduation-cap', title: 'Capacitación Vial', desc: 'Cursos de conducción', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-phone', title: 'Contacto de Emergencia', desc: 'Datos de contacto', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-map-marked-alt', title: 'Geolocalización', desc: 'Ubicación actual del vehículo', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-wifi', title: 'Telemática Vehicular', desc: 'Sistemas de monitoreo', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-battery-half', title: 'Estado de Batería', desc: 'Diagnóstico eléctrico', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-oil-can', title: 'Cambios de Aceite', desc: 'Historial de lubricación', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-tire', title: 'Rotación de Neumáticos', desc: 'Mantenimiento de llantas', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-car-battery', title: 'Sistema Eléctrico', desc: 'Diagnóstico eléctrico', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-thermometer-half', title: 'Sistema de Refrigeración', desc: 'Estado del sistema de enfriamiento', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-cogs', title: 'Transmisión', desc: 'Estado de caja de cambios', link: 'https://filtrovehicularperu.com/' },
                    { icon: 'fa-brake', title: 'Sistema de Frenos', desc: 'Inspección de frenos', link: 'https://filtrovehicularperu.com/' }
                ]
            }
        };

        function showDashboardCategory(categoryKey) {
            // Ocultar las tarjetas principales
            var catContainer = document.querySelector('.dashboard-categories-container');
            if (catContainer) catContainer.style.display = 'none';

            // Mostrar el contenido de la categoría
            const categoryContent = document.getElementById('dashboardCategoryContent');
            const categoryTitle = document.getElementById('categoryContentTitle');
            const servicesGrid = document.getElementById('categoryServicesGrid');
            if (!categoryContent || !categoryTitle || !servicesGrid) return;

            // Configurar títulos según la categoría
            const categoryTitles = {
                'publicidad': 'Servicios de Publicidad',
                'mtc': 'Servicios Activos MTC',
                'premium': 'Herramientas Plus Premium',
                'infracciones': 'Infracciones por Regiones',
                'gratuitas': 'Consultas Gratuitas',
                'todos': 'Todos los Accesos'
            };

            categoryTitle.textContent = categoryTitles[categoryKey] || 'Servicios';

            // Usar el array cats existente (22 servicios actuales)
            servicesGrid.innerHTML = cats.map((service) => {
                const isFree = !!(service.link || service.action);
                return `
                <div class="hook-card ${isFree ? 'hook-free' : 'hook-paid'}" onclick="handleServiceClick(${JSON.stringify(service).replace(/"/g, '&quot;')})">
                    <div class="hook-icon"><i class="fa-solid ${esc(service.icon)}"></i></div>
                    <div class="hook-text">${esc(service.title)}</div>
                                    </div>`;
            }).join('');

            categoryContent.style.display = 'block';
        }

        function hideDashboardCategory() {
            // Ocultar el contenido de la categoría
            var el = document.getElementById('dashboardCategoryContent');
            if (el) el.style.display = 'none';

            // Mostrar las tarjetas principales
            var catContainer = document.querySelector('.dashboard-categories-container');
            if (catContainer) catContainer.style.display = 'grid';
        }

        function handleServiceClick(service) {
            checkAccessAndRun(function() {
                if (service.action === 'regiones') {
                    switchServicesTab('dashboard', true);
                    setTimeout(function() { setDashTab('REGIONES', null); }, 300);
                } else if (service.link) {
                    window.open(service.link, '_blank');
                }
            });
        }

        function renderServicePlateModal(service) {
            return `
                <div style="background:#111b21; padding:22px 22px 18px; position:relative;">
                    <button onclick="document.getElementById('infoModal').style.display='none';" style="position:absolute; top:14px; right:14px; background:none; border:none; font-size:16px; color:#8696a0; cursor:pointer; padding:4px; line-height:1;"><i class="fa-solid fa-xmark"></i></button>
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="width:40px; height:40px; background:#25d366; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                            <i class="fa-solid ${esc(service.icon)}" style="font-size:17px; color:#fff;"></i>
                        </div>
                        <div style="flex:1; min-width:0;">
                            <p style="font-size:14px; color:#e9edef; font-weight:700; margin:0; line-height:1.3;">${esc(service.title)}</p>
                        </div>
                    </div>
                    <div style="margin-top:14px; background:rgba(255,255,255,0.06); border-radius:8px; padding:10px 14px; display:flex; align-items:center; justify-content:space-between;">
                        <span style="font-size:11px; color:#8696a0; font-weight:400;">Costo del servicio</span>
                        <span style="font-size:20px; font-weight:700; color:#25d366;">S/ ${esc(service.price)}</span>
                    </div>
                </div>
                <div style="padding:20px 22px 22px;">
                    <div style="margin-bottom:16px;">
                        <label style="font-size:9px; color:#6b7280; font-weight:600; display:block; margin-bottom:5px; text-transform:uppercase; letter-spacing:0.5px;">Ingresa tu placa</label>
                        <input type="text" id="servicePlateInput" placeholder="ABC-123" maxlength="10" style="width:100%; padding:12px; border:1px solid #e5e7eb; border-radius:10px; font-size:15px; font-weight:600; text-align:center; text-transform:uppercase; letter-spacing:2px; outline:none; transition:border-color 0.2s; box-sizing:border-box; font-family:'Roboto',sans-serif; color:#111b21;" onfocus="this.style.borderColor='#25d366'" onblur="this.style.borderColor='#e5e7eb'">
                    </div>
                    <button id="btnModalAction" onclick="processServicePayment('${escAttr(service.title)}', '${escAttr(service.price)}', '${escAttr(service.icon)}')" style="background:#25d366; color:#fff; border:none; width:100%; padding:12px; border-radius:10px; font-weight:600; cursor:pointer; font-size:13px; transition:background 0.2s; margin-bottom:8px; display:flex; align-items:center; justify-content:center; gap:6px;" onmouseover="this.style.background='#1ebe5d'" onmouseout="this.style.background='#25d366'">
                        <i class="fa-solid fa-magnifying-glass" style="font-size:12px;"></i> Consultar ahora
                    </button>
                    <a href="https://wa.me/51932465820?text=Hola%2C%20quiero%20consultar%20el%20servicio%20${encodeURIComponent(service.title)}%20en%20Filtro%20Vehicular." target="_blank" onclick="document.getElementById('infoModal').style.display='none';" style="width:100%; padding:12px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; display:flex; align-items:center; justify-content:center; gap:6px; text-decoration:none; font-size:12px; font-weight:600; color:#111b21; cursor:pointer; transition:border-color 0.2s; margin-bottom:8px; box-sizing:border-box;" onmouseover="this.style.borderColor='#25d366'" onmouseout="this.style.borderColor='#e5e7eb'">
                        <i class="fa-brands fa-whatsapp" style="font-size:15px; color:#25d366;"></i> Pagar por WhatsApp
                    </a>
                    <button onclick="document.getElementById('infoModal').style.display='none';" style="width:100%; padding:10px; background:transparent; color:#9ca3af; border:none; font-size:11px; font-weight:500; cursor:pointer;">Cancelar</button>
                </div>
            `;
        }

        function handleDashboardService(icon, title, desc, link, price) {
            if (!currentUser) { showAuthFloatingModal(); return; }
            if (!window.plataformaActiva) { showUpgradeModal(); return; }
            const service = { icon: icon, title: title, desc: desc, link: link, price: price };
            if (service.link) {
                window.open(service.link, '_blank');
            } else if (service.price) {
                const infoModal = document.getElementById('infoModal');
                const infoContent = document.getElementById('infoContent');
                if (infoModal && infoContent) {
                    infoContent.innerHTML = renderServicePlateModal(service);
                    infoModal.style.display = 'flex';
                }
            }
        }

        function processServicePayment(serviceTitle, servicePrice, serviceIcon) {
            
            const plateInput = document.getElementById('servicePlateInput');
            const plate = plateInput ? plateInput.value.trim() : '';
            
            if (!plate) {
                alert('Por favor, ingresa el número de placa');
                return;
            }
            
            // Cerrar modal y abrir proceso de pago existente
            document.getElementById('infoModal').style.display = 'none';
            
            // Usar la función de pago existente
            if (typeof openSale === 'function') {
                openSale(servicePrice, `${serviceTitle} - Placa: ${plate}`, parseFloat(servicePrice), 'service');
            }
        }

        const hook = document.getElementById('hookSection');
        if(hook) {
            cats.forEach(c => {
                const d = document.createElement('div');
                d.className = 'hook-card';
                d.onclick = async () => {
                    if (!currentUser) { showAuthFloatingModal(); return; }
                    if (!window.plataformaActiva) { showUpgradeModal(); return; }

                    if (c.link) {
                        window.open(c.link, '_blank');
                    } else if (c.price) {
                        const infoModal = document.getElementById('infoModal');
                        const infoContent = document.getElementById('infoContent');
                        if (infoModal && infoContent) {
                            infoContent.innerHTML = renderServicePlateModal(c);
                            infoModal.style.display = 'flex';

                            // Reasignar botón para usar lógica de créditos
                            document.getElementById('btnModalAction').onclick = async () => {
                                const plateIn = document.getElementById('servicePlateInput');
                                if (!plateIn || plateIn.value.trim().length < 5) {
                                    alert("Por favor, ingresa una placa válida.");
                                    return;
                                }
                                const p = plateIn.value.trim().toUpperCase();

                                // Bloquear botón
                                const btn = document.getElementById('btnModalAction');
                                btn.disabled = true;
                                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> PROCESANDO...';

                                try {
                                    // Consultar créditos disponibles
                                    const { data, error: fetchError } = await window.sb
                                        .from('saldos')
                                        .select('creditos')
                                        .eq('email', currentUser.email)
                                        .single();

                                    // Validar que la consulta fue exitosa
                                    if (fetchError) {
                                        console.error("Error al consultar créditos:", fetchError);
                                        alert("Error al verificar tus créditos. Por favor, intenta nuevamente.");
                                        btn.disabled = false;
                                        btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Consultar ahora';
                                        return;
                                    }

                                    // Validar que data existe y tiene créditos
                                    if (!data || typeof data.creditos !== 'number') {
                                        console.error("Datos de créditos inválidos:", data);
                                        alert("Error al obtener tu saldo. Por favor, contacta a soporte.");
                                        btn.disabled = false;
                                        btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Consultar ahora';
                                        return;
                                    }

                                    // Calcular créditos necesarios (1 crédito = S/ 1.00)
                                    const creditNeed = parseFloat(c.price);
                                    const creditosActuales = data.creditos;

                                    // Logging para debugging

                                    // VALIDACIÓN ESTRICTA: Verificar que tiene créditos suficientes
                                    if (creditosActuales < creditNeed) {
                                        alert(`Créditos insuficientes.\n\nTienes: ${creditosActuales.toFixed(2)} crédito(s)\nNecesitas: ${creditNeed.toFixed(2)} crédito(s)\n\nPor favor, recarga créditos para continuar.`);
                                        document.getElementById('infoModal').style.display = 'none';
                                        window.currentCardTitle = c.title;
                                        window.currentCardPlate = p;
                                        btn.disabled = false;
                                        btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Consultar ahora';
                                        if (typeof openAccess === 'function') openAccess();
                                        return;
                                    }

                                    // DOBLE VERIFICACIÓN: Calcular nuevo saldo
                                    const nuevoSaldo = creditosActuales - creditNeed;
                                    
                                    // Verificar que el nuevo saldo no sea negativo
                                    if (nuevoSaldo < 0) {
                                        console.error('ERROR: El nuevo saldo sería negativo:', nuevoSaldo);
                                        alert("Error en el cálculo de créditos. Por favor, contacta a soporte.");
                                        btn.disabled = false;
                                        btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Consultar ahora';
                                        return;
                                    }


                                    // Descontar créditos atómicamente (gte verifica saldo suficiente)
                                    const { data: updatedRows, error: updateError } = await window.sb
                                        .from('saldos')
                                        .update({ creditos: nuevoSaldo })
                                        .eq('email', currentUser.email)
                                        .gte('creditos', creditNeed)
                                        .select('creditos');

                                    if (updateError || !updatedRows || updatedRows.length === 0) {
                                        console.error("Error al actualizar créditos:", updateError || 'Saldo cambió entre lectura y escritura');
                                        alert('Error al procesar el pago. No se descontaron créditos. Inténtalo de nuevo.');
                                        btn.disabled = false;
                                        btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Consultar ahora';
                                        return;
                                    }

                                    // Créditos descontados exitosamente - Procesar solicitud
                                    const timestamp = Date.now();
                                    const pendingData = {
                                        placa: p,
                                        timestamp: timestamp,
                                        status: 'pending',
                                        email: currentUser.email,
                                        nombre: currentUser.nombre || '',
                                        whatsapp: currentUser.whatsapp || '',
                                        servicio: c.title,
                                        isIndividual: true
                                    };
                                    
                                    localStorage.setItem('pending_request_' + p, JSON.stringify(pendingData));
                                    localStorage.setItem('last_pending_plate', p);
                                    await syncSolicitudToNube(p, pendingData);

                                    alert(`Pago procesado exitosamente\n\nSe descontaron ${creditNeed.toFixed(2)} crédito(s).\nNuevo saldo: ${nuevoSaldo.toFixed(2)} crédito(s)\n\nTu solicitud de «${c.title}» quedó en cola.`);
                                    document.getElementById('infoModal').style.display = 'none';
                                    window.location.href = 'panel_cliente.html';

                                } catch (e) { 
                                    console.error("ERROR CRÍTICO en proceso de consulta:", e);
                                    alert("Error inesperado al procesar tu consulta. Por favor, verifica tu conexión e intenta nuevamente.");
                                    btn.disabled = false;
                                    btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Consultar ahora';
                                    return;
                                }
                            };
                        }
                    }
                };
                
                d.className = 'hook-card ' + (c.link ? 'hook-free' : 'hook-paid');
                d.innerHTML = `<div class="hook-icon"><i class="fa-solid ${c.icon}"></i></div><div class="hook-text">${c.title}</div>${c.link ? '' : '<span class="hook-premium"></span>'}`;
                hook.appendChild(d);
            });
        }

        setInterval(() => {
            if (typeof currentUser !== 'undefined' && currentUser) {
                document.querySelectorAll('.hook-padlock').forEach(i => {
                    if(i.classList.contains('fa-lock')) {
                        i.classList.remove('fa-lock');
                        i.classList.add('fa-unlock');
                        i.parentElement.style.color = '#25d366';
                    }
                });
            } else {
                document.querySelectorAll('.hook-padlock').forEach(i => {
                    if(i.classList.contains('fa-unlock')) {
                        i.classList.remove('fa-unlock');
                        i.classList.add('fa-lock');
                        i.parentElement.style.color = ''; 
                    }
                });
            }
        }, 8000);

        function openAccess() { document.getElementById('accessModal').style.display = 'flex'; }
        function closeAccess() { document.getElementById('accessModal').style.display = 'none'; }
        let currentSaleCredits = 0;
        let currentSaleAmount = '0.00';
        let currentSaleType = 'regular'; // 'regular' o 'dashboard'

        function openSale(amount = '20.00', concept = 'Activa tu expediente integral con 2 créditos', credits = 0, type = 'regular') {
            // Verificar login para créditos o activación
            if ((credits > 0 || type === 'activacion' || type === 'dashboard') && (typeof currentUser === 'undefined' || !currentUser)) {
                showAccessRestrictedModal();
                return;
            }
            
            currentSaleCredits = credits;
            currentSaleAmount = amount;
            currentSaleType = type;

            // Referencias a los dos headers
            var conceptHeader = document.getElementById('saleConceptHeader');
            var simpleHeader = document.getElementById('saleSimpleHeader');

            // Obtener la placa/usuario correcto según el tipo
            let p = '';
            let isUserType = false;
            if (type === 'activacion' || type === 'dashboard') {
                p = currentUser.email;
                isUserType = true;
            } else if (credits > 0) {
                p = currentUser.email;
                isUserType = true;
            } else if (type === 'filtro') {
                p = localStorage.getItem('temp_informe_placa') || '---';
            } else {
                p = window.currentCardPlate || '---';
            }

            if (type === 'dashboard' || type === 'activacion' || credits > 0) {
                // Mostrar header con concepto (premium/recarga)
                if (conceptHeader) conceptHeader.style.display = 'block';
                if (simpleHeader) simpleHeader.style.display = 'none';
                
                var conceptEl = document.getElementById('saleConcept');
                var emailEl = document.getElementById('saleUserEmail');
                var amountHeaderEl = document.getElementById('saleAmountHeader');
                var conceptIconEl = document.getElementById('saleConceptIcon');
                
                if (conceptEl) conceptEl.textContent = concept;
                if (emailEl) emailEl.textContent = currentUser.email;
                if (amountHeaderEl) amountHeaderEl.textContent = 'S/ ' + amount;
                
                if (conceptIconEl) {
                    if (type === 'dashboard') {
                        conceptIconEl.className = 'fa-solid fa-crown';
                    } else {
                        conceptIconEl.className = 'fa-solid fa-coins';
                    }
                }
            } else {
                // Mostrar header simple (placa + monto)
                if (conceptHeader) conceptHeader.style.display = 'none';
                if (simpleHeader) simpleHeader.style.display = 'flex';
                
                var saleLabel = document.getElementById('saleLabel');
                if (saleLabel) saleLabel.textContent = 'Placa';
                
                var plateDisplay = document.getElementById('salePlate');
                if (plateDisplay) plateDisplay.textContent = p;

                var saleAmountDisplay = document.getElementById('saleAmount');
                if (saleAmountDisplay) saleAmountDisplay.textContent = 'S/ ' + amount;
            }

            document.getElementById('modalSale').style.display = 'flex';
        }
        function closeSale() { document.getElementById('modalSale').style.display = 'none'; }
        

        // Sanitización HTML para prevenir XSS
        function esc(s) { var d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }
        function escAttr(s) { return esc(s).replace(/'/g, '&#39;').replace(/"/g, '&quot;'); }

        const normalize = (p) => p.toString().toUpperCase().replace(/[^A-Z0-9-]/g, '');

        function placaVariantesBusqueda(raw) {
            const s = String(raw || '').trim();
            const conFmt = normalize(s);
            const soloAlfanum = s.toUpperCase().replace(/[^A-Z0-9]/g, '');
            const arr = [];
            if (conFmt) arr.push(conFmt);
            if (soloAlfanum && soloAlfanum !== conFmt) arr.push(soloAlfanum);
            return [...new Set(arr)];
        }

        function datosSolicitudAprobada(d) {
            return d && String(d.status || '').toLowerCase().trim() === 'approved';
        }

        document.addEventListener('DOMContentLoaded', () => {
            checkPendingFlow();

            // BLOQUEO GLOBAL: Si el usuario NO ha iniciado sesión, cualquier clic en elementos interactivos muestra "Acceso Restringido"
            document.addEventListener('click', function(e) {
                var target = e.target;

                // Si algún modal está abierto, no bloquear nada
                var authModal = document.getElementById('authFloatingModal');
                var upgradeModal = document.getElementById('upgradeModal');
                var saleModal = document.getElementById('modalSale');
                var infoModal = document.getElementById('infoModal');
                if ((authModal && authModal.style.display === 'flex') ||
                    (upgradeModal && upgradeModal.style.display === 'flex') ||
                    (saleModal && saleModal.style.display === 'flex') ||
                    (infoModal && infoModal.style.display === 'flex')) return;

                // Elementos que SIEMPRE deben funcionar
                var allowed = target.closest('#mainAuthBtn') ||
                              target.closest('.header-logo') ||
                              target.closest('.site-footer') ||
                              target.closest('#infoModal') ||
                              target.closest('#authModal') ||
                              target.closest('#authFloatingModal') ||
                              target.closest('#upgradeModal') ||
                              target.closest('.info-close') ||
                              target.closest('[onclick*="openAuthModal"]') ||
                              target.closest('[onclick*="toggleAuthMode"]') ||
                              target.closest('#installPWA') ||
                              target.closest('.flyer-close') ||
                              target.closest('#modalSale') ||
                              target.closest('[onclick*="closeAuthModal"]') ||
                              target.closest('#consultasResultado') ||
                              target.closest('#consultasCategorias') ||
                              target.closest('#consultasComandos');

                if (allowed) return;

                // Elementos interactivos que requieren verificación
                var isServiceElement = target.closest('.hook-card') ||
                              target.closest('.dash-card') ||
                              target.closest('.services-tab') ||
                              target.closest('.dash-tab') ||
                              target.closest('[data-tab]') ||
                              target.closest('.plan-card') ||
                              target.closest('.category-card') ||
                              target.closest('[onclick*="openSale"]') ||
                              target.closest('[onclick*="submitInforme"]') ||
                              target.closest('[onclick*="switchServicesTab"]') ||
                              target.closest('[onclick*="handleServiceClick"]') ||
                              target.closest('[onclick*="handleDashboardService"]') ||
                              target.closest('[onclick*="setDashTab"]') ||
                              target.closest('[onclick*="showCategoryServices"]') ||
                              target.closest('.btn-consultar') ||
                              target.closest('.btn-primary-action');

                if (!isServiceElement) return;

                // BLOQUEO: Solo usuarios NO logueados → Acceso Restringido
                // Usuarios logueados (incluso demo sin premium) pueden navegar libremente
                if (typeof currentUser === 'undefined' || !currentUser) {
                    e.preventDefault();
                    e.stopPropagation();
                    showAccessRestrictedModal();
                    return;
                }
            }, true);

            window.addEventListener('storage', (e) => {
                const pendingPlate = localStorage.getItem('last_pending_plate');
                if (!pendingPlate) return;
                const vars = placaVariantesBusqueda(pendingPlate);
                const match = vars.some((v) => e.key === 'approved_request_' + v && e.newValue === 'true');
                if (match) {
                    localStorage.removeItem('last_pending_plate');
                    localStorage.removeItem('has_pending_notification'); // Limpiar badge
                    window.location.href = 'reporte.html?placa=' + encodeURIComponent(vars[vars.length - 1] || vars[0]) + '&approved=true';
                }
            });
        });

        // --- SYNC SOLICITUDES TO SUPABASE ---
        async function syncSolicitudToNube(placa, data) {
            if (typeof window.sb !== 'undefined' && window.sb) {
                try {
                    // Intentar actualizar fila existente primero
                    const { data: updated, error: updateErr } = await window.sb
                        .from('solicitudes')
                        .update({ datos: data, updated_at: new Date() })
                        .eq('placa', placa)
                        .select('placa');

                    // Si no existe fila (0 filas actualizadas), insertar nueva
                    if (!updateErr && (!updated || updated.length === 0)) {
                        await window.sb
                            .from('solicitudes')
                            .insert({ placa: placa, datos: data, updated_at: new Date() });
                    }
                } catch (e) { console.error('Error sincronizando solicitud:', e); }
            }
        }

        // --- SISTEMA DE PLACA PENDIENTE ---
        async function checkPendingFlow() {
            const rawPlate = localStorage.getItem('last_pending_plate');
            if (!rawPlate) return;

            const variantes = placaVariantesBusqueda(rawPlate);
            const pDisplay = normalize(rawPlate);
            const pendEl = document.getElementById('pendingStatus');

            for (const v of variantes) {
                const dbReport = await getReportDB('report_' + v);
                if (dbReport || localStorage.getItem('report_' + v)) {
                    localStorage.removeItem('last_pending_plate');
                    variantes.forEach((x) => localStorage.removeItem('pending_request_' + x));
                    if (pendEl) pendEl.style.display = 'none';
                    return;
                }
            }

            for (const v of variantes) {
                if (localStorage.getItem('approved_request_' + v) === 'true') {
                    localStorage.removeItem('last_pending_plate');
                    localStorage.removeItem('has_pending_notification'); // Limpiar badge
                    window.location.href = 'reporte.html?placa=' + encodeURIComponent(v) + '&approved=true';
                    return;
                }
            }

            if (window.sb) {
                try {
                    const { data: rows } = await window.sb
                        .from('solicitudes')
                        .select('placa, datos')
                        .in('placa', variantes);
                    
                    // Si no hay filas en la nube, la solicitud fue eliminada por el admin
                    if (!rows || rows.length === 0) {
                        variantes.forEach((v) => {
                            localStorage.removeItem('pending_request_' + v);
                            localStorage.removeItem('approved_request_' + v);
                        });
                        localStorage.removeItem('last_pending_plate');
                        if (typeof clearNotificationBadge === 'function') clearNotificationBadge();
                        if (pendEl) pendEl.style.display = 'none';
                        return;
                    }
                    
                    const hit = rows.find((r) => datosSolicitudAprobada(r.datos));
                    if (hit) {
                        variantes.forEach((v) => {
                            localStorage.removeItem('pending_request_' + v);
                            localStorage.setItem('approved_request_' + v, 'true');
                        });
                        localStorage.removeItem('last_pending_plate');
                        localStorage.removeItem('has_pending_notification'); // Limpiar badge
                        if (pendEl) pendEl.style.display = 'none';
                        window.location.href = 'reporte.html?placa=' + encodeURIComponent(hit.placa) + '&approved=true';
                        return;
                    }
                } catch (e) {
                    console.error('checkPendingFlow nube:', e);
                }
            }

            const plateDesc = document.getElementById('pendingPlateDesc');
            if (plateDesc) plateDesc.textContent = pDisplay;
            if (pendEl) pendEl.style.display = 'block';

            const poll = setInterval(async () => {
                if (!localStorage.getItem('last_pending_plate')) {
                    clearInterval(poll);
                    return;
                }
                const vars = placaVariantesBusqueda(localStorage.getItem('last_pending_plate') || rawPlate);

                if (window.sb) {
                    try {
                        const { data: rows } = await window.sb
                            .from('solicitudes')
                            .select('placa, datos')
                            .in('placa', vars);
                        const hitApproved = rows && rows.find((r) => datosSolicitudAprobada(r.datos));
                        if (hitApproved) {
                            vars.forEach((v) => {
                                localStorage.removeItem('pending_request_' + v);
                                localStorage.setItem('approved_request_' + v, 'true');
                            });
                            clearInterval(poll);
                            localStorage.removeItem('last_pending_plate');
                            if (pendEl) pendEl.style.display = 'none';
                            window.location.href = 'reporte.html?placa=' + encodeURIComponent(hitApproved.placa) + '&approved=true';
                            return;
                        }
                        if (!rows || rows.length === 0) {
                            vars.forEach((v) => {
                                localStorage.removeItem('pending_request_' + v);
                                localStorage.removeItem('approved_request_' + v);
                            });
                            clearInterval(poll);
                            localStorage.removeItem('last_pending_plate');
                            if (typeof clearNotificationBadge === 'function') clearNotificationBadge();
                            if (pendEl) pendEl.style.display = 'none';
                            return;
                        }
                    } catch (e) {}
                }

                if (vars.some((v) => localStorage.getItem('approved_request_' + v) === 'true')) {
                    clearInterval(poll);
                    localStorage.removeItem('last_pending_plate');
                    localStorage.removeItem('has_pending_notification'); // Limpiar badge
                    if (pendEl) pendEl.style.display = 'none';
                    const v = vars.find((x) => localStorage.getItem('approved_request_' + x) === 'true') || vars[0];
                    window.location.href = 'reporte.html?placa=' + encodeURIComponent(v) + '&approved=true';
                    return;
                }

                if (vars.every((v) => !localStorage.getItem('pending_request_' + v))) {
                    clearInterval(poll);
                    localStorage.removeItem('last_pending_plate');
                    if (typeof clearNotificationBadge === 'function') clearNotificationBadge();
                    if (pendEl) pendEl.style.display = 'none';
                }
            }, 8000);
        }

        // Función auxiliar para mostrar modal de login reutilizable
        function showLoginModal() {
            showAccessRestrictedModal();
        }

        let isDeductingCredits = false; // Guard para evitar doble descuento
        let isScanning = false; // Guard para evitar escaneos duplicados

        async function startSmartScan(placa) {
            if (isScanning) return;
            isScanning = true;
            // 1. Verificación de Créditos para Expediente Automático
            if (typeof currentUser !== 'undefined' && currentUser && window.sb && !isDeductingCredits) {
                isDeductingCredits = true; // Bloquear llamadas simultáneas
                try {
                    const { data } = await window.sb
                        .from('saldos')
                        .select('creditos')
                        .eq('email', currentUser.email)
                        .single();
                        
                    if (data && data.creditos >= 20) {
                        const nuevoSaldo = data.creditos - 20;

                        // UPDATE atómico: solo descuenta si aún hay saldo suficiente
                        const { data: updatedRows, error } = await window.sb
                            .from('saldos')
                            .update({ creditos: nuevoSaldo })
                            .eq('email', currentUser.email)
                            .gte('creditos', 20)
                            .select('creditos');

                        if (!error && updatedRows && updatedRows.length > 0) {
                            // Solicitud queda como 'pending' para que el admin la procese
                            localStorage.setItem('has_pending_notification', 'true');
                            localStorage.setItem('last_pending_plate', placa);

                            // Actualizar solicitud con créditos descontados (estado sigue pending)
                            try {
                                const { data: updated } = await window.sb
                                    .from('solicitudes')
                                    .update({ datos: Object.assign({}, {
                                        placa: placa,
                                        timestamp: Date.now(),
                                        status: 'pending',
                                        email: currentUser.email.toLowerCase().trim(),
                                        servicio: 'Filtro Vehicular Completo',
                                        pagoCon: 'creditos'
                                    }), updated_at: new Date() })
                                    .eq('placa', placa)
                                    .select('placa');

                                if (!updated || updated.length === 0) {
                                    await window.sb.from('solicitudes').insert({
                                        placa: placa,
                                        datos: {
                                            placa: placa,
                                            timestamp: Date.now(),
                                            status: 'pending',
                                            email: currentUser.email.toLowerCase().trim(),
                                            servicio: 'Filtro Vehicular Completo',
                                            pagoCon: 'creditos'
                                        },
                                        updated_at: new Date()
                                    });
                                }
                            } catch (e) {
                                console.error('Error actualizando solicitud con creditos:', e);
                            }

                            alert('Pago con créditos confirmado (S/ 20.00 descontados). El administrador procesará tu solicitud.');

                            window.location.href = 'panel_cliente.html';
                            isScanning = false;
                            isDeductingCredits = false;
                            return;
                        }
                    } else {
                        // Validar y mostrar alerta según créditos disponibles
                        const creditos = data ? data.creditos : 0;
                        isDeductingCredits = false;
                        isScanning = false;

                        const openPaymentGateway = () => {
                            localStorage.setItem('temp_informe_placa', placa);
                            openSale(20, 'Filtro Vehicular Completo - Placa: ' + placa, 0, 'filtro');
                        };
                        
                        if (creditos === 0) {
                            showCustomAlert(
                                'Saldo Insuficiente',
                                'No tienes créditos disponibles para este servicio. Puedes recargar tu saldo o pagar directamente por este expediente (S/ 20.00).',
                                openPaymentGateway
                            );
                        } else {
                            showCustomAlert(
                                'Saldo Insuficiente',
                                `Tienes ${creditos} créditos pero necesitas 20 para este servicio. Puedes recargar tu saldo o pagar la diferencia.`,
                                openPaymentGateway
                            );
                        }
                        return;
                    }
                } catch (e) {
                    console.error("Error validando créditos:", e);
                    isDeductingCredits = false;
                    isScanning = false;
                }
            }

            // 2. Si no hay créditos, guardar placa temporalmente y abrir pasarela de pago
            localStorage.setItem('temp_informe_placa', placa);
            openSale(20, 'Filtro Vehicular Completo - Placa: ' + placa, 0, 'filtro');
            isScanning = false;
            isDeductingCredits = false;
        }



        function setPayMethod(method) {
            // Remover estilos activos de todos los tabs
            document.querySelectorAll('.checkout-tab').forEach(t => {
                t.classList.remove('active');
                t.style.background = 'transparent';
                t.style.boxShadow = 'none';
                t.style.border = 'none';
                t.style.filter = 'grayscale(1)';
                t.style.opacity = '0.5';
            });
            
            // Aplicar estilos al tab seleccionado
            const tabId = 'tab' + method.charAt(0).toUpperCase() + method.slice(1);
            const tab = document.getElementById(tabId);
            if (tab) {
                tab.classList.add('active');
                tab.style.background = '#ffffff';
                tab.style.boxShadow = '0 2px 8px rgba(13,37,54,0.08)';
                tab.style.border = '2px solid #25d366';
                tab.style.filter = 'grayscale(0)';
                tab.style.opacity = '1';
            }

            const qr = document.getElementById('checkoutQR');
            // Usar qrpago.png como genérico o específico si existen logos separados
            qr.src = (method === 'yape') ? 'assets/media/qrpago.png' : 'assets/media/qrpago.png';

        }

        async function handleWASend(type, isHelp = false) {
            let p = window.currentCardPlate || '';
            if (!p) return alert("Por favor ingresa una placa.");

            let msg = isHelp ? `Hola, necesito ayuda con el pago del filtro para la placa ${p}.` :
                (type === 'receipt' ? `Hola, adjunto mi comprobante de pago para activar la consulta de ${window.currentCardTitle || 'Expediente'} para la placa ${p}.` : `Hola, solicito la verificación vehicular para la placa ${p}.`);

            // 🌟 INNOVACIÓN: Crear solicitud en Nube esperando respuesta
            if (window.sb && !isHelp) {
                const timestamp = Date.now();
                const reqData = {
                    placa: p,
                    timestamp: timestamp,
                    status: 'pending',
                    isIndividual: true,
                    servicio: window.currentCardTitle || "Consulta Individual", // 🌟 NUEVO
                    email: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.email : 'Anónimo'
                };
                
                try {
                    await window.sb.from('solicitudes').upsert({
                        placa: p,
                        datos: reqData,
                        updated_at: new Date()
                    }, { onConflict: 'placa' });
                } catch (e) {
                    console.error("Fallo alertando nube:", e);
                }
            }

            const url = `https://wa.me/51932465820?text=${encodeURIComponent(msg)}`;
            window.open(url, '_blank');

            // Registrar solicitud pendiente LOCALMENTE para que reporte.html la reconozca
            // Mantener metadata completa para no perder el servicio solicitado.
            const timestamp = new Date().getTime();
            const pendingData = {
                placa: p,
                timestamp: timestamp,
                status: 'pending',
                isIndividual: true,
                servicio: window.currentCardTitle || "Consulta Individual",
                email: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.email : 'Anónimo'
            };
            localStorage.setItem('pending_request_' + p, JSON.stringify(pendingData));
            await syncSolicitudToNube(p, pendingData);


            localStorage.setItem('last_pending_plate', p);

            // Redirigir al reporte en modo desenfoque de inmediato
            setTimeout(() => {
                window.location.href = `reporte.html?placa=${p}&pending=true`;
            }, 1000);
        }

        function handleVoucherUpload(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            const btn = document.getElementById('btnVoucher');
            if (btn) {
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ENVIANDO...';
                btn.style.pointerEvents = 'none';
                btn.style.opacity = '0.8';
            }

            const reader = new FileReader();
            reader.onload = function(evt) {
                try {
                    let resizedData = evt.target.result; // Default to raw data (e.g., for PDFs)
                    
                    const processAndSend = async (finalData) => {
                        try {
                            const timestamp = new Date().getTime();
                            const salePlateElem = document.getElementById('salePlate');
                            const backupPlate = salePlateElem ? salePlateElem.textContent.trim() : '---';

                            if (typeof currentSaleType !== 'undefined' && currentSaleType === 'activacion') {
                                const email = currentUser ? currentUser.email : backupPlate;
                                const key = 'ACTIVACION_' + timestamp;
                                const pendingData = { 
                                    placa: key, 
                                    timestamp: timestamp, 
                                    status: 'pending', 
                                    voucher: finalData, 
                                    isActivacion: true,
                                    email: email
                                };
                                localStorage.setItem('pending_request_' + key, JSON.stringify(pendingData));
                                await syncSolicitudToNube(key, pendingData);
                                
                                if (btn) btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> ENVIADO!';
                                setTimeout(() => {
                                    const alertHtml = `
                                        <div id="activacionAlertModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); z-index: 9999999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);">
                                            <div style="background: #ffffff; width: 90%; max-width: 330px; border-radius: 20px; padding: 25px; text-align: center; box-shadow: 0 30px 60px rgba(0,0,0,0.25); border: 1px solid rgba(0,0,0,0.03);">
                                                <div style="width: 50px; height: 50px; border-radius: 50%; background: #fef3c7; color: #f59e0b; display: flex; align-items: center; justify-content: center; font-size: 22px; margin: 0 auto 12px;">
                                                    <i class="fa-solid fa-rocket"></i>
                                                </div>
                                                <h3 style="font-size: 18px; color: #111b21; margin: 0 0 6px; font-weight: 900;">¡Pago Enviado!</h3>
                                                <p style="color: #64748b; font-size: 13px; line-height: 1.4; margin: 0 0 20px;">El administrador validará tu pago de S/ 35 para activar tu plataforma completa en breve.</p>
                                                <button onclick="document.getElementById('activacionAlertModal').remove(); closeSale();" style="width: 100%; padding: 12px; background: #25d366; color: white; border: none; border-radius: 12px; font-weight: 800; font-size: 13px; cursor: pointer;">ENTENDIDO</button>
                                            </div>
                                        </div>`;
                                    document.body.insertAdjacentHTML('beforeend', alertHtml);
                                }, 500);
                                return;
                            }

                            if (typeof currentSaleType !== 'undefined' && currentSaleType === 'dashboard') {
                                const email = currentUser ? currentUser.email : backupPlate;
                                const key = 'DASHBOARD_' + timestamp;
                                const pendingData = { 
                                    placa: key, 
                                    timestamp: timestamp, 
                                    status: 'pending', 
                                    voucher: finalData, 
                                    isDashboard: true,
                                    email: email
                                };
                                localStorage.setItem('pending_request_' + key, JSON.stringify(pendingData));
                                await syncSolicitudToNube(key, pendingData); // Await para evitar abortos
                                
                                if (btn) btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> ENVIADO!';
                                setTimeout(() => {
                                    const alertHtml = `
                                        <div id="dashboardAlertModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); z-index: 9999999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);">
                                            <div style="background: #ffffff; width: 90%; max-width: 330px; border-radius: 20px; padding: 25px; text-align: center; box-shadow: 0 30px 60px rgba(0,0,0,0.25); border: 1px solid rgba(0,0,0,0.03);">
                                                <div style="width: 50px; height: 50px; border-radius: 50%; background: rgba(37,211,102,0.1); color: #25d366; display: flex; align-items: center; justify-content: center; font-size: 22px; margin: 0 auto 12px;">
                                                    <i class="fa-solid fa-circle-check"></i>
                                                </div>
                                                <h3 style="font-size: 18px; color: #111b21; margin: 0 0 6px; font-weight: 900;">¡Comprobante Enviado!</h3>
                                                <p style="color: #64748b; font-size: 13px; line-height: 1.4; margin: 0 0 20px;">El administrador validará tu pago para activar tu Dashboard en breve.</p>
                                                <button onclick="document.getElementById('dashboardAlertModal').remove(); closeSale();" style="width: 100%; padding: 12px; background: #25d366; color: white; border: none; border-radius: 12px; font-weight: 800; font-size: 13px; cursor: pointer;">ENTENDIDO</button>
                                            </div>
                                        </div>`;
                                    document.body.insertAdjacentHTML('beforeend', alertHtml);
                                }, 500);
                                return;
                            }

                            if (typeof currentSaleCredits !== 'undefined' && currentSaleCredits > 0) {
                                const email = currentUser ? currentUser.email : 'Sin Correo';
                                const rechargeKey = 'RECARGA_' + currentSaleCredits + '_' + timestamp;
                                const pendingData = { 
                                    placa: rechargeKey, 
                                    timestamp: timestamp, 
                                    status: 'pending', 
                                    voucher: finalData, 
                                    isRecharge: true,
                                    credits: currentSaleCredits,
                                    email: email
                                };
                                localStorage.setItem('pending_request_' + rechargeKey, JSON.stringify(pendingData));
                                await syncSolicitudToNube(rechargeKey, pendingData); // Await para evitar abortos
                                
                                if (btn) {
                                    btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> SUBIR COMPROBANTE';
                                    btn.style.background = 'linear-gradient(135deg, #25d366 0%, #1ebe5d 100%)';
                                }
                                const montoRecarga = currentSaleAmount;
                                currentSaleCredits = 0;
                                currentSaleAmount = '0.00';

                                setTimeout(() => {
                                    const alertHtml = `
                                        <div id="rechargeAlertModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); z-index: 9999999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);">
                                            <div style="background: #ffffff; width: 90%; max-width: 330px; border-radius: 20px; padding: 25px; text-align: center; box-shadow: 0 30px 60px rgba(0,0,0,0.25); border: 1px solid rgba(0,0,0,0.03);">
                                                <div style="width: 50px; height: 50px; border-radius: 50%; background: rgba(37,211,102,0.1); color: #25d366; display: flex; align-items: center; justify-content: center; font-size: 22px; margin: 0 auto 12px;">
                                                    <i class="fa-solid fa-circle-check"></i>
                                                </div>
                                                <h3 style="font-size: 18px; color: #111b21; margin: 0 0 6px; font-weight: 900;">¡Formulario Enviado!</h3>
                                                <p style="color: #64748b; font-size: 13px; line-height: 1.4; margin: 0 0 20px;">Tu recarga de <b>S/ ${montoRecarga}</b> está siendo verificada.</p>
                                                <button onclick="document.getElementById('rechargeAlertModal').remove(); closeSale();" style="width: 100%; padding: 12px; background: #25d366; color: white; border: none; border-radius: 12px; font-weight: 800; font-size: 13px; cursor: pointer;">ENTENDIDO</button>
                                            </div>
                                        </div>`;
                                    document.body.insertAdjacentHTML('beforeend', alertHtml);
                                }, 1000);
                                return;
                            }

                            // Regular Plate Report - Simplificado
                            let p = localStorage.getItem('temp_informe_placa');
                            
                            if (!p && backupPlate && backupPlate !== '---' && backupPlate !== 'TU PLACA') {
                                p = backupPlate;
                            }
                            
                            if (!p) {
                                p = window.currentCardPlate || localStorage.getItem('last_pending_plate');
                            }
                            
                            if (!p) {
                                alert("Error: No se pudo identificar la placa de la consulta.");
                                if (btn) resetButtonState(btn);
                                return;
                            }

                            const pendingData = { 
                                placa: p, 
                                timestamp: timestamp, 
                                status: 'pending', 
                                voucher: finalData,
                                email: currentUser ? currentUser.email : 'Sin correo'
                            };
                            localStorage.setItem('pending_request_' + p, JSON.stringify(pendingData));
                            await syncSolicitudToNube(p, pendingData);
                            localStorage.setItem('last_pending_plate', p);
                            localStorage.removeItem('temp_informe_placa');
                            
                            // Cerrar la pasarela inmediatamente
                            closeSale();
                            
                            setTimeout(() => {
                                const alertHtml = `
                                    <div id="informeAlertModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); z-index: 9999999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);">
                                        <div style="background: #ffffff; width: 90%; max-width: 360px; border-radius: 20px; padding: 28px 24px; text-align: center; box-shadow: 0 30px 60px rgba(0,0,0,0.25); border: 1px solid rgba(0,0,0,0.03);">
                                            <div style="width: 56px; height: 56px; border-radius: 50%; background: #fff7ed; color: #f59e0b; display: flex; align-items: center; justify-content: center; font-size: 26px; margin: 0 auto 16px;">
                                                <i class="fa-solid fa-clock"></i>
                                            </div>
                                            <h3 style="font-size: 19px; color: #111b21; margin: 0 0 8px; font-weight: 900;">Comprobante en validación</h3>
                                            <p style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 0 0 6px;">Tu comprobante para la placa <strong style="color: #111b21;">${p}</strong> ha sido recibido y está en proceso de validación.</p>
                                            <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0 0 22px; background: #f8fafc; padding: 12px; border-radius: 10px; border-left: 3px solid #f59e0b;">Nuestro equipo verificará tu pago en los próximos minutos. Podrás ver el estado en <strong>"Mis Consultas"</strong>.</p>
                                            <button onclick="document.getElementById('informeAlertModal').remove(); closeSale(); showPendingNotificationBadge(); window.location.href='panel_cliente.html';" style="width: 100%; padding: 13px; background: #25d366; color: white; border: none; border-radius: 12px; font-weight: 800; font-size: 14px; cursor: pointer; margin-bottom: 8px;">VER MIS CONSULTAS</button>
                                            <button onclick="document.getElementById('informeAlertModal').remove(); closeSale(); showPendingNotificationBadge();" style="width: 100%; padding: 11px; background: transparent; color: #94a3b8; border: none; font-size: 12px; font-weight: 600; cursor: pointer;">CERRAR</button>
                                        </div>
                                    </div>`;
                                document.body.insertAdjacentHTML('beforeend', alertHtml);
                            }, 800);

                        } catch(err) {
                            console.error("Error procesando envío:", err);
                            if (btn) resetButtonState(btn);
                        }
                    };

                    // Control para IMÁGENES
                    if (file.type.startsWith('image/')) {
                        const img = new Image();
                        img.onload = function() {
                            try {
                                const canvas = document.createElement('canvas');
                                const maxW = 600, maxH = 800;
                                let w = img.width, h = img.height;
                                if (w > maxW || h > maxH) {
                                    if (w > h) { h *= maxW / w; w = maxW; }
                                    else { w *= maxH / h; h = maxH; }
                                }
                                canvas.width = w; canvas.height = h;
                                const ctx = canvas.getContext('2d');
                                ctx.drawImage(img, 0, 0, w, h);
                                resizedData = canvas.toDataURL('image/jpeg', 0.7);
                                processAndSend(resizedData);
                            } catch (e) { console.error("Canvas error:", e); processAndSend(evt.target.result); }
                        };
                        img.onerror = function() {
                            console.error("Error cargando imagen");
                            processAndSend(evt.target.result); // Enviar datos crudos como fallback
                        };
                        img.src = evt.target.result;
                    } else {
                        // Es un PDF u otro archivo
                        if (file.size > 2 * 1024 * 1024) {
                            alert("Advertencia: El archivo PDF es pesado. Considere optimizar su tamaño.");
                        }
                        processAndSend(resizedData); // Enviar sin redimensionar
                    }

                } catch(err) {
                    console.error("Error leyendo archivo:", err);
                    if (btn) resetButtonState(btn);
                }
            };
            reader.readAsDataURL(file);
        }

        function resetButtonState(btn) {
            if (!btn) return;
            btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> <span>SUBIR COMPROBANTE</span>';
            btn.style.pointerEvents = 'auto';
            btn.style.opacity = '1';
            btn.style.background = '';
            btn.style.borderColor = '';
            btn.style.boxShadow = '';
        }

        // --- LÓGICA DE DROPDOWN ---
        function toggleDropdown(e) {
            if (e) { e.stopPropagation(); e.preventDefault(); }
            var drp = document.getElementById('userDropdown');
            if (!drp) return;
            var isOpen = drp.classList.contains('open');
            if (isOpen) {
                drp.classList.remove('open');
                removeDropdownBackdrop();
            } else {
                drp.classList.add('open');
                createDropdownBackdrop();
            }
        }

        function closeUserDropdown() {
            var drp = document.getElementById('userDropdown');
            if (drp) drp.classList.remove('open');
            removeDropdownBackdrop();
        }

        function createDropdownBackdrop() {
            removeDropdownBackdrop();
            var bd = document.createElement('div');
            bd.id = 'dropdownBackdrop';
            bd.style.cssText = 'position:fixed;inset:0;z-index:999;background:transparent;';
            bd.addEventListener('click', function() { closeUserDropdown(); });
            bd.addEventListener('touchstart', function() { closeUserDropdown(); });
            document.body.appendChild(bd);
        }

        function removeDropdownBackdrop() {
            var bd = document.getElementById('dropdownBackdrop');
            if (bd) bd.remove();
        }

        // Cerrar dropdown con tecla Escape
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' || e.keyCode === 27) {
                closeUserDropdown();
            }
        });

        // Función de perfil (muestra info del usuario)
        function mostrarPerfilCliente() {
            closeUserDropdown();
            var modal = document.getElementById('infoModal');
            var content = document.getElementById('infoContent');
            if (modal && content) {
                content.innerHTML = '<div style="text-align:center;padding:20px;"><i class="fa-solid fa-user-circle" style="font-size:48px;color:#111b21;margin-bottom:15px;"></i><h3 style="font-size:18px;font-weight:800;color:#111b21;margin-bottom:8px;">Mi Perfil</h3><p style="font-size:13px;color:#64748b;">Gestiona tu cuenta desde el panel de cliente.</p><a href="panel_cliente.html" style="display:inline-block;margin-top:15px;background:#111b21;color:#fff;padding:10px 25px;border-radius:10px;text-decoration:none;font-weight:700;font-size:13px;">IR AL PANEL</a></div>';
                modal.style.display = 'flex';
            }
        }

        function togglePay(el) {
            // Redundante con el nuevo checkout pero mantenido para compatibilidad si se usa en otros sitios
        }


        // --- LÓGICA DE MODALES INFORMATIVOS ---
        const infoContents = {
            terms: `
                <div style="padding:24px 22px 20px;">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:20px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div style="width:36px; height:36px; background:#25d366; border-radius:10px; display:flex; align-items:center; justify-content:center;">
                                <i class="fa-solid fa-file-contract" style="color:#fff; font-size:16px;"></i>
                            </div>
                            <span style="font-size:16px; font-weight:800; color:#111b21;">Términos de Servicio</span>
                        </div>
                        <button onclick="closeInfo()" style="background:none; border:none; color:#9ca3af; font-size:18px; cursor:pointer; padding:4px;"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div style="border-top:1px solid #e5e7eb; padding-top:18px;">
                        <p style="font-size:13px; color:#6b7280; line-height:1.6; margin:0 0 16px;">Al acceder y utilizar la plataforma Filtro Vehicular Plus, usted declara haber leído, comprendido y aceptado en su totalidad los siguientes términos y condiciones de uso:</p>
                        <div style="margin-bottom:16px;">
                            <div style="font-size:13px; font-weight:700; color:#111b21; margin-bottom:6px;">1. Naturaleza del Servicio</div>
                            <p style="font-size:13px; color:#6b7280; line-height:1.7; margin:0;">Filtro Vehicular Plus es una plataforma digital de consulta e integración de información vehicular. Los datos mostrados provienen de fuentes públicas y oficiales del Estado Peruano, incluyendo SUNARP, SAT Lima, SAT Callao, MTC, ATU, SUTRAN, PNP y SBS. Nuestra función es consolidar y presentar esta información de manera organizada para facilitar la toma de decisiones del usuario.</p>
                        </div>
                        <div style="margin-bottom:16px;">
                            <div style="font-size:13px; font-weight:700; color:#111b21; margin-bottom:6px;">2. Uso de la Información</div>
                            <p style="font-size:13px; color:#6b7280; line-height:1.7; margin:0;">Los reportes generados tienen carácter exclusivamente informativo y referencial. No constituyen documentos legales, certificaciones ni declaraciones juradas. Recomendamos encarecidamente complementar la información obtenida con una inspección física del vehículo y la verificación presencial de documentos originales antes de concretar cualquier transacción comercial.</p>
                        </div>
                        <div style="margin-bottom:16px;">
                            <div style="font-size:13px; font-weight:700; color:#111b21; margin-bottom:6px;">3. Precisión de los Datos</div>
                            <p style="font-size:13px; color:#6b7280; line-height:1.7; margin:0;">Si bien nos esforzamos por mantener la información actualizada y precisa, Filtro Vehicular Plus no garantiza la exactitud absoluta de los datos, ya que estos dependen directamente de las bases de datos de las instituciones gubernamentales consultadas. No nos responsabilizamos por errores, omisiones o desactualizaciones en los registros de origen.</p>
                        </div>
                        <div style="margin-bottom:16px;">
                            <div style="font-size:13px; font-weight:700; color:#111b21; margin-bottom:6px;">4. Política de Pagos y Devoluciones</div>
                            <p style="font-size:13px; color:#6b7280; line-height:1.7; margin:0;">Debido a la naturaleza digital e instantánea del servicio, una vez procesado el pago y generado el acceso a la información, no se realizan devoluciones ni reembolsos. El usuario acepta esta condición al momento de efectuar cualquier transacción dentro de la plataforma. Los créditos adquiridos no tienen fecha de vencimiento.</p>
                        </div>
                        <div style="margin-bottom:16px;">
                            <div style="font-size:13px; font-weight:700; color:#111b21; margin-bottom:6px;">5. Propiedad Intelectual</div>
                            <p style="font-size:13px; color:#6b7280; line-height:1.7; margin:0;">Todo el contenido de la plataforma, incluyendo diseño, logotipos, textos, estructura y código fuente, es propiedad exclusiva de Filtro Vehicular Plus. Queda prohibida su reproducción, distribución o modificación sin autorización previa por escrito.</p>
                        </div>
                        <div style="margin-bottom:16px;">
                            <div style="font-size:13px; font-weight:700; color:#111b21; margin-bottom:6px;">6. Modificaciones</div>
                            <p style="font-size:13px; color:#6b7280; line-height:1.7; margin:0;">Nos reservamos el derecho de modificar estos términos en cualquier momento sin previo aviso. El uso continuado de la plataforma después de cualquier cambio constituye la aceptación de los nuevos términos. Se recomienda revisar esta sección periódicamente.</p>
                        </div>
                    </div>
                </div>
            `,
            privacy: `
                <div style="padding:24px 22px 20px;">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:20px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div style="width:36px; height:36px; background:#25d366; border-radius:10px; display:flex; align-items:center; justify-content:center;">
                                <i class="fa-solid fa-shield-halved" style="color:#fff; font-size:16px;"></i>
                            </div>
                            <span style="font-size:16px; font-weight:800; color:#111b21;">Política de Privacidad</span>
                        </div>
                        <button onclick="closeInfo()" style="background:none; border:none; color:#9ca3af; font-size:18px; cursor:pointer; padding:4px;"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div style="border-top:1px solid #e5e7eb; padding-top:18px;">
                        <p style="font-size:13px; color:#6b7280; line-height:1.6; margin:0 0 16px;">En cumplimiento con la <strong style="color:#111b21;">Ley N° 29733</strong> — Ley de Protección de Datos Personales del Perú y su Reglamento aprobado por Decreto Supremo N° 003-2013-JUS, informamos lo siguiente:</p>
                        <div style="margin-bottom:16px;">
                            <div style="font-size:13px; font-weight:700; color:#111b21; margin-bottom:6px;">1. Datos que Recopilamos</div>
                            <p style="font-size:13px; color:#6b7280; line-height:1.7; margin:0;">Para el funcionamiento del servicio, procesamos únicamente números de placa vehicular ingresados voluntariamente por el usuario. En caso de registro de cuenta, se solicita correo electrónico y número de WhatsApp para efectos de comunicación y soporte. No recopilamos datos biométricos, financieros ni información sensible de carácter personal.</p>
                        </div>
                        <div style="margin-bottom:16px;">
                            <div style="font-size:13px; font-weight:700; color:#111b21; margin-bottom:6px;">2. Finalidad del Tratamiento</div>
                            <p style="font-size:13px; color:#6b7280; line-height:1.7; margin:0;">Los datos proporcionados se utilizan exclusivamente para: (a) generar el reporte de verificación vehicular solicitado en tiempo real, (b) gestionar la cuenta del usuario y su historial de consultas, (c) brindar soporte técnico cuando sea requerido, y (d) enviar notificaciones relacionadas con el estado de sus solicitudes.</p>
                        </div>
                        <div style="margin-bottom:16px;">
                            <div style="font-size:13px; font-weight:700; color:#111b21; margin-bottom:6px;">3. Seguridad de la Información</div>
                            <p style="font-size:13px; color:#6b7280; line-height:1.7; margin:0;">Implementamos protocolos de cifrado SSL/TLS de 256 bits para proteger todas las comunicaciones entre su dispositivo y nuestros servidores. Los datos se almacenan en infraestructura cloud con certificaciones de seguridad internacionales. Realizamos auditorías periódicas para garantizar la integridad y confidencialidad de la información.</p>
                        </div>
                        <div style="margin-bottom:16px;">
                            <div style="font-size:13px; font-weight:700; color:#111b21; margin-bottom:6px;">4. Compartición de Datos</div>
                            <p style="font-size:13px; color:#6b7280; line-height:1.7; margin:0;">No vendemos, alquilamos ni compartimos información personal de nuestros usuarios con terceros bajo ninguna circunstancia, salvo requerimiento expreso de autoridad judicial competente mediante orden debidamente fundamentada.</p>
                        </div>
                        <div style="margin-bottom:16px;">
                            <div style="font-size:13px; font-weight:700; color:#111b21; margin-bottom:6px;">5. Derechos del Usuario</div>
                            <p style="font-size:13px; color:#6b7280; line-height:1.7; margin:0;">Usted tiene derecho a acceder, rectificar, cancelar u oponerse al tratamiento de sus datos personales en cualquier momento. Para ejercer estos derechos, puede contactarnos a través de nuestro canal de soporte por WhatsApp o correo electrónico.</p>
                        </div>
                    </div>
                </div>
            `,
            contact: `
                <div style="padding:24px 22px 20px;">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:20px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div style="width:36px; height:36px; background:#25d366; border-radius:10px; display:flex; align-items:center; justify-content:center;">
                                <i class="fa-solid fa-headset" style="color:#fff; font-size:16px;"></i>
                            </div>
                            <span style="font-size:16px; font-weight:800; color:#111b21;">Centro de Contacto</span>
                        </div>
                        <button onclick="closeInfo()" style="background:none; border:none; color:#9ca3af; font-size:18px; cursor:pointer; padding:4px;"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div style="border-top:1px solid #e5e7eb; padding-top:18px;">
                        <p style="font-size:13px; color:#6b7280; line-height:1.6; margin:0 0 16px;">Nuestro equipo de atención al cliente está disponible para ayudarte con cualquier consulta, incidencia técnica o duda sobre tu cuenta y servicios contratados.</p>
                        <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:12px; padding:16px; margin-bottom:16px;">
                            <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
                                <i class="fa-brands fa-whatsapp" style="color:#25d366; font-size:20px;"></i>
                                <div>
                                    <div style="font-size:14px; font-weight:700; color:#111b21;">+51 979 334 296</div>
                                    <div style="font-size:11px; color:#6b7280;">Canal principal de atención</div>
                                </div>
                            </div>
                            <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
                                <i class="fa-solid fa-clock" style="color:#25d366; font-size:16px;"></i>
                                <div>
                                    <div style="font-size:13px; font-weight:600; color:#111b21;">Lunes a Domingo</div>
                                    <div style="font-size:11px; color:#6b7280;">Disponible las 24 horas del día</div>
                                </div>
                            </div>
                            <div style="display:flex; align-items:center; gap:10px;">
                                <i class="fa-solid fa-bolt" style="color:#25d366; font-size:16px;"></i>
                                <div>
                                    <div style="font-size:13px; font-weight:600; color:#111b21;">Tiempo de respuesta</div>
                                    <div style="font-size:11px; color:#6b7280;">Menos de 5 minutos en horario laboral</div>
                                </div>
                            </div>
                        </div>
                        <div style="margin-bottom:16px;">
                            <div style="font-size:13px; font-weight:700; color:#111b21; margin-bottom:6px;">Soporte Técnico</div>
                            <p style="font-size:13px; color:#6b7280; line-height:1.7; margin:0;">Si experimentas algún problema con la carga de reportes, errores en la plataforma o inconvenientes con tu saldo, escríbenos indicando tu correo registrado y el número de placa consultado. Nuestro equipo técnico resolverá tu caso de manera prioritaria.</p>
                        </div>
                        <div style="margin-bottom:18px;">
                            <div style="font-size:13px; font-weight:700; color:#111b21; margin-bottom:6px;">Reclamos y Sugerencias</div>
                            <p style="font-size:13px; color:#6b7280; line-height:1.7; margin:0;">Valoramos tu opinión. Si tienes alguna sugerencia para mejorar nuestro servicio o deseas presentar un reclamo formal, no dudes en comunicarte con nosotros. Nos comprometemos a atender cada caso con la seriedad y rapidez que mereces.</p>
                        </div>
                        <a href="https://wa.me/51932465820?text=Hola%2C%20necesito%20ayuda%20con%20mi%20cuenta%20en%20Filtro%20Vehicular." target="_blank" style="display:flex; align-items:center; justify-content:center; gap:8px; width:100%; padding:13px; background:#25d366; color:#fff; border:none; border-radius:10px; font-size:14px; font-weight:700; cursor:pointer; text-decoration:none; transition:background 0.2s;" onmouseover="this.style.background='#1ebe5d'" onmouseout="this.style.background='#25d366'">
                            <i class="fa-brands fa-whatsapp" style="font-size:18px;"></i> Escribir por WhatsApp
                        </a>
                    </div>
                </div>
            `
        };

        function openInfo(type) {
            document.getElementById('infoContent').innerHTML = infoContents[type];
            document.getElementById('infoModal').style.display = 'flex';
        }

        function closeInfo() {
            document.getElementById('infoModal').style.display = 'none';
        }

// ─── SISTEMA DE CONSULTAS (Bridge Telegram) ────────────────────────────

        var BRIDGE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:3500'
            : 'https://transcripts-plain-are-ranch.trycloudflare.com';

        // Helper para fetch con header ngrok
        function bridgeFetch(url, options) {
            options = options || {};
            options.headers = options.headers || {};
            if (typeof options.headers === 'object' && !(options.headers instanceof Headers)) {
                options.headers['ngrok-skip-browser-warning'] = 'true';
            }
            return fetch(url, options);
        }

        var consultasModulos = [
            { id: 'orion', nombre: 'Orión', icono: 'fa-ghost', servicios: 121, desc: 'RENIEC, Vehículos, Delitos, SUNAT, Financiero' },
            { id: 'atlas', nombre: 'Atlas', icono: 'fa-atlas', servicios: 89, desc: 'RENIEC, Justicia, Actas, Migraciones, Facial' },
            { id: 'fenix', nombre: 'Fénix', icono: 'fa-fire-flame-curved', servicios: 65, desc: 'RENIEC, SUNARP, Generador, Telefonía' },
            { id: 'titan', nombre: 'Titán', icono: 'fa-shield-halved', servicios: 56, desc: 'RENIEC, Telefonía, SUNARP, Metadata' },
            { id: 'nova', nombre: 'Nova', icono: 'fa-rocket', servicios: 42, desc: 'RENIEC, Generador, Telefonía, SUNARP' },
        ];

        var consultasModuloActual = null;
        var consultasCatActual = null;

        var consultasComandosData = [];
        var consultasTodosComandos = [];
        var consultasCategoriasCache = {}; // Cache de categorías por módulo

        // Navegación inteligente: vuelve al paso anterior
        function volverConsultas() {
            var resEl = document.getElementById('consultasResultado');
            if (resEl && resEl.style.display === 'block') {
                // Estamos en resultado → volver a comandos de la categoría
                if (consultasCatActual && consultasModuloActual) {
                    renderConsultasComandos(consultasCatActual);
                } else if (consultasModuloActual) {
                    renderConsultasModulo(consultasModuloActual);
                } else {
                    renderConsultasCategorias();
                }
                return;
            }
            // Default
            if (consultasModuloActual) {
                renderConsultasModulo(consultasModuloActual);
            } else {
                renderConsultasCategorias();
            }
        }

        // Cargar todos los comandos para búsqueda
        async function cargarTodosComandos() {
            try {
                var res = await bridgeFetch(BRIDGE_URL + '/api/comandos');
                consultasTodosComandos = await res.json();
            } catch(e) { consultasTodosComandos = []; }
        }
        cargarTodosComandos();

        function filtrarConsultas(texto) {
            var busqEl = document.getElementById('consultasBusquedaResultados');
            var catsEl = document.getElementById('consultasCategorias');
            var cmdsEl = document.getElementById('consultasComandos');
            var resEl = document.getElementById('consultasResultado');

            if (!texto || texto.length < 2) {
                if (busqEl) busqEl.style.display = 'none';
                if (catsEl) catsEl.style.display = 'block';
                return;
            }

            if (catsEl) catsEl.style.display = 'none';
            if (cmdsEl) cmdsEl.style.display = 'none';
            if (resEl) resEl.style.display = 'none';
            if (busqEl) busqEl.style.display = 'block';

            var term = texto.toLowerCase();
            var resultados = consultasTodosComandos.filter(function(cmd) {
                return cmd.nombre.toLowerCase().includes(term) ||
                       cmd.descripcion.toLowerCase().includes(term) ||
                       cmd.categoria.toLowerCase().includes(term) ||
                       cmd.comando.toLowerCase().includes(term);
            });

            var moduloNombres = { orion: 'Orión', atlas: 'Atlas', fenix: 'Fénix', titan: 'Titán', nova: 'Nova' };

            busqEl.innerHTML = resultados.length === 0
                ? '<div style="text-align:center; padding:20px; color:#6b7280; font-size:12px;">No se encontraron servicios</div>'
                : '<div style="font-size:10px; color:#6b7280; margin-bottom:8px;">' + resultados.length + ' resultado(s)</div>' +
                  '<div style="display:flex; flex-direction:column; gap:6px;">' +
                  resultados.map(function(cmd) {
                      return '<div onclick="consultasComandosData=[]; consultasComandosData.push(' + JSON.stringify(cmd).replace(/"/g, '&quot;').replace(/'/g, "\\'") + '); abrirConsultaModal(\'' + cmd.id + '\')" style="background:#ffffff; border:1px solid #e5e7eb; border-radius:10px; padding:10px 12px; display:flex; align-items:center; gap:10px; cursor:pointer; transition:border-color 0.2s;" onmouseover="this.style.borderColor=\'#25d366\'" onmouseout="this.style.borderColor=\'#e5e7eb\'">' +
                          '<div style="width:30px; height:30px; min-width:30px; background:#25d366; border-radius:8px; display:flex; align-items:center; justify-content:center;">' +
                              '<i class="fa-solid ' + (cmd.tipo === 'pdf' ? 'fa-file-pdf' : cmd.tipo === 'foto' ? 'fa-image' : 'fa-file-lines') + '" style="font-size:12px; color:#fff;"></i>' +
                          '</div>' +
                          '<div style="flex:1; min-width:0;">' +
                              '<div style="font-size:11px; font-weight:600; color:#111b21;">' + cmd.nombre + '</div>' +
                              '<div style="font-size:8px; color:#6b7280;">' + (moduloNombres[cmd.modulo] || cmd.modulo) + ' · ' + cmd.categoria + '</div>' +
                          '</div>' +
                          '<div style="font-size:9px; color:' + (cmd.creditos === 0 ? '#25d366' : '#111b21') + '; font-weight:600;">' + (cmd.creditos === 0 ? 'Gratis' : cmd.creditos + ' Créditos') + '</div>' +
                      '</div>';
                  }).join('') +
                  '</div>';
        }

        function renderConsultasCategorias() {
            var container = document.getElementById('consultasCategorias');
            var cmdsEl = document.getElementById('consultasComandos');
            var resEl = document.getElementById('consultasResultado');
            if (!container) return;
            container.style.display = 'block';
            if (cmdsEl) cmdsEl.style.display = 'none';
            if (resEl) resEl.style.display = 'none';
            consultasModuloActual = null;

            var colores = { orion: '#6366f1', atlas: '#3b82f6', fenix: '#ef4444', titan: '#f59e0b', nova: '#10b981' };
            container.innerHTML = '<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:10px;">' +
                consultasModulos.map(function(mod) {
                    var color = colores[mod.id] || '#25d366';
                    return '<div onclick="renderConsultasModulo(\'' + mod.id + '\')" style="background:#111b21; border:1px solid #2a3942; border-radius:14px; padding:16px; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; gap:14px;" onmouseover="this.style.borderColor=\'' + color + '\';this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.borderColor=\'#2a3942\';this.style.transform=\'none\'">' +
                        '<div style="width:46px; height:46px; min-width:46px; background:' + color + '; border-radius:12px; display:flex; align-items:center; justify-content:center;">' +
                            '<i class="fa-solid ' + mod.icono + '" style="font-size:20px; color:#fff;"></i>' +
                        '</div>' +
                        '<div style="flex:1;">' +
                            '<div style="font-size:14px; font-weight:700; color:#e9edef;">' + mod.nombre + '</div>' +
                            '<div style="font-size:9px; color:#8696a0; margin-top:2px;">' + mod.desc + '</div>' +
                            '<div style="font-size:10px; color:' + color + '; font-weight:600; margin-top:3px;">' + mod.servicios + ' servicios</div>' +
                        '</div>' +
                        '<i class="fa-solid fa-chevron-right" style="font-size:12px; color:#8696a0;"></i>' +
                    '</div>';
                }).join('') +
            '</div>';
        }

        async function renderConsultasModulo(moduloId) {
            var container = document.getElementById('consultasCategorias');
            var cmdsEl = document.getElementById('consultasComandos');
            var resEl = document.getElementById('consultasResultado');
            if (!container) return;
            container.style.display = 'block';
            if (cmdsEl) cmdsEl.style.display = 'none';
            if (resEl) resEl.style.display = 'none';
            consultasModuloActual = moduloId;

            var modInfo = consultasModulos.find(function(m) { return m.id === moduloId; });

            // Cargar categorías del módulo (con cache)
            var categorias = [];
            if (consultasCategoriasCache[moduloId]) {
                categorias = consultasCategoriasCache[moduloId];
            } else {
                try {
                    var res = await bridgeFetch(BRIDGE_URL + '/api/modulos/' + moduloId + '/categorias');
                    categorias = await res.json();
                    consultasCategoriasCache[moduloId] = categorias;
                } catch(e) { categorias = []; }
            }

            var iconosCategoria = {
                'RENIEC': 'fa-id-card', 'VEHICULOS': 'fa-car', 'SUNARP': 'fa-building-columns',
                'TELEFONIA': 'fa-phone', 'DELITOS': 'fa-handcuffs', 'CERTIFICADOS': 'fa-file-shield',
                'FAMILIARES': 'fa-users', 'FAMILIA': 'fa-users', 'FINANCIERO': 'fa-chart-line',
                'VIP': 'fa-crown', 'GENERADOR': 'fa-wand-magic-sparkles', 'EXTRAS': 'fa-puzzle-piece',
                'FACIAL': 'fa-camera', 'JUSTICIA': 'fa-scale-balanced', 'SUNAT': 'fa-building',
                'ACTAS': 'fa-file-lines', 'MIGRACIONES': 'fa-plane', 'LABORAL': 'fa-briefcase',
                'METADATA': 'fa-magnifying-glass', 'POLICIAL': 'fa-shield-halved', 'VARIADO': 'fa-puzzle-piece',
                'VOUCHERS': 'fa-receipt', 'EXTRANJEROS': 'fa-passport', 'SALUD': 'fa-heart-pulse',
                'SIN COSTO': 'fa-gift', 'EXTRAS 2': 'fa-plus'
            };

            container.innerHTML = '<div style="background:#111b21; border-radius:12px; padding:14px 16px; margin-bottom:10px; display:flex; align-items:center; gap:10px;">' +
                '<button onclick="renderConsultasCategorias()" style="background:#25d366; color:#fff; border:none; width:30px; height:30px; border-radius:8px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:12px;"><i class="fa-solid fa-arrow-left"></i></button>' +
                '<div style="font-size:13px; font-weight:600; color:#e9edef;">' + (modInfo ? modInfo.nombre : moduloId) + '</div>' +
                '<div style="font-size:10px; color:#8696a0; margin-left:auto;">' + categorias.length + ' categorías</div>' +
            '</div>' +
            '<div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:8px;">' +
                categorias.map(function(cat) {
                    return '<div onclick="renderConsultasComandos(\'' + cat + '\')" style="background:#ffffff; border:1px solid #e5e7eb; border-radius:10px; padding:12px; cursor:pointer; transition:border-color 0.2s; display:flex; align-items:center; gap:10px;" onmouseover="this.style.borderColor=\'#25d366\'" onmouseout="this.style.borderColor=\'#e5e7eb\'">' +
                        '<div style="width:30px; height:30px; min-width:30px; background:#25d366; border-radius:8px; display:flex; align-items:center; justify-content:center;">' +
                            '<i class="fa-solid ' + (iconosCategoria[cat] || 'fa-folder') + '" style="font-size:12px; color:#fff;"></i>' +
                        '</div>' +
                        '<div style="font-size:11px; font-weight:600; color:#111b21;">' + cat + '</div>' +
                    '</div>';
                }).join('') +
            '</div>';
        }

        async function renderConsultasComandos(catId) {
            consultasCatActual = catId;
            var container = document.getElementById('consultasCategorias');
            var cmdsEl = document.getElementById('consultasComandos');
            if (!cmdsEl) return;
            if (container) container.style.display = 'none';
            cmdsEl.style.display = 'block';

            try {
                var url = consultasModuloActual
                    ? BRIDGE_URL + '/api/modulos/' + consultasModuloActual + '/categorias/' + catId
                    : BRIDGE_URL + '/api/categorias/' + catId;
                var res = await bridgeFetch(url);
                consultasComandosData = await res.json();
            } catch(e) { consultasComandosData = []; }

            var catInfo = null;

            var volverFn = consultasModuloActual ? 'renderConsultasModulo(\'' + consultasModuloActual + '\')' : 'renderConsultasCategorias()';

            cmdsEl.innerHTML = '<div style="background:#111b21; border-radius:12px; padding:14px 16px; margin-bottom:10px; display:flex; align-items:center; gap:10px;">' +
                '<button onclick="' + volverFn + '" style="background:#25d366; color:#fff; border:none; width:30px; height:30px; border-radius:8px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:12px;"><i class="fa-solid fa-arrow-left"></i></button>' +
                '<div style="font-size:13px; font-weight:600; color:#e9edef;">' + catId + '</div>' +
                '<div style="font-size:10px; color:#8696a0; margin-left:auto;">' + consultasComandosData.length + ' servicios</div>' +
            '</div>' +
            '<div style="display:flex; flex-direction:column; gap:6px;">' +
                consultasComandosData.map(function(cmd) {
                    return '<div onclick="abrirConsultaModal(\'' + cmd.id + '\')" style="background:#ffffff; border:1px solid #e5e7eb; border-radius:10px; padding:12px 14px; display:flex; align-items:center; gap:10px; cursor:pointer; transition:border-color 0.2s;" onmouseover="this.style.borderColor=\'#25d366\'" onmouseout="this.style.borderColor=\'#e5e7eb\'">' +
                        '<div style="width:32px; height:32px; min-width:32px; background:#25d366; border-radius:8px; display:flex; align-items:center; justify-content:center;">' +
                            '<i class="fa-solid ' + (cmd.tipo === 'pdf' ? 'fa-file-pdf' : cmd.tipo === 'foto' ? 'fa-image' : 'fa-file-lines') + '" style="font-size:13px; color:#fff;"></i>' +
                        '</div>' +
                        '<div style="flex:1; min-width:0;">' +
                            '<div style="font-size:11px; font-weight:600; color:#111b21;">' + cmd.nombre + '</div>' +
                            '<div style="font-size:9px; color:#6b7280;">' + cmd.descripcion + '</div>' +
                        '</div>' +
                        '<div style="flex-shrink:0; text-align:right;">' +
                            '<div style="font-size:10px; font-weight:600; color:' + (cmd.creditos === 0 ? '#25d366' : '#111b21') + ';">' + (cmd.creditos === 0 ? 'Gratis' : cmd.creditos + ' Créditos') + '</div>' +
                            '<div style="font-size:8px; color:#6b7280;">' + cmd.tipo.toUpperCase() + '</div>' +
                        '</div>' +
                    '</div>';
                }).join('') +
            '</div>';
        }

        function abrirConsultaModal(cmdId) {
            var cmd = consultasComandosData.find(function(c) { return c.id === cmdId; });
            if (!cmd) return;

            var placeholder = 'Ingresa el valor';
            if (cmd.parametro === 'dni') placeholder = 'Número de DNI (8 dígitos)';
            else if (cmd.parametro === 'placa') placeholder = 'Placa del vehículo (ABC123)';
            else if (cmd.parametro === 'telefono') placeholder = 'Número de celular (9 dígitos)';
            else if (cmd.parametro === 'ruc') placeholder = 'Número de RUC';
            else if (cmd.parametro === 'ce') placeholder = 'Carné de extranjería';
            else if (cmd.parametro === 'nombre') placeholder = 'NOMBRE|APELLIDO1|APELLIDO2';
            else if (cmd.parametro === 'correo') placeholder = 'correo@ejemplo.com';
            else if (cmd.parametro === 'nro_partida') placeholder = 'Número de partida SUNARP';
            else if (cmd.parametro === 'custom') placeholder = 'DNI o número de celular';

            var esFoto = cmd.parametro === 'foto';

            var infoModal = document.getElementById('infoModal');
            var infoContent = document.getElementById('infoContent');
            if (!infoModal || !infoContent) return;

            var inputHtml = esFoto
                ? '<label style="font-size:9px; color:#6b7280; font-weight:500; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">Selecciona una foto</label>' +
                  '<input type="file" id="consultaFoto" accept="image/*" style="width:100%; padding:10px; border:1px solid #e5e7eb; border-radius:8px; font-size:12px; color:#111b21; box-sizing:border-box; cursor:pointer;">'
                : '<label style="font-size:9px; color:#6b7280; font-weight:500; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">Dato a consultar</label>' +
                  '<input type="text" id="consultaInput" placeholder="' + placeholder + '" style="width:100%; padding:11px 12px; border:1px solid #e5e7eb; border-radius:8px; font-size:14px; color:#111b21; outline:none; box-sizing:border-box; text-align:center; font-family:\'Roboto\',sans-serif; transition:border-color 0.2s;" onfocus="this.style.borderColor=\'#25d366\'" onblur="this.style.borderColor=\'#e5e7eb\'" onkeydown="if(event.key===\'Enter\')ejecutarConsulta(\'' + cmdId + '\')">';

            infoContent.innerHTML = '<div style="background:#111b21; padding:20px 18px 16px; position:relative;">' +
                '<button onclick="document.getElementById(\'infoModal\').style.display=\'none\'" style="position:absolute; top:12px; right:12px; background:none; border:none; color:#8696a0; font-size:16px; cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>' +
                '<div style="display:flex; align-items:center; gap:10px;">' +
                    '<div style="width:36px; height:36px; background:#25d366; border-radius:10px; display:flex; align-items:center; justify-content:center;">' +
                        '<i class="fa-solid ' + (esFoto ? 'fa-camera' : cmd.tipo === 'pdf' ? 'fa-file-pdf' : cmd.tipo === 'foto' ? 'fa-image' : 'fa-file-lines') + '" style="font-size:15px; color:#fff;"></i>' +
                    '</div>' +
                    '<div>' +
                        '<div style="font-size:13px; font-weight:600; color:#e9edef;">' + cmd.nombre + '</div>' +
                        '<div style="font-size:10px; color:#8696a0;">' + (cmd.creditos === 0 ? 'Gratis' : cmd.creditos + ' Créditos') + ' · ' + cmd.tipo.toUpperCase() + '</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div style="padding:18px;">' +
                inputHtml +
                '<button id="btnConsulta" onclick="ejecutarConsulta(\'' + cmdId + '\')" style="width:100%; padding:12px; background:#111b21; color:#fff; border:none; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; margin-top:12px; display:flex; align-items:center; justify-content:center; gap:6px;" onmouseover="this.style.background=\'#1f2c34\'" onmouseout="this.style.background=\'#111b21\'">' +
                    '<i class="fa-solid fa-magnifying-glass" style="font-size:12px;"></i> Consultar' +
                '</button>' +
            '</div>';

            infoModal.style.display = 'flex';
            setTimeout(function() { var inp = document.getElementById('consultaInput'); if(inp) inp.focus(); }, 100);
        }

        function formatearResultado(texto) {
            if (!texto || !texto.trim()) return '<span style="color:#9ca3af;">Sin respuesta</span>';
            // Convertir negritas markdown
            var html = texto.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
            // Detectar líneas tipo "CAMPO : VALOR" y formatear como filas
            var lineas = html.split('\n');
            var filas = [];
            var otrasLineas = [];
            lineas.forEach(function(linea) {
                var limpia = linea.trim();
                if (!limpia) return;
                // Detectar patrón CAMPO : VALOR
                var match = limpia.match(/^([A-ZÁÉÍÓÚÑ\s\.\/_-]{2,}?)\s*:\s*(.+)$/i);
                if (match && match[1].trim().length > 1 && match[2].trim().length > 0) {
                    filas.push({ campo: match[1].trim(), valor: match[2].trim() });
                } else {
                    // Si había filas acumuladas, renderizar tabla primero
                    if (filas.length > 0) {
                        otrasLineas.push(renderTablaResultado(filas));
                        filas = [];
                    }
                    otrasLineas.push('<div style="padding:2px 0;">' + limpia + '</div>');
                }
            });
            if (filas.length > 0) {
                otrasLineas.push(renderTablaResultado(filas));
            }
            return otrasLineas.join('');
        }

        function renderTablaResultado(filas) {
            var html = '<table style="width:100%; border-collapse:collapse; margin:8px 0;">';
            filas.forEach(function(f) {
                html += '<tr>' +
                    '<td style="padding:6px 10px 6px 0; font-weight:600; color:#6b7280; white-space:nowrap; vertical-align:top; font-size:11px; text-transform:uppercase; border-bottom:1px solid #f3f4f6;">' + f.campo + '</td>' +
                    '<td style="padding:6px 0; color:#111b21; font-weight:500; border-bottom:1px solid #f3f4f6;">' + f.valor + '</td>' +
                '</tr>';
            });
            html += '</table>';
            return html;
        }

        // Función para renderizar resultado de consulta
        function mostrarResultadoConsulta(data) {
            var resEl = document.getElementById('consultasResultado');
            var catsEl = document.getElementById('consultasCategorias');
            var cmdsEl = document.getElementById('consultasComandos');
            if (catsEl) catsEl.style.display = 'none';
            if (cmdsEl) cmdsEl.style.display = 'none';
            if (!resEl) return;
            resEl.style.display = 'block';

            var imagenesHtml = '';
            var archivosHtml = '';
            var archivos = (data.resultado && data.resultado.archivos) || [];
            if (archivos.length > 0) {
                var imagenes = archivos.filter(function(f) { return f.tipo === 'imagen'; });
                var docs = archivos.filter(function(f) { return f.tipo !== 'imagen'; });

                if (imagenes.length > 0) {
                    imagenesHtml = '<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:8px; margin-bottom:14px;">' +
                        imagenes.map(function(f) {
                            return '<a href="' + BRIDGE_URL + f.url + '" target="_blank" download style="display:block; position:relative; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden; aspect-ratio:3/4;">' +
                                '<img src="' + BRIDGE_URL + f.url + '" style="width:100%; height:100%; object-fit:cover; display:block;">' +
                                '<div style="position:absolute; bottom:4px; right:4px; background:rgba(0,0,0,0.6); color:#fff; width:22px; height:22px; border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:9px;"><i class="fa-solid fa-download"></i></div>' +
                            '</a>';
                        }).join('') +
                    '</div>';
                }
                docs.forEach(function(f) {
                    if (f.tipo === 'pdf') {
                        archivosHtml += '<a href="' + BRIDGE_URL + f.url + '" target="_blank" style="display:flex; align-items:center; gap:10px; padding:12px 14px; background:#111b21; border:1px solid #2a3942; border-radius:10px; text-decoration:none; color:#e9edef; font-size:12px; font-weight:600; margin-top:10px;">' +
                            '<div style="width:36px; height:36px; min-width:36px; background:#ef4444; border-radius:8px; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-file-pdf" style="color:#fff; font-size:16px;"></i></div>' +
                            '<div><div style="font-size:12px; font-weight:600;">Descargar PDF</div><div style="font-size:10px; color:#8696a0; font-weight:400;">Toca para abrir el documento</div></div>' +
                            '<i class="fa-solid fa-arrow-up-right-from-square" style="margin-left:auto; font-size:11px; color:#8696a0;"></i>' +
                        '</a>';
                    } else {
                        archivosHtml += '<a href="' + BRIDGE_URL + f.url + '" target="_blank" style="display:flex; align-items:center; gap:10px; padding:12px 14px; background:#111b21; border:1px solid #2a3942; border-radius:10px; text-decoration:none; color:#e9edef; font-size:12px; font-weight:600; margin-top:10px;">' +
                            '<div style="width:36px; height:36px; min-width:36px; background:#25d366; border-radius:8px; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-download" style="color:#fff; font-size:14px;"></i></div>' +
                            '<div><div style="font-size:12px; font-weight:600;">Descargar archivo</div><div style="font-size:10px; color:#8696a0; font-weight:400;">Toca para descargar</div></div>' +
                            '<i class="fa-solid fa-arrow-up-right-from-square" style="margin-left:auto; font-size:11px; color:#8696a0;"></i>' +
                        '</a>';
                    }
                });
            }

            var textoFormateado = formatearResultado((data.resultado && data.resultado.texto) || '');
            var creditoHtml = '';
            if (data.cobrado) {
                creditoHtml = '<div style="display:flex; align-items:center; gap:8px; padding:10px 14px; background:#dcfce7; border:1px solid #bbf7d0; border-radius:8px; margin-top:12px; font-size:11px; color:#15803d;">' +
                    '<i class="fa-solid fa-coins"></i> Se descontaron <b>' + data.creditosUsados + '</b> crédito(s) &nbsp;|&nbsp; Saldo: <b>' + (data.creditosRestantes !== undefined ? data.creditosRestantes : '?') + '</b> créditos</div>';
            } else if (data.ok && !data.cobrado) {
                creditoHtml = '<div style="display:flex; align-items:center; gap:8px; padding:10px 14px; background:#fef3c7; border:1px solid #fde68a; border-radius:8px; margin-top:12px; font-size:11px; color:#92400e;">' +
                    '<i class="fa-solid fa-info-circle"></i> No se cobraron créditos (sin resultados útiles)</div>';
            }

            var moduloNombres2 = { orion: 'Orión', atlas: 'Atlas', fenix: 'Fénix', titan: 'Titán', nova: 'Nova' };
            var moduloLabel = data.modulo ? (moduloNombres2[data.modulo] || data.modulo) : '';
            var cmdLabel = data.comando ? data.comando.nombre : '';

            resEl.innerHTML = '<div style="background:#111b21; border-radius:12px; padding:14px 16px; margin-bottom:10px; display:flex; align-items:center; gap:10px;">' +
                '<button onclick="volverConsultas()" style="background:#25d366; color:#fff; border:none; width:30px; height:30px; border-radius:8px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:12px;"><i class="fa-solid fa-arrow-left"></i></button>' +
                '<div style="flex:1;"><div style="font-size:13px; font-weight:600; color:#e9edef;">Resultado</div>' +
                (moduloLabel ? '<div style="font-size:9px; color:#8696a0;">' + moduloLabel + ' · ' + cmdLabel + '</div>' : '') +
                '</div></div>' +
                '<div style="background:#ffffff; border:1px solid #e5e7eb; border-radius:12px; padding:16px; font-size:12px; color:#111b21; line-height:1.7; word-break:break-word;">' +
                imagenesHtml + textoFormateado + archivosHtml + creditoHtml + '</div>';

            if (data.creditosRestantes !== undefined) {
                var logoStatus = document.getElementById('logoStatus');
                if (logoStatus) logoStatus.textContent = Math.floor(data.creditosRestantes) + ' Créditos';
            }
        }

        async function ejecutarConsulta(cmdId) {
            var btn = document.getElementById('btnConsulta');
            if (!btn) return;

            var fotoInput = document.getElementById('consultaFoto');
            if (fotoInput && fotoInput.files && fotoInput.files.length > 0) {
                ejecutarConsultaFoto(cmdId, fotoInput.files[0]);
                return;
            }

            var input = document.getElementById('consultaInput');
            var valor = input ? input.value.trim() : '';
            if (!valor) { alert('Ingresa un valor para consultar.'); return; }

            if (!currentUser || !currentUser.email) {
                alert('Debes iniciar sesión para hacer consultas.');
                return;
            }

            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Consultando...';
            btn.disabled = true;

            try {
                // Paso 1: Enviar consulta (respuesta inmediata con jobId)
                var res = await bridgeFetch(BRIDGE_URL + '/api/consulta', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ comandoId: cmdId, valor: valor, email: currentUser.email })
                });
                var data = await res.json();

                // Manejar errores de créditos
                if (!data.ok && data.error) {
                    btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Consultar';
                    btn.disabled = false;
                    if (res.status === 402 || res.status === 403) {
                        document.getElementById('infoModal').style.display = 'none';
                        if (typeof openAccess === 'function') openAccess();
                    } else {
                        alert(data.error);
                    }
                    return;
                }

                // Paso 2: Polling — esperar resultado
                if (data.status === 'processing' && data.jobId) {
                    document.getElementById('infoModal').style.display = 'none';
                    var resEl = document.getElementById('consultasResultado');
                    var catsEl = document.getElementById('consultasCategorias');
                    var cmdsEl = document.getElementById('consultasComandos');
                    if (catsEl) catsEl.style.display = 'none';
                    if (cmdsEl) cmdsEl.style.display = 'none';
                    if (resEl) {
                        resEl.style.display = 'block';
                        resEl.innerHTML = '<div style="background:#111b21; border-radius:12px; padding:14px 16px; margin-bottom:10px; display:flex; align-items:center; gap:10px;">' +
                            '<button onclick="volverConsultas()" style="background:#25d366; color:#fff; border:none; width:30px; height:30px; border-radius:8px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:12px;"><i class="fa-solid fa-arrow-left"></i></button>' +
                            '<div style="font-size:13px; font-weight:600; color:#e9edef;">Procesando...</div>' +
                        '</div>' +
                        '<div style="background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:30px; text-align:center;">' +
                            '<i class="fa-solid fa-spinner fa-spin" style="font-size:28px; color:#25d366; margin-bottom:12px; display:block;"></i>' +
                            '<div style="font-size:13px; font-weight:600; color:#111b21;">Consultando al sistema...</div>' +
                            '<div style="font-size:11px; color:#6b7280; margin-top:4px;">Esto puede tardar unos segundos</div>' +
                        '</div>';
                    }

                    var jobId = data.jobId;
                    var maxPolls = 60;
                    var pollInterval = setInterval(async function() {
                        try {
                            maxPolls--;
                            if (maxPolls <= 0) {
                                clearInterval(pollInterval);
                                if (resEl) resEl.innerHTML = '<div style="background:#111b21; border-radius:12px; padding:14px 16px; margin-bottom:10px; display:flex; align-items:center; gap:10px;">' +
                                    '<button onclick="volverConsultas()" style="background:#25d366; color:#fff; border:none; width:30px; height:30px; border-radius:8px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:12px;"><i class="fa-solid fa-arrow-left"></i></button>' +
                                    '<div style="font-size:13px; font-weight:600; color:#e9edef;">Timeout</div></div>' +
                                    '<div style="background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:20px; text-align:center;">' +
                                    '<div style="font-size:13px; color:#6b7280;">La consulta tardó demasiado.</div>' +
                                    '<button onclick="volverConsultas()" style="margin-top:14px; padding:10px 24px; background:#111b21; color:#fff; border:none; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer;">Volver</button></div>';
                                return;
                            }
                            var pollRes = await bridgeFetch(BRIDGE_URL + '/api/consulta/' + jobId);
                            var pollData = await pollRes.json();
                            if (pollData.status === 'processing') return;
                            clearInterval(pollInterval);
                            mostrarResultadoConsulta(pollData);
                        } catch(pe) { /* seguir intentando */ }
                    }, 2000);
                    return;
                }
                document.getElementById('infoModal').style.display = 'none';
            } catch(e) {
                // Mostrar error en el resultado, no alert bloqueante
                var resEl2 = document.getElementById('consultasResultado');
                if (resEl2) {
                    document.getElementById('infoModal').style.display = 'none';
                    var catsEl2 = document.getElementById('consultasCategorias');
                    var cmdsEl2 = document.getElementById('consultasComandos');
                    if (catsEl2) catsEl2.style.display = 'none';
                    if (cmdsEl2) cmdsEl2.style.display = 'none';
                    resEl2.style.display = 'block';
                    resEl2.innerHTML = '<div style="background:#111b21; border-radius:12px; padding:14px 16px; margin-bottom:10px; display:flex; align-items:center; gap:10px;">' +
                        '<button onclick="volverConsultas()" style="background:#25d366; color:#fff; border:none; width:30px; height:30px; border-radius:8px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:12px;"><i class="fa-solid fa-arrow-left"></i></button>' +
                        '<div style="font-size:13px; font-weight:600; color:#e9edef;">Error</div>' +
                    '</div>' +
                    '<div style="background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:20px; text-align:center;">' +
                        '<i class="fa-solid fa-wifi" style="font-size:28px; color:#ef4444; margin-bottom:10px; display:block;"></i>' +
                        '<div style="font-size:13px; font-weight:600; color:#111b21; margin-bottom:4px;">Error de conexión</div>' +
                        '<div style="font-size:11px; color:#6b7280;">El servidor no respondió. Intenta de nuevo en unos segundos.</div>' +
                        '<button onclick="volverConsultas()" style="margin-top:14px; padding:10px 24px; background:#111b21; color:#fff; border:none; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer;">Volver</button>' +
                    '</div>';
                } else {
                    btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Consultar';
                    btn.disabled = false;
                }
            }
        }

        async function ejecutarConsultaFoto(cmdId, file) {
            var btn = document.getElementById('btnConsulta');
            if (btn) { btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando foto...'; btn.disabled = true; }

            if (!currentUser || !currentUser.email) {
                alert('Debes iniciar sesión para hacer consultas.');
                if (btn) { btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Consultar'; btn.disabled = false; }
                return;
            }

            try {
                var formData = new FormData();
                formData.append('comandoId', cmdId);
                formData.append('email', currentUser.email);
                formData.append('foto', file);

                var res = await bridgeFetch(BRIDGE_URL + '/api/consulta/foto', { method: 'POST', body: formData });
                var data = await res.json();

                // Manejar errores de créditos
                if (!data.ok && data.error) {
                    if (btn) { btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Consultar'; btn.disabled = false; }
                    if (res.status === 402) {
                        document.getElementById('infoModal').style.display = 'none';
                        if (typeof openAccess === 'function') openAccess();
                    } else {
                        alert(data.error);
                    }
                    return;
                }

                document.getElementById('infoModal').style.display = 'none';

                var resEl = document.getElementById('consultasResultado');
                if (document.getElementById('consultasCategorias')) document.getElementById('consultasCategorias').style.display = 'none';
                if (document.getElementById('consultasComandos')) document.getElementById('consultasComandos').style.display = 'none';
                if (resEl) {
                    resEl.style.display = 'block';
                    var textoFormateado = formatearResultado((data.resultado && data.resultado.texto) || '');

                    // Renderizar archivos (imágenes y PDFs)
                    var imagenesHtml = '';
                    var archivosHtml = '';
                    if (data.resultado && data.resultado.archivos && data.resultado.archivos.length > 0) {
                        var imagenes = data.resultado.archivos.filter(function(f) { return f.tipo === 'imagen'; });
                        var docs = data.resultado.archivos.filter(function(f) { return f.tipo !== 'imagen'; });

                        if (imagenes.length > 0) {
                            imagenesHtml = '<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:8px; margin-bottom:14px;">' +
                                imagenes.map(function(f) {
                                    return '<a href="' + BRIDGE_URL + f.url + '" target="_blank" download style="display:block; position:relative; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden; aspect-ratio:3/4;">' +
                                        '<img src="' + BRIDGE_URL + f.url + '" style="width:100%; height:100%; object-fit:cover; display:block;">' +
                                        '<div style="position:absolute; bottom:4px; right:4px; background:rgba(0,0,0,0.6); color:#fff; width:22px; height:22px; border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:9px;"><i class="fa-solid fa-download"></i></div>' +
                                    '</a>';
                                }).join('') +
                            '</div>';
                        }

                        docs.forEach(function(f) {
                            if (f.tipo === 'pdf') {
                                archivosHtml += '<a href="' + BRIDGE_URL + f.url + '" target="_blank" style="display:flex; align-items:center; gap:10px; padding:12px 14px; background:#111b21; border:1px solid #2a3942; border-radius:10px; text-decoration:none; color:#e9edef; font-size:12px; font-weight:600; margin-top:10px;">' +
                                    '<div style="width:36px; height:36px; min-width:36px; background:#ef4444; border-radius:8px; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-file-pdf" style="color:#fff; font-size:16px;"></i></div>' +
                                    '<div><div style="font-size:12px; font-weight:600;">Descargar PDF</div><div style="font-size:10px; color:#8696a0; font-weight:400;">Toca para abrir el documento</div></div>' +
                                    '<i class="fa-solid fa-arrow-up-right-from-square" style="margin-left:auto; font-size:11px; color:#8696a0;"></i>' +
                                '</a>';
                            } else {
                                archivosHtml += '<a href="' + BRIDGE_URL + f.url + '" target="_blank" style="display:flex; align-items:center; gap:10px; padding:12px 14px; background:#111b21; border:1px solid #2a3942; border-radius:10px; text-decoration:none; color:#e9edef; font-size:12px; font-weight:600; margin-top:10px;">' +
                                    '<div style="width:36px; height:36px; min-width:36px; background:#25d366; border-radius:8px; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-download" style="color:#fff; font-size:14px;"></i></div>' +
                                    '<div><div style="font-size:12px; font-weight:600;">Descargar archivo</div><div style="font-size:10px; color:#8696a0; font-weight:400;">Toca para descargar</div></div>' +
                                    '<i class="fa-solid fa-arrow-up-right-from-square" style="margin-left:auto; font-size:11px; color:#8696a0;"></i>' +
                                '</a>';
                            }
                        });
                    }

                    var creditoHtml = '';
                    if (data.cobrado) {
                        creditoHtml = '<div style="display:flex; align-items:center; gap:8px; padding:10px 14px; background:#dcfce7; border:1px solid #bbf7d0; border-radius:8px; margin-top:12px; font-size:11px; color:#15803d;">' +
                            '<i class="fa-solid fa-coins"></i> Se descontaron <b>' + data.creditosUsados + '</b> crédito(s) &nbsp;|&nbsp; Saldo: <b>' + (data.creditosRestantes !== undefined ? data.creditosRestantes : '?') + '</b> créditos' +
                        '</div>';
                    } else if (data.ok && !data.cobrado) {
                        creditoHtml = '<div style="display:flex; align-items:center; gap:8px; padding:10px 14px; background:#fef3c7; border:1px solid #fde68a; border-radius:8px; margin-top:12px; font-size:11px; color:#92400e;">' +
                            '<i class="fa-solid fa-info-circle"></i> No se cobraron créditos (sin resultados útiles)' +
                        '</div>';
                    }

                    resEl.innerHTML = '<div style="background:#111b21; border-radius:12px; padding:14px 16px; margin-bottom:10px; display:flex; align-items:center; gap:10px;">' +
                        '<button onclick="volverConsultas()" style="background:#25d366; color:#fff; border:none; width:30px; height:30px; border-radius:8px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:12px;"><i class="fa-solid fa-arrow-left"></i></button>' +
                        '<div style="font-size:13px; font-weight:600; color:#e9edef;">Resultado</div>' +
                    '</div>' +
                    '<div style="background:#ffffff; border:1px solid #e5e7eb; border-radius:12px; padding:16px; font-size:12px; color:#111b21; line-height:1.7; word-break:break-word;">' +
                        imagenesHtml + textoFormateado + archivosHtml + creditoHtml +
                    '</div>';

                    if (data.creditosRestantes !== undefined) {
                        var logoStatus = document.getElementById('logoStatus');
                        if (logoStatus) logoStatus.textContent = Math.floor(data.creditosRestantes) + ' Créditos';
                    }
                }
            } catch(e) {
                document.getElementById('infoModal').style.display = 'none';
                var resEl3 = document.getElementById('consultasResultado');
                if (resEl3) {
                    var catsEl3 = document.getElementById('consultasCategorias');
                    var cmdsEl3 = document.getElementById('consultasComandos');
                    if (catsEl3) catsEl3.style.display = 'none';
                    if (cmdsEl3) cmdsEl3.style.display = 'none';
                    resEl3.style.display = 'block';
                    resEl3.innerHTML = '<div style="background:#111b21; border-radius:12px; padding:14px 16px; margin-bottom:10px; display:flex; align-items:center; gap:10px;">' +
                        '<button onclick="volverConsultas()" style="background:#25d366; color:#fff; border:none; width:30px; height:30px; border-radius:8px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:12px;"><i class="fa-solid fa-arrow-left"></i></button>' +
                        '<div style="font-size:13px; font-weight:600; color:#e9edef;">Error</div>' +
                    '</div>' +
                    '<div style="background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:20px; text-align:center;">' +
                        '<i class="fa-solid fa-wifi" style="font-size:28px; color:#ef4444; margin-bottom:10px; display:block;"></i>' +
                        '<div style="font-size:13px; font-weight:600; color:#111b21; margin-bottom:4px;">Error de conexión</div>' +
                        '<div style="font-size:11px; color:#6b7280;">El servidor no respondió. Intenta de nuevo en unos segundos.</div>' +
                        '<button onclick="volverConsultas()" style="margin-top:14px; padding:10px 24px; background:#111b21; color:#fff; border:none; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer;">Volver</button>' +
                    '</div>';
                }
                if (btn) { btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Consultar'; btn.disabled = false; }
            }
        }

// =========================================

        // Exponer funciones de consultas al scope global (para onclick inline)
        window.renderConsultasCategorias = renderConsultasCategorias;
        window.renderConsultasModulo = renderConsultasModulo;
        window.renderConsultasComandos = renderConsultasComandos;
        window.abrirConsultaModal = abrirConsultaModal;
        window.ejecutarConsulta = ejecutarConsulta;
        window.ejecutarConsultaFoto = ejecutarConsultaFoto;
        window.filtrarConsultas = filtrarConsultas;
        window.volverConsultas = volverConsultas;
        window.mostrarResultadoConsulta = mostrarResultadoConsulta;

        // 1. Registrar el Service Worker
        if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('sw.js')
                    .catch(err => console.error('Error registrando Service Worker:', err));
            });
        }

        // 2. Gestionar la instalación PWA (evento capturado en <head>)
        var deferredPrompt = window.deferredInstallPrompt || null;
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            window.deferredInstallPrompt = e;
        });

        // Mostrar banner tras cargar (si no fue descartado y no está instalada)
        function showFloatingButtons() {
            var w = document.getElementById('walletFloatingBtn');
            var wa = document.querySelector('.wa-assistant');
            if (w) w.style.display = '';
            if (wa) wa.style.display = '';
        }

        function hideFloatingButtons() {
            var w = document.getElementById('walletFloatingBtn');
            var wa = document.querySelector('.wa-assistant');
            if (w) w.style.display = 'none';
            if (wa) wa.style.display = 'none';
        }

        if (!window.matchMedia('(display-mode: standalone)').matches && !localStorage.getItem('pwa_banner_dismissed')) {
            hideFloatingButtons();
            setTimeout(() => {
                if (document.getElementById('pwaBannerContainer')) return;
                const pwaBanner = document.createElement('div');
                pwaBanner.id = "pwaBannerContainer";
                pwaBanner.innerHTML = `
                    <div style="position:fixed; bottom:16px; left:12px; right:12px; max-width:460px; margin:0 auto; background:#111b21; border-radius:14px; padding:14px 16px; display:flex; align-items:center; gap:12px; z-index:99999; animation:slideInPwa 0.4s ease forwards; border:1px solid #2a3942;">
                        <div style="width:40px; height:40px; min-width:40px; border-radius:10px; background:#25d366; display:flex; align-items:center; justify-content:center;">
                            <i class="fa-solid fa-download" style="font-size:16px; color:#fff;"></i>
                        </div>
                        <div style="flex:1; min-width:0;">
                            <div style="font-weight:600; font-size:13px; color:#e9edef;">Instalar App</div>
                            <div style="font-size:11px; color:#8696a0; font-weight:400;">Acceso rápido desde tu pantalla de inicio</div>
                        </div>
                        <button id="btnInstallApp" style="background:#25d366; color:#fff; border:none; padding:8px 14px; border-radius:8px; font-weight:600; cursor:pointer; font-size:11px; transition:background 0.2s; flex-shrink:0; white-space:nowrap;" onmouseover="this.style.background='#1ebe5d'" onmouseout="this.style.background='#25d366'">
                            Instalar
                        </button>
                        <button id="btnDismissPwa" style="background:none; border:none; color:#8696a0; font-size:16px; cursor:pointer; padding:4px; flex-shrink:0;">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                    <style>
                        @keyframes slideInPwa {
                            from { transform:translateY(100%); opacity:0; }
                            to { transform:translateY(0); opacity:1; }
                        }
                    </style>
                `;
                document.body.appendChild(pwaBanner);

                function dismissPwaBanner() {
                    localStorage.setItem('pwa_banner_dismissed', '1');
                    pwaBanner.remove();
                    showFloatingButtons();
                }

                document.getElementById('btnDismissPwa').onclick = dismissPwaBanner;

                document.getElementById('btnInstallApp').onclick = async () => {
                    var prompt = deferredPrompt || window.deferredInstallPrompt;
                    if (prompt) {
                        await prompt.prompt();
                        const { outcome } = await prompt.userChoice;
                        deferredPrompt = null;
                        window.deferredInstallPrompt = null;
                    } else {
                        var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                        if (isIOS) {
                            alert('Para instalar: toca el botón Compartir y luego "Agregar a pantalla de inicio"');
                        } else {
                            alert('Para instalar: abre el menú del navegador y selecciona "Instalar aplicación"');
                        }
                    }
                    dismissPwaBanner();
                };
            }, 2000);
        } else {
            showFloatingButtons();
        }

        // Acceso al panel admin: solo vía admin.html + clave
    

// =========================================


        const dashLinks = [
            // ── SUNARP ──
            {"Titulo": "Publicidad Registral (SPRL)", "Enlace": "https://sprl.sunarp.gob.pe/sprl/ingreso", "Icono": "img/Boton-SPRL.png", "cat": "SUNARP"},
            {"Titulo": "Inscripción Registral (SID)", "Enlace": "https://sidciudadano.sunarp.gob.pe/sid/sesion.htm", "Icono": "img/Boton-SID.png", "cat": "SUNARP"},
            {"Titulo": "Garantías Mobiliarias (SIGM)", "Enlace": "https://sigm.sunarp.gob.pe/garantias-mobiliarias/inicio", "Icono": "img/Boton-SIGM.png", "cat": "SUNARP"},
            {"Titulo": "Seguimiento de Expediente", "Enlace": "https://mire-ya.sunarp.gob.pe/mire-ya/#/private", "Icono": "img/mire-ya.png", "cat": "SUNARP"},
            {"Titulo": "Copia Literal al Toque", "Enlace": "https://copialiteral-altoque.sunarp.gob.pe/copialiteral-altoque/busqueda/busqueda-partida", "Icono": "img/copia-literal-al-toque.png", "cat": "SUNARP"},
            {"Titulo": "Orientador en Línea", "Enlace": "https://orientador.sunarp.gob.pe/orientador/inicio", "Icono": "img/orientador-sunarp.png", "cat": "SUNARP"},
            // ── MTC ──
            {"Titulo": "TUPA Digital", "Enlace": "https://tupadigital.mtc.gob.pe/", "Icono": "img/TUPADIGITAL0.png", "cat": "MTC"},
            {"Titulo": "Mesa de Partes Virtual", "Enlace": "https://mpv.mtc.gob.pe/", "Icono": "img/mesade.png", "cat": "MTC"},
            {"Titulo": "Casilla Electrónica", "Enlace": "https://casilla.mtc.gob.pe/", "Icono": "img/casillaelectronicaLogo.png", "cat": "MTC"},
            {"Titulo": "Gestión de Brevetes", "Enlace": "https://licencias-tramite.mtc.gob.pe/", "Icono": "img/XxBwuKBA_400x400.jpg", "cat": "MTC"},
            {"Titulo": "Brevete Electrónico", "Enlace": "https://licencias.mtc.gob.pe/", "Icono": "img/XxBwuKBA_400x400.jpg", "cat": "MTC"},
            {"Titulo": "Récord de Conductor", "Enlace": "https://recordconductor.mtc.gob.pe/", "Icono": "img/XxBwuKBA_400x400.jpg", "cat": "MTC"},
            {"Titulo": "Inspección Técnica Vehicular (CITV)", "Enlace": "https://rec.mtc.gob.pe/Citv/ArConsultaCitv", "Icono": "img/XxBwuKBA_400x400.jpg", "cat": "MTC"},
            {"Titulo": "Sistema de Puntos", "Enlace": "https://slcp.mtc.gob.pe/", "Icono": "img/XxBwuKBA_400x400.jpg", "cat": "MTC"},
            // ── SUNARP (continuación) ──
            {"Titulo": "Síguelo Plus", "Enlace": "https://sigueloplus.sunarp.gob.pe/siguelo/", "Icono": "img/title_card_login.png", "cat": "SUNARP"},
            {"Titulo": "Consulta Vehicular", "Enlace": "https://consultavehicular.sunarp.gob.pe/consulta-vehicular/", "Icono": "img/btn-consulta-vehicular.png", "cat": "SUNARP"},
            {"Titulo": "Historial de Propietarios y Gravamen", "Enlace": "https://sprl.sunarp.gob.pe/sprl/ingreso", "Icono": "img/Boton-SPRL.png", "cat": "SUNARP"},
            {"Titulo": "Copia Literal de Vehículo", "Enlace": "https://copialiteral-altoque.sunarp.gob.pe/copialiteral-altoque/busqueda/busqueda-partida", "Icono": "img/copia-literal-al-toque.png", "cat": "SUNARP"},
            {"Titulo": "Cámbiate a TIVE", "Enlace": "https://tivative.sunarp.gob.pe/tivative/inicio", "Icono": "img/btn-tivative.png", "cat": "SUNARP"},
            // ── SEGUROS ──
            {"Titulo": "Consulta SOAT", "Enlace": "https://www.apeseg.org.pe/consultas-soat/", "Icono": "img/image-7.png", "cat": "SEGUROS"},
            {"Titulo": "Reporte de Siniestralidad", "Enlace": "https://servicios.sbs.gob.pe/reportesoat/", "Icono": "img/SBS_logotipo.svg.png", "cat": "SEGUROS"},
            {"Titulo": "Lunas Oscurecidas (PNP)", "Enlace": "https://sistemas.policia.gob.pe/consultalunas/", "Icono": "img/Escudo_de_la_Policía_Nacional_del_Perú.png", "cat": "SEGUROS"},
            // ── MULTAS Y DEUDAS ──
            {"Titulo": "FotoPit Lima", "Enlace": "http://www.pit.gob.pe/pit2007/EstadoCuenta.aspx", "Icono": "img/FotopitClick.png", "cat": "MULTAS"},
            {"Titulo": "Identificación Vehicular (Placas.pe)", "Enlace": "https://www.placas.pe/#/home/registrar", "Icono": "img/SIIV-COLOR.png", "cat": "MULTAS"},
            {"Titulo": "Papeletas SUTRAN", "Enlace": "https://www.sutran.gob.pe/consultas/record-de-infracciones/record-de-infracciones/", "Icono": "img/logo_julio.png", "cat": "MULTAS"},
            {"Titulo": "Verifica tu Infracción SUTRAN", "Enlace": "https://www.sutran.gob.pe/consultas/record-de-infracciones/verifica-tu-infraccion/", "Icono": "img/logo_julio.png", "cat": "MULTAS"},
            {"Titulo": "Verificar Estado de Placa", "Enlace": "https://www.placas.pe/#/home/verificarEstadoPlaca", "Icono": "img/SOLO-LOGO-AAP-AJUSTADO.png", "cat": "MULTAS"},
            {"Titulo": "Consulta Multas ATU", "Enlace": "https://pasarela.atu.gob.pe/", "Icono": "img/Logo_ATU.png", "cat": "MULTAS"},
            {"Titulo": "Consulta Deuda GNV", "Enlace": "https://infogas.com.pe/consulta-placa/", "Icono": "img/Infogas-Logo.png", "cat": "MULTAS"},
            {"Titulo": "Multas Electorales (JNE)", "Enlace": "https://multas.jne.gob.pe/login", "Icono": "img/Logo_JNE_2023-13.svg", "cat": "MULTAS"},
            {"Titulo": "Pagalo.pe", "Enlace": "https://pagalo.pe/", "Icono": "img/pagalo.png", "cat": "MULTAS"},
            {"Titulo": "Geocatmin", "Enlace": "https://geocatmin.ingemmet.gob.pe/geocatmin/", "Icono": "img/Logo_Geocatmin.png", "cat": "MULTAS"},
            // ── SERVICIOS PREMIUM (vía WhatsApp) ──
            {"Titulo": "Boleta Informativa", "Enlace": "https://wa.me/51932465820?text=Hola%20Soporte.%20Requiero%20la%20*Boleta%20Informativa%20Vehicular*.", "Icono": "img/logo-sunarp0.png", "cat": "SEGUROS"},
            {"Titulo": "Reporte Crediticio", "Enlace": "https://wa.me/51932465820?text=Hola%20Soporte.%20Necesito%20mi%20*Reporte%20Crediticio*.", "Icono": "img/Experian-BM-TM-RGB.png", "cat": "SEGUROS"},
            {"Titulo": "Reporte Migratorio", "Enlace": "https://wa.me/51932465820?text=Hola%20Soporte.%20Solicito%20un%20*Reporte%20Migratorio*.", "Icono": "img/Migraciones_Perú.jpg", "cat": "SEGUROS"},
            {"Titulo": "Reconocimiento Facial", "Enlace": "https://wa.me/51932465820?text=Hola%20Soporte.%20Me%20interesa%20*Reconocimiento%20Facial*.", "Icono": "img/Logotipo RENIEC.png", "cat": "SEGUROS"},
            {"Titulo": "Casos Fiscales", "Enlace": "https://wa.me/51932465820?text=Hola%20Soporte.%20Requiero%20consultar%20*Casos%20Fiscales*.", "Icono": "img/Logo_Ministerio_Público_Perú.png", "cat": "SEGUROS"},
            {"Titulo": "MINEDU Online", "Enlace": "https://wa.me/51932465820?text=Hola%20Soporte.%20Necesito%20información%20de%20*MINEDU%20ONLINE*.", "Icono": "img/Logo_del_Ministerio_de_Educación_del_Perú_-_MINEDU.png", "cat": "SEGUROS"},
            {"Titulo": "SUNEDU Grados y Títulos", "Enlace": "https://wa.me/51932465820?text=Hola%20Soporte.%20Deseo%20buscar%20*Grados%20y%20Títulos%20(SUNEDU)*.", "Icono": "img/SUNEDU.svg.png", "cat": "SEGUROS"},
            // ── MULTAS POR REGIONES ──
            {"Titulo": "Lima", "Enlace": "https://www.sat.gob.pe/WebSiteV9/TributosMultas/Papeletas/ConsultasPapeletas", "Icono": "img/Logo_Lima.png", "cat": "REGIONES"},
            {"Titulo": "Callao", "Enlace": "https://pagopapeletascallao.pe/", "Icono": "img/Logo_Callao.png", "cat": "REGIONES"},
            {"Titulo": "Arequipa", "Enlace": "https://www.muniarequipa.gob.pe/oficina-virtual/c0nInfrPermisos/faltas/papeletas.php", "Icono": "img/Logo_Arequipa.png", "cat": "REGIONES"},
            {"Titulo": "Trujillo", "Enlace": "https://www.satt.gob.pe/servicios/record-de-infracciones", "Icono": "img/Logo_LaLibertad.svg", "cat": "REGIONES"},
            {"Titulo": "Piura", "Enlace": "http://www.munipiura.gob.pe/consulta-de-multas-administrativas#buscar-por-placa", "Icono": "img/Logo_Piura.png", "cat": "REGIONES"},
            {"Titulo": "Cusco", "Enlace": "https://cusco.gob.pe/informatica/infracciones", "Icono": "img/Logo_Cusco.png", "cat": "REGIONES"},
            {"Titulo": "Chiclayo", "Enlace": "https://virtualsatch.satch.gob.pe/virtualsatch/record_infracciones/buscar_placa_", "Icono": "img/Logo_Chiclayo.png", "cat": "REGIONES"},
            {"Titulo": "Huancayo", "Enlace": "https://www.sath.gob.pe/tributos.html#multas-administrativas", "Icono": "img/Logo_Huancayo.png", "cat": "REGIONES"},
            {"Titulo": "Puno", "Enlace": "https://papeletas.munipuno.gob.pe/", "Icono": "img/Logo_Puno.png", "cat": "REGIONES"},
            {"Titulo": "Cajamarca", "Enlace": "https://www.satcajamarca.gob.pe/consultas", "Icono": "img/Logo_Cajamarca.png", "cat": "REGIONES"},
            {"Titulo": "Ica", "Enlace": "https://m.satica.gob.pe/consultapapeletas_web.php", "Icono": "img/Logo_Ica.png", "cat": "REGIONES"},
            {"Titulo": "Huánuco", "Enlace": "https://www.munihuanuco.gob.pe/gt_consultapapeletas_placa.php", "Icono": "img/Logo_Huanuco.png", "cat": "REGIONES"},
            {"Titulo": "Tacna", "Enlace": "https://www.munitacna.gob.pe/pagina/sf/servicios/papeletas", "Icono": "img/Logo_Tacna.png", "cat": "REGIONES"},
            {"Titulo": "Chachapoyas", "Enlace": "https://app.munichachapoyas.gob.pe/servicios/consulta_papeletas/app/papeletas.php", "Icono": "img/Logo_Amazonas.png", "cat": "REGIONES"},
            {"Titulo": "Tarapoto", "Enlace": "https://www.sat-t.gob.pe/#consulta-papeletas", "Icono": "img/Logo_SanMartin.png", "cat": "REGIONES"},
            {"Titulo": "Coronel Portillo", "Enlace": "http://consultas.municportillo.gob.pe:85/consultaVehiculo/consulta/", "Icono": "img/Logo_Ucayali.jpg", "cat": "REGIONES"},
            {"Titulo": "Huarmey", "Enlace": "https://munihuarmey.gob.pe/consultar-papeletas/", "Icono": "img/Logo_Huarmey.png", "cat": "REGIONES"},
            // ── SERVICIOS GRATUITOS (25) ──
            {"Titulo": "SERVICIO DE LECTURA MULTILINGÜE", "Enlace": "https://sigueloplus.sunarp.gob.pe/siguelo/", "Icono": "img/btn-slm.png", "cat": "GRATUITOS"},
            {"Titulo": "ALERTA GARANTÍA MOBILIARIA VEHICULAR", "Enlace": "https://alertaregistral.sunarp.gob.pe/alerta/Inicio", "Icono": "img/btn-alerta-garantia.png", "cat": "GRATUITOS"},
            {"Titulo": "Alerta Clonación", "Enlace": "https://alertaregistral.sunarp.gob.pe/alerta/Inicio", "Icono": "img/btn-alerta-clonacion.png", "cat": "GRATUITOS"},
            {"Titulo": "Base Gráfica Registral", "Enlace": "https://visor-bgr.sunarp.gob.pe/visor-bgr/inicio", "Icono": "img/btn-BGR.png", "cat": "GRATUITOS"},
            {"Titulo": "Tivative", "Enlace": "https://tivative.sunarp.gob.pe/tivative/inicio", "Icono": "img/btn-tivative.png", "cat": "GRATUITOS"},
            {"Titulo": "Tarjeta de Identificación Vehicular Electrónica", "Enlace": "https://www.sunarp.gob.pe/serviciosenlinea/portal/tarjeta-de-identificacion-vehicular-electronica-tive.html", "Icono": "img/Btn-TIVE.png", "cat": "GRATUITOS"},
            {"Titulo": "CONOCE AQUÍ", "Enlace": "https://conoce-aqui.sunarp.gob.pe/conoce-aqui/inicio", "Icono": "img/btn-ConoceAqui.png", "cat": "GRATUITOS"},
            {"Titulo": "ALERTA ROBO", "Enlace": "https://alertarobo.sunarp.gob.pe/alerta-robo/inicio", "Icono": "img/btn-alerta-robo.png", "cat": "GRATUITOS"},
            {"Titulo": "SÍGUELO PLUS", "Enlace": "https://sigueloplus.sunarp.gob.pe/siguelo/", "Icono": "img/btn-siguelo.png", "cat": "GRATUITOS"},
            {"Titulo": "ALERTA REGISTRAL", "Enlace": "https://alertaregistral.sunarp.gob.pe/alerta/Inicio", "Icono": "img/btn-alerta-registral.png", "cat": "GRATUITOS"},
            {"Titulo": "CONSULTA VEHICULAR", "Enlace": "https://consultavehicular.sunarp.gob.pe/consulta-vehicular/inicio", "Icono": "img/btn-consulta-vehicular.png", "cat": "GRATUITOS"},
            {"Titulo": "CONSULTA DE PROPIEDAD", "Enlace": "https://www2.sunarp.gob.pe/consulta-propiedad/inicio", "Icono": "img/btn-consulta-propiedad.png", "cat": "GRATUITOS"},
            {"Titulo": "PUBLICIDAD Y VERIFICACIÓN", "Enlace": "https://enlinea.sunarp.gob.pe/sunarpweb/pages/acceso/frmTitulos.faces", "Icono": "img/btn-consulta-publicidad.png", "cat": "GRATUITOS"},
            {"Titulo": "DIRECTORIO DE PERSONAS JURÍDICAS", "Enlace": "https://www.sunarp.gob.pe/dn-personas-juridicas.asp", "Icono": "img/btn-directorio-nacional-pjuridicas.png", "cat": "GRATUITOS"},
            {"Titulo": "CONSULTA DE VERIFICADORES", "Enlace": "https://www.sunarp.gob.pe/serviciosenlinea/portal/consulta-de-verificadores.html", "Icono": "img/btn-consulta-verificadores.png", "cat": "GRATUITOS"},
            {"Titulo": "VERIFICAR DOCUMENTOS MÓDULO SACS", "Enlace": "https://sid.sunarp.gob.pe/sid/validaDocusacs.htm", "Icono": "img/mod-verconsulta-sacs.png", "cat": "GRATUITOS"},
            {"Titulo": "SISTEMA INTEGRADO DE PRECEDENTES", "Enlace": "https://scr.sunarp.gob.pe/sip/", "Icono": "img/btn-sip-sunarp.png", "cat": "GRATUITOS"},
            {"Titulo": "SISTEMA INTEGRADO DE NORMATIVA", "Enlace": "https://scr.sunarp.gob.pe/sinr/", "Icono": "img/btn-sinr-sunarp.png", "cat": "GRATUITOS"},
            {"Titulo": "BIBLIOTECA REGISTRAL DIGITAL", "Enlace": "https://biblioteca.sunarp.gob.pe/", "Icono": "img/btn-biblioteca-registral-digital.png", "cat": "GRATUITOS"},
            {"Titulo": "PLAZOS PREFERENTES", "Enlace": "https://scr.sunarp.gob.pe/plazos-preferentes/", "Icono": "img/btn-plazos-preferentes.png", "cat": "GRATUITOS"},
            {"Titulo": "COMPRAS MENORES A 8 UITS", "Enlace": "https://8uit.sunarp.gob.pe/portal", "Icono": "img/btn-8UITs.png", "cat": "GRATUITOS"},
            {"Titulo": "CASILLA ELECTRÓNICA", "Enlace": "https://casilla.sunarp.gob.pe/casillaelectronica/", "Icono": "img/casilla-electronica.png", "cat": "GRATUITOS"},
            {"Titulo": "MESA DE TRÁMITE VIRTUAL", "Enlace": "https://mesadetramite.sunarp.gob.pe/mtdv-ui/", "Icono": "img/btn-MTDV.png", "cat": "GRATUITOS"},
            {"Titulo": "PLATAFORMA INSTITUCIONAL", "Enlace": "https://psi.sunarp.gob.pe/ProyOrganizaSII/login.jsf", "Icono": "img/bnt-psi.png", "cat": "GRATUITOS"},
            {"Titulo": "MUNICIPALIDADES Y GOBIERNOS REGIONALES", "Enlace": "https://www.sunarp.gob.pe/serviciosenlinea/portal/consulta-registral-para-municipalidades-y-gobiernos-regionales.html", "Icono": "img/btn-consulta-muni-gr.png", "cat": "GRATUITOS"}
        ];

        let currentDashTab = 'all';
        let dashViewMode = 'categories'; // 'categories' o 'links'

        function setDashTab(cat, btn) {
            currentDashTab = cat;
            document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
            if(btn) btn.classList.add('active');
            renderDashGrid();
        }

        function toggleDashboard() {
            // Ahora simplemente cambia a la pestaña Dashboard
            switchServicesTab('dashboard');
        }

        function abrirDashboardDirecto() {
            // Cambiar a la pestaña Dashboard
            switchServicesTab('dashboard');
        }

        async function verificarAccesoDashboard() {
            let creditos = 0;
            try {
                if (window.sb) {
                    const { data } = await window.sb
                        .from('saldos')
                        .select('creditos')
                        .eq('email', currentUser.email)
                        .single();
                    if (data) creditos = data.creditos;
                }
            } catch(e) {}

            const soles = creditos.toFixed(2);

            if (creditos >= 35) {
                // Tiene suficiente → ofrecer activar
                showDashModal('activate', soles);
            } else {
                // No tiene suficiente → pedir recarga
                const faltante = (35 - creditos).toFixed(2);
                showDashModal('insufficient', soles, faltante);
            }
        }

        async function activarDashboard() {
            try {
                // 1. Obtener créditos actuales
                const { data: saldoData } = await window.sb
                    .from('saldos')
                    .select('creditos')
                    .eq('email', currentUser.email)
                    .single();

                if (!saldoData || saldoData.creditos < 35) {
                    alert('Error: saldo insuficiente.');
                    return;
                }

                // 2. Descontar 7 créditos y activar dashboard
                const { error } = await window.sb
                    .from('saldos')
                    .update({ 
                        creditos: saldoData.creditos - 35, 
                        dashboard_activo: true 
                    })
                    .eq('email', currentUser.email);

                if (error) throw error;

                // 3. Actualizar estado local
                window.dashboardActivo = true;

                // 4. Cerrar modal y abrir dashboard
                document.getElementById('infoModal').style.display = 'none';
                abrirDashboardDirecto();

                // 5. Actualizar header (saldo visual)
                if (typeof renderLoggedInState === 'function') renderLoggedInState();

            } catch(e) {
                console.error('Error activando dashboard:', e);
                alert('Ocurrió un error. Intenta nuevamente.');
            }
        }

        function showDashModal(type, soles, faltante) {
            const infoModal = document.getElementById('infoModal');
            const infoContent = document.getElementById('infoContent');
            if (!infoModal || !infoContent) return;

            let html = '';

            if (type === 'login') {
                showAccessRestrictedModal();
                return;
            } else if (type === 'activate') {
                html = `
                    <div style="text-align:center; padding: 10px;">
                        <div style="width: 60px; height: 60px; background: rgba(3,167,164,0.1); color: #03a7a4; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 28px; border: 1px solid rgba(3,167,164,0.2);">
                            <i class="fa-solid fa-rocket"></i>
                        </div>
                        <h3 style="font-size: 20px; font-weight: 900; color: #111b21; margin-bottom: 10px;">Activa tu Dashboard</h3>
                        <p style="font-size: 14px; color: #64748b; margin-bottom: 15px; line-height: 1.5;">Accede a <strong>81+ servicios gubernamentales</strong> organizados por categorías. Acceso <strong>de por vida</strong>.</p>
                        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 12px; margin-bottom: 15px;">
                            <div style="font-size: 24px; font-weight: 900; color: #111b21;">S/ 35.00</div>
                            <div style="font-size: 11px; color: #64748b;">Pago único · Acceso permanente</div>
                        </div>
                        <div style="font-size: 12px; color: #64748b; margin-bottom: 20px;">Tu saldo actual: <strong style="color: #10b981;">S/ ${soles}</strong></div>
                        <button onclick="activarDashboard()" style="background:#25d366; color:#fff; border:none; padding:12px 25px; border-radius:10px; font-weight:bold; cursor:pointer; width:100%; font-size: 14px;">ACTIVAR POR S/ 35.00</button>
                        <button onclick="document.getElementById('infoModal').style.display='none';" style="background: none; border: none; color: #94a3b8; margin-top: 10px; cursor: pointer; font-size: 13px;">Cancelar</button>
                    </div>`;
            } else if (type === 'insufficient') {
                html = `
                    <div style="text-align:center; padding: 15px 10px;">
                        <!-- Icono Institucional Sólido -->
                        <div style="width: 65px; height: 65px; background: #111b21; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 24px;">
                            <i class="fa-solid fa-lock"></i>
                        </div>

                        <h3 style="font-size: 20px; font-weight: 900; color: #111b21; margin-bottom: 8px;">Acceso Bloqueado</h3>
                        <p style="font-size: 13px; color: #64748b; margin-bottom: 25px; line-height: 1.4; padding: 0 15px;">Se requiere activar el acceso de por vida para visualizar el Dashboard.</p>
                        
                        <!-- Tarjetas de Saldo Sólidas -->
                        <div style="display: flex; gap: 12px; margin-bottom: 25px;">
                            <div style="flex: 1; background: #fff; border: 2px solid #111b21; border-radius: 10px; padding: 12px; text-align: left;">
                                <div style="font-size: 11px; font-weight: 800; color: #111b21; text-transform: uppercase;">Tu Saldo</div>
                                <div style="font-size: 18px; font-weight: 900; color: #ef4444; margin-top: 4px;">S/ ${soles}</div>
                            </div>
                            <div style="flex: 1; background: #fff; border: 2px solid #111b21; border-radius: 10px; padding: 12px; text-align: left;">
                                <div style="font-size: 11px; font-weight: 800; color: #111b21; text-transform: uppercase;">Costo Único</div>
                                <div style="font-size: 18px; font-weight: 900; color: #111b21; margin-top: 4px;">S/ 35.00</div>
                            </div>
                        </div>

                        <!-- Botón Principal Sólido -->
                        <button onclick="document.getElementById('infoModal').style.display='none'; openSale('35.00', 'Acceso Dashboard Permanente', 0, 'dashboard')" style="background: #25d366; color:#fff; border:none; padding:15px; border-radius: 10px; font-weight:900; cursor:pointer; width:100%; font-size: 14px; margin-bottom:12px; text-transform: uppercase;">
                            <i class="fa-solid fa-credit-card" style="margin-right: 8px;"></i> PAGAR AHORA
                        </button>

                        <button onclick="document.getElementById('infoModal').style.display='none';" style="background: none; border: none; color: #94a3b8; margin-top: 5px; cursor: pointer; font-size: 13px; font-weight: bold;">Cancelar y volver</button>
                    </div>`;
            }

            infoContent.innerHTML = html;
            infoModal.style.display = 'flex';
        }

        function previewDashVaucher() {}
        function enviarSolicitudDashboard() {}

        function filterDash() {
            renderDashGrid();
        }

        // Función para abrir enlaces del dashboard con verificación premium
        function abrirDashLink(url) {
            if (!currentUser) { showAuthFloatingModal(); return; }
            if (!window.plataformaActiva) { showUpgradeModal(); return; }
            window.open(url, '_blank');
        }

        function renderDashGrid() {
            const grid = document.getElementById('dashGrid');
            const tabs = document.getElementById('dashTabs');
            const search = document.getElementById('dashSearch').value.toLowerCase();
            
            if (tabs) tabs.style.display = 'none'; // Desactivamos tabs superiores para evitar saturación visual

            const cats = [
                { id: 'SUNARP', title: 'SUNARP', icon: 'fa-building-columns', desc: 'REGISTROS PÚBLICOS, CONSULTAS Y TRÁMITES' },
                { id: 'MTC', title: 'MTC', icon: 'fa-road', desc: 'BREVETES, CITV, RÉCORD Y TRÁMITES' },
                { id: 'MULTAS', title: 'MULTAS Y DEUDAS', icon: 'fa-file-invoice-dollar', desc: 'PAPELETAS, SAT, SUTRAN Y ATU' },
                { id: 'REGIONES', title: 'INFRACCIONES POR REGIONES', icon: 'fa-map-location-dot', desc: 'PAPELETAS E INFRACCIONES POR DEPARTAMENTO' },
                { id: 'SEGUROS', title: 'SEGUROS Y REPORTES', icon: 'fa-shield-halved', desc: 'SOAT, SINIESTRALIDAD Y SERVICIOS PREMIUM' },
                { id: 'GRATUITOS', title: 'GRATUITOS', icon: 'fa-gift', desc: 'SERVICIOS SIN COSTO DE SUNARP' }
            ];

            if (dashViewMode === 'categories') {
                const filteredCats = cats.filter(c =>
                    c.title.toLowerCase().includes(search) ||
                    c.desc.toLowerCase().includes(search)
                );

                grid.innerHTML = filteredCats.map((c, i) => `
                    <div class="hook-card" style="cursor:pointer;" onclick="dashViewMode = 'links'; currentDashTab = '${c.id}'; renderDashGrid();">
                        <div class="hook-icon"><i class="fa-solid ${esc(c.icon)}"></i></div>
                        <div style="flex: 1; min-width: 0;">
                            <div class="hook-text" style="margin-bottom: 2px;">${esc(c.title)}</div>
                            <div style="font-size: 10px; font-weight: 500; color: #94a3b8; font-family: 'Roboto', sans-serif; line-height: 1.3; text-transform: uppercase; letter-spacing: 0.2px;">${esc(c.desc)}</div>
                        </div>
                        <div style="color: #94a3b8; font-size: 14px; flex-shrink: 0;"><i class="fa-solid fa-chevron-right"></i></div>
                    </div>
                `).join('');
                return;
            }

            // MODO LINKS
            const filtered = dashLinks.filter(item => {
                const matchsSearch = item.Titulo.toLowerCase().includes(search);
                const matchsTab = (currentDashTab === 'all' || item.cat === currentDashTab);
                return matchsSearch && matchsTab;
            });

            const currentCatTitle = cats.find(c => c.id === currentDashTab)?.title || 'Accesos';

            grid.innerHTML = `
                <div style="grid-column: 1 / -1; background:#111b21; border-radius:12px; padding:16px 18px; margin-bottom:8px; display:flex; align-items:center; gap:12px;">
                    <button onclick="dashViewMode = 'categories'; renderDashGrid();" style="border:none; background:#25d366; color:#fff; width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; font-size:12px;">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <div>
                        <div style="font-size:9px; font-weight:500; color:#8696a0; text-transform:uppercase; letter-spacing:0.5px;">Dashboard</div>
                        <div style="font-size:14px; font-weight:600; color:#e9edef; text-transform:uppercase; letter-spacing:0.2px;">${esc(currentCatTitle)}</div>
                    </div>
                </div>
            ` + filtered.map((item, i) => `
                <div class="hook-card" style="cursor:pointer;" onclick="abrirDashLink('${escAttr(item.Enlace)}')">
                    <div style="width:38px; height:38px; min-width:38px; border-radius:8px; background:#ffffff; border:1px solid #e5e7eb; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                        <img src="${escAttr(item.Icono)}" alt="${escAttr(item.Titulo)}" loading="lazy" onerror="this.src='assets/media/logopwa.png'" style="width:26px; height:26px; object-fit:contain;">
                    </div>
                    <div style="flex:1; min-width:0;">
                        <div style="font-size:11px; font-weight:600; color:#111b21; text-transform:uppercase; letter-spacing:0.1px; line-height:1.3;">${esc(item.Titulo)}</div>
                        <div style="font-size:9px; font-weight:400; color:#6b7280; margin-top:2px;">${item.cat === 'SUNARP' ? 'SUNARP' : item.cat === 'MTC' ? 'MTC' : item.cat === 'MULTAS' ? 'Multas y Deudas' : item.cat === 'SEGUROS' ? 'Seguros y Reportes' : item.cat === 'GRATUITOS' ? 'Servicio Gratuito' : item.cat === 'REGIONES' ? 'Multas por Región' : 'General'}</div>
                    </div>
                    <div style="color:#25d366; font-size:12px; flex-shrink:0;"><i class="fa-solid fa-arrow-up-right-from-square"></i></div>
                </div>
            `).join('');
        }
    

// =========================================


    (function() {
        function closeWelcome() {
            localStorage.setItem('welcome_shown', '1');
            var m = document.getElementById('welcomeModal');
            if (m) m.style.display = 'none';
        }
        window.closeWelcome = closeWelcome;

        // Welcome modal desactivado (modo premium)
        window._showWelcome = function() {};

        document.addEventListener('DOMContentLoaded', function() {
            var lastSeen = localStorage.getItem('flyer_soat_seen');
            var oneDayMs = 86400000;
            var showFlyer = !lastSeen || (Date.now() - parseInt(lastSeen)) > oneDayMs;

            if (showFlyer) {
                setTimeout(function() {
                    var f = document.getElementById('flyerModal');
                    if (f) f.style.display = 'flex';
                    localStorage.setItem('flyer_soat_seen', Date.now().toString());
                }, 2000);
            }
        });
    })();
    

// =========================================


        // Función para manejar el clic en el botón de recarga
        function handleWalletClick() {
            // Verificar si el usuario está logueado
            if (typeof currentUser === 'undefined' || !currentUser) {
                // No está logueado, abrir modal de login
                if (typeof openAuthModal === 'function') {
                    openAuthModal();
                }
            } else {
                // Está logueado, abrir modal de acceso/recarga
                if (typeof openAccess === 'function') {
                    openAccess();
                }
            }
        }

        function openInformeModal() {
            const modal = document.getElementById('informeModal');
            if (modal) {
                document.getElementById('informePlateInput').value = '';
                modal.style.display = 'flex';
                setTimeout(() => document.getElementById('informePlateInput').focus(), 100);
            }
        }

        async function submitInformeRequest() {
            const input = document.getElementById('informePlateInput');
            const p = normalize(input ? input.value : '');

            if (!p || p.length < 5) {
                alert('Por favor, ingresa una placa válida (mínimo 5 caracteres).');
                return;
            }

            // Guardar placa temporalmente
            window._pendingInformePlate = p;

            // Verificar cuenta
            if (!currentUser) {
                document.getElementById('informeModal').style.display = 'none';
                showAuthFloatingModal();
                return;
            }

            // Verificar acceso S/35
            if (!window.plataformaActiva) {
                document.getElementById('informeModal').style.display = 'none';
                showUpgradeModal();
                return;
            }

            document.getElementById('informeModal').style.display = 'none';

            // 1. Ya fue aprobado anteriormente
            if (localStorage.getItem('approved_request_' + p)) {
                localStorage.removeItem('last_pending_plate');
                localStorage.removeItem('has_pending_notification');
                window.location.href = 'reporte.html?placa=' + p + '&approved=true';
                return;
            }

            // 2. Ya está en espera
            if (localStorage.getItem('pending_request_' + p)) {
                localStorage.setItem('last_pending_plate', p);
                checkPendingFlow();
                return;
            }

            // 3. Verificar créditos/pago PRIMERO, luego crear solicitud
            // startSmartScan creará la solicitud solo si el pago se confirma
            localStorage.setItem('last_pending_plate', p);
            startSmartScan(p);
        }

        let customAlertCallback = null;

        function showCustomAlert(title, message, callback) {
            const modal = document.getElementById('customAlertModal');
            const titleEl = document.getElementById('customAlertTitle');
            const messageEl = document.getElementById('customAlertMessage');
            
            if (modal && titleEl && messageEl) {
                titleEl.textContent = title;
                messageEl.textContent = message;
                customAlertCallback = callback || null;
                modal.style.display = 'flex';
            }
        }

        function closeCustomAlert() {
            document.getElementById('customAlertModal').style.display = 'none';
            if (customAlertCallback && typeof customAlertCallback === 'function') {
                customAlertCallback();
                customAlertCallback = null;
            }
        }

        function showSolicitudConfirmation(placa) {
            const modal = document.getElementById('solicitudConfirmModal');
            const placaDisplay = document.getElementById('solicitudPlacaDisplay');
            
            if (modal && placaDisplay) {
                placaDisplay.textContent = placa.toUpperCase();
                modal.style.display = 'flex';
                
                localStorage.setItem('has_pending_notification', 'true');
            }
        }

        function closeSolicitudConfirm() {
            const modal = document.getElementById('solicitudConfirmModal');
            if (modal) modal.style.display = 'none';
        }

        function showPendingNotificationBadge() {
            // Guardar estado de notificación pendiente
            localStorage.setItem('has_pending_notification', 'true');
            
            const badge = document.getElementById('notificationBadge');
            if (badge) {
                badge.textContent = '!';
                badge.style.display = 'flex';
            }
            
            // Agregar efecto de parpadeo al enlace "Mis Consultas"
            const misConsultasLink = document.getElementById('misConsultasLink');
            if (misConsultasLink) {
                misConsultasLink.style.animation = 'pulse 2s infinite';
                misConsultasLink.style.background = 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)';
                misConsultasLink.style.fontWeight = '700';
            }
        }
        
        // Limpiar badge de notificación
        function clearNotificationBadge() {
            localStorage.removeItem('has_pending_notification');
            const badge = document.getElementById('notificationBadge');
            if (badge) badge.style.display = 'none';
            const misConsultasLink = document.getElementById('misConsultasLink');
            if (misConsultasLink) {
                misConsultasLink.style.animation = '';
                misConsultasLink.style.background = '';
                misConsultasLink.style.fontWeight = '';
            }
        }

        // Aplicar o limpiar notificación al cargar la página - verificar contra la nube
        window.addEventListener('load', function() {
            if (localStorage.getItem('has_pending_notification') !== 'true') return;

            // Paso 1: Si no hay placa pendiente local, el badge es obsoleto
            const pendingPlate = localStorage.getItem('last_pending_plate');
            if (!pendingPlate) {
                clearNotificationBadge();
                return;
            }

            // Paso 2: Verificar en Supabase si realmente existe la solicitud pendiente
            // Usar delay mayor (3s) para asegurar que Supabase esté inicializado
            setTimeout(async () => {
                if (window.sb) {
                    try {
                        const { data } = await window.sb
                            .from('solicitudes')
                            .select('placa, datos')
                            .limit(100);
                        
                        // Buscar si hay alguna solicitud pendiente (no aprobada) en la nube
                        const hasPending = data && data.some(row => {
                            const d = row.datos;
                            if (!d) return false;
                            return String(d.status || '').toLowerCase() !== 'approved';
                        });

                        if (!hasPending) {
                            // No hay pendientes reales en la nube - limpiar todo
                            clearNotificationBadge();
                            localStorage.removeItem('last_pending_plate');
                            return;
                        }
                    } catch (e) {
                        console.error('Error verificando notificaciones:', e);
                    }
                }

                // Solo mostrar badge si la nube confirma que hay pendientes
                const badge = document.getElementById('notificationBadge');
                if (badge) {
                    badge.textContent = '!';
                    badge.style.display = 'flex';
                }
                
                const misConsultasLink = document.getElementById('misConsultasLink');
                if (misConsultasLink) {
                    misConsultasLink.style.animation = 'pulse 2s infinite';
                    misConsultasLink.style.background = 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)';
                    misConsultasLink.style.fontWeight = '700';
                }
            }, 3000);
        });

        function openWAPlateModal() {
            const modal = document.getElementById('waPlateModal');
            if (modal) {
                document.getElementById('waPlateInput').value = '';
                modal.style.display = 'flex';
                setTimeout(() => document.getElementById('waPlateInput').focus(), 100);
            }
        }

        function enviarWAPlaca() {
            const placa = document.getElementById('waPlateInput').value.trim();
            if (!placa || placa.length < 5) {
                alert('Por favor, ingresa una placa válida.');
                return;
            }
            const h = new Date().getHours();
            const saludo = h < 12 ? 'Buenos días' : h < 18 ? 'Buenas tardes' : 'Buenas noches';
            const msg = `${saludo}, solicito información del vehículo con placa *${placa}*. Quedo atento a su respuesta. Gracias.`;
            window.open('https://wa.me/51932465820?text=' + encodeURIComponent(msg), '_blank');
            document.getElementById('waPlateModal').style.display = 'none';
        }

        // Siempre regresar arriba al refrescar
        window.addEventListener('beforeunload', function() {
            window.scrollTo(0, 0);
        });
        
        // También regresar arriba cuando carga la página
        window.addEventListener('load', function() {
            window.scrollTo(0, 0);
            
            // Restaurar estado de navegación al cargar
            const hash = window.location.hash.replace('#', '');
            if (hash === 'categories' || hash === 'dashboard') {
                navigationStack = ['home', 'tab-' + hash];
                if (currentUser) {
                    switchServicesTab(hash, false);
                }
            } else {
                // Establecer estado inicial
                history.replaceState({ view: 'home' }, '', '');
            }
        });

        // --- INTERCEPTOR DEL BOTÓN "ATRÁS" ---
        window.addEventListener('popstate', (event) => {
            // Cerrar modales abiertos primero
            const modals = ['infoModal', 'modalSale', 'customAlertModal'];
            let modalClosed = false;
            modals.forEach(id => {
                const m = document.getElementById(id);
                if (m && (m.style.display === 'flex' || m.style.display === 'block')) {
                    m.style.display = 'none';
                    modalClosed = true;
                }
            });
            if (modalClosed) {
                // Si cerramos un modal, no navegar más
                if (navigationStack.length > 1) navigationStack.pop();
                return;
            }

            if (navigationStack.length > 1) {
                navigationStack.pop(); // Quitar vista actual
                const previousView = navigationStack[navigationStack.length - 1];
                
                if (previousView === 'home') {
                    // Restaurar vista predeterminada: categorías activa
                    document.querySelectorAll('.services-tab-content').forEach(content => {
                        content.classList.remove('active');
                        content.removeAttribute('style'); // Limpiar estilos inline residuales
                    });
                    document.querySelectorAll('.services-tab').forEach(tab => tab.classList.remove('active'));
                    
                    // Activar pestaña categorías por defecto
                    const catTab = document.querySelector('[data-tab="categories"]');
                    const catContent = document.getElementById('tab-categories');
                    if (catTab) catTab.classList.add('active');
                    if (catContent) {
                        catContent.classList.add('active');
                        catContent.removeAttribute('style');
                    }
                    
                    // Scroll al inicio
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                } else if (previousView.startsWith('tab-')) {
                    const tabName = previousView.replace('tab-', '');
                    switchServicesTab(tabName, false);
                }
            } else {
            }
        });
