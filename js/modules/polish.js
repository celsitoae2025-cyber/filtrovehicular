/* ============================================================
   POLISH — Mejoras UX aditivas (no toca lógica de filter.js)
   - Skeleton mientras carga el catálogo del combo
   - Validación visual en vivo del input (verde/rojo + icono)
   - Hint chip en estado vacío
   - Toolbar de acciones (Copiar / Compartir WhatsApp) sobre el resultado
============================================================ */
(function () {
  "use strict";
  if (window.ConsultiaPolish) return;
  window.ConsultiaPolish = { ready: false };

  function $(id) { return document.getElementById(id); }
  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }

  /* ---------- 1) Skeleton del combo mientras carga ---------- */
  function injectComboSkeleton() {
    var panel = $("filterComboPanel");
    if (!panel) return;
    // Si todavía dice "No hay consultas disponibles", lo dejamos como skeleton
    var empty = panel.querySelector(".combo-empty");
    if (!empty) return;
    var rows = "";
    for (var i = 0; i < 5; i++) rows += '<div class="skeleton skeleton-row"></div>';
    panel.innerHTML = rows;
    // Cuando filter.js termine cargando reemplazará el innerHTML completo,
    // así que el skeleton desaparece solo. Failsafe a los 8s:
    setTimeout(function () {
      if (panel.querySelector(".skeleton-row")) {
        panel.innerHTML = '<div class="combo-empty">No hay consultas disponibles.</div>';
      }
    }, 8000);
  }

  /* ---------- 2) Validación visual en vivo del input ---------- */
  function setupLiveValidation() {
    var input = $("filter-input");
    if (!input) return;
    // Crear icono feedback (check / x) si no existe
    var row = input.closest(".form-row");
    if (!row) return;
    var fb = row.querySelector(".input-feedback");
    if (!fb) {
      fb = document.createElement("span");
      fb.className = "input-feedback";
      fb.innerHTML = "";
      row.appendChild(fb);
    }
    var iconValid = '';
    var iconInvalid = '';

    function detectTipo() {
      // Inferimos tipo desde el placeholder (filter.js lo asigna en setConsulta)
      var ph = (input.placeholder || "").toLowerCase();
      if (ph.indexOf("dni") >= 0) return "dni";
      if (ph.indexOf("placa") >= 0) return "placa";
      return "any";
    }
    function validate(t, v) {
      v = (v || "").trim();
      if (!v) return "neutral";
      if (t === "dni")   return /^\d{8}$/.test(v) ? "valid" : "invalid";
      if (t === "placa") return v.length >= 5 ? "valid" : "invalid";
      return v.length >= 2 ? "valid" : "invalid";
    }
    function applyState(state) {
      input.classList.remove("is-valid", "is-invalid");
      fb.classList.remove("show-valid", "show-invalid");
      if (state === "valid") {
        input.classList.add("is-valid");
        fb.classList.add("show-valid");
        fb.innerHTML = iconValid;
      } else if (state === "invalid") {
        input.classList.add("is-invalid");
        fb.classList.add("show-invalid");
        fb.innerHTML = iconInvalid;
      } else {
        fb.innerHTML = "";
      }
    }
    function update() { applyState(validate(detectTipo(), input.value)); }
    on(input, "input", update);
    on(input, "blur", update);
    // Reset cuando cambia el placeholder (cambio de consulta)
    var lastPh = input.placeholder;
    if (window.ConsultiaPolish._phInterval) clearInterval(window.ConsultiaPolish._phInterval);
    window.ConsultiaPolish._phInterval = setInterval(function () {
      if (!document.body.contains(input)) { clearInterval(window.ConsultiaPolish._phInterval); return; }
      if (input.placeholder !== lastPh) {
        lastPh = input.placeholder;
        applyState("neutral");
      }
    }, 400);
  }

  /* ---------- 3) Hint chip en el estado vacío ---------- */
  function injectEmptyHint() {
    var empty = $("filter-empty");
    if (!empty || empty.querySelector(".empty-hint-chip")) return;
    var chip = document.createElement("div");
    chip.className = "empty-hint-chip";
    chip.innerHTML =
      '<span>El cobro de créditos solo ocurre si la consulta es exitosa.</span>';
    empty.appendChild(chip);
  }

  /* ---------- 4) Toolbar de acciones sobre el resultado ---------- */
  function extractTextFromResult(body) {
    if (!body) return "";
    // Clonamos y eliminamos canvases / imágenes / botones para sacar solo texto
    var clone = body.cloneNode(true);
    clone.querySelectorAll("canvas, img, .cr-pdf-nav, .cr-pdf-icon-btn, .result-actions, .cr-btn-list").forEach(function (n) { n.remove(); });
    var txt = (clone.innerText || "").replace(/\n{3,}/g, "\n\n").trim();
    return txt;
  }
  function injectResultActions(body) {
    if (!body || body.querySelector(".result-actions")) return;
    var hasContent = body.querySelector(".cr-row, .cr-tit, .cr-pdf-block, .cr-gallery");
    if (!hasContent) return;

    var bar = document.createElement("div");
    bar.className = "result-actions";
    bar.innerHTML =
      '<button type="button" class="result-action-btn" data-act="copy">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
        '<span>Copiar</span>' +
      '</button>' +
      '<button type="button" class="result-action-btn wa" data-act="wa">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>' +
        '<span>Compartir</span>' +
      '</button>';
    body.appendChild(bar);

    bar.addEventListener("click", function (e) {
      var btn = e.target.closest(".result-action-btn");
      if (!btn) return;
      var act = btn.dataset.act;
      var txt = extractTextFromResult(body);
      if (!txt) return;

      if (act === "copy") {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(txt).then(function () {
            btn.classList.add("is-success");
            var span = btn.querySelector("span");
            var prev = span.textContent;
            span.textContent = "Copiado";
            setTimeout(function () {
              btn.classList.remove("is-success");
              span.textContent = prev;
            }, 1600);
          }).catch(function () {
            if (window.Consultia && Consultia.toast) Consultia.toast({ type: "error", title: "No se pudo copiar" });
          });
        }
      } else if (act === "wa") {
        var msg = encodeURIComponent(txt.slice(0, 1500));
        window.open("https://wa.me/?text=" + msg, "_blank", "noopener");
      }
    });
  }

  /* ---------- Observador del panel de resultado ---------- */
  function watchResultBody() {
    var body = $("filter-result-body");
    if (!body) return;
    var mo = new MutationObserver(function () {
      // Ignorar cuando es estado de carga
      if (body.querySelector(".cr-loading")) return;
      // injectResultActions(body);
    });
    mo.observe(body, { childList: true, subtree: false });
  }

  /* ---------- Init ---------- */
  function init() {
    injectComboSkeleton();
    setupLiveValidation();
    injectEmptyHint();
    watchResultBody();
    window.ConsultiaPolish.ready = true;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
