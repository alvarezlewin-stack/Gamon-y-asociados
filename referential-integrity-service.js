"use strict";
// ============================================================
// ReferentialIntegrityService — único responsable de verificar
// relaciones entre entidades en todo LexFlow. No depende de
// ningún servicio de dominio (ProcesoService, PersonaService,
// InstitutionService, etc.) — solo de StorageService. Cualquier
// servicio de dominio, presente o futuro, puede usarlo.
//
// Diseño: motor genérico impulsado por un registro declarativo
// de reglas ("quién apunta a quién"). Agregar un módulo nuevo en
// el futuro significa sumar reglas a este registro, nunca tocar
// la lógica del motor ni escribir un "if (store === ...)" nuevo.
// ============================================================
var ReferentialIntegrityService = (function () {

  // Cada regla: { storeOrigen, campo, storeDestino, opcional }
  // - storeOrigen.campo contiene un id que debe existir en storeDestino.
  // - opcional=true: solo se valida si el campo tiene un valor (para
  //   campos que pueden quedar vacíos, como delitoId o personaId/clienteId).
  var REGLAS = [
    { storeOrigen: "procesos", campo: "materiaId", storeDestino: "materias" },
    { storeOrigen: "procesos", campo: "estadoProcesalId", storeDestino: "estados_procesales" },
    { storeOrigen: "procesos", campo: "institucionId", storeDestino: "instituciones" },
    { storeOrigen: "procesos", campo: "tipoProcesoId", storeDestino: "tipos_proceso", opcional: true },
    { storeOrigen: "procesos", campo: "delitoId", storeDestino: "delitos", opcional: true },

    { storeOrigen: "proceso_partes", campo: "procesoId", storeDestino: "procesos", bloqueaEliminacion: false },
    { storeOrigen: "proceso_partes", campo: "clienteId", storeDestino: "clients", opcional: true },
    { storeOrigen: "proceso_partes", campo: "personaId", storeDestino: "personas", opcional: true },

    { storeOrigen: "personas", campo: "institucionId", storeDestino: "instituciones", opcional: true },
    { storeOrigen: "instituciones", campo: "tipoInstitucionId", storeDestino: "tipos_institucion" },
    { storeOrigen: "tipos_proceso", campo: "materiaId", storeDestino: "materias" },

    // Composición: una Actuación le pertenece a su Proceso, no lo "usa" desde
    // afuera — igual criterio que proceso_partes (Decisión 17).
    { storeOrigen: "actuaciones", campo: "procesoId", storeDestino: "procesos", bloqueaEliminacion: false },
    { storeOrigen: "actuaciones", campo: "tipoActuacionId", storeDestino: "tipos_actuacion" },
  ];

  // Stores que tienen índice secundario sobre el campo indicado (ver
  // MIGRACIONES.md v2). Para estos, la búsqueda inversa usa el índice.
  // Para los que NO están acá (delitoId, tipoProcesoId en "procesos"),
  // se recorre la tabla completa — decisión documentada, no un olvido:
  // son consultas raras (borrar un valor de catálogo), no un camino
  // caliente del sistema.
  var TIENE_INDICE = {
    "procesos.materiaId": true,
    "procesos.estadoProcesalId": true,
    "procesos.institucionId": true,
    "proceso_partes.procesoId": true,
    "proceso_partes.clienteId": true,
    "proceso_partes.personaId": true,
    "personas.institucionId": true,
    "instituciones.tipoInstitucionId": true,
    "tipos_proceso.materiaId": true,
    "actuaciones.procesoId": true,
  };

  function registrarRegla(regla) {
    REGLAS.push(regla);
  }

  // Busca, en storeOrigen, todos los registros ACTIVOS (no eliminados
  // lógicamente) cuyo campo valga exactamente "valor".
  function buscarReferencias(storeOrigen, campo, valor) {
    var clave = storeOrigen + "." + campo;
    var traerTodos = TIENE_INDICE[clave]
      ? StorageService.getByIndex(storeOrigen, campo, valor)
      : StorageService.getAll(storeOrigen).then(function (todos) {
          return todos.filter(function (r) { return r[campo] === valor; });
        });

    return traerTodos.then(function (rows) {
      return rows.filter(function (r) { return !r.eliminadoLogico; });
    });
  }

  // Antes de guardar un registro de "storeOrigen": confirma que cada
  // referencia que contenga apunte a un registro que realmente existe.
  // opciones.omitirCampos: lista de nombres de campo a NO validar esta
  // vez (uso real: creación atómica de Proceso+ProcesoParte, donde el
  // Proceso todavía no existe al validar sus partes — ver ProcesoService).
  function validarReferencias(storeOrigen, data, opciones) {
    var omitir = (opciones && opciones.omitirCampos) || [];
    var reglasAplicables = REGLAS.filter(function (r) {
      return r.storeOrigen === storeOrigen && omitir.indexOf(r.campo) === -1;
    });

    var errores = [];
    var chequeos = reglasAplicables.map(function (regla) {
      var valor = data ? data[regla.campo] : undefined;
      if (!valor) {
        if (!regla.opcional) errores.push("Falta la referencia obligatoria: " + regla.campo + ".");
        return Promise.resolve();
      }
      return StorageService.exists(regla.storeDestino, valor).then(function (existe) {
        if (!existe) errores.push("La referencia '" + regla.campo + "' no existe en " + regla.storeDestino + ".");
      });
    });

    return Promise.all(chequeos).then(function () {
      return { valido: errores.length === 0, errores: errores };
    });
  }

  // ¿Se puede eliminar (lógicamente) el registro "id" de "storeDestino"?
  // No, si algún registro activo de cualquier storeOrigen todavía lo referencia
  // Y esa relación está marcada para bloquear (bloqueaEliminacion !== false).
  // Relaciones de composición (ej. las ProcesoParte de un Proceso) no bloquean:
  // le pertenecen al Proceso, no lo "usan" desde afuera.
  function puedeEliminarse(storeDestino, id) {
    var reglasAplicables = REGLAS.filter(function (r) {
      return r.storeDestino === storeDestino && r.bloqueaEliminacion !== false;
    });

    return Promise.all(
      reglasAplicables.map(function (regla) {
        return buscarReferencias(regla.storeOrigen, regla.campo, id).then(function (encontrados) {
          return { regla: regla, cantidad: encontrados.length };
        });
      })
    ).then(function (resultados) {
      var bloqueos = resultados.filter(function (r) { return r.cantidad > 0; });
      if (!bloqueos.length) return { puedeEliminarse: true, motivos: [] };

      var motivos = bloqueos.map(function (b) {
        return "Todavía hay " + b.cantidad + " registro(s) activo(s) en '" + b.regla.storeOrigen + "' que lo referencian (campo '" + b.regla.campo + "').";
      });
      return { puedeEliminarse: false, motivos: motivos };
    });
  }

  return {
    registrarRegla: registrarRegla,
    validarReferencias: validarReferencias,
    puedeEliminarse: puedeEliminarse,
  };
})();
