/* ============================================================
   REPORTE VEHICULAR — el veredicto

   Tres respuestas, calculadas por nosotros a partir del modelo:

     ¿se puede circular?   ¿se puede transferir?   ¿cuánto se debe?

   Hasta ahora el documento entregaba hechos sueltos y dejaba el trabajo
   difícil al lector: sumar deudas, cruzar vencimientos y decidir si eso
   es grave. Quien compra un auto sin oficio no sabe si «medida cautelar»
   es un trámite menor o el fin de la operación.

   Reglas de la casa para todo lo de abajo:

   · Cada conclusión dice de qué dato sale. Si mañana un cliente
     pregunta «¿por qué dice que no puedo transferir?», la respuesta está
     escrita en el propio veredicto y no hay que reconstruirla.

   · Lo que no se pudo comprobar se dice, y NO cuenta como limpio. Un
     apartado que no respondió deja el veredicto en «con reparos», nunca
     en «en regla»: afirmar que un vehículo está libre de deudas porque
     la entidad no contestó es exactamente el error que no nos podemos
     permitir.

   · Los umbrales viven aquí arriba, con nombre. No hay números sueltos
     enterrados en un `if`.
============================================================ */

(function () {
  var raiz = (typeof window !== 'undefined') ? window : globalThis;
  raiz.Consultia = raiz.Consultia || {};
  var Consultia = raiz.Consultia;

  var Modelo = Consultia.ReporteModelo ||
    (typeof require !== 'undefined' ? require('./reporte-modelo.js') : null);

  // Un vencimiento a menos de esto se avisa aunque todavía esté vigente:
  // quien compra hoy quiere saber si el mes que viene le toca pagar.
  var DIAS_AVISO = 30;

  var RE_VIGENTE = /VIGENTE|ACTIVO|AL DIA|APROBAD/i;
  var RE_VENCIDO = /VENCID|CADUCAD|NO VIGENTE|INACTIV|DESAPROBAD/i;

  // Incidencias que bloquean una transferencia. No es una lista de cosas
  // feas: es la lista de las que impiden inscribir el cambio de dueño.
  var BLOQUEAN_TRANSFERENCIA = /Orden de captura|Requisitoria|Medida cautelar|Robo/i;

  function nuevo(estado, texto, fuente) {
    return { estado: estado, texto: texto, fuente: fuente || null };
  }

  /* ── Estado de una vigencia ──────────────────────────────────────
     Manda la fecha si la hay; el texto del proveedor es el respaldo.
     Al revés —creyendo al texto— un «VIGENTE» que no se actualizó tapa
     una fecha que ya pasó. */
  function vigencia(v, hoy) {
    if (!v || (!v.hasta && !v.estado)) return { estado: 'sin dato', dias: null };
    var dias = v.hasta ? Modelo.diasHasta(v.hasta, hoy) : null;
    if (dias != null) {
      if (dias < 0) return { estado: 'vencido', dias: dias };
      if (dias <= DIAS_AVISO) return { estado: 'por vencer', dias: dias };
      return { estado: 'vigente', dias: dias };
    }
    if (RE_VENCIDO.test(v.estado)) return { estado: 'vencido', dias: null };
    if (RE_VIGENTE.test(v.estado)) return { estado: 'vigente', dias: null };
    return { estado: 'sin dato', dias: null };
  }

  function circular(m, hoy) {
    var razones = [];
    var soat = vigencia(m.vigencias && m.vigencias.soat, hoy);
    var citv = vigencia(m.vigencias && m.vigencias.revision, hoy);

    // Cada uno con su adjetivo: «Revisión técnica vencido» está mal
    // escrito, y un documento que va a leer un comprador no puede tener
    // faltas de concordancia.
    [['SOAT', soat, 'vencido'], ['Revisión técnica', citv, 'vencida']].forEach(function (par) {
      var nombre = par[0], v = par[1], adj = par[2];
      if (v.estado === 'vencido') {
        razones.push(nuevo('impide', nombre + ' ' + adj + (v.dias != null
          ? ' hace ' + Math.abs(v.dias) + ' días' : ''), nombre));
      } else if (v.estado === 'por vencer') {
        razones.push(nuevo('aviso', nombre + ' vence en ' + v.dias + ' días', nombre));
      } else if (v.estado === 'sin dato') {
        razones.push(nuevo('duda', nombre + ' no se pudo comprobar', nombre));
      }
    });

    return resolver(razones, 'Puede circular');
  }

  function transferir(m) {
    var razones = [];
    (m.incidencias || []).forEach(function (inc) {
      if (BLOQUEAN_TRANSFERENCIA.test(inc.tipo)) {
        razones.push(nuevo('impide', inc.tipo + ' registrada' +
          (inc.registros > 1 ? ' (' + inc.registros + ')' : ''), inc.seccion));
      } else {
        razones.push(nuevo('aviso', inc.tipo + ': ' + inc.registros +
          (inc.registros === 1 ? ' registro' : ' registros'), inc.seccion));
      }
    });

    var sinRespuesta = (m.cobertura || []).filter(function (c) { return c.estado === 'sin respuesta'; });
    sinRespuesta.forEach(function (c) {
      razones.push(nuevo('duda', c.fuente + ' no respondió', c.fuente));
    });

    return resolver(razones, 'Sin impedimentos registrados');
  }

  /* Un veredicto no se decide por mayoría: basta UN impedimento para que
     sea «no». Y basta una fuente muda para que no se pueda afirmar que
     está limpio. */
  function resolver(razones, textoLimpio) {
    var impide = razones.filter(function (r) { return r.estado === 'impide'; });
    var duda   = razones.filter(function (r) { return r.estado === 'duda'; });
    if (impide.length) return { estado: 'no', razones: razones, resumen: impide[0].texto };
    if (duda.length)   return { estado: 'con reparos', razones: razones, resumen: duda[0].texto };
    if (razones.length) return { estado: 'con reparos', razones: razones, resumen: razones[0].texto };
    return { estado: 'si', razones: [], resumen: textoLimpio };
  }

  function deuda(m) {
    var partes = (m.deudas || []).slice().sort(function (a, b) { return b.monto - a.monto; });
    var total = partes.reduce(function (s, d) { return s + (d.monto || 0); }, 0);
    var mudas = (m.cobertura || []).filter(function (c) { return c.estado === 'sin respuesta'; }).length;
    /* Secciones con registros donde no se reconoció ningún importe. No
       son cero: son «hay algo y no sabemos cuánto». Sumarlas como cero
       diría que el vehículo no debe nada, que es justo lo contrario de
       lo que sabemos. */
    var ilegibles = (m.deudasIlegibles || []).length;
    return {
      total: total,
      ilegibles: ilegibles,
      entidadesIlegibles: (m.deudasIlegibles || []).map(function (d) { return d.entidad; }),
      exacta: ilegibles === 0,
      // Redondeado a céntimos: sumar decimales en coma flotante deja
      // colas de 0,000000001 que en un importe quedan ridículas.
      totalTexto: 'S/ ' + (Math.round(total * 100) / 100).toLocaleString('es-PE', {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      }),
      partes: partes,
      completa: mudas === 0 && ilegibles === 0,
      fuentesMudas: mudas,
    };
  }

  /* El nivel propio. No es el puntaje del proveedor —que no sabemos cómo
     se calcula, y que hemos visto marcar «medio» con 76 sobre 100— sino
     una lectura de lo que hay, con las razones a la vista. */
  function nivel(m, hoy) {
    var c = circular(m, hoy), t = transferir(m), d = deuda(m);
    var motivos = [];
    if (c.estado === 'no') motivos.push('No puede circular: ' + c.resumen.toLowerCase());
    if (t.estado === 'no') motivos.push('No se puede transferir: ' + t.resumen.toLowerCase());
    if (d.total > 0) motivos.push('Deuda registrada de ' + d.totalTexto);
    if (d.ilegibles) motivos.push('Hay deuda en ' + d.entidadesIlegibles.join(', ') +
      ' que no se pudo totalizar');
    if (d.fuentesMudas) motivos.push(d.fuentesMudas + ' fuente(s) sin respuesta');

    var estado;
    if (t.estado === 'no' || d.total >= 5000 || d.ilegibles) estado = 'ALTO';
    else if (c.estado === 'no' || d.total > 0 || t.razones.length) estado = 'MEDIO';
    else if (!d.completa) estado = 'MEDIO';
    else estado = 'BAJO';

    return { nivel: estado, motivos: motivos, circular: c, transferir: t, deuda: d };
  }

  Consultia.ReporteVeredicto = {
    circular: circular,
    transferir: transferir,
    deuda: deuda,
    nivel: nivel,
    vigencia: vigencia,
    DIAS_AVISO: DIAS_AVISO,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Consultia.ReporteVeredicto;
})();
