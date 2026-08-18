/* ============================================================
   CONSULTA RUNNER — ejecuta consultas del catálogo contra el bridge
   - Carga el catálogo de Supabase (consultas_catalog)
   - Al ejecutar: valida créditos, llama al bridge, cobra, renderiza

   Seguridad: en producción NO se llama al bridge directo. En su lugar
   se invoca la edge function 'bridge-proxy' de Supabase, que valida la
   sesión del usuario y reenvía al bridge con la API key del lado
   servidor. La API key NUNCA está en el cliente.

   Modo dev local opcional: si window.FV_BRIDGE_DIRECT_URL y
   window.FV_BRIDGE_API_KEY están definidos (ej. desarrollo en
   localhost), se usa el bridge directo para iterar más rápido.
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  function getSB() { return window.Consultia.supabase || null; }

  // --- Sanitizador de errores del bridge ---
  // Evita exponer detalles técnicos internos al usuario.
  function safeError(errData, fallbackMsg) {
    if (!errData || typeof errData !== 'object') return fallbackMsg;
    var raw = errData.error || '';
    // Si es mensaje de "negocio" del bridge, lo dejamos pasar.
    if (/Falta|requerid|inv[áa]lido|no existe|insuficient|no conectado/i.test(raw)) {
      return raw;
    }
    return fallbackMsg;
  }

  // --- Resolver de endpoint del bridge ---
  // Devuelve { url, headers } listos para fetch.
  // Modo edge (default, prod): /functions/v1/bridge-proxy/<endpoint>
  // Modo directo (dev opcional): <bridge>/<endpoint> con X-API-Key.
  async function resolveBridgeRequest(endpoint) {
    var directUrl = (typeof window !== 'undefined' && window.FV_BRIDGE_DIRECT_URL)
      ? String(window.FV_BRIDGE_DIRECT_URL).replace(/\/$/, '') : '';
    var directKey = (typeof window !== 'undefined' && window.FV_BRIDGE_API_KEY)
      ? String(window.FV_BRIDGE_API_KEY) : '';

    if (directUrl && directKey) {
      return {
        url: directUrl + '/' + endpoint,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': directKey,
        },
      };
    }

    // Modo edge: necesitamos la URL del proyecto Supabase y el JWT del usuario.
    var sb = getSB();
    if (!sb) throw new Error('Supabase no disponible');

    var supabaseUrl = '';
    try {
      // supabase-js v2 expone la url interna como `supabaseUrl` (privado pero estable).
      supabaseUrl = sb.supabaseUrl || (sb.rest && sb.rest.url) || '';
    } catch (_) {}
    if (!supabaseUrl && window.Consultia && window.Consultia.SUPABASE_URL) {
      supabaseUrl = String(window.Consultia.SUPABASE_URL);
    }
    if (!supabaseUrl) throw new Error('SUPABASE_URL no disponible');

    // Quitar /rest/v1 y trailing slash si vinieran.
    supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');

    var sessionRes = await sb.auth.getSession();
    var token = sessionRes && sessionRes.data && sessionRes.data.session
      ? sessionRes.data.session.access_token : '';
    if (!token) throw new Error('Sesión no disponible. Inicia sesión nuevamente.');

    return {
      url: supabaseUrl + '/functions/v1/bridge-proxy/' + endpoint,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
    };
  }

  // --- Cache del catálogo en memoria (TTL 60s) ---
  var catalogCache = {}; // { [categoria]: { data, ts } }
  var CATALOG_TTL_MS = 60000;

  async function loadCatalog(categoria) {
    var key = categoria || '__all__';
    var cached = catalogCache[key];
    if (cached && (Date.now() - cached.ts) < CATALOG_TTL_MS) {
      return cached.data;
    }
    var sb = getSB();
    if (!sb) throw new Error("Supabase no disponible");
    var q = sb.from("consultas_catalog").select("*").eq("activa", true);
    if (categoria) q = q.eq("categoria", categoria);
    q = q.order("orden", { ascending: true });
    var res = await q;
    if (res.error) throw res.error;
    var data = res.data || [];
    catalogCache[key] = { data: data, ts: Date.now() };
    return data;
  }

  function invalidateCatalogCache() {
    catalogCache = {};
  }

  // --- Parser de etiquetas (para no repetir en cada vista) ---
  function toTitleCase(s) {
    if (!s) return s;
    var lower = { de:1, del:1, la:1, el:1, los:1, las:1, y:1, e:1, a:1, o:1, u:1 };
    return String(s).toLowerCase().split(/\s+/).map(function (w, i) {
      if (i > 0 && lower[w]) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join(" ");
  }

  var LABEL_MAP = {
    // DNI se queda en DNI. Estuvo desplegado a "Documento nacional de
    // identidad" y ocupaba una linea entera él solo, dejando el número
    // colgando debajo. Todo el mundo aquí lo llama DNI.
    "DNI": "DNI",
    "DOCUMENTO NACIONAL DE IDENTIDAD": "DNI",
    "DOCUMENTO": "DNI",
    "APELLIDOS": "Apellidos",
    "APELLIDO PATERNO": "Apellido Paterno",
    "APELLIDO MATERNO": "Apellido Materno",
    "APELLIDOS PATERNOS": "Apellido Paterno",
    "APELLIDOS MATERNOS": "Apellido Materno",
    "AP. PATERNO": "Apellido Paterno",
    "AP. MATERNO": "Apellido Materno",
    "AP PATERNO": "Apellido Paterno",
    "AP MATERNO": "Apellido Materno",
    "PATERNO": "Apellido Paterno",
    "MATERNO": "Apellido Materno",
    "NOMBRES": "Prenombres",
    "NOMBRE": "Prenombres",
    "GENERO": "Género",
    "SEXO": "Género",
    "FECHA NACIMIENTO": "Fecha",
    "FECHA INSCRIPCION": "Fecha de Inscripción",
    "FECHA EMISION": "Fecha de Emisión",
    "FECHA CADUCIDAD": "Fecha de Caducidad",
    "FECHA FALLECIMIENTO": "Fecha de Fallecimiento",
    "PADRE": "Nombre del Padre",
    "MADRE": "Nombre de la Madre",
    "GRADO INSTRUCCION": "Grado de Instrucción",
    "UBIGEO RENIEC": "Ubigeo Reniec",
    "UBIGEO INEI": "Ubigeo INEI",
    "UBIGEO SUNAT": "Ubigeo Sunat",
    "CERT. NACIDO": "Cert. de Nacido",
    "CERT. DEFUNCIÓN": "Cert. de Defunción",
    "CODIGO POSTAL": "Código Postal",
    "DIRECCION": "Dirección",
    "DOMICILIO": "Domicilio",
    "ESTADO CIVIL": "Estado Civil",
    "RESTRICCION": "Restricción",
  };

  function prettyLabel(k) {
    if (!k) return "";
    if (LABEL_MAP[k]) return LABEL_MAP[k];
    return toTitleCase(k);
  }

  /* --- Espera larga y cancelación ---------------------------------
     Hay bots que tardan de verdad: contestan primero su acuse de recibo
     y la ficha llega bastante después. La página tiene que esperar —por
     debajo se vuelve a pedir— en vez de dar la consulta por perdida y
     soltarle al cliente que su dato no existe. Si la espera se alarga,
     aparece la opción de cancelar sin costo y volver al inicio. */
  var AVISO_ESPERA_MS    = 30000;    // cuándo se ofrece cancelar
  var PAUSA_REINTENTO_MS = 6000;

  var controllerActivo = null;
  var cancelada = false;
  var avisoTimer = null;

  function pausa(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  function errorCancelado() {
    var e = new Error("Consulta cancelada. No se descontaron créditos.");
    e.code = "CANCELLED";
    return e;
  }

  function pintarAvisoEspera() {
    /* Solo en la vista que está a la vista: cada pestaña guarda su propio
       resultado, y un «Consultando…» viejo escondido en otra se llevaría el
       aviso a una pantalla que nadie está mirando. */
    var caja = document.querySelector(".view:not([hidden]) .cr-loading") ||
               document.querySelector(".cr-loading");
    if (!caja || caja.querySelector(".cr-espera")) return;
    var wrap = document.createElement("div");
    wrap.className = "cr-espera";
    wrap.innerHTML =
      '<p class="cr-espera-texto">El proveedor está tardando más de lo normal. ' +
      'Seguimos esperando su respuesta todo lo que haga falta; si prefieres no esperar, ' +
      'cancela sin costo.</p>' +
      '<button type="button" class="cr-espera-btn">Cancelar y volver al inicio</button>';
    wrap.querySelector(".cr-espera-btn").addEventListener("click", cancelarConsulta);
    caja.appendChild(wrap);
  }

  function quitarAvisoEspera() {
    if (avisoTimer) { clearTimeout(avisoTimer); avisoTimer = null; }
    var w = document.querySelector(".cr-espera");
    if (w && w.parentNode) w.parentNode.removeChild(w);
  }

  function iniciarEspera() {
    cancelada = false;
    quitarAvisoEspera();
    avisoTimer = setTimeout(pintarAvisoEspera, AVISO_ESPERA_MS);
  }

  // Corta la espera: aborta la petición en curso, devuelve al inicio y deja
  // que el flujo normal libere la reserva (cancelarSiNoSeUso).
  function cancelarConsulta() {
    cancelada = true;
    if (controllerActivo) { try { controllerActivo.abort(); } catch (_) {} }
    quitarAvisoEspera();
    var inicio = document.querySelector('[data-nav="dashboard"]');
    if (inicio) inicio.click();
    if (Consultia.toast) Consultia.toast({
      type: 'info',
      title: 'Consulta cancelada',
      message: 'No se descontaron créditos.'
    });
  }

  // --- Ejecutar consulta vía bridge ---
  // consulta: fila del catálogo { bot_id, comando, precio_venta, ... }
  // valor: lo que el cliente ingresó (DNI, placa, etc.)
  // opts.photo: { base64, filename } — para reconocimiento facial
  async function ejecutarConsulta(consulta, valor, opts) {
    opts = opts || {};
    // Para consultas con foto, el caption solo lleva el comando SIN el valor
    // (el filename no debe ir en el caption; el bot recibe la imagen directamente).
    var comando;
    if (opts.photo && opts.photo.base64) {
      comando = consulta.comando.replace("{valor}", "").replace(/\s+$/, "").trim();
    } else {
      comando = consulta.comando.replace("{valor}", valor || "");
    }
    var body = {
      bot: consulta.bot_id,
      command: comando,
      // Comprobante de pago. El bridge-proxy lo valida contra la base de
      // datos ANTES de tocar el bridge: comprueba que la reserva exista, sea
      // de este usuario, esté sin usar y sea reciente. Sin él responde 402.
      consulta_id: opts.consultaId || null,
    };
    if (opts.photo && opts.photo.base64) {
      body.photoBase64 = opts.photo.base64;
      body.photoFilename = opts.photo.filename || "photo.jpg";
      body.timeoutMs = 70000;
    } else {
      body.timeoutMs = 65000;
    }

    // Auto-click de botón inline: si el catálogo indica que el bot responde con botones,
    // pasamos el matcher al bridge para que lo clickee automáticamente tras la respuesta.
    // Ojo: en el bridge esto son DOS esperas independientes que se encadenan (menú
    // inicial + resultado tras el click), cada una con su propio presupuesto de
    // "timeoutMs" — el peor caso real puede llegar a 2× ese valor. El resultado
    // además suele ser un reporte que junta varias fuentes (SUNARP, denuncias,
    // papeletas, SOAT…), así que la segunda espera puede tardar bastante.
    var formato = consulta.respuesta_formato || {};
    if (formato.auto_click) body.autoClick = formato.auto_click;

    var controller = new AbortController();
    // Presupuesto del fetch en el cliente: para auto_click cubrimos el peor caso
    // de las dos fases encadenadas del bridge, con margen extra.
    var clientAbortMs = formato.auto_click
      ? (body.timeoutMs * 2) + 20000
      : body.timeoutMs + 10000;
    var fetchTimeout = setTimeout(function () { controller.abort(); }, clientAbortMs);
    controllerActivo = controller;
    var res;
    var bridgeReq;
    try {
      bridgeReq = await resolveBridgeRequest('query');
    } catch (resolveErr) {
      clearTimeout(fetchTimeout);
      throw resolveErr;
    }
    try {
      res = await fetch(bridgeReq.url, {
        method: "POST",
        headers: bridgeReq.headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (fetchErr) {
      clearTimeout(fetchTimeout);
      if (fetchErr.name === 'AbortError') {
        // Puede ser el tope de tiempo… o que el cliente pulsó «Cancelar».
        if (cancelada) throw errorCancelado();
        throw new Error('La consulta tardó demasiado. Intenta de nuevo.');
      }
      console.error("[consulta-runner] bridge no disponible:", bridgeReq.url, fetchErr);
      throw new Error("El servidor de consultas no está disponible. Verifique que el bridge esté activo.");
    }
    clearTimeout(fetchTimeout);
    if (!res.ok) {
      var errData = {};
      try { errData = await res.json(); } catch (_) {}
      throw new Error(safeError(errData, "Error " + res.status + " del bridge"));
    }
    return await res.json();
  }

  // Click en un botón inline del bot desde la página
  // consulta: fila del catálogo (para bot_id)
  // msgId: id del mensaje de Telegram que tiene el botón
  // data: callback_data serializado como base64
  // opts.timeoutMs: espera máxima en el bridge (algunos bots tardan >60s en
  // generar el archivo completo; el fetch corta 15s después).
  async function ejecutarCallback(consulta, msgId, data, opts) {
    opts = opts || {};
    var esperaBridge = opts.timeoutMs || 60000;
    var body = {
      bot: consulta.bot_id,
      msgId: msgId,
      data: data,
      timeoutMs: esperaBridge,
      // Comprobante de la consulta ya pagada a la que pertenece este clic.
      // El bridge-proxy comprueba que sea del usuario y esté en curso; aquí
      // no se cobra nada, es la segunda fase de algo ya cobrado.
      consulta_id: opts.consultaId || ultimaConsultaId || null,
    };
    var controller = new AbortController();
    var fetchTimeout = setTimeout(function () { controller.abort(); }, esperaBridge + 15000);
    /* Quien llama puede cortar la espera (el botón de cancelar del cliente):
       su señal aborta la petición en vuelo, no solo la vuelta siguiente. */
    if (opts.signal) {
      if (opts.signal.aborted) controller.abort();
      else opts.signal.addEventListener('abort', function () { controller.abort(); }, { once: true });
    }
    var bridgeReq;
    try {
      bridgeReq = await resolveBridgeRequest('callback');
    } catch (resolveErr) {
      clearTimeout(fetchTimeout);
      throw resolveErr;
    }
    var res;
    try {
      res = await fetch(bridgeReq.url, {
        method: "POST",
        headers: bridgeReq.headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (fetchErr) {
      clearTimeout(fetchTimeout);
      if (fetchErr.name === 'AbortError') throw new Error('El callback tardó demasiado. Intenta de nuevo.');
      throw new Error("El servidor de consultas no está disponible.");
    }
    clearTimeout(fetchTimeout);
    if (!res.ok) {
      var errData = {};
      try { errData = await res.json(); } catch (_) {}
      // El detalle técnico no se le muestra al usuario, pero queda en consola
      // para diagnosticar (timeout del bot, callback vencido, etc).
      console.error('[callback] bridge respondió ' + res.status + ':', errData && errData.error);
      throw new Error(safeError(errData, "Error " + res.status + " del bridge"));
    }
    return await res.json();
  }

  // --- Descontar créditos del usuario y registrar la consulta ---
  // Usa la RPC consume_credits (no requiere admin). Valida saldo atómicamente,
  // descuenta crédito, inserta en `transactions` y en `consultas`.
  async function cobrarCreditos(userId, consulta, valor) {
    var sb = getSB();
    if (!sb) throw new Error("Supabase no disponible");
    var precioVenta = consulta.precio_venta;
    if (typeof precioVenta !== "number" || isNaN(precioVenta)) {
      throw new Error("Precio de venta no definido para esta consulta");
    }
    var res = await sb.rpc("consume_credits", {
      cost: Math.abs(precioVenta),
      module_name: consulta.categoria || "general",
      q_type: consulta.tipo_dato || "texto",
      q_input: (valor || "").slice(0, 200),
    });
    if (res.error) throw res.error;
    return res.data; // uuid de la consulta creada
  }

  // --- ¿La cuenta es administradora? ---
  // El acceso ilimitado se concede por rol (profiles.is_admin), nunca por
  // un correo escrito en el código, para que valga igual para cualquier
  // administrador. Se cachea por sesión: se consulta en cada compra de
  // créditos y no vale la pena repetir el viaje.
  var adminCache = Object.create(null);
  async function esAdmin(userId) {
    if (!userId) return false;
    if (userId in adminCache) return adminCache[userId];
    try {
      var sb = getSB();
      var res = await sb.from("profiles").select("is_admin").eq("id", userId).single();
      // .single() no lanza: los fallos llegan en res.error, no al catch.
      // Si la consulta falló no se guarda nada — antes se guardaba "no es
      // admin" y un corte de red dejaba al administrador pagando créditos
      // el resto de la sesión, hasta recargar. Sin guardar, la siguiente
      // consulta vuelve a preguntar.
      if (res.error) return false;
      adminCache[userId] = !!(res.data && res.data.is_admin);
    } catch (err) {
      return false;
    }
    return adminCache[userId];
  }

  // --- Verificar saldo suficiente ---
  // Devuelve true si:
  //   - la cuenta es administradora (acceso ilimitado), o
  //   - el usuario tiene suscripción activa (consultas ilimitadas), o
  //   - tiene créditos suficientes para el precio.
  async function verificarSaldo(userId, precio) {
    if (typeof precio !== "number" || isNaN(precio)) {
      return false; // precio inválido = no tiene saldo suficiente
    }
    var sb = getSB();
    var res = await sb.from("profiles")
      .select("credits_balance, subscription_expires_at, is_admin")
      .eq("id", userId)
      .single();
    if (res.error) throw res.error;
    if (!res.data) return false;
    // Administrador ⇒ acceso total, sin límite de saldo
    if (res.data.is_admin) {
      adminCache[userId] = true;
      return true;
    }
    adminCache[userId] = false;
    // Suscripción vigente ⇒ pasa
    if (res.data.subscription_expires_at) {
      var exp = new Date(res.data.subscription_expires_at).getTime();
      if (!isNaN(exp) && exp > Date.now()) return true;
    }
    return (res.data.credits_balance || 0) >= precio;
  }

  // --- Comprobante de la última consulta pagada ---
  // El callback (clic en un botón del bot) es la segunda fase de una consulta
  // que ya se pagó, y el bridge-proxy también le pide el comprobante. Se
  // guarda aquí para no tener que pasarlo a mano en cada sitio que llama a
  // ejecutarCallback. Solo hay una consulta activa a la vez en la pantalla.
  var ultimaConsultaId = null;

  // --- Devolver el crédito de una consulta que nunca llegó a ejecutarse ---
  //
  // El cobro ocurre ANTES de consultar. Si la petición no llega al servidor
  // (sin red, el navegador aborta…), la reserva quedaría pagada y sin usar.
  // Esta RPC la cancela, pero SOLO si el servidor nunca la reclamó — o sea,
  // si es imposible que se hayan entregado datos. Si ya estaba en curso, no
  // hace nada y liquida el servidor.
  //
  // Ya no existe un reembolso a voluntad del cliente: esa era la vía por la
  // que se podía recibir el dato y recuperar el crédito (auditoría 2026-08-15).
  async function cancelarSiNoSeUso(consultaId) {
    var sb = getSB();
    if (!sb || !consultaId) return;
    try {
      await sb.rpc("cancel_consulta_no_usada", { p_consulta_id: consultaId });
    } catch (err) {
      console.warn("[consulta-runner] no se pudo cancelar la reserva:", err);
    }
  }

  // --- Heurística: ¿la respuesta del bot está vacía / es de error? ---
  // El bridge devuelve 200 aunque el bot diga "DNI no encontrado".
  //
  // Consideramos SIN resultados cuando:
  //   (a) No hay datos estructurados, medios, botones ni titulo, O
  //   (b) El contenido textual concatenado contiene alguna frase
  //       conocida de "no hay resultados" (patrones de los bots).
  //
  // En ambos casos el runner hará refund del crédito automáticamente.
  var NO_RESULT_PATTERNS = [
    /no\s+se\s+(tuvo|obtuvo|han?)\s+(ning[uú]n|resultad)/i,
    /no\s+se\s+(encontr|hall|obtuv)/i,
    /no\s+se\s+encuentr/i,
    /sin\s+(resultad|informaci|registr|datos)/i,
    /ning[uú]n\s+resultad/i,
    /no\s+hay\s+(informaci|datos|resultad|registr)/i,
    /no\s+existe/i,
    /no\s+encontrad/i,
    /no\s+registrad/i,
    /no\s+tiene\s+informaci/i,
    /informaci[óo]n\s+no\s+disponible/i,
    /placa\s+no\s+(registrad|encontrad|existe)/i,
    /dni\s+no\s+(registrad|encontrad|existe)/i,
    /ruc\s+no\s+(registrad|encontrad|existe)/i,
    /datos\s+no\s+encontrad/i,
    /consulta\s+sin\s+resultad/i,
    /persona\s+no\s+registrad/i,
    /vehiculo\s+no\s+registrad/i,
    /no\s+cuenta\s+con/i,
  ];

  function collectResponseText(p) {
    var parts = [];
    if (!p) return "";
    if (p.titulo) parts.push(String(p.titulo));
    if (p.subtitulo) parts.push(String(p.subtitulo));
    if (p.mensaje) parts.push(String(p.mensaje));
    if (p.texto) parts.push(String(p.texto));
    if (Array.isArray(p.secciones)) {
      p.secciones.forEach(function (s) {
        if (!s) return;
        if (s.titulo) parts.push(String(s.titulo));
        if (s.nota) parts.push(String(s.nota));
        if (Array.isArray(s.campos)) {
          s.campos.forEach(function (c) {
            if (!c) return;
            if (c.campo) parts.push(String(c.campo));
            if (c.valor != null) parts.push(String(c.valor));
          });
        }
      });
    }
    return parts.join(" ");
  }

  function contieneFraseSinResultados(text) {
    if (!text) return false;
    var s = String(text).trim();
    if (!s) return false;
    // El bot marca sus respuestas negativas (sin datos) con "[✖️]" al
    // inicio, a diferencia de "[☑️]" cuando sí hay resultados. Detectar
    // ese marcador es más confiable que tratar de cubrir cada frase
    // posible en español ("no cuenta con...", "no tiene...", etc.).
    if (/^\[?\s*✖/.test(s)) return true;
    // Frases de error explícitas del bot que indican fallo → no cobrar
    var ERROR_PATTERNS = [
      /error\s+en\s+la\s+consulta/i,
      /no\s+se\s+pudo\s+obtener/i,
      /no\s+se\s+pudo\s+(consultar|procesar|completar)/i,
      /cr[eé]ditos?\s+devuelt/i,
      /servicio\s+(no\s+disponible|temporalmente)/i,
      /intenta\s+(de\s+)?nuevo|reintenta(r|s)?\s+/i,
      /fallo\s+(en\s+la\s+)?consulta/i,
    ];
    if (ERROR_PATTERNS.some(function (re) { return re.test(s); })) return true;
    return NO_RESULT_PATTERNS.some(function (re) { return re.test(s); });
  }

  function esRespuestaVacia(resp) {
    if (!resp) return true;
    var p = resp.parsed;

    // El raw puede estar en resp.parsed.raw (estructura del bridge) o en resp.raw
    var rawText = (p && p.raw) ? String(p.raw).trim() : (resp.raw ? String(resp.raw).trim() : '');

    // Caso (a): sin ningun contenido estructurado
    if (!p) {
      if (!rawText) return true;
      if (contieneFraseSinResultados(rawText)) return true;
      // Hay texto real sin estructura → no es vacío
      return false;
    }

    var hasSecciones = p.secciones && p.secciones.length > 0 &&
      p.secciones.some(function (s) { return s && s.campos && s.campos.length > 0; });
    var hasMedios = p.medios && p.medios.length > 0;
    var hasBotones = p.botones && p.botones.length > 0;
    var hasTitulo = p.titulo && String(p.titulo).trim().length > 0;
    // Fallback: raw con contenido sustancial (>40 chars) también cuenta como respuesta
    var hasRawContent = rawText.length > 40;

    if (!(hasSecciones || hasMedios || hasBotones || hasTitulo || hasRawContent)) return true;

    // Caso (b): hay contenido pero es un mensaje de "no hay resultados".
    var allText = collectResponseText(p);
    if (contieneFraseSinResultados(allText)) return true;
    // Revisar el raw real (viene en p.raw, no en resp.raw)
    if (rawText && contieneFraseSinResultados(rawText)) return true;

    return false;
  }

  // --- Flujo completo: ejecutar → cobrar solo si fue exitosa ---
  // userId: id del usuario autenticado.
  // consulta: fila del catálogo.
  // valor: dato ingresado.
  // opts.photo: opcional, { base64, filename }.
  async function ejecutarConsultaConCobro(userId, consulta, valor, opts) {
    var precioVenta = consulta.precio_venta;
    if (typeof precioVenta !== "number" || isNaN(precioVenta)) {
      throw new Error("Precio de venta no definido para esta consulta");
    }

    // 1) Comprobación de saldo solo para dar un mensaje claro cuanto antes.
    //    NO es la que manda: consume_credits la revalida en el servidor.
    var tieneSaldo = await verificarSaldo(userId, Math.abs(precioVenta));
    if (!tieneSaldo) {
      throw new Error("Créditos insuficientes. Recarga tu cuenta para continuar.");
    }

    // 2) COBRAR PRIMERO. Devuelve el consulta_id, que es el comprobante que
    //    el bridge-proxy exige para consultar.
    //
    //    Antes se cobraba al final, después de entregar el dato. Eso permitía
    //    saltarse el pago llamando al bridge por cuenta propia (auditoría
    //    2026-08-15). Ahora sin reserva pagada no hay consulta.
    //
    //    Los administradores no pagan: consume_credits lo resuelve por rol
    //    (costo 0) y aun así registra la consulta para el historial.
    var esCuentaAdmin = await esAdmin(userId);

    var optsBase = {};
    if (opts) { for (var k in opts) { if (Object.prototype.hasOwnProperty.call(opts, k)) optsBase[k] = opts[k]; } }

    /* La espera da las vueltas que hagan falta: mientras el proveedor solo
       acuse recibo, se le vuelve a pedir. No hay reloj que la corte —quien
       decide dejarlo es el cliente, con el botón de cancelar—: cambiarle la
       pantalla por un aviso que él no pidió es echarlo de su propia consulta.

       Cada vuelta lleva su propia reserva porque la anterior ya la liquidó el
       servidor al marcarla sin resultados; el crédito vuelve en cada una. */
    iniciarEspera();
    try {
      while (true) {
        if (cancelada) throw errorCancelado();

        var consultaId = await cobrarCreditos(userId, consulta, valor);
        ultimaConsultaId = consultaId;   // lo necesita ejecutarCallback

        /* Cancelar justo aquí —entre el cobro y la petición— dejaba una
           reserva pagada que nadie iba a usar: el abort no tenía todavía a
           qué agarrarse y la consulta se iba al bridge con el cliente ya en
           el inicio. Se libera y se sale. */
        if (cancelada) {
          await cancelarSiNoSeUso(consultaId);
          throw errorCancelado();
        }

        // 3) Ejecutar contra el bridge, presentando el comprobante.
        var runOpts = {};
        for (var k2 in optsBase) { if (Object.prototype.hasOwnProperty.call(optsBase, k2)) runOpts[k2] = optsBase[k2]; }
        runOpts.consultaId = consultaId;

        var resp;
        try {
          resp = await ejecutarConsulta(consulta, valor, runOpts);
        } catch (err) {
          // La petición no llegó a completarse (sin red, timeout del navegador,
          // cancelación del cliente…). Si el servidor nunca llegó a reclamar la
          // reserva, se devuelve el crédito. Si sí la reclamó, esta llamada no
          // hace nada y el propio servidor la liquidará — no se puede cobrar
          // dos veces ni devolver de más.
          await cancelarSiNoSeUso(consultaId);
          throw err;
        }

        // 4) Si el bot no trajo datos, el SERVIDOR ya devolvió el crédito y lo
        //    marca aquí. El cliente solo informa; ya no decide sobre el dinero.
        if (resp && resp.sin_resultados) {
          /* No es lo mismo «el dato no existe» que «el proveedor acusó recibo y
             todavía no contestó». Lo segundo se reconoce porque lo único que
             llegó fue su aviso de espera, y decirle al cliente que su DNI no
             existe cuando sí existe es mandarlo a buscar donde no hay nada. */
          var RH = Consultia.RenderHelpers;
          var enProceso = RH && RH.esRespuestaEnProceso && RH.esRespuestaEnProceso(resp.parsed || {});

          // Sigue procesando: se vuelve a pedir sin molestar al cliente, que
          // sigue viendo «Consultando…» hasta que llegue o hasta que cancele.
          if (enProceso && !cancelada) {
            await pausa(PAUSA_REINTENTO_MS);
            continue;
          }

          var tipo = (consulta.tipo_dato || "dato").toUpperCase();
          var e = enProceso
            ? new Error("El proveedor acusó recibo pero aún no devolvió la información. " +
                        "Vuelve a intentarlo en unos segundos. No se descontaron créditos.")
            : new Error("No se encontraron datos para el " + tipo + " " + valor +
                        ". No se descontaron créditos.");
          e.code = enProceso ? "STILL_PROCESSING" : "EMPTY_RESPONSE";
          throw e;
        }

        // Inyectamos el costo para que la UI lo muestre
        resp.costo_deducido = esCuentaAdmin ? 0 : consulta.precio_venta;
        resp.consulta_id = consultaId;

        return resp;
      }
    } finally {
      quitarAvisoEspera();
      controllerActivo = null;
    }
  }

  Consultia.ConsultaRunner = {
    loadCatalog: loadCatalog,
    invalidateCatalogCache: invalidateCatalogCache,
    ejecutarConsulta: ejecutarConsulta,
    ejecutarCallback: ejecutarCallback,
    ejecutarConsultaConCobro: ejecutarConsultaConCobro,
    cancelarConsulta: cancelarConsulta,
    cobrarCreditos: cobrarCreditos,
    // refundConsulta y confirmConsulta ya no se exponen: quien liquida el
    // cobro es el servidor (bridge-proxy). Ver migración 20260815200000.
    cancelarSiNoSeUso: cancelarSiNoSeUso,
    verificarSaldo: verificarSaldo,
    esAdmin: esAdmin,
    esRespuestaVacia: esRespuestaVacia,
    prettyLabel: prettyLabel,
    toTitleCase: toTitleCase,
  };
})();
