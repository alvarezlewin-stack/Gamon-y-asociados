# Decision Log — LexFlow Bolivia

Registro cronológico de decisiones arquitectónicas relevantes, con su justificación. Se actualiza en cada iteración que introduzca una decisión de diseño, no solo código.

---

## Arquitectura 0.8 — InstitutionService, PersonaService, ValidationService

**Decisión 1 — Los servicios de dominio no acceden a IndexedDB, ni siquiera indirectamente por atajo.**
`InstitutionService` y `PersonaService` llaman exclusivamente a `StorageService`. Ninguno importa ni referencia `indexedDB` de forma directa. Esto mantiene válida la promesa central del proyecto: reemplazar `IndexedDB` por un servidor propio en el futuro implicará reescribir `StorageService`, no los servicios de dominio ni las pantallas.

**Decisión 2 — Eliminación lógica implementada, integridad referencial documentada pero no aplicada todavía.**
`softDelete()` en ambos servicios marca `eliminadoLogico: true` sin borrar físicamente, cumpliendo la regla del proyecto. **Deliberadamente no se implementó** todavía el chequeo de "¿alguien más referencia este registro antes de dejarlo inactivo?" — hacerlo bien requiere una función `ReferentialIntegrityService.puedeEliminarse(storeName, id)` que consulte los índices de todas las entidades que podrían apuntar a ese registro (por ejemplo, antes de inactivar una Institución, revisar si alguna Persona o Proceso todavía la referencia vía `getByIndex`). Se documenta la intención ahora para que la próxima iteración que la implemente no tenga que redescubrir el diseño, pero se pospone la implementación real para no mezclar dos responsabilidades grandes en una misma iteración pequeña (regla de "iteraciones chicas" del proyecto).

**Decisión 3 — Validaciones centralizadas desde el día uno, aunque el sistema sea chico todavía.**
`ValidationService` nace con solo 2 funciones (`validarInstitucion`, `validarPersona`), pero el patrón (recibir datos, devolver `{ valido, errores }`) ya queda establecido para que todas las validaciones futuras (Proceso, ProcesoParte, Actuación, etc.) lo sigan sin inventar una convención nueva cada vez.

**Decisión 4 — Búsqueda de personas por nombre es un filtro en JavaScript, no una consulta indexada.**
IndexedDB no ofrece búsqueda de texto parcial nativa (los índices son de coincidencia exacta). Para el volumen actual (directorio de personas de un estudio, no una base nacional), traer los registros activos y filtrar en memoria es correcto y simple. Se documenta como punto a revisar si el directorio de Personas creciera a un volumen donde este enfoque se vuelva lento (no hay una cifra mágica; se revisará si se nota lentitud real).

**Decisión 5 — Prueba de humo (`smoke-test.js`) en vez de pantallas de prueba.**
Para verificar que ambos servicios funcionan de punta a punta sin construir UI (fuera del alcance de esta iteración), se agregó un archivo ejecutable manualmente desde la consola del navegador (`LexFlowSmokeTest.run()`). No se carga ni ejecuta automáticamente, no es visible para el usuario final, y se puede quitar del `index.html` sin ningún impacto cuando ya no se necesite (queda marcado como herramienta de desarrollo, no como funcionalidad de producto).

---

## Pendiente para el Decision Log de la próxima iteración
Diseño de `ReferentialIntegrityService` (mencionado en la Decisión 2) cuando se aborde integridad referencial completa.

---

## Arquitectura 0.9 — ProcesoService, ProcesoParteService, atomicidad real

**Decisión 6 — `StorageService.putMultiple()`: transacción atómica multi-store.**
`createProcesoCompleto()` necesitaba una garantía real de "todo o nada" a nivel de motor de base de datos, no solo "llamar a dos funciones seguidas". Se agregó `putMultiple(operaciones)` a `StorageService`, que abre **una sola transacción de IndexedDB** abarcando todos los stores involucrados. Si cualquier escritura falla, IndexedDB revierte la transacción completa de forma nativa — no hace falta (ni sería confiable) programar un rollback manual. Sigue siendo un método técnico de `StorageService`; ningún servicio de dominio toca `indexedDB` directamente.

**Decisión 7 — Validaciones asíncronas a partir de Proceso/ProcesoParte.**
`validarInstitucion` y `validarPersona` son síncronas (solo miran campos propios). `validarProceso` y `validarProcesoParte` son **asíncronas** (devuelven `Promise<{valido, errores}>`) porque necesitan confirmar, contra `StorageService`, que las referencias externas (materia, estado, institución, cliente, persona, proceso) existen de verdad. No es una inconsistencia: cada validador es síncrono o asíncrono según si necesita o no verificar integridad referencial real.

**Decisión 8 — Problema de diseño detectado y resuelto: validar partes de un Proceso que todavía no existe.**
Durante la implementación se detectó que `validarProcesoParte()` no podía, tal como estaba pensada, validar las partes iniciales de `createProcesoCompleto()` — exigiría que el Proceso ya existiera, pero se crea en la misma operación atómica. Solución: `validarProcesoParte(data, { omitirChequeoDeProcesoExistente: true })`. El flujo normal (`ProcesoParteService.create()`, agregar una parte a un proceso ya existente) siempre valida con el comportamiento por defecto (`false`) — la flexibilización es exclusiva del flujo de creación atómica.

**Decisión 9 — Regla de negocio: ningún Proceso puede crearse sin al menos una parte que sea Cliente del estudio.**
Implementada en `createProcesoCompleto()`, antes de cualquier escritura: si `partesIniciales` no tiene ninguna entrada con `clienteId`, la operación se rechaza sin tocar la base. Evita procesos "huérfanos" de sentido de negocio (¿para quién trabajamos en ese expediente?).

**Decisión 10 — Ningún índice nuevo fue necesario en esta iteración.**
Todas las consultas de `ProcesoParteService` (`listByProceso`, `listByCliente`, `listByPersona`) usan los índices ya creados en la Arquitectura 0.7. `ValidationService` usa `StorageService.exists()`, que consulta por clave primaria y no requiere índice adicional. No se tocó `MIGRACIONES.md` porque no hubo cambio de esquema.

**Pendiente conocido (no oculto):** la integridad referencial sigue sin ser general — hoy solo se garantiza en el momento de *crear* (no se puede crear un Proceso apuntando a una institución/materia/estado inexistente, ni una parte apuntando a un cliente/persona/proceso inexistente). Todavía no existe una verificación que impida, por ejemplo, dejar un Proceso sin ninguna parte principal *después* de haberlo creado (si alguien borra lógicamente todas sus partes una por una). Se documenta para abordar junto con `ReferentialIntegrityService` en una iteración futura.

