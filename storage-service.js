"use strict";
// ============================================================
// StorageService — única puerta de entrada a los datos.
// Ningún módulo debe usar localStorage o indexedDB directamente
// para datos de negocio (clientes, eventos, notas, etc.).
// Todo pasa por acá. Esto permite reemplazar IndexedDB por un
// servidor propio en el futuro sin tocar el resto del código.
// ============================================================
var StorageService = (function () {
  var DB_NAME = "gamon-agenda-db";
  var DB_VERSION = 1;
  var STORES = ["clients", "events", "notes"];
  var LEGACY_LOCALSTORAGE_KEY = "gamon-agenda-data-v1";
  var MIGRATION_FLAG_KEY = "gamon-agenda-migrated-v1";

  var dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (event) {
        var db = event.target.result;
        STORES.forEach(function (store) {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store, { keyPath: "id" });
          }
        });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return dbPromise;
  }

  function getStore(storeName, mode) {
    return openDB().then(function (db) {
      return db.transaction(storeName, mode).objectStore(storeName);
    });
  }

  function getAll(storeName) {
    return getStore(storeName, "readonly").then(function (store) {
      return new Promise(function (resolve, reject) {
        var req = store.getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function put(storeName, record) {
    return getStore(storeName, "readwrite").then(function (store) {
      return new Promise(function (resolve, reject) {
        var req = store.put(record);
        req.onsuccess = function () { resolve(record); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function remove(storeName, id) {
    return getStore(storeName, "readwrite").then(function (store) {
      return new Promise(function (resolve, reject) {
        var req = store.delete(id);
        req.onsuccess = function () { resolve(true); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function putAll(storeName, records) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var transaction = db.transaction(storeName, "readwrite");
        var store = transaction.objectStore(storeName);
        records.forEach(function (r) { store.put(r); });
        transaction.oncomplete = function () { resolve(true); };
        transaction.onerror = function () { reject(transaction.error); };
      });
    });
  }

  // Migración automática y transparente desde localStorage (se ejecuta una sola vez por dispositivo)
  function migrateFromLocalStorageIfNeeded() {
    var alreadyMigrated = false;
    try {
      alreadyMigrated = localStorage.getItem(MIGRATION_FLAG_KEY) === "true";
    } catch (e) { /* localStorage no disponible: seguimos igual */ }

    if (alreadyMigrated) return Promise.resolve(false);

    var legacy = null;
    try {
      var raw = localStorage.getItem(LEGACY_LOCALSTORAGE_KEY);
      legacy = raw ? JSON.parse(raw) : null;
    } catch (e) {
      legacy = null;
    }

    if (!legacy) {
      try { localStorage.setItem(MIGRATION_FLAG_KEY, "true"); } catch (e) {}
      return Promise.resolve(false);
    }

    var jobs = [];
    if (Array.isArray(legacy.clients) && legacy.clients.length) jobs.push(putAll("clients", legacy.clients));
    if (Array.isArray(legacy.events) && legacy.events.length) jobs.push(putAll("events", legacy.events));
    if (Array.isArray(legacy.notes) && legacy.notes.length) jobs.push(putAll("notes", legacy.notes));

    return Promise.all(jobs).then(function () {
      try { localStorage.setItem(MIGRATION_FLAG_KEY, "true"); } catch (e) {}
      // No borramos el localStorage viejo: queda como respaldo silencioso.
      return true;
    });
  }

  return {
    // Debe llamarse una vez al arrancar la app, antes de leer datos.
    init: function () {
      return openDB().then(migrateFromLocalStorageIfNeeded);
    },
    getAll: getAll,
    put: put,
    remove: remove,
  };
})();
