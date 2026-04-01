function esc(s) { var d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }
        function escAttr(s) { return esc(s).replace(/'/g, '&#39;').replace(/"/g, '&quot;'); }

        /**
         * Renderiza HTML rico (con <b>, <i>, <br>) en jsPDF preservando negritas.
         */
        function renderRichTextPDF(pdf, html, x, startY, maxWidth, fontSize, pageHeight, margin) {
            fontSize = fontSize || 9.5;
            pageHeight = pageHeight || pdf.internal.pageSize.getHeight();
            margin = margin || 18;
            var text = String(html || '')
                .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
                .replace(/["\u201C\u201D]/g, '"').replace(/['\u2018\u2019]/g, "'").replace(/[\u2013\u2014]/g, '-');
            text = text.replace(/<br\s*\/?>/gi, '\n');
            text = text.replace(/<li[^>]*>/gi, '\n\u2022 ').replace(/<\/li>/gi, '');
            text = text.replace(/<\/?(ul|ol|p|div|blockquote|code|strike|s|em)[^>]*>/gi, '\n');
            var segments = [];
            var re = /<(\/?)(?:b|strong|i)(?:\s[^>]*)?>/gi;
            var lastIdx = 0, bold = false, italic = false, match;
            while ((match = re.exec(text)) !== null) {
                if (match.index > lastIdx) {
                    var chunk = text.substring(lastIdx, match.index).replace(/<[^>]*>/g, '');
                    if (chunk) segments.push({ text: chunk, bold: bold, italic: italic });
                }
                var tag = match[0].toLowerCase();
                var isClose = match[1] === '/';
                if (tag.includes('b') || tag.includes('strong')) bold = !isClose;
                else if (tag.includes('i')) italic = !isClose;
                lastIdx = match.index + match[0].length;
            }
            var rest = text.substring(lastIdx).replace(/<[^>]*>/g, '');
            if (rest) segments.push({ text: rest, bold: bold, italic: italic });
            var allText = segments.map(function(s) { return s.text; }).join('');
            var lines = allText.split('\n');
            var y = startY;
            var lineHeight = fontSize * 0.45;
            var charIdx = 0;
            for (var li = 0; li < lines.length; li++) {
                var line = lines[li].trim();
                if (!line) { y += lineHeight * 0.6; charIdx += 1; continue; }
                if (y > pageHeight - 25) { pdf.addPage(); y = 20; }
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
                        if (portion) { lineSegs.push({ text: portion, bold: seg.bold, italic: seg.italic }); remaining -= portion.length; }
                    }
                    segCharIdx = segEnd;
                }
                var curX = x;
                for (var sj = 0; sj < lineSegs.length; sj++) {
                    var s = lineSegs[sj];
                    var fontStyle = s.bold && s.italic ? 'bolditalic' : s.bold ? 'bold' : s.italic ? 'italic' : 'normal';
                    pdf.setFont('helvetica', fontStyle); pdf.setFontSize(fontSize); pdf.setTextColor(51, 65, 85);
                    var words = s.text.split(' ');
                    for (var wi = 0; wi < words.length; wi++) {
                        var word = words[wi];
                        var wordW = pdf.getTextWidth(word + ' ');
                        if (curX + wordW > x + maxWidth && curX > x) { y += lineHeight; curX = x; if (y > pageHeight - 25) { pdf.addPage(); y = 20; } }
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

        // Lógica de UI requerida por auth.js para el dropdown
        function toggleDropdown(e) {
            e.stopPropagation();
            document.getElementById('userDropdown').classList.toggle('open');
        }

        window.addEventListener('click', () => {
            const drp = document.getElementById('userDropdown');
            if (drp) drp.classList.remove('open');
        });

        // Verificamos si hay sesión
        document.addEventListener('DOMContentLoaded', async () => {
            if (!window.sb) {
                alert("Error de conexión con la base de datos.");
                return;
            }

            var email = window.FiltroSession && window.FiltroSession.getEmail();
            if (!email) {
                window.location.href = 'index.html';
                return;
            }

            cargarHistorial(email);
        });

        function formatearFecha(isoString) {
            const opciones = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
            const fecha = new Date(isoString);
            return fecha.toLocaleDateString('es-PE', opciones);
        }

        async function cargarHistorial(email) {
            const spinner = document.getElementById('loadingSpinner');
            const lista = document.getElementById('consultasList');

            try {
                // Consultamos a Supabase
                const { data, error } = await window.sb
                    .from('solicitudes')
                    .select('datos')
                    .order('updated_at', { ascending: false });

                if (error) throw error;

                spinner.style.display = 'none';
                lista.style.display = 'flex';

                // Filtrar las solicitudes del cliente (excluyendo recargas)
                const myReqs = data.map(d => d.datos).filter(r => r && r.email && r.email.toLowerCase().trim() === email && r.placa && !r.isRecharge && !r.isRegistro && !r.isActivacion && !r.isDashboard);

                if (!myReqs || myReqs.length === 0) {
                    lista.innerHTML = `
                        <div style="text-align:center; padding: 50px 24px; background: #ffffff; border-radius: 14px; border: 1px solid #e5e7eb;">
                            <div style="width:60px; height:60px; background:rgba(37,211,102,0.1); border-radius:14px; display:flex; align-items:center; justify-content:center; margin:0 auto 18px;">
                                <i class="fa-solid fa-folder-open" style="font-size: 24px; color: #25d366;"></i>
                            </div>
                            <h3 style="color: #111b21; margin-bottom: 8px; font-size: 16px; font-weight: 700;">Sin consultas registradas</h3>
                            <p style="color: #6b7280; font-size: 13px; margin-bottom: 22px; max-width: 320px; margin-left: auto; margin-right: auto; line-height: 1.6; font-weight: 400;">Tus verificaciones vehiculares aparecerán aquí.</p>
                            <a href="index.html" style="display:inline-flex; align-items:center; gap:6px; background:#25d366; color:#fff; padding:10px 20px; border-radius:10px; font-size:12px; font-weight:600; text-decoration:none; transition:background 0.2s;" onmouseover="this.style.background='#1ebe5d'" onmouseout="this.style.background='#25d366'">
                                <i class="fa-solid fa-magnifying-glass"></i> Nueva Consulta
                            </a>
                        </div>
                    `;
                    return;
                }

                // Renderizamos las tarjetas
                lista.innerHTML = myReqs.map(item => {
                    const isCompletado = item.status === 'approved';
                    const badgeClass = isCompletado ? 'badge-completado' : 'badge-pendiente';
                    const badgeIcon = isCompletado ? '<i class="fa-solid fa-circle-check"></i>' : '<i class="fa-solid fa-clock"></i>';
                    const actStatus = isCompletado ? 'Completado' : 'Pendiente';
                    
                    // Extraer placa y servicio
                    const placa = item.placa || 'Sin placa';
                    const serviceName = item.servicio || item.service || item.tipo || item.descripcion;
                    
                    // PLACA siempre como título principal
                    const displayTitle = placa;
                    
                    // Servicio o fecha como subtítulo
                    let displaySubtitle = '';
                    if (serviceName) {
                        displaySubtitle = serviceName;
                    } else if (item.timestamp) {
                        displaySubtitle = formatearFecha(item.timestamp);
                    } else {
                        displaySubtitle = 'Consulta vehicular';
                    }
                    
                    const btnHtml = isCompletado 
                        ? `<button class="btn-ver btn-descargar" onclick="descargarReporte('${escAttr(item.placa)}', this)"><i class="fa-solid fa-file-arrow-down"></i> Descargar</button>`
                        : `<span style="display:inline-flex; align-items:center; gap:4px; padding:6px 12px; border-radius:8px; font-size:10px; font-weight:600; color:#6b7280; border:1px solid #e5e7eb;"><i class="fa-solid fa-hourglass-half" style="font-size:10px;"></i> En Espera</span>`;

                    return `
                        <div class="consulta-card">
                            <div class="c-info">
                                <div class="c-icon"><i class="fa-solid fa-car"></i></div>
                                <div class="c-details">
                                    <div class="c-placa">${esc(displayTitle)}</div>
                                    <div class="c-fecha">${esc(displaySubtitle)}</div>
                                </div>
                            </div>
                            <div class="c-status">
                                <div class="badge ${badgeClass}">${badgeIcon} ${actStatus}</div>
                                ${btnHtml}
                            </div>
                        </div>
                    `;
                }).join('');

            } catch (err) {
                console.error("Error al cargar historial:", err);
                spinner.innerHTML = `<p style="color:#ef4444;">Error al cargar las consultas. Intenta de nuevo más tarde.</p>`;
            }
        }

        // --- IndexedDB helpers ---
        function initDB() {
            return new Promise((resolve, reject) => {
                const req = indexedDB.open('FiltroVehicularDB', 1);
                req.onupgradeneeded = e => { e.target.result.createObjectStore('reports'); };
                req.onsuccess = e => resolve(e.target.result);
                req.onerror = e => reject(e.target.error);
            });
        }
        async function getReportDB(key) {
            try {
                const db = await initDB();
                return new Promise((resolve) => {
                    const tx = db.transaction('reports', 'readonly');
                    const store = tx.objectStore('reports');
                    const req = store.get(key);
                    req.onsuccess = () => resolve(req.result || null);
                    req.onerror = () => resolve(null);
                });
            } catch { return null; }
        }

        // --- Descarga directa de PDF ---
        async function descargarReporte(placa, btn) {
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando...';
            btn.disabled = true;

            try {
                const pdfjs = window.pdfjsLib || window['pdfjs-dist/build/pdf'];
                if (!pdfjs || !window.jspdf) {
                    alert("Error: Las librerías PDF no han cargado. Recarga la página.");
                    return;
                }
                pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
                const { jsPDF } = window.jspdf;

                const norm = placa.toUpperCase().replace(/[^A-Z0-9]/g, '');
                let localData = null;

                // 1. IndexedDB local
                localData = await getReportDB('report_' + norm);
                if (!localData) {
                    var raw = localStorage.getItem('report_' + norm);
                    if (raw) try { localData = JSON.parse(raw); } catch(e) {}
                }

                // 2. Tabla 'informes' en Supabase (puede no existir)
                if ((!localData || !localData.items) && window.sb) {
                    try {
                        var { data: informeRows, error: infErr } = await window.sb.from('informes').select('datos').eq('placa', norm);
                        if (!infErr && informeRows && informeRows.length > 0 && informeRows[0].datos && informeRows[0].datos.items) {
                            localData = informeRows[0].datos;
                        }
                    } catch(e) { /* tabla puede no existir */ }
                }

                // 3. Buscar en TODAS las solicitudes — la más completa
                if ((!localData || !localData.items) && window.sb) {
                    try {
                        var { data: allSol } = await window.sb.from('solicitudes').select('placa, datos');
                        if (allSol && allSol.length) {
                            // Normalizar y buscar TODAS las filas de esta placa
                            var matches = allSol.filter(function(r) {
                                if (!r || !r.datos) return false;
                                var p1 = String(r.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
                                var p2 = String(r.datos.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
                                return p1 === norm || p2 === norm;
                            });

                            // Prioridad 1: la que tenga reportMeta con items
                            var withReport = matches.find(function(r) {
                                return r.datos.reportMeta && r.datos.reportMeta.items && r.datos.reportMeta.items.length > 0;
                            });
                            if (withReport) {
                                localData = withReport.datos.reportMeta;
                            }

                            // Prioridad 2: construir mínimo desde datos de solicitud
                            if ((!localData || !localData.items) && matches.length > 0) {
                                var best = matches[0].datos;
                                localData = {
                                    verdictStatus: 'ok',
                                    verdictText: best.servicio ? ('Consulta: ' + best.servicio) : 'Solicitud procesada.',
                                    items: [{
                                        id: 'fallback',
                                        title: best.servicio || best.placa || 'Consulta',
                                        st: 'ok',
                                        text: best.servicio
                                            ? ('Servicio: <b>' + best.servicio + '</b><br>Placa: <b>' + (best.placa || norm) + '</b><br>Estado: Aprobado')
                                            : 'Solicitud procesada exitosamente.'
                                    }]
                                };
                            }
                        }
                    } catch(e) {}
                }

                if (!localData || !localData.items) {
                    alert('No se encontraron datos del reporte. Contacta al administrador.');
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                    return;
                }


                let itemsParaPDF = localData.items || [];
                let vStatus = localData.verdictStatus || 'ok';
                let vText = localData.verdictText || '';
                let isIndividualPrint = false;
                let individualServiceName = '';

                // Detectar consulta individual
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

                // Mapeo de servicio individual
                let individualItemMatched = false;
                if (isIndividualPrint && individualServiceName && itemsParaPDF.length) {
                    const sNorm = s => String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
                    const objetivo = sNorm(individualServiceName);
                    const serviceToIdMap = {
                        'propiedad vehicular sunarp':'sunarp','historial completo por placa':'historial',
                        'cambio de caracteristicas':'caracteristicas','deudas y multas sat lima':'lima',
                        'deudas y multas sat callao':'callao','deudas y multas por region':'regiones',
                        'papeletas de transito atu':'atu','siniestralidad por placa':'siniestralidad',
                        'estado de placa':'placa','foto pit lima':'foto_pit',
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
                        individualItemMatched = true;
                    }
                }

                if (isIndividualPrint && !individualItemMatched) {
                    if (!itemsParaPDF.length) {
                        itemsParaPDF = [{ id:'individual_fallback', title: individualServiceName || 'Consulta Individual', st: vStatus, text: vText || 'Solicitud individual procesada.' }];
                    }
                }

                // --- GENERAR CERTIFICADO PDF PROFESIONAL ---
                const pdf = new jsPDF('p','mm','a4');
                const pw = pdf.internal.pageSize.getWidth();
                const ph = pdf.internal.pageSize.getHeight();
                const m = 15;
                let y = 0;
                const footerH = 10;
                const topMargin = 14;

                const colorCfg = {
                    'ok': { color: [139, 195, 74], label: 'CONFORME' },
                    'wa': { color: [245, 158, 11], label: 'OBSERVADO' },
                    'ko': { color: [239, 68, 68], label: 'NO CONFORME' }
                };

                const now = new Date();
                const fechaEmi = now.toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
                const codigoCert = 'FVP-' + now.getFullYear() + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0') + '-' + norm;
                const tipoAnalisis = isIndividualPrint ? "Consulta Individual" : "Expediente Integral";

                // Helper: encabezado de página
                function drawPageHeader(showFull) {
                    pdf.setFillColor(13, 37, 54); pdf.rect(0, 0, pw, 4, 'F');
                    pdf.setFillColor(139, 195, 74); pdf.rect(0, 4, pw, 0.8, 'F');
                }
                function newPage() { pdf.addPage(); drawPageHeader(false); return 12; }
                const contentArea = ph - footerH;

                // ===== PÁGINA 1: PORTADA =====
                drawPageHeader(true);

                y = 18;
                pdf.setFontSize(16); pdf.setFont("helvetica","bold"); pdf.setTextColor(13, 37, 54);
                pdf.text("CERTIFICADO DE VERIFICACION", pw/2, y, {align:'center'}); y += 6;
                pdf.setFontSize(13); pdf.text("TECNICA VEHICULAR", pw/2, y, {align:'center'}); y += 5;
                pdf.setDrawColor(139, 195, 74); pdf.setLineWidth(0.8);
                pdf.line(pw/2 - 35, y, pw/2 + 35, y); y += 5;
                pdf.setFontSize(8); pdf.setFont("helvetica","normal"); pdf.setTextColor(100, 116, 139);
                pdf.text(isIndividualPrint ? "Reporte Tecnico de Consulta Individual" : "Analisis Pericial Integral de Antecedentes", pw/2, y, {align:'center'}); y += 8;

                // ===== TARJETA INFO =====
                const cardH = 32;
                const cardW = pw - m*2;
                pdf.setFillColor(255, 255, 255); pdf.setDrawColor(203, 213, 225); pdf.setLineWidth(0.4);
                pdf.roundedRect(m, y, cardW, cardH, 3, 3, 'FD');
                pdf.setFillColor(13, 37, 54); pdf.rect(m, y, 4, cardH, 'F');
                pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.2);
                pdf.line(m + 12, y + cardH/2, m + cardW - 8, y + cardH/2);
                pdf.line(pw/2, y + 4, pw/2, y + cardH - 4);
                const c1 = m + 14, c2 = pw/2 + 10;
                let iy = y + 7;
                pdf.setFontSize(5.5); pdf.setFont("helvetica","bold"); pdf.setTextColor(148, 163, 184);
                pdf.text("PLACA DE RODAJE", c1, iy); pdf.text("FECHA DE EMISION", c2, iy); iy += 6;
                pdf.setFontSize(16); pdf.setFont("helvetica","bold"); pdf.setTextColor(13, 37, 54);
                pdf.text(norm, c1, iy);
                pdf.setFontSize(10); pdf.setFont("helvetica","normal"); pdf.setTextColor(51, 65, 85);
                pdf.text(fechaEmi, c2, iy);
                iy = y + cardH/2 + 5;
                pdf.setFontSize(5.5); pdf.setFont("helvetica","bold"); pdf.setTextColor(148, 163, 184);
                pdf.text("CODIGO CERTIFICADO", c1, iy); pdf.text("TIPO DE ANALISIS", c2, iy); iy += 6;
                pdf.setFontSize(8); pdf.setFont("helvetica","bold"); pdf.setTextColor(13, 37, 54);
                pdf.text(codigoCert, c1, iy);
                pdf.setFontSize(8); pdf.setFont("helvetica","normal"); pdf.setTextColor(51, 65, 85);
                pdf.text(tipoAnalisis, c2, iy);
                y += cardH + 6;

                // ===== DICTAMEN =====
                const gCfg = colorCfg[vStatus] || colorCfg['ok'];
                const vn = String(vText||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
                if ((vStatus==='wa'||vStatus==='ko') && (!vText || vn.includes('trayectoria limpia') || vn.includes('verificado y limpio') || vn.includes('sin alertas'))) {
                    const dTexts = { 'wa': 'Alertas preventivas identificadas en la evaluacion pericial.', 'ko': 'Afectaciones criticas detectadas en la auditoria digital.' };
                    vText = dTexts[vStatus] || vText;
                }
                const vdText = vText || 'Sin observaciones registradas en el analisis pericial.';
                const vdLines = pdf.splitTextToSize(vdText, cardW - 28);
                const vdTextH = Math.min(vdLines.length, 3) * 4;
                const bannerH = 26 + vdTextH;
                pdf.setFillColor(Math.max(0, gCfg.color[0]-15), Math.max(0, gCfg.color[1]-15), Math.max(0, gCfg.color[2]-15));
                pdf.roundedRect(m, y, cardW, bannerH, 3, 3, 'F');
                pdf.setFillColor(gCfg.color[0], gCfg.color[1], gCfg.color[2]);
                pdf.roundedRect(m, y, cardW, bannerH - 2, 3, 3, 'F');
                pdf.setFontSize(6); pdf.setFont("helvetica","bold"); pdf.setTextColor(255, 255, 255);
                pdf.text("DICTAMEN TECNICO FINAL", m + 12, y + 7);
                pdf.setDrawColor(255, 255, 255); pdf.setLineWidth(0.3);
                pdf.line(m + 12, y + 9, m + 55, y + 9);
                pdf.setFontSize(16); pdf.setFont("helvetica","bold");
                pdf.text(gCfg.label, m + 12, y + 17);
                pdf.setFontSize(7.5); pdf.setFont("helvetica","normal"); pdf.setTextColor(255, 255, 255);
                for (let vl = 0; vl < Math.min(vdLines.length, 3); vl++) {
                    pdf.text(vdLines[vl], m + 12, y + 22 + (vl * 4));
                }
                y += bannerH + 6;

                // ===== MATRIZ =====
                if (!isIndividualPrint && itemsParaPDF.length > 0) {
                    pdf.setFontSize(10); pdf.setFont("helvetica","bold"); pdf.setTextColor(13, 37, 54);
                    pdf.text("MATRIZ DE EVALUACION TECNICA", m, y); y += 3;
                    pdf.setDrawColor(13, 37, 54); pdf.setLineWidth(0.5); pdf.line(m, y, m + 50, y); y += 4;
                    const matrizAvail = contentArea - y - 2;
                    const rowH = Math.max(5.5, Math.floor((matrizAvail / (itemsParaPDF.length + 1)) * 10) / 10);
                    pdf.setFillColor(13, 37, 54); pdf.rect(m, y, pw - m*2, rowH, 'F');
                    pdf.setFontSize(5.5); pdf.setFont("helvetica","bold"); pdf.setTextColor(255, 255, 255);
                    pdf.text("N", m + 5, y + rowH*0.65, {align:'center'}); pdf.text("AREA DE EVALUACION", m + 13, y + rowH*0.65);
                    pdf.text("RESULTADO", pw - m - 18, y + rowH*0.65, {align:'center'}); y += rowH;
                    itemsParaPDF.forEach((item, idx) => {
                        if (y > contentArea - 2) { y = newPage(); }
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

                // ===== SECCION II - HALLAZGOS PERICIALES =====
                const cleanMessages = {
                    'sunarp':'El vehiculo no registra anotaciones de robo, embargos ni gravamenes vigentes.',
                    'historial':'Historial de registros y transferencias validado.',
                    'caracteristicas':'Caracteristicas tecnicas originales verificadas.',
                    'lima':'No se registran deudas pendientes en Lima.',
                    'callao':'No se registran deudas pendientes en Callao.',
                    'regiones':'Sin registros de deudas regionales detectadas.',
                    'atu':'Libre de infracciones ante la ATU.',
                    'siniestralidad':'Sin registros de siniestros reportados.',
                    'placa':'Placa en estado activo y vigente.',
                    'foto_pit':'Sin fotopapeletas pendientes.',
                    'citv':'Inspeccion Tecnica aprobada y vigente.',
                    'soat':'Poliza SOAT validada y vigente.',
                    'sutran':'Sin infracciones SUTRAN.',
                    'lunas':'Permiso de lunas oscurecidas vigente.',
                    'fise':'Sin saldos pendientes por FISE GNV.',
                    'gnv':'Sin deuda GNV pendiente.',
                    'denuncias':'Sin denuncias ni requisitorias vigentes.',
                    'boleta':'Sin afectaciones en partida registral.',
                    'tive':'TIVE verificada correctamente.',
                    'propietarios':'Historial de propietarios en regla.',
                    'record':'Sin sanciones graves vigentes.',
                    'otros':'Sin otras afectaciones detectadas.'
                };

                const catHeaderH = 9;
                const minSpaceForCat = catHeaderH + 18;

                // Primera página de hallazgos
                if (isIndividualPrint) {
                    y = Math.max(y + 8, 100);
                } else {
                    y = newPage();
                    pdf.setFontSize(10); pdf.setFont("helvetica","bold"); pdf.setTextColor(13, 37, 54);
                    pdf.text("HALLAZGOS PERICIALES DETALLADOS", m, y); y += 3;
                    pdf.setDrawColor(13, 37, 54); pdf.setLineWidth(0.5); pdf.line(m, y, m + 52, y); y += 7;
                }

                for (let idx = 0; idx < itemsParaPDF.length; idx++) {
                    const item = itemsParaPDF[idx];
                    const iCfg = colorCfg[item.st || 'ok'];
                    const files = item.files || [];

                    if (y > contentArea - minSpaceForCat) { y = newPage(); }

                    // Category header
                    pdf.setFillColor(248, 250, 252); pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.3);
                    pdf.roundedRect(m, y, pw - m*2, catHeaderH, 2, 2, 'FD');
                    pdf.setFillColor(iCfg.color[0], iCfg.color[1], iCfg.color[2]); pdf.rect(m, y, 3, catHeaderH, 'F');
                    pdf.setFontSize(8.5); pdf.setFont("helvetica","bold"); pdf.setTextColor(13, 37, 54);
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
                                    const maxH = ph / 4;
                                    const maxW = pw / 2;
                                    let iW, iH;
                                    const ratio = ip.width / ip.height;
                                    iH = maxH;
                                    iW = iH * ratio;
                                    if (iW > maxW) { iW = maxW; iH = iW / ratio; }
                                    if (ip.height < maxH * 2.83 && ip.width < maxW * 2.83) {
                                        iW = ip.width / 2.83; iH = ip.height / 2.83;
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
                                } else if (f.type === 'pdf') {
                                    const b64 = f.data.split(',')[1]; const bin = atob(b64);
                                    const u8 = new Uint8Array(bin.length); for (let j = 0; j < bin.length; j++) u8[j] = bin.charCodeAt(j);
                                    const pdfDoc = await pdfjs.getDocument({data: u8}).promise;
                                    for (let pN = 1; pN <= pdfDoc.numPages; pN++) {
                                        const pg = await pdfDoc.getPage(pN); const vp = pg.getViewport({scale: 3});
                                        const cnv = document.createElement('canvas'); const ctx = cnv.getContext('2d');
                                        cnv.height = vp.height; cnv.width = vp.width;
                                        await pg.render({canvasContext: ctx, viewport: vp}).promise;
                                        const pImg = cnv.toDataURL('image/jpeg', 0.95);
                                        y = newPage();
                                        var pdfAreaW = pw;
                                        var pdfAreaH = ph - footerH - 6;
                                        var pdfRatio = vp.width / vp.height;
                                        var fitW = pdfAreaW;
                                        var fitH = fitW / pdfRatio;
                                        if (fitH > pdfAreaH) { fitH = pdfAreaH; fitW = fitH * pdfRatio; }
                                        var pdfX = (pw - fitW) / 2;
                                        var pdfY = 6;
                                        pdf.addImage(pImg, 'JPEG', pdfX, pdfY, fitW, fitH);
                                        y = pdfY + fitH + 4;
                                    }
                                }
                            } catch(e) {}
                        }
                    }
                    y += 1;
                }

                // GUIA DE INTERPRETACION
                if (!isIndividualPrint) {
                    y = newPage() + 10;
                    pdf.setFontSize(12); pdf.setFont("helvetica","bold"); pdf.setTextColor(13, 37, 54);
                    pdf.text("GUIA DE INTERPRETACION PERICIAL", pw/2, y, {align:'center'}); y += 5;
                    pdf.setDrawColor(139, 195, 74); pdf.setLineWidth(0.8); pdf.line(pw/2 - 30, y, pw/2 + 30, y); y += 4;
                    pdf.setFontSize(8); pdf.setFont("helvetica","normal"); pdf.setTextColor(100, 116, 139);
                    pdf.text("Criterios utilizados para la determinacion del estado del vehiculo", pw/2, y, {align:'center'}); y += 12;
                    var guiaItems = [
                        {t:'NO CONFORME', c:[239,68,68], d:'Nivel de Riesgo: ALTO', items:['Se recomienda NO proceder con la compra-venta.','Multiples transferencias sospechosas o deudas cuantiosas.','Gravamenes activos, embargos u ordenes de captura.','Datos de motor/chasis no coincidentes.']},
                        {t:'OBSERVADO', c:[245,158,11], d:'Nivel de Riesgo: MEDIO', items:['Requiere validacion fisica minuciosa.','Historial de siniestros leves o papeletas pendientes.','Multas administrativas menores.','Documentacion en proceso de tramite.']},
                        {t:'CONFORME', c:[139,195,74], d:'Nivel de Riesgo: BAJO', items:['Aprobacion tecnica. Listo para transferencia.','Registro de propiedad sin afectaciones.','Ausencia total de deudas o gravamenes.','Revisiones tecnicas constantes y aprobadas.']}
                    ];
                    guiaItems.forEach(function(r) {
                        var rH = 56;
                        if (y + rH > contentArea - 4) { y = newPage() + 10; }
                        pdf.setFillColor(Math.max(0,r.c[0]-20), Math.max(0,r.c[1]-20), Math.max(0,r.c[2]-20));
                        pdf.roundedRect(m, y, pw - m*2, rH, 4, 4, 'F');
                        pdf.setFillColor(r.c[0], r.c[1], r.c[2]);
                        pdf.roundedRect(m, y, pw - m*2, rH - 2, 4, 4, 'F');
                        var px = m + 14;
                        pdf.setFontSize(15); pdf.setFont("helvetica","bold"); pdf.setTextColor(255, 255, 255);
                        pdf.text(r.t, px, y + 12);
                        pdf.setFontSize(8); pdf.setFont("helvetica","normal");
                        pdf.text(r.d, px, y + 18);
                        pdf.setDrawColor(255, 255, 255); pdf.setLineWidth(0.3);
                        pdf.line(px, y + 22, pw - m - 14, y + 22);
                        pdf.setFontSize(8.5); pdf.setFont("helvetica","normal");
                        var gy = y + 29;
                        r.items.forEach(function(item) {
                            pdf.setFont("helvetica","bold"); pdf.text('\u2022', px, gy);
                            pdf.setFont("helvetica","normal"); pdf.text(item, px + 5, gy);
                            gy += 5.5;
                        });
                        y += rH + 10;
                    });
                }

                // FOOTER EN TODAS LAS PAGINAS
                const pTotal = typeof pdf.internal.getNumberOfPages === 'function' ? pdf.internal.getNumberOfPages() : pdf.internal.pages.length - 1;
                for (let i=1; i<=pTotal; i++) {
                    pdf.setPage(i);
                    pdf.setFillColor(13, 37, 54); pdf.rect(0, ph - 10, pw, 10, 'F');
                    pdf.setFillColor(139, 195, 74); pdf.rect(0, ph - 10, pw, 1, 'F');
                    pdf.setFontSize(6.5); pdf.setFont("helvetica","normal"); pdf.setTextColor(200, 210, 220);
                    pdf.text('Filtro Vehicular Plus  |  www.filtrovehicularperu.com', m, ph - 4.5);
                    pdf.text(codigoCert + '  |  Pag. ' + i + '/' + pTotal, pw - m, ph - 4.5, {align:'right'});
                }

                const prefix = isIndividualPrint ? 'Certificado_Individual' : 'Certificado_Vehicular';
                pdf.save(prefix + '_' + norm + '.pdf');

            } catch (error) {
                console.error("Error PDF:", error);
                alert("Error al generar el PDF. Intenta de nuevo.");
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        }

    

// =========================================


        function openAccess() { document.getElementById('accessModal').style.display = 'flex'; }
        function closeAccess() { document.getElementById('accessModal').style.display = 'none'; }
