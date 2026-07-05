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

  // Estructura preparada para las próximas iteraciones (Proceso, ProcesoParte, etc.).
  // No se implementan todavía: solo se documenta la intención en DECISION-LOG.md.

  return {
    validarInstitucion: validarInstitucion,
    validarPersona: validarPersona,
  };
})();
