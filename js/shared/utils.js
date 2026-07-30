/* ============================================================
   SHARED UTILS — funciones comunes reutilizadas por múltiples módulos.
   
   Expone:
     Consultia.Utils.escapeHtml(s)
     Consultia.Utils.base64ToBlobUrl(b64, mimeType)
     Consultia.Utils.revokeActiveBlobUrls()
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  // Tracking de blob URLs para liberar memoria
  var activeBlobUrls = [];

  function base64ToBlobUrl(b64, mimeType) {
    var binary = atob(b64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    var url = URL.createObjectURL(new Blob([bytes], { type: mimeType || 'application/pdf' }));
    activeBlobUrls.push(url);
    return url;
  }

  function revokeActiveBlobUrls() {
    activeBlobUrls.forEach(function (url) {
      try { URL.revokeObjectURL(url); } catch (_) {}
    });
    activeBlobUrls = [];
  }

  Consultia.Utils = {
    escapeHtml: escapeHtml,
    base64ToBlobUrl: base64ToBlobUrl,
    revokeActiveBlobUrls: revokeActiveBlobUrls,
  };
})();
