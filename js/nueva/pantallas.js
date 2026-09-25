/* ============================================================
   INTERFAZ NUEVA — las pantallas

   Cada pantalla tiene UN trabajo y no se pisa con otra:
     · Consultar  → elegir y lanzar.
     · Resumen    → cómo va la cuenta: saldo, métricas, gráfico de los
                    últimos 14 días y reparto por categoría. No lista
                    consultas: eso es el historial.
     · Historial  → el registro: cada consulta, agrupada por día, con
                    «Repetir» para volver a lanzarla.
     · Pagos      → comprar créditos y ver los movimientos.
     · Cuenta     → tus datos y los accesos.

   Todo lee de la misma base que app.html y compra por el mismo camino
   ('crear-preferencia'). Cambia cómo se enseña, no lo que se cobra.
============================================================ */
(function () {
  'use strict';
  var C = window.Consultia = window.Consultia || {};
  var NV = C.NV;
  var $ = NV.$;
  var esc = NV.esc;

  var CORTO = {
    filter: 'Vehicular', vehiculos: 'Vehículos', reniec: 'Reniec', sunarp: 'Sunarp',
    telefonia: 'Telefonía', familiares: 'Familia', financiero: 'Financiero',
    delitos: 'Justicia', extras: 'Extras'
  };
  function nombreCat(k) { return CORTO[k] || NV.CATEGORIAS[k] || k || 'Consulta'; }

  function sb() { return C.supabase; }


  /* ============================================================
     CONSULTAR
     ============================================================ */

  var catalogo = [];
  /* Arranca en Vehicular, que es lo que más se consulta; 'Todas' queda
     al final de la fila, como un desvío, no como la puerta de entrada. */
  var categoriaActiva = 'filter';

  function pintarPestanas() {
    var cuenta = {};
    catalogo.forEach(function (c) { cuenta[c.categoria] = (cuenta[c.categoria] || 0) + 1; });
    var claves = NV.ORDEN.filter(function (k) { return cuenta[k]; }).concat(['todas']);
    if (categoriaActiva !== 'todas' && !cuenta[categoriaActiva]) categoriaActiva = 'todas';
    $('nvPestanas').innerHTML = claves.map(function (k) {
      var n = k === 'todas' ? catalogo.length : cuenta[k];
      return '<button type="button" role="tab" class="nv-pestana' + (k === categoriaActiva ? ' es-activa' : '') +
        '" data-cat="' + k + '" aria-selected="' + (k === categoriaActiva) + '">' +
        '<span>' + esc(k === 'todas' ? 'Todas' : nombreCat(k)) + '</span><b>' + n + '</b></button>';
    }).join('');
  }

  function pintarCatalogo() {
    var q = NV.llano(textoBuscado.trim());
    var lista = catalogo.filter(function (c) {
      if (categoriaActiva !== 'todas' && c.categoria !== categoriaActiva) return false;
      return !q || NV.llano(c.nombre + ' ' + nombreCat(c.categoria)).indexOf(q) !== -1;
    });
    $('nvCatalogo').innerHTML = lista.length ? lista.map(function (c) {
      return '<button type="button" class="nv-op" data-id="' + esc(c.id) + '">' +
        '<span class="nv-op-nombre">' + esc(c.nombre) + '</span>' +
        '<span class="nv-op-precio">' + esc(c.precio_venta) + '</span>' +
      '</button>';
    }).join('') : '<p class="nv-vacio">Sin coincidencias.</p>';
    marcarElegida();
  }

  /* La fila de la consulta que está puesta en el desplegable se marca:
     se ve de un vistazo qué se va a lanzar. */
  function marcarElegida() {
    var sel = document.querySelector('#filterComboPanel .combo-option.selected');
    var id = sel ? sel.dataset.id : '';
    document.querySelectorAll('.nv-op').forEach(function (b) {
      b.classList.toggle('es-elegida', b.dataset.id === id);
    });
  }

  function filtrarDesplegable() {
    var panel = $('filterComboPanel');
    if (!panel) return;
    var porId = {};
    catalogo.forEach(function (c) { porId[c.id] = c.categoria; });
    panel.querySelectorAll('.combo-option').forEach(function (o) {
      o.classList.toggle('nv-fuera', categoriaActiva !== 'todas' && porId[o.dataset.id] !== categoriaActiva);
    });
    panel.querySelectorAll('.combo-grupo').forEach(function (g) {
      g.classList.toggle('nv-fuera', categoriaActiva !== 'todas' && g.textContent.trim() !== NV.CATEGORIAS[categoriaActiva]);
    });
  }

  /* La placa/DNI y el botón «Consultar» solo aparecen DESPUÉS de elegir
     el tipo de consulta: antes no hay nada que pedir. Se enseñan al
     elegir una tarjeta, una categoría con su primera consulta, o el
     Reporte completo (ver arrancarConsultar). */
  function mostrarBuscador() {
    var caja = $('nvBuscador');
    if (caja && caja.hidden) caja.hidden = false;
    var nota = $('nvEligeNota');
    if (nota) nota.hidden = true;
  }
  NV.mostrarBuscador = mostrarBuscador;

  function elegir(id) {
    if (C.setFilterOption) C.setFilterOption(id);
    var combo = $('filterCombo');
    if (combo) combo.classList.remove('open');
    marcarElegida();
    mostrarBuscador();
    if (NV.actualizarModoNombre) NV.actualizarModoNombre(catalogo.find(function (c) { return c.id === id; }));
    var campo = $('filter-input');
    if (campo && window.matchMedia('(hover: hover)').matches) campo.focus();
    document.querySelector('.nv-buscador').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function cambiarCategoria(cat) {
    categoriaActiva = cat;
    pintarPestanas();
    pintarCatalogo();
    filtrarDesplegable();
    if (cat !== 'todas') {
      var primera = catalogo.filter(function (c) { return c.categoria === cat; })[0];
      if (primera && C.setFilterOption) {
        C.setFilterOption(primera.id); marcarElegida(); mostrarBuscador();
        if (NV.actualizarModoNombre) NV.actualizarModoNombre(primera);
      }
    }
  }
  NV.cambiarCategoria = cambiarCategoria;

  var textoBuscado = '';

  function arrancarConsultar() {
    $('nvPestanas').addEventListener('click', function (e) {
      var b = e.target.closest('.nv-pestana');
      if (b) cambiarCategoria(b.dataset.cat);
    });
    $('nvCatalogo').addEventListener('click', function (e) {
      var b = e.target.closest('.nv-op');
      if (b) elegir(b.dataset.id);
    });
    /* Si se elige desde el desplegable, la lista de abajo lo refleja. */
    $('filterComboPanel').addEventListener('click', function () { setTimeout(marcarElegida, 0); });
    /* El Reporte completo también elige una consulta (la suya): pide el
       dato igual que cualquier otra, y nunca es de nombre —si se venía
       de una búsqueda por nombre, se apaga ese modo. */
    var ctaReporte = $('ctaReporteBtn');
    if (ctaReporte) ctaReporte.addEventListener('click', function () {
      mostrarBuscador();
      if (NV.actualizarModoNombre) NV.actualizarModoNombre(null);
    });

    var espera = (C.FilterView && C.FilterView.whenReady) ? C.FilterView.whenReady() : Promise.resolve();
    espera.then(function () {
      catalogo = (C.FilterView && C.FilterView.getCatalog()) || [];
      pintarPestanas();
      pintarCatalogo();
    });
  }


  /* ============================================================
     DATOS DEL CLIENTE
     ============================================================ */

  var consultas = null;
  async function leerConsultas() {
    if (!NV.usuario) return [];
    var res = await sb().from('consultas')
      .select('id, module, type, input, cost, status, created_at')
      .eq('user_id', NV.usuario.id)
      .order('created_at', { ascending: false })
      .limit(500);
    consultas = res.error ? [] : (res.data || []);
    return consultas;
  }

  function esOk(c) { return c.status === 'success'; }
  function enCurso(c) { return c.status === 'in_flight' || c.status === 'pending'; }


  /* ============================================================
     RESUMEN — el panel
     ============================================================ */

  async function entrarResumen() {
    NV.refrescarSaldo();
    $('nvMetricas').innerHTML = '<div class="nv-cargando"></div>';
    var lista = await leerConsultas();

    var ahora = new Date();
    var hoy0 = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime();
    var mes0 = new Date(ahora.getFullYear(), ahora.getMonth(), 1).getTime();
    var hoy = 0, mes = 0, ok = 0;
    lista.forEach(function (c) {
      var t = new Date(c.created_at).getTime();
      if (t >= hoy0) hoy++;
      if (t >= mes0) mes++;
      if (esOk(c)) ok++;
    });
    var tasa = lista.length ? Math.round(ok * 100 / lista.length) : 0;

    $('nvMetricas').innerHTML = [
      ['Hoy', NV.numero(hoy)],
      ['Este mes', NV.numero(mes)],
      ['Efectividad', tasa + '%']
    ].map(function (m) {
      return '<div class="nv-metrica"><span>' + m[0] + '</span><strong>' + m[1] + '</strong></div>';
    }).join('');

    /* Últimos 14 días, uno por barra. La de hoy va en verde. */
    var dias = [];
    for (var i = 13; i >= 0; i--) {
      var d = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - i);
      dias.push({ t: d.getTime(), n: 0, etiqueta: d.toLocaleDateString('es-PE', { day: 'numeric' }) });
    }
    lista.forEach(function (c) {
      var t = new Date(c.created_at);
      var t0 = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
      for (var j = 0; j < dias.length; j++) if (dias[j].t === t0) { dias[j].n++; break; }
    });
    var max = Math.max.apply(null, dias.map(function (d) { return d.n; })) || 1;
    var total14 = dias.reduce(function (a, d) { return a + d.n; }, 0);
    $('nvActividadTotal').textContent = NV.numero(total14) + ' en 14 días';
    $('nvGrafico').innerHTML = dias.map(function (d, i) {
      var alto = d.n ? Math.max(6, Math.round(d.n * 100 / max)) : 2;
      return '<div class="nv-col' + (i === dias.length - 1 ? ' es-hoy' : '') + '" title="' + d.n + ' consultas">' +
        '<span class="nv-col-n">' + (d.n || '') + '</span>' +
        '<span class="nv-col-barra" style="height:' + alto + '%"></span>' +
        '<span class="nv-col-dia">' + d.etiqueta + '</span>' +
      '</div>';
    }).join('');

    /* Reparto: una barra partida en tramos y su leyenda. */
    var porCat = {};
    lista.forEach(function (c) { if (esOk(c)) porCat[c.module] = (porCat[c.module] || 0) + 1; });
    var filas = Object.keys(porCat).map(function (k) { return [k, porCat[k]]; })
      .sort(function (a, b) { return b[1] - a[1]; });
    var suma = filas.reduce(function (a, f) { return a + f[1]; }, 0);
    /* Del oscuro de la casa al gris claro: la interfaz es monocroma. */
    var TONOS = ['#0b2a20', '#2f4d43', '#56706a', '#7f948e', '#a8b7b2', '#cdd6d2', '#e3e9e6'];
    if (!suma) {
      $('nvReparto').innerHTML = '<p class="nv-vacio">Aún sin consultas.</p>';
    } else {
      var top = filas.slice(0, 6);
      var resto = suma - top.reduce(function (a, f) { return a + f[1]; }, 0);
      if (resto > 0) top.push(['otras', resto]);
      $('nvReparto').innerHTML =
        '<div class="nv-tramos">' + top.map(function (f, i) {
          return '<span style="flex:' + f[1] + ';background:' + TONOS[i % TONOS.length] + '"></span>';
        }).join('') + '</div>' +
        '<ul class="nv-leyenda">' + top.map(function (f, i) {
          return '<li><i style="background:' + TONOS[i % TONOS.length] + '"></i>' +
            '<span>' + esc(f[0] === 'otras' ? 'Otras' : nombreCat(f[0])) + '</span>' +
            '<b>' + Math.round(f[1] * 100 / suma) + '%</b></li>';
        }).join('') + '</ul>';
    }
  }

  function arrancarResumen() {
    document.querySelector('.nv-atajos').addEventListener('click', function (e) {
      var a = e.target.closest('a');
      if (!a) return;
      if (a.hasAttribute('data-reporte-atajo')) {
        setTimeout(function () { var r = $('ctaReporteBtn'); if (r) r.click(); }, 50);
        return;
      }
      var cat = a.getAttribute('data-cat-atajo');
      if (cat) setTimeout(function () { cambiarCategoria(cat); }, 50);
    });
  }


  /* ============================================================
     HISTORIAL — el registro
     ============================================================ */

  var filtroHist = 'todas';

  function tituloDia(t) {
    var hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    var d = new Date(t); d.setHours(0, 0, 0, 0);
    var dif = Math.round((hoy - d) / 86400000);
    if (dif === 0) return 'Hoy';
    if (dif === 1) return 'Ayer';
    return d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function pintarRegistro() {
    var q = NV.llano(($('nvHistBuscar').value || '').trim());
    var lista = (consultas || []).filter(function (c) {
      if (filtroHist === 'ok' && !esOk(c)) return false;
      if (filtroHist === 'error' && (esOk(c) || enCurso(c))) return false;
      return !q || NV.llano((c.input || '') + ' ' + nombreCat(c.module)).indexOf(q) !== -1;
    }).slice(0, 300);

    if (!lista.length) { $('nvRegistro').innerHTML = '<p class="nv-vacio">Sin consultas.</p>'; return; }

    var html = '', diaActual = '';
    lista.forEach(function (c) {
      var dia = tituloDia(c.created_at);
      if (dia !== diaActual) {
        if (diaActual) html += '</div>';
        html += '<h3 class="nv-dia">' + esc(dia) + '</h3><div class="nv-dia-lista">';
        diaActual = dia;
      }
      var hora = new Date(c.created_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
      var estado = esOk(c) ? 'ok' : (enCurso(c) ? 'curso' : 'error');
      var cobro = esOk(c) && c.cost ? '−' + c.cost : '';
      html += '<div class="nv-reg">' +
        '<span class="nv-reg-hora">' + hora + '</span>' +
        '<span class="nv-reg-txt"><b>' + esc(c.input || '—') + '</b><span>' + esc(nombreCat(c.module)) + '</span></span>' +
        '<span class="nv-punto nv-punto-' + estado + '" title="' + (estado === 'ok' ? 'Con resultado' : estado === 'curso' ? 'En curso' : 'Sin resultado') + '"></span>' +
        '<span class="nv-reg-cobro">' + cobro + '</span>' +
        '<button type="button" class="nv-repetir" data-mod="' + esc(c.module) + '" data-val="' + esc(c.input || '') + '" title="Repetir"><svg><use href="#i-repetir"/></svg></button>' +
      '</div>';
    });
    $('nvRegistro').innerHTML = html + '</div>';
  }

  async function entrarHistorial() {
    $('nvRegistro').innerHTML = '<div class="nv-cargando"></div>';
    await leerConsultas();
    pintarRegistro();
  }

  function arrancarHistorial() {
    $('nvSegmentos').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      filtroHist = b.dataset.filtro;
      this.querySelectorAll('button').forEach(function (x) { x.classList.toggle('es-activo', x === b); });
      pintarRegistro();
    });
    $('nvHistBuscar').addEventListener('input', pintarRegistro);

    /* Repetir: vuelve a Consultar con la categoría y el dato puestos. */
    $('nvRegistro').addEventListener('click', function (e) {
      var b = e.target.closest('.nv-repetir');
      if (!b) return;
      NV.ir('consultar');
      if (CORTO[b.dataset.mod]) cambiarCategoria(b.dataset.mod);
      var campo = $('filter-input');
      if (campo) { campo.value = b.dataset.val; campo.focus(); }
    });
  }


  /* ============================================================
     PAGOS
     ============================================================ */

  var PAQUETES = [
    { id: 'cp-prof-1', creditos: 200,  precio: 15 },
    { id: 'cp-prof-2', creditos: 420,  precio: 25 },
    { id: 'cp-biz-1',  creditos: 1800, precio: 90 },
    { id: 'cp-biz-2',  creditos: 4000, precio: 150 }
  ];
  var LIBRE_TARIFA = 0.05;
  var LIBRE_MINIMO = 400;

  function pintarPaquetes() {
    var mejor = PAQUETES.reduce(function (a, b) { return (b.precio / b.creditos) < (a.precio / a.creditos) ? b : a; });
    $('nvPaquetes').innerHTML = PAQUETES.map(function (p) {
      var es = p === mejor;
      /* La insignia «Mejor precio» va FUERA de la línea de créditos: ahí
         adentro competía por el mismo ancho que el precio y «Comprar», y
         apretaba al botón hasta cortarlo. Aparte, chica, debajo. */
      return '<div class="nv-paq' + (es ? ' es-mejor' : '') + '">' +
        '<div class="nv-paq-fila">' +
          '<span class="nv-paq-cred"><strong>' + NV.numero(p.creditos) + '</strong> créditos</span>' +
          '<em>' + NV.soles(p.precio) + '</em>' +
          '<button type="button" class="nv-cta nv-cta-chica" data-plan="' + p.id + '"><span>Comprar</span></button>' +
        '</div>' +
        (es ? '<span class="nv-paq-mejor">Mejor precio</span>' : '') +
      '</div>';
    }).join('');
  }

  async function comprar(planId, boton) {
    var original = boton.innerHTML;
    boton.disabled = true;
    boton.innerHTML = '<span>Abriendo…</span><i><span class="nv-giro"></span></i>';
    try {
      var res = await sb().functions.invoke('crear-preferencia', { body: { plan_id: planId } });
      if (res.error) throw res.error;
      var url = res.data && res.data.init_point;
      if (!url) throw new Error((res.data && res.data.error) || 'Respuesta inválida');
      if (!/^https:\/\/[a-z]+\.(mercadopago|mercadolibre)\.com/i.test(url)) throw new Error('Dirección de pago no reconocida');
      window.location.href = url;
    } catch (e) {
      console.error('[pagos]', e);
      boton.disabled = false;
      boton.innerHTML = original;
      C.toast({ type: 'error', title: 'No se pudo abrir el pago', message: 'Inténtalo de nuevo.' });
    }
  }

  function actualizarLibre() {
    var n = parseInt($('nvLibreCreditos').value, 10) || 0;
    var ok = n >= LIBRE_MINIMO;
    $('nvLibreTotal').textContent = NV.soles(ok ? n * LIBRE_TARIFA : 0);
    var ir = $('nvLibreIr');
    ir.classList.toggle('es-inactivo', !ok);
    ir.setAttribute('aria-disabled', ok ? 'false' : 'true');
    ir.href = ok
      ? NV.whatsapp('Hola, quiero recargar ' + n + ' créditos (' + NV.soles(n * LIBRE_TARIFA) + '). Mi correo: ' + ((NV.usuario && NV.usuario.email) || ''))
      : '#';
  }

  var METODO = { mercadopago: 'Mercado Pago', whatsapp: 'WhatsApp', manual: 'Recarga manual', yape: 'Yape', plin: 'Plin' };

  function nombrePago(t) {
    if (t.type === 'purchase') return 'Paquete de ' + NV.numero(t.amount) + ' créditos';
    if (t.type === 'subscription') return 'Suscripción';
    return 'Recarga de ' + NV.numero(t.amount) + ' créditos';
  }

  /* Solo PAGOS: compras por Mercado Pago, suscripciones y recargas
     hechas por WhatsApp o a mano (ajustes positivos). Fuera consultas,
     devoluciones, bonos de bienvenida y usos de suscripción.

     Y SIEMPRE filtrado por el usuario: a una cuenta administradora la
     base le deja leer los movimientos de todos, y sin este filtro le
     salían los de todos los clientes. */
  async function entrarPagos() {
    /* Cada vez que se entra a Pagos, la lista empieza plegada. */
    var det = $('nvPagosHechos');
    if (det.open) det.open = false;
    $('nvPagosBoton').textContent = 'Ver pagos';
    NV.refrescarSaldo();
    $('nvMovimientos').innerHTML = '<div class="nv-cargando"></div>';
    var filas = [];
    if (NV.usuario) {
      var res = await sb().from('transactions')
        .select('id, type, amount, amount_pen, payment_method, created_at')
        .eq('user_id', NV.usuario.id)
        .or('type.in.(purchase,subscription),and(type.eq.admin_adjust,amount.gt.0,payment_method.in.(whatsapp,manual))')
        .order('created_at', { ascending: false })
        .limit(200);
      filas = res.error ? [] : (res.data || []);
    }

    var total = filas.reduce(function (a, t) { return a + (Number(t.amount_pen) || 0); }, 0);
    $('nvPagosN').textContent = filas.length;
    $('nvPagosTotal').textContent = total ? NV.soles(total) : '';

    $('nvMovimientos').innerHTML = filas.length ? filas.map(function (t) {
      var metodo = METODO[t.payment_method] || t.payment_method || '';
      return '<div class="nv-mov">' +
        '<span class="nv-mov-txt"><b>' + esc(nombrePago(t)) + '</b>' +
          '<span>' + esc(NV.fecha(t.created_at, true)) + (metodo ? ' · ' + esc(metodo) : '') + '</span></span>' +
        '<strong>' + (Number(t.amount_pen) ? NV.soles(t.amount_pen) : '+' + NV.numero(t.amount)) + '</strong>' +
      '</div>';
    }).join('') : '<p class="nv-vacio">Todavía no has hecho ningún pago.</p>';
  }

  function arrancarPagos() {
    pintarPaquetes();
    $('nvPaquetes').addEventListener('click', function (e) {
      var b = e.target.closest('[data-plan]');
      if (b && !b.disabled) comprar(b.dataset.plan, b);
    });
    /* «Mis pagos» se abre y se cierra SOLO con su botón: tocar el resto
       de la fila no hace nada. */
    $('nvPagosHechos').querySelector('summary').addEventListener('click', function (e) {
      if (!e.target.closest('.nv-pagos-boton')) e.preventDefault();
    });
    $('nvPagosHechos').addEventListener('toggle', function () {
      $('nvPagosBoton').textContent = this.open ? 'Ocultar' : 'Ver pagos';
    });
    $('nvLibreCreditos').addEventListener('input', actualizarLibre);
    $('nvLibreIr').addEventListener('click', function (e) {
      if (this.getAttribute('aria-disabled') === 'true') {
        e.preventDefault();
        C.toast({ type: 'info', title: 'Mínimo ' + LIBRE_MINIMO + ' créditos' });
      }
    });
    actualizarLibre();
  }


  /* ============================================================
     CUENTA
     ============================================================ */

  function entrarCuenta() {
    var p = NV.perfil || {};
    var u = NV.usuario || {};
    $('nvNombre').textContent = p.full_name || 'Sin nombre';
    $('nvCorreo').textContent = u.email || '';
    $('nvPlan').textContent = NV.esAdmin() ? 'Administrador'
      : (p.subscription_tier ? String(p.subscription_tier).replace(/_/g, ' ') : 'Créditos');
  }

  function arrancarCuenta() {
    $('nvSoporte').href = NV.whatsapp('Hola, necesito ayuda con mi cuenta de Filtro Vehicular+.');
    /* Cerrar sesión está en Mi cuenta y en el menú del avatar: el mismo
       código para los dos, marcado con [data-salir]. */
    document.querySelectorAll('[data-salir]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var ok = C.confirm
          ? await C.confirm({ title: 'Cerrar sesión', message: '¿Salir de tu cuenta?', confirmText: 'Salir' })
          : window.confirm('¿Salir de tu cuenta?');
        if (!ok) return;
        try { if (C.Auth && C.Auth.signOut) await C.Auth.signOut(); } catch (e) {}
        window.location.reload();
      });
    });
  }


  /* ============================================================
     ARRANQUE
     ============================================================ */

  NV.arrancarPantallas = function () {
    arrancarConsultar();
    arrancarResumen();
    arrancarHistorial();
    arrancarPagos();
    arrancarCuenta();
    NV.alEntrar.resumen = entrarResumen;
    NV.alEntrar.historial = entrarHistorial;
    NV.alEntrar.pagos = entrarPagos;
    NV.alEntrar.cuenta = entrarCuenta;
    /* Lo que rodea a las consultas (js/nueva/servicios.js): va al final
       porque amplía lo que hace Cuenta al abrirse. */
    if (NV.arrancarServicios) NV.arrancarServicios();
  };
})();
