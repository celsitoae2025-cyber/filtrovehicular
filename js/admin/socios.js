/* ============================================================
   ADMIN SOCIOS — distribuidores con saldo propio
   ------------------------------------------------------------
   Un socio compra créditos aquí y los revende a sus clientes desde
   su propio panel (socio.html). El dinero solo va del socio hacia
   el dueño: no hay comisiones que liquidar.

   Esta pantalla hace tres cosas y ninguna más: nombrar socio a una
   cuenta ya registrada, cargarle créditos cuando paga, y ver cómo
   va cada uno.
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};
  window.Consultia.Admin = window.Consultia.Admin || {};
  var A = window.Consultia.Admin;

  var socios = [];
  var candidato = null;    // usuario encontrado por correo, aún sin nombrar

  function sb() { return window.Consultia.supabase; }
  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function aviso(tipo, titulo, mensaje) {
    if (window.Consultia.toast) {
      window.Consultia.toast({ type: tipo, title: titulo, message: mensaje || '' });
    }
  }

  function mensajeDe(err) {
    var m = (err && err.message) || '';
    if (/failed to fetch|network/i.test(m)) return 'Sin conexión con el servidor.';
    return m || 'No se pudo completar la operación.';
  }

  // ── Listado ───────────────────────────────────────────────
  A.renderSocios = async function () {
    var res = await sb().rpc('admin_list_socios');
    if (res.error) { aviso('error', 'No se pudieron cargar los socios', mensajeDe(res.error)); return; }
    socios = res.data || [];
    pintar();
  };

  function pintar() {
    var cuerpo = $('sociosTableBody');
    var vacio  = $('sociosEmpty');
    if (!cuerpo) return;

    cuerpo.innerHTML = socios.map(function (s) {
      return '<tr>' +
        '<td>' + esc(s.full_name || 'Sin nombre') + '</td>' +
        '<td>' + esc(s.email) + '</td>' +
        '<td>' + (s.credits_balance || 0) + '</td>' +
        '<td>' + (s.clientes || 0) + '</td>' +
        '<td>' + (s.entregado_mes || 0) + '</td>' +
        '<td>' + (s.entregado || 0) + '</td>' +
        '<td class="socios-acciones">' +
          '<button class="btn btn-sm btn-primary" type="button" data-cargar="' + esc(s.id) + '">Cargar créditos</button>' +
          '<button class="btn btn-sm" type="button" data-quitar="' + esc(s.id) + '">Quitar</button>' +
        '</td>' +
      '</tr>';
    }).join('');

    if (vacio) vacio.hidden = socios.length > 0;
    pintarSelectorSocios();
  }

  // ── Nombrar socio ─────────────────────────────────────────
  // Se busca entre los usuarios YA registrados: el panel no crea
  // cuentas, igual que en «Agregar usuario».
  async function buscarCandidato() {
    var campo = $('socioNuevoEmail');
    var caja  = $('socioNuevoPreview');
    var correo = (campo && campo.value || '').trim().toLowerCase();
    candidato = null;
    if (!caja) return;

    if (!correo) {
      caja.hidden = true;
      aviso('error', 'Escribe un correo', 'Necesito el correo de una cuenta ya registrada.');
      return;
    }

    var res = await sb().rpc('admin_list_users');
    if (res.error) { aviso('error', 'No se pudo buscar', mensajeDe(res.error)); return; }

    var u = (res.data || []).filter(function (x) {
      return String(x.email || '').toLowerCase() === correo;
    })[0];

    if (!u) {
      caja.hidden = false;
      caja.innerHTML = '<p class="socios-aviso">Ese correo no está registrado. La persona tiene que crear su cuenta primero.</p>';
      return;
    }
    if (u.is_admin) {
      caja.hidden = false;
      caja.innerHTML = '<p class="socios-aviso">Esa cuenta es de administrador. Usa otra cuenta para el socio.</p>';
      return;
    }

    var yaEsSocio = socios.filter(function (s) { return s.id === u.id; }).length > 0;
    if (yaEsSocio) {
      caja.hidden = false;
      caja.innerHTML = '<p class="socios-aviso">Esa cuenta ya es socio. La tienes en la tabla de abajo.</p>';
      return;
    }

    candidato = u;
    caja.hidden = false;
    caja.innerHTML =
      '<div class="socios-preview">' +
        '<div>' +
          '<strong>' + esc(u.full_name || 'Sin nombre') + '</strong>' +
          '<span>' + esc(u.email) + '</span>' +
        '</div>' +
        '<button class="btn btn-primary" type="button" id="socioNombrarBtn">Nombrar socio</button>' +
      '</div>';

    var btn = $('socioNombrarBtn');
    if (btn) btn.addEventListener('click', nombrar);
  }

  async function nombrar() {
    if (!candidato) return;
    var ok = await window.Consultia.confirm({
      title: 'Nombrar socio',
      message: esc(candidato.full_name || candidato.email) + ' podrá entrar al panel de socio, ' +
               'entregar créditos de su saldo a sus propios clientes y verlos solo a ellos.',
      confirmText: 'Nombrar socio'
    });
    if (!ok) return;

    var res = await sb().rpc('admin_set_socio', { p_user_id: candidato.id, p_es_socio: true });
    if (res.error) { aviso('error', 'No se pudo nombrar', mensajeDe(res.error)); return; }

    aviso('success', 'Socio habilitado', 'Ya puede entrar en socio.html con su cuenta.');
    var campo = $('socioNuevoEmail');
    var caja  = $('socioNuevoPreview');
    if (campo) campo.value = '';
    if (caja) { caja.hidden = true; caja.innerHTML = ''; }
    candidato = null;
    A.renderSocios();
  }

  // ── Cargar créditos a un socio ────────────────────────────
  // Es la venta al por mayor: el socio pagó por fuera y aquí se le
  // deja el saldo. Se usa la misma función de siempre para ajustar
  // créditos, así queda registrado en su historial como cualquier
  // otra recarga.
  async function cargarCreditos(socio, cantidad) {
    if (!cantidad || cantidad <= 0) {
      aviso('error', 'Cantidad inválida', 'Escribe cuántos créditos le vas a cargar.');
      return;
    }

    var ok = await window.Consultia.confirm({
      title: 'Cargar ' + cantidad + ' créditos',
      message: 'Se sumarán al saldo de ' + (socio.full_name || socio.email) +
               ' para que los revenda a sus clientes.',
      confirmText: 'Cargar'
    });
    if (!ok) return;

    var res = await sb().rpc('admin_adjust_credits', {
      target_user_id: socio.id,
      delta: cantidad,
      note: 'Compra de créditos al por mayor (socio)',
      method: 'manual',
      ref: null
    });
    if (res.error) { aviso('error', 'No se pudo cargar', mensajeDe(res.error)); return; }

    aviso('success', 'Créditos cargados', 'El socio ya tiene su saldo disponible.');
    var campo = $('socioRecargaCantidad');
    if (campo) campo.value = '';
    A.renderSocios();
  }

  // El panel de recarga: una sola forma de cargarle saldo a un socio en
  // todo el administrador. El botón de cada fila solo lo apunta aquí.
  function pintarSelectorSocios() {
    var sel = $('socioRecargaId');
    if (!sel) return;
    var elegido = sel.value;
    sel.innerHTML = '<option value="">Elige un socio</option>' + socios.map(function (s) {
      return '<option value="' + esc(s.id) + '">' + esc(s.full_name || s.email) +
             ' — saldo ' + (s.credits_balance || 0) + '</option>';
    }).join('');
    if (elegido) sel.value = elegido;
  }

  async function quitarSocio(socio) {
    var ok = await window.Consultia.confirm({
      title: 'Quitar el cargo de socio',
      message: 'Perderá el acceso al panel de socio. Su saldo y su historial se quedan como están. ' +
               'Si todavía tiene clientes a su nombre, primero hay que reasignarlos.',
      confirmText: 'Quitar',
      danger: true
    });
    if (!ok) return;

    var res = await sb().rpc('admin_set_socio', { p_user_id: socio.id, p_es_socio: false });
    if (res.error) { aviso('error', 'No se pudo quitar', mensajeDe(res.error)); return; }

    aviso('success', 'Cargo retirado', 'Esa cuenta ya no es socio.');
    A.renderSocios();
  }

  // ── Conexiones ────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    var buscar = $('socioNuevoBuscar');
    if (buscar) buscar.addEventListener('click', buscarCandidato);

    var campo = $('socioNuevoEmail');
    if (campo) campo.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); buscarCandidato(); }
    });

    var recargar = $('socioRecargaBtn');
    if (recargar) recargar.addEventListener('click', function () {
      var id = ($('socioRecargaId') || {}).value || '';
      var cantidad = parseInt((($('socioRecargaCantidad') || {}).value || ''), 10);
      var socio = socios.filter(function (s) { return s.id === id; })[0];
      if (!socio) { aviso('error', 'Elige un socio', 'Primero indica a quién le cargas los créditos.'); return; }
      cargarCreditos(socio, cantidad);
    });

    var cuerpo = $('sociosTableBody');
    if (cuerpo) cuerpo.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-cargar],[data-quitar]') : null;
      if (!btn) return;
      var id = btn.dataset.cargar || btn.dataset.quitar;
      var socio = socios.filter(function (s) { return s.id === id; })[0];
      if (!socio) return;
      if (btn.dataset.quitar) { quitarSocio(socio); return; }
      // «Cargar créditos» de la fila: apunta el panel de arriba a ese
      // socio y lleva la vista hasta él.
      var sel = $('socioRecargaId');
      if (sel) sel.value = socio.id;
      var cant = $('socioRecargaCantidad');
      if (cant) cant.focus();
      var panel = $('socioRecargaPanel');
      if (panel && panel.scrollIntoView) panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });
})();
