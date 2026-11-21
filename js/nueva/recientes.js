/* El acceso rápido comparte el historial y el visor existentes. */
(function () {
  'use strict';
  var C = window.Consultia;
  var NV = C.NV;
  var $ = NV.$;
  var esc = NV.esc;
  var generation = 0;
  var owner = '';
  var rows = [];
  var loading;
  var refreshQueued = false;
  var GENERIC_NAMES = {
    filter: 'Consulta vehicular', vehiculos: 'Consulta vehicular', reniec: 'Consulta Reniec',
    sunarp: 'Consulta Sunarp', telefonia: 'Consulta telefónica', familiares: 'Consulta familiar',
    financiero: 'Consulta financiera', delitos: 'Consulta judicial', extras: 'Consulta adicional'
  };
  var DATA_TYPES = ['placa', 'dni', 'ruc', 'telefono', 'correo', 'nombre', 'ce', 'foto', 'texto'];
  function userId() { return NV.usuario && NV.usuario.id || ''; }
  function validUrl(value) {
    try { var url = new URL(value); return url.protocol === 'https:' ? url.href : ''; }
    catch (_) { return ''; }
  }
  function title(row) {
    if (row.saved) return row.saved.consulta.nombre;
    if (row.type && DATA_TYPES.indexOf(row.type) === -1) return row.type;
    return GENERIC_NAMES[row.module] || 'Consulta';
  }
  function render() {
    $('nvRecientesLista').innerHTML = rows.map(function (row) {
      var date = new Date(row.created_at);
      var dateText = Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
      var action = row.status === 'success' && (row.saved || validUrl(row.result_url)) ? 'Ver resultado' : 'Ver consulta';
      var icon = row.saved && NV.iconoConsulta ? NV.iconoConsulta(row.saved.consulta) : (row.type === 'dni' ? 'reniec' : 'historial');
      return '<button type="button" class="nv-reciente" data-reciente="' + esc(row.id) + '" aria-label="' +
        esc(action + ', ' + title(row) + ', ' + (row.input || '')) + '">' +
        '<span class="nv-reciente-icono" aria-hidden="true"><svg><use href="#fv-' + icon + '"/></svg></span>' +
        '<span class="nv-reciente-datos"><strong title="' + esc(title(row)) + '">' + esc(title(row)) + '</strong>' +
        '<small><span>' + esc(row.input || '—') + '</span><time datetime="' + esc(row.created_at) + '">' + esc(dateText) + '</time></small>' +
        '<small class="nv-reciente-accion">' + action + '</small></span>' +
        '<svg class="nv-reciente-flecha" aria-hidden="true"><use href="#fv-ir"/></svg></button>';
    }).join('');
    if (!rows.length) $('nvRecientesLista').innerHTML = '<p class="nv-recientes-vacio">Tu próxima consulta aparecerá aquí.<small>Elige un servicio para comenzar.</small></p>';
  }
  async function refresh(force) {
    var id = userId();
    if (!id) return;
    if (owner === id && loading) {
      if (force) refreshQueued = true;
      return loading;
    }
    var current = ++generation;
    if (owner !== id) {
      owner = id;
      rows = [];
      refreshQueued = false;
      $('nvRecientesLista').innerHTML = '<p class="nv-recientes-vacio">Cargando consultas…</p>';
    }
    $('nvRecientesLista').setAttribute('aria-busy', 'true');
    loading = Promise.resolve().then(async function () {
      try {
        var result = await Promise.all([
          C.supabase.from('consultas').select('id, module, type, input, status, result_url, created_at')
            .eq('user_id', id).order('created_at', { ascending: false }).limit(2),
          C.RecentResults.list(id)
        ]);
        if (current !== generation || userId() !== id) return;
        if (result[0].error) throw result[0].error;
        var saved = result[1];
        rows = (result[0].data || []).map(function (row) {
          return Object.assign({}, row, { saved: saved.find(function (item) { return item.id === row.id; }) || null });
        });
        render();
      } catch (_) {
        if (current !== generation || userId() !== id) return;
        rows = [];
        $('nvRecientesLista').innerHTML = '<p class="nv-recientes-vacio">No pudimos cargar tus consultas.<button type="button" class="nv-recientes-reintentar">Reintentar</button></p>';
      } finally {
        if (current === generation) {
          loading = null;
          $('nvRecientesLista').setAttribute('aria-busy', 'false');
          if (refreshQueued) { refreshQueued = false; refresh(); }
        }
      }
    });
    return loading;
  }
  NV.arrancarRecientes = function () {
    var panel = $('nvRecientes');
    if (!panel || panel.dataset.conectado) return;
    panel.dataset.conectado = '1';
    panel.addEventListener('click', function (event) {
      if (event.target.closest('.nv-recientes-reintentar')) { refresh(); return; }
      if (event.target.closest('a[href="#historial"]')) {
        event.preventDefault();
        NV.verConsultaEnHistorial();
        return;
      }
      var button = event.target.closest('[data-reciente]');
      if (!button || button.disabled) return;
      var row = rows.find(function (item) { return item.id === button.dataset.reciente; });
      if (!row || owner !== userId()) return;
      if (row.status === 'success' && row.saved && C.FilterView.showSavedResult) {
        if (!C.FilterView.showSavedResult(row.saved) && C.toast) {
          C.toast({ type: 'info', title: 'Consulta en curso', message: 'Espera a que termine antes de abrir otro resultado.' });
        }
      } else if (row.status === 'success' && validUrl(row.result_url)) {
        window.open(validUrl(row.result_url), '_blank', 'noopener,noreferrer');
      } else NV.verConsultaEnHistorial(row);
    });
    document.addEventListener('fv:query-completed', function (event) {
      if (event.detail.userId === userId()) refresh(true);
    });
    if (C.Auth && C.Auth.onAuthChange) C.Auth.onAuthChange(function (event) {
      if (event !== 'SIGNED_OUT') return;
      generation++;
      if (owner) C.RecentResults.clear(owner);
      owner = '';
      rows = [];
      loading = null;
      refreshQueued = false;
      $('nvRecientesLista').innerHTML = '';
    });
    NV.alEntrar.consultar = refresh;
  };
})();
