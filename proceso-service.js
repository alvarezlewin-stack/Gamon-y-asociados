"use strict";
// ============================================================
// ProcesoService — el núcleo del sistema. Un Proceso ya NO tiene
// clienteId/juezId/fiscalId/secretarioId fijos: todas las personas
// que participan viven en ProcesoParte (ver proceso-parte-service.js).
// Nunca accede a IndexedDB directo: todo pasa por StorageService.
// ============================================================
var ProcesoService = (function () {
  var STORE = "procesos";

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

  function buildProcesoRecord(data) {
    var now = new Date().toISOString();
    return {
      id: StorageService.generateId(),
      nurej: data.nurej || "",
      materiaId: data.materiaId,
      tipoProcesoId: data.tipoProcesoId || null,
      estadoProcesalId: data.estadoProcesalId,
      prioridad: data.prioridad || "MEDIUM",
      riesgo: data.riesgo || "MEDIUM",
      institucionId: data.institucionId,
      delitoId: data.delitoId || null,
      fechaInicio: data.fechaInicio,
      fechaCierre: data.fechaCierre || null,
      observaciones: data.observaciones || "",
      etiquetas: Array.isArray(data.etiquetas) ? data.etiquetas : [],
      metadata: data.metadata || {},
      eliminadoLogico: false,
      createdAt: now,
      updatedAt: now,
    };
  }

  // ------------------------------------------------------------
  // createProcesoCompleto(proceso, partesIniciales)
  //
  // Operación de alto nivel, ATÓMICA A NIVEL DE MOTOR DE BASE DE DATOS
  // (una sola transacción de IndexedDB vía StorageService.putMultiple):
  // o se guardan el Proceso Y todas sus ProcesoParte iniciales, o no se
  // guarda nada. No es posible que quede un Proceso sin partes, ni una
  // parte "flotando" sin su Proceso, ni siquiera si el celular se queda
  // sin batería a mitad de la operación.
  //
  // Regla de negocio obligatoria (Tarea 5 de esta iteración): no se
  // permite crear un Proceso sin ninguna "parte principal" — es decir,
  // sin al menos una ProcesoParte que sea un Cliente del estudio
  // (clienteId presente). Un proceso sin ningún cliente vinculado no
  // tiene sentido de negocio (no sabríamos para quién trabajamos).
  // ------------------------------------------------------------
  function createProcesoCompleto(proceso, partesIniciales) {
    if (!Array.isArray(partesIniciales) || partesIniciales.length === 0) {
      return Promise.reject({ validacion: { valido: false, errores: ["Un proceso no puede crearse sin ninguna parte procesal."] } });
    }

    var hayParteConCliente = partesIniciales.some(function (p) { return !!p.clienteId; });
    if (!hayParteConCliente) {
      return Promise.reject({ validacion: { valido: false, errores: ["Un proceso debe tener al menos una parte principal que sea un Cliente del estudio."] } });
    }

    // 1) Validar el Proceso (existencia de materia/estado/institución, fechas).
    return ValidationService.validarProceso(proceso).then(function (validacionProceso) {
      if (!validacionProceso.valido) return Promise.reject({ validacion: validacionProceso });

      // 2) Validar cada parte, OMITIENDO el chequeo de "el proceso existe"
      //    (todavía no existe: se crea en esta misma operación — ver
      //    ValidationService.validarProcesoParte, parámetro opts).
      var validacionesPartes = partesIniciales.map(function (parte) {
        return ValidationService.validarProcesoParte(parte, { omitirChequeoDeProcesoExistente: true });
      });

      return Promise.all(validacionesPartes).then(function (resultados) {
        var errores = [];
        resultados.forEach(function (r, i) {
          if (!r.valido) {
            r.errores.forEach(function (e) { errores.push("Parte #" + (i + 1) + ": " + e); });
          }
        });

        // 3) Duplicados DENTRO del mismo lote de partesIniciales (antes de
        //    tocar la base — no tiene sentido crear dos partes idénticas
        //    en la misma operación).
        partesIniciales.forEach(function (candidata, i) {
          var resto = partesIniciales.slice(0, i);
          if (ProcesoParteService._hayDuplicado(resto, candidata)) {
            errores.push("Parte #" + (i + 1) + ": está duplicada dentro del mismo proceso (mismo cliente/persona y mismo rol que otra parte de la lista).");
          }
        });

        if (errores.length) return Promise.reject({ validacion: { valido: false, errores: errores } });

        // 4) Todo validado: recién ahora se arman los registros y se escriben
        //    en UNA sola transacción atómica.
        var procesoRecord = buildProcesoRecord(proceso);
        var operaciones = [{ store: STORE, record: procesoRecord }];

        partesIniciales.forEach(function (parte) {
          var parteConProceso = Object.assign({}, parte, { procesoId: procesoRecord.id });
          operaciones.push({ store: "proceso_partes", record: ProcesoParteService._buildRecord(parteConProceso) });
        });

        return StorageService.putMultiple(operaciones).then(function () {
          return { proceso: procesoRecord, partes: operaciones.slice(1).map(function (op) { return op.record; }) };
        });
      });
    });
  }

  function update(id, cambios) {
    return getById(id).then(function (actual) {
      if (!actual) return Promise.reject({ error: "No existe el proceso con id " + id });
      var propuesto = Object.assign({}, actual, cambios);
      return ValidationService.validarProceso(propuesto).then(function (validacion) {
        if (!validacion.valido) return Promise.reject({ validacion: validacion });
        propuesto.updatedAt = new Date().toISOString();
        return StorageService.put(STORE, propuesto);
      });
    });
  }

  // Eliminación lógica únicamente. No borra las ProcesoParte asociadas
  // (quedan históricamente vinculadas a un proceso inactivo — no se
  // implementa todavía la verificación general de integridad referencial,
  // documentado en DECISION-LOG.md).
  // Eliminación lógica únicamente. No borra las ProcesoParte asociadas (le
  // pertenecen — ver Decisión sobre "bloqueaEliminacion: false" en
  // ReferentialIntegrityService). A partir de la Arquitectura 1.0, se
  // confirma con ReferentialIntegrityService que ninguna otra entidad externa
  // (no compositiva) dependa de este proceso antes de desactivarlo — hoy
  // ninguna regla externa aplica todavía, pero queda preparado para cuando
  // existan Documentos/Actuaciones vinculadas.
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
    createProcesoCompleto: createProcesoCompleto,
    update: update,
    softDelete: softDelete,
  };
})();
