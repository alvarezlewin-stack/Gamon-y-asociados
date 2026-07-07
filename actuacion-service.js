"use strict";
// ============================================================
// ActuacionService — cada movimiento de un expediente (audiencias,
// presentaciones, resoluciones, cambios de estado, etc.). Es la
// fuente de datos real del futuro Docket Rail / timeline (Claude B,
// DESIGN-ROADMAP.md D-002/D-008). Nunca accede a IndexedDB directo:
// todo pasa por StorageService.
// ============================================================
var ActuacionService = (function () {
  var STORE = "actuaciones";

  function getById(id) {
    return StorageService.getMany(STORE, [id]).then(function (arr) {
      return arr[0] || null;
    });
  }

  function listAll(opts) {
    var incluirEliminados = opts && opts.incluirEliminados;
    return StorageService.getAll(STORE).then(function (all) {
      return incluirEliminados ? all : all.filter(function (r) { return !r.eliminadoLogico; });
    });
  }

  // La consulta central del timeline: todas las actuaciones de un proceso,
  // ordenadas cronológicamente (más reciente primero, como cualquier bitácora).
  function listByProceso(procesoId) {
    return StorageService.getByIndex(STORE, "procesoId", procesoId).then(function (rows) {
      return rows
        .filter(function (r) { return !r.eliminadoLogico; })
        .sort(function (a, b) { return (b.fecha || "").localeCompare(a.fecha || ""); });
    });
  }

  function buildRecord(data) {
    var now = new Date().toISOString();
    return {
      id: StorageService.generateId(),
      procesoId: data.procesoId,
      tipoActuacionId: data.tipoActuacionId,
      fecha: data.fecha,
      descripcion: data.descripcion || "",
      // Solo se completa cuando tipoActuacionId corresponde a "Cambio de Estado"
      // (ver Decisión 3, Arquitectura 0.9) — reutiliza Actuación como historial
      // de estados en vez de crear una entidad aparte.
      estadoProcesalNuevoId: data.estadoProcesalNuevoId || null,
      eliminadoLogico: false,
      createdAt: now,
      updatedAt: now,
    };
  }

  function create(data) {
    return ValidationService.validarActuacion(data).then(function (validacion) {
      if (!validacion.valido) return Promise.reject({ validacion: validacion });
      return StorageService.put(STORE, buildRecord(data));
    });
  }

  function update(id, cambios) {
    return getById(id).then(function (actual) {
      if (!actual) return Promise.reject({ error: "No existe la actuación con id " + id });
      var propuesto = Object.assign({}, actual, cambios);
      return ValidationService.validarActuacion(propuesto).then(function (validacion) {
        if (!validacion.valido) return Promise.reject({ validacion: validacion });
        propuesto.updatedAt = new Date().toISOString();
        return StorageService.put(STORE, propuesto);
      });
    });
  }

  function softDelete(id) {
    return ReferentialIntegrityService.puedeEliminarse(STORE, id).then(function (resultado) {
      if (!resultado.puedeEliminarse) {
        return Promise.reject({ validacion: { valido: false, errores: resultado.motivos } });
      }
      return update(id, { eliminadoLogico: true });
    });
  }

  return {
    getById: getById,
    listAll: listAll,
    listByProceso: listByProceso,
    create: create,
    update: update,
    softDelete: softDelete,
  };
})();
