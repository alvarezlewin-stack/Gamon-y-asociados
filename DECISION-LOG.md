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
