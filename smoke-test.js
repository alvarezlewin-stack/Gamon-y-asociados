"use strict";
// ============================================================
// Prueba mínima de humo (smoke test) — sin UI, se corre a mano
// desde la consola del navegador escribiendo: LexFlowSmokeTest.run()
// Cubre: InstitutionService, PersonaService, ProcesoService,
// ProcesoParteService, y (desde la Arquitectura 1.0) que
// ReferentialIntegrityService realmente BLOQUEE eliminaciones en uso,
// no solo que las operaciones normales funcionen.
// ============================================================
var LexFlowSmokeTest = (function () {

  function esperarRechazoBloqueado(promesa, etiqueta) {
    return promesa.then(
      function () {
        throw new Error(etiqueta + ": se esperaba que la eliminación fuera BLOQUEADA por integridad referencial, pero se permitió.");
      },
      function (err) {
        if (!err || !err.validacion || err.validacion.valido !== false) {
          throw new Error(etiqueta + ": se rechazó, pero no por el motivo esperado (integridad referencial). Detalle: " + JSON.stringify(err));
        }
        console.log("[SmokeTest] " + etiqueta + " — bloqueado correctamente:", err.validacion.errores);
        return true;
      }
    );
  }

  function run() {
    console.log("[SmokeTest] Iniciando...");
    var ctx = {};

    return StorageService.init()
      .then(function () {
        return StorageService.getAll("tipos_institucion");
      })
      .then(function (tiposInstitucion) {
        if (!tiposInstitucion.length) throw new Error("Falta el catálogo mínimo tipos_institucion (siembra de Arquitectura 0.7).");
        return InstitutionService.create({
          nombre: "Juzgado de Prueba SmokeTest",
          tipoInstitucionId: tiposInstitucion[0].id, // id REAL del catálogo, no inventado
          ciudad: "La Paz",
        });
      })
      .then(function (institucion) {
        console.log("[SmokeTest] Institución creada:", institucion);
        ctx.institucion = institucion;
        return PersonaService.create({
          nombre: "Juan",
          apellido: "Pérez (SmokeTest)",
          institucionId: institucion.id,
        });
      })
      .then(function (persona) {
        console.log("[SmokeTest] Persona creada:", persona);
        ctx.persona = persona;
        return PersonaService.listByInstitucion(ctx.institucion.id);
      })
      .then(function (lista) {
        console.log("[SmokeTest] Personas de la institución:", lista);
        if (lista.length !== 1) throw new Error("Se esperaba 1 persona vinculada, se encontraron " + lista.length);

        // --- Arquitectura 1.0: la institución NO debe poder eliminarse
        // mientras una Persona activa todavía la referencia. ---
        return esperarRechazoBloqueado(InstitutionService.softDelete(ctx.institucion.id), "Borrar institución con persona activa");
      })
      .then(function () {
        // --- Arquitectura 0.9: Proceso + ProcesoParte, creación atómica ---
        return Promise.all([
          StorageService.getAll("materias"),
          StorageService.getAll("estados_procesales"),
          StorageService.getAll("clients"),
        ]);
      })
      .then(function (resultados) {
        var materias = resultados[0], estados = resultados[1], clientes = resultados[2];
        if (!materias.length || !estados.length) throw new Error("Faltan catálogos mínimos (materias/estados) para probar Proceso.");
        if (!clientes.length) throw new Error("No hay ningún Cliente cargado — creá al menos uno desde la Agenda antes de correr el smoke test.");

        var procesoDatos = {
          materiaId: materias[0].id,
          estadoProcesalId: estados[0].id,
          institucionId: ctx.institucion.id,
          fechaInicio: new Date().toISOString().slice(0, 10),
        };
        var partesIniciales = [
          { clienteId: clientes[0].id, rolProcesal: "Demandante" },
          { personaId: ctx.persona.id, rolProcesal: "Contraparte" },
        ];
        return ProcesoService.createProcesoCompleto(procesoDatos, partesIniciales);
      })
      .then(function (resultado) {
        console.log("[SmokeTest] Proceso creado atómicamente:", resultado.proceso);
        console.log("[SmokeTest] Partes creadas junto con el proceso:", resultado.partes);
        if (resultado.partes.length !== 2) throw new Error("Se esperaban 2 partes creadas junto al proceso, hubo " + resultado.partes.length);
        ctx.proceso = resultado.proceso;
        return ProcesoParteService.listByProceso(resultado.proceso.id);
      })
      .then(function (partesDelProceso) {
        console.log("[SmokeTest] Partes recuperadas por procesoId:", partesDelProceso);
        if (partesDelProceso.length !== 2) throw new Error("listByProceso debería devolver 2 partes, devolvió " + partesDelProceso.length);

        // --- Arquitectura 1.0: la Persona NO debe poder eliminarse mientras
        // sea parte activa de un Proceso. ---
        return esperarRechazoBloqueado(PersonaService.softDelete(ctx.persona.id), "Borrar persona que es parte activa de un proceso");
      })
      .then(function () {
        // --- Arquitectura 1.0: eliminar el Proceso SÍ debe permitirse aunque
        // tenga ProcesoParte activas — es una relación de composición, no
        // una referencia externa que deba bloquear (ver DECISION-LOG.md). ---
        return ProcesoService.softDelete(ctx.proceso.id);
      })
      .then(function () {
        return ProcesoService.getById(ctx.proceso.id);
      })
      .then(function (procesoBorrado) {
        console.log("[SmokeTest] Proceso tras softDelete (debe seguir existiendo, marcado):", procesoBorrado);
        if (!procesoBorrado || procesoBorrado.eliminadoLogico !== true) {
          throw new Error("La eliminación lógica del Proceso no funcionó como se esperaba.");
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
