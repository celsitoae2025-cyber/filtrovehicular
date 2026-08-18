/* ============================================================
   SOCIO PANEL — resumen, clientes y entregas
   ------------------------------------------------------------
   Todo lo que hay aquí pasa por funciones de la base de datos
   (`socio_*`). El panel no lee `profiles` ni `transactions` por su
   cuenta: si mañana alguien abre esta página con la sesión de otro,
   no encuentra ni un dato que no sea suyo — el permiso lo decide el
   servidor, no este archivo.
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};
  window.Consultia.Socio = window.Consultia.Socio || {};
  var S = window.Consultia.Socio;

  var clientes = [];
  var hallazgo = null;      // el usuario que devolvió la búsqueda
  var saldoActual = 0;

  function sb() { return window.Consultia.supabase; }
  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fecha(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
           ' ' + d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  }

  function aviso(tipo, titulo, mensaje) {
    if (window.Consultia.toast) {
      window.Consultia.toast({ type: tipo, title: titulo, message: mensaje || '' });
    }
  }

  /* El mensaje que devuelve la base de datos ya está escrito para el
     socio ("No tienes créditos suficientes. Te quedan 40"), así que se
     muestra tal cual. Solo se traducen los fallos de transporte. */
  function enEspanol(err) {
    var m = (err && (err.message || err.error_description)) || '';
    if (/failed to fetch|network/i.test(m)) return 'Sin conexión con el servidor. Revisa tu internet.';
    return m || 'No se pudo completar la operación.';
  }

  function pintarSaldo(valor) {
    saldoActual = valor || 0;
    var chip = $('socioSaldoChipValue');
    if (chip) chip.textContent = saldoActual.toLocaleString('es-PE');
    var kpi = $('socioKpiSaldo');
    if (kpi) kpi.textContent = saldoActual.toLocaleString('es-PE');
  }

  // ── Resumen ───────────────────────────────────────────────
  S.cargarResumen = async function () {
    var res = await sb().rpc('socio_mi_resumen');
    if (res.error) { aviso('error', 'No se pudo cargar tu resumen', enEspanol(res.error)); return; }
    var r = (res.data && res.data[0]) || { saldo: 0, clientes: 0, entregado: 0, entregado_mes: 0 };
    pintarSaldo(r.saldo);
    $('socioKpiClientes').textContent = (r.clientes || 0).toLocaleString('es-PE');
    $('socioKpiMes').textContent      = (r.entregado_mes || 0).toLocaleString('es-PE');
    $('socioKpiTotal').textContent    = (r.entregado || 0).toLocaleString('es-PE');
  };

  // ── Mis clientes ──────────────────────────────────────────
  S.cargarClientes = async function () {
    var res = await sb().rpc('socio_mis_clientes');
    if (res.error) { aviso('error', 'No se pudo cargar tu cartera', enEspanol(res.error)); return; }
    clientes = res.data || [];
    pintarClientes();
  };

  function pintarClientes() {
    var cuerpo = $('socioClientesBody');
    var vacio  = $('socioClientesEmpty');
    if (!cuerpo) return;

    var filtro = ($('socioFiltroClientes') && $('socioFiltroClientes').value || '').trim().toLowerCase();
    var lista = !filtro ? clientes : clientes.filter(function (c) {
      return (c.full_name || '').toLowerCase().indexOf(filtro) >= 0 ||
             (c.email || '').toLowerCase().indexOf(filtro) >= 0;
    });

    cuerpo.innerHTML = lista.map(function (c) {
      return '<tr>' +
        '<td>' + esc(c.full_name || 'Sin nombre') + '</td>' +
        '<td>' + esc(c.email) + '</td>' +
        '<td>' + (c.credits_balance || 0) + '</td>' +
        '<td>' + (c.entregado || 0) + '</td>' +
        '<td>' + fecha(c.ultima_entrega) + '</td>' +
        '<td><button class="btn btn-sm btn-primary" type="button" data-entregar="' + esc(c.id) +
            '" data-nombre="' + esc(c.full_name || c.email) + '">Entregar</button></td>' +
      '</tr>';
    }).join('');

    if (vacio) vacio.hidden = lista.length > 0;
  }

  // ── Buscar un usuario por correo ──────────────────────────
  S.buscarUsuario = async function () {
    var campo = $('socioBuscarEmail');
    var caja  = $('socioHallazgo');
    var email = (campo && campo.value || '').trim();
    hallazgo = null;
    if (!caja) return;

    if (!email) {
      caja.hidden = true;
      aviso('error', 'Escribe un correo', 'Necesito el correo con el que tu cliente se registró.');
      return;
    }

    var res = await sb().rpc('socio_buscar_usuario', { p_email: email });
    if (res.error) { aviso('error', 'No se pudo buscar', enEspanol(res.error)); return; }

    var u = (res.data && res.data[0]) || null;
    if (!u) {
      caja.hidden = false;
      caja.innerHTML = '<p class="socio-hallazgo-no">Ese correo no está registrado en la plataforma. ' +
        'Pídele a tu cliente que se registre primero en la app y vuelve a buscarlo.</p>';
      return;
    }
    if (!u.disponible) {
      caja.hidden = false;
      caja.innerHTML = '<p class="socio-hallazgo-no">Esa cuenta no puede recibir créditos tuyos: ' +
        'ya pertenece a otro distribuidor o es una cuenta interna.</p>';
      return;
    }

    hallazgo = u;
    caja.hidden = false;
    caja.innerHTML =
      '<div class="socio-hallazgo-fila">' +
        '<div class="socio-hallazgo-quien">' +
          '<strong>' + esc(u.full_name || 'Sin nombre') + '</strong>' +
          '<span>' + esc(u.email) + '</span>' +
        '</div>' +
        '<div class="socio-hallazgo-saldo">Saldo actual: ' + (u.credits_balance || 0) + '</div>' +
        '<div class="socio-hallazgo-form">' +
          '<input class="input" type="number" min="1" step="1" id="socioCantidad" placeholder="Créditos">' +
          '<input class="input" type="text" id="socioNota" placeholder="Nota (opcional)" maxlength="80">' +
          '<button class="btn btn-primary" type="button" id="socioEntregarBtn">Entregar</button>' +
        '</div>' +
      '</div>';

    var btn = $('socioEntregarBtn');
    if (btn) btn.addEventListener('click', function () {
      var cant = parseInt(($('socioCantidad') || {}).value, 10);
      var nota = (($('socioNota') || {}).value || '').trim();
      S.entregar(hallazgo.id, hallazgo.full_name || hallazgo.email, cant, nota);
    });
  };

  // ── Entregar créditos ─────────────────────────────────────
  // El descuento y el abono los hace la base de datos en un solo paso;
  // aquí solo se confirma y se refresca lo que se ve.
  S.entregar = async function (clienteId, nombre, cantidad, nota) {
    if (!clienteId) return;
    if (!cantidad || cantidad <= 0) {
      aviso('error', 'Cantidad inválida', 'Escribe cuántos créditos vas a entregar.');
      return;
    }
    if (cantidad > saldoActual) {
      aviso('error', 'No te alcanza', 'Tu saldo es de ' + saldoActual + ' créditos.');
      return;
    }

    var ok = await window.Consultia.confirm({
      title: 'Entregar ' + cantidad + ' créditos',
      message: 'Se descontarán de tu saldo y entrarán a la cuenta de ' + nombre +
               ' al instante. Esto no se puede deshacer.',
      confirmText: 'Entregar'
    });
    if (!ok) return;

    var res = await sb().rpc('socio_transferir_creditos', {
      p_cliente_id: clienteId,
      p_creditos: cantidad,
      p_nota: nota || null
    });
    if (res.error) { aviso('error', 'No se pudo entregar', enEspanol(res.error)); return; }

    pintarSaldo(res.data);
    aviso('success', 'Créditos entregados', nombre + ' ya tiene sus ' + cantidad + ' créditos.');

    var caja = $('socioHallazgo');
    if (caja) { caja.hidden = true; caja.innerHTML = ''; }
    var campo = $('socioBuscarEmail');
    if (campo) campo.value = '';
    hallazgo = null;

    await S.cargarResumen();
    await S.cargarClientes();
  };

  // ── Movimientos ───────────────────────────────────────────
  S.cargarMovimientos = async function () {
    var res = await sb().rpc('socio_mis_movimientos', { p_limite: 200 });
    var cuerpo = $('socioMovimientosBody');
    var vacio  = $('socioMovimientosEmpty');
    if (res.error) { aviso('error', 'No se pudieron cargar tus entregas', enEspanol(res.error)); return; }
    var filas = res.data || [];
    if (cuerpo) {
      cuerpo.innerHTML = filas.map(function (m) {
        return '<tr>' +
          '<td>' + fecha(m.created_at) + '</td>' +
          '<td>' + esc(m.cliente || 'Sin nombre') + '</td>' +
          '<td>' + esc(m.email) + '</td>' +
          '<td>+' + (m.creditos || 0) + '</td>' +
          '<td>' + esc(m.descripcion || '') + '</td>' +
        '</tr>';
      }).join('');
    }
    if (vacio) vacio.hidden = filas.length > 0;
  };

  // ── Conexiones ────────────────────────────────────────────
  S.initPanel = function () {
    var buscarBtn = $('socioBuscarBtn');
    if (buscarBtn) buscarBtn.addEventListener('click', S.buscarUsuario);

    var campo = $('socioBuscarEmail');
    if (campo) campo.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); S.buscarUsuario(); }
    });

    var filtro = $('socioFiltroClientes');
    if (filtro) filtro.addEventListener('input', pintarClientes);

    // Un solo oyente para toda la tabla: las filas se repintan a cada
    // rato y colgarle un oyente a cada botón los iría acumulando.
    var cuerpo = $('socioClientesBody');
    if (cuerpo) cuerpo.addEventListener('click', async function (e) {
      var btn = e.target.closest ? e.target.closest('[data-entregar]') : null;
      if (!btn) return;
      var campoEmail = $('socioBuscarEmail');
      var cliente = clientes.filter(function (c) { return c.id === btn.dataset.entregar; })[0];
      if (!cliente) return;
      // Se reusa el mismo formulario de arriba: una sola forma de
      // entregar créditos en todo el panel.
      if (campoEmail) campoEmail.value = cliente.email;
      // Se espera a que la ficha esté pintada: si no, el desplazamiento
      // ocurría con el cuadro todavía oculto y no llevaba a ninguna parte.
      await S.buscarUsuario();
      var caja = $('socioHallazgo');
      if (caja && caja.scrollIntoView) caja.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };
})();
