/* ============================================================
   REPORTE VEHICULAR — el modelo propio

   Hoy el Reporte Completo se arma reimprimiendo el PDF del proveedor:
   se lee, se trocea por los números romanos que trae y se vuelve a
   maquetar. El orden, los títulos y lo que aparece los decide él.

   Este módulo mete una capa en medio. Traduce lo que llegue a una
   estructura NUESTRA —vehículo, titularidad, vigencias, deudas,
   incidencias— y a partir de ahí el documento ya no depende de en qué
   orden lo mande nadie. Es la pieza de la que cuelgan las demás: sin
   datos normalizados no hay deuda total, ni «vence en 12 días», ni
   veredicto que se pueda explicar.

   Dos decisiones que gobiernan todo lo de abajo:

   1. Lo que no se entiende NO se tira: se guarda en `noMapeado`. Un
      campo que el proveedor renombre tiene que salir a la luz en la
      siguiente consulta, no desaparecer en silencio.

   2. Lo que no llegó NO es un cero: es `null`. La diferencia entre «no
      debe nada» y «no se pudo consultar» es la que separa un informe de
      un problema, y en un documento que alguien usa para decidir si
      compra un auto no se puede difuminar.

   Entra `secciones`, que es lo que ya produce el lector del PDF en
   metapla-report.js. Sale un objeto plano, sin nada de dibujo.
============================================================ */

(function () {
  // El mismo archivo corre en el navegador y en las pruebas de Node, donde
  // no hay `window`. Sin esto, requerirlo desde una prueba reventaba en la
  // primera línea y no había forma de probar los normalizadores.
  var raiz = (typeof window !== 'undefined') ? window : globalThis;
  raiz.Consultia = raiz.Consultia || {};
  var Consultia = raiz.Consultia;

  /* ── Normalizadores ──────────────────────────────────────────────
     El proveedor manda texto. Para sumar, ordenar y comparar hace falta
     número y fecha de verdad. */

  // "S/ 22,000.50" · "22000,50" · "S/. 1 250" → 22000.5 · 1250
  function aImporte(txt) {
    var s = String(txt == null ? '' : txt);
    if (!/\d/.test(s)) return null;
    s = s.replace(/[^\d.,]/g, '');
    /* Los separadores sueltos de los extremos se van. Vienen del propio
       símbolo de la moneda: «S/. 1 250» se quedaba en «.1250» y se leía
       como 0,125 — mil veces menos de lo que dice el papel. */
    s = s.replace(/^[.,]+/, '').replace(/[.,]+$/, '');
    if (!s) return null;
    /* Cuál es el separador decimal depende del formato, y aquí llegan
       los dos. Manda el ÚLTIMO separador que aparezca: en «22,000.50» es
       el punto y en «22.000,50» es la coma. Con una regla fija, uno de
       los dos formatos se leía mil veces más grande. */
    var ultimaComa = s.lastIndexOf(',');
    var ultimoPunto = s.lastIndexOf('.');
    var corte = Math.max(ultimaComa, ultimoPunto);
    var entero, decimales = '';
    if (corte === -1) {
      entero = s;
    } else {
      var cola = s.slice(corte + 1);
      // Tres cifras detrás del separador es separador de millares, no
      // decimales: «22,000» son veintidós mil y no veintidós.
      if (cola.length === 3 || cola.length === 0) {
        entero = s.replace(/[.,]/g, '');
      } else {
        entero = s.slice(0, corte).replace(/[.,]/g, '');
        decimales = cola.replace(/\D/g, '');
      }
    }
    var n = parseFloat(entero.replace(/\D/g, '') + (decimales ? '.' + decimales : ''));
    return isNaN(n) ? null : n;
  }

  // "14/08/2026" · "2026-08-14" · "14-08-2026" → { iso, dia, mes, anio }
  function aFecha(txt) {
    var s = String(txt == null ? '' : txt).trim();
    var m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    var a, me, d;
    if (m) { a = +m[1]; me = +m[2]; d = +m[3]; }
    else {
      m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
      if (!m) return null;
      d = +m[1]; me = +m[2]; a = +m[3];
    }
    if (me < 1 || me > 12 || d < 1 || d > 31) return null;
    var f = new Date(a, me - 1, d);
    // Rebote del calendario: 31/02 se convierte en 03/03 y no es fecha.
    if (f.getFullYear() !== a || f.getMonth() !== me - 1 || f.getDate() !== d) return null;
    return {
      iso: a + '-' + ('0' + me).slice(-2) + '-' + ('0' + d).slice(-2),
      dia: d, mes: me, anio: a,
      fecha: f,
    };
  }

  // Días que faltan para una fecha. Negativo si ya pasó.
  function diasHasta(fecha, hoy) {
    if (!fecha || !fecha.fecha) return null;
    var base = hoy || new Date();
    var a = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    return Math.round((fecha.fecha - a) / 86400000);
  }

  function limpiar(s) {
    return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  }

  function clave(s) {
    return limpiar(s).toUpperCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Z0-9 ]/g, '');
  }

  /* ── Qué etiqueta es qué ─────────────────────────────────────────
     El proveedor no llama a las cosas siempre igual, así que se
     reconocen por patrón y no por igualdad exacta. Cada entrada dice a
     qué campo del modelo va y cómo se convierte.

     Añadir una etiqueta nueva es añadir una línea aquí. Ese es el punto
     de tener esta tabla: cuando el proveedor cambie un nombre, se toca
     esto y no el documento. */
  var ETIQUETAS = [
    // Vehículo
    { re: /^PLACA( ACTUAL| VIGENTE)?$/,           a: 'vehiculo.placa' },
    { re: /^PLACA ANTERIOR$/,                     a: 'vehiculo.placaAnterior' },
    { re: /^MARCA$/,                              a: 'vehiculo.marca' },
    { re: /^MODELO$/,                             a: 'vehiculo.modelo' },
    { re: /^(ANO|ANIO)( DE)?( FABRICACION| MODELO)?$/, a: 'vehiculo.anio' },
    { re: /^COLOR$/,                              a: 'vehiculo.color' },
    { re: /^(TIPO DE )?CARROCERIA$/,              a: 'vehiculo.carroceria' },
    { re: /^(N(UMERO)? DE )?SERIE|^VIN$/,         a: 'vehiculo.serie' },
    { re: /^(N(UMERO)? DE )?MOTOR$/,              a: 'vehiculo.motor' },
    { re: /^(TIPO DE )?COMBUSTIBLE$/,             a: 'vehiculo.combustible' },
    { re: /^ESTADO( DEL VEHICULO| DE PLACA)?$/,   a: 'vehiculo.estado' },
    { re: /^(TIPO DE )?USO$/,                     a: 'vehiculo.uso' },

    // Titularidad
    { re: /^PROPIETARIO(S)?$/,                    a: 'titularidad.propietario' },
    { re: /^DNI$|^DOCUMENTO$|^DNI DEL PROPIETARIO$/, a: 'titularidad.documento' },
    { re: /^RUC$/,                                a: 'titularidad.ruc' },

    // SOAT
    { re: /^SOAT$/,                               a: 'vigencias.soat.estado' },
    { re: /^(ASEGURADORA|COMPANIA)$/,             a: 'vigencias.soat.aseguradora' },
    { re: /^VIGENCIA SOAT$|^SOAT VIGENTE HASTA$|^VENCIMIENTO SOAT$/,
      a: 'vigencias.soat.hasta', tipo: 'fecha' },
    { re: /^POLIZA$|^N POLIZA$/,                  a: 'vigencias.soat.poliza' },

    // Revisión técnica
    { re: /^REVISION TECNICA$|^CITV$|^INSPECCION TECNICA$/, a: 'vigencias.revision.estado' },
    { re: /^VIGENCIA REVISION$|^VENCIMIENTO REVISION$|^REVISION VIGENTE HASTA$/,
      a: 'vigencias.revision.hasta', tipo: 'fecha' },
    { re: /^CERTIFICADO$|^N CERTIFICADO$/,        a: 'vigencias.revision.certificado' },
  ];

  function asignar(modelo, ruta, valor) {
    var partes = ruta.split('.');
    var nodo = modelo;
    for (var i = 0; i < partes.length - 1; i++) {
      if (!nodo[partes[i]]) nodo[partes[i]] = {};
      nodo = nodo[partes[i]];
    }
    var hoja = partes[partes.length - 1];
    // El primero gana: el proveedor repite campos entre secciones y el
    // de la ficha principal es el bueno.
    if (nodo[hoja] == null || nodo[hoja] === '') nodo[hoja] = valor;
  }

  /* ── Secciones que traen deuda ───────────────────────────────────
     No se busca «deuda» en el texto: se reconoce la SECCIÓN por su
     título y se suman sus importes. Así una fila que diga «sin deuda»
     no aporta nada y una tabla de papeletas aporta todas sus filas. */
  var SECCIONES_DEUDA = [
    { re: /SAT.*LIMA/,        entidad: 'SAT Lima' },
    { re: /SAT.*CALLAO/,      entidad: 'SAT Callao' },
    { re: /\bATU\b/,          entidad: 'ATU' },
    { re: /SUTRAN/,           entidad: 'SUTRAN' },
    { re: /CINEMOMETRO/,      entidad: 'Cinemómetro' },
    { re: /\bGNV\b/,          entidad: 'GNV' },
    { re: /IMPUESTO/,         entidad: 'Impuesto vehicular' },
    { re: /PAPELETA|MULTA/,   entidad: 'Papeletas' },
  ];

  var SECCIONES_INCIDENCIA = [
    { re: /DENUNCIA/,                 tipo: 'Denuncia' },
    { re: /REQUISITORIA/,             tipo: 'Requisitoria' },
    { re: /ORDEN(ES)? DE CAPTURA/,    tipo: 'Orden de captura' },
    { re: /MEDIDA CAUTELAR|GRAVAMEN/, tipo: 'Medida cautelar' },
    { re: /SINIESTR/,                 tipo: 'Siniestro' },
    { re: /ROBO|HURTO/,               tipo: 'Robo' },
  ];

  /* ── Qué celda es dinero ─────────────────────────────────────────
     Aquí hubo un desastre: se cogía el último número de la fila y se
     sumaba. En una tabla de papeletas eso son expedientes, resoluciones
     y años, y la deuda de un Swift salía en CUARENTA MILLONES de soles.
     Un número así no es un error de cálculo, es la credibilidad del
     documento entera.

     Ahora una celda solo es dinero si lo parece: o lleva el símbolo, o
     tiene la forma de un importe con sus dos decimales. Un entero pelado
     NO cuenta —«2024» y «000123» son año y expediente, no soles—, y
     tampoco cuenta nada que lleve letras o forma de fecha.

     Es deliberadamente estricto. Cuando una sección tiene registros pero
     ninguno parece dinero, no se inventa un cero: se anota como no
     totalizable y el veredicto lo dice. Entre equivocarse por exceso y
     decir «no lo sé», en un documento con el que alguien compra un auto
     se dice «no lo sé». */
  var RE_FECHA_SUELTA = /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/;
  var RE_MONEDA = /S\s*\/|PEN|SOLES/i;

  function pareceImporte(txt) {
    var s = limpiar(txt);
    if (!/\d/.test(s)) return false;
    if (RE_FECHA_SUELTA.test(s)) return false;
    var conMoneda = RE_MONEDA.test(s);
    // Letras que no sean el símbolo: es un código, no un importe.
    var resto = s.replace(/S\s*\/\.?|PEN|SOLES/gi, '');
    if (/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(resto)) return false;
    if (conMoneda) return true;
    // Sin símbolo hace falta la forma completa, con dos decimales.
    var n = resto.replace(/\s/g, '');
    return /^\d{1,3}(?:[.,]\d{3})*[.,]\d{2}$/.test(n) || /^\d+[.,]\d{2}$/.test(n);
  }

  function importeDeFila(celdas) {
    // De derecha a izquierda: la columna del monto va al final.
    for (var i = celdas.length - 1; i >= 0; i--) {
      if (!pareceImporte(celdas[i])) continue;
      var v = aImporte(celdas[i]);
      if (v != null) return v;
    }
    return null;
  }

  // Una sección "vacía" es la que dice explícitamente que no hay nada.
  var RE_SIN_NADA = /NO (REGISTRA|SE REGISTRA|PRESENTA|TIENE|EXISTE)|SIN (DEUDA|PAPELETA|REGISTRO|INCIDENCIA)|NINGUN/;

  function desdeSecciones(secciones, placa, opciones) {
    opciones = opciones || {};
    var lista = (secciones || []).filter(function (s) { return s && s.titulo != null; });

    var modelo = {
      vehiculo: { placa: placa ? limpiar(placa).toUpperCase() : null },
      titularidad: {},
      vigencias: { soat: {}, revision: {} },
      deudas: [],
      incidencias: [],
      cobertura: [],
      deudasIlegibles: [],
      noMapeado: [],
      proveedor: {
        nivel: (secciones && secciones.resumen && secciones.resumen.nivel) || null,
        score: (secciones && secciones.resumen && secciones.resumen.score) || null,
      },
    };

    lista.forEach(function (sec) {
      var titulo = clave(sec.titulo);
      var filas = sec.filas || [];
      var texto = filas.map(function (f) {
        return f.t === 'kv' ? (f.a + ' ' + f.b) : (f.t === 'row' ? f.cells.join(' ') : f.a);
      }).join(' | ');
      var vacia = RE_SIN_NADA.test(clave(texto)) || !filas.length;

      // ── Cobertura: de cada sección se anota si trajo algo ──
      modelo.cobertura.push({
        fuente: limpiar(sec.titulo),
        estado: !filas.length ? 'sin respuesta' : (vacia ? 'sin registros' : 'con datos'),
        filas: filas.length,
      });

      // ── Campos sueltos ──
      filas.forEach(function (f) {
        if (f.t !== 'kv') return;
        var k = clave(f.a);
        var valor = limpiar(f.b);
        if (!valor) return;
        var regla = null;
        for (var i = 0; i < ETIQUETAS.length; i++) {
          if (ETIQUETAS[i].re.test(k)) { regla = ETIQUETAS[i]; break; }
        }
        if (!regla) {
          modelo.noMapeado.push({ seccion: limpiar(sec.titulo), campo: limpiar(f.a), valor: valor });
          return;
        }
        asignar(modelo, regla.a, regla.tipo === 'fecha' ? aFecha(valor) : valor);
      });

      if (vacia) return;

      var yaHubo = false;   // ver SECCIONES_INCIDENCIA, más abajo

      // ── Deudas ──
      /* Solo el PRIMER patrón que case. «PAPELETAS ATU» casaba a la vez
         con ATU y con PAPELETA, y la sección se sumaba dos veces: dos mil
         soles de multas salían como cuatro mil. El orden de la lista es
         el que manda, de lo más específico a lo más general. */
      var yaHuboDeuda = false;
      SECCIONES_DEUDA.forEach(function (d) {
        if (yaHuboDeuda || !d.re.test(titulo)) return;
        yaHuboDeuda = true;
        var total = 0, items = 0;
        filas.forEach(function (f) {
          var celdas = f.t === 'row' ? f.cells : (f.t === 'kv' ? [f.a, f.b] : [f.a]);
          var imp = importeDeFila(celdas);
          if (imp != null) { total += imp; items++; }
        });
        if (items) {
          modelo.deudas.push({ entidad: d.entidad, monto: total, registros: items });
        } else {
          // Hay registros pero ninguno parece un importe. Se dice, no se
          // da por cero: puede haber deuda y no saber cuánta.
          modelo.deudasIlegibles.push({ entidad: d.entidad, seccion: limpiar(sec.titulo), filas: filas.length });
        }
      });

      // ── Incidencias ──
      SECCIONES_INCIDENCIA.forEach(function (inc) {
        if (!inc.re.test(titulo)) return;
        /* Solo la PRIMERA que case. Una sección llamada «DENUNCIAS POR
           ROBO» casaba con dos patrones y se contaba dos veces, y el
           veredicto acababa diciendo «Robo registrada (6)» por una
           tabla que tenía una cabecera y cinco filas. */
        if (yaHubo) return;
        yaHubo = true;
        var registros = filas.filter(function (f) {
          if (f.t !== 'row') return f.t === 'kv';
          // La fila de cabecera no es un registro: va toda en versalitas
          // y sin un solo dígito.
          var texto = f.cells.join(' ');
          return /\d/.test(texto) || /[a-záéíóúñ]/.test(texto);
        }).length;
        modelo.incidencias.push({
          tipo: inc.tipo,
          registros: registros || 1,
          seccion: limpiar(sec.titulo),
        });
      });
    });

    return modelo;
  }

  /* ── Desde la respuesta del bot, y solo desde ahí ────────────────
     `desdeSecciones` deduce demasiado. Reconoce las secciones por
     palabras de su título —ROBO, ATU, PAPELETA— y de ahí saca deudas e
     incidencias. Con una respuesta real eso se equivocó de la peor
     manera posible: dijo «Robo registrada (5)» de un vehículo sin una
     sola denuncia de robo, y sumó como soles unos expedientes.

     Un informe que alguien usa para comprar un auto no puede deducir.
     Esta función NO deduce: lee los campos que el bot entrega con su
     nombre —los mismos que se ven en la ficha de pantalla— y no infiere
     nada de ningún título. Lo que no viene con nombre, no existe.

     Deudas e incidencias se quedan fuera a propósito hasta que estén
     mapeadas contra una respuesta real. Es preferible un veredicto que
     dice «sin determinar» a uno que se inventa una denuncia. */
  function desdeParsed(parsed, placa) {
    var modelo = {
      vehiculo: { placa: placa ? limpiar(placa).toUpperCase() : null },
      titularidad: {},
      vigencias: { soat: {}, revision: {} },
      deudas: [],
      incidencias: [],
      cobertura: [],
      deudasIlegibles: [],
      noMapeado: [],
      // Lo que todavía no sabemos leer. El veredicto lo usa para decir
      // «sin determinar» en vez de callar o inventar.
      sinInterpretar: ['deudas', 'incidencias'],
    };

    ((parsed && parsed.secciones) || []).forEach(function (sec) {
      /* ── Cobertura ──────────────────────────────────────────────────
         Qué preguntó el bot y qué contestó cada fuente. Esto solo lo
         construía `desdeSecciones`, la vía de respaldo; los reportes
         reales entran por aquí, así que salían con cobertura vacía: el
         medidor de la portada quedaba en «sin datos» y el apartado de
         fuentes consultadas no se imprimía. La regla es la misma que
         allí — sin campos es que no respondió; con campos que solo dicen
         «no registra» es que respondió sin registros. */
      var campos = sec.campos || [];
      var textoSec = campos.map(function (c) {
        return (c && c.campo ? c.campo + ' ' : '') + (c && c.valor ? c.valor : '');
      }).join(' | ');
      modelo.cobertura.push({
        fuente: limpiar(sec.titulo) || 'Sin título',
        estado: !campos.length
          ? 'sin respuesta'
          : (RE_SIN_NADA.test(clave(textoSec)) ? 'sin registros' : 'con datos'),
        filas: campos.length,
      });

      campos.forEach(function (c) {
        if (!c || !c.campo) return;
        var k = clave(c.campo);
        var valor = limpiar(c.valor);
        if (!valor) return;
        var regla = null;
        for (var i = 0; i < ETIQUETAS.length; i++) {
          if (ETIQUETAS[i].re.test(k)) { regla = ETIQUETAS[i]; break; }
        }
        if (!regla) {
          modelo.noMapeado.push({ campo: limpiar(c.campo), valor: valor });
          return;
        }
        asignar(modelo, regla.a, regla.tipo === 'fecha' ? aFecha(valor) : valor);
      });
    });

    return modelo;
  }

  /* ── El folio ────────────────────────────────────────────────────
     El número que va impreso al pie del reporte y dentro del QR. Sale
     del identificador que devuelve el servidor al cobrar la consulta:
     es único por emisión y no depende de ningún contador guardado en el
     navegador, que se repetiría en cuanto lo pidieran dos clientes a la
     vez.

     Alfabeto sin O, I ni 1: un folio se dicta por teléfono y se copia a
     mano, y ahí el cero y la o son la misma letra. */
  var ALFABETO = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

  function folioDe(id) {
    var s = String(id || Date.now()) + '|fv';
    var h1 = 2166136261, h2 = 5381;
    for (var i = 0; i < s.length; i++) {
      h1 ^= s.charCodeAt(i);
      h1 = (h1 + ((h1 << 1) + (h1 << 4) + (h1 << 7) + (h1 << 8) + (h1 << 24))) >>> 0;
      h2 = (((h2 << 5) + h2) + s.charCodeAt(i)) >>> 0;
    }
    var out = '';
    for (var j = 0; j < 8; j++) {
      var fuente = (j < 4 ? h1 : h2);
      out += ALFABETO[(fuente >>> ((j % 4) * 5)) % ALFABETO.length];
    }
    return 'FV-' + out;
  }

  Consultia.ReporteModelo = {
    folioDe: folioDe,
    desdeSecciones: desdeSecciones,
    desdeParsed: desdeParsed,
    aImporte: aImporte,
    aFecha: aFecha,
    diasHasta: diasHasta,
    ETIQUETAS: ETIQUETAS,
  };

  // Para poder probarlo fuera del navegador.
  if (typeof module !== 'undefined' && module.exports) module.exports = Consultia.ReporteModelo;
})();
