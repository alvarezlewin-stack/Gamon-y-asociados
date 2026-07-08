"use strict";
// ============================================================
// I18N — diccionario centralizado de textos de interfaz.
// Ninguna pantalla debe escribir cadenas de saludo/etiquetas
// repetidas sueltas: todas pasan por acá, para que agregar un
// idioma nuevo en el futuro sea sumar un bloque a STRINGS, no
// buscar y reemplazar texto por toda la aplicación.
// ============================================================
var I18N = (function () {
  var LOCALE = "es"; // único idioma disponible hoy; preparado para sumar más

  var STRINGS = {
    es: {
      GREETING_MORNING: "Buenos días",
      GREETING_AFTERNOON: "Buenas tardes",
      GREETING_EVENING: "Buenas noches",
    }
  };

  function t(key) {
    return (STRINGS[LOCALE] && STRINGS[LOCALE][key]) || key;
  }

  // 06:00–11:59 → mañana · 12:00–18:59 → tarde · 19:00–05:59 → noche
  function saludoSegunHora(hora) {
    if (hora >= 6 && hora < 12) return t("GREETING_MORNING");
    if (hora >= 12 && hora < 19) return t("GREETING_AFTERNOON");
    return t("GREETING_EVENING");
  }

  // Arma el saludo completo a partir de la hora del dispositivo + el perfil
  // del usuario (PerfilUsuarioService). Si todavía no hay perfil configurado
  // (no existe pantalla de Configuración todavía), degrada con elegancia:
  // muestra solo el saludo base, sin coma colgando ni nombre inventado.
  function construirSaludoCompleto() {
    var base = saludoSegunHora(new Date().getHours());
    var perfil = (typeof PerfilUsuarioService !== "undefined") ? PerfilUsuarioService.get() : null;
    if (!perfil || !perfil.nombre || !perfil.nombre.trim()) return base;

    var titulo = perfil.titulo && perfil.titulo.trim() ? perfil.titulo.trim() + " " : "";
    var apellido = perfil.apellido && perfil.apellido.trim() ? " " + perfil.apellido.trim() : "";
    return base + ", " + titulo + perfil.nombre.trim() + apellido;
  }

  return {
    t: t,
    saludoSegunHora: saludoSegunHora,
    construirSaludoCompleto: construirSaludoCompleto,
  };
})();
