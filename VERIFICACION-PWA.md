# Verificación PWA — Gamón & Asociados / LexFlow Bolivia

**Estado: 🟢 CERTIFICADA A NIVEL DE CÓDIGO** (ver salvedad en sección 9)

---

## 1. Objetivo de la verificación

Confirmar, antes de iniciar el desarrollo de módulos jurídicos nuevos (Procesos, Actuaciones, etc.), que la infraestructura PWA de LexFlow es sólida: instalable en Android como app real, funcional sin conexión, y sin deuda técnica oculta en su capa de despliegue.

## 2. Requisitos técnicos evaluados

Manifest válido · Service Worker registrado y funcional · Scope y Start URL correctos · Display mode standalone · Íconos (estándar y maskable) · Theme/Background color consistentes · HTTPS · Estrategia de caché y offline · Procedimiento de actualización de versión.

## 3. Comprobaciones realizadas y resultado

| Comprobación | Resultado |
|---|---|
| `manifest.json` válido y completo | 🟢 Correcto |
| `service-worker.js` (install/activate/fetch) | 🟢 Correcto |
| `index.html` (enlaces, registro de SW, orden de scripts) | 🟢 Correcto |
| Scope (`"./"`) | 🟢 Correcto |
| Start URL (`"./"`, forma canónica) | 🟢 Correcto |
| Display (`standalone`) | 🟢 Correcto |
| Íconos estándar (192/512, `any`) | 🟢 Correcto |
| Íconos maskable (zona de seguridad + precacheados) | 🟢 Correcto (corregido en esta verificación) |
| Theme color / Background color | 🟢 Consistentes |
| HTTPS | 🟢 Garantizado por GitHub Pages |
| Estrategia offline (red primero, caché de respaldo) | 🟢 Correcto |
| Compatibilidad Chrome Android | 🟢 Verificado en uso real por el usuario |
| Compatibilidad Edge Android / Samsung Internet | 🟡 Técnicamente compatible (Chromium), no probado en dispositivo real |
| Compatibilidad Safari iOS | 🟡 Parcial por diseño (limitación de iOS, no del código) |

## 4. Procedimiento de instalación

1. Abrir `https://alvarezlewin-stack.github.io/Gamon-y-asociados/` en Chrome Android.
2. Navegar un momento por la app (Agenda, Clientes, etc.).
3. Menú ⋮ → "Instalar aplicación" (o el ícono de instalar en la barra de direcciones, si aparece antes).
4. Confirmar. Queda un ícono propio en la pantalla de inicio.

## 5. Procedimiento de actualización

Ver `ARQUITECTURA-PWA.md`, sección 6. En resumen: subir los archivos nuevos/modificados al repositorio en un mismo commit, y subir el número de `CACHE_NAME` en `service-worker.js` si se necesita invalidar la caché vieja de todos los usuarios.

## 6. Procedimiento de desinstalación

Mantener presionado el ícono de la app en la pantalla de inicio → "Desinstalar". Esto no borra los datos de `IndexedDB` del navegador Chrome en sí (esos se borran por separado, ver punto 7), pero sí quita el acceso directo tipo app.

## 7. Procedimiento para limpiar caché

Chrome → ⋮ → Configuración → Configuración del sitio → buscar `alvarezlewin-stack.github.io` → "Borrar y restablecer". Esto borra tanto la caché del Service Worker como los datos de `IndexedDB` — **usar con cuidado, esto borra los datos de la app** (clientes, eventos, notas) a menos que se haya hecho un respaldo antes.

## 8. Procedimiento para verificar modo Standalone

Abrir la app desde el ícono de la pantalla de inicio (no desde una pestaña de Chrome). Si no aparece la barra de direcciones ni los botones de navegación de Chrome arriba de la pantalla, está en modo standalone correctamente.

## 9. Procedimiento para comprobar funcionamiento Offline

Con la app ya instalada y abierta al menos una vez con internet: activar modo avión → abrir la app desde su ícono → debe cargar con los datos ya guardados. **Nota:** hasta el momento de este documento, este paso específico (modo avión) no fue confirmado explícitamente por el usuario — lo que sí se confirmó fue que los datos persisten entre cierres y aperturas de la app con conexión disponible. Se recomienda correr esta prueba puntual antes de considerar el punto 100% cerrado.

## 10. Problemas encontrados en esta verificación

| Problema | Causa raíz | Archivo | Solución aplicada |
|---|---|---|---|
| Íconos maskable no precacheados | Omisión al crearlos en la corrección anterior | `service-worker.js` | Agregados al `APP_SHELL`, versión de caché subida a `v5` |
| Meta tag de splash iOS sin función real | Agregado sin verificar que generara efecto real | `index.html` | Eliminado (código muerto) |

## 11. Recomendaciones futuras

- 🟨 Probar la app en Samsung Internet y/o Edge Android si el estudio usa esos navegadores, para pasar esos dos puntos de 🟡 a 🟢 con evidencia real.
- 🟨 Confirmar explícitamente la prueba de modo avión (sección 9) al menos una vez.
- 🟩 Si en el futuro se agrega una función que dependa de ventanas (ej. atajos de escritorio en una versión de PC), evaluar `display_override`.
- 🟩 Generar un ícono `apple-touch-icon` de 180x180 exacto para un resultado pixel-perfect en iOS (hoy funciona con escalado automático, sin problema visible).

---

**Conclusión formal: 🟢 PWA CERTIFICADA A NIVEL DE CÓDIGO**, con dos puntos 🟡 pendientes de verificación empírica en dispositivos que el usuario no tiene disponibles para probar en este momento (Edge/Samsung Internet Android, y confirmación explícita del modo avión). Ninguno de los dos representa un riesgo conocido — son huecos de evidencia, no defectos detectados. Queda base sólida para iniciar el desarrollo de LexFlow.
