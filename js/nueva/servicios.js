/* ============================================================
   LO QUE RODEA A LAS CONSULTAS
     · Consultas Vehiculares gratuitas: las 21 tarjetas con el logo de
       cada fuente (assets/services/), la primera lleva a las regiones.
     · Infracciones por regiones: las 17, con su logo (assets/regions/)
       y un filtro.
     · Los tres trámites: SOAT y Lunas escriben a WhatsApp; el Duplicado
       CITV abre su trámite (js/modules/citv-aviso.js).
     · El aviso de saldo bajo.
     · Mis datos: nombre y teléfono, editables.
============================================================ */
(function () {
  'use strict';
  var C = window.Consultia = window.Consultia || {};
  var NV = C.NV;
  var $ = NV.$;
  var esc = NV.esc;

  /* ── Consultas Vehiculares gratuitas ─────────────────────────
     El orden es el de siempre. `logo` es el archivo en assets/services;
     la que no lo tiene lleva su icono. */
  var SERVICIOS = [
    { nombre: 'Infracciones por regiones', meta: '17 regiones disponibles', logo: 'multas-region.svg', ir: 'regiones' },
    { nombre: 'Propiedad Vehicular SUNARP', logo: 'sunarp-propiedad.png', url: 'https://consultavehicular.sunarp.gob.pe/consulta-vehicular/inicio' },
    { nombre: 'Historial Completo por Placa', logo: 'historial-placa.png', url: 'https://sprl.sunarp.gob.pe/sprl/ingreso' },
    { nombre: 'Cambio de Características', logo: 'cambio-caracteristicas.png', url: 'https://psi.sunarp.gob.pe/ProyOrganizaSII/pages/solicitudes/solicitudCambio.jsf' },
    { nombre: 'Deudas y Multas SAT Lima', logo: 'sat-lima.png', url: 'https://www.sat.gob.pe/VirtualSAT/principal.aspx' },
    { nombre: 'Deudas y Multas SAT Callao', logo: 'sat-callao.png', url: 'https://pagopapeletascallao.pe/' },
    { nombre: 'Papeletas de Tránsito ATU', logo: 'papeletas-atu.png', url: 'https://pasarela.atu.gob.pe/' },
    { nombre: 'Siniestralidad por Placa', logo: 'siniestralidad.png', url: 'https://servicios.sbs.gob.pe/reportesoat/' },
    { nombre: 'Estado de Placa', logo: 'estado-placa.png', url: 'https://www.placas.pe/#/home/verificarEstadoPlaca' },
    { nombre: 'Papeletas de Infracción por Cinemómetro', logo: 'foto-pit.png', url: 'https://webexterno.sutran.gob.pe/WebExterno/Pages/frmPapeletasCinemometro.aspx' },
    { nombre: 'Inspección Técnica Vehicular CITV', logo: 'citv.png', url: 'https://rec.mtc.gob.pe/Citv/ArConsultaCitv' },
    { nombre: 'Vigencia del SOAT', logo: 'soat.png', url: 'https://www.apeseg.org.pe/consultas-soat/' },
    { nombre: 'Papeletas SUTRAN', logo: 'sutran.png', url: 'https://www.sutran.gob.pe/consultas/record-de-infracciones/record-de-infracciones/' },
    { nombre: 'Lunas Oscurecidas', logo: 'lunas-oscurecidas.png', url: 'https://sistemas.policia.gob.pe/consultalunas/ConsultarServicioLunas' },
    { nombre: 'FISE GNV Subsidio Gas', logo: 'fise-gnv.png', url: 'https://fise.minem.gob.pe:23308/consulta-taller/pages/consultaTaller/inicio' },
    { nombre: 'Consulta Deuda GNV', logo: 'deuda-gnv.png', url: 'https://infogas.com.pe/consulta-placa/' },
    { nombre: 'Denuncias y Órdenes de Captura', logo: 'denuncias.png', url: 'https://www.sat.gob.pe/VirtualSAT/modulos/Capturas.aspx' },
    { nombre: 'Boleta Informativa', logo: 'boleta.png', url: 'https://sprl.sunarp.gob.pe/sprl/ingreso' },
    { nombre: 'Tarjeta de Propiedad (TIVE)', logo: 'tive.png', url: 'https://www2.sunarp.gob.pe/recuperar-codigo-verificacion-tive/inicio' },
    { nombre: 'Historial de Propietarios Inscritos', logo: 'propietarios.png', url: 'https://sprl.sunarp.gob.pe/sprl/ingreso' },
    { nombre: 'Récord de Conductor (DNI)', logo: 'record-conductor.png', url: 'https://recordconductor.mtc.gob.pe/' }
  ];

  var GRUPOS_GRATIS = [
    { id: 'propiedad', titulo: 'Propiedad e historial' },
    { id: 'infracciones', titulo: 'Papeletas e infracciones' },
    { id: 'soat', titulo: 'SOAT e inspección' },
    { id: 'otros', titulo: 'Trámites y GNV' }
  ];
  var DATOS_GRATIS = {
    'Infracciones por regiones': ['infracciones', 'Explora las consultas de 17 regiones disponibles'],
    'Propiedad Vehicular SUNARP': ['propiedad', 'Datos del vehículo en SUNARP'],
    'Historial Completo por Placa': ['propiedad', 'Historial registral por placa'],
    'Cambio de Características': ['propiedad', 'Trámite de cambio en SUNARP'],
    'Deudas y Multas SAT Lima': ['infracciones', 'Consulta de deuda en Lima'],
    'Deudas y Multas SAT Callao': ['infracciones', 'Consulta de deuda en Callao'],
    'Papeletas de Tránsito ATU': ['infracciones', 'Consulta de papeletas ATU'],
    'Siniestralidad por Placa': ['soat', 'Consulta de siniestralidad'],
    'Estado de Placa': ['propiedad', 'Verificación del estado de placa'],
    'Papeletas de Infracción por Cinemómetro': ['infracciones', 'Infracciones por cinemómetro'],
    'Inspección Técnica Vehicular CITV': ['soat', 'Consulta de revisión técnica'],
    'Vigencia del SOAT': ['soat', 'Consulta de vigencia'],
    'Papeletas SUTRAN': ['infracciones', 'Récord de infracciones SUTRAN'],
    'Lunas Oscurecidas': ['otros', 'Consulta del permiso de lunas'],
    'FISE GNV Subsidio Gas': ['otros', 'Consulta FISE GNV'],
    'Consulta Deuda GNV': ['otros', 'Consulta de deuda por placa'],
    'Denuncias y Órdenes de Captura': ['infracciones', 'Consulta de capturas SAT Lima'],
    'Boleta Informativa': ['propiedad', 'Acceso a la boleta en SUNARP'],
    'Tarjeta de Propiedad (TIVE)': ['propiedad', 'Verificación de la TIVE'],
    'Historial de Propietarios Inscritos': ['propiedad', 'Historial registral en SUNARP'],
    'Récord de Conductor (DNI)': ['infracciones', 'Consulta de récord por DNI']
  };

  var REGIONES = [
    { nombre: 'Lima', detalle: 'SAT Lima · papeletas de tránsito', logo: 'region-lima.png', url: 'https://www.sat.gob.pe/WebSiteV9/TributosMultas/Papeletas/ConsultasPapeletas' },
    { nombre: 'Callao', detalle: 'SAT Callao · papeletas y multas', logo: 'region-callao.webp', url: 'https://pagopapeletascallao.pe/' },
    { nombre: 'Arequipa', detalle: 'Municipalidad · infracciones y permisos', logo: 'region-arequipa.webp', url: 'https://www.muniarequipa.gob.pe/oficina-virtual/c0nInfrPermisos/faltas/papeletas.php' },
    { nombre: 'Trujillo', detalle: 'SATT · récord de infracciones', logo: 'region-trujillo.webp', url: 'https://www.satt.gob.pe/servicios/record-de-infracciones' },
    { nombre: 'Piura', detalle: 'Municipalidad · multas administrativas', logo: 'region-piura.webp', url: 'http://www.munipiura.gob.pe/consulta-de-multas-administrativas#buscar-por-placa' },
    { nombre: 'Cusco', detalle: 'Municipalidad · infracciones de tránsito', logo: 'region-cusco.webp', url: 'https://cusco.gob.pe/informatica/infracciones' },
    { nombre: 'Chiclayo', detalle: 'SATCH · récord de infracciones', logo: 'region-chiclayo.webp', url: 'https://virtualsatch.satch.gob.pe/virtualsatch/record_infracciones/buscar_placa_' },
    { nombre: 'Huancayo', detalle: 'SATH · multas administrativas', logo: 'region-huancayo.svg', url: 'https://www.sath.gob.pe/tributos.html#multas-administrativas' },
    { nombre: 'Puno', detalle: 'Municipalidad · papeletas de tránsito', logo: 'region-puno.png', url: 'https://papeletas.munipuno.gob.pe/' },
    { nombre: 'Cajamarca', detalle: 'SAT Cajamarca · consultas de tránsito', logo: 'region-cajamarca.webp', url: 'https://www.satcajamarca.gob.pe/consultas' },
    { nombre: 'Ica', detalle: 'SATICA · papeletas de tránsito', logo: 'region-ica.webp', url: 'https://m.satica.gob.pe/consultapapeletas_web.php' },
    { nombre: 'Huánuco', detalle: 'Municipalidad · papeletas por placa', logo: 'region-huanuco.webp', url: 'https://www.munihuanuco.gob.pe/gt_consultapapeletas_placa.php' },
    { nombre: 'Tacna', detalle: 'Municipalidad · papeletas de tránsito', logo: 'region-tacna.webp', url: 'https://www.munitacna.gob.pe/pagina/sf/servicios/papeletas' },
    { nombre: 'Chachapoyas', detalle: 'Municipalidad · papeletas de tránsito', logo: 'region-chachapoyas.webp', url: 'https://app.munichachapoyas.gob.pe/servicios/consulta_papeletas/app/papeletas.php' },
    { nombre: 'Tarapoto', detalle: 'SAT-T · papeletas de tránsito', logo: 'region-tarapoto-clean.png', url: 'https://www.sat-t.gob.pe/#consulta-papeletas' },
    { nombre: 'Coronel Portillo', detalle: 'Municipalidad · consulta vehicular', logo: 'region-coronel-portillo-clean.png', url: 'http://consultas.municportillo.gob.pe:85/consultaVehiculo/consulta/' },
    { nombre: 'Huarmey', detalle: 'Municipalidad · papeletas de tránsito', logo: 'region-huarmey-clean.png', url: 'https://munihuarmey.gob.pe/consultar-papeletas/' }
  ];

  /* Una tarjeta: el logo (o el icono), el nombre y la marca de que abre
     fuera. Son enlaces de verdad: clic central, «abrir en pestaña»… */
  function tarjeta(s, carpeta) {
    var logo = s.logo
      ? '<img src="assets/' + carpeta + '/' + esc(s.logo) + '" alt="" width="48" height="48" decoding="async" loading="lazy">'
      : '<svg><use href="#i-region"/></svg>';
    var texto = s.meta
      ? '<span class="nv-servicio-txt"><b>' + esc(s.nombre) + '</b><small>' + esc(s.meta) + '</small></span>'
      : (s.detalle
        ? '<span class="nv-servicio-txt"><b>' + esc(s.nombre) + '</b><small>' + esc(s.detalle) + '</small></span>'
        : '<span class="nv-servicio-txt"><b>' + esc(s.nombre) + '</b></span>');
    if (s.ir) {
      return '<a class="nv-servicio es-oscuro" href="#' + s.ir + '">' +
        '<span class="nv-servicio-logo">' + logo + '</span>' + texto +
        '<svg class="nv-servicio-ir"><use href="#i-ir"/></svg></a>';
    }
    return '<a class="nv-servicio" href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer" data-nombre="' + esc(NV.llano(s.nombre + ' ' + (s.detalle || ''))) + '">' +
      texto + '<span class="nv-servicio-logo">' + logo + '</span>' +
      '<span class="nv-gratis-estado" aria-hidden="true"></span></a>';
  }

  function tarjetaGratis(s) {
    var datos = DATOS_GRATIS[s.nombre] || ['otros', s.meta || 'Abrir consulta'];
    var destino = s.ir
      ? 'href="#' + esc(s.ir) + '"'
      : 'href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer"';
    var logo = s.logo
      ? '<img src="assets/services/' + esc(s.logo) + '" alt="" width="44" height="44" decoding="async" loading="lazy">'
      : '<svg aria-hidden="true"><use href="#i-region"/></svg>';
    return '<a class="nv-gratis-tarjeta' + (s.ir ? ' es-regiones' : '') + '" ' + destino + '>' +
      '<span class="nv-gratis-texto"><b>' + esc(s.nombre) + '</b><small>' + esc(datos[1]) + '</small></span>' +
      '<span class="nv-servicio-logo">' + logo + '</span>' +
      '<span class="nv-gratis-estado" aria-hidden="true"></span>' +
    '</a>';
  }

  function pintarServicios() {
    $('nvServicios').innerHTML = GRUPOS_GRATIS.map(function (grupo) {
      var lista = SERVICIOS.filter(function (s) { return (DATOS_GRATIS[s.nombre] || ['otros'])[0] === grupo.id; });
      return '<section class="nv-gratis-grupo" aria-labelledby="nvGratisGrupo-' + grupo.id + '">' +
        '<div class="nv-gratis-grupo-cab"><h3 id="nvGratisGrupo-' + grupo.id + '">' + esc(grupo.titulo) + '</h3>' +
        '<span>' + lista.length + '</span></div>' +
        '<div class="nv-gratis-grid">' + lista.map(tarjetaGratis).join('') + '</div>' +
      '</section>';
    }).join('');
    var cantidad = $('nvGratisCantidad');
    if (cantidad) cantidad.textContent = SERVICIOS.length + ' accesos';
    $('nvRegiones').innerHTML = REGIONES.map(function (s) { return tarjeta(s, 'regions'); }).join('');
    /* Un logo que no carga deja el hueco limpio, no el icono roto. */
    document.querySelectorAll('.nv-servicio-logo img').forEach(function (img) {
      img.addEventListener('error', function () { img.remove(); });
    });
  }

  function filtrarRegiones() {
    var q = NV.llano(($('nvRegionesBuscar').value || '').trim());
    var n = 0;
    document.querySelectorAll('#nvRegiones .nv-servicio').forEach(function (a) {
      var si = !q || a.dataset.nombre.indexOf(q) !== -1;
      a.hidden = !si;
      if (si) n++;
    });
    $('nvRegionesN').textContent = n;
    $('nvRegionesVacio').hidden = n !== 0;
  }


  /* ── Trámites ─────────────────────────────────────────────── */
  function conectarTramites() {
    document.querySelectorAll('[data-wa-msg]').forEach(function (a) {
      a.href = NV.whatsapp(a.getAttribute('data-wa-msg'));
    });
    document.querySelectorAll('[data-citv]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (C.CitvAviso && C.CitvAviso.abrir) C.CitvAviso.abrir();
      });
    });
  }


  /* ── Saldo bajo ───────────────────────────────────────────── */
  var UMBRAL = 3;
  var CLAVE_CERRADO = 'fv-low-balance-dismissed';
  var CUATRO_HORAS = 4 * 60 * 60 * 1000;

  function avisoCerrado() {
    try { return (Date.now() - parseInt(localStorage.getItem(CLAVE_CERRADO) || '0', 10)) < CUATRO_HORAS; }
    catch (e) { return false; }
  }

  NV.revisarSaldoBajo = function () {
    var caja = $('nvSaldoBajo');
    if (!caja) return;
    var n = NV.perfil ? parseInt(NV.perfil.credits_balance, 10) : NaN;
    var mostrar = !NV.esAdmin() && !isNaN(n) && n >= 0 && n <= UMBRAL && !avisoCerrado();
    if (mostrar) $('nvSaldoBajoN').textContent = n + ' crédito' + (n === 1 ? '' : 's');
    caja.hidden = !mostrar;
  };

  function conectarSaldoBajo() {
    var caja = $('nvSaldoBajo');
    caja.querySelector('.nv-saldo-bajo-cerrar').addEventListener('click', function () {
      try { localStorage.setItem(CLAVE_CERRADO, String(Date.now())); } catch (e) {}
      caja.hidden = true;
    });
    /* Cada vez que el saldo se repinta (tras consultar o pagar) se mira. */
    var pintar = NV.pintarSaldo;
    NV.pintarSaldo = function () { pintar(); NV.revisarSaldoBajo(); };
    NV.revisarSaldoBajo();
  }


  /* ── Mis datos ────────────────────────────────────────────── */
  var copia = null;

  function rellenarDatos() {
    var f = $('nvDatos');
    var p = NV.perfil || {};
    f.full_name.value = p.full_name || '';
    f.email.value = (NV.usuario && NV.usuario.email) || '';
    f.phone.value = p.phone || '';
  }

  function modoEditar(si) {
    var f = $('nvDatos');
    f.full_name.readOnly = !si;
    f.phone.readOnly = !si;
    f.classList.toggle('es-editando', si);
    $('nvDatosEditar').hidden = si;
    $('nvDatosGuardar').hidden = !si;
    $('nvDatosCancelar').hidden = !si;
    $('nvDatosError').hidden = true;
    if (si) f.full_name.focus();
  }

  function conectarDatos() {
    var f = $('nvDatos');
    $('nvDatosEditar').addEventListener('click', function () {
      copia = { full_name: f.full_name.value, phone: f.phone.value };
      modoEditar(true);
    });
    $('nvDatosCancelar').addEventListener('click', function () {
      if (copia) { f.full_name.value = copia.full_name; f.phone.value = copia.phone; }
      copia = null;
      modoEditar(false);
    });
    f.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (f.full_name.readOnly) return;
      var nombre = f.full_name.value.trim();
      var telefono = f.phone.value.trim();
      var err = $('nvDatosError');
      if (!nombre) { err.textContent = 'El nombre no puede quedar vacío.'; err.hidden = false; return; }
      var boton = $('nvDatosGuardar');
      boton.disabled = true;
      try {
        var res = await C.Auth.updateProfile({ full_name: nombre, phone: telefono });
        if (res && res.error) throw res.error;
        await NV.cargarPerfil();
        copia = null;
        modoEditar(false);
        rellenarDatos();
        var n = $('nvNombre'); if (n) n.textContent = nombre;
        var yo = $('nvYoNombre'); if (yo) yo.textContent = nombre;
        C.toast({ type: 'success', title: 'Datos guardados' });
      } catch (ex) {
        console.error('[cuenta]', ex);
        err.textContent = 'No se pudo guardar. Inténtalo de nuevo.';
        err.hidden = false;
      } finally {
        boton.disabled = false;
      }
    });
    $('nvCambiarClave').addEventListener('click', function () {
      if (NV.cambiarClave) NV.cambiarClave();
    });
  }


  /* ── Arranque ─────────────────────────────────────────────── */
  NV.arrancarServicios = function () {
    pintarServicios();
    $('nvRegionesBuscar').addEventListener('input', filtrarRegiones);
    conectarTramites();
    conectarSaldoBajo();
    conectarDatos();
    document.querySelectorAll('[data-anio]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

    NV.alEntrar.regiones = function () {
      $('nvRegionesBuscar').value = '';
      filtrarRegiones();
    };
    var entrarCuenta = NV.alEntrar.cuenta;
    NV.alEntrar.cuenta = function () {
      if (entrarCuenta) entrarCuenta();
      modoEditar(false);
      rellenarDatos();
    };
  };
})();
