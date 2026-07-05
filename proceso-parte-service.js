"use strict";
// ============================================================
// ProcesoParteService — quién participa en cada Proceso y con
// qué rol (Demandante, Demandado, Juez, Fiscal, Contraparte...).
// Reemplaza los campos fijos clienteId/juezId/fiscalId/secretarioId
// que Proceso tenía en el diseño v1 (Arquitectura 0.7/0.8), para
// soportar litisconsorcios, múltiples partes, terceros, etc.
// Nunca accede a IndexedDB directo: todo pasa por StorageService.
// ============================================================
var ProcesoParteService = (function () {
  var STORE = "proceso_partes";

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

  function listByProceso(procesoId) {
    return StorageService.getByIndex(STORE, "procesoId", procesoId).then(function (rows) {
      return rows.filter(function (r) { return !r.eliminadoLogico; });
    });
  }

  function listByCliente(clienteId) {
    return StorageService.getByIndex(STORE, "clienteId", clienteId).then(function (rows) {
      return rows.filter(function (r) { return !r.eliminadoLogico; });
    });
  }

  function listByPersona(personaId) {
    return StorageService.getByIndex(STORE, "personaId", personaId).then(function (rows) {
      return rows.filter(function (r) { return !r.eliminadoLogico; });
    });
  }

  // "No duplicaciones inválidas": mismo proceso + mismo cliente/persona + mismo
  // rol, repetido. Sí se permite que la misma persona tenga roles distintos en
  // el mismo proceso (ej. es Testigo y además Perito), o que dos partes
  // distintas compartan el mismo rol (dos Demandados), pero no una fila idéntica.
  function hayDuplicado(partesExistentes, candidata, idAIgnorar) {
    return partesExistentes.some(function (p) {
      if (idAIgnorar && p.id === idAIgnorar) return false;
      var mismoLadoCliente = candidata.clienteId && p.clienteId === candidata.clienteId;
      var mismoLadoPersona = candidata.personaId && p.personaId === candidata.personaId;
      var mismoRol = p.rolProcesal === candidata.rolProcesal;
      return (mismoLadoCliente || mismoLadoPersona) && mismoRol;
    });
  }

  function buildRecord(data) {
    var now = new Date().toISOString();
    return {
      id: StorageService.generateId(),
      procesoId: data.procesoId,
      clienteId: data.clienteId || null,
      personaId: data.personaId || null,
      rolProcesal: data.rolProcesal.trim(),
      eliminadoLogico: false,
      createdAt: now,
      updatedAt: now,
    };
  }

  function create(data) {
    return ValidationService.validarProcesoParte(data).then(function (validacion) {
      if (!validacion.valido) return Promise.reject({ validacion: validacion });
      return listByProceso(data.procesoId).then(function (existentes) {
        if (hayDuplicado(existentes, data)) {
          return Promise.reject({ validacion: { valido: false, errores: ["Ya existe una parte idéntica (mismo cliente/persona y mismo rol) en este proceso."] } });
        }
        return StorageService.put(STORE, buildRecord(data));
      });
    });
  }

  function update(id, cambios) {
    return getById(id).then(function (actual) {
      if (!actual) return Promise.reject({ error: "No existe la parte procesal con id " + id });
      var propuesto = Object.assign({}, actual, cambios);
      return ValidationService.validarProcesoParte(propuesto).then(function (validacion) {
        if (!validacion.valido) return Promise.reject({ validacion: validacion });
        return listByProceso(propuesto.procesoId).then(function (existentes) {
          if (hayDuplicado(existentes, propuesto, id)) {
            return Promise.reject({ validacion: { valido: false, errores: ["Ya existe otra parte idéntica (mismo cliente/persona y mismo rol) en este proceso."] } });
          }
          propuesto.updatedAt = new Date().toISOString();
          return StorageService.put(STORE, propuesto);
        });
      });
    });
  }

  // Eliminación lógica únicamente. Integridad referencial completa
  // (impedir dejar un Proceso sin ninguna parte principal al borrar la
  // última) queda documentada como pendiente en DECISION-LOG.md — la
  // única garantía activa hoy es al CREAR el proceso (ver ProcesoService).
  function softDelete(id) {
    return update(id, { eliminadoLogico: true });
  }

  return {
    getById: getById,
    listAll: listAll,
    listByProceso: listByProceso,
    listByCliente: listByCliente,
    listByPersona: listByPersona,
    create: create,
    update: update,
    softDelete: softDelete,
    // Expuesto para que ProcesoService pueda validar duplicados dentro del
    // mismo lote de partesIniciales antes de crear el Proceso.
    _hayDuplicado: hayDuplicado,
    _buildRecord: buildRecord,
  };
})();
