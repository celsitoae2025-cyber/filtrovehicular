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
    "DNI": "Documento nacional de identidad",
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
      if (fetchErr.name === 'AbortError') throw new Error('La consulta tardó demasiado. Intenta de nuevo.');
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
    };
    var controller = new AbortController();
    var fetchTimeout = setTimeout(function () { controller.abort(); }, esperaBridge + 15000);
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

  // --- Reembolsar consulta cuando el bot falló ---
  async function refundConsulta(consultaId, reason) {
    var sb = getSB();
    if (!sb || !consultaId) return;
    try {
      await sb.rpc("refund_consulta", {
        consulta_id: consultaId,
        reason: (reason || "").slice(0, 200) || null,
      });
    } catch (err) {
      console.error("[consulta-runner] error refundando consulta:", err);
    }
  }

  // --- Confirmar consulta como exitosa (no toca saldo, solo cambia status) ---
  async function confirmConsulta(consultaId) {
    var sb = getSB();
    if (!sb || !consultaId) return;
    try {
      await sb.rpc("confirm_consulta", { consulta_id: consultaId, result_url_in: null });
    } catch (err) {
      console.warn("[consulta-runner] no se pudo confirmar consulta:", err);
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
    // 1) Verificamos saldo pero NO cobramos todavía
    var precioVenta = consulta.precio_venta;
    if (typeof precioVenta !== "number" || isNaN(precioVenta)) {
      throw new Error("Precio de venta no definido para esta consulta");
    }
    var tieneSaldo = await verificarSaldo(userId, Math.abs(precioVenta));
    if (!tieneSaldo) {
      throw new Error("Créditos insuficientes. Recarga tu cuenta para continuar.");
    }

    // 2) Llamar al bridge
    var resp = await ejecutarConsulta(consulta, valor, opts);

    // 3) Si el bot devolvió respuesta vacía / sin datos, lanzamos error y NO SE COBRA NADA
    if (esRespuestaVacia(resp)) {
      var tipo = (consulta.tipo_dato || "dato").toUpperCase();
      var msg = "No se encontraron datos para el " + tipo + " " + valor + ". No se descontaron créditos.";
      var e = new Error(msg);
      e.code = "EMPTY_RESPONSE";
      throw e;
    }

    // 4) Como fue exitosa, recién aquí descontamos los créditos.
    //    Los administradores no pagan: consume_credits ya bypassa el cobro
    //    por rol (costo 0, sin restricción de categoría) y de todas formas
    //    registra la consulta, para que quede en su historial y en las
    //    métricas del panel admin en vez de desaparecer sin dejar rastro.
    var esCuentaAdmin = await esAdmin(userId);
    var consultaId = await cobrarCreditos(userId, consulta, valor);
    await confirmConsulta(consultaId);

    // Inyectamos el costo para que la UI lo muestre
    resp.costo_deducido = esCuentaAdmin ? 0 : consulta.precio_venta;

    return resp;
  }

  Consultia.ConsultaRunner = {
    loadCatalog: loadCatalog,
    invalidateCatalogCache: invalidateCatalogCache,
    ejecutarConsulta: ejecutarConsulta,
    ejecutarCallback: ejecutarCallback,
    ejecutarConsultaConCobro: ejecutarConsultaConCobro,
    cobrarCreditos: cobrarCreditos,
    refundConsulta: refundConsulta,
    confirmConsulta: confirmConsulta,
    verificarSaldo: verificarSaldo,
    esAdmin: esAdmin,
    esRespuestaVacia: esRespuestaVacia,
    prettyLabel: prettyLabel,
    toTitleCase: toTitleCase,
  };
})();
