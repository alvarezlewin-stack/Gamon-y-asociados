"use strict";
// ============================================================
// ValidationService — infraestructura inicial para centralizar
// las reglas de negocio de validación. Ninguna pantalla debe
// escribir sus propias validaciones sueltas: todas pasan por acá,
// para que existan en un solo lugar cuando el sistema crezca.
// ============================================================
var ValidationService = (function () {

  function ok() {
    return { valido: true, errores: [] };
  }

  function fail(errores) {
    return { valido: false, errores: errores };
  }

  function validarInstitucion(data) {
    var errores = [];
    if (!data || !data.nombre || !data.nombre.trim()) {
      errores.push("El nombre de la institución es obligatorio.");
    }
    if (!data || !data.tipoInstitucionId) {
      errores.push("Debe indicarse el tipo de institución.");
    }
    return errores.length ? fail(errores) : ok();
  }

  function validarPersona(data) {
    var errores = [];
    if (!data || !data.nombre || !data.nombre.trim()) {
      errores.push("El nombre de la persona es obligatorio.");
    }
    return errores.length ? fail(errores) : ok();
  }

  // A diferencia de validarInstitucion/validarPersona (síncronas, solo miran
  // campos propios), validarProceso y validarProcesoParte necesitan confirmar
  // que las referencias (materia, institución, cliente, persona) EXISTEN de
  // verdad en la base — eso requiere consultar StorageService, que es
  // asíncrono. Por eso estas dos funciones devuelven una Promise<{valido,errores}>
  // en vez de un objeto directo. Es una evolución deliberada del patrón, no
  // una inconsistencia: cada validador es síncrono o asíncrono según si
  // necesita o no verificar existencia de una referencia externa.

  function validarProceso(data) {
    var errores = [];
    if (!data || !data.materiaId) errores.push("Debe indicarse la materia del proceso.");
    if (!data || !data.estadoProcesalId) errores.push("Debe indicarse el estado procesal.");
    if (!data || !data.institucionId) errores.push("Debe indicarse la institución (juzgado o fiscalía).");
    if (!data || !data.fechaInicio) errores.push("Debe indicarse la fecha de inicio.");
    if (data && data.fechaInicio && data.fechaCierre && data.fechaCierre < data.fechaInicio) {
      errores.push("La fecha de cierre no puede ser anterior a la fecha de inicio.");
    }
    // NUREJ es opcional (puede no existir todavía si el proceso recién se está armando);
    // si viene, alcanza con que no sea una cadena vacía. No se valida formato estricto
    // todavía por no existir una definición oficial única a validar en esta iteración.
    if (data && data.nurej !== undefined && data.nurej !== null && !String(data.nurej).trim() && data.nurej !== "") {
      errores.push("El NUREJ, si se indica, no puede estar vacío.");
    }

    // Si ya hay errores de forma, no tiene sentido gastar consultas a la base
    // verificando existencia de referencias que ni siquiera vinieron.
    var chequeos = [];
    if (data && data.materiaId) {
      chequeos.push(StorageService.exists("materias", data.materiaId).then(function (existe) {
        if (!existe) errores.push("La materia indicada no existe.");
      }));
    }
    if (data && data.estadoProcesalId) {
      chequeos.push(StorageService.exists("estados_procesales", data.estadoProcesalId).then(function (existe) {
        if (!existe) errores.push("El estado procesal indicado no existe.");
      }));
    }
    if (data && data.institucionId) {
      chequeos.push(StorageService.exists("instituciones", data.institucionId).then(function (existe) {
        if (!existe) errores.push("La institución indicada no existe.");
      }));
    }

    return Promise.all(chequeos).then(function () {
      return errores.length ? fail(errores) : ok();
    });
  }

  // opts.omitirChequeoDeProcesoExistente: se usa únicamente desde
  // ProcesoService.createProcesoCompleto(), donde el Proceso todavía no
  // existe en la base en el momento de validar (se crea en la misma
  // transacción atómica) — no tendría sentido pedirle a esta función que
  // confirme la existencia de algo que se va a crear un instante después.
  function validarProcesoParte(data, opts) {
    opts = opts || {};
    var errores = [];

    if (!data) {
      return Promise.resolve(fail(["Datos de la parte procesal vacíos."]));
    }

    var tieneCliente = !!data.clienteId;
    var tienePersona = !!data.personaId;
    if (tieneCliente && tienePersona) {
      errores.push("Una parte procesal no puede ser Cliente y Persona al mismo tiempo — debe ser una sola cosa.");
    }
    if (!tieneCliente && !tienePersona) {
      errores.push("Debe indicarse un Cliente o una Persona para esta parte procesal.");
    }
    if (!data.rolProcesal || !String(data.rolProcesal).trim()) {
      errores.push("Debe indicarse el rol procesal (ej. Demandante, Demandado, Juez).");
    }
    if (!opts.omitirChequeoDeProcesoExistente && !data.procesoId) {
      errores.push("Debe indicarse a qué proceso pertenece esta parte.");
    }

    var chequeos = [];
    if (tieneCliente) {
      chequeos.push(StorageService.exists("clients", data.clienteId).then(function (existe) {
        if (!existe) errores.push("El cliente indicado no existe.");
      }));
    }
    if (tienePersona) {
      chequeos.push(StorageService.exists("personas", data.personaId).then(function (existe) {
        if (!existe) errores.push("La persona indicada no existe.");
      }));
    }
    if (!opts.omitirChequeoDeProcesoExistente && data.procesoId) {
      chequeos.push(StorageService.exists("procesos", data.procesoId).then(function (existe) {
        if (!existe) errores.push("El proceso indicado no existe.");
      }));
    }

    return Promise.all(chequeos).then(function () {
      return errores.length ? fail(errores) : ok();
    });
  }

  return {
    validarInstitucion: validarInstitucion,
    validarPersona: validarPersona,
    validarProceso: validarProceso,
    validarProcesoParte: validarProcesoParte,
  };
})();
