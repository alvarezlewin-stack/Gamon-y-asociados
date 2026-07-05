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
        }).then(function (institucionBorrada) { return Object.assign({}, r, { institucionBorrada: institucionBorrada }); });
      })
      .then(function (r) {
        console.log("[SmokeTest] Institución tras softDelete (debe seguir existiendo, marcada):", r.institucionBorrada);
        if (!r.institucionBorrada || r.institucionBorrada.eliminadoLogico !== true) {
          throw new Error("La eliminación lógica no funcionó como se esperaba");
        }
        return r;
      })
      .then(function (r) {
        // --- Arquitectura 0.9: Proceso + ProcesoParte, creación atómica ---
        return StorageService.getAll("materias").then(function (materias) {
          return StorageService.getAll("estados_procesales").then(function (estados) {
            return StorageService.getAll("clients").then(function (clientes) {
              if (!materias.length || !estados.length) {
                throw new Error("Faltan catálogos mínimos (materias/estados) para probar Proceso.");
              }
              if (!clientes.length) {
                throw new Error("No hay ningún Cliente cargado — creá al menos uno desde la Agenda antes de correr esta parte del smoke test.");
              }
              var procesoDatos = {
                materiaId: materias[0].id,
                estadoProcesalId: estados[0].id,
                institucionId: r.institucion.id,
                fechaInicio: new Date().toISOString().slice(0, 10),
              };
              var partesIniciales = [
                { clienteId: clientes[0].id, rolProcesal: "Demandante" },
                { personaId: r.persona.id, rolProcesal: "Contraparte" },
              ];
              return ProcesoService.createProcesoCompleto(procesoDatos, partesIniciales);
            });
          });
        });
      })
      .then(function (resultado) {
        console.log("[SmokeTest] Proceso creado atómicamente:", resultado.proceso);
        console.log("[SmokeTest] Partes creadas junto con el proceso:", resultado.partes);
        if (resultado.partes.length !== 2) throw new Error("Se esperaban 2 partes creadas junto al proceso, hubo " + resultado.partes.length);
        return ProcesoParteService.listByProceso(resultado.proceso.id);
      })
      .then(function (partesDelProceso) {
        console.log("[SmokeTest] Partes recuperadas por procesoId:", partesDelProceso);
        if (partesDelProceso.length !== 2) throw new Error("listByProceso debería devolver 2 partes, devolvió " + partesDelProceso.length);
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
