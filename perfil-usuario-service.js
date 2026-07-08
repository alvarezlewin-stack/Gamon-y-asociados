"use strict";
// ============================================================
// PerfilUsuarioService — nombre, apellido y título profesional
// del abogado/usuaria que usa este dispositivo (ej. "Abg.", "Dra.").
//
// Vive en localStorage, NO en IndexedDB/StorageService, a propósito:
// es una preferencia de configuración del dispositivo, no un dato de
// negocio del estudio (no se lista, no se relaciona con Procesos, no
// necesita índices). Esto respeta la regla ya establecida del
// proyecto: "localStorage queda únicamente para preferencias,
// configuración, tema visual, opciones menores".
//
// Todavía no existe una pantalla de Configuración donde cargarlo —
// eso es una iteración futura. Por ahora, si no hay perfil guardado,
// todo el sistema debe degradar con elegancia (ver I18N.construirSaludoCompleto).
// ============================================================
var PerfilUsuarioService = (function () {
  var KEY = "gamon-agenda-perfil-usuario";

  function get() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  // perfil: { nombre, apellido (opcional), titulo (opcional, ej. "Abg.", "Dra.") }
  function set(perfil) {
    try {
      localStorage.setItem(KEY, JSON.stringify(perfil));
      return true;
    } catch (e) {
      return false;
    }
  }

  return { get: get, set: set };
})();
