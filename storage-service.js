"use strict";
// ============================================================
// StorageService — única puerta de entrada a los datos.
// Ningún módulo debe usar localStorage o indexedDB directamente
// para datos de negocio. Todo pasa por acá. Esto permite
// reemplazar IndexedDB por un servidor propio en el futuro
// sin tocar el resto del código (pantallas, lógica de negocio).
// ============================================================
var StorageService = (function () {
  var DB_NAME = "gamon-agenda-db";
  var DB_VERSION = 2; // v1: clients/events/notes. v2: infraestructura del módulo Procesos (ver MIGRACIONES.md)
  var LEGACY_LOCALSTORAGE_KEY = "gamon-agenda-data-v1";
  var MIGRATION_FLAG_KEY = "gamon-agenda-migrated-v1";
  var SEED_FLAG_KEY = "gamon-agenda-seed-v2";

  // ------------------------------------------------------------
  // Esquema declarativo: cada store define sus índices secundarios.
  // Los índices existen para que, con decenas de miles de procesos,
  // las búsquedas frecuentes no tengan que recorrer toda la tabla
  // en JavaScript (getAll + filter), sino usar el índice de IndexedDB.
  // ------------------------------------------------------------
  var SCHEMA = [
    // Stores de la v1 (sin cambios, sin índices nuevos)
    { name: "clients", indexes: [] },
    { name: "events", indexes: [] },
    { name: "notes", indexes: [] },

    // Directorio de instituciones (juzgados, fiscalías, etc.)
    { name: "instituciones", indexes: [
      // Filtrar/agrupar instituciones por su tipo (ej. "todas las fiscalías")
      { name: "tipoInstitucionId", keyPath: "tipoInstitucionId" }
    ]},

    // Directorio de personas (jueces, fiscales, secretarios, contrapartes...)
    { name: "personas", indexes: [
      // "Todas las personas que trabajan en esta institución"
      { name: "institucionId", keyPath: "institucionId" }
    ]},

    // Núcleo del sistema
    { name: "procesos", indexes: [
      // Dashboards y listados: "procesos en tal estado", altísima frecuencia de uso
      { name: "estadoProcesalId", keyPath: "estadoProcesalId" },
      { name: "materiaId", keyPath: "materiaId" },
      // "Todos los procesos de este juzgado/fiscalía"
      { name: "institucionId", keyPath: "institucionId" },
      // Búsqueda rápida por número de expediente
      { name: "nurej", keyPath: "nurej" }
    ]},

    // Entidad puente: quién participa en cada proceso y con qué rol
    { name: "proceso_partes", indexes: [
      // La consulta más frecuente de todas: "las partes de este proceso"
      { name: "procesoId", keyPath: "procesoId" },
      // "Todos los procesos de este cliente" (reemplaza el clienteId fijo que tenía Proceso antes)
      { name: "clienteId", keyPath: "clienteId" },
      // "Todos los procesos donde participa esta persona" (ej. este juez, este perito)
      { name: "personaId", keyPath: "personaId" }
    ]},

    // Catálogos (todos comparten la misma forma: id, codigo, nombre, activo, createdAt, updatedAt)
    { name: "materias", indexes: [ { name: "codigo", keyPath: "codigo" }, { name: "activo", keyPath: "activo" } ] },
    { name: "tipos_proceso", indexes: [ { name: "materiaId", keyPath: "materiaId" }, { name: "codigo", keyPath: "codigo" }, { name: "activo", keyPath: "activo" } ] },
    { name: "estados_procesales", indexes: [ { name: "codigo", keyPath: "codigo" }, { name: "activo", keyPath: "activo" } ] },
    { name: "tipos_actuacion", indexes: [ { name: "codigo", keyPath: "codigo" }, { name: "activo", keyPath: "activo" } ] },
    { name: "tipos_documento", indexes: [ { name: "codigo", keyPath: "codigo" }, { name: "activo", keyPath: "activo" } ] },
    { name: "tipos_institucion", indexes: [ { name: "codigo", keyPath: "codigo" }, { name: "activo", keyPath: "activo" } ] },
    { name: "delitos", indexes: [ { name: "codigo", keyPath: "codigo" }, { name: "activo", keyPath: "activo" } ] }
  ];

  var dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (event) {
        var db = event.target.result;
        var tx = event.target.transaction;
        SCHEMA.forEach(function (entry) {
          var store;
          if (!db.objectStoreNames.contains(entry.name)) {
            store = db.createObjectStore(entry.name, { keyPath: "id" });
          } else {
            store = tx.objectStore(entry.name);
          }
          entry.indexes.forEach(function (idx) {
            if (!store.indexNames.contains(idx.name)) {
              store.createIndex(idx.name, idx.keyPath, { unique: false });
            }
          });
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

  // Trae los registros de un store filtrando por un índice secundario,
  // sin tener que traer toda la tabla y filtrar en JavaScript.
  // Ejemplo: getByIndex("proceso_partes", "procesoId", "abc-123")
  function getByIndex(storeName, indexName, value) {
    return getStore(storeName, "readonly").then(function (store) {
      return new Promise(function (resolve, reject) {
        var req = store.index(indexName).getAll(value);
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  // Trae varios registros por id en una sola transacción (evita N transacciones sueltas).
  function getMany(storeName, ids) {
    return getStore(storeName, "readonly").then(function (store) {
      return Promise.all(ids.map(function (id) {
        return new Promise(function (resolve, reject) {
          var req = store.get(id);
          req.onsuccess = function () { resolve(req.result || null); };
          req.onerror = function () { reject(req.error); };
        });
      }));
    });
  }

  // ¿Existe un registro con este id? Más barato que traerlo entero solo para chequear.
  function exists(storeName, id) {
    return getStore(storeName, "readonly").then(function (store) {
      return new Promise(function (resolve, reject) {
        var req = store.count(id);
        req.onsuccess = function () { resolve(req.result > 0); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  // Cantidad total de registros de un store (para contadores/dashboards futuros).
  function count(storeName) {
    return getStore(storeName, "readonly").then(function (store) {
      return new Promise(function (resolve, reject) {
        var req = store.count();
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  // Transacción genérica multi-store. Necesaria para operaciones atómicas
  // reales (todo-o-nada) que abarcan más de un store a la vez — por ejemplo,
  // crear un Proceso y sus ProcesoParte juntos. El "executor" recibe los
  // object stores ya abiertos y debe hacer únicamente llamadas síncronas
  // (put/delete/etc.) sobre ellos, sin await en el medio: así IndexedDB
  // garantiza que la transacción completa se confirma o se revierte entera.
  function runTransaction(storeNames, mode, executor) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx;
        try {
          tx = db.transaction(storeNames, mode);
        } catch (e) {
          reject(e);
          return;
        }
        var stores = {};
        storeNames.forEach(function (name) { stores[name] = tx.objectStore(name); });

        var result;
        try {
          result = executor(stores, tx);
        } catch (e) {
          try { tx.abort(); } catch (e2) {}
          reject(e);
          return;
        }

        tx.oncomplete = function () { resolve(result); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error || new Error("Transacción abortada")); };
      });
    });
  }

  // Ejecuta varias escrituras en UNA SOLA transacción de IndexedDB, abarcando
  // uno o más stores. O se guardan TODAS, o no se guarda NINGUNA (si algo
  // falla, la transacción entera se revierte sola — comportamiento nativo
  // de IndexedDB, no hay que implementar el rollback a mano).
  // operations: [{ store: "procesos", record: {...} }, { store: "proceso_partes", record: {...} }, ...]
  function putMultiple(operations) {
    var storeNames = operations
      .map(function (op) { return op.store; })
      .filter(function (name, i, arr) { return arr.indexOf(name) === i; });

    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeNames, "readwrite");
        var settled = false;

        tx.oncomplete = function () {
          if (!settled) { settled = true; resolve(operations.map(function (op) { return op.record; })); }
        };
        tx.onerror = function () {
          if (!settled) { settled = true; reject(tx.error); }
        };
        tx.onabort = function () {
          if (!settled) { settled = true; reject(tx.error || new Error("La transacción se revirtió por completo (putMultiple).")); }
        };

        try {
          operations.forEach(function (op) {
            tx.objectStore(op.store).put(op.record);
          });
        } catch (err) {
          settled = true;
          reject(err);
          try { tx.abort(); } catch (e) {}
        }
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

  // Genera un identificador nuevo. A partir de la Arquitectura 0.7,
  // todos los IDs nuevos son UUID v4 reales (necesario para que, el día
  // de mañana, distintos dispositivos o un servidor propio puedan crear
  // IDs sin que choquen entre sí). Los IDs ya existentes NO se migran:
  // no hace falta, con que los nuevos ya sean UUID alcanza.
  function generateId() {
    return crypto.randomUUID();
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
      try {
        localStorage.setItem(MIGRATION_FLAG_KEY, "true");
        localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY);
      } catch (e) {}
      return true;
    });
  }

  // Siembra MÍNIMA de validación (no un catálogo real todavía — eso vendrá
  // en una iteración dedicada a construir las pantallas de catálogos).
  // Solo confirma que la arquitectura nueva funciona de punta a punta.
  function seedMinimumDataIfNeeded() {
    var alreadySeeded = false;
    try {
      alreadySeeded = localStorage.getItem(SEED_FLAG_KEY) === "true";
    } catch (e) {}
    if (alreadySeeded) return Promise.resolve(false);

    var now = new Date().toISOString();
    function catalogItem(codigo, nombre) {
      return { id: generateId(), codigo: codigo, nombre: nombre, activo: true, createdAt: now, updatedAt: now };
    }

    var seeds = [
      putAll("materias", [catalogItem("CIVIL", "Civil"), catalogItem("PENAL", "Penal")]),
      putAll("estados_procesales", [catalogItem("EN_TRAMITE", "En trámite"), catalogItem("CONCLUIDO", "Concluido")]),
      putAll("tipos_institucion", [catalogItem("JUZGADO", "Juzgado"), catalogItem("FISCALIA", "Fiscalía")]),
      putAll("tipos_actuacion", [catalogItem("PRESENTACION", "Presentación de escrito"), catalogItem("CAMBIO_ESTADO", "Cambio de Estado")]),
      putAll("tipos_documento", [catalogItem("MEMORIAL", "Memorial")]),
      putAll("delitos", [catalogItem("ROBO_AGRAVADO", "Robo Agravado")])
    ];

    return Promise.all(seeds).then(function () {
      try { localStorage.setItem(SEED_FLAG_KEY, "true"); } catch (e) {}
      return true;
    });
  }

  return {
    // Debe llamarse una vez al arrancar la app, antes de leer datos.
    init: function () {
      return openDB()
        .then(migrateFromLocalStorageIfNeeded)
        .then(seedMinimumDataIfNeeded);
    },
    getAll: getAll,
    getByIndex: getByIndex,
    getMany: getMany,
    exists: exists,
    count: count,
    put: put,
    putMultiple: putMultiple,
    remove: remove,
    generateId: generateId,
    runTransaction: runTransaction,
  };
})();
