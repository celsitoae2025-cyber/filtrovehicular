/* Cuatro respuestas locales por cuenta. Reabrirlas nunca ejecuta una consulta. */
(function (root) {
  'use strict';
  var LIMIT = 4;
  var lastSaved = 0;
  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function newest(rows) {
    var byId = new Map();
    rows.forEach(function (row) { if (row && row.id) byId.set(row.id, row); });
    return Array.from(byId.values()).sort(function (a, b) {
      return (b.saved_at || new Date(b.created_at).getTime()) - (a.saved_at || new Date(a.created_at).getTime());
    }).slice(0, LIMIT);
  }

  function browserStorage() {
    var opening;
    function database() {
      if (!opening) opening = new Promise(function (resolve) {
        if (!root.indexedDB) { resolve(null); return; }
        try {
          var request = root.indexedDB.open('fvplus-recent-results', 1);
          request.onupgradeneeded = function () {
            var store = request.result.createObjectStore('results', { keyPath: 'key' });
            store.createIndex('user_id', 'user_id');
          };
          request.onsuccess = function () { resolve(request.result); };
          request.onerror = request.onblocked = function () { resolve(null); };
        } catch (_) { resolve(null); }
      });
      return opening;
    }
    async function transaction(userId, row, remove) {
      var db = await database();
      if (!db) return [];
      return new Promise(function (resolve, reject) {
        var tx = db.transaction('results', row || remove ? 'readwrite' : 'readonly');
        var store = tx.objectStore('results');
        if (row) store.put(row);
        var request = store.index('user_id').getAll(userId);
        var rows = [];
        request.onsuccess = function () {
          rows = request.result || [];
          if (row || remove) {
            var keep = remove ? [] : newest(rows).map(function (item) { return item.id; });
            rows.forEach(function (item) { if (keep.indexOf(item.id) === -1) store.delete(item.key); });
          }
        };
        tx.oncomplete = function () { resolve(remove ? [] : newest(rows)); };
        tx.onerror = tx.onabort = function () { reject(tx.error || new Error('Local results unavailable')); };
      });
    }
    return {
      read: function (userId) { return transaction(userId); },
      write: function (row) { return transaction(row.user_id, row); },
      remove: function (userId) { return transaction(userId, null, true); }
    };
  }

  function createCache(storage, changed) {
    var memory = new Map();
    var revisions = new Map();
    async function list(userId) {
      if (!userId) return [];
      var revision = revisions.get(userId) || 0;
      var stored = [];
      try { stored = await storage.read(userId); } catch (_) {}
      if (revision !== (revisions.get(userId) || 0)) return [];
      var rows = newest(stored.filter(function (row) { return row.user_id === userId; }).concat(memory.get(userId) || []));
      memory.set(userId, rows);
      return copy(rows);
    }
    return {
      list: list,
      get: async function (userId, id) {
        return (await list(userId)).find(function (row) { return row.id === id; }) || null;
      },
      remember: async function (userId, consulta, input, response) {
        if (!userId || !consulta || !response || !response.consulta_id || !response.parsed || response.sin_resultados) return null;
        var row = copy({ key: userId + ':' + response.consulta_id, user_id: userId,
          id: response.consulta_id, created_at: new Date().toISOString(), saved_at: lastSaved = Math.max(Date.now(), lastSaved + 1),
          module: consulta.categoria, type: consulta.tipo_dato, input: input,
          status: 'success', consulta: consulta, response: response });
        memory.set(userId, newest((memory.get(userId) || []).filter(function (old) { return old.id !== row.id; }).concat([row])));
        if (changed) changed(userId);
        try { await storage.write(row); } catch (_) {}
        return copy(row);
      },
      clear: async function (userId) {
        revisions.set(userId, (revisions.get(userId) || 0) + 1);
        memory.delete(userId);
        try { await storage.remove(userId); } catch (_) {}
      }
    };
  }

  root.Consultia = root.Consultia || {};
  root.Consultia.RecentResults = createCache(browserStorage(), function (userId) {
    if (root.document) root.document.dispatchEvent(new root.CustomEvent('fv:query-completed', { detail: { userId: userId } }));
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = { createCache: createCache };
})(typeof window !== 'undefined' ? window : globalThis);
