"use strict";
// ============================================================
// InstitutionService — lógica de negocio de Instituciones
// (juzgados, fiscalías, etc.). Nunca accede a IndexedDB directo:
// todo pasa por StorageService.
// ============================================================
var InstitutionService = (function () {
  var STORE = "instituciones";

  function getById(id) {
    return StorageService.getMany(STORE, [id]).then(function (arr) {
      return arr[0] || null;
    });
  }

  // Por defecto no trae las dadas de baja lógicamente (eliminadoLogico=true).
  function listAll(opts) {
    var incluirEliminados = opts && opts.incluirEliminados;
    return StorageService.getAll(STORE).then(function (all) {
      return incluirEliminados ? all : all.filter(function (r) { return !r.eliminadoLogico; });
    });
  }

  function listByTipo(tipoInstitucionId) {
    return StorageService.getByIndex(STORE, "tipoInstitucionId", tipoInstitucionId).then(function (rows) {
      return rows.filter(function (r) { return !r.eliminadoLogico; });
    });
  }

  function create(data) {
    return ValidationService.validarInstitucion(data).then(function (validacion) {
      if (!validacion.valido) return Promise.reject({ validacion: validacion });

      var now = new Date().toISOString();
      var record = {
        id: StorageService.generateId(),
        nombre: data.nombre.trim(),
        tipoInstitucionId: data.tipoInstitucionId,
        ciudad: data.ciudad || "",
        direccion: data.direccion || "",
        eliminadoLogico: false,
        createdAt: now,
        updatedAt: now,
      };
      return StorageService.put(STORE, record);
    });
  }

  function update(id, cambios) {
    return getById(id).then(function (actual) {
      if (!actual) return Promise.reject({ error: "No existe la institución con id " + id });
      var propuesto = Object.assign({}, actual, cambios);
      return ValidationService.validarInstitucion(propuesto).then(function (validacion) {
        if (!validacion.valido) return Promise.reject({ validacion: validacion });
        propuesto.updatedAt = new Date().toISOString();
        return StorageService.put(STORE, propuesto);
      });
    });
  }

  // Eliminación lógica únicamente — nunca se borra físicamente (regla del proyecto).
  // A partir de la Arquitectura 1.0, se confirma con ReferentialIntegrityService
  // que ninguna Persona ni Proceso activo siga referenciando esta institución
  // antes de permitir la eliminación.
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
    listByTipo: listByTipo,
    create: create,
    update: update,
    softDelete: softDelete,
  };
})();
