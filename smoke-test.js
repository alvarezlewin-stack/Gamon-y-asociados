"use strict";
// ============================================================
// Prueba mínima de humo (smoke test) para InstitutionService y
// PersonaService — sin UI, se corre a mano desde la consola del
// navegador escribiendo: LexFlowSmokeTest.run()
// No se ejecuta sola ni se muestra en pantalla: es una herramienta
// de verificación manual para esta iteración.
// ============================================================
var LexFlowSmokeTest = (function () {
  function run() {
    console.log("[SmokeTest] Iniciando...");
    return StorageService.init()
      .then(function () {
        return InstitutionService.create({
          nombre: "Juzgado de Prueba SmokeTest",
          tipoInstitucionId: "test-tipo-institucion",
          ciudad: "La Paz",
        });
      })
      .then(function (institucion) {
        console.log("[SmokeTest] Institución creada:", institucion);
        return PersonaService.create({
          nombre: "Juan",
          apellido: "Pérez (SmokeTest)",
          institucionId: institucion.id,
        }).then(function (persona) {
          return { institucion: institucion, persona: persona };
        });
      })
      .then(function (r) {
        console.log("[SmokeTest] Persona creada:", r.persona);
        return PersonaService.listByInstitucion(r.institucion.id).then(function (lista) {
          console.log("[SmokeTest] Personas de la institución:", lista);
          if (lista.length !== 1) throw new Error("Se esperaba 1 persona vinculada, se encontraron " + lista.length);
          return r;
        });
      })
      .then(function (r) {
        return InstitutionService.softDelete(r.institucion.id).then(function () {
          return InstitutionService.getById(r.institucion.id);
        });
      })
      .then(function (institucionBorrada) {
        console.log("[SmokeTest] Institución tras softDelete (debe seguir existiendo, marcada):", institucionBorrada);
        if (!institucionBorrada || institucionBorrada.eliminadoLogico !== true) {
          throw new Error("La eliminación lógica no funcionó como se esperaba");
        }
        console.log("%c[SmokeTest] TODO OK ✅", "color: green; font-weight: bold;");
        return true;
      })
      .catch(function (err) {
        console.error("%c[SmokeTest] FALLÓ ❌", "color: red; font-weight: bold;", err);
        return false;
      });
  }
  return { run: run };
})();
