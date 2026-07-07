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
    return ReferentialIntegrityService.validarReferencias("instituciones", data).then(function (refs) {
      return { valido: errores.length === 0 && refs.valido, errores: errores.concat(refs.errores) };
    });
  }

  function validarPersona(data) {
    var errores = [];
    if (!data || !data.nombre || !data.nombre.trim()) {
      errores.push("El nombre de la persona es obligatorio.");
    }
    return ReferentialIntegrityService.validarReferencias("personas", data).then(function (refs) {
      return { valido: errores.length === 0 && refs.valido, errores: errores.concat(refs.errores) };
    });
  }

  // A diferencia de validarInstitucion/validarPersona (síncronas, solo miran
  // campos propios), validarProceso y validarProcesoParte necesitan confirmar
  // que las referencias (materia, institución, cliente, persona) EXISTEN de
  // verdad en la base — eso requiere consultar StorageService, que es
  // asíncrono. Por eso estas dos funciones devuelven una Promise<{valido,errores}>
  // en vez de un objeto directo. Es una evolución deliberada del patrón, no
  // una inconsistencia: cada validador es síncrono o asíncrono según si
  // necesita o no verificar existencia de una referencia externa.

  function validarProceso(data, opciones) {
    var errores = [];
    if (!data || !data.materiaId) errores.push("Debe indicarse la materia del proceso.");
    if (!data || !data.estadoProcesalId) errores.push("Debe indicarse el estado procesal.");
    if (!data || !data.institucionId) errores.push("Debe indicarse la institución (juzgado o fiscalía).");
    if (!data || !data.fechaInicio) errores.push("Debe indicarse la fecha de inicio.");
    if (data && data.fechaInicio && data.fechaCierre && data.fechaCierre < data.fechaInicio) {
      errores.push("La fecha de cierre no puede ser anterior a la fecha de inicio.");
    }
    if (data && data.nurej !== undefined && data.nurej !== null && data.nurej !== "" && !String(data.nurej).trim()) {
      errores.push("El NUREJ, si se indica, no puede estar vacío.");
    }

    // La existencia de las referencias (materia/estado/institución/tipoProceso/
    // delito) ya NO se verifica acá — es responsabilidad única de
    // ReferentialIntegrityService (Arquitectura 1.0). Evita reglas duplicadas.
    return ReferentialIntegrityService.validarReferencias("procesos", data, opciones).then(function (refs) {
      return { valido: errores.length === 0 && refs.valido, errores: errores.concat(refs.errores) };
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

    // Existencia de procesoId/clienteId/personaId: responsabilidad única de
    // ReferentialIntegrityService. omitirCampos respeta la misma excepción
    // que antes (creación atómica de Proceso+ProcesoParte).
    var omitirCampos = opts.omitirChequeoDeProcesoExistente ? ["procesoId"] : [];
    return ReferentialIntegrityService.validarReferencias("proceso_partes", data, { omitirCampos: omitirCampos }).then(function (refs) {
      return { valido: errores.length === 0 && refs.valido, errores: errores.concat(refs.errores) };
    });
  }

  return {
    validarInstitucion: validarInstitucion,
    validarPersona: validarPersona,
    validarProceso: validarProceso,
    validarProcesoParte: validarProcesoParte,
  };
})();
