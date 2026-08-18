/* ============================================================
   DUPLICADO CITV — el certificado en papel
   ------------------------------------------------------------
   Aquí vive el documento: su hoja A4, su tipografía y sus tablas.
   Se entrega como un documento HTML completo que se pinta dentro de
   un <iframe>, no dentro de la aplicación.

   Por qué un marco aparte y no un trozo más del DOM: el certificado
   trae su propio `* { margin:0 }`, sus tablas a 8 px y un `@page A4`.
   Metido en la aplicación se pelearía con base.css en las dos
   direcciones —el papel saldría descuadrado y el resto de la pantalla,
   tocada— y para evitarlo habría que reescribir cada selector. Dentro
   del iframe el documento es el mismo que sale de citv-emisor.html,
   píxel a píxel, y `contentWindow.print()` imprime solo esa hoja.
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  // La hoja a 96 ppp: 210 × 297 mm. Es la medida que usa la vista previa
  // para calcular cuánto hay que encoger el marco para que quepa.
  var A4_ANCHO_PX = 794;
  var A4_ALTO_PX  = 1123;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* El estilo del documento, tal cual está en citv-emisor.html. Solo se
     quitan tres cosas que allí eran del taller y aquí estorban: el zoom
     de pantalla (scale 1.3), la sombra de la hoja y el marco de puntos
     que salía al pasar por encima del logo — aquí nadie va a hacer clic
     para cambiarlo. */
  var CERT_CSS = `
* { margin: 0; padding: 0; box-sizing: border-box; }

html, body { background: #ffffff; }

.cert-container { display: flex; justify-content: center; width: 100%; }

.page {
  font-family: 'Helvetica', 'Arial', sans-serif;
  width: 210mm;
  min-height: 297mm;
  background: white;
  padding: 25mm 10mm 10mm 10mm;
  position: relative;
}

.page-background {
  position: absolute; top: 0; left: 0;
  width: 100%; height: 100%;
  background-size: cover; background-position: center;
  z-index: 0; pointer-events: none;
}

.page-content { position: relative; z-index: 1; }

/* Cabecera — tres columnas que no se pisan
   ------------------------------------------------------------------
   El bloque del centro estaba absoluto y centrado sobre la página, y el
   logo del cliente, suelto a la izquierda. Con un logo
   ancho —los hay que son casi una banda— la caja del logo llegaba hasta
   debajo de «MINISTERIO DE TRANSPORTES…» y las letras se tocaban.

   Ahora son tres columnas de una fila: los dos laterales miden lo mismo
   (194 px), así que el centro sigue cayendo en mitad de la página como
   antes, pero por reparto y no por casualidad. Ningún logo puede ya
   invadir el texto: como mucho llena su columna. Al del medio le quedan
   330 px y la línea del ministerio ocupa 318, que por eso va sin
   partir. */
.header { display: flex; align-items: center; margin-bottom: 10px; min-height: 80px; }

.logo-box {
  flex: 0 0 194px;
  height: 80px; min-height: 0;
  background: transparent;
  display: flex; align-items: center; justify-content: flex-start;
  padding-left: 10px;
  position: relative; overflow: hidden;
}
.logo-box img { max-width: 100%; max-height: 100%; width: auto; height: 100%; object-fit: contain; }

.header-center { flex: 1 1 auto; min-width: 0; text-align: center; }
.header-center .ministry { font-size: 11px; font-weight: bold; white-space: nowrap; }
.header-center .company  { font-size: 14px; font-weight: bold; margin: 3px 0; }
.header-center .address  { font-size: 8px; }

.header-right { flex: 0 0 194px; text-align: center; }
.mtc-letters { font-size: 20px; font-weight: bold; font-style: italic; color: red; line-height: 0.85; }

.main-title  { text-align: center; font-size: 12px; font-weight: bold; margin: 10px 0 5px 0; }
.cert-number { text-align: center; font-size: 10px; margin-bottom: 8px; }

.info-bar { display: flex; border: 1px solid black; margin-bottom: 5px; font-size: 9px; }
.info-bar > div { flex: 1; padding: 2px 5px; border-right: 1px solid black; display: flex; align-items: center; }
.info-bar > div:last-child { border-right: none; }
.info-bar .label { font-weight: bold; margin-right: 5px; }

.section-header {
  background: rgba(192, 192, 192, 0.5);
  padding: 4px 5px; font-weight: bold; font-size: 9px;
  border: 1px solid black; margin-top: 8px; height: 18px;
}

table { width: 100%; border-collapse: collapse; font-size: 8px; }
td, th { border: 1px solid black; padding: 1px 3px; text-align: center; vertical-align: middle; }
.text-left { text-align: left; }
.bold { font-weight: bold; }

.vehicle-table-new { width: 100%; border-collapse: collapse; font-size: 8px; margin-top: 5px; }
.vehicle-table-new td { padding: 2px 3px; vertical-align: middle; text-align: left; border: 1px solid black; }
.vehicle-table-new .num   { width: 18px; text-align: center; font-weight: bold; }
.vehicle-table-new .label { font-weight: bold; width: 65px; color: #333; }
.vehicle-table-new .value { width: 90px; }
#cTipoUso { white-space: nowrap; font-size: 7px; letter-spacing: -0.2px; }

.equip-table th { background: transparent; font-weight: bold; }

.results-section { margin-top: 5px; }
.brake-header    { background: transparent; font-weight: bold; }
.brake-subheader { background: transparent; font-size: 7px; }

.tests-grid { display: grid; grid-template-columns: 1fr 1fr 1.3fr 1.2fr; gap: 5px; margin-top: 5px; }
.test-box table { height: 100%; }
.test-box th { background: transparent; font-weight: bold; }

.emissions-table { margin-top: 5px; }
.emissions-table td { font-size: 7px; }

.defects-table { margin-top: 5px; }
.defects-table th { background: rgba(192, 192, 192, 0.5); }

.result-section { display: flex; gap: 10px; margin-top: 8px; align-items: flex-start; }
.result-table-container { flex: 1.5; }
.result-table th { background: transparent; }
.result-table td { height: 25px; }

.seal-signature { flex: 1; display: flex; flex-direction: column; align-items: center; }
.seal-box {
  width: 150px; height: 80px;
  display: flex; align-items: center; justify-content: center;
  position: relative; overflow: hidden;
}
.seal-box img { max-width: 100%; max-height: 100%; width: auto; height: 100%; object-fit: contain; }
.signature-line { margin-top: 15px; border-top: 1px solid black; width: 150px; text-align: center; padding-top: 3px; font-size: 8px; }

.footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 10px; }
.mtc-circle { width: 50px; height: 50px; border-radius: 50%; background: #1a237e; margin-top: 20px; }
.ci-code { font-size: 16px; font-weight: bold; margin-top: 20px; }
.ci-black { color: black; }
.ci-red { color: red; }

@media print {
  @page { size: A4 portrait; margin: 0; }

  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }

  html, body {
    width: 210mm; height: auto;
    margin: 0 !important; padding: 0 !important;
    background: white !important; overflow: visible !important;
  }

  .cert-container { width: 100% !important; margin: 0 !important; padding: 0 !important; }

  .page {
    width: 210mm !important;
    height: 297mm !important;
    min-height: 297mm !important;
    margin: 0 !important;
    padding: 18mm 10mm 5mm 10mm !important;
    page-break-after: avoid;
    page-break-inside: avoid;
    overflow: hidden !important;
    position: relative !important;
    left: 0 !important; top: 0 !important;
    transform: none !important;
  }

  /* Apretado para que quepa en una sola hoja. */
  .footer { margin-top: 3px !important; }
  .mtc-circle { margin-top: 5px !important; }
  .ci-code { margin-top: 5px !important; }
  .section-header { margin-top: 4px !important; }
  .result-section { margin-top: 4px !important; }

  .page-background {
    position: absolute !important; top: 0 !important; left: 0 !important;
    width: 100% !important; height: 100% !important;
    background-size: cover !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .page-content { position: relative !important; z-index: 1 !important; }
}
`;

  /* El cuerpo del certificado. Las pruebas de frenos, alineamiento,
     luces, suspensión y emisiones van fijas: son las del formato, no
     salen de ninguna consulta. Lo que cambia es la cabecera, los veinte
     cuadros del vehículo y el resultado. */
  function html(d) {
    return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<title>Certificado CITV - MTC - ${esc(d.placa)}</title>
<style>${CERT_CSS}</style>
</head><body>
<div class="cert-container">
  <div class="page">
    <div class="page-background" style="background-image:url(assets/citv/fondo.jpg)"></div>
    <div class="page-content">

      <div class="header">
        <div class="logo-box"><img src="${esc(d.logo)}" alt=""></div>
        <div class="header-center">
          <div class="ministry">MINISTERIO DE TRANSPORTES Y COMUNICACIONES - MTC</div>
          <div class="company">CENTRO DE INSPECCION TECNICA VEHICULAR<br><span>${esc(d.empresa)}</span></div>
          <div class="address">${d.direccionHtml}</div>
        </div>
        <div class="header-right"><div class="mtc-letters">M<br>T<br>C</div></div>
      </div>

      <div class="main-title">CERTIFICADO DE INSPECCION TECNICA VEHICULAR</div>
      <div class="cert-number">N° : <span>${esc(d.numCert)}</span></div>

      <div class="info-bar">
        <div><span class="label">Tipo de Inspección</span> <span>${esc(d.tipo)}</span></div>
        <div><span class="label">Fecha de Inspección</span> <span>${esc(d.fecha)}</span></div>
        <div><span class="label">Informe de Inspección N°</span> <span>${esc(d.informe)}</span></div>
      </div>

      <div class="section-header">I.&nbsp;&nbsp;&nbsp;CARACTERISTICAS DEL VEHICULO</div>
      <table class="vehicle-table-new">
        <tr>
          <td class="num">1</td><td class="label">Placa</td><td class="value">${esc(d.placa)}</td>
          <td class="num">8</td><td class="label">N° Motor</td><td class="value">${esc(d.motor)}</td>
          <td class="num">15</td><td class="label">N° Ruedas</td><td class="value">${esc(d.ruedas)}</td>
        </tr>
        <tr>
          <td class="num">2</td><td class="label">Tipo Uso</td><td class="value" id="cTipoUso">${esc(d.tipoUso)}</td>
          <td class="num">9</td><td class="label">Tipo Combus</td><td class="value">${esc(d.combustible)}</td>
          <td class="num">16</td><td class="label">N° Asientos</td><td class="value">${esc(d.asientos)}</td>
        </tr>
        <tr>
          <td class="num">3</td><td class="label">Carrocería</td><td class="value">${esc(d.carroceria)}</td>
          <td class="num">10</td><td class="label">N° Cilindros</td><td class="value">${esc(d.cilindros)}</td>
          <td class="num">17</td><td class="label">N° Pasajer.</td><td class="value">${esc(d.pasajeros)}</td>
        </tr>
        <tr>
          <td class="num">4</td><td class="label">Marca</td><td class="value">${esc(d.marca)}</td>
          <td class="num">11</td><td class="label">Cilindrada</td><td class="value">${esc(d.cilindrada)}</td>
          <td class="num">18</td><td class="label">Color</td><td class="value">${esc(d.color)}</td>
        </tr>
        <tr>
          <td class="num">5</td><td class="label">Modelo</td><td class="value">${esc(d.modelo)}</td>
          <td class="num">12</td><td class="label">Peso Neto</td><td class="value">${esc(d.pesoNeto)}</td>
          <td class="num">19</td><td class="label">Estado</td><td class="value">${esc(d.estado)}</td>
        </tr>
        <tr>
          <td class="num">6</td><td class="label">Año Fab</td><td class="value">${esc(d.anioFab)}</td>
          <td class="num">13</td><td class="label">Peso Bruto</td><td class="value">${esc(d.pesoBruto)}</td>
          <td class="num">20</td><td class="label">Placa Anterior</td><td class="value">${esc(d.placaAnterior)}</td>
        </tr>
        <tr>
          <td class="num">7</td><td class="label">N° Serie</td><td class="value">${esc(d.serie)}</td>
          <td class="num">14</td><td class="label">Carga Útil</td><td class="value">${esc(d.cargaUtil)}</td>
          <td class="num"></td><td class="label"></td><td class="value"></td>
        </tr>
      </table>

      <div class="section-header">II.&nbsp;&nbsp;&nbsp;DATOS DE LOS EQUIPOS</div>
      <table class="equip-table">
        <tr>
          <th style="width:40px;">CITV</th>
          <th>${esc(d.empresa)}</th>
          <th>Frenómetro</th><th>Alineador</th>
          <th>Analizador u Opacímetro</th><th>Regloscopio/ Luxómetro</th><th>Banco de Suspensión</th>
        </tr>
        <tr>
          <td>Línea</td><td>MIXTA</td>
          <td>Equipo N° 20101602</td><td>Equipo N° 20101602</td><td>Equipo N° 20101602</td>
          <td>Equipo N° TECNOLUX-0331</td><td>Equipo N° 20101602</td>
        </tr>
      </table>

      <div class="section-header">III.&nbsp;&nbsp;&nbsp;RESULTADOS OBTENIDOS</div>

      <table class="results-section">
        <tr><th colspan="16" class="brake-header">PRUEBA DE FRENOS</th></tr>
        <tr class="brake-header">
          <th colspan="7">FRENO DE SERVICIO</th>
          <th colspan="5">FRENO DE ESTACIONAMIENTO</th>
          <th colspan="4">FRENO DE EMERGENCIA</th>
        </tr>
        <tr class="brake-subheader">
          <td>Ejes</td><td>Peso<br>(Kg)</td><td>Fuerza (KN)<br>Der</td><td>Fuerza (KN)<br>Izq</td>
          <td>Desqui.<br>Rmo %</td><td>Eficiencia<br>%</td><td>Resultado</td>
          <td>Ejes</td><td>Peso<br>(Kg)</td><td>Fuerza (KN)<br>Der</td><td>Fuerza (KN)<br>Izq</td><td>Eficiencia<br>%</td>
          <td>Ejes</td><td>Fuerza (KN)<br>Der</td><td>Fuerza (KN)<br>Izq</td><td>Resultado</td>
        </tr>
        <tr>
          <td>1º</td><td>750.00</td><td>2.20</td><td>2.30</td><td>4.35</td>
          <td rowspan="5">60.70</td><td rowspan="5">APROBADO</td>
          <td>1º</td><td>750.00</td><td>0.00</td><td>0.00</td><td rowspan="5">57.48</td>
          <td>1º</td><td>750.00</td><td>0.03</td><td rowspan="5">0.00</td>
        </tr>
        <tr>
          <td>2º</td><td>550.00</td><td>1.60</td><td>1.65</td><td>3.03</td>
          <td>2º</td><td>550.00</td><td>1.50</td><td>1.60</td>
          <td>2º</td><td>550.00</td><td>0.03</td>
        </tr>
        <tr>
          <td>3º</td><td>0.00</td><td>0.00</td><td>0.00</td><td>0.00</td>
          <td>3º</td><td>0.00</td><td>0.00</td><td>0.00</td>
          <td>3º</td><td>0.00</td><td>0.03</td>
        </tr>
        <tr>
          <td>4º</td><td>0.00</td><td>0.00</td><td>0.00</td><td>0.00</td>
          <td>4º</td><td>0.00</td><td>0.00</td><td>0.00</td>
          <td>4º</td><td>0.00</td><td>0.03</td>
        </tr>
        <tr>
          <td>5º</td><td>0.00</td><td>0.00</td><td>0.00</td><td>0.00</td>
          <td>5º</td><td>0.00</td><td>0.00</td><td>0.00</td>
          <td>5º</td><td>0.00</td><td>0.03</td>
        </tr>
      </table>

      <div class="tests-grid">
        <div class="test-box"><table>
          <tr><th colspan="3">PRUEBA DE ALINEAMIENTO</th></tr>
          <tr class="brake-subheader"><td>Ejes</td><td>desviación<br>(m/Km)</td><td>Resultado</td></tr>
          <tr><td>1º</td><td>2.10</td><td>APROBADO</td></tr>
          <tr><td>2º</td><td>1.00</td><td>APROBADO</td></tr>
          <tr><td>3º</td><td>0.00</td><td></td></tr>
          <tr><td>4º</td><td>0.00</td><td></td></tr>
          <tr><td>5º</td><td>0.00</td><td></td></tr>
        </table></div>

        <div class="test-box"><table>
          <tr><th colspan="3">PROF. DE NEUMATICOS</th></tr>
          <tr class="brake-subheader"><td>Ejes</td><td>Medida<br>Obtenida (s)</td><td>Resultado</td></tr>
          <tr><td>1º</td><td>3.10</td><td>APROBADO</td></tr>
          <tr><td>2º</td><td>3.00</td><td>APROBADO</td></tr>
          <tr><td>3º</td><td>0.00</td><td></td></tr>
          <tr><td>4º</td><td></td><td></td></tr>
          <tr><td>5º</td><td></td><td></td></tr>
        </table></div>

        <div class="test-box"><table>
          <tr><th colspan="5">PRUEBA DE LUCES</th></tr>
          <tr class="brake-subheader">
            <td>Tipo de Luz</td><td>Medida Obtenida (Lux) c/<br>Der</td><td>Medida Obtenida (Lux) c/<br>Izq</td>
            <td>Alineamiento</td><td>Resultado</td>
          </tr>
          <tr><td>Bajas</td><td>24.00</td><td>25.00</td><td>OK</td><td>APROBADO</td></tr>
          <tr><td>Altas</td><td>41.00</td><td>42.00</td><td>OK</td><td>APROBADO</td></tr>
          <tr><td>Alte Adicional</td><td>—</td><td>—</td><td></td><td></td></tr>
          <tr><td>Neblineros</td><td></td><td></td><td></td><td></td></tr>
          <tr><td colspan="5" style="font-size:6px; text-align:left;">(1). Indicar la desviación del haz de luz a la IZQ(-) / DER(+) / INF(-) / SUP(+)</td></tr>
        </table></div>

        <div class="test-box"><table>
          <tr><th colspan="4">PRUEBA DE SUSPENSION</th></tr>
          <tr class="brake-subheader"><td colspan="2">Delantera (%)</td><td colspan="2">Posterior (%)</td></tr>
          <tr><td>Izq.</td><td>63.00</td><td>Izq.</td><td>60.00</td></tr>
          <tr><td>Der.</td><td>62.00</td><td>Der.</td><td>61.00</td></tr>
          <tr><td>Desv.</td><td>1.00</td><td>Desv.</td><td>1.00</td></tr>
          <tr><td>Resultado</td><td>APROBA</td><td>Resultado</td><td>APROBA</td></tr>
          <tr><th colspan="2">Resultado Final:</th><td colspan="2">APROBADO</td></tr>
        </table></div>
      </div>

      <table class="emissions-table">
        <tr>
          <td rowspan="2" class="bold" style="width:80px;">EMISIONES<br>DE GASES<br><span style="font-size:6px;">(no aplica para<br>veh.electricos)</span></td>
          <td>T° Aceite (°C)</td><td>80</td>
          <td>CO Ralenti (%)</td><td>0.23</td>
          <td>CO Acel (%)</td><td>0.24</td>
          <td rowspan="2">Resultado<br><span class="bold">APROBADO</span></td>
          <td rowspan="2" class="bold" style="width:70px;">EMISIONES<br>SONORAS</td>
          <td rowspan="2">Sonómetro<br>(dB)<br><span>78.00</span></td>
          <td rowspan="2">Resultado<br><span class="bold">APROBADO</span></td>
        </tr>
        <tr>
          <td>RPM</td><td>2500</td>
          <td>CO + CO2 Ralenti (%)</td><td>14.23</td>
          <td>CO + CO2 Acel (%)</td><td>10.24</td>
        </tr>
        <tr>
          <td></td>
          <td>Opacidad (m^-1)</td><td>--</td>
          <td>HC Ralenti (ppm)</td><td>59.00</td>
          <td>HC Acel (ppm)</td><td>60.00</td>
          <td colspan="4"></td>
        </tr>
      </table>

      <div class="section-header">IV.&nbsp;&nbsp;&nbsp;DEFECTOS ENCONTRADOS</div>
      <table class="defects-table">
        <tr><th style="width:80px;">CODIGO</th><th>INTERPRETACION DE DEFECTOS</th><th style="width:100px;">CLASIFICACION</th></tr>
        <tr><td></td><td class="text-left">NO REGISTRA FALLAS</td><td></td></tr>
        <tr><td colspan="3" class="text-left">OBSERVACIONES: <span>${esc(d.obs)}</span></td></tr>
      </table>
      <div style="font-size:7px; margin:3px 0;">NOTA: Las observaciones efectuadas deben ser subsanadas antes de la siguiente Inspección Técnica Vehicular.</div>

      <div class="section-header">V.&nbsp;&nbsp;&nbsp;RESULTADO DE LA INSPECCION TECNICA VEHICULAR</div>

      <div class="result-section">
        <div class="result-table-container">
          <table class="result-table">
            <tr><th>Resultado de la Inspección</th><th>Vigencia del certificado</th><th>Fecha de próxima inspección</th></tr>
            <tr>
              <td class="bold" style="font-size:12px;">${esc(d.resultado)}</td>
              <td>${esc(d.vigencia)}</td>
              <td>${esc(d.proxima)}</td>
            </tr>
          </table>
        </div>
        <div class="seal-signature">
          <div class="seal-box"><img src="assets/citv/firma.png" alt=""></div>
          <div class="signature-line"><strong>Firma del Ingeniero Supervisor</strong></div>
        </div>
      </div>

      <div class="footer">
        <div class="mtc-circle"></div>
        <div class="ci-code"><span class="ci-black">CI- 228-</span><span class="ci-red">${esc(d.correlativo)}</span></div>
      </div>

    </div>
  </div>
</div>
</body></html>`;
  }

  Consultia.CitvCertificado = {
    html: html,
    ANCHO_PX: A4_ANCHO_PX,
    ALTO_PX: A4_ALTO_PX,
  };
})();
