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

**[ACTUALIZACIÓN — Arquitectura 1.0: este pendiente quedó resuelto para el caso de eliminación de instituciones/personas/catálogos en uso. Sigue abierto el caso específico de "proceso sin ninguna parte principal después de creado" — ver Decisión 18.]**

---

## Arquitectura 1.0 — ReferentialIntegrityService

**Decisión 15 — Motor genérico basado en registro declarativo, no si/entonces por entidad.**
`ReferentialIntegrityService` no conoce "Proceso", "Persona" ni "Institución" como conceptos — solo conoce una lista de reglas `{ storeOrigen, campo, storeDestino, opcional, bloqueaEliminacion }`. Las dos capacidades pedidas (validar antes de guardar, impedir borrar en uso) se derivan de la misma lista. Un módulo futuro solo necesita `registrarRegla(...)`, nunca modificar el motor.

**Decisión 16 — Dos índices que hubiesen sido necesarios (`procesos.delitoId`, `procesos.tipoProcesoId`) no se agregaron.**
Para la búsqueda inversa "¿qué procesos usan este delito/tipo?", lo ideal sería un índice secundario. Se decidió NO agregarlo ahora (evita tocar `MIGRACIONES.md` sin necesidad real): son consultas raras (dar de baja un valor de catálogo), no un camino caliente del sistema. El motor cae a recorrer la tabla completa en JavaScript para esos dos casos puntuales — documentado como decisión consciente, no como deuda oculta. Si en el futuro esas consultas se vuelven frecuentes, agregar el índice es un cambio aislado y de bajo riesgo.

**Decisión 17 — Problema estructural detectado y resuelto: no toda relación debe bloquear el borrado.**
Aplicar el motor genérico sin distinción hubiese impedido desactivar CUALQUIER Proceso (porque siempre tiene sus `ProcesoParte` activas apuntándolo). Se identificó la diferencia entre relación de **composición** (`ProcesoParte` le pertenece a `Proceso`, no lo "usa" desde afuera) y relación de **referencia externa** (`Proceso` usa una `Institución`). Se agregó el flag `bloqueaEliminacion` (default `true`) a cada regla; la única relación marcada en `false` hoy es `proceso_partes → procesos`.

**Decisión 18 — Pregunta de negocio abierta, no resuelta técnicamente todavía.**
Como `ProcesoService.softDelete()` no cascada a sus `ProcesoParte`, una Persona/Cliente que participó en un proceso ya cerrado sigue "bloqueando" su propia eliminación para siempre (la parte sigue activa aunque el proceso esté inactivo). ¿Es correcto, o cerrar un proceso debería liberar a sus partes? Se deja registrado para decidir con criterio de negocio, no solo de arquitectura.

**Decisión 19 — `ValidationService` refactorizado: elimina duplicación real encontrada.**
`validarProceso`/`validarProcesoParte` tenían sus propias consultas de existencia (`StorageService.exists(...)`) escritas a mano, duplicando lo que ahora hace `ReferentialIntegrityService`. Se eliminó la duplicación: `ValidationService` se queda con reglas de forma/negocio (campos obligatorios, fechas, exclusividad cliente/persona) y delega toda verificación de referencias al motor centralizado. De paso, se cerró un hueco que existía desde la Arquitectura 0.8: `validarInstitucion`/`validarPersona` nunca habían verificado que `tipoInstitucionId`/`institucionId` existieran de verdad (solo que el campo viniera lleno) — ahora sí, con el mismo motor. Esto las convirtió de síncronas a asíncronas (como ya lo eran `validarProceso`/`validarProcesoParte` desde la Arquitectura 0.9); se actualizaron `InstitutionService` y `PersonaService` en consecuencia, sin cambios de comportamiento para quien las use desde afuera.

**Impacto en módulos existentes:** `softDelete()` de `InstitutionService`, `PersonaService`, `ProcesoService` y `ProcesoParteService` ahora consultan `puedeEliminarse()` antes de marcar como eliminado. Comportamiento nuevo (antes no bloqueaban nunca), pero es exactamente la funcionalidad pedida — no una regresión.

**MIGRACIONES.md no se modificó** — no hubo cambio de esquema (ni stores ni índices nuevos); se decidió explícitamente no agregar los 2 índices mencionados en la Decisión 16.


---

## Ajuste de UX — Saludo dinámico en el encabezado

**Decisión 11 — El saludo pasa a depender del perfil del usuario y de la hora del sistema, como parte de la personalización de la experiencia de uso.**
El encabezado ahora muestra un saludo dinámico (`I18N.construirSaludoCompleto()`), calculado según la hora del dispositivo (mañana/tarde/noche) y el nombre + título profesional del usuario, si están configurados. El texto ya no vive escrito a mano en `app.js`, sino en un diccionario centralizado (`i18n.js`), preparado para agregar otros idiomas en el futuro sin buscar y reemplazar cadenas sueltas por toda la aplicación.

**Decisión 12 — El perfil del usuario vive en `localStorage`, no en `IndexedDB`.**
Nombre, apellido y título profesional (Abg., Dra., etc.) son una preferencia de configuración del dispositivo, no un dato de negocio del estudio — no se lista, no se relaciona con Procesos, no necesita índices ni `StorageService`. Esto respeta la regla ya establecida del proyecto: `localStorage` queda para preferencias/configuración, `IndexedDB` para datos de negocio.

**Aclaración de alcance importante:** todavía no existe una pantalla de Configuración donde cargar este perfil — es la razón por la que, hasta que se construya (módulo Configuración, ya en el roadmap), el saludo va a mostrarse sin nombre (solo "Buenos días"/"Buenas tardes"/"Buenas noches"), degradando con elegancia en vez de mostrar un dato inventado o un espacio vacío.

**Pedido de identidad de marca (isotipo de LexFlow, doble nivel de marca, ícono de PWA/Play Store/notificaciones/PDF/sitio web) recibido y NO implementado en esta iteración** — es una decisión de diseño de marca grande, no un ajuste de UX chico, y merece su propia conversación de diseño antes de tocar código (ver respuesta de Claude en el chat).

---

## Arquitectura 0.9 (cierre) — Capacidad transaccional generalizada

**Decisión 13 — División del proyecto en dos responsabilidades: Claude A (arquitectura/backend) y Claude B (diseño/UX), a partir de esta iteración.**
Este documento (`DECISION-LOG.md`), junto con `ARCHITECTURE.md` y `MIGRACIONES.md`, queda bajo responsabilidad de Claude A. El diseño visual y la experiencia de usuario se documentan aparte, en `DESIGN-ROADMAP.md` (Claude B).

**Decisión 14 — `putMultiple()` tenía una limitación real: solo soportaba `put`, no `delete`.**
Auditoría solicitada por el Director: se confirmó que la arquitectura sí soporta transacciones reales multi-store (no es una limitación falsa), pero de forma incompleta — no se podían combinar creación/actualización con eliminación en una misma operación atómica. Se resolvió de forma permanente y genérica, no con un parche puntual para Proceso:
- `runTransaction(storeNames, modo, funcionDeTrabajo)`: primitiva de bajo nivel, entrega la transacción cruda de IndexedDB. Base de todo lo demás.
- `writeMany(operaciones)`: nueva, admite mezclar `put` y `remove` atómicamente. Para cualquier servicio futuro, no solo Proceso.
- `putMultiple()` se mantiene con la misma firma y comportamiento (compatibilidad total con `ProcesoService.createProcesoCompleto()`, que no necesitó ningún cambio), reimplementada por dentro sobre `runTransaction()`.

**Impacto en módulos existentes:** ninguno. `ProcesoService` y `ProcesoParteService` no se modificaron — siguen llamando a `putMultiple()` exactamente igual que antes.

**MIGRACIONES.md no se tocó** — no hubo cambio de esquema de IndexedDB (ni stores ni índices nuevos), solo de la capa de acceso a datos.



