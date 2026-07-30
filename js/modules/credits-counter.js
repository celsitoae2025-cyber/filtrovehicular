/* ============================================================
   CREDITS COUNTER — Animación de conteo al actualizar el saldo.
   Cuando cambian los créditos, el número sube/baja visualmente
   del valor anterior al nuevo con una transición suave.

   Uso: en lugar de `el.textContent = String(valor)`, llamar
   `Consultia.animateCredits(el, valor)`. La animación lee el
   valor actual del elemento y anima hasta el nuevo.
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  function animateCount(el, from, to, duration) {
    var start = null;
    var diff = to - from;

    function tick(timestamp) {
      if (!start) start = timestamp;
      var progress = Math.min((timestamp - start) / duration, 1);
      // Easing out cubic
      var ease = 1 - Math.pow(1 - progress, 3);
      var current = Math.round(from + diff * ease);
      el.textContent = String(current);
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        el.textContent = String(to); // asegurar valor final exacto
      }
    }

    requestAnimationFrame(tick);
  }

  // Anima el cambio de créditos en `el` hasta `newValue`.
  Consultia.animateCredits = function (el, newValue) {
    if (!el) return;
    var target = parseInt(newValue, 10) || 0;

    // Primera vez que pintamos un valor real (al cargar/refrescar la página):
    // fijar el número directamente, SIN animación de conteo ni flash de color.
    // Así no se ve el verde ni un valor intermedio (ej. 5247 subiendo a 5872).
    if (el.dataset.creditsInit !== '1') {
      el.dataset.creditsInit = '1';
      el.textContent = String(target);
      return;
    }

    var current = parseInt(String(el.textContent).replace(/[^\d-]/g, ''), 10) || 0;
    if (current === target) { el.textContent = String(target); return; }

    animateCount(el, current, target, 800);

    // Efecto visual: flash rojo si baja, verde si sube.
    // Solo aplica en cambios reales posteriores (compra de créditos o consumo),
    // no en la carga inicial.
    var cls = target < current ? 'credits-decrease' : 'credits-increase';
    el.classList.add(cls);
    setTimeout(function () { el.classList.remove(cls); }, 1000);
  };

  // No requiere inicialización con observer — se llama explícitamente
  // desde auth-ui.js al actualizar el saldo. Se deja la función por
  // compatibilidad con main.js (no-op).
  Consultia.initCreditsCounter = function () {};
})();
