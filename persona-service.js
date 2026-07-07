"use strict";
// ============================================================
// PersonaService — lógica de negocio de Personas (jueces,
// fiscales, secretarios, contrapartes, etc.). Persona NO tiene
// campo "tipo": el rol de cada persona vive en la relación con
// el Proceso (proceso_partes), no en la identidad de la persona.
// Nunca accede a IndexedDB directo: todo pasa por StorageService.
// ============================================================
var PersonaService = (function () {
  var STORE = "personas";

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

  function listByInstitucion(institucionId) {
    return StorageService.getByIndex(STORE, "institucionId", institucionId).then(function (rows) {
      return rows.filter(function (r) { return !r.eliminadoLogico; });
    });
  }

  // Búsqueda simple por nombre/apellido. IndexedDB no tiene búsqueda de texto
  // nativa, así que esto trae los registros activos y filtra en JavaScript.
  // Funciona bien para cientos/pocos miles de personas; si el directorio crece
  // mucho más, se puede optimizar más adelante (marcado como mejora futura).
  function searchByNombre(query) {
    var q = (query || "").trim().toLowerCase();
    if (!q) return listAll();
    return listAll().then(function (personas) {
      return personas.filter(function (p) {
        var nombreCompleto = ((p.nombre || "") + " " + (p.apellido || "")).toLowerCase();
        return nombreCompleto.indexOf(q) !== -1;
      });
    });
  }

  function create(data) {
    return ValidationService.validarPersona(data).then(function (validacion) {
      if (!validacion.valido) return Promise.reject({ validacion: validacion });

      var now = new Date().toISOString();
      var record = {
        id: StorageService.generateId(),
        nombre: data.nombre.trim(),
        apellido: data.apellido || "",
        telefono: data.telefono || "",
        correo: data.correo || "",
        matriculaProfesional: data.matriculaProfesional || "",
        institucionId: data.institucionId || null,
        observaciones: data.observaciones || "",
        eliminadoLogico: false,
        createdAt: now,
        updatedAt: now,
      };
      return StorageService.put(STORE, record);
    });
  }

  function update(id, cambios) {
    return getById(id).then(function (actual) {
      if (!actual) return Promise.reject({ error: "No existe la persona con id " + id });
      var propuesto = Object.assign({}, actual, cambios);
      return ValidationService.validarPersona(propuesto).then(function (validacion) {
        if (!validacion.valido) return Promise.reject({ validacion: validacion });
        propuesto.updatedAt = new Date().toISOString();
        return StorageService.put(STORE, propuesto);
      });
    });
  }

  // Eliminación lógica únicamente. A partir de la Arquitectura 1.0, se
  // confirma con ReferentialIntegrityService que ninguna ProcesoParte activa
  // siga referenciando esta persona antes de permitir la eliminación.
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
    listByInstitucion: listByInstitucion,
    searchByNombre: searchByNombre,
    create: create,
    update: update,
    softDelete: softDelete,
  };
})();
