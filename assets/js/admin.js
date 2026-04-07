function esc(s) { var d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }
        function escAttr(s) { return esc(s).replace(/'/g, '&#39;').replace(/"/g, '&quot;'); }

        /**
         * Renderiza HTML rico (con <b>, <i>, <br>) en jsPDF preservando negritas.
         * Retorna la posición Y final después de renderizar.
         */
        function renderRichTextPDF(pdf, html, x, startY, maxWidth, fontSize, pageHeight, margin) {
            fontSize = fontSize || 9.5;
            pageHeight = pageHeight || pdf.internal.pageSize.getHeight();
            margin = margin || 18;

            // Limpiar entidades y caracteres especiales
            var text = String(html || '')
                .replace(/&nbsp;/gi, ' ')
                .replace(/&amp;/gi, '&')
                .replace(/&lt;/gi, '<')
                .replace(/&gt;/gi, '>')
                .replace(/["\u201C\u201D]/g, '"')
                .replace(/['\u2018\u2019]/g, "'")
                .replace(/[\u2013\u2014]/g, '-');

            // Convertir <br> a saltos de línea, <li> a bullets
            text = text.replace(/<br\s*\/?>/gi, '\n');
            text = text.replace(/<li[^>]*>/gi, '\n\u2022 ').replace(/<\/li>/gi, '');
            // Reemplazar tags de bloque por saltos de línea
            text = text.replace(/<\/?(ul|ol|p|div|blockquote|code|strike|s|span|h[1-6]|pre|section|article|header|footer|nav|main|aside|figure|figcaption|table|tr|td|th|thead|tbody)[^>]*>/gi, '\n');

            // Convertir <em> a <i> para que el parser lo reconozca
            text = text.replace(/<em[^>]*>/gi, '<i>').replace(/<\/em>/gi, '</i>');

            // Limpiar cualquier tag HTML restante que no sea <b>, <strong>, <i>
            text = text.replace(/<(?!\/?(?:b|strong|i)\b)[^>]+>/gi, '');

            // Parsear segmentos bold/normal
            // Dividir por tags <b>, </b>, <strong>, </strong>, <i>, </i>
            var segments = [];
            var re = /<(\/?)(?:b|strong|i)(?:\s[^>]*)?>/gi;
            var lastIdx = 0;
            var bold = false;
            var italic = false;
            var match;

            while ((match = re.exec(text)) !== null) {
                // Texto antes del tag
                if (match.index > lastIdx) {
                    var chunk = text.substring(lastIdx, match.index).replace(/<[^>]*>/g, '');
                    if (chunk) segments.push({ text: chunk, bold: bold, italic: italic });
                }
                var tag = match[0].toLowerCase();
                var isClose = match[1] === '/';
                if (tag.includes('b') || tag.includes('strong')) {
                    bold = !isClose;
                } else if (tag.includes('i')) {
                    italic = !isClose;
                }
                lastIdx = match.index + match[0].length;
            }
            // Resto del texto
            var rest = text.substring(lastIdx).replace(/<[^>]*>/g, '');
            if (rest) segments.push({ text: rest, bold: bold, italic: italic });

            // Combinar segmentos en líneas
            var allText = segments.map(function(s) { return s.text; }).join('');
            var lines = allText.split('\n');

            // Mapear cada línea a sus segmentos con formato
            var y = startY;
            var lineHeight = fontSize * 0.45;
            var charIdx = 0;

            for (var li = 0; li < lines.length; li++) {
                var line = lines[li].trim();
                if (!line) { y += lineHeight * 0.6; charIdx += 1; continue; }

                // Verificar salto de página
                if (y > pageHeight - 25) {
                    pdf.addPage();
                    y = 20;
                }

                // Encontrar segmentos que corresponden a esta línea
                var lineSegs = [];
                var remaining = line.length;
                var globalPos = allText.indexOf(line, charIdx > 0 ? charIdx - 1 : 0);
                if (globalPos < 0) globalPos = charIdx;

                var segCharIdx = 0;
                for (var si = 0; si < segments.length && remaining > 0; si++) {
                    var seg = segments[si];
                    var segEnd = segCharIdx + seg.text.length;

                    if (segEnd > globalPos && segCharIdx < globalPos + line.length) {
                        var startInSeg = Math.max(0, globalPos - segCharIdx);
                        var endInSeg = Math.min(seg.text.length, globalPos + line.length - segCharIdx);
                        var portion = seg.text.substring(startInSeg, endInSeg);
                        if (portion) {
                            lineSegs.push({ text: portion, bold: seg.bold, italic: seg.italic });
                            remaining -= portion.length;
                        }
                    }
                    segCharIdx = segEnd;
                }

                // Renderizar segmentos de la línea
                var curX = x;
                for (var sj = 0; sj < lineSegs.length; sj++) {
                    var s = lineSegs[sj];
                    var fontStyle = s.bold && s.italic ? 'bolditalic' : s.bold ? 'bold' : s.italic ? 'italic' : 'normal';
                    pdf.setFont('helvetica', fontStyle);
                    pdf.setFontSize(fontSize);
                    pdf.setTextColor(51, 65, 85);

                    // Word wrap dentro del segmento
                    var words = s.text.split(' ');
                    for (var wi = 0; wi < words.length; wi++) {
                        var word = words[wi];
                        var wordW = pdf.getTextWidth(word + ' ');
                        if (curX + wordW > x + maxWidth && curX > x) {
                            y += lineHeight;
                            curX = x;
                            if (y > pageHeight - 25) { pdf.addPage(); y = 20; }
                        }
                        pdf.text(word + (wi < words.length - 1 ? ' ' : ''), curX, y);
                        curX += wordW;
                    }
                }

                y += lineHeight;
                charIdx = globalPos + line.length + 1;
            }

            pdf.setFont('helvetica', 'normal');
            return y;
        }

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

        async function saveReportDB(key, data) {
            const db = await initDB();
            
            // 1. Guardar localmente (IndexedDB)
            await new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                store.put(data, key);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });

            // 2. Sincronizar con la Nube (Supabase)
            if (window.sb) {
                try {
                    const placa = data.placa || key.replace('report_', '');
                    // UPDATE+INSERT para no depender de constraints
                    const { data: updated } = await window.sb
                        .from('informes')
                        .update({ datos: data, updated_at: new Date() })
                        .eq('placa', placa)
                        .select('placa');

                    if (!updated || updated.length === 0) {
                        await window.sb
                            .from('informes')
                            .insert({ placa: placa, datos: data, updated_at: new Date() });
                    }
                } catch (e) { console.error("Error guardando informe en nube:", e); }
            }
        }

        async function getReportDB(key) {
            // 1. Intentar desde la Nube (Supabase)
            if (window.sb) {
                try {
                    const placa = key.replace('report_', '');
                    const { data } = await window.sb
                        .from('informes')
                        .select('datos')
                        .eq('placa', placa)
                        .single();
                        
                    if (data && data.datos) return data.datos;
                } catch (e) { console.error("Error leyendo informe de nube:", e); }
            }

            // 2. Fallback a Local (IndexedDB)
            const db = await initDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const req = store.get(key);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        }

        function toggleSidebar(force) {
            const side = document.getElementById('sidebar');
            const over = document.getElementById('sidebarOverlay');
            if (force !== undefined) {
                if (force) { side.classList.add('active'); over.classList.add('active'); }
                else { side.classList.remove('active'); over.classList.remove('active'); }
            } else {
                side.classList.toggle('active');
                over.classList.toggle('active');
            }
        }

        const normalize = (p) => p.toString().toUpperCase().replace(/[^A-Z0-9]/g, '');

        function solicitudEstadoAprobado(req) {
            return req && String(req.status || '').toLowerCase().trim() === 'approved';
        }

        async function countPendingSolicitudesCloud() {
            if (!window.sb) return 0;
            const { data } = await window.sb.from('solicitudes').select('datos');
            const rows = (data || []).map((i) => i.datos).filter((d) => d && d.placa);
            const approvedNorm = new Set();
            rows.forEach((d) => {
                if (solicitudEstadoAprobado(d)) approvedNorm.add(normalize(String(d.placa)));
            });
            const pendingNormSeen = new Set();
            let count = 0;
            rows.forEach((d) => {
                // Registros de cuenta no cuentan como pendientes
                if (d.isRegistro) return;
                if (solicitudEstadoAprobado(d)) return;
                var n = normalize(String(d.placa));
                if (approvedNorm.has(n)) return;
                if (pendingNormSeen.has(n)) return;
                pendingNormSeen.add(n);
                count++;
            });
            return count;
        }

        // Configuración de Categorías
        const categories = [
            { id: 'sunarp', icon: 'fa-id-card', title: 'Propiedad Vehicular SUNARP', def: 'Estado: Verificado y Limpio\nSin anotaciones vigentes en propiedad vehicular.' },
            { id: 'historial', icon: 'fa-file-lines', title: 'Inscripción y Precio de Vehículo', def: 'Estado: Verificado y Limpio\nHistorial de registros y transferencias validado.' },
            { id: 'caracteristicas', icon: 'fa-car-side', title: 'Cambio de Características', def: 'Estado: Verificado y Limpio\nCaracterísticas técnicas originales verificadas.' },
            { id: 'tive', icon: 'fa-id-badge', title: 'Tarjeta de Propiedad (TIVE)', def: 'Estado: Verificado y Limpio\nTarjeta TIVE verificada correctamente.' },
            { id: 'propietarios', icon: 'fa-users', title: 'Historial de Propietarios Inscritos', def: 'Estado: Verificado y Limpio\nHistorial de propietarios anteriores validado.' },
            { id: 'boleta', icon: 'fa-building-columns', title: 'Boleta Informativa', def: 'Estado: Verificado y Limpio\nBoleta informativa generada con éxito.' },
            { id: 'denuncias', icon: 'fa-handcuffs', title: 'Denuncias y Órdenes de Captura', def: 'Estado: Verificado y Limpio\nSin denuncias por robo ni órdenes de captura.' },
            { id: 'siniestralidad', icon: 'fa-heart-pulse', title: 'Siniestralidad por Placa', def: 'Estado: Verificado y Limpio\nSin registros de siniestros o pérdidas totales.' },
            { id: 'estado_placa', icon: 'fa-sheet-plastic', title: 'Estado de Placa', def: 'Estado: Verificado y Limpio\nPlaca física y registro en estado activo.' },
            { id: 'lima', icon: 'fa-money-bill-wave', title: 'Deudas y Multas SAT Lima', def: 'Estado: Verificado y Limpio\nSin deudas de papeletas o impuesto vehicular en Lima.' },
            { id: 'callao', icon: 'fa-money-bill-wave', title: 'Deudas y Multas SAT Callao', def: 'Estado: Verificado y Limpio\nSin deudas pendientes en el Callao.' },
            { id: 'region', icon: 'fa-map-location-dot', title: 'Deudas y Multas por Región', def: 'Estado: Verificado y Limpio\nConsulta regional realizada con éxito.' },
            { id: 'atu', icon: 'fa-triangle-exclamation', title: 'Papeletas de Tránsito ATU', def: 'Estado: Verificado y Limpio\nVehículo libre de infracciones ante ATU.' },
            { id: 'sutran', icon: 'fa-truck', title: 'Papeletas SUTRAN', def: 'Estado: Verificado y Limpio\nSin infracciones al reglamento ante SUTRAN.' },
            { id: 'foto_pit', icon: 'fa-camera', title: 'Foto Pit Lima', def: 'Estado: Verificado y Limpio\nSin capturas de fotopapeletas pendientes.' },
            { id: 'citv', icon: 'fa-screwdriver-wrench', title: 'Inspección Técnica Vehicular CITV', def: 'Estado: Verificado y Limpio\nInspección Técnica aprobada y vigente.' },
            { id: 'soat', icon: 'fa-shield-halved', title: 'Vigencia del SOAT', def: 'Estado: Verificado y Limpio\nPóliza de Seguro Obligatorio validada.' },
            { id: 'record', icon: 'fa-address-card', title: 'Récord de Conductor (DNI)', def: 'Estado: Verificado y Limpio\nRécord del conductor sin infracciones graves.' },
            { id: 'lunas', icon: 'fa-circle-half-stroke', title: 'Lunas Oscurecidas', def: 'Estado: Verificado y Limpio\nPermiso de lunas oscurecidas validado y vigente.' },
            { id: 'fise', icon: 'fa-gas-pump', title: 'FISE GNV Subsidio Gas', def: 'Estado: Verificado y Limpio\nSin deudas ni subsidios en programa FISE.' },
            { id: 'gnv', icon: 'fa-coins', title: 'Consulta Deuda GNV', def: 'Estado: Verificado y Limpio\nConsulta de financiamiento GNV realizada.' },
            { id: 'otros', icon: 'fa-list-check', title: 'Otras Afectaciones', def: 'Estado: Verificado y Limpio\nSin otras afectaciones en sistemas integrados.' }
        ];

        // Sistema de historial de navegación
        let navigationStack = ['editor'];
        
        function showView(view, addToHistory = true) {
            document.getElementById('editorView').style.display = view === 'editor' ? 'block' : 'none';
            document.getElementById('requestsView').style.display = view === 'requests' ? 'block' : 'none';
            document.getElementById('creditsView').style.display = view === 'credits' ? 'block' : 'none';
            if (document.getElementById('historyView')) document.getElementById('historyView').style.display = view === 'history' ? 'block' : 'none';
            if (document.getElementById('usersView')) document.getElementById('usersView').style.display = view === 'users' ? 'block' : 'none';
            if (document.getElementById('accessView')) document.getElementById('accessView').style.display = view === 'access' ? 'block' : 'none';
            
            document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
            if (document.getElementById('nav-' + view)) document.getElementById('nav-' + view).classList.add('active');
            
            if (view === 'history' && typeof renderHistoryList === 'function') renderHistoryList();
            if (view === 'users' && typeof renderUsersList === 'function') renderUsersList();
            if (view === 'requests' && typeof renderRequestsList === 'function') renderRequestsList();
            if (view === 'access' && typeof renderAccessList === 'function') renderAccessList();
            
            // Agregar al historial de navegación
            if (addToHistory) {
                navigationStack.push(view);
                history.pushState({ view: view }, '', '#' + view);
            }
        }

        async function exportUsersToExcel() {
            if (!window.sb) { alert('Supabase no conectado.'); return; }

            try {
                // 1. Traer TODOS los usuarios de saldos
                var allSaldos = [];
                var sRes = await window.sb.from('saldos').select('*').order('updated_at', { ascending: false });
                if (sRes.error) throw sRes.error;
                if (sRes.data) allSaldos = sRes.data;

                // 2. Traer TODAS las solicitudes para extraer nombre y WhatsApp
                var regMap = {};
                var solRes = await window.sb.from('solicitudes').select('datos');
                if (solRes.data) {
                    for (var i = 0; i < solRes.data.length; i++) {
                        var d = solRes.data[i].datos;
                        if (!d || !d.email) continue;
                        var em = String(d.email).toLowerCase().trim();
                        if (!regMap[em]) regMap[em] = {};
                        if (d.nombre && !regMap[em].nombre) regMap[em].nombre = d.nombre;
                        if (d.whatsapp && !regMap[em].whatsapp) regMap[em].whatsapp = String(d.whatsapp);
                        // Contar solicitudes
                        regMap[em].solicitudes = (regMap[em].solicitudes || 0) + 1;
                        // Última actividad
                        var ts = d.timestamp || d.publishedAt || 0;
                        if (ts > (regMap[em].ultimaActividad || 0)) regMap[em].ultimaActividad = ts;
                    }
                }

                if (allSaldos.length === 0) {
                    alert('No hay usuarios para exportar.');
                    return;
                }

                // 3. Generar Excel con formato profesional
                var fecha = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
                var html = '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8">' +
                    '<style>td,th{mso-number-format:"\\@";}</style></head><body>';

                // Título
                html += '<table cellpadding="4" cellspacing="0" style="font-family:Arial;">';
                html += '<tr><td colspan="8" style="font-size:18px; font-weight:bold; color:#111b21; padding:10px 4px;">FILTRO VEHICULAR PLUS - Base de Datos de Clientes</td></tr>';
                html += '<tr><td colspan="8" style="font-size:11px; color:#64748b; padding:2px 4px 10px;">Exportado: ' + fecha + ' | Total: ' + allSaldos.length + ' usuarios</td></tr>';

                // Encabezados
                html += '<tr style="background:#111b21; color:#ffffff; font-weight:bold; font-size:11px;">';
                html += '<th style="padding:8px; border:1px solid #1f2c34;">N°</th>';
                html += '<th style="padding:8px; border:1px solid #1f2c34;">Nombre Completo</th>';
                html += '<th style="padding:8px; border:1px solid #1f2c34;">Correo Electrónico</th>';
                html += '<th style="padding:8px; border:1px solid #1f2c34;">WhatsApp</th>';
                html += '<th style="padding:8px; border:1px solid #1f2c34;">Créditos</th>';
                html += '<th style="padding:8px; border:1px solid #1f2c34;">Plataforma</th>';
                html += '<th style="padding:8px; border:1px solid #1f2c34;">Solicitudes</th>';
                html += '<th style="padding:8px; border:1px solid #1f2c34;">Última Actividad</th>';
                html += '</tr>';

                for (var j = 0; j < allSaldos.length; j++) {
                    var u = allSaldos[j];
                    var email = String(u.email || '').trim();
                    var reg = regMap[email.toLowerCase()] || {};
                    var nombre = reg.nombre || '-';
                    var wpp = reg.whatsapp || '-';
                    var creditos = u.creditos || 0;
                    var activa = u.plataforma_activa ? 'Activo' : 'Inactivo';
                    var totalSol = reg.solicitudes || 0;
                    var ultimaAct = reg.ultimaActividad ? new Date(reg.ultimaActividad).toLocaleDateString('es-PE') : '-';
                    var bg = j % 2 === 0 ? '#ffffff' : '#f8fafc';
                    var borderStyle = 'border:1px solid #e2e8f0; padding:6px 8px; font-size:11px;';

                    html += '<tr style="background:' + bg + ';">';
                    html += '<td style="' + borderStyle + ' text-align:center; color:#94a3b8; font-weight:bold;">' + (j + 1) + '</td>';
                    html += '<td style="' + borderStyle + ' font-weight:bold; color:#111b21;">' + nombre + '</td>';
                    html += '<td style="' + borderStyle + '">' + email + '</td>';
                    html += '<td style="' + borderStyle + '">' + wpp + '</td>';
                    html += '<td style="' + borderStyle + ' text-align:center; font-weight:bold; color:' + (creditos > 0 ? '#111b21' : '#ef4444') + ';">' + creditos + '</td>';
                    html += '<td style="' + borderStyle + ' text-align:center; color:' + (activa === 'Activo' ? '#25d366' : '#94a3b8') + '; font-weight:bold;">' + activa + '</td>';
                    html += '<td style="' + borderStyle + ' text-align:center;">' + totalSol + '</td>';
                    html += '<td style="' + borderStyle + ' text-align:center; color:#64748b;">' + ultimaAct + '</td>';
                    html += '</tr>';
                }

                html += '</table></body></html>';

                // 4. Descargar
                var blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                var fechaArchivo = new Date().toISOString().split('T')[0];
                a.download = 'clientes_filtro_vehicular_' + fechaArchivo + '.xls';
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                setTimeout(function() {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 1000);

                alert(allSaldos.length + ' clientes exportados exitosamente.');
            } catch (e) {
                alert('Error al exportar: ' + e.message);
            }
        }

        async function renderUsersList() {
            const list = document.getElementById('usersList');
            if (!list) return;

            if (!window.sb) {
                list.innerHTML = '<div class="empty-req">Inicia sesión en Supabase Cloud para visualizar usuarios.</div>';
                return;
            }

            try {
                // 1. Traer saldos
                var allData = [];
                var pg = 0;
                var sz = 1000;
                while (true) {
                    var { data: chunk, error } = await window.sb
                        .from('saldos')
                        .select('*')
                        .order('updated_at', { ascending: false })
                        .range(pg * sz, (pg + 1) * sz - 1);
                    if (error) throw error;
                    if (!chunk || chunk.length === 0) break;
                    allData = allData.concat(chunk);
                    if (chunk.length < sz) break;
                    pg++;
                }
                var data = allData;

                // 2. Traer nombres y WhatsApp de solicitudes (registros)
                var regMap = {};
                var solRes = await window.sb.from('solicitudes').select('datos');
                if (solRes.data) {
                    for (var i = 0; i < solRes.data.length; i++) {
                        var d = solRes.data[i].datos;
                        if (!d || !d.email) continue;
                        var em = String(d.email).toLowerCase().trim();
                        if (!regMap[em]) regMap[em] = {};
                        if (d.nombre) regMap[em].nombre = d.nombre;
                        if (d.whatsapp) regMap[em].whatsapp = String(d.whatsapp);
                    }
                }

                if (!data || data.length === 0) {
                    list.innerHTML = '<div class="empty-req">No se encontraron usuarios registrados aún.</div>';
                    return;
                }

                list.innerHTML = data.map(function(u, idx) {
                    var cred = u.creditos || 0;
                    var hasCredits = cred > 0;
                    var plataforma = u.plataforma_activa || false;
                    var email = String(u.email || '').trim();
                    var reg = regMap[email.toLowerCase()] || {};
                    var nombre = reg.nombre || '';
                    var wpp = reg.whatsapp || '';
                    var inicial = (nombre ? nombre.charAt(0) : email.charAt(0)).toUpperCase();

                    return '<div style="background:#ffffff; border:1px solid #e5e7eb; border-radius:10px; padding:12px 16px; display:flex; align-items:center; gap:12px; margin-bottom:6px;">' +
                        '<div style="width:36px; height:36px; min-width:36px; background:' + (plataforma ? '#25d366' : '#111b21') + '; color:#fff; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600;">' + inicial + '</div>' +
                        '<div style="flex:1; min-width:0;">' +
                            '<div style="font-size:12px; font-weight:600; color:#111b21; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + esc(nombre || email.split('@')[0]) + '</div>' +
                            '<div style="font-size:10px; color:#6b7280; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + esc(email) + '</div>' +
                        '</div>' +
                        (wpp ? '<a href="https://wa.me/51' + esc(wpp) + '" target="_blank" style="flex-shrink:0; width:28px; height:28px; display:flex; align-items:center; justify-content:center; color:#25d366; font-size:14px; text-decoration:none;"><i class="fa-brands fa-whatsapp"></i></a>' : '') +
                        '<div style="flex-shrink:0; text-align:center; min-width:40px;">' +
                            '<div style="font-size:14px; font-weight:600; color:' + (hasCredits ? '#25d366' : '#9ca3af') + '; line-height:1;">' + cred + '</div>' +
                            '<div style="font-size:7px; color:#9ca3af; text-transform:uppercase; margin-top:1px;">créditos</div>' +
                        '</div>' +
                        (plataforma ? '<span style="font-size:7px; font-weight:600; color:#25d366; background:rgba(37,211,102,0.1); padding:2px 6px; border-radius:4px; flex-shrink:0;">PRO</span>' : '<span style="font-size:7px; font-weight:600; color:#f59e0b; background:rgba(245,158,11,0.1); padding:2px 6px; border-radius:4px; flex-shrink:0;">FREE</span>') +
                        (hasCredits ? '<button onclick="event.stopPropagation(); resetCredits(\'' + escAttr(email) + '\')" style="background:transparent; border:none; color:#f59e0b; width:24px; height:24px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:11px; flex-shrink:0;" title="Quitar créditos"><i class="fa-solid fa-coins"></i></button>' : '') +
                        '<button onclick="event.stopPropagation(); deleteUser(\'' + escAttr(email) + '\')" style="background:transparent; border:none; color:#ef4444; width:24px; height:24px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:11px; flex-shrink:0;" title="Eliminar"><i class="fa-solid fa-trash"></i></button>' +
                    '</div>';
                }).join('');

            } catch (e) {
                list.innerHTML = '<div class="empty-req">Error descargando usuarios: ' + esc(e.message) + '</div>';
            }
        }

        async function resetCredits(email) {
            if (!confirm('¿Quitar todos los créditos a ' + email + '?')) return;
            try {
                if (!window.sb) throw new Error('Supabase no conectado.');
                var { error } = await window.sb.from('saldos').update({ creditos: 0, updated_at: new Date() }).eq('email', email);
                if (error) throw error;
                alert('Créditos eliminados para ' + email);
                renderUsersList();
            } catch (e) {
                alert('Error: ' + e.message);
            }
        }

        async function deleteUser(email) {
            if (!confirm(`¿Estás seguro de eliminar a ${email}? Se borrará permanentemente de la Nube.`)) return;
            try {
                const { error } = await window.sb.from('saldos').delete().eq('email', email);
                if (error) throw error;
                alert(`✅ Usuario ${email} removido de la nube.`);
                renderUsersList(); // Refrescar
            } catch (e) {
                alert("❌ Fallo crítico al borrar: " + e.message);
            }
        }

        async function deleteFreeAccountsCloud() {
            if (!window.sb) { alert('Sin conexión a la nube.'); return; }
            showAdminConfirmModal({
                title: '¿Eliminar cuentas gratuitas?',
                message: 'Se eliminarán los usuarios que no pagaron acceso (S/35) y tienen 0 créditos. Los usuarios activos o con créditos NO se verán afectados.',
                confirmLabel: 'Sí, eliminar gratuitas',
                danger: true,
                onConfirm: async function() {
                    try {
                        // Buscar cuentas gratuitas: plataforma_activa=false y creditos=0
                        var { data: freeUsers, error } = await window.sb
                            .from('saldos')
                            .select('email')
                            .eq('plataforma_activa', false)
                            .eq('creditos', 0);
                        if (error) throw error;
                        if (!freeUsers || freeUsers.length === 0) {
                            alert('No hay cuentas gratuitas para eliminar.');
                            return;
                        }

                        var emails = freeUsers.map(function(u) { return u.email; });
                        var count = emails.length;

                        // Eliminar de saldos
                        for (var i = 0; i < emails.length; i++) {
                            await window.sb.from('saldos').delete().eq('email', emails[i]);
                        }

                        // Eliminar sus registros de solicitudes
                        var { data: regs } = await window.sb.from('solicitudes').select('placa, datos').like('placa', 'REGISTRO_%');
                        if (regs) {
                            for (var j = 0; j < regs.length; j++) {
                                if (regs[j].datos && emails.includes(regs[j].datos.email)) {
                                    await window.sb.from('solicitudes').delete().eq('placa', regs[j].placa);
                                }
                            }
                        }

                        alert('Se eliminaron ' + count + ' cuentas gratuitas.');
                        if (typeof renderUsersList === 'function') renderUsersList();
                        if (typeof renderHistoryList === 'function') renderHistoryList();
                    } catch(e) {
                        alert('Error: ' + e.message);
                    }
                }
            });
        }

        async function deleteAllUsersCloud() {
            if (!window.sb) {
                alert("❌ Supabase no conectado.");
                return;
            }

            const confirmA = confirm("⚠️ Acción crítica: se eliminarán TODAS las cuentas de usuarios en la nube. ¿Deseas continuar?");
            if (!confirmA) return;

            const phrase = prompt("Escribe ELIMINAR TODO para confirmar:");
            if (phrase !== "ELIMINAR TODO") {
                alert("Operación cancelada. Frase de confirmación incorrecta.");
                return;
            }

            try {
                const { error } = await window.sb.from('saldos').delete().neq('email', '');
                if (error) throw error;
                alert("✅ Todas las cuentas de usuarios fueron eliminadas de la nube.");
                renderUsersList();
            } catch (e) {
                alert("❌ Fallo crítico al borrar todas las cuentas: " + e.message);
            }
        }

        // ── ACTIVAR ACCESO MANUAL ────────────────────────────────────────────────

        async function activarAccesoManual() {
            const emailInput = document.getElementById('accessEmail');
            const feedback = document.getElementById('accessFeedback');
            const email = emailInput.value.trim().toLowerCase();

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!email || !emailRegex.test(email)) {
                feedback.style.display = 'block';
                feedback.style.background = '#fef2f2';
                feedback.style.color = '#b91c1c';
                feedback.style.border = '1px solid #fecaca';
                feedback.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Ingresa un correo electrónico válido.';
                return;
            }

            if (!window.sb) {
                feedback.style.display = 'block';
                feedback.style.background = '#fef2f2';
                feedback.style.color = '#b91c1c';
                feedback.style.border = '1px solid #fecaca';
                feedback.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Supabase no conectado.';
                return;
            }

            feedback.style.display = 'block';
            feedback.style.background = '#f0fdf4';
            feedback.style.color = '#166534';
            feedback.style.border = '1px solid #bbf7d0';
            feedback.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Activando...';

            try {
                const { error } = await window.sb
                    .from('saldos')
                    .upsert([{
                        email: email,
                        plataforma_activa: true,
                        updated_at: new Date().toISOString()
                    }], { onConflict: 'email' });

                if (error) throw error;

                feedback.style.background = '#f0fdf4';
                feedback.style.color = '#166534';
                feedback.style.border = '1px solid #bbf7d0';
                feedback.innerHTML = `<i class="fa-solid fa-circle-check"></i> Acceso activado correctamente para <b>${esc(email)}</b>`;
                emailInput.value = '';
                renderAccessList();
            } catch (e) {
                feedback.style.background = '#fef2f2';
                feedback.style.color = '#b91c1c';
                feedback.style.border = '1px solid #fecaca';
                feedback.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> Error: ${esc(e.message)}`;
            }
        }

        async function revocarAcceso(email) {
            if (!confirm(`¿Revocar acceso a ${email}?`)) return;
            if (!window.sb) return;
            try {
                await window.sb
                    .from('saldos')
                    .update({ plataforma_activa: false })
                    .eq('email', email);
                renderAccessList();
            } catch (e) {
                alert('❌ Error al revocar: ' + e.message);
            }
        }

        async function renderAccessList() {
            const container = document.getElementById('accessList');
            if (!container) return;
            if (!window.sb) {
                container.innerHTML = '<div class="empty-req">Supabase no conectado.</div>';
                return;
            }
            container.innerHTML = '<div class="empty-req">Cargando...</div>';
            try {
                const { data, error } = await window.sb
                    .from('saldos')
                    .select('email, plataforma_activa, creditos, updated_at')
                    .eq('plataforma_activa', true)
                    .order('updated_at', { ascending: false });

                if (error) throw error;

                if (!data || data.length === 0) {
                    container.innerHTML = '<div class="empty-req">No hay clientes con acceso activo.</div>';
                    return;
                }

                container.innerHTML = data.map(u => {
                    const fecha = u.updated_at ? new Date(u.updated_at).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }) : '-';
                    return `
                    <div class="req-card" style="display:flex; align-items:center; gap:14px; padding:14px 18px; flex-wrap:wrap;">
                        <div style="width:38px; height:38px; border-radius:50%; background:linear-gradient(135deg,#25d366,#1ebe5d); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                            <i class="fa-solid fa-user" style="color:white; font-size:15px;"></i>
                        </div>
                        <div style="flex:1; min-width:150px;">
                            <div style="font-size:13px; font-weight:800; color:#111b21;">${esc(u.email)}</div>
                            <div style="font-size:11px; color:#64748b; margin-top:2px;">
                                <span style="background:#f0fdf4; color:#166534; padding:2px 8px; border-radius:20px; font-weight:700; font-size:10px; border:1px solid #bbf7d0;">✅ ACTIVO</span>
                                &nbsp;Créditos: <b>${u.creditos || 0}</b>
                                &nbsp;· Activado: ${fecha}
                            </div>
                        </div>
                        <button onclick="revocarAcceso('${escAttr(u.email)}')" style="padding:7px 14px; background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; border-radius:8px; font-size:11px; font-weight:700; cursor:pointer; white-space:nowrap; display:flex; align-items:center; gap:6px;" onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='#fef2f2'">
                            <i class="fa-solid fa-ban"></i> Revocar
                        </button>
                    </div>`;
                }).join('');
            } catch (e) {
                container.innerHTML = `<div class="empty-req">Error: ${esc(e.message)}</div>`;
            }
        }

        // ─────────────────────────────────────────────────────────────────────────

        async function deleteAllCloudData() {
            if (!window.sb) {
                alert("❌ Supabase no conectado.");
                return;
            }

            const confirmA = confirm("⚠️ REINICIO TOTAL: se eliminarán TODAS las cuentas, solicitudes e informes en la nube. ¿Deseas continuar?");
            if (!confirmA) return;

            const phrase = prompt("Escribe REINICIO TOTAL para confirmar:");
            if (phrase !== "REINICIO TOTAL") {
                alert("Operación cancelada. Frase de confirmación incorrecta.");
                return;
            }

            try {
                const { error: errSaldos } = await window.sb.from('saldos').delete().neq('email', '');
                if (errSaldos) throw errSaldos;

                const { error: errSolicitudes } = await window.sb.from('solicitudes').delete().neq('placa', '');
                if (errSolicitudes) throw errSolicitudes;

                const { error: errInformes } = await window.sb.from('informes').delete().neq('placa', '');
                if (errInformes) throw errInformes;

                alert("✅ Reinicio total completado: nube limpia (saldos, solicitudes e informes).");
                if (typeof renderUsersList === 'function') renderUsersList();
                if (typeof renderRequestsList === 'function') renderRequestsList();
                if (typeof renderHistoryList === 'function') renderHistoryList();
            } catch (e) {
                alert("❌ Fallo crítico en reinicio total: " + e.message);
            }
        }

        async function addCredits() {
            const email = document.getElementById('creditEmail').value.trim().toLowerCase();
            const amount = parseInt(document.getElementById('creditAmount').value);
            
            // Validación mejorada de email con regex
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!email || !emailRegex.test(email)) {
                alert("Por favor ingresa un correo electrónico válido.");
                return;
            }
            
            if (isNaN(amount) || amount <= 0) {
                alert("Por favor ingresa una cantidad válida de créditos.");
                return;
            }

            try {
                let currentBalance = 0;
                let currentData = null;

                // 1. INTENTAR CON LA NUBE ☁️
                if (window.sb) {
                    try {
                        const { data, error: readErr } = await window.sb
                            .from('saldos')
                            .select('creditos')
                            .eq('email', email)
                            .single();
                        if (readErr && readErr.code !== 'PGRST116') console.error('Error leyendo saldo:', readErr.message);
                        if (data) { currentData = data; currentBalance = data.creditos; }
                    } catch(cloudErr) {
                        console.error('Error de conexión al leer saldo:', cloudErr);
                    }
                }

                // 2. FALLBACK A MEMORIA LOCAL 💾
                const localKey = 'saldo_' + email;
                if (!currentData) {
                    currentBalance = parseInt(localStorage.getItem(localKey)) || 0;
                }

                const newBalance = currentBalance + amount;

                // 3. GUARDAR EN LA NUBE ☁️
                let cloudSaved = false;
                if (window.sb) {
                    try {
                        const { error } = await window.sb
                            .from('saldos')
                            .upsert({ email: email, creditos: newBalance }, { onConflict: 'email' });
                        if (error) {
                            console.error('Error guardando créditos en nube:', error.message);
                            alert('⚠️ Error al guardar en la nube: ' + error.message + '\nLos créditos se guardaron solo localmente.');
                        } else {
                            cloudSaved = true;
                        }
                    } catch(cloudErr) {
                        console.error('Error de conexión al guardar créditos:', cloudErr);
                        alert('⚠️ Sin conexión a la nube. Los créditos se guardaron solo localmente.');
                    }
                }

                // 4. GUARDAR SIEMPRE LOCALMENTE 💾
                localStorage.setItem(localKey, newBalance);

                // 5. RESPUESTA TRANSPARENTE 📢
                if (cloudSaved) {
                    alert(`✅ ¡Transacción a la Nube Exitosa!\n\nSe recargaron ${amount} créditos a: ${email}.\n(Saldo Actualizado: ${newBalance} Créditos)`);
                } else {
                    alert(`📥 ¡Guardado Localmente!\n\nSe recargaron ${amount} créditos a: ${email}.\n(Nota: La nube está desconectada. El saldo se usará en esta PC)`);
                }
                document.getElementById('creditEmail').value = '';

            } catch(e) {
                alert("❌ Fallo Crítico: No se pudo procesar la recarga.\n\nDetalle: " + e.message);
            }
        }

        function toggleCard(catId) {
            var card = document.getElementById('card-' + catId);
            if (!card) return;
            var wasOpen = card.classList.contains('open');
            // Cerrar todos
            document.querySelectorAll('.admin-card.open').forEach(function(c) {
                c.classList.remove('open');
            });
            // Si no estaba abierto, abrir este
            if (!wasOpen) {
                card.classList.add('open');
                // Scroll suave al card abierto
                setTimeout(function() {
                    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 50);
            }
        }

        // Actualiza el indicador de estado en la fila colapsada
        function syncRowStatus(catId) {
            var card = document.getElementById('card-' + catId);
            if (!card) return;
            var activeDot = card.querySelector('.status-picker .status-dot-btn.active');
            var rowDot = card.querySelector('.card-row-status');
            if (activeDot && rowDot) {
                rowDot.setAttribute('data-st', activeDot.dataset.status);
            }
        }

        function renderAdminCards() {
            const grid = document.getElementById('adminGrid');
            grid.innerHTML = categories.map(cat => `
                <div class="admin-card" id="card-${cat.id}" data-title="${cat.title.toLowerCase()}" data-files='[]'>
                    <div class="card-row-header" onclick="toggleCard('${cat.id}')">
                        <div class="card-row-icon"><i class="fa-solid ${cat.icon}"></i></div>
                        <div class="card-row-title">${cat.title}</div>
                        <div class="card-row-status" data-st="ok"></div>
                        <span class="card-row-badge" id="badge-${cat.id}">0</span>
                        <i class="fa-solid fa-chevron-down card-row-arrow"></i>
                    </div>
                    <div class="card-expand-panel">
                        <div class="card-expand-inner">
                            <div class="card-head">
                                <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                                    <div class="format-toolbar" style="display:flex; gap:10px; background:#f8fafc; padding:5px 12px; border-radius:8px; align-items:center; border:1px solid #e2e8f0;" onmousedown="event.preventDefault()">
                                        <i class="fa-solid fa-bold" style="cursor:pointer; font-size:12px; color:#475569; padding:4px;" onclick="formatText('${cat.id}', 'bold')" title="Negrita"></i>
                                        <i class="fa-solid fa-italic" style="cursor:pointer; font-size:12px; color:#475569; padding:4px;" onclick="formatText('${cat.id}', 'italic')" title="Cursiva"></i>
                                        <i class="fa-solid fa-strikethrough" style="cursor:pointer; font-size:12px; color:#475569; padding:4px;" onclick="formatText('${cat.id}', 'strikeThrough')" title="Tachado"></i>
                                        <i class="fa-solid fa-code" style="cursor:pointer; font-size:12px; color:#475569; padding:4px;" onclick="formatText('${cat.id}', 'code')" title="Código"></i>
                                        <i class="fa-solid fa-list-ol" style="cursor:pointer; font-size:12px; color:#475569; padding:4px;" onclick="formatText('${cat.id}', 'insertOrderedList')" title="Lista numerada"></i>
                                        <i class="fa-solid fa-list-ul" style="cursor:pointer; font-size:12px; color:#475569; padding:4px;" onclick="formatText('${cat.id}', 'insertUnorderedList')" title="Viñeta"></i>
                                        <i class="fa-solid fa-quote-left" style="cursor:pointer; font-size:12px; color:#475569; padding:4px;" onclick="formatText('${cat.id}', 'blockquote')" title="Cita"></i>
                                        <div style="width:1px; height:14px; background:#e2e8f0;"></div>
                                        <i class="fa-solid fa-align-left" style="cursor:pointer; font-size:12px; color:#475569; padding:4px;" onclick="formatText('${cat.id}', 'justifyLeft')" title="Izquierda"></i>
                                        <i class="fa-solid fa-align-center" style="cursor:pointer; font-size:12px; color:#475569; padding:4px;" onclick="formatText('${cat.id}', 'justifyCenter')" title="Centro"></i>
                                        <i class="fa-solid fa-align-right" style="cursor:pointer; font-size:12px; color:#475569; padding:4px;" onclick="formatText('${cat.id}', 'justifyRight')" title="Derecha"></i>
                                        <i class="fa-solid fa-align-justify" style="cursor:pointer; font-size:12px; color:#475569; padding:4px;" onclick="formatText('${cat.id}', 'justifyFull')" title="Justificado"></i>
                                    </div>
                                    <div class="status-picker">
                                        <div class="status-dot-btn active" data-status="ok" onclick="toggleStatus(this, '${cat.id}')"></div>
                                        <div class="status-dot-btn" data-status="wa" onclick="toggleStatus(this, '${cat.id}')"></div>
                                        <div class="status-dot-btn" data-status="ko" onclick="toggleStatus(this, '${cat.id}')"></div>
                                    </div>
                                </div>
                                <button type="button" onclick="magicFormat(this)" style="background:#111b21; color:#fff; border:none; padding:7px 14px; border-radius:8px; font-size:11px; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:5px; transition:0.2s; white-space:nowrap;" onmouseover="this.style.background='#1f2c34'" onmouseout="this.style.background='#111b21'"><i class="fa-solid fa-wand-magic-sparkles" style="font-size:10px;"></i> Auto</button>
                            </div>
                            <div class="rich-editor" contenteditable="true" id="editor-${cat.id}" data-placeholder="Escribe aquí los hallazgos periciales...">${cat.def.replace(/\n/g, '<br>')}</div>
                            <div class="upload-area" onclick="triggerFileUpload('${cat.id}')" ondragover="handleDragOver(event, this)" ondragleave="handleDragLeave(event, this)" ondrop="handleDrop(event, '${cat.id}')">
                                <i class="fa-solid fa-cloud-arrow-up"></i>
                                <span>Arrastra imágenes o PDFs aquí</span>
                                <input type="file" id="file-${cat.id}" class="hidden-file-input" multiple accept="image/*,.pdf" onchange="handleFileChange(event, '${cat.id}')">
                            </div>
                            <div class="file-list-mini" id="fileList-${cat.id}"></div>
                        </div>
                    </div>
                </div>`).join('');
        }

        function formatText(catId, cmd) {
            var editor = document.getElementById('editor-' + catId);
            if (!editor) return;

            if (cmd === 'code') {
                var sel = window.getSelection();
                if (sel.rangeCount > 0 && sel.toString().length > 0) {
                    var range = sel.getRangeAt(0);
                    var code = document.createElement('code');
                    range.surroundContents(code);
                }
            } else if (cmd === 'blockquote') {
                document.execCommand('formatBlock', false, 'blockquote');
            } else {
                document.execCommand(cmd, false, null);
            }
            syncLiveProgress();
        }

        // Helper: leer texto plano de un editor rich
        function getEditorText(catId) {
            var editor = document.getElementById('editor-' + catId);
            return editor ? editor.innerText.trim() : '';
        }

        // Helper: leer HTML de un editor rich
        function getEditorHTML(catId) {
            var editor = document.getElementById('editor-' + catId);
            return editor ? editor.innerHTML : '';
        }

        // Helper: escribir contenido en un editor rich
        function setEditorContent(catId, html) {
            var editor = document.getElementById('editor-' + catId);
            if (editor) editor.innerHTML = html;
        }

        function toggleStatus(btn, catId) {
            btn.parentElement.querySelectorAll('.status-dot-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            syncRowStatus(catId);
            syncLiveProgress();
        }

        function setGlobalStatus(btn) {
            document.querySelectorAll('#globalStatus .status-dot-btn').forEach(d => d.classList.remove('active'));
            btn.classList.add('active');
            syncLiveProgress();
        }

        function loadVerdictTemplate(status) {
            const verdictArea = document.getElementById('verdictText');
            const targetDot = document.querySelector(`#globalStatus .status-dot-btn[data-status="${status}"]`);
            if (targetDot) setGlobalStatus(targetDot);

            const templates = {
                'ok': "Vehículo en excelentes condiciones legales. Tras la auditoría digital no se detectaron afectaciones críticas, gravámenes ni infracciones pendientes. El historial registra una trayectoria limpia, lo que representa un riesgo mínimo para la transferencia.",
                'wa': "Se han identificado alertas preventivas o trámites en curso que requieren validación física. Aunque el vehículo es apto para transferencia, recomendamos una revisión minuciosa de los documentos originales para garantizar una compra segura.",
                'ko': "¡RIESGO CRÍTICO DETECTADO! Se identificaron deudas cuantiosas, afectaciones legales vigentes o gravámenes que comprometen seriamente la legalidad de la unidad. Existe un riesgo elevado de bloqueo administrativo o judicial."
            };
            verdictArea.value = templates[status];
            syncLiveProgress();
        }

        function magicFormat(btn) {
            const card = btn.closest('.admin-card');
            const catId = card.id.replace('card-', '');
            var editor = document.getElementById('editor-' + catId);
            if (!editor) return;
            let text = editor.innerText.trim();

            const templates = {
                'lima': "<b>Entidad:</b> SAT LIMA<br><b>Estado:</b> Sin Deudas Pendientes<br>Tras la consulta en el sistema de recaudación, el vehículo se encuentra LIBRE de multas y capturas vigentes.",
                'callao': "<b>Entidad:</b> SAT CALLAO<br><b>Estado:</b> Sin Papeletas Detectadas<br>No se registran infracciones en la jurisdicción del Callao a la fecha de consulta.",
                'sunarp': "<b>Entidad:</b> SUNARP<br><b>Estado:</b> Sin Gravámenes Registrados<br>La partida registral no presenta bloqueos, embargos ni anotaciones de robo vigentes.",
                'denuncias': "<b>Entidad:</b> POLICÍA NACIONAL DEL PERÚ<br><b>Estado:</b> Sin Requisitorias<br>La unidad no figura con denuncias por robo ni órdenes de captura a nivel nacional.",
                'citv': "<b>Entidad:</b> MTC / CITV<br><b>Resultado:</b> APROBADO<br>La unidad cuenta con inspección técnica vigente. El sistema confirma que cumple con los estándares de seguridad.",
                'siniestralidad': "<b>Entidad:</b> SBS / ASOCIACIÓN DE SEGUROS<br><b>Estado:</b> Historial Limpio<br>No se reportan siniestros de cuantía ni pérdidas totales en la base de datos de aseguradoras.",
                'lunas': "<b>Entidad:</b> POLICÍA NACIONAL<br><b>Permiso:</b> VIGENTE<br>Cuenta con autorización legal para el uso de vidrios oscurecidos/polarizados a nivel nacional.",
                'historial': "<b>Estado:</b> Tracto Sucesivo en Regla<br>Se ha verificado la cadena de transferencias. No se detectan saltos registrales ni irregularidades en el historial de dominio.",
                'caracteristicas': "<b>Estado:</b> Características Originales<br>Motor, color y serie coinciden plenamente con la tarjeta de propiedad. Sin reportes de cambios no autorizados.",
                'region': "<b>Consulta:</b> Gobiernos Regionales<br><b>Estado:</b> Sin Afectaciones<br>La unidad no registra deudas tributarias ni papeletas en las principales municipalidades regionales del país.",
                'atu': "<b>Entidad:</b> ATU<br><b>Estado:</b> Libre de Infracciones<br>El vehículo no presenta sanciones por transporte urbano ni medidas preventivas vigentes ante la autoridad.",
                'estado_placa': "<b>Estado:</b> Activo y Vigente<br>La placa física cumple con los distintivos de seguridad. No se registran duplicados sospechosos en el sistema central.",
                'foto_pit': "<b>Entidad:</b> MTC / Foto Pit<br><b>Estado:</b> Sin Capturas<br>La verificación por medios electrónicos (fotopapeletas) no arroja infracciones pendientes de pago.",
                'soat': "<b>Entidad:</b> APESEG / SBS<br><b>Estado:</b> VIGENTE<br>Póliza de Seguro Obligatorio validada. El vehículo cuenta con cobertura activa contra accidentes de tránsito.",
                'sutran': "<b>Entidad:</b> SUTRAN<br><b>Estado:</b> Sin Sanciones<br>No se registran infracciones al Reglamento Nacional de Transportes en las rutas fiscalizadas a nivel nacional.",
                'fise': "<b>Programa:</b> FISE GNV<br><b>Estado:</b> Sin Deudas<br>El vehículo no presenta saldos pendientes ni afectaciones por el programa de ahorro energético.",
                'gnv': "<b>Estado:</b> Consulta de Financiamiento<br>Verificación de bonos y créditos de gas natural completada. Unidad libre de compromisos financieros por conversión.",
                'boleta': "<b>Documento:</b> Boleta Informativa<br><b>Estado:</b> Limpio<br>Se confirma la inexistencia de afectaciones en la partida registral actual del vehículo.",
                'tive': "<b>Documento:</b> TIVE Digital<br><b>Estado:</b> Validado<br>La Tarjeta de Identificación Vehicular Electrónica se encuentra vinculada correctamente al propietario actual.",
                'propietarios': "<b>Análisis:</b> Propietarios Anteriores<br>Se ha revisado el historial de dueños anteriores. Todos los traspasos cumplen con la formalidad legal requerida.",
                'record': "<b>Entidad:</b> MTC<br><b>Estado:</b> Récord Límpido<br>El historial del conductor asociado y del vehículo no registra puntos negativos ni sanciones graves acumuladas.",
                'otros': "<b>Estado:</b> Verificación Integral<br>No se han detectado limitaciones adicionales, deudas por arbitrios ni afectaciones administrativas externas."
            };

            if (templates[catId]) {
                editor.innerHTML = templates[catId];
            } else {
                text = text.replace(/(Fecha|Consulta|Impresión)\s*:\s*.*?\n?/gi, '');
                var placaMatch = text.match(/([A-Z0-9]{3}-?[A-Z0-9]{3})/i);
                var placa = placaMatch ? placaMatch[0].toUpperCase() : 'ABC-123';
                editor.innerHTML = '<b>Documento:</b> Verificado<br><b>Resultado:</b> Sin Observaciones<br>Todo se encuentra en regla para la placa ' + placa + '.';
            }
            syncLiveProgress();
        }

        function triggerFileUpload(id) { document.getElementById('file-' + id).click(); }
        function handleDragOver(e, el) { e.preventDefault(); el.classList.add('dragover'); }
        function handleDragLeave(e, el) { el.classList.remove('dragover'); }
        function handleDrop(e, id) { e.preventDefault(); handleFileChange({ target: { files: e.dataTransfer.files } }, id); }
        function handleFileChange(e, id) {
            Array.from(e.target.files).forEach(file => {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const card = document.getElementById('card-' + id);
                    let files = JSON.parse(card.getAttribute('data-files') || '[]');

                    if (file.type.startsWith('image/')) {
                        const img = new Image();
                        img.onload = () => {
                            const canvas = document.createElement('canvas');
                            const maxW = 1000, maxH = 1000;
                            let w = img.width;
                            let h = img.height;
                            if (w > maxW || h > maxH) {
                                if (w > h) { h *= maxW / w; w = maxW; }
                                else { w *= maxH / h; h = maxH; }
                            }
                            canvas.width = w; canvas.height = h;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0, w, h);
                            const compressedData = canvas.toDataURL('image/jpeg', 0.6); // Compressive algorithm

                            files.push({ name: file.name, type: 'img', data: compressedData });
                            card.setAttribute('data-files', JSON.stringify(files));
                            updateFileUI(id);
                        };
                        img.src = ev.target.result;
                    } else {
                        if (file.size > 2 * 1024 * 1024) alert("Advertencia: El PDF " + file.name + " es pesado. Considere optimizar su tamaño.");
                        files.push({ name: file.name, type: 'pdf', data: ev.target.result });
                        card.setAttribute('data-files', JSON.stringify(files));
                        updateFileUI(id);
                    }
                };
                reader.readAsDataURL(file);
            });
        }

        function updateFileUI(id) {
            const card = document.getElementById('card-' + id);
            const list = document.getElementById('fileList-' + id);
            const badge = document.getElementById('badge-' + id);
            const files = JSON.parse(card.getAttribute('data-files') || '[]');
            badge.textContent = files.length;
            if (files.length > 0) {
                badge.classList.add('visible');
            } else {
                badge.classList.remove('visible');
            }
            list.innerHTML = files.map((f, idx) => `
                <div class="file-item-mini">
                    <div class="btn-remove-mini" onclick="removeFile('${id}', ${idx})"><i class="fa-solid fa-xmark"></i></div>
                    ${f.type === 'img' ? `<img src="${f.data}" alt="p">` : `<div class="file-icon"><i class="fa-solid fa-file-pdf"></i></div>`}
                </div>`).join('');
        }

        function removeFile(id, index) {
            const card = document.getElementById('card-' + id);
            let files = JSON.parse(card.getAttribute('data-files') || '[]');
            files.splice(index, 1);
            card.setAttribute('data-files', JSON.stringify(files));
            updateFileUI(id);
        }

        async function saveReport() {
            try {
                const plate = normalize(document.getElementById('targetPlate').value);
                if (!plate) return alert("⚠️ Error: Ingresa un número de placa válido.");


                const items = Array.from(document.querySelectorAll('.admin-card[id^="card-"]')).map(card => {
                    const id = card.id.replace('card-', '');
                    const files = JSON.parse(card.getAttribute('data-files') || '[]');
                    const activeDot = card.querySelector('.status-dot-btn.active');
                    const status = activeDot ? activeDot.dataset.status : 'ok';

                    const catData = categories.find(c => c.id === id);
                    return {
                        id,
                        icon: catData ? catData.icon : "fa-file-shield",
                        title: catData ? catData.title : "CATEGORÍA",
                        text: (card.querySelector('.rich-editor') || {}).innerHTML || '',
                        st: status,
                        files: files,
                        file: files.length > 0 ? files[0].data : ""
                    };
                });

                const globalActiveDot = document.querySelector('#globalStatus .status-dot-btn.active');
                const globalStatus = globalActiveDot ? globalActiveDot.dataset.status : 'ok';

                const report = {
                    placa: plate,
                    date: document.getElementById('reportDate').value,
                    publishedAt: Date.now(), // Marca para expiración de 24h
                    verdictStatus: globalStatus,
                    verdictText: document.getElementById('verdictText').value,
                    items
                };

                await saveReportDB('report_' + plate, report);

                // Marcar como completamente desbloqueado para persistencia en el dispositivo
                localStorage.setItem('report_unlocked_' + plate, 'true');
                localStorage.setItem('approved_request_' + plate, 'true');
                localStorage.setItem('progress_' + plate, '100');
                localStorage.removeItem('pending_request_' + plate);

                if (window.sb) {
                    try {
                        const publishedAt = Date.now();
                        const { data: allRows } = await window.sb.from('solicitudes').select('placa, datos');
                        const samePlate = (allRows || []).filter(
                            (r) => r && r.placa && normalize(String(r.placa)) === plate
                        );

                        let datos = {
                            placa: plate,
                            status: 'approved',
                            publishedAt,
                            timestamp: publishedAt
                        };
                        samePlate.forEach((r) => {
                            if (r.datos && typeof r.datos === 'object') {
                                datos = Object.assign({}, datos, r.datos, {
                                    placa: plate,
                                    status: 'approved',
                                    publishedAt,
                                    timestamp: r.datos.timestamp || datos.timestamp
                                });
                            }
                        });

                        // Guardar metadata del reporte (texto sin imágenes para no exceder límite)
                        datos.reportMeta = {
                            verdictStatus: globalStatus,
                            verdictText: document.getElementById('verdictText').value,
                            date: document.getElementById('reportDate').value,
                            items: items.map(i => ({ id: i.id, title: i.title, text: i.text, st: i.st, icon: i.icon, files: i.files || [] }))
                        };

                        // Si las evidencias son muy pesadas, guardar sin files en reportMeta
                        var reportMetaStr = JSON.stringify(datos.reportMeta);
                        if (reportMetaStr.length > 500000) {
                            datos.reportMeta.items = items.map(i => ({ id: i.id, title: i.title, text: i.text, st: i.st, icon: i.icon }));
                        }

                        await window.sb.from('solicitudes').upsert(
                            { placa: plate, datos, updated_at: new Date() },
                            { onConflict: 'placa' }
                        );

                        // Guardar reporte completo con evidencias en tabla 'informes'
                        try {
                            await window.sb.from('informes').upsert({
                                placa: plate,
                                datos: {
                                    placa: plate,
                                    verdictStatus: globalStatus,
                                    verdictText: document.getElementById('verdictText').value,
                                    date: document.getElementById('reportDate').value,
                                    publishedAt: publishedAt,
                                    items: items
                                },
                                updated_at: new Date()
                            }, { onConflict: 'placa' });
                        } catch(eInf) {}

                        const placasBorrar = samePlate
                            .map((r) => r.placa)
                            .filter((p) => p && String(p) !== String(plate));
                        if (placasBorrar.length) {
                            await window.sb.from('solicitudes').delete().in('placa', placasBorrar);
                        }
                    } catch (e) {
                        console.error("Error sincronizando estado al publicar:", e);
                    }
                }

                alert(`🚀 ¡ÉXITO! El reporte de la placa ${plate} ha sido publicado y está disponible para el cliente.`);
                if (typeof renderRequestsList === 'function') await renderRequestsList();
                try {
                    const n = await countPendingSolicitudesCloud();
                    if (typeof updateBadgesCount === 'function') updateBadgesCount(n);
                } catch (e) {}
                if (typeof showView === 'function') {
                    showView('history');
                    if (typeof toggleSidebar === 'function') toggleSidebar(false);
                }
            } catch (error) {
                console.error("Fallo crítico en saveReport:", error);
                if (error.name === 'QuotaExceededError') {
                    alert("❌ ERROR: Almacenamiento lleno. Por favor, reduce el tamaño de las fotos o elimina reportes antiguos.");
                } else {
                    alert("❌ ERROR AL PUBLICAR: Verifica que todos los campos estén llenos correctamente.");
                }
            }
        }

        function syncLiveProgress() {
            const plate = normalize(document.getElementById('targetPlate').value);
            if (!plate) return;

            // Contar cuántos campos tienen contenido real
            let filled = 0;
            if (document.getElementById('verdictText').value.trim().length > 15) filled++;

            document.querySelectorAll('.admin-card .rich-editor').forEach(function(ed) {
                if (ed.innerText.trim().length > 25) filled++;
            });

            // Calcular porcentaje (máximo 99% hasta que publique)
            let totalFields = categories.length + 1;
            let pct = Math.min(99, Math.max(15, Math.floor((filled / totalFields) * 100) + 15));

            localStorage.setItem('progress_' + plate, pct);
            // Pequeña notificación visual en el admin
        }

        async function clearAllData() {
            if (!confirm("¿Limpiar todo el sistema? (Se borrará todo de la PC y de la Nube)")) return;
            Object.keys(localStorage).forEach(k => { if (k.startsWith('report_') || k.startsWith('pending_') || k.startsWith('approved_') || k.startsWith('progress_') || k === 'last_pending_plate') localStorage.removeItem(k); });
            try {
                const db = await initDB();
                const tx = db.transaction(STORE_NAME, 'readwrite');
                tx.objectStore(STORE_NAME).clear();

                // 🌟 Borrado Maestro en la Nube (Supabase)
                if (window.sb) {
                    await window.sb.from('solicitudes').delete().neq('placa', '---');
                    // También podrías limpiar 'informes' si lo deseas, pero 'solicitudes' limpia el flujo pendiente.
                }
            } catch (e) { }
            location.reload();
        }


        async function renderRequestsList() {
            const list = document.getElementById('requestsList');
            if (!list) return;

            let reqs = [];

            // 1. Cargar desde la Nube (Supabase) con límite
            if (window.sb) {
                try {
                    const { data, error } = await window.sb
                        .from('solicitudes')
                        .select('datos')
                        .order('updated_at', { ascending: false })
                        .limit(200);
                    if (error) throw error;
                    if (data) {
                        reqs = data.map(d => d.datos).filter(r => r && r.placa);
                    }
                } catch (e) { 
                    console.error("Error cargando solicitudes de nube:", e);
                    list.innerHTML = '<div class="empty-req" style="color: #ef4444; font-size: 14px; text-align: center; padding: 20px;">❌ Error al cargar solicitudes: ' + esc(e.message) + '</div>';
                    return;
                }
            }

            // 🌟 Removido fallback local de solicitudes para Cloud-Sync puro

            if (!reqs.length) {
                return list.innerHTML = '<div class="empty-req" style="color: #64748b; font-size: 14px; text-align: center; padding: 20px;">No hay solicitudes.</div>';
            }
            
            const approvedNorm = new Set();
            reqs.forEach((r) => {
                if (r && r.placa && solicitudEstadoAprobado(r)) approvedNorm.add(normalize(String(r.placa)));
            });

            const pendingCandidates = reqs.filter((req) => {
                if (!req || !req.placa) return false;
                // Registros de cuenta van al historial, no a pendientes
                if (req.isRegistro) return false;
                if (solicitudEstadoAprobado(req)) return false;
                if (approvedNorm.has(normalize(String(req.placa)))) return false;
                return true;
            });

            const byNorm = new Map();
            pendingCandidates.forEach((req) => {
                const n = normalize(String(req.placa));
                const prev = byNorm.get(n);
                if (!prev || (req.timestamp || 0) > (prev.timestamp || 0)) byNorm.set(n, req);
            });
            const pendingReqs = Array.from(byNorm.values());

            if (!pendingReqs.length) {
                return list.innerHTML = '<div class="empty-req" style="color: #64748b; font-size: 14px; text-align: center; padding: 20px;">No hay solicitudes pendientes.</div>';
            }

            // Vincular WhatsApp desde Solicitudes de Registro previas
            pendingReqs.forEach(r => {
                if (!r.whatsapp && r.email) {
                    const match = reqs.find(all => all.isRegistro && all.email === r.email && all.whatsapp);
                    if (match) r.whatsapp = match.whatsapp;
                }
            });
            list.innerHTML = pendingReqs.map(req => {
                const normP = normalize(req.placa);
                const voucherContent = req.voucher ? `
                    <div style="margin-top: 10px;">
                        <img src="${escAttr(req.voucher)}" onclick="viewVoucher('${escAttr(req.voucher)}', '${req.isRecharge ? escAttr(req.email || '?') : escAttr(req.placa)}', ${req.isRecharge || req.isDashboard})" style="width: 100px; height: 130px; object-fit: cover; border-radius: 8px; border: 2px solid #cbd5e1; cursor: pointer;" title="Ampliar">
                    </div>` : ``;

                let dName = esc(req.placa);
                let dIcon = `fa-car`;
                let dType = `Consulta Placa`;
                let dSubtitle = ``;

                if (req.isActivacion) {
                    dName = `Activación de Plataforma Digital`;
                    dIcon = `fa-rocket`;
                    dType = `Activación`;
                    dSubtitle = `<b>Servicio:</b> Activación de cuenta<br><b>Email:</b> ${esc(req.email || '?')}`;
                    if (req.whatsapp) dSubtitle += `<br><b>WhatsApp:</b> ${esc(req.whatsapp)}`;
                } else if (req.isRecharge) {
                    dName = `Recarga de Créditos (+${req.credits || 0})`;
                    dIcon = `fa-wallet`;
                    dType = `Recarga`;
                    dSubtitle = `<b>Servicio:</b> Recarga de créditos<br><b>Cantidad:</b> +${req.credits || 0} créditos<br><b>Email:</b> ${esc(req.email || '?')}`;
                } else if (req.isDashboard) {
                    dName = `Acceso al Dashboard`;
                    dIcon = `fa-table-columns`;
                    dType = `Dashboard`;
                    dSubtitle = `<b>Servicio:</b> Dashboard digital<br><b>Email:</b> ${esc(req.email || '?')}`;
                    if (req.whatsapp) dSubtitle += `<br><b>WhatsApp:</b> ${esc(req.whatsapp)}`;
                } else if (req.isIndividual) {
                    dName = esc(req.servicio || `Consulta Individual`);
                    dIcon = `fa-file-lines`;
                    dType = `Individual`;
                    dSubtitle = `<b>Servicio:</b> ${esc(req.servicio || 'Consulta')}<br><b>Placa:</b> ${esc(req.placa)}<br><b>Email:</b> ${esc(req.email || '?')}`;
                    if (req.nombre) dSubtitle = `<b>Cliente:</b> ${esc(req.nombre)}<br>` + dSubtitle;
                    if (req.whatsapp) dSubtitle += `<br><b>WhatsApp:</b> ${esc(req.whatsapp)}`;
                } else if (req.isRegistro) {
                    dName = esc(req.nombre || 'Nuevo Usuario');
                    dIcon = `fa-user-plus`;
                    dType = `Registro`;
                    dSubtitle = `<b>Nombre:</b> ${esc(req.nombre || '?')}<br><b>Email:</b> ${esc(req.email || '?')}`;
                    if (req.whatsapp) dSubtitle += `<br><b>WhatsApp:</b> ${esc(req.whatsapp)}`;
                } else {
                    dName = esc(req.servicio || 'Filtro Vehicular Completo') + ` (${esc(req.placa)})`;
                    dIcon = `fa-car`;
                    dType = `Filtro`;
                    dSubtitle = `<b>Servicio:</b> ${esc(req.servicio || 'Filtro Vehicular Completo')}<br><b>Placa:</b> ${esc(req.placa)}<br><b>Email:</b> ${esc(req.email || 'Anónimo')}`;
                    if (req.nombre) dSubtitle = `<b>Cliente:</b> ${esc(req.nombre)}<br>` + dSubtitle;
                    if (req.whatsapp) dSubtitle += `<br><b>WhatsApp:</b> ${esc(req.whatsapp)}`;
                }

                let actionBtn = '';
                if (req.isActivacion) {
                    actionBtn = `<button class="btn-req btn-confirm-pay" onclick="confirmActivacion('${escAttr(req.placa)}', '${escAttr(req.email || '')}', '${escAttr(req.whatsapp || '')}')"><i class="fa-solid fa-rocket"></i> Activar</button>`;
                } else if (req.isRecharge) {
                    actionBtn = `<button class="btn-req btn-confirm-pay" onclick="confirmRecharge('${escAttr(normP)}', '${escAttr(req.email || '')}', ${req.credits || 0})"><i class="fa-solid fa-bolt"></i> Validar</button>`;
                } else if (req.isDashboard) {
                    const msgText = `🎉 *¡Felicitaciones!*\n\nTu acceso al *Dashboard* en *Filtro Vehicular Plus* ya se encuentra *ACTIVO*.\n\n✅ Ya puedes ingresar a la plataforma y revisar todos tus expedientes en tiempo real.\n\n🔗 *Link de acceso:*\nhttps://filtrovehicularperu.com\n\n📞 ¿Necesitas ayuda? Contáctanos.`;
                    if (req.whatsapp) {
                        const wppUrl = `https://wa.me/51${req.whatsapp}?text=${encodeURIComponent(msgText)}`;
                        const clickHandler = `if(confirm('¿Activar Dashboard permanente para ${escAttr(req.email)}?')) { window.open('${escAttr(wppUrl)}', '_blank'); confirmDashboardActivation('${escAttr(req.placa)}', '${escAttr(req.email || '')}'); }`;
                        actionBtn = `<a href="javascript:void(0)" class="btn-req btn-confirm-pay" style="text-decoration:none;" onclick="${clickHandler}"><i class="fa-solid fa-bolt"></i> Activar</a>`;
                    } else {
                        const wppLink = `javascript:var p = prompt('Ingresa el WhatsApp del cliente (Ej: 987654321):'); if(p) { window.open('https://wa.me/51'+p+'?text='+encodeURIComponent(\`${msgText}\`), '_blank'); confirmDashboardActivation('${escAttr(req.placa)}', '${escAttr(req.email || '')}'); }`;
                        actionBtn = `<a href="${wppLink}" class="btn-req btn-confirm-pay" style="text-decoration:none;"><i class="fa-solid fa-bolt"></i> Activar</a>`;
                    }
                } else if (req.isIndividual) {
                    actionBtn = `<button class="btn-req btn-confirm-pay" onclick="approveRequest('${escAttr(req.placa)}')"><i class="fa-solid fa-file-pen"></i> Redactar</button>`;
                } else if (req.isRegistro) {
                    // Registros se aprueban automáticamente — solo mostrar info
                    actionBtn = `<span style="display:inline-flex; align-items:center; gap:4px; padding:6px 12px; background:#ecfdf5; color:#059669; border-radius:8px; font-size:11px; font-weight:700;"><i class="fa-solid fa-circle-check" style="font-size:10px;"></i> Auto-aprobado</span>`;
                } else {
                    actionBtn = `<button class="btn-req btn-confirm-pay" onclick="confirmPayment('${escAttr(normP)}')"><i class="fa-solid fa-check"></i> Confirmar</button>`;
                }

                const timestamp = req.timestamp ? new Date(req.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '---';

                return `
                <div class="request-item" style="padding:14px 16px; gap:6px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="background:linear-gradient(135deg,#111b21,#1f2c34); color:white; width:36px; height:36px; min-width:36px; display:flex; align-items:center; justify-content:center; border-radius:8px; font-size:14px; flex-shrink:0;">
                            <i class="fa-solid ${dIcon}"></i>
                        </div>
                        <div style="flex:1; min-width:0;">
                            <div style="font-size:13px; font-weight:800; color:#111b21; margin-bottom:2px;">${dName}</div>
                            <div style="font-size:11px; color:#64748b; line-height:1.4;">${dSubtitle}</div>
                        </div>
                        <div style="display:flex; flex-shrink:0;">${actionBtn}</div>
                    </div>
                    <div style="font-size:9px; color:#94a3b8; display:flex; align-items:center; gap:3px; padding-left:46px;"><i class="fa-regular fa-clock" style="font-size:8px;"></i> ${timestamp}</div>
                    ${voucherContent}
                </div>`;
            }).join('');
        }

        var _historyAllItems = []; // Cache para filtro de búsqueda

        function filtrarHistorial() {
            var input = document.getElementById('historySearchInput');
            var term = (input ? input.value : '').trim().toLowerCase();
            var list = document.getElementById('historyList');
            if (!list) return;
            var items = list.children;
            for (var i = 0; i < items.length; i++) {
                if (!term) { items[i].style.display = ''; continue; }
                var text = items[i].textContent.toLowerCase();
                items[i].style.display = text.includes(term) ? '' : 'none';
            }
        }

        function filtrarUsuarios() {
            var input = document.getElementById('usersSearchInput');
            var term = (input ? input.value : '').trim().toLowerCase();
            var list = document.getElementById('usersList');
            if (!list) return;
            var items = list.children;
            for (var i = 0; i < items.length; i++) {
                if (!term) { items[i].style.display = ''; continue; }
                var text = items[i].textContent.toLowerCase();
                items[i].style.display = text.includes(term) ? '' : 'none';
            }
        }

        async function renderHistoryList() {
            const list = document.getElementById('historyList');
            if (!list) return;

            let reqs = [];
            if (window.sb) {
                try {
                    const { data, error } = await window.sb
                        .from('solicitudes')
                        .select('datos')
                        .order('updated_at', { ascending: false })
                        .limit(200);
                    if (error) throw error;
                    if (data) {
                        reqs = data.map(d => d.datos).filter(r => r && r.placa);
                    }
                } catch (e) { 
                    console.error("Error cargando historial de nube:", e);
                    list.innerHTML = '<div class="empty-req" style="color: #ef4444; font-size: 14px; text-align: center; padding: 20px;">❌ Error al cargar historial: ' + esc(e.message) + '</div>';
                    return;
                }
            }

            // 🌟 Removido fallback local de historial para Cloud-Sync puro

            const approvedReqs = reqs.filter((req) => {
                if (!req || !req.placa) return false;
                return solicitudEstadoAprobado(req);
            });

            // Separar: con reporte primero, sin reporte después
            const withReport = [];
            const withoutReport = [];
            approvedReqs.forEach(req => {
                if (req.isRecharge || req.isDashboard || req.isRegistro) {
                    withoutReport.push(req);
                } else {
                    withReport.push(req);
                }
            });

            // Dentro de cada grupo, más reciente primero
            const sortByTime = (a, b) => (b.publishedAt || b.timestamp || 0) - (a.publishedAt || a.timestamp || 0);
            withReport.sort(sortByTime);
            withoutReport.sort(sortByTime);

            const sortedReqs = withReport.concat(withoutReport);

            if (!sortedReqs.length) {
                return list.innerHTML = '<div class="empty-req" style="color: #64748b; font-size: 14px; text-align: center; padding: 20px;">No hay historial disponible.</div>';
            }

            list.innerHTML = sortedReqs.map(req => {
                const normP = normalize(req.placa);
                let dName = `Filtro Completo (Placa ${esc(req.placa)})`;
                let dIcon = `fa-car`;
                let dSubtitle = `<b>Usuario:</b> ${esc(req.email || 'Anónimo')}`;
                let isReport = true;
                const hasReportMeta = !!(req.reportMeta || req.publishedAt);

                if (req.isRecharge) {
                    dName = `Recarga de Créditos`;
                    dIcon = `fa-wallet`;
                    dSubtitle = `${esc(req.email || '?')}<br>+${req.credits || 0} créditos`;
                    isReport = false;
                } else if (req.isDashboard) {
                    dName = `Dashboard`;
                    dIcon = `fa-table-columns`;
                    dSubtitle = `${esc(req.email || '?')}`;
                    isReport = false;
                } else if (req.isIndividual) {
                    dName = esc(req.servicio || `Consulta Individual`);
                    dIcon = `fa-file-lines`;
                    dSubtitle = `${esc(req.email || '?')}<br>Placa: <b>${esc(req.placa)}</b>`;
                } else if (req.isRegistro) {
                    dName = esc(req.nombre || 'Nuevo Usuario');
                    dIcon = `fa-user-plus`;
                    dSubtitle = `${esc(req.email || '?')}`;
                    if (req.whatsapp) dSubtitle += `<br>${esc(req.whatsapp)}`;
                    isReport = false;
                }

                const tsHist = req.publishedAt || req.timestamp;
                const timestamp = tsHist
                    ? new Date(tsHist).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                    : '---';

                // Botones de acción para reportes
                let actionsHTML = '';
                if (isReport) {
                    actionsHTML = `
                        <div style="display:flex; gap:6px; padding-left:46px; margin-top:6px;">
                            <button onclick="event.stopPropagation(); imprimirDesdeHistorial('${escAttr(normP)}')" style="display:flex; align-items:center; gap:5px; padding:6px 12px; background:#ef4444; color:#fff; border:none; border-radius:7px; font-size:11px; font-weight:700; cursor:pointer; transition:0.2s;" onmouseover="this.style.background='#dc2626'" onmouseout="this.style.background='#ef4444'">
                                <i class="fa-solid fa-file-pdf" style="font-size:12px; color:#fff;"></i> Descargar PDF
                            </button>
                            <button onclick="event.stopPropagation(); openPlateEditor('${escAttr(normP)}')" style="display:flex; align-items:center; gap:5px; padding:6px 12px; background:#f8fafc; color:#111b21; border:1px solid #e2e8f0; border-radius:7px; font-size:11px; font-weight:700; cursor:pointer; transition:0.2s;" onmouseover="this.style.borderColor='#111b21'" onmouseout="this.style.borderColor='#e2e8f0'">
                                <i class="fa-solid fa-pen-to-square" style="font-size:11px;"></i> Editar
                            </button>
                        </div>`;
                }

                // Badge de reporte disponible
                const reportBadge = (isReport && hasReportMeta)
                    ? `<span style="display:inline-flex; align-items:center; gap:3px; background:#ecfdf5; color:#059669; padding:2px 7px; border-radius:4px; font-size:9px; font-weight:700; margin-left:6px;"><i class="fa-solid fa-file-circle-check" style="font-size:8px;"></i> Reporte</span>`
                    : (isReport ? `<span style="display:inline-flex; align-items:center; gap:3px; background:#fef3c7; color:#d97706; padding:2px 7px; border-radius:4px; font-size:9px; font-weight:700; margin-left:6px;"><i class="fa-solid fa-clock" style="font-size:8px;"></i> Pendiente</span>` : '');

                return `
                <div class="request-item" style="padding:14px 16px; gap:4px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="background:linear-gradient(135deg,#111b21,#1f2c34); color:white; width:38px; height:38px; min-width:38px; display:flex; align-items:center; justify-content:center; border-radius:10px; font-size:15px; flex-shrink:0;">
                            <i class="fa-solid ${dIcon}"></i>
                        </div>
                        <div style="flex:1; min-width:0;">
                            <div style="display:flex; align-items:center; flex-wrap:wrap;">
                                <span style="font-size:13px; font-weight:800; color:#111b21;">${dName}</span>
                                ${reportBadge}
                            </div>
                            <div style="font-size:11px; color:#64748b; line-height:1.4; margin-top:2px;">${dSubtitle}</div>
                        </div>
                        <span style="color:#25d366; font-size:16px; flex-shrink:0;" title="Aprobado"><i class="fa-solid fa-circle-check"></i></span>
                    </div>
                    ${actionsHTML}
                    <div style="font-size:9px; color:#94a3b8; display:flex; align-items:center; gap:3px; padding-left:48px; margin-top:4px;"><i class="fa-regular fa-clock" style="font-size:8px;"></i> ${timestamp}</div>
                </div>`;
            }).join('');
        }

        async function confirmRecharge(normP, email, credits) {
            document.getElementById('creditEmail').value = email;
            const select = document.getElementById('creditAmount');
            let found = false;
            for(let i=0; i<select.options.length; i++) {
                if(select.options[i].value == credits) { select.selectedIndex = i; found = true; break; }
            }
            if(!found) select.innerHTML += `<option value="${credits}" selected>+ ${credits} Créditos Custom</option>`;
            
            await addCredits(); // Agrega créditos
            localStorage.setItem('approved_request_' + normP, 'true');

            // --- ACTUALIZAR EN SUPABASE NUESTRA SOLICITUD A APPROVED ---
            if (window.sb) {
                try {
                    // Buscar la recarga específica por placa exacta
                    const { data: reqData } = await window.sb.from('solicitudes').select('datos').eq('placa', normP).single();
                    if (reqData && reqData.datos && reqData.datos.status !== 'approved') {
                        reqData.datos.status = 'approved';
                        await window.sb.from('solicitudes').update({ datos: reqData.datos, updated_at: new Date() }).eq('placa', normP);
                    }
                } catch(e) { console.error("Error confirmando carga de recarga:", e); }
            }

            renderRequestsList();
            renderHistoryList();
            if (typeof renderUsersList === 'function') renderUsersList();
        }

        async function confirmActivacion(placaId, email, whatsapp) {
            try {
                if (!window.sb) throw new Error("Supabase no conectado.");

                const safeEmail = String(email || '').trim().toLowerCase();
                if (!safeEmail) throw new Error("Email inválido para activar plataforma.");

                // Actualizar o crear registro en saldos con plataforma_activa = true
                const { data: existingSaldo, error: selErr } = await window.sb
                    .from('saldos')
                    .select('*')
                    .eq('email', safeEmail)
                    .maybeSingle();

                if (selErr) throw selErr;

                if (existingSaldo) {
                    const { error: updErr } = await window.sb
                        .from('saldos')
                        .update({ plataforma_activa: true, updated_at: new Date() })
                        .eq('email', safeEmail);
                    if (updErr) throw updErr;
                } else {
                    const { error: insErr } = await window.sb
                        .from('saldos')
                        .insert({ email: safeEmail, creditos: 0, plataforma_activa: true, dashboard_activo: false, updated_at: new Date() });
                    if (insErr) throw insErr;
                }

                // Marcar solicitud como aprobada (leer primero para no sobrescribir datos)
                if (window.sb) {
                    const { data: existingReq } = await window.sb
                        .from('solicitudes')
                        .select('datos')
                        .eq('placa', placaId)
                        .single();
                    
                    if (existingReq && existingReq.datos) {
                        existingReq.datos.status = 'approved';
                        await window.sb.from('solicitudes')
                            .update({ datos: existingReq.datos, updated_at: new Date() })
                            .eq('placa', placaId);
                    }
                }

                localStorage.setItem('approved_request_' + placaId, 'true');
                
                // Generar mensaje de WhatsApp
                const msgText = `Hola, tu *Plataforma Completa* en *Filtro Vehicular Plus* ya se encuentra *ACTIVA*. 🚀

Ya tienes acceso a:
✅ Categorías (22 servicios)
✅ Dashboard organizado
✅ Historial de consultas

Link: https://filtrovehicularperu.com`;
                
                // Abrir WhatsApp con mensaje
                const safeWhatsapp = String(whatsapp || '').trim();
                const wppUrl = `https://wa.me/51${safeWhatsapp}?text=${encodeURIComponent(msgText)}`;
                window.open(wppUrl, '_blank');
                
                alert(`✅ Plataforma activada con éxito para ${safeEmail}.\n\nEl usuario ahora tiene acceso completo a Categorías y Dashboard.`);
                
                // Actualizar listas
                renderRequestsList();
                if (typeof renderHistoryList === 'function') renderHistoryList();

            } catch(e) {
                alert("❌ Error: No se pudo activar la Plataforma.\n\n" + e.message);
                console.error("Error en confirmActivacion:", e);
            }
        }

        async function confirmDashboardActivation(placaId, email) {
            try {
                if (!window.sb) throw new Error("Supabase no conectado.");

                const safeEmail = String(email || '').trim().toLowerCase();
                if (!safeEmail) throw new Error("Email inválido para activar dashboard.");

                // Evitar choque por email único: actualizar si existe, crear si no existe.
                const { data: existingSaldo, error: selErr } = await window.sb
                    .from('saldos')
                    .select('email, creditos')
                    .eq('email', safeEmail)
                    .maybeSingle();
                if (selErr) throw selErr;

                if (existingSaldo) {
                    const { error: updErr } = await window.sb
                        .from('saldos')
                        .update({ dashboard_activo: true, updated_at: new Date() })
                        .eq('email', safeEmail);
                    if (updErr) throw updErr;
                } else {
                    const { error: insErr } = await window.sb
                        .from('saldos')
                        .insert({ email: safeEmail, creditos: 0, dashboard_activo: true, updated_at: new Date() });
                    if (insErr) throw insErr;
                }

                // Marcar solicitud como aprobada (leer primero para no sobrescribir datos)
                if (window.sb) {
                    const { data: existingReq } = await window.sb
                        .from('solicitudes')
                        .select('datos')
                        .eq('placa', placaId)
                        .single();
                    
                    if (existingReq && existingReq.datos) {
                        existingReq.datos.status = 'approved';
                        await window.sb.from('solicitudes')
                            .update({ datos: existingReq.datos, updated_at: new Date() })
                            .eq('placa', placaId);
                    }
                }

                localStorage.setItem('approved_request_' + placaId, 'true');
                renderRequestsList();
                alert(`✅ Dashboard activado con éxito para ${safeEmail}.`);

            } catch(e) {
                alert("❌ Error: No se pudo activar el Dashboard.\n\n" + e.message);
            }
        }

        function initAuthAdmin() {
            // --- AUDITORÍA DE CONEXIÓN ---
            
            try {
                if (!window.supabase) throw new Error("Guard: CDN fallido.");
            } catch (e) {
                console.error("Error en initAuthAdmin:", e);
            }
        }

        async function confirmRegistro(reqKey) {
            try {
                if (!window.sb) throw new Error("Supabase no conectado.");

                const { data, error: fetchErr } = await window.sb.from('solicitudes').select('datos').eq('placa', reqKey).single();
                
                if (fetchErr) throw fetchErr;

                if (data && data.datos) {
                    data.datos.status = 'approved';
                    const { error: upErr } = await window.sb.from('solicitudes').upsert({ placa: reqKey, datos: data.datos, updated_at: new Date() }, { onConflict: 'placa' });
                    if (upErr) throw upErr;
                    
                    // 🌟 INNOVACIÓN: Crear fila en la tabla 'saldos' para que figure en Usuarios
                    await window.sb.from('saldos').upsert({ 
                        email: data.datos.email, 
                        creditos: 0,
                        plataforma_activa: false,
                        dashboard_activo: false,
                        updated_at: new Date() 
                    }, { onConflict: 'email' });

                    alert('Usuario activado correctamente.\n\nLa cuenta ha sido aprobada y el cliente ya puede acceder a la plataforma.');
                }
                
                renderRequestsList();
                if (typeof renderHistoryList === 'function') renderHistoryList(); 
            } catch (e) {
                alert("❌ Fallo crítico al aprobar registro: " + e.message);
                console.error("Error archivando registro:", e);
            }
        }

        function viewVoucher(voucherUrl, title, isSpecial) {
            if (!voucherUrl) return;
            
            let modal = document.getElementById('voucherModal');
            if(!modal) {
                modal = document.createElement('div');
                modal.id = 'voucherModal';
                modal.className = 'modal-overlay';
                modal.style.cssText = 'z-index:99999;display:flex;';
                modal.onclick = function() { this.style.display = 'none'; };
                document.body.appendChild(modal);
            }

            let titleTxt = `Voucher: ${esc(title)}`;

            modal.innerHTML = `
                <div class="modal-card" onclick="event.stopPropagation()" style="max-width:400px;">
                    <div class="modal-header" style="padding:18px 20px 14px;position:relative;">
                        <button onclick="document.getElementById('voucherModal').style.display='none';" class="modal-close"><i class="fa-solid fa-xmark"></i></button>
                        <div class="modal-title" style="font-size:14px;">${titleTxt}</div>
                    </div>
                    <div class="modal-body" style="text-align:center;">
                        <img src="${escAttr(voucherUrl)}" style="width:100%; max-height:60vh; object-fit:contain; border-radius:12px; border:1px solid #e5e7eb;">
                        <div style="margin-top:14px; color:#6b7280; font-size:12px; font-weight:400;">Revisa el comprobante antes de validar.</div>
                    </div>
                </div>
            `;
            
            modal.style.display = 'flex';
        }


        async function openPlateEditor(placa) {
            const p = normalize(placa);
            
            // Cambiar a vista de editor
            showView('editor');
            
            // Auto-llenar la placa en el campo de entrada
            const plateInput = document.getElementById('targetPlate');
            if (plateInput) {
                plateInput.value = p;
            }
            
            // Limpiar formularios y datos previos en la UI
            const verdictTextArea = document.getElementById('verdictText');
            if (verdictTextArea) {
                verdictTextArea.value = '';
            }
            
            renderAdminCards();
            
            // Intentar cargar si ya existe un reporte guardado
            const existing = await getReportDB('report_' + p);
            if (existing) {
                loadExistingReport(existing);
            }
            
            // Scroll al formulario
            setTimeout(() => {
                const editorView = document.getElementById('editorView');
                if (editorView) {
                    editorView.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 300);
            
            syncLiveProgress();
        }

        function loadExistingReport(data) {
            document.getElementById('verdictText').value = data.verdictText || '';
            const gStatus = document.querySelector(`#globalStatus .status-dot-btn[data-status="${data.verdictStatus}"]`);
            if (gStatus) setGlobalStatus(gStatus);
            
            data.items.forEach(item => {
                const card = document.getElementById('card-' + item.id);
                if (card) {
                    var ed = card.querySelector('.rich-editor');
                    if (ed) ed.innerHTML = item.text;
                    const stDot = card.querySelector(`.status-dot-btn[data-status="${item.st}"]`);
                    if (stDot) {
                        card.querySelectorAll('.status-dot-btn').forEach(d => d.classList.remove('active'));
                        stDot.classList.add('active');
                    }
                    if (item.files) {
                        card.setAttribute('data-files', JSON.stringify(item.files));
                        updateFileUI(item.id);
                    }
                    syncRowStatus(item.id);
                }
            });
        }

        async function confirmPayment(placa) {
            const normPlaca = normalize(placa);
            localStorage.setItem('approved_request_' + normPlaca, 'true');
            if (!localStorage.getItem('progress_' + normPlaca)) {
                localStorage.setItem('progress_' + normPlaca, '15');
            }

            // Sincronizar pago en la Nube
            if (window.sb) {
                try {
                    // Buscar por placa normalizada para no perder el email del cliente
                    const { data: allRows } = await window.sb.from('solicitudes').select('placa, datos');
                    const matchRow = (allRows || []).find(r => r && r.placa && normalize(String(r.placa)) === normalize(placa));

                    if (matchRow && matchRow.datos) {
                        const updatedDatos = Object.assign({}, matchRow.datos, {
                            status: 'approved',
                            placa: normalize(placa)
                        });
                        // Upsert con placa normalizada, preservando email y demás datos
                        await window.sb.from('solicitudes').upsert({ placa: normalize(placa), datos: updatedDatos, updated_at: new Date() }, { onConflict: 'placa' });
                        // Eliminar fila con formato anterior si era diferente
                        if (String(matchRow.placa) !== normalize(placa)) {
                            await window.sb.from('solicitudes').delete().eq('placa', matchRow.placa);
                        }
                    } else {
                        // Sin solicitud previa: crear registro básico con email vacío marcado
                        const timestamp = Date.now();
                        const basicData = { placa: normalize(placa), timestamp, status: 'approved' };
                        await window.sb.from('solicitudes').upsert({ placa: normalize(placa), datos: basicData, updated_at: new Date() }, { onConflict: 'placa' });
                    }
                } catch (e) { console.error("Error sincronizando pago en nube:", e); }
            }

            renderRequestsList();
            renderHistoryList();
            
            // 🆕 ABRIR AUTOMÁTICAMENTE EL EDITOR PARA FILTROS COMPLETOS
            alert(`✅ Pago confirmado. Ahora completa el formulario para la placa ${placa}.`);
            await openPlateEditor(placa);
        }

        async function approveRequest(rawPlaca) {
            const placa = normalize(rawPlaca);
            // Para consultas individuales - reutiliza la lógica de confirmPayment
            // que ahora abre el editor automáticamente
            await confirmPayment(placa);
        }

        async function deleteRequest(rawPlaca) {
            const placa = normalize(rawPlaca);
            if (confirm(`¿Eliminar solicitud ${rawPlaca}?`)) {
                // Eliminar con llave RAW (con guiones/símbolos)
                localStorage.removeItem('pending_request_' + rawPlaca);
                localStorage.removeItem('approved_request_' + rawPlaca);
                
                // Por si acaso, eliminar con llave Normalizada
                localStorage.removeItem('pending_request_' + placa);
                localStorage.removeItem('approved_request_' + placa);

                // Sincronizar borrar en la Nube
                if (window.sb) {
                    await window.sb.from('solicitudes').delete().eq('placa', rawPlaca);
                    if (placa !== rawPlaca) {
                        await window.sb.from('solicitudes').delete().eq('placa', placa);
                    }
                }

                renderRequestsList();
                if (typeof renderHistoryList === 'function') renderHistoryList();
            }
        }

        /** Modal de confirmación reutilizable (Esc cierra, Enter confirma si el foco no está en Cancel) */
        let _adminConfirmHandler = null;
        function closeAdminConfirmModal() {
            var m = document.getElementById('adminConfirmModal');
            if (m) m.style.display = 'none';
            if (_adminConfirmHandler) {
                document.removeEventListener('keydown', _adminConfirmHandler, true);
                _adminConfirmHandler = null;
            }
        }

        function showAdminConfirmModal(opts) {
            opts = opts || {};
            var m = document.getElementById('adminConfirmModal');
            if (!m) return;
            var titleEl = document.getElementById('adminConfirmTitle');
            var msgEl = document.getElementById('adminConfirmMsg');
            var okBtn = document.getElementById('adminConfirmOk');
            var cancelBtn = document.getElementById('adminConfirmCancel');
            if (titleEl) titleEl.textContent = opts.title || 'Confirmar';
            if (msgEl) msgEl.textContent = opts.message || '';
            if (okBtn) {
                okBtn.textContent = opts.confirmLabel || 'Aceptar';
                okBtn.style.background = opts.danger ? '#dc2626' : 'var(--petrol)';
            }
            var run = function () {
                var fn = opts.onConfirm;
                closeAdminConfirmModal();
                if (typeof fn === 'function') {
                    Promise.resolve(fn()).catch(function (err) {
                        console.error(err);
                        alert('Error: ' + (err && err.message ? err.message : String(err)));
                    });
                }
            };
            if (cancelBtn) cancelBtn.onclick = function () { closeAdminConfirmModal(); };
            if (okBtn) okBtn.onclick = function () { run(); };
            m.style.display = 'flex';
            _adminConfirmHandler = function (e) {
                if (!m || m.style.display !== 'flex') return;
                if (e.key === 'Escape') {
                    e.preventDefault();
                    closeAdminConfirmModal();
                    return;
                }
                if (e.key !== 'Enter') return;
                if (e.target && e.target.tagName === 'TEXTAREA') return;
                /* Enter en botón: el navegador activa el botón; no duplicar */
                if (e.target && e.target.tagName === 'BUTTON') return;
                e.preventDefault();
                run();
            };
            document.addEventListener('keydown', _adminConfirmHandler, true);
            setTimeout(function () { if (okBtn) okBtn.focus(); }, 80);
        }

        // Verificar si una fila es protegida (no se debe borrar al limpiar pendientes/historial)
        function esFilaProtegida(datos) {
            if (!datos) return false;
            return datos.isRegistro || datos.isRecharge || datos.isActivacion || datos.isDashboard;
        }

        function promptDeleteAllRequests() {
            showAdminConfirmModal({
                title: '¿Eliminar solicitudes pendientes?',
                message: 'Solo se eliminarán las solicitudes de consultas pendientes. Los registros de usuarios, recargas y activaciones no se verán afectados.',
                confirmLabel: 'Sí, eliminar pendientes',
                danger: true,
                onConfirm: async function () {
                    if (!window.sb) { alert('Sin conexión a la nube.'); return; }
                    var listEl = document.getElementById('requestsList');
                    if (listEl) listEl.innerHTML = '<div class="empty-req">Eliminando pendientes...</div>';
                    try {
                        var res = await window.sb.from('solicitudes').select('placa, datos');
                        if (res.error) throw res.error;
                        var toDelete = [];
                        (res.data || []).forEach(function (row) {
                            if (!row.datos || !row.placa) return;
                            if (solicitudEstadoAprobado(row.datos)) return;
                            if (esFilaProtegida(row.datos)) return;
                            toDelete.push(row.placa);
                        });
                        for (var i = 0; i < toDelete.length; i++) {
                            await window.sb.from('solicitudes').delete().eq('placa', toDelete[i]);
                        }
                        if (typeof renderRequestsList === 'function') renderRequestsList();
                        alert('Se eliminaron ' + toDelete.length + ' solicitud(es) pendiente(s).');
                    } catch(e) { console.error(e); alert('Error al eliminar: ' + e.message); }
                }
            });
        }

        function promptDeleteAllHistory() {
            showAdminConfirmModal({
                title: '¿Vaciar historial?',
                message: 'Se eliminarán de la nube todas las solicitudes que aparecen como aprobadas en este historial (incluye reportes, recargas, registros, etc.). Los clientes pueden dejar de ver su historial asociado. Esta acción no se puede deshacer.',
                confirmLabel: 'Sí, vaciar historial',
                danger: true,
                onConfirm: function () {
                    return deleteAllApprovedHistory();
                }
            });
        }

        async function deleteAllApprovedHistory() {
            if (!window.sb) {
                alert('No hay conexión a la nube (Supabase).');
                return;
            }
            var listEl = document.getElementById('historyList');
            if (listEl) listEl.innerHTML = '<div class="empty-req">Eliminando registros...</div>';

            var res = await window.sb.from('solicitudes').select('placa, datos');
            if (res.error) throw res.error;

            var toDelete = [];
            var seen = new Set();
            (res.data || []).forEach(function (row) {
                var d = row.datos;
                if (!d || !row.placa) return;
                if (!solicitudEstadoAprobado(d)) return;
                // No proteger registros en historial — se pueden borrar
                if (seen.has(row.placa)) return;
                seen.add(row.placa);
                toDelete.push(row.placa);
            });

            if (!toDelete.length) {
                if (typeof renderHistoryList === 'function') renderHistoryList();
                alert('No hay registros de historial para eliminar.');
                return;
            }

            for (var i = 0; i < toDelete.length; i++) {
                var rawPlaca = toDelete[i];
                var norm = normalize(String(rawPlaca));
                try {
                    localStorage.removeItem('pending_request_' + rawPlaca);
                    localStorage.removeItem('approved_request_' + rawPlaca);
                    localStorage.removeItem('pending_request_' + norm);
                    localStorage.removeItem('approved_request_' + norm);
                } catch (e) {}
                var del = await window.sb.from('solicitudes').delete().eq('placa', rawPlaca);
            }

            // Limpiar flags de notificación y placas pendientes
            try {
                localStorage.removeItem('has_pending_notification');
                localStorage.removeItem('last_pending_plate');
            } catch (e) {}

            if (typeof renderHistoryList === 'function') renderHistoryList();
            if (typeof renderRequestsList === 'function') renderRequestsList();
            if (typeof renderUsersList === 'function') renderUsersList();
            alert('Historial vaciado: ' + toDelete.length + ' registro(s) eliminado(s) de la nube.');
        }

        function initRequestScanner() {
            // No longer creating a notifyBox for individual popups
            
            setInterval(async () => {
                if (!window.sb) return;
                
                try {
                    const { data } = await window.sb.from('solicitudes').select('datos');
                    const rows = (data || []).map((item) => item.datos).filter((d) => d && d.placa);
                    const approvedNorm = new Set();
                    rows.forEach((d) => {
                        if (solicitudEstadoAprobado(d)) approvedNorm.add(normalize(String(d.placa)));
                    });
                    const pendingNormSeen = new Set();
                    let count = 0;

                    const reqView = document.getElementById('requestsView');
                    if (reqView && reqView.offsetParent !== null) renderRequestsList();

                    rows.forEach((d) => {
                        if (d.isRegistro) return;
                        if (solicitudEstadoAprobado(d)) return;
                        const n = normalize(String(d.placa));
                        if (approvedNorm.has(n)) return;
                        if (pendingNormSeen.has(n)) return;
                        pendingNormSeen.add(n);
                        count++;

                        const key = d.placa + '_' + (d.timestamp || '');
                        if (!seenRequests.has(key)) {
                            seenRequests.add(key);
                        }

                        // Notificaciones flotantes deshabilitadas - solo usamos badge numérico
                        // if (!d.isIndividual) showNotifPlaca(d.placa, false);
                    });
                    window.isFirstScan = false;
                    updateBadgesCount(count);
                } catch (e) {
                    console.error('Fallo Scanner:', e);
                }

                // 🌟 Removido Respaldo Local para Cloud puro
            }, 4000);
        }

        const ADMIN_ALERT_MP3 = 'assets/media/truecallerm_c3121f0d5280629.mp3';
        let adminAlertAudio = null;
        let adminAudioUnlocked = false;
        let adminUnlockInProgress = false;

        function getAdminAlertAudio() {
            if (!adminAlertAudio) {
                adminAlertAudio = new Audio(ADMIN_ALERT_MP3);
                adminAlertAudio.preload = 'auto';
            }
            return adminAlertAudio;
        }

        function tryUnlockAdminAudio() {
            if (adminAudioUnlocked || adminUnlockInProgress) return;
            adminUnlockInProgress = true;
            const a = getAdminAlertAudio();
            a.volume = 0;
            a.play()
                .then(() => {
                    a.pause();
                    a.currentTime = 0;
                    a.volume = 1;
                    adminAudioUnlocked = true;
                    adminUnlockInProgress = false;
                    // Cleanup: remover listeners ya innecesarios
                    ['pointerdown', 'touchstart', 'click', 'keydown'].forEach(function (ev) {
                        document.removeEventListener(ev, tryUnlockAdminAudio, { capture: true });
                    });
                })
                .catch(() => { adminUnlockInProgress = false; });
        }

        function playAdminAlertSound() {
            if (!adminAudioUnlocked) {
                tryUnlockAdminAudio();
                return;
            }
            const a = getAdminAlertAudio();
            try {
                a.pause();
                a.currentTime = 0;
            } catch (e) {}
            a.play().catch(function (err) {
                console.warn('No se pudo reproducir sonido de alerta:', err);
            });
            try {
                if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
            } catch (e) {}
        }

        ['pointerdown', 'touchstart', 'click', 'keydown'].forEach(function (ev) {
            document.addEventListener(ev, tryUnlockAdminAudio, { capture: true, passive: true });
        });

        // Función showNotifPlaca eliminada - solo usamos badges numéricos en el menú

        // Enviar alertas automáticas (Telegram + WhatsApp) cuando hay nuevas solicitudes
        function sendNewRequestAlerts(count) {
            var msg = '🔔 *Nueva solicitud recibida*\n\nTienes ' + count + ' solicitud(es) pendiente(s) en Filtro Vehicular Plus.\n\nRevisa tu panel de administración.';

            // Telegram
            var token = localStorage.getItem('telegram_token');
            var chatId = localStorage.getItem('telegram_chatid');
            if (token && chatId) {
                fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'Markdown' })
                }).catch(function (err) {
                    console.warn('Error enviando alerta Telegram:', err);
                });
            }

            // WhatsApp (CallMeBot)
            sendWhatsAppNotification(msg);
        }

        let lastRequestsCount = 0;

        // --- ALERTA TELEGRAM TRACKING ---
        let seenRequests = new Set();
        window.isFirstScan = true; 

        function saveTelegramSettings() {
            const token = document.getElementById('tgToken').value.trim();
            const id = document.getElementById('tgChatId').value.trim();
            if (!token || !id) return alert("Ingresa tanto el Token como el Chat ID.");
            localStorage.setItem('telegram_token', token);
            localStorage.setItem('telegram_chatid', id);
            alert("Configuración de Telegram guardada con éxito.");
        }

        async function testTelegram() {
            const token = localStorage.getItem('telegram_token');
            const chatId = localStorage.getItem('telegram_chatid');
            if (!token || !chatId) return alert("Guarda tu Token y Chat ID primero.");

            try {
                const url = `https://api.telegram.org/bot${token}/sendMessage`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: chatId, text: "🔔 ¡Prueba de Alerta Exitosa de Filtro Vehicular Plus!" })
                });
                const d = await res.json();
                if (d.ok) {
                     alert("✅ ¡ÉXITO! Mensaje de prueba enviado a tu Telegram.");
                } else {
                     alert("❌ ERROR DE TELEGRAM: " + d.description + "\n\nSolución: Recuerda buscar a tu bot en Telegram y darle a INICIAR.");
                }
            } catch (e) { alert("❌ Error de Conexión: " + e.message); }
        }

        // Función para guardar enlace del grupo de WhatsApp
        function saveWhatsAppGroupLink() {
            const link = document.getElementById('whatsappGroupLink').value.trim();
            if (!link) return alert("Ingresa el enlace del grupo de WhatsApp.");
            
            // Validar que sea un enlace válido de WhatsApp
            if (!link.includes('chat.whatsapp.com/') && !link.includes('wa.me/')) {
                return alert("❌ Enlace inválido. Debe ser un enlace de grupo de WhatsApp (https://chat.whatsapp.com/XXXXX)");
            }
            
            localStorage.setItem('whatsapp_group_link', link);
            alert("✅ Enlace del grupo de WhatsApp guardado exitosamente.\n\nLos nuevos usuarios serán invitados automáticamente al grupo después de registrarse.");
        }

        // Función para obtener el enlace del grupo de WhatsApp
        function getWhatsAppGroupLink() {
            return localStorage.getItem('whatsapp_group_link') || '';
        }

        // Función para guardar configuración de notificaciones WhatsApp personal
        function saveWhatsAppNotifications() {
            var phoneEl = document.getElementById('whatsappPersonalNumber');
            var apiKeyEl = document.getElementById('whatsappApiKey');
            if (!phoneEl || !apiKeyEl) return;
            let phone = phoneEl.value.trim();
            const apiKey = apiKeyEl.value.trim();
            
            if (!phone || !apiKey) {
                return alert("❌ Ingresa tu número de WhatsApp y API Key.\n\nSigue las instrucciones en el enlace de abajo para obtener tu API Key.");
            }
            
            // Validar que tenga al menos 10 dígitos
            const phoneDigits = phone.replace(/\D/g, '');
            if (phoneDigits.length < 10) {
                return alert("❌ Número inválido. Debe tener al menos 10 dígitos.\n\nEjemplo: 51987654321 o +51987654321");
            }
            
            // Guardar sin el símbolo + (CallMeBot lo requiere así)
            const cleanPhone = phone.replace('+', '');
            localStorage.setItem('whatsapp_personal_number', cleanPhone);
            localStorage.setItem('whatsapp_api_key', apiKey);
            alert("✅ Configuración de notificaciones WhatsApp guardada exitosamente.\n\nRecibirás alertas automáticas cuando haya nuevos pendientes.");
        }

        // Función para enviar notificación de WhatsApp vía CallMeBot
        function sendWhatsAppNotification(message) {
            const phone = localStorage.getItem('whatsapp_personal_number');
            const apiKey = localStorage.getItem('whatsapp_api_key');
            
            if (!phone || !apiKey) return; // No enviar si no está configurado
            
            try {
                // CallMeBot API endpoint
                const phoneClean = phone.replace('+', '');
                const encodedMessage = encodeURIComponent(message);
                const url = `https://api.callmebot.com/whatsapp.php?phone=${phoneClean}&text=${encodedMessage}&apikey=${apiKey}`;
                
                // Usar Image tag para evitar CORS (método invisible)
                const img = new Image();
                img.src = url;
            } catch (error) {
                console.error('❌ Error enviando notificación WhatsApp:', error);
            }
        }

        // Función para probar notificación de WhatsApp
        function testWhatsAppNotification() {
            const phone = localStorage.getItem('whatsapp_personal_number');
            const apiKey = localStorage.getItem('whatsapp_api_key');
            
            if (!phone || !apiKey) {
                return alert("❌ Primero guarda tu configuración de WhatsApp.\n\n1. Ingresa tu número con código de país (+51...)\n2. Obtén tu API Key desde el enlace de abajo\n3. Click en Guardar");
            }
            
            const testMessage = "🔔 *Prueba de Notificación Exitosa*\n\n✅ Tu sistema de alertas de Filtro Vehicular Plus está funcionando correctamente.\n\nRecibirás notificaciones automáticas cuando haya nuevos pendientes.";
            
            const phoneClean = phone.replace('+', '');
            const encodedMessage = encodeURIComponent(testMessage);
            const url = `https://api.callmebot.com/whatsapp.php?phone=${phoneClean}&text=${encodedMessage}&apikey=${apiKey}`;
            
            // Abrir en una ventana invisible para evitar CORS
            const testWindow = window.open(url, '_blank', 'width=1,height=1');
            
            // Cerrar la ventana después de 2 segundos
            setTimeout(function() {
                if (testWindow) testWindow.close();
            }, 2000);
            
            alert("✅ Mensaje de prueba enviado.\n\nRevisa tu WhatsApp en 5-10 segundos.\n\nSi no llega, verifica:\n• Tu número incluye + y código de país\n• Tu API Key es correcta\n• Ya activaste CallMeBot en WhatsApp");
        }


        function updateBadgesCount(n) {
            const badge = document.getElementById('requestsCount');
            const mBadge = document.getElementById('mobileCount');

            if (n > lastRequestsCount && !window.isFirstScan) {
                playAdminAlertSound();
                sendNewRequestAlerts(n);
            }
            lastRequestsCount = n;

            // Badge en ícono de la PWA (Badging API)
            if (typeof window.updateAppBadge === 'function') {
                window.updateAppBadge(n);
            }

            if (n > 0) {
                if (badge) { 
                    badge.innerHTML = n; 
                    badge.style.display = 'inline-block';
                }
                if (mBadge) { 
                    mBadge.innerHTML = n; 
                    mBadge.style.display = 'inline-block';
                }
            } else {
                if (badge) badge.style.display = 'none';
                if (mBadge) mBadge.style.display = 'none';
            }
        }

        document.getElementById('reportDate').valueAsDate = new Date();

        // Normalización automática del campo de placa
        document.getElementById('targetPlate').addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
            syncLiveProgress();
        });

        // Remove the old direct assignment for tgToken and tgChatId
        // if(document.getElementById('tgToken')) {
        //     document.getElementById('tgToken').value = localStorage.getItem('telegram_token') || '';
        //     document.getElementById('tgChatId').value = localStorage.getItem('telegram_chatid') || '';
        // }

        document.addEventListener('DOMContentLoaded', async () => {
            renderAdminCards();
            document.addEventListener('input', syncLiveProgress);
            initAuthAdmin();
            initRequestScanner();

            // 🌟 INNOVACIÓN: Autollenar inputs de Telegram y WhatsApp si ya han sido guardados
            const token = localStorage.getItem('telegram_token');
            const id = localStorage.getItem('telegram_chatid');
            const groupLink = localStorage.getItem('whatsapp_group_link');
            const personalPhone = localStorage.getItem('whatsapp_personal_number');
            const apiKey = localStorage.getItem('whatsapp_api_key');
            
            if (token && document.getElementById('tgToken')) document.getElementById('tgToken').value = token;
            if (id && document.getElementById('tgChatId')) document.getElementById('tgChatId').value = id;
            if (groupLink && document.getElementById('whatsappGroupLink')) document.getElementById('whatsappGroupLink').value = groupLink;
            if (personalPhone && document.getElementById('whatsappPersonalNumber')) document.getElementById('whatsappPersonalNumber').value = personalPhone;
            if (apiKey && document.getElementById('whatsappApiKey')) document.getElementById('whatsappApiKey').value = apiKey;

            /* Telegram: Enter en token o chat ID = Guardar (móvil y escritorio) */
            ['tgToken', 'tgChatId'].forEach(function (tid) {
                var el = document.getElementById(tid);
                if (!el) return;
                el.addEventListener('keydown', function (ev) {
                    if (ev.key !== 'Enter') return;
                    ev.preventDefault();
                    if (typeof saveTelegramSettings === 'function') saveTelegramSettings();
                });
            });

            /* WhatsApp Group Link: Enter = Guardar */
            var whatsappLinkInput = document.getElementById('whatsappGroupLink');
            if (whatsappLinkInput) {
                whatsappLinkInput.addEventListener('keydown', function (ev) {
                    if (ev.key !== 'Enter') return;
                    ev.preventDefault();
                    if (typeof saveWhatsAppGroupLink === 'function') saveWhatsAppGroupLink();
                });
            }

            /* Esc: voucher modal; login sin sesión → volver al sitio */
            document.addEventListener('keydown', function (ev) {
                if (ev.key !== 'Escape') return;
                var ac = document.getElementById('adminConfirmModal');
                if (ac && ac.style.display === 'flex') return;
                var vm = document.getElementById('voucherModal');
                if (vm && vm.style.display === 'flex') {
                    vm.style.display = 'none';
                    ev.preventDefault();
                    return;
                }
                var ov = document.getElementById('loginOverlay');
                if (ov && ov.style.display !== 'none' && !document.documentElement.classList.contains('admin-session-ok')) {
                    ev.preventDefault();
                    window.location.href = 'index.html';
                }
            }, true);
        });

        // --- MANEJO DE OVERLAY SIDEBAR ---
        const overlay = document.querySelector('.sidebar-overlay');
        if (overlay) {
            overlay.addEventListener('click', () => {
                if (typeof toggleSidebar === 'function') toggleSidebar(false);
            });
        }

        // --- SISTEMA DE NAVEGACIÓN CON HISTORIAL ---
        // Interceptor del botón "Atrás" del navegador/móvil
        window.addEventListener('popstate', (event) => {
            if (navigationStack.length > 1) {
                navigationStack.pop(); // Quitar vista actual
                const previousView = navigationStack[navigationStack.length - 1];
                showView(previousView, false); // Mostrar vista anterior sin agregar al historial
            } else {
                // Si estamos en la vista inicial, permitir salir
            }
        });

        // Restaurar estado de navegación al cargar la página
        window.addEventListener('load', () => {
            const hash = window.location.hash.replace('#', '');
            const validViews = ['editor', 'requests', 'history', 'credits', 'users', 'access'];
            
            if (hash && validViews.includes(hash)) {
                navigationStack = ['editor', hash];
                showView(hash, false);
            } else {
                // Establecer estado inicial
                history.replaceState({ view: 'editor' }, '', '#editor');
            }
        });
    

// =========================================


        window.updateAppBadge = function(count) {
            if ('setAppBadge' in navigator) {
                if (count && count > 0) {
                    navigator.setAppBadge(count).catch(() => {});
                } else {
                    navigator.clearAppBadge().catch(() => {});
                }
            }
        };
    

// =========================================


        // --- WEB PUSH NOTIFICATIONS (automático, funciona con app cerrada) ---
        var VAPID_PUBLIC_KEY = 'BB9RR2pu2n7t0j6cLWbN-CcdiSrKDZ0pwF--IxLjAU_IFjd6cPd6GASa8lEyya_TksACxoL_Ll8zxs9sC6sb9kQ';

        function urlBase64ToUint8Array(base64String) {
            var padding = '='.repeat((4 - base64String.length % 4) % 4);
            var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
            var rawData = atob(base64);
            var outputArray = new Uint8Array(rawData.length);
            for (var i = 0; i < rawData.length; ++i) {
                outputArray[i] = rawData.charCodeAt(i);
            }
            return outputArray;
        }

        // Esperar SW con timeout (no colgarse para siempre)
        function waitForSW(timeout) {
            return new Promise(function (resolve, reject) {
                var timer = setTimeout(function () {
                    reject(new Error('Service Worker no respondió en ' + (timeout / 1000) + 's. Asegúrate de abrir la página desde https:// (no file://).'));
                }, timeout);
                navigator.serviceWorker.ready.then(function (reg) {
                    clearTimeout(timer);
                    resolve(reg);
                }).catch(function (e) {
                    clearTimeout(timer);
                    reject(e);
                });
            });
        }

        window.togglePushSubscription = function () {
            var btn = document.getElementById('btnPushToggle');
            if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="font-size:10px;"></i> Procesando...';

            if (localStorage.getItem('push_subscribed') === 'true') {
                doUnsubscribePush();
            } else {
                doSubscribePush().then(function() {}).catch(function() {
                    updatePushButton(false);
                });
            }
        };

        async function doSubscribePush() {
            try {
                // Verificar soporte
                if (!('serviceWorker' in navigator)) throw new Error('Tu navegador no soporta Service Workers.');
                if (!('PushManager' in window)) throw new Error('Tu navegador no soporta Push. Usa Chrome o Edge.');
                if (location.protocol !== 'https:' && location.hostname !== 'localhost') throw new Error('Push requiere HTTPS. Abre desde https://tudominio.com/admin.html');

                // Esperar SW (máximo 5 segundos)
                var reg = await waitForSW(5000);

                // Si ya existe suscripción, renovar
                var existing = await reg.pushManager.getSubscription();
                if (existing) {
                    await savePushSub(existing);
                    localStorage.setItem('push_subscribed', 'true');
                    updatePushButton(true);
                    alert('Notificaciones ya estaban activas. Renovado.');
                    return;
                }

                // Pedir permiso
                var perm = Notification.permission;
                if (perm === 'denied') throw new Error('Notificaciones bloqueadas.\n\nPara desbloquear:\n1. Clic en el candado al lado de la URL\n2. Busca "Notificaciones"\n3. Cámbialo a "Permitir"\n4. Recarga la página');

                if (perm === 'default') {
                    perm = await Notification.requestPermission();
                }
                if (perm !== 'granted') throw new Error('Debes aceptar el permiso de notificaciones.');

                // Suscribir
                var sub = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
                });

                await savePushSub(sub);
                localStorage.setItem('push_subscribed', 'true');
                updatePushButton(true);
                alert('Notificaciones activadas.\n\nRecibirás alertas incluso con la app cerrada.');

            } catch (e) {
                updatePushButton(false);
                console.warn('Push subscription error:', e.message);
            }
        }

        async function doUnsubscribePush() {
            try {
                var reg = await waitForSW(5000);
                var sub = await reg.pushManager.getSubscription();
                if (sub) {
                    var ep = sub.endpoint;
                    await sub.unsubscribe();
                    if (window.sb) await window.sb.from('push_subscriptions').delete().eq('endpoint', ep);
                }
                localStorage.removeItem('push_subscribed');
                updatePushButton(false);
                alert('Notificaciones desactivadas.');
            } catch (e) {
                updatePushButton(localStorage.getItem('push_subscribed') === 'true');
                alert('Error al desactivar: ' + e.message);
            }
        }

        async function savePushSub(sub) {
            if (!window.sb) return;
            var j = sub.toJSON();
            var res = await window.sb.from('push_subscriptions').upsert({
                endpoint: j.endpoint,
                keys: j.keys,
                created_at: new Date().toISOString()
            }, { onConflict: 'endpoint' });
            if (res.error) console.warn('Error guardando push sub:', res.error);
        }

        function updatePushButton(subscribed) {
            var btn = document.getElementById('btnPushToggle');
            if (!btn) return;
            if (subscribed) {
                btn.innerHTML = '<i class="fa-solid fa-bell-slash" style="font-size:10px;"></i> Desactivar';
                btn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
            } else {
                btn.innerHTML = '<i class="fa-solid fa-bell" style="font-size:10px;"></i> Activar Notificaciones';
                btn.style.background = 'linear-gradient(135deg, #25d366 0%, #1ebe5d 100%)';
            }
        }

        // Registrar Service Worker + auto-activar push silencioso
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js')
                .then(function () {
                    // Auto-renovar suscripción si el permiso ya fue concedido
                    if (Notification.permission === 'granted') {
                        doSubscribePush().catch(function () {});
                    }
                })
                .catch(function (error) {
                    console.error('Error registrando Service Worker:', error);
                });

            // Enviar ping cada 30 segundos para mantener el SW activo
            setInterval(() => {
                if (navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage('keepAlive');
                }
            }, 30000);

            // Mantener la app activa en segundo plano (Wake Lock API)
            let wakeLock = null;
            async function requestWakeLock() {
                try {
                    if ('wakeLock' in navigator) {
                        wakeLock = await navigator.wakeLock.request('screen');
                        
                        wakeLock.addEventListener('release', () => {
                        });
                    }
                } catch (err) {
                }
            }

            // Activar Wake Lock cuando el usuario interactúa
            document.addEventListener('click', () => {
                if (!wakeLock || wakeLock.released) {
                    requestWakeLock();
                }
            }, { once: true });

            // Reactivar Wake Lock si la página vuelve a ser visible
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden && (!wakeLock || wakeLock.released)) {
                    requestWakeLock();
                }
            });
        }

        // Prevenir que el navegador suspenda la página
        let preventSuspend = setInterval(() => {
            // Operación mínima para mantener la página "viva"
            void(0);
        }, 60000); // Cada 1 minuto

        // Limpiar al cerrar
        window.addEventListener('beforeunload', () => {
            clearInterval(preventSuspend);
            if (wakeLock) {
                wakeLock.release();
            }
        });
    

// =========================================


        function imprimirReporteAdmin() {
            try {
                const plate = normalize(document.getElementById('targetPlate').value);
                if (!plate) {
                    alert("⚠️ Ingresa una placa válida antes de imprimir.");
                    return;
                }

                const globalActiveDot = document.querySelector('#globalStatus .status-dot-btn.active');
                const globalStatus = globalActiveDot ? globalActiveDot.dataset.status : 'ok';
                const verdictText = document.getElementById('verdictText').value;

                const items = [];
                document.querySelectorAll('.admin-card[id^="card-"]').forEach(card => {
                    const id = card.id.replace('card-', '');
                    const statusBtn = card.querySelector('.status-dot-btn.active');
                    const itemStatus = statusBtn ? statusBtn.dataset.status : 'ok';
                    const catData = categories.find(c => c.id === id);
                    const title = catData ? catData.title : 'CATEGORÍA';
                    const edEl = card.querySelector('.rich-editor');
                    const text = edEl ? edEl.innerHTML : '';

                    items.push({ id, title, status: itemStatus, text });
                });

                const colorConfig = {
                    'ok': { color: '#25d366', symbol: '✓', label: 'CONFORME' },
                    'wa': { color: '#f59e0b', symbol: '⚠', label: 'OBSERVADO' },
                    'ko': { color: '#ef4444', symbol: '✗', label: 'NO CONFORME' }
                };

                const globalCfg = colorConfig[globalStatus];
                const now = new Date();
                const fechaEmision = now.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
                const codigoCert = `FVP-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${plate}`;

                let reportHTML = `
                    <div class="cert-header">
                        <div class="cert-line-top"></div>
                        <h1 class="cert-title">CERTIFICADO DE VERIFICACIÓN TÉCNICA<br>VEHICULAR</h1>
                        <p class="cert-subtitle">Análisis Pericial Integral de Antecedentes</p>
                        <div class="cert-line-bottom"></div>
                    </div>

                    <div class="cert-info-box">
                        <h3 class="cert-info-title">INFORMACIÓN DEL VEHÍCULO</h3>
                        <div class="cert-info-grid">
                            <div class="cert-info-item">
                                <span class="cert-label">Placa de Rodaje:</span>
                                <span class="cert-value">${plate}</span>
                            </div>
                            <div class="cert-info-item">
                                <span class="cert-label">Fecha de Emisión:</span>
                                <span class="cert-value">${fechaEmision}</span>
                            </div>
                            <div class="cert-info-item">
                                <span class="cert-label">Código de Certificado:</span>
                                <span class="cert-value">${codigoCert}</span>
                            </div>
                        </div>
                    </div>

                    <div class="cert-verdict-box" style="border-left: 4px solid ${globalCfg.color};">
                        <h2 class="cert-verdict-title" style="color: ${globalCfg.color};">
                            ${globalCfg.symbol} DICTAMEN TÉCNICO FINAL
                        </h2>
                        <p class="cert-verdict-status" style="color: ${globalCfg.color};">
                            ${globalCfg.label}
                        </p>
                        <p class="cert-verdict-text">${verdictText || 'Sin observaciones registradas en el análisis pericial.'}</p>
                    </div>

                    <div class="cert-section">
                        <h3 class="cert-section-title">SECCIÓN I<br><span>MATRIZ DE EVALUACIÓN TÉCNICA</span></h3>
                        <table class="cert-table">
                            <thead>
                                <tr>
                                    <th>ÁREA DE EVALUACIÓN</th>
                                    <th style="width: 180px; text-align: center;">CALIFICACIÓN</th>
                                </tr>
                            </thead>
                            <tbody>
                `;

                items.forEach(item => {
                    const cfg = colorConfig[item.status];
                    reportHTML += `
                        <tr>
                            <td>${item.title}</td>
                            <td style="text-align: center; color: ${cfg.color}; font-weight: 700;">
                                ${cfg.symbol} ${cfg.label}
                            </td>
                        </tr>
                    `;
                });

                reportHTML += `
                            </tbody>
                        </table>
                    </div>

                    <div class="cert-section">
                        <h3 class="cert-section-title">SECCIÓN II<br><span>HALLAZGOS PERICIALES DETALLADOS</span></h3>
                `;

                items.forEach(item => {
                    const cfg = colorConfig[item.status];
                    let richText = (item.text || 'No se detectan alertas ni afectaciones vigentes.').trim();

                    reportHTML += `
                        <div class="cert-finding-box" style="border-left: 4px solid ${cfg.color};">
                            <div class="cert-finding-header">
                                <h4 style="color: ${cfg.color};">${cfg.symbol} ${item.title.toUpperCase()}</h4>
                                <span class="cert-finding-status" style="color: ${cfg.color};">Calificación: ${cfg.label}</span>
                            </div>
                            <div class="cert-finding-content" style="font-size:13px; line-height:1.7; color:#334155;">
                                ${richText}
                            </div>
                        </div>
                    `;
                });

                reportHTML += `
                    </div>

                    <div class="cert-footer">
                        <div class="cert-footer-line"></div>
                        <p>Este certificado técnico ha sido emitido por Filtro Vehicular Plus como resultado de una auditoría digital exhaustiva de bases de datos oficiales.</p>
                        <p class="cert-footer-web">www.filtrovehicularperu.com</p>
                        <p class="cert-footer-date">Generado: ${now.toLocaleString('es-PE')}</p>
                    </div>
                `;

                document.getElementById('printContent').innerHTML = reportHTML;
                document.getElementById('printModal').style.display = 'flex';
                
                setTimeout(() => { window.print(); }, 400);

            } catch (error) {
                console.error('Error al preparar impresión:', error);
                alert('Error al preparar el reporte para impresión:\n' + error.message);
            }
        }

        async function imprimirDesdeHistorial(placa) {
            try {
                if (!window.jspdf) { alert('Librerias PDF aun cargando. Intenta de nuevo.'); return; }
                const normPlaca = normalize(placa);
                let reportData = await getReportDB('report_' + normPlaca);

                // Fallback 1: buscar en tabla 'informes' de Supabase (puede no existir)
                if ((!reportData || !reportData.items) && window.sb) {
                    try {
                        const { data: informeRows, error: infErr } = await window.sb.from('informes').select('datos').eq('placa', normPlaca);
                        if (!infErr && informeRows && informeRows.length > 0 && informeRows[0].datos && informeRows[0].datos.items) {
                            reportData = informeRows[0].datos;
                        }
                    } catch(e) { /* tabla puede no existir */ }
                }

                // Fallback 2: buscar reportMeta en solicitudes (busca TODAS las filas con esta placa)
                if ((!reportData || !reportData.items) && window.sb) {
                    try {
                        const variantes = [...new Set([normPlaca, placa, placa.toUpperCase()].filter(Boolean))];
                        const { data: rows } = await window.sb
                            .from('solicitudes').select('datos').in('placa', variantes);
                        const hit = (rows || []).find(r => r.datos && r.datos.reportMeta);
                        if (hit) reportData = hit.datos.reportMeta;
                    } catch(e) {}
                }

                // Fallback 3: si no hay reportMeta, construir reporte mínimo desde los datos de la solicitud
                if ((!reportData || !reportData.items) && window.sb) {
                    try {
                        const variantes = [...new Set([normPlaca, placa, placa.toUpperCase()].filter(Boolean))];
                        const { data: rows } = await window.sb
                            .from('solicitudes').select('datos').in('placa', variantes);
                        const solData = (rows || []).find(r => r.datos && r.datos.placa);
                        if (solData && solData.datos) {
                            const d = solData.datos;
                            reportData = {
                                verdictStatus: 'ok',
                                verdictText: d.servicio ? ('Consulta: ' + d.servicio) : 'Solicitud procesada.',
                                items: [{
                                    id: 'individual',
                                    title: d.servicio || d.placa || 'Consulta',
                                    st: 'ok',
                                    text: d.servicio ? ('Servicio: <b>' + d.servicio + '</b><br>Placa: <b>' + (d.placa || normPlaca) + '</b><br>Estado: Aprobado') : 'Solicitud procesada exitosamente.'
                                }]
                            };
                        }
                    } catch(e) {}
                }

                if (!reportData || !reportData.items) {
                    alert('No se encontraron datos del reporte para la placa ' + placa);
                    return;
                }

                const pdfjs = window.pdfjsLib || window['pdfjs-dist/build/pdf'];
                if (pdfjs) pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
                const { jsPDF } = window.jspdf;
                const norm = placa;
                let itemsParaPDF = reportData.items || [];
                let vStatus = reportData.verdictStatus || 'ok';
                let vText = reportData.verdictText || '';
                let isIndividualPrint = false;
                let individualServiceName = '';

                // Detectar si es consulta individual
                if (window.sb) {
                    try {
                        const variantes = [...new Set([norm, placa.toUpperCase()].filter(Boolean))];
                        const { data: solicitudes } = await window.sb.from('solicitudes').select('placa, datos').in('placa', variantes);
                        const aprobada = (solicitudes || []).find(r => r && r.datos && r.datos.isIndividual && String(r.datos.status || '').toLowerCase() === 'approved');
                        if (aprobada && aprobada.datos) {
                            isIndividualPrint = true;
                            individualServiceName = String(aprobada.datos.servicio || '').trim();
                        }
                    } catch(e) {}
                }

                // Filtrar item para consulta individual
                if (isIndividualPrint && individualServiceName && itemsParaPDF.length) {
                    const sNorm = s => String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
                    const objetivo = sNorm(individualServiceName);
                    const serviceToIdMap = {
                        'propiedad vehicular sunarp':'sunarp','historial completo por placa':'historial',
                        'cambio de caracteristicas':'caracteristicas','deudas y multas sat lima':'lima',
                        'deudas y multas sat callao':'callao','deudas y multas por region':'region',
                        'papeletas de transito atu':'atu','siniestralidad por placa':'siniestralidad',
                        'estado de placa':'estado_placa','foto pit lima':'foto_pit',
                        'inspeccion tecnica vehicular citv':'citv','vigencia del soat':'soat',
                        'papeletas sutran':'sutran','lunas oscurecidas':'lunas',
                        'fise gnv subsidio gas':'fise','consulta deuda gnv':'gnv',
                        'denuncias y ordenes de captura':'denuncias','boleta informativa':'boleta',
                        'tarjeta de propiedad (tive)':'tive','historial de propietarios inscritos':'propietarios',
                        'record de conductor (dni)':'record','otras afectaciones':'otros'
                    };
                    const mappedId = serviceToIdMap[objetivo] || '';
                    const elegido = itemsParaPDF.find(it => sNorm(it.title) === objetivo)
                        || (mappedId ? itemsParaPDF.find(it => String(it.id||'').toLowerCase() === mappedId) : null)
                        || itemsParaPDF.find(it => sNorm(it.title).includes(objetivo) || objetivo.includes(sNorm(it.title)));
                    if (elegido) {
                        itemsParaPDF = [elegido];
                        vStatus = elegido.st || vStatus;
                        vText = elegido.text || vText;
                    }
                }

                if (isIndividualPrint && !itemsParaPDF.length) {
                    itemsParaPDF = [{ id:'individual_fallback', title: individualServiceName || 'Consulta Individual', st: vStatus, text: vText || 'Solicitud individual procesada.' }];
                }

                // Helper: limpiar HTML a texto plano (solo para textos simples como veredicto)
                function stripHTML(html) {
                    return String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/\n{3,}/g, '\n\n').trim();
                }

                vText = stripHTML(vText);

                const pdf = new jsPDF('p','mm','a4');
                const pw = pdf.internal.pageSize.getWidth();
                const ph = pdf.internal.pageSize.getHeight();
                const m = 15;
                let y = 0;
                const footerH = 10;
                const topMargin = 14; // margen superior consistente en todas las páginas

                const colorCfg = {
                    'ok': { color: [37, 211, 102], label: 'CONFORME' },
                    'wa': { color: [245, 158, 11], label: 'OBSERVADO' },
                    'ko': { color: [239, 68, 68], label: 'NO CONFORME' }
                };

                const now = new Date();
                const fechaEmi = now.toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
                const codigoCert = 'FVP-' + now.getFullYear() + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0') + '-' + norm;
                const reportDate = reportData.date || now.toISOString().split('T')[0];

                // Helper: dibuja encabezado de página (barra + mini info)
                function drawPageHeader(showFull) {
                    pdf.setFillColor(17, 27, 33); pdf.rect(0, 0, pw, 4, 'F');
                    pdf.setFillColor(37, 211, 102); pdf.rect(0, 4, pw, 0.8, 'F');
                }

                function newPage() {
                    pdf.addPage();
                    drawPageHeader(false);
                    return 12;
                }

                // ============================================
                // PÁGINA 1: PORTADA
                // ============================================
                drawPageHeader(true);

                // TITULO
                y = 18;
                pdf.setFontSize(16); pdf.setFont("helvetica","bold"); pdf.setTextColor(17, 27, 33);
                pdf.text("CERTIFICADO DE VERIFICACION", pw/2, y, {align:'center'}); y += 6;
                pdf.setFontSize(13);
                pdf.text("TECNICA VEHICULAR", pw/2, y, {align:'center'}); y += 5;
                pdf.setDrawColor(37, 211, 102); pdf.setLineWidth(0.8);
                pdf.line(pw/2 - 35, y, pw/2 + 35, y); y += 5;
                pdf.setFontSize(8); pdf.setFont("helvetica","normal"); pdf.setTextColor(100, 116, 139);
                pdf.text(isIndividualPrint ? "Reporte Tecnico de Consulta Individual" : "Analisis Pericial Integral de Antecedentes", pw/2, y, {align:'center'}); y += 8;

                // TARJETA INFO (2 filas, 2 columnas con línea divisoria)
                const cardH = 32;
                const cardW = pw - m*2;
                pdf.setFillColor(255, 255, 255); pdf.setDrawColor(203, 213, 225); pdf.setLineWidth(0.4);
                pdf.roundedRect(m, y, cardW, cardH, 3, 3, 'FD');
                // Barra lateral azul
                pdf.setFillColor(17, 27, 33); pdf.rect(m, y, 4, cardH, 'F');
                // Línea divisoria horizontal
                pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.2);
                pdf.line(m + 12, y + cardH/2, m + cardW - 8, y + cardH/2);
                // Línea divisoria vertical
                pdf.line(pw/2, y + 4, pw/2, y + cardH - 4);
                const c1 = m + 14, c2 = pw/2 + 10;
                // Fila 1
                let iy = y + 7;
                pdf.setFontSize(5.5); pdf.setFont("helvetica","bold"); pdf.setTextColor(148, 163, 184);
                pdf.text("PLACA DE RODAJE", c1, iy); pdf.text("FECHA DE EMISION", c2, iy); iy += 6;
                pdf.setFontSize(16); pdf.setFont("helvetica","bold"); pdf.setTextColor(17, 27, 33);
                pdf.text(norm, c1, iy);
                pdf.setFontSize(10); pdf.setFont("helvetica","normal"); pdf.setTextColor(51, 65, 85);
                pdf.text(fechaEmi, c2, iy);
                // Fila 2
                iy = y + cardH/2 + 5;
                pdf.setFontSize(5.5); pdf.setFont("helvetica","bold"); pdf.setTextColor(148, 163, 184);
                pdf.text("CODIGO CERTIFICADO", c1, iy); pdf.text("TIPO DE ANALISIS", c2, iy); iy += 6;
                pdf.setFontSize(8); pdf.setFont("helvetica","bold"); pdf.setTextColor(17, 27, 33);
                pdf.text(codigoCert, c1, iy);
                pdf.setFontSize(8); pdf.setFont("helvetica","normal"); pdf.setTextColor(51, 65, 85);
                pdf.text(isIndividualPrint ? "Consulta Individual" : "Expediente Integral", c2, iy);
                y += cardH + 6;

                // DICTAMEN (con estructura interna)
                const gCfg = colorCfg[vStatus] || colorCfg['ok'];
                var defaultVerdicts = {
                    'ok': 'Vehiculo en excelentes condiciones legales. Sin afectaciones criticas detectadas en la auditoria digital. Riesgo minimo para la transferencia.',
                    'wa': 'Se identificaron alertas preventivas que requieren validacion fisica. Vehiculo apto para transferencia con observaciones.',
                    'ko': 'Riesgo critico detectado. Se identificaron afectaciones legales vigentes que comprometen la legalidad de la unidad.'
                };
                if (!vText || vText.length < 10) {
                    vText = defaultVerdicts[vStatus] || defaultVerdicts['ok'];
                }
                // Si el texto es muy largo (más de 200 chars), truncar a 200
                if (vText.length > 200) vText = vText.substring(0, 197) + '...';
                const vdText = vText;
                const vdLines = pdf.splitTextToSize(vdText, pw - m*2 - 28);
                const vdTextH = vdLines.length * 3.5;
                const bannerH = 26 + vdTextH;
                // Fondo con gradiente simulado
                pdf.setFillColor(Math.max(0, gCfg.color[0]-15), Math.max(0, gCfg.color[1]-15), Math.max(0, gCfg.color[2]-15));
                pdf.roundedRect(m, y, cardW, bannerH, 3, 3, 'F');
                pdf.setFillColor(gCfg.color[0], gCfg.color[1], gCfg.color[2]);
                pdf.roundedRect(m, y, cardW, bannerH - 2, 3, 3, 'F');
                // Etiqueta
                pdf.setFontSize(6); pdf.setFont("helvetica","bold"); pdf.setTextColor(255, 255, 255);
                pdf.text("DICTAMEN TECNICO FINAL", m + 12, y + 7);
                // Línea decorativa
                pdf.setDrawColor(255, 255, 255); pdf.setLineWidth(0.3);
                pdf.line(m + 12, y + 9, m + 55, y + 9);
                // Resultado
                pdf.setFontSize(16); pdf.setFont("helvetica","bold");
                pdf.text(gCfg.label, m + 12, y + 17);
                // Texto completo
                pdf.setFontSize(7.5); pdf.setFont("helvetica","normal"); pdf.setTextColor(255, 255, 255);
                for (let vl = 0; vl < vdLines.length; vl++) {
                    pdf.text(vdLines[vl], m + 12, y + 22 + (vl * 3.5));
                }
                y += bannerH + 6;

                // MATRIZ
                if (!isIndividualPrint && itemsParaPDF.length > 0) {
                    pdf.setFontSize(10); pdf.setFont("helvetica","bold"); pdf.setTextColor(17, 27, 33);
                    pdf.text("MATRIZ DE EVALUACION TECNICA", m, y); y += 3;
                    pdf.setDrawColor(17, 27, 33); pdf.setLineWidth(0.5); pdf.line(m, y, m + 50, y); y += 4;
                    const matrizAvail = ph - y - footerH - 2;
                    const rowH = Math.max(5.5, Math.floor((matrizAvail / (itemsParaPDF.length + 1)) * 10) / 10);
                    pdf.setFillColor(17, 27, 33); pdf.rect(m, y, pw - m*2, rowH, 'F');
                    pdf.setFontSize(5.5); pdf.setFont("helvetica","bold"); pdf.setTextColor(255, 255, 255);
                    pdf.text("N", m + 5, y + rowH*0.65, {align:'center'}); pdf.text("AREA DE EVALUACION", m + 13, y + rowH*0.65);
                    pdf.text("RESULTADO", pw - m - 18, y + rowH*0.65, {align:'center'}); y += rowH;
                    itemsParaPDF.forEach((item, idx) => {
                        if (y > ph - footerH - 2) { y = newPage(); }
                        const iCfg = colorCfg[item.st || 'ok'];
                        if (idx % 2 === 0) { pdf.setFillColor(248, 250, 252); pdf.rect(m, y, pw - m*2, rowH, 'F'); }
                        pdf.setDrawColor(241, 245, 249); pdf.setLineWidth(0.15); pdf.line(m, y + rowH, pw - m, y + rowH);
                        pdf.setFontSize(6); pdf.setFont("helvetica","bold"); pdf.setTextColor(148, 163, 184);
                        pdf.text(String(idx + 1).padStart(2, '0'), m + 5, y + rowH*0.65, {align:'center'});
                        pdf.setFontSize(7); pdf.setFont("helvetica","normal"); pdf.setTextColor(30, 41, 59);
                        pdf.text(String(item.title || '---').substring(0, 50), m + 13, y + rowH*0.65);
                        const badgeTxt = iCfg.label; const badgeW = pdf.getTextWidth(badgeTxt) + 5;
                        const badgeX = pw - m - 18 - badgeW/2;
                        pdf.setFillColor(iCfg.color[0], iCfg.color[1], iCfg.color[2]);
                        pdf.roundedRect(badgeX, y + (rowH - 4)/2, badgeW, 4, 1.2, 1.2, 'F');
                        pdf.setFontSize(5); pdf.setFont("helvetica","bold"); pdf.setTextColor(255, 255, 255);
                        pdf.text(badgeTxt, badgeX + badgeW/2, y + rowH*0.65, {align:'center'});
                        y += rowH;
                    });
                }

                // ============================================
                // PÁGINAS 2+: HALLAZGOS PERICIALES (flujo continuo)
                // ============================================
                const cleanMessages = {'sunarp':'El vehiculo no registra anotaciones de robo, embargos ni gravamenes vigentes.','historial':'Historial de registros y transferencias validado.','caracteristicas':'Caracteristicas tecnicas originales verificadas.','lima':'No se registran deudas pendientes en Lima.','callao':'No se registran deudas pendientes en Callao.','region':'Sin registros de deudas regionales detectadas.','atu':'Libre de infracciones ante la ATU.','siniestralidad':'Sin registros de siniestros reportados.','estado_placa':'Placa en estado activo y vigente.','foto_pit':'Sin fotopapeletas pendientes.','citv':'Inspeccion Tecnica aprobada y vigente.','soat':'Poliza SOAT validada y vigente.','sutran':'Sin infracciones SUTRAN.','lunas':'Permiso de lunas oscurecidas vigente.','fise':'Sin saldos pendientes por FISE GNV.','gnv':'Sin deuda GNV pendiente.','denuncias':'Sin denuncias ni requisitorias vigentes.','boleta':'Sin afectaciones en partida registral.','tive':'TIVE verificada correctamente.','propietarios':'Historial de propietarios en regla.','record':'Sin sanciones graves vigentes.','otros':'Sin otras afectaciones detectadas.'};

                const catHeaderH = 9;
                const minSpaceForCat = catHeaderH + 18;
                const contentArea = ph - footerH;

                // Primera página de hallazgos
                if (isIndividualPrint) {
                    y = Math.max(y + 8, 100);
                } else {
                    y = newPage();
                    pdf.setFontSize(10); pdf.setFont("helvetica","bold"); pdf.setTextColor(17, 27, 33);
                    pdf.text("HALLAZGOS PERICIALES DETALLADOS", m, y); y += 3;
                    pdf.setDrawColor(17, 27, 33); pdf.setLineWidth(0.5); pdf.line(m, y, m + 52, y); y += 7;
                }

                for (let idx = 0; idx < itemsParaPDF.length; idx++) {
                    const item = itemsParaPDF[idx];
                    const iCfg = colorCfg[item.st || 'ok'];
                    const files = item.files || [];

                    // ¿Cabe el header + texto mínimo?
                    if (y > contentArea - minSpaceForCat) {
                        y = newPage();
                    }

                    // Category header
                    pdf.setFillColor(248, 250, 252); pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.3);
                    pdf.roundedRect(m, y, pw - m*2, catHeaderH, 2, 2, 'FD');
                    pdf.setFillColor(iCfg.color[0], iCfg.color[1], iCfg.color[2]); pdf.rect(m, y, 3, catHeaderH, 'F');
                    pdf.setFontSize(8.5); pdf.setFont("helvetica","bold"); pdf.setTextColor(17, 27, 33);
                    pdf.text(String(idx + 1).padStart(2, '0') + '.  ' + (item.title || "CATEGORIA").toUpperCase(), m + 8, y + catHeaderH*0.6);
                    const bTxt = iCfg.label; const bW = pdf.getTextWidth(bTxt) + 5;
                    pdf.setFillColor(iCfg.color[0], iCfg.color[1], iCfg.color[2]);
                    pdf.roundedRect(pw - m - bW - 4, y + (catHeaderH - 4.5)/2, bW, 4.5, 1.2, 1.2, 'F');
                    pdf.setFontSize(5.5); pdf.setFont("helvetica","bold"); pdf.setTextColor(255, 255, 255);
                    pdf.text(bTxt, pw - m - bW/2 - 4, y + catHeaderH*0.6, {align:'center'});
                    y += catHeaderH + 7;

                    // Content text
                    var ctHtml = item.text || cleanMessages[item.id] || "No se detectan alertas ni afectaciones vigentes.";
                    y = renderRichTextPDF(pdf, ctHtml, m + 8, y, pw - m*2 - 16, 8.5, contentArea, m);
                    y += 2;

                    // EVIDENCIAS
                    if (files.length > 0) {
                        if (y > contentArea - 35) { y = newPage(); }
                        pdf.setFontSize(7.5); pdf.setFont("helvetica","bold"); pdf.setTextColor(100, 116, 139);
                        pdf.text("EVIDENCIA DOCUMENTAL", m + 6, y); y += 4;
                        pdf.setDrawColor(203, 213, 225); pdf.setLineWidth(0.2); pdf.line(m + 6, y, pw - m - 6, y); y += 5;

                        for (const f of files) {
                            try {
                                if (f.type === 'img') {
                                    const ip = pdf.getImageProperties(f.data);
                                    const maxH = ph / 4; // 1/4 de la hoja
                                    const maxW = pw / 2; // máximo medio ancho
                                    let iW, iH;
                                    const ratio = ip.width / ip.height;
                                    // Ajustar a 1/4 de hoja manteniendo proporción
                                    iH = maxH;
                                    iW = iH * ratio;
                                    if (iW > maxW) { iW = maxW; iH = iW / ratio; }
                                    // Si la imagen original es más pequeña, no estirar
                                    if (ip.height < maxH * 2.83 && ip.width < maxW * 2.83) {
                                        iW = ip.width / 2.83; iH = ip.height / 2.83; // px a mm aprox
                                        if (iH > maxH) { iH = maxH; iW = iH * ratio; }
                                        if (iW > maxW) { iW = maxW; iH = iW / ratio; }
                                    }
                                    var imgPad = 1.5;
                                    var frameW = iW + imgPad*2, frameH = iH + imgPad*2;
                                    if (y + frameH > contentArea - 4) { y = newPage(); }
                                    var frameX = (pw - frameW) / 2;
                                    pdf.setFillColor(255, 255, 255);
                                    pdf.roundedRect(frameX, y, frameW, frameH, 2.5, 2.5, 'F');
                                    pdf.addImage(f.data, 'JPEG', frameX + imgPad, y + imgPad, iW, iH);
                                    pdf.setDrawColor(220, 225, 230); pdf.setLineWidth(0.3);
                                    pdf.roundedRect(frameX, y, frameW, frameH, 2.5, 2.5, 'D');
                                    y += frameH + 8;
                                } else if (f.type === 'pdf' && pdfjs) {
                                    const b64 = f.data.split(',')[1]; const bin = atob(b64);
                                    const u8 = new Uint8Array(bin.length); for (let j = 0; j < bin.length; j++) u8[j] = bin.charCodeAt(j);
                                    const pdfDoc = await pdfjs.getDocument({data: u8}).promise;
                                    for (let pN = 1; pN <= pdfDoc.numPages; pN++) {
                                        const pg = await pdfDoc.getPage(pN); const vp = pg.getViewport({scale: 3});
                                        const cnv = document.createElement('canvas'); const ctx = cnv.getContext('2d');
                                        cnv.height = vp.height; cnv.width = vp.width;
                                        await pg.render({canvasContext: ctx, viewport: vp}).promise;
                                        const pImg = cnv.toDataURL('image/jpeg', 0.95);
                                        // Página completa: encaja en A4 entre header y footer
                                        y = newPage();
                                        var pdfAreaW = pw;
                                        var pdfAreaH = ph - footerH - 6; // desde top barra hasta footer
                                        var pdfRatio = vp.width / vp.height;
                                        var fitW = pdfAreaW;
                                        var fitH = fitW / pdfRatio;
                                        if (fitH > pdfAreaH) { fitH = pdfAreaH; fitW = fitH * pdfRatio; }
                                        var pdfX = (pw - fitW) / 2;
                                        var pdfY = 6; // justo debajo de la barra
                                        pdf.addImage(pImg, 'JPEG', pdfX, pdfY, fitW, fitH);
                                        y = pdfY + fitH + 4;
                                    }
                                }
                            } catch(e) {}
                        }
                    }

                    // Separador entre categorías
                    y += 1;
                }

                // ============================================
                // ÚLTIMA PÁGINA: GUIA DE INTERPRETACION
                // ============================================
                if (!isIndividualPrint) {
                y = newPage() + 10;
                pdf.setFontSize(12); pdf.setFont("helvetica","bold"); pdf.setTextColor(17, 27, 33);
                pdf.text("GUIA DE INTERPRETACION PERICIAL", pw/2, y, {align:'center'}); y += 5;
                pdf.setDrawColor(37, 211, 102); pdf.setLineWidth(0.8); pdf.line(pw/2 - 30, y, pw/2 + 30, y); y += 4;
                pdf.setFontSize(8); pdf.setFont("helvetica","normal"); pdf.setTextColor(100, 116, 139);
                pdf.text("Criterios utilizados para la determinacion del estado del vehiculo", pw/2, y, {align:'center'}); y += 12;
                const guiaItems = [
                    {t:'NO CONFORME', c:[239,68,68], d:'Nivel de Riesgo: ALTO', items:['Se recomienda NO proceder con la compra-venta.','Multiples transferencias sospechosas o deudas cuantiosas.','Gravamenes activos, embargos u ordenes de captura.','Datos de motor/chasis no coincidentes.']},
                    {t:'OBSERVADO', c:[245,158,11], d:'Nivel de Riesgo: MEDIO', items:['Requiere validacion fisica minuciosa.','Historial de siniestros leves o papeletas pendientes.','Multas administrativas menores.','Documentacion en proceso de tramite.']},
                    {t:'CONFORME', c:[139,195,74], d:'Nivel de Riesgo: BAJO', items:['Aprobacion tecnica. Listo para transferencia.','Registro de propiedad sin afectaciones.','Ausencia total de deudas o gravamenes.','Revisiones tecnicas constantes y aprobadas.']}
                ];
                guiaItems.forEach(r => {
                    const rH = 56;
                    if (y + rH > contentArea - 4) { y = newPage() + 10; }
                    // Fondo con sombra
                    pdf.setFillColor(Math.max(0,r.c[0]-20), Math.max(0,r.c[1]-20), Math.max(0,r.c[2]-20));
                    pdf.roundedRect(m, y, pw - m*2, rH, 4, 4, 'F');
                    pdf.setFillColor(r.c[0], r.c[1], r.c[2]);
                    pdf.roundedRect(m, y, pw - m*2, rH - 2, 4, 4, 'F');
                    // Título
                    const px = m + 14;
                    pdf.setFontSize(15); pdf.setFont("helvetica","bold"); pdf.setTextColor(255, 255, 255);
                    pdf.text(r.t, px, y + 12);
                    // Subtítulo
                    pdf.setFontSize(8); pdf.setFont("helvetica","normal");
                    pdf.text(r.d, px, y + 18);
                    // Línea separadora
                    pdf.setDrawColor(255, 255, 255); pdf.setLineWidth(0.3);
                    pdf.line(px, y + 22, pw - m - 14, y + 22);
                    // Items con bullet
                    pdf.setFontSize(8.5); pdf.setFont("helvetica","normal");
                    let gy = y + 29;
                    r.items.forEach(function(item) {
                        pdf.setFont("helvetica","bold"); pdf.text('\u2022', px, gy);
                        pdf.setFont("helvetica","normal"); pdf.text(item, px + 5, gy);
                        gy += 5.5;
                    });
                    y += rH + 10;
                });
                } // fin if (!isIndividualPrint)

                // FOOTER EN TODAS LAS PAGINAS
                const pTotal = typeof pdf.internal.getNumberOfPages === 'function' ? pdf.internal.getNumberOfPages() : pdf.internal.pages.length - 1;
                for (let i=1; i<=pTotal; i++) {
                    pdf.setPage(i);
                    pdf.setFillColor(17, 27, 33); pdf.rect(0, ph - 10, pw, 10, 'F');
                    pdf.setFillColor(37, 211, 102); pdf.rect(0, ph - 10, pw, 1, 'F');
                    pdf.setFontSize(6.5); pdf.setFont("helvetica","normal"); pdf.setTextColor(200, 210, 220);
                    pdf.text('Filtro Vehicular Plus  |  www.filtrovehicularperu.com', m, ph - 4.5);
                    pdf.text(codigoCert + '  |  Pag. ' + i + '/' + pTotal, pw - m, ph - 4.5, {align:'right'});
                }

                var pdfPrefix = isIndividualPrint ? 'Certificado_Individual' : 'Certificado_Vehicular';
                pdf.save(pdfPrefix + '_' + norm + '.pdf');
            } catch (e) {
                console.error('Error generando PDF desde historial:', e);
                alert('Error al generar el PDF: ' + e.message);
            }
        }

        function cerrarPrintModal() {
            document.getElementById('printModal').style.display = 'none';
        }

        window.addEventListener('afterprint', cerrarPrintModal);
